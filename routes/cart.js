const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/cartController');

router.get('/', protect, ctrl.getCart);
router.post('/add', protect, ctrl.addToCart);
router.put('/:itemId', protect, ctrl.updateCartItem);
router.delete('/:itemId', protect, ctrl.removeFromCart);
router.delete('/', protect, ctrl.clearCart);

// Wishlist
router.get('/wishlist', protect, ctrl.getWishlist);
router.post('/wishlist', protect, ctrl.toggleWishlist);

module.exports = router;
