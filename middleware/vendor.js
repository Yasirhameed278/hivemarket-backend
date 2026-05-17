const Vendor = require('../models/Vendor');

// Requires an approved vendor account. Run after `protect`.
exports.protectVendor = async (req, res, next) => {
  const vendor = await Vendor.findByUserId(req.user._id);
  if (!vendor) return res.status(403).json({ message: 'Vendor account required. Apply at /become-vendor.' });
  if (vendor.status === 'pending')
    return res.status(403).json({ message: 'Your vendor application is pending admin approval.' });
  if (vendor.status === 'suspended')
    return res.status(403).json({ message: 'Your vendor account has been suspended.' });
  req.vendor = vendor;
  next();
};

// Passes if user is admin OR an approved vendor. Run after `protect`.
exports.vendorOrAdmin = async (req, res, next) => {
  if (req.user.role === 'admin') return next();
  const vendor = await Vendor.findByUserId(req.user._id);
  if (!vendor || vendor.status !== 'approved')
    return res.status(403).json({ message: 'Admin or approved vendor access required.' });
  req.vendor = vendor;
  next();
};
