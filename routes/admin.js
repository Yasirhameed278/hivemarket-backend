const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const { getClient } = require('../config/db');

// Admin dashboard overview
router.get('/stats', protect, admin, async (req, res) => {
  const [totalProducts, totalUsers, totalOrders, totalRevenue, monthlyData] = await Promise.all([
    Product.count({ isActive: true }),
    User.count({ role: 'user' }),
    Order.count(),
    Order.totalRevenue(),
    Order.monthlyRevenue({ months: 6, paidOnly: false }),
  ]);

  // Low stock + top selling.
  const sb = getClient();
  const [{ data: lowStockRows = [] }, { data: topRows = [] }, { data: catRows = [] }] = await Promise.all([
    sb
      .from('products')
      .select('id,name,stock,thumbnail,price')
      .eq('is_active', true)
      .lte('stock', 5)
      .limit(10),
    sb
      .from('products')
      .select('id,name,sold_count,price,thumbnail')
      .eq('is_active', true)
      .order('sold_count', { ascending: false })
      .limit(5),
    sb.from('products').select('category,price,sold_count').eq('is_active', true),
  ]);

  const lowStockProducts = lowStockRows.map((r) => ({
    _id: r.id,
    name: r.name,
    stock: r.stock,
    thumbnail: r.thumbnail,
    price: Number(r.price),
  }));
  const topProducts = topRows.map((r) => ({
    _id: r.id,
    name: r.name,
    soldCount: r.sold_count,
    price: Number(r.price),
    thumbnail: r.thumbnail,
  }));

  const catMap = new Map();
  catRows.forEach((r) => {
    const cur = catMap.get(r.category) || { _id: r.category, count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(r.price || 0) * Number(r.sold_count || 0);
    catMap.set(r.category, cur);
  });
  const categoryStats = Array.from(catMap.values()).sort((a, b) => b.count - a.count);

  res.json({
    totalProducts,
    totalUsers,
    totalOrders,
    totalRevenue,
    lowStockProducts,
    topProducts,
    monthlyData,
    categoryStats,
  });
});

module.exports = router;
