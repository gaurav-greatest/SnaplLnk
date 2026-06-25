const express = require('express');
const router = express.Router();
const { redirectToUrl } = require('../controllers/urlController');

/**
 * Redirect Route
 * GET /:shortCode → 302 redirect to original URL
 *
 * Kept separate from /api routes so the redirect path is as clean as possible:
 * https://rl.io/x7k2m  →  https://original-long-url.com/...
 */
router.get('/:shortCode', redirectToUrl);

module.exports = router;
