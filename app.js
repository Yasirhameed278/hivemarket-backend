// Pure Express app — no .listen() here so it can be imported by both
// the local dev server (server.js) and the Vercel serverless function (api/index.js).
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Initialise Supabase client at cold-start.
connectDB();

const app = express();

// CORS — allow CLIENT_URL (comma-separated list supported).
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // server-to-server / curl
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Stripe webhooks need the raw body — must come before express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Rate limiting (skip on Vercel where the platform handles this).
if (process.env.VERCEL !== '1') {
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
  app.use('/api/', limiter);
}

// Static uploads only matter when running on a persistent disk.
// On Vercel the filesystem is read-only at runtime, so prefer Cloudinary.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/payment', require('./routes/payment'));

app.get('/api/health', (req, res) =>
  res.json({ status: 'OK', time: new Date(), runtime: process.env.VERCEL ? 'vercel' : 'node' })
);

// Error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
