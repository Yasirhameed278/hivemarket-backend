const { getClient } = require('../config/db');
const User = require('../models/User');

// Verify a Supabase access token and load the matching profile row.
async function verifyToken(token) {
  const sb = getClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  const profile = await User.findById(data.user.id);
  return profile;
}

exports.protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  const user = await verifyToken(token);
  if (!user) return res.status(401).json({ message: 'Token invalid or expired' });
  if (!user.isActive) return res.status(401).json({ message: 'Account deactivated' });
  req.user = user;
  next();
};

exports.admin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

exports.optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    const user = await verifyToken(token);
    if (user) req.user = user;
  }
  next();
};
