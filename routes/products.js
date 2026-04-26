const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const ctrl = require('../controllers/productController');

router.get('/', ctrl.getProducts);
router.get('/categories', ctrl.getCategories);
router.get('/slug/:slug', ctrl.getProductBySlug);
router.get('/:id/related', ctrl.getRelatedProducts);
router.get('/:id', ctrl.getProductById);
router.post('/:id/reviews', protect, ctrl.createReview);

// Admin routes
router.post('/', protect, admin, upload.array('images', 5), ctrl.createProduct);
router.put('/:id', protect, admin, upload.array('images', 5), ctrl.updateProduct);
router.delete('/:id', protect, admin, ctrl.deleteProduct);

module.exports = router;
