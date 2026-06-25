/**
 * Error Handling Middleware
 *
 * Express error handlers must have exactly 4 parameters: (err, req, res, next).
 * They are registered AFTER all routes in app.js.
 *
 * SDE Highlight:
 * Centralized error handling prevents leaking stack traces to clients in production,
 * ensures consistent error response shapes, and simplifies debugging.
 */

// ─── 404 Handler (no route matched) ──────────────────────────────────────────

const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// ─── Global Error Handler ─────────────────────────────────────────────────────

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const isDev = process.env.NODE_ENV === 'development';

  // Determine status code — default to 500 if not set
  const statusCode = err.statusCode || err.status || 500;

  // Log error details server-side (never send stack to client in production)
  if (statusCode >= 500) {
    console.error('🔥  Server Error:', {
      message: err.message,
      stack: isDev ? err.stack : '[hidden in production]',
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation failed.',
      details: messages,
    });
  }

  // Mongoose CastError (e.g., invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: `Invalid value for field: ${err.path}`,
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `Duplicate value for ${field}. Please use a unique value.`,
    });
  }

  // Generic error response
  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected error occurred.',
    ...(isDev && { stack: err.stack }), // Only expose stack in development
  });
};

module.exports = { notFoundHandler, errorHandler };
