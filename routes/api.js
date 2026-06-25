const express = require('express');
const router = express.Router();
const {
  createShortUrl,
  getAnalytics,
  deleteUrl,
  getAllUrls,
} = require('../controllers/urlController');

/**
 * API Routes — /api
 *
 * POST   /api/shorten              → Create a short URL
 * GET    /api/analytics/:shortCode → Get analytics for a short URL
 * DELETE /api/url/:shortCode       → Delete a short URL
 * GET    /api/urls                 → List all URLs (paginated)
 * GET    /api/health               → Health check
 */

// Health check endpoint (useful for deployment monitors and load balancers)
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'URL Shortener API is running.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

router.post('/shorten', createShortUrl);
router.get('/analytics/:shortCode', getAnalytics);
router.delete('/url/:shortCode', deleteUrl);
router.get('/urls', getAllUrls);

module.exports = router;
