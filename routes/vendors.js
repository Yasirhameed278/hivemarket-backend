const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { protectVendor } = require('../middleware/vendor');
const ctrl = require('../controllers/vendorController');

// Public — list all approved stores
router.get('/', ctrl.listPublicVendors);

// Authenticated user — apply
router.post('/apply', protect, ctrl.applyVendor);

// Approved vendor only — must be declared BEFORE /:id to avoid 'me' being matched as an id
router.get('/me/profile', protect, protectVendor, ctrl.getMyProfile);
router.put('/me/profile', protect, protectVendor, ctrl.updateMyProfile);
router.get('/me/products', protect, protectVendor, ctrl.getMyProducts);
router.get('/me/orders', protect, protectVendor, ctrl.getMyOrders);
router.get('/me/stats', protect, protectVendor, ctrl.getMyStats);

// Public — keep these LAST so /me/* routes take priority
router.get('/:id', ctrl.getVendorById);
router.get('/:id/products', ctrl.getVendorProducts);

module.exports = router;
