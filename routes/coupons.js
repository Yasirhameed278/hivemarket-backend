const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const ctrl = require('../controllers/couponController');

router.post('/validate', protect, ctrl.validateCoupon);

router.get('/', protect, admin, ctrl.getCoupons);
router.post('/', protect, admin, ctrl.createCoupon);
router.put('/:id', protect, admin, ctrl.updateCoupon);
router.delete('/:id', protect, admin, ctrl.deleteCoupon);

module.exports = router;
