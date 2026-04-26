// Vercel serverless entry point.
// Vercel auto-detects files under /api and turns them into functions.
// We export the Express app, which Vercel runs as a single catch-all function.
require('dotenv').config();
module.exports = require('../app');
