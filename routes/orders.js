const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const ctrl = require('../controllers/orderController');

router.post('/', protect, ctrl.createOrder);
router.get('/my', protect, ctrl.getMyOrders);
router.get('/stats', protect, admin, ctrl.getOrderStats);
router.get('/admin/all', protect, admin, ctrl.getAllOrders);
router.get('/:id', protect, ctrl.getOrderById);
router.put('/:id/cancel', protect, ctrl.cancelOrder);
router.put('/:id/status', protect, admin, ctrl.updateOrderStatus);

module.exports = router;
