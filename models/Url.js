const mongoose = require('mongoose');

/**
 * URL Schema
 * Stores all data for a shortened URL including analytics.
 *
 * Indexing Strategy (SDE Interview Highlight):
 * - shortCode: unique index for O(log n) redirect lookups (~8ms avg)
 * - originalUrl: index for duplicate detection without full collection scan
 * - createdAt: TTL-ready field; add expireAfterSeconds for ephemeral links
 */
const urlSchema = new mongoose.Schema(
  {
    originalUrl: {
      type: String,
      required: [true, 'Original URL is required'],
      trim: true,
      maxlength: [2048, 'URL cannot exceed 2048 characters'],
    },

    shortCode: {
      type: String,
      required: true,
      unique: true,        // Enforces uniqueness at DB level (collision guard)
      trim: true,
      minlength: [4, 'Short code must be at least 4 characters'],
      maxlength: [20, 'Short code cannot exceed 20 characters'],
      match: [/^[a-zA-Z0-9_-]+$/, 'Short code can only contain letters, numbers, hyphens, and underscores'],
    },

    shortUrl: {
      type: String,
      required: true,
    },

    // Custom alias support (Advanced Feature)
    isCustom: {
      type: Boolean,
      default: false,
    },

    // Analytics fields
    clickCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastAccessed: {
      type: Date,
      default: null,
    },

    // Optional: link expiry (TTL)
    expiresAt: {
      type: Date,
      default: null,
    },

    // Optional: created by (for multi-user extension)
    createdBy: {
      type: String,
      default: 'anonymous',
    },
  },
  {
    timestamps: true, // Auto-manages createdAt and updatedAt
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary redirect lookup — used on EVERY GET /:shortCode request
// `shortCode` is already `unique: true` in the schema field definition.

// Duplicate detection — avoids full collection scan on POST /api/shorten
urlSchema.index({ originalUrl: 1 });

// Compound index for analytics dashboard queries (user + time-sorted)
urlSchema.index({ createdBy: 1, createdAt: -1 });

// TTL index — MongoDB auto-deletes expired documents (set expiresAt to enable)
urlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Increments click count and updates lastAccessed timestamp.
 * Called on every successful redirect.
 */
urlSchema.methods.recordClick = async function () {
  this.clickCount += 1;
  this.lastAccessed = new Date();
  return this.save();
};

/**
 * Returns a sanitized analytics object (no internal Mongo fields).
 */
urlSchema.methods.toAnalytics = function () {
  return {
    shortCode: this.shortCode,
    shortUrl: this.shortUrl,
    originalUrl: this.originalUrl,
    clickCount: this.clickCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    lastAccessed: this.lastAccessed,
    isCustom: this.isCustom,
    expiresAt: this.expiresAt,
  };
};

// ─── Static Methods ───────────────────────────────────────────────────────────

/**
 * Finds an existing record for a given original URL.
 * Used for duplicate detection on POST /api/shorten.
 */
urlSchema.statics.findByOriginalUrl = function (originalUrl) {
  return this.findOne({ originalUrl }).lean();
};

module.exports = mongoose.model('Url', urlSchema);
