const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { chat, quickSearch } = require('../controllers/chatbotController');

router.post('/chat', optionalAuth, chat);
router.get('/search', quickSearch);

module.exports = router;
