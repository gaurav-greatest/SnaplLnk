const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting Middleware
 *
 * SDE Highlight:
 * Rate limiting is a critical security and stability measure:
 *  - Prevents abuse of the shortening endpoint (spam, DoS)
 *  - Protects MongoDB write throughput
 *  - Signals good API design to interviewers (production-aware thinking)
 *
 * Strategy:
 *  - Global limiter: 100 requests / 15 min per IP (all routes)
 *  - Strict limiter: 10 requests / 15 min per IP (POST /api/shorten)
 */

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,   // Returns `RateLimit-*` headers (RFC 6585)
  legacyHeaders: false,     // Disables deprecated `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again in 15 minutes.',
  },
  skip: (req) => req.path === '/api/health', // Skip health check
});

// Strict limiter for URL creation (write-heavy, abuse-prone)
const createUrlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many URL creation requests. Limit: 10 per 15 minutes.',
  },
});

module.exports = { generalLimiter, createUrlLimiter };
