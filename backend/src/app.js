const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const placesRouter = require('./routes/places');
const locationRouter = require('./routes/location');
const searchRouter = require('./routes/search');
const authRouter = require('./routes/auth');
const aiRouter = require('./routes/ai');

const app = express();

// Security headers
app.use(helmet());

// CORS — supports localhost, Vercel deployments, and custom domains
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((u) => u.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Logging
app.use(morgan('dev'));

// Body parser (with payload size limits to prevent memory exhaustion attacks)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Routes
app.use('/api/places', placesRouter);
app.use('/api/location', locationRouter);
app.use('/api/search', searchRouter);
app.use('/api/auth', authRouter);
app.use('/api/ai', aiRouter);

// Root & Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', name: 'CraveCompass API', version: '1.0.0' });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
