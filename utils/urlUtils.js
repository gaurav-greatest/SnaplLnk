const { customAlphabet } = require('nanoid');
const validUrl = require('valid-url');

/**
 * URL Generation Algorithm (SDE Interview Highlight)
 *
 * Uses nanoid with a custom alphabet to generate short codes.
 *
 * Key Space Analysis:
 *   Alphabet size: 62 chars (a-z, A-Z, 0-9)
 *   Code length: 6
 *   Key space: 62^6 = 56,800,235,584 (~56 billion) unique codes
 *
 * Collision Probability (Birthday Paradox):
 *   After 1 million URLs: P(collision) ≈ 1 - e^(-n²/2K) ≈ 0.0088%
 *   After 10 million URLs: P(collision) ≈ 0.88%
 *   MongoDB unique index acts as the final collision guard.
 *
 * Why NOT MD5/SHA hash?
 *   - Hash outputs are long (32+ chars); we truncate, increasing collisions
 *   - nanoid is purpose-built for unique short IDs with cryptographic randomness
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;

// Generate a 6-char random code from the 62-char alphabet
const generateCode = customAlphabet(ALPHABET, CODE_LENGTH);

/**
 * Generates a short code with retry logic for collision handling.
 * The unique MongoDB index is the definitive guard; this is a best-effort pre-check.
 *
 * @param {Model} UrlModel - The Mongoose Url model
 * @param {number} maxRetries - Maximum retry attempts (default: 5)
 * @returns {string} A unique short code
 */
const generateUniqueCode = async (UrlModel, maxRetries = 5) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const code = generateCode();
    const existing = await UrlModel.findOne({ shortCode: code }).lean();

    if (!existing) return code;

    console.warn(`⚠️  Short code collision detected: ${code} (attempt ${attempt}/${maxRetries})`);
  }

  // Extremely unlikely to reach here with a 56B key space,
  // but we throw to surface any systemic issues.
  throw new Error('Failed to generate a unique short code after maximum retries.');
};

/**
 * Validates a URL string.
 * Accepts http and https protocols only.
 *
 * @param {string} url
 * @returns {{ valid: boolean, message?: string }}
 */
const validateUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, message: 'URL must be a non-empty string.' };
  }

  const trimmed = url.trim();

  if (trimmed.length > 2048) {
    return { valid: false, message: 'URL exceeds maximum length of 2048 characters.' };
  }

  if (!validUrl.isWebUri(trimmed)) {
    return { valid: false, message: 'Invalid URL. Must start with http:// or https://' };
  }

  // Block private/internal IP ranges (security measure)
  const blockedPatterns = [
    /localhost/i,
    /127\.0\.0\.1/,
    /0\.0\.0\.0/,
    /192\.168\./,
    /10\.\d+\.\d+\.\d+/,
    /172\.(1[6-9]|2\d|3[01])\./,
  ];

  if (blockedPatterns.some((pattern) => pattern.test(trimmed))) {
    return { valid: false, message: 'Shortening internal/private URLs is not allowed.' };
  }

  return { valid: true };
};

/**
 * Sanitizes a custom alias provided by the user.
 * Strips characters outside [a-zA-Z0-9_-].
 *
 * @param {string} alias
 * @returns {string}
 */
const sanitizeAlias = (alias) => {
  return String(alias)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 20);
};

module.exports = {
  generateCode,
  generateUniqueCode,
  validateUrl,
  sanitizeAlias,
};
