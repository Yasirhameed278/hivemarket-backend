const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createOrder = async (req, res) => {
  const { items, shippingAddress, paymentMethod, couponCode, paymentIntentId } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ message: 'No items in order' });

  // For card payments, verify the Stripe PaymentIntent is actually succeeded
  if (paymentMethod === 'card') {
    if (!paymentIntentId) {
      return res.status(400).json({ message: 'Payment intent ID required for card payments' });
    }
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.status !== 'succeeded') {
        return res.status(402).json({ message: `Payment not completed. Status: ${pi.status}` });
      }
    } catch (err) {
      return res.status(400).json({ message: 'Invalid payment intent' });
    }
  }

  let itemsPrice = 0;
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) return res.status(404).json({ message: `Product ${item.product} not found` });
    if (product.stock < item.quantity) return res.status(400).json({ message: `Insufficient stock for ${product.name}` });

    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.thumbnail,
      price: product.price,
      quantity: item.quantity,
      variant: item.variant || '',
    });
    itemsPrice += product.price * item.quantity;

    await Product.adjustStock(product._id, -Number(item.quantity), Number(item.quantity));
  }

  let discount = 0;
  if (couponCode === 'SAVE10') discount = itemsPrice * 0.1;
  if (couponCode === 'SAVE20') discount = itemsPrice * 0.2;
  if (couponCode === 'FREESHIP') discount = 0;

  const shippingPrice = itemsPrice > 100 ? 0 : 9.99;
  const taxPrice = Math.round(itemsPrice * 0.08 * 100) / 100;
  const totalPrice = Math.round((itemsPrice + shippingPrice + taxPrice - discount) * 100) / 100;

  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);

  const isCard = paymentMethod === 'card';
  const isCOD = paymentMethod === 'cod';

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod: paymentMethod || 'card',
    paymentResult: isCard && paymentIntentId ? { id: paymentIntentId, status: 'succeeded' } : {},
    itemsPrice,
    shippingPrice,
    taxPrice,
    discount,
    couponCode: couponCode || '',
    totalPrice,
    estimatedDelivery: estimatedDelivery.toISOString(),
    isPaid: !isCOD,
    paidAt: !isCOD ? new Date().toISOString() : null,
    status: 'confirmed',
    trackingHistory: [
      {
        _id: Order.newTrackingId(),
        status: 'confirmed',
        description: isCOD ? 'Order placed — payment on delivery' : 'Order placed and payment confirmed',
        location: '',
        timestamp: new Date().toISOString(),
      },
    ],
  });

  // Clear user cart
  await User.updateById(req.user._id, { cart: [] });

  // Inline a minimal "user" object for compatibility with the populated shape.
  const userObj = await User.findById(req.user._id);
  res.status(201).json({
    ...order,
    user: { _id: userObj._id, name: userObj.name, email: userObj.email },
  });
};

exports.getMyOrders = async (req, res) => {
  const orders = await Order.findByUser(req.user._id);
  res.json(orders);
};

exports.getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Not authorized' });

  const owner = await User.findById(order.user);
  res.json({
    ...order,
    user: owner ? { _id: owner._id, name: owner.name, email: owner.email } : null,
  });
};

exports.cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (String(order.user) !== String(req.user._id))
    return res.status(403).json({ message: 'Not authorized' });
  if (['shipped', 'delivered'].includes(order.status))
    return res.status(400).json({ message: 'Cannot cancel shipped/delivered order' });

  const trackingHistory = [
    ...(order.trackingHistory || []),
    {
      _id: Order.newTrackingId(),
      status: 'cancelled',
      description: 'Order cancelled by customer',
      location: '',
      timestamp: new Date().toISOString(),
    },
  ];

  const updated = await Order.updateById(order._id, {
    status: 'cancelled',
    trackingHistory,
  });

  // Restore stock
  for (const item of order.items) {
    await Product.adjustStock(item.product, Number(item.quantity), -Number(item.quantity));
  }
  res.json(updated);
};

// ─── Admin ───────────────────────────────────────────────────────────
exports.getAllOrders = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const { orders, total } = await Order.list({ status, page, limit });

  // Hydrate user info (name, email) for each order.
  const userIds = [...new Set(orders.map((o) => o.user).filter(Boolean))];
  const userMap = new Map();
  for (const id of userIds) {
    const u = await User.findById(id);
    if (u) userMap.set(String(id), { _id: u._id, name: u.name, email: u.email });
  }
  const enriched = orders.map((o) => ({ ...o, user: userMap.get(String(o.user)) || null }));
  res.json({ orders: enriched, total });
};

exports.updateOrderStatus = async (req, res) => {
  const { status, trackingNumber, description, location } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const descriptions = {
    processing: 'Order is being processed',
    shipped: 'Order has been shipped',
    delivered: 'Order delivered successfully',
    cancelled: 'Order has been cancelled',
    refunded: 'Order has been refunded',
  };

  const trackingHistory = [
    ...(order.trackingHistory || []),
    {
      _id: Order.newTrackingId(),
      status,
      description: description || descriptions[status] || status,
      location: location || '',
      timestamp: new Date().toISOString(),
    },
  ];

  const patch = { status, trackingHistory };
  if (trackingNumber) patch.trackingNumber = trackingNumber;
  if (status === 'delivered') {
    patch.isDelivered = true;
    patch.deliveredAt = new Date().toISOString();
  }

  const updated = await Order.updateById(order._id, patch);
  res.json(updated);
};

exports.getOrderStats = async (req, res) => {
  const [totalOrders, totalRevenueValue, statusCounts, recentOrders, monthlyRevenue] = await Promise.all([
    Order.count(),
    Order.totalRevenue(),
    Order.statusCounts(),
    Order.recent(5),
    Order.monthlyRevenue({ months: 12, paidOnly: true }),
  ]);

  // Hydrate recent orders with user names.
  const userIds = [...new Set(recentOrders.map((o) => o.user).filter(Boolean))];
  const userMap = new Map();
  for (const id of userIds) {
    const u = await User.findById(id);
    if (u) userMap.set(String(id), { _id: u._id, name: u.name });
  }
  const enrichedRecent = recentOrders.map((o) => ({ ...o, user: userMap.get(String(o.user)) || null }));

  res.json({
    totalOrders,
    totalRevenue: totalRevenueValue,
    statusCounts,
    recentOrders: enrichedRecent,
    monthlyRevenue,
  });
};
