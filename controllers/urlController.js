const Url = require('../models/Url');
const { generateUniqueCode, validateUrl, sanitizeAlias } = require('../utils/urlUtils');

/**
 * Controller: URL Operations
 *
 * Follows the Single Responsibility Principle — each method handles one action.
 * All DB interactions are async/await with proper error propagation.
 */

// ─── POST /api/shorten ────────────────────────────────────────────────────────

/**
 * Shortens a URL.
 *
 * Flow:
 *  1. Validate input URL
 *  2. Check for existing record (duplicate detection)
 *  3. If custom alias provided — validate and check availability
 *  4. Generate unique short code (nanoid)
 *  5. Persist to MongoDB
 *  6. Return short URL in response
 */
const createShortUrl = async (req, res, next) => {
  try {
    const { url, customAlias } = req.body;

    // Step 1: Validate URL
    const { valid, message } = validateUrl(url);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: message,
      });
    }

    const originalUrl = url.trim();

    // Step 2: Duplicate detection — return existing short URL if found
    const existing = await Url.findByOriginalUrl(originalUrl);
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Short URL already exists for this URL.',
        data: {
          shortUrl: existing.shortUrl,
          shortCode: existing.shortCode,
          originalUrl: existing.originalUrl,
          clickCount: existing.clickCount,
          createdAt: existing.createdAt,
        },
      });
    }

    // Step 3: Determine short code (custom alias or auto-generated)
    let shortCode;
    let isCustom = false;

    if (customAlias) {
      const cleanAlias = sanitizeAlias(customAlias);

      if (cleanAlias.length < 4) {
        return res.status(400).json({
          success: false,
          error: 'Custom alias must be at least 4 characters after sanitization.',
        });
      }

      // Check if alias is already taken
      const aliasTaken = await Url.findOne({ shortCode: cleanAlias }).lean();
      if (aliasTaken) {
        return res.status(409).json({
          success: false,
          error: `The alias "${cleanAlias}" is already in use. Please choose another.`,
        });
      }

      shortCode = cleanAlias;
      isCustom = true;
    } else {
      // Step 4: Auto-generate unique code
      shortCode = await generateUniqueCode(Url);
    }

    // Build the full short URL
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const shortUrl = `${baseUrl}/${shortCode}`;

    // Step 5: Persist to MongoDB
    const urlRecord = await Url.create({
      originalUrl,
      shortCode,
      shortUrl,
      isCustom,
    });

    // Step 6: Respond
    return res.status(201).json({
      success: true,
      message: 'Short URL created successfully.',
      data: {
        shortUrl: urlRecord.shortUrl,
        shortCode: urlRecord.shortCode,
        originalUrl: urlRecord.originalUrl,
        isCustom: urlRecord.isCustom,
        createdAt: urlRecord.createdAt,
      },
    });

  } catch (error) {
    // Handle MongoDB duplicate key error (race condition edge case)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Short code collision — please retry.',
      });
    }
    next(error);
  }
};

// ─── GET /:shortCode ──────────────────────────────────────────────────────────

/**
 * Redirects to the original URL.
 *
 * Performance note: shortCode has a unique index, so this is a single
 * B-tree lookup — O(log n), typically <10ms even at scale.
 *
 * We fire-and-forget the analytics update so it doesn't block the redirect.
 */
const redirectToUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;

    const urlRecord = await Url.findOne({ shortCode });

    if (!urlRecord) {
      return res.status(404).json({
        success: false,
        error: `No URL found for short code: ${shortCode}`,
      });
    }

    // Check expiry
    if (urlRecord.expiresAt && new Date() > urlRecord.expiresAt) {
      await Url.deleteOne({ shortCode });
      return res.status(410).json({
        success: false,
        error: 'This short URL has expired.',
      });
    }

    // Fire-and-forget analytics update (non-blocking)
    urlRecord.recordClick().catch((err) =>
      console.error('Analytics update failed:', err.message)
    );

    // 301 = permanent (cached by browsers — good for SEO, bad for analytics accuracy)
    // 302 = temporary (not cached — accurate click counts, recommended for shorteners)
    return res.redirect(302, urlRecord.originalUrl);

  } catch (error) {
    next(error);
  }
};

// ─── GET /api/analytics/:shortCode ───────────────────────────────────────────

/**
 * Returns analytics data for a short URL.
 */
const getAnalytics = async (req, res, next) => {
  try {
    const { shortCode } = req.params;

    const urlRecord = await Url.findOne({ shortCode });

    if (!urlRecord) {
      return res.status(404).json({
        success: false,
        error: `No URL found for short code: ${shortCode}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: urlRecord.toAnalytics(),
    });

  } catch (error) {
    next(error);
  }
};

// ─── DELETE /api/url/:shortCode ───────────────────────────────────────────────

/**
 * Deletes a URL record by short code.
 */
const deleteUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;

    const deleted = await Url.findOneAndDelete({ shortCode });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `No URL found for short code: ${shortCode}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Short URL "${shortCode}" deleted successfully.`,
    });

  } catch (error) {
    next(error);
  }
};

// ─── GET /api/urls ────────────────────────────────────────────────────────────

/**
 * Lists all URLs with pagination.
 * Uses the compound index { createdBy, createdAt } for efficient sorting.
 */
const getAllUrls = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [urls, total] = await Promise.all([
      Url.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Url.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        urls,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createShortUrl,
  redirectToUrl,
  getAnalytics,
  deleteUrl,
  getAllUrls,
};
