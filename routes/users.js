const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

router.get('/', protect, admin, ctrl.getAllUsers);
router.get('/stats', protect, admin, ctrl.getUserStats);
router.get('/:id', protect, admin, ctrl.getUserById);
router.put('/:id', protect, admin, ctrl.updateUser);
router.delete('/:id', protect, admin, ctrl.deleteUser);

module.exports = router;
