const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { getClient } = require('../config/db');

// ─── Public ───────────────────────────────────────────────────────────────────

exports.listPublicVendors = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const { vendors } = await Vendor.list({ status: 'approved', page, limit });

    // enrich with product count
    const enriched = await Promise.all(
      vendors.map(async (v) => {
        const { total } = await Product.list({ vendorId: v._id, isActive: true, page: 1, limit: 1 });
        return { ...v, productCount: total };
      })
    );

    const filtered = search
      ? enriched.filter(v => v.storeName.toLowerCase().includes(search.toLowerCase()))
      : enriched;

    res.json({ vendors: filtered, total: filtered.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor || vendor.status !== 'approved')
      return res.status(404).json({ message: 'Vendor not found' });
    const owner = await User.findById(vendor.userId);
    res.json({ ...vendor, ownerName: owner?.name || '' });
  } catch {
    res.status(404).json({ message: 'Vendor not found' });
  }
};

exports.getVendorProducts = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor || vendor.status !== 'approved')
      return res.status(404).json({ message: 'Vendor not found' });
    const { page = 1, limit = 12, sort = 'newest' } = req.query;
    const { products, total } = await Product.list({ vendorId: vendor._id, isActive: true, page, limit, sort });
    res.json({ products, total, pages: Math.ceil(total / Number(limit)) });
  } catch {
    res.status(404).json({ message: 'Vendor not found' });
  }
};

// ─── Vendor (authenticated) ───────────────────────────────────────────────────

exports.applyVendor = async (req, res) => {
  const existing = await Vendor.findByUserId(req.user._id);
  if (existing) {
    const msgs = {
      pending: 'Your application is already under review.',
      approved: 'You already have an approved vendor account.',
      suspended: 'Your vendor account is suspended. Contact support.',
    };
    return res.status(400).json({ message: msgs[existing.status] });
  }

  const { storeName, description, logo, bankDetails } = req.body;
  if (!storeName) return res.status(400).json({ message: 'Store name is required' });

  const vendor = await Vendor.create({
    userId: req.user._id,
    storeName,
    description: description || '',
    logo: logo || '',
    bankDetails: bankDetails || {},
    status: 'pending',
    commissionRate: 10,
  });
  res.status(201).json(vendor);
};

exports.getMyProfile = async (req, res) => {
  const owner = await User.findById(req.vendor.userId);
  res.json({ ...req.vendor, ownerName: owner?.name || '', ownerEmail: owner?.email || '' });
};

exports.updateMyProfile = async (req, res) => {
  const { storeName, description, logo, bankDetails } = req.body;
  const patch = {};
  if (storeName) patch.storeName = storeName;
  if (description !== undefined) patch.description = description;
  if (logo !== undefined) patch.logo = logo;
  if (bankDetails !== undefined) patch.bankDetails = bankDetails;
  const updated = await Vendor.updateById(req.vendor._id, patch);
  res.json(updated);
};

exports.getMyProducts = async (req, res) => {
  const { page = 1, limit = 12, sort = 'newest' } = req.query;
  const { products, total } = await Product.list({
    vendorId: req.vendor._id,
    isActive: undefined,
    page,
    limit,
    sort,
  });
  res.json({ products, total, pages: Math.ceil(total / Number(limit)) });
};

exports.getMyOrders = async (req, res) => {
  const sb = getClient();
  const { data, error } = await sb
    .from('orders')
    .select('*')
    .contains('items', [{ vendorId: req.vendor._id }])
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ message: error.message });

  const orders = (data || []).map((row) => ({
    _id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    isPaid: row.is_paid,
    createdAt: row.created_at,
    items: (row.items || []).filter((i) => i.vendorId === req.vendor._id),
    totalPrice: row.total_price,
  }));
  res.json(orders);
};

exports.getMyStats = async (req, res) => {
  const sb = getClient();
  const { data: productRows } = await sb
    .from('products')
    .select('id,is_active', { count: 'exact' })
    .eq('vendor_id', req.vendor._id);

  const activeProducts = (productRows || []).filter((p) => p.is_active).length;
  const totalProducts = (productRows || []).length;

  const { data: orderRows } = await sb
    .from('orders')
    .select('items,status,is_paid')
    .contains('items', [{ vendorId: req.vendor._id }]);

  let pendingOrders = 0;
  let totalItemsSold = 0;
  (orderRows || []).forEach((row) => {
    const vendorItems = (row.items || []).filter((i) => i.vendorId === req.vendor._id);
    if (['pending', 'confirmed', 'processing'].includes(row.status)) pendingOrders++;
    if (row.is_paid) totalItemsSold += vendorItems.reduce((s, i) => s + Number(i.quantity || 0), 0);
  });

  res.json({
    totalEarnings: req.vendor.totalEarnings,
    totalSales: req.vendor.totalSales,
    activeProducts,
    totalProducts,
    pendingOrders,
    totalItemsSold,
    commissionRate: req.vendor.commissionRate,
  });
};

// ─── Admin ────────────────────────────────────────────────────────────────────

exports.listVendors = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const { vendors, total } = await Vendor.list({ status, page, limit });

  // hydrate owner info
  const enriched = await Promise.all(
    vendors.map(async (v) => {
      const owner = await User.findById(v.userId);
      return { ...v, ownerName: owner?.name || '', ownerEmail: owner?.email || '' };
    })
  );
  res.json({ vendors: enriched, total });
};

exports.updateVendorStatus = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
  const { status, commissionRate } = req.body;
  const patch = {};
  if (status) patch.status = status;
  if (commissionRate !== undefined) patch.commissionRate = Number(commissionRate);
  const updated = await Vendor.updateById(req.params.id, patch);
  res.json(updated);
};
