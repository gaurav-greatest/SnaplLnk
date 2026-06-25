const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const apiRoutes = require('./routes/api');
const redirectRoutes = require('./routes/redirect');
const { generalLimiter, createUrlLimiter } = require('./middleware/rateLimiter');
const { sanitizeInputs, trimBody } = require('./middleware/sanitize');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// ─── Security Headers (Helmet) ────────────────────────────────────────────────
// Sets Content-Security-Policy, X-Frame-Options, X-XSS-Protection, etc.
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow external fonts, CDNs, and QR APIs
  })
);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

// Always allow the configured BASE_URL and localhost:5000
if (process.env.BASE_URL) {
  allowedOrigins.push(process.env.BASE_URL.replace(/\/$/, ''));
}
if (!allowedOrigins.includes('http://localhost:5000')) {
  allowedOrigins.push('http://localhost:5000');
}
if (!allowedOrigins.includes('http://127.0.0.1:5000')) {
  allowedOrigins.push('http://127.0.0.1:5000');
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      
      // Allow exact match in our allowed list
      if (allowedOrigins.includes(origin)) return callback(null, true);
      
      // Allow localtunnel/localhost.run dynamically
      try {
        const originUrl = new URL(origin);
        if (originUrl.hostname.endsWith('.loca.lt') || originUrl.hostname.endsWith('.lhr.life')) {
          return callback(null, true);
        }
      } catch (e) {}

      callback(new Error(`CORS: Origin "${origin}" is not allowed.`));
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ─── Request Logging (Morgan) ─────────────────────────────────────────────────
// 'dev' format in development, 'combined' (Apache format) in production
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));       // Prevent large payload DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Input Sanitization ───────────────────────────────────────────────────────
app.use(sanitizeInputs);
app.use(trimBody);

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
app.use(generalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

// API routes (prefixed with /api)
// Stricter rate limit on the shorten endpoint
app.use('/api/shorten', createUrlLimiter);
app.use('/api', apiRoutes);

// Redirect route (top-level /:shortCode — must come AFTER /api)
app.use('/', redirectRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
