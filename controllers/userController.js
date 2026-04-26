const User = require('../models/User');
const Order = require('../models/Order');

exports.getAllUsers = async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const { users, total } = await User.find({ search, page, limit });
  res.json({ users, total });
};

exports.getUserById = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const orders = await Order.findByUser(req.params.id, { limit: 10, page: 1 });
  res.json({ user, orders });
};

exports.updateUser = async (req, res) => {
  const { name, email, role, isActive } = req.body;
  const existing = await User.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'User not found' });
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (email !== undefined) patch.email = email;
  if (role !== undefined) patch.role = role;
  if (isActive !== undefined) patch.isActive = isActive;
  const user = await User.updateById(req.params.id, patch);
  res.json(user);
};

exports.deleteUser = async (req, res) => {
  const existing = await User.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'User not found' });
  await User.updateById(req.params.id, { isActive: false });
  res.json({ message: 'User deactivated' });
};

exports.getUserStats = async (req, res) => {
  const startOfMonth = new Date(new Date().setDate(1)).toISOString();
  const [totalUsers, activeUsers, newThisMonth, adminCount] = await Promise.all([
    User.count(),
    User.count({ isActive: true }),
    User.count({ createdAfter: startOfMonth }),
    User.count({ role: 'admin' }),
  ]);
  res.json({ totalUsers, activeUsers, newThisMonth, adminCount });
};
