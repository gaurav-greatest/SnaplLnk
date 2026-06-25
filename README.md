# SnapLink | Modern URL Shortener

A premium, production-ready URL shortening service built with **Node.js**, **Express.js**, and **MongoDB**. Converts long URLs into compact, shareable links with click analytics, custom aliases, and a sleek glassmorphic UI.

[![Deploy to Render](https://render.com/images/deploy-to-render.svg)](https://render.com/deploy?repo=https://github.com/gaurav-greatest/SnaplLnk)

---

## Features

- Shorten any valid HTTP/HTTPS URL
- Custom aliases (e.g., `/my-brand`)
- Duplicate detection — same URL always returns the same short link
- Click analytics (total clicks, last accessed, creation date)
- MongoDB indexing for sub-10ms redirect latency
- Rate limiting, input sanitization, CORS, and helmet security headers
- Graceful server shutdown with connection cleanup
- Paginated URL listing

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Runtime    | Node.js 18+                         |
| Framework  | Express.js 4                        |
| Database   | MongoDB + Mongoose ODM              |
| ID Gen     | nanoid (cryptographic randomness)   |
| Security   | Helmet, express-rate-limit, mongo-sanitize |
| Logging    | Morgan                              |
| Config     | dotenv                              |

---

## Project Structure

```
url-shortener/
├── controllers/
│   └── urlController.js     # Business logic for all endpoints
├── models/
│   └── Url.js               # Mongoose schema + indexes + instance methods
├── routes/
│   ├── api.js               # /api/* routes
│   └── redirect.js          # /:shortCode redirect route
├── middleware/
│   ├── errorHandler.js      # Global error handler + 404 handler
│   ├── rateLimiter.js       # express-rate-limit configs
│   └── sanitize.js          # NoSQL injection prevention + input trimming
├── config/
│   └── database.js          # MongoDB connection with pool config
├── utils/
│   └── urlUtils.js          # nanoid generation, URL validation, alias sanitization
├── app.js                   # Express app setup (middleware + routes)
├── server.js                # Entry point, graceful shutdown
├── .env.example             # Environment variable template
└── package.json
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Clone and install

```bash
git clone https://github.com/your-username/url-shortener.git
cd url-shortener
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your MongoDB URI and BASE_URL
```

### 3. Run

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

Server starts at `http://localhost:5000`.

---

## API Reference

### POST `/api/shorten`
Create a short URL.

**Request body:**
```json
{
  "url": "https://www.example.com/very/long/path?with=params",
  "customAlias": "my-link"   // optional
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Short URL created successfully.",
  "data": {
    "shortUrl": "http://localhost:5000/my-link",
    "shortCode": "my-link",
    "originalUrl": "https://www.example.com/very/long/path?with=params",
    "isCustom": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### GET `/:shortCode`
Redirects to the original URL (302).

```
GET /my-link
→ 302 Location: https://www.example.com/very/long/path?with=params
```

---

### GET `/api/analytics/:shortCode`
Get click analytics for a short URL.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "shortCode": "my-link",
    "shortUrl": "http://localhost:5000/my-link",
    "originalUrl": "https://www.example.com/...",
    "clickCount": 142,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T08:15:00.000Z",
    "lastAccessed": "2024-01-20T08:15:00.000Z",
    "isCustom": true,
    "expiresAt": null
  }
}
```

---

### DELETE `/api/url/:shortCode`
Delete a URL record.

**Response (200):**
```json
{
  "success": true,
  "message": "Short URL \"my-link\" deleted successfully."
}
```

---

### GET `/api/urls?page=1&limit=10`
List all URLs with pagination.

---

### GET `/api/health`
Health check endpoint.

```json
{
  "success": true,
  "message": "URL Shortener API is running.",
  "timestamp": "2024-01-20T10:00:00.000Z",
  "environment": "production"
}
```

---

## Error Responses

All errors follow a consistent shape:

```json
{
  "success": false,
  "error": "Descriptive error message here."
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (invalid URL, alias too short) |
| 404 | Short code not found |
| 409 | Alias already taken / duplicate key |
| 410 | Short URL has expired |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Database Schema

```js
{
  originalUrl:  String,   // The full original URL (indexed)
  shortCode:    String,   // Unique 6-char code (unique index — primary lookup)
  shortUrl:     String,   // Full short URL (e.g., https://rl.io/x7k2m)
  isCustom:     Boolean,  // Was this a user-defined alias?
  clickCount:   Number,   // Total redirect count (default: 0)
  lastAccessed: Date,     // Timestamp of most recent redirect
  expiresAt:    Date,     // Optional: TTL expiry (null = permanent)
  createdBy:    String,   // User identifier (default: 'anonymous')
  createdAt:    Date,     // Auto-managed by Mongoose timestamps
  updatedAt:    Date,     // Auto-managed by Mongoose timestamps
}
```

### Indexes

| Field | Type | Purpose |
|-------|------|---------|
| `shortCode` | Unique | Primary redirect lookup (O(log n), ~8ms) |
| `originalUrl` | Regular | Duplicate detection without collection scan |
| `createdBy + createdAt` | Compound | Dashboard history queries |
| `expiresAt` | TTL (sparse) | Auto-delete expired documents |

---

## Deployment

### Render

1. Push to GitHub
2. Create new Web Service on [render.com](https://render.com)
3. Set Build Command: `npm install`
4. Set Start Command: `node server.js`
5. Add environment variables (MONGO_URI, BASE_URL, NODE_ENV=production)

### Railway

1. Connect GitHub repo on [railway.app](https://railway.app)
2. Add MongoDB plugin or connect Atlas
3. Set environment variables in Railway dashboard
4. Railway auto-detects Node.js and deploys

### VPS (Ubuntu + PM2)

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Clone and setup
git clone https://github.com/your-username/url-shortener.git
cd url-shortener
npm install --production
cp .env.example .env
nano .env   # Fill in production values

# Start with PM2
pm2 start server.js --name url-shortener
pm2 startup   # Auto-restart on reboot
pm2 save

# Optional: Nginx reverse proxy
# Proxy localhost:5000 → port 80/443
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| All routes | 100 requests / 15 min / IP |
| `POST /api/shorten` | 10 requests / 15 min / IP |

---

## Security Measures

- **Helmet** — Sets 11 security-related HTTP headers
- **CORS** — Whitelist-based origin control
- **express-mongo-sanitize** — Strips MongoDB operator keys ($gt, $where) from inputs
- **Rate limiting** — Prevents abuse and DoS on write endpoints
- **URL validation** — Blocks private IP ranges and non-HTTP(S) schemes
- **10kb payload limit** — Prevents large-body DoS attacks
- **Graceful error handling** — No stack traces leaked to clients in production

---

## Interview Questions & Answers

**Q: Why use nanoid instead of hashing the URL?**
A: MD5/SHA hashes are deterministic — the same input always produces the same output, so two users shortening the same URL get different codes if we truncate, causing collisions. nanoid generates cryptographically random codes with a 56B key space at 6 characters, giving essentially zero collision probability in practice. The MongoDB unique index acts as the definitive collision guard.

**Q: Why 302 instead of 301 for redirects?**
A: 301 (Permanent) is cached aggressively by browsers, meaning clicks after the first bypass our server entirely — analytics break. 302 (Found/Temporary) instructs browsers not to cache, ensuring every redirect hits our server and increments the click counter.

**Q: How does the unique index prevent collisions at scale?**
A: MongoDB enforces uniqueness at the storage engine level. Even in a multi-instance deployment with concurrent writes, the index acts as a distributed lock — if two processes try to insert the same shortCode simultaneously, one gets an E11000 duplicate key error, which we catch and retry with a new code.

**Q: How would you scale this to 100M URLs?**
A: (1) Shard MongoDB on shortCode for horizontal write scaling. (2) Add a Redis cache in front of MongoDB for hot redirects — most traffic hits a small subset of URLs. (3) Deploy behind a CDN (Cloudflare) to serve cached redirects at the edge. (4) Use read replicas for analytics queries to offload the primary.

**Q: What's the time complexity of a redirect lookup?**
A: O(log n) via the B-tree index on shortCode, where n is the number of documents. In practice, MongoDB keeps hot index pages in memory (WiredTiger cache), making this effectively O(1) for popular codes.

**Q: How would you add authentication?**
A: Add a User model, JWT middleware (jsonwebtoken + cookie-parser), and associate URLs with userId. The compound index { userId, createdAt } already anticipates this — it makes per-user dashboard queries efficient without a full collection scan.
