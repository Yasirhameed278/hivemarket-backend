// routes/auth.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', protect, ctrl.getMe);
router.put('/profile', protect, ctrl.updateProfile);
router.put('/password', protect, ctrl.updatePassword);
router.post('/address', protect, ctrl.addAddress);
router.delete('/address/:id', protect, ctrl.deleteAddress);

module.exports = router;
