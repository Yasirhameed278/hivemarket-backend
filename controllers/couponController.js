const Coupon = require('../models/Coupon');

// POST /api/coupons/validate  — called from the checkout page
exports.validateCoupon = async (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ message: 'Coupon code is required' });

  const coupon = await Coupon.findByCode(code);
  if (!coupon || !coupon.isActive)
    return res.status(404).json({ message: 'Invalid coupon code' });

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date())
    return res.status(400).json({ message: 'This coupon has expired' });

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit)
    return res.status(400).json({ message: 'This coupon has reached its usage limit' });

  const orderSubtotal = Number(subtotal || 0);
  if (coupon.minOrder > 0 && orderSubtotal < coupon.minOrder)
    return res.status(400).json({
      message: `Minimum order of PKR ${coupon.minOrder.toLocaleString()} required for this coupon`,
    });

  const shippingCost = orderSubtotal > 100 ? 0 : 9.99;
  const discountAmount = Coupon.calcDiscount(coupon, orderSubtotal, shippingCost);

  const message =
    coupon.type === 'freeship'
      ? 'Free shipping applied!'
      : coupon.type === 'percent'
      ? `${coupon.value}% discount applied!`
      : `PKR ${coupon.value.toLocaleString()} discount applied!`;

  res.json({ code: coupon.code, type: coupon.type, value: coupon.value, discountAmount, message });
};

// ─── Admin CRUD ───────────────────────────────────────────────────────

exports.getCoupons = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const result = await Coupon.list({ page, limit });
  res.json(result);
};

exports.createCoupon = async (req, res) => {
  const { code, type, value, minOrder, usageLimit, expiresAt, isActive } = req.body;
  if (!code || !type) return res.status(400).json({ message: 'code and type are required' });

  const existing = await Coupon.findByCode(code);
  if (existing) return res.status(400).json({ message: 'A coupon with this code already exists' });

  const coupon = await Coupon.create({
    code,
    type,
    value: value || 0,
    minOrder: minOrder || 0,
    usageLimit: usageLimit || 0,
    expiresAt: expiresAt || null,
    isActive: isActive !== false,
  });
  res.status(201).json(coupon);
};

exports.updateCoupon = async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
  const updated = await Coupon.updateById(req.params.id, req.body);
  res.json(updated);
};

exports.deleteCoupon = async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
  await Coupon.deleteById(req.params.id);
  res.json({ message: 'Coupon deleted' });
};
