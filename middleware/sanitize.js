/**
 * Input Sanitization Middleware
 *
 * SDE Highlight:
 * Never trust user input. Sanitization runs before controllers see any data.
 * This prevents NoSQL injection attacks (e.g., { $gt: '' } in JSON body)
 * and cleans up common input issues.
 *
 * Approach:
 *  - Strip MongoDB operator keys ($gt, $where, etc.) from req.body and req.params
 *  - Trim string whitespace
 *  - Express-mongo-sanitize handles the heavy lifting
 */

const mongoSanitize = require('express-mongo-sanitize');

/**
 * Removes MongoDB operator keys from request body, params, and query.
 * e.g., { "url": { "$gt": "" } } → {} (injection attempt blocked)
 */
const sanitizeInputs = mongoSanitize({
  replaceWith: '_',   // Replace $ with _ rather than stripping entirely (easier to debug)
  allowDots: false,   // Block dot notation too
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️  Sanitized suspicious key "${key}" in request to ${req.path}`);
  },
});

/**
 * Trims string fields in req.body.
 * Prevents accidental whitespace in URLs and aliases.
 */
const trimBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
};

module.exports = { sanitizeInputs, trimBody };
