# System Architecture — URL Shortener

## High-Level Architecture

```
                          ┌─────────────────────────────────────────┐
                          │              CLIENT LAYER                │
                          │   Browser / Mobile App / Postman / cURL  │
                          └──────────────────┬──────────────────────┘
                                             │  HTTP/HTTPS
                                             ▼
                          ┌─────────────────────────────────────────┐
                          │           REVERSE PROXY (optional)       │
                          │         Nginx / Cloudflare CDN           │
                          │   TLS Termination · Static File Serving  │
                          └──────────────────┬──────────────────────┘
                                             │
                                             ▼
          ┌──────────────────────────────────────────────────────────────┐
          │                     EXPRESS.JS APPLICATION                    │
          │                                                              │
          │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
          │  │   Helmet    │  │    CORS       │  │  Morgan Logger    │   │
          │  │  (Security) │  │  (Origins)   │  │  (Request Logs)   │   │
          │  └─────────────┘  └──────────────┘  └───────────────────┘   │
          │                                                              │
          │  ┌─────────────────────────────────────────────────────┐    │
          │  │               MIDDLEWARE CHAIN                       │    │
          │  │  Rate Limiter → Sanitizer → Body Parser → Router    │    │
          │  └─────────────────────────────────────────────────────┘    │
          │                                                              │
          │  ┌─────────────────┐         ┌──────────────────────────┐  │
          │  │   /api ROUTES   │         │    /:shortCode ROUTE      │  │
          │  │                 │         │                          │  │
          │  │ POST /shorten   │         │  GET /:shortCode         │  │
          │  │ GET /analytics  │         │  → 302 redirect          │  │
          │  │ DELETE /url     │         │  (fire-and-forget        │  │
          │  │ GET /urls       │         │   analytics update)      │  │
          │  └────────┬────────┘         └──────────────┬───────────┘  │
          │           │                                 │               │
          │           └──────────────┬──────────────────┘               │
          │                          ▼                                  │
          │           ┌──────────────────────────┐                      │
          │           │   URL CONTROLLER          │                      │
          │           │   Business Logic Layer    │                      │
          │           └──────────────┬───────────┘                      │
          │                          │                                  │
          │           ┌──────────────┴───────────┐                      │
          │           │      MONGOOSE ODM          │                      │
          │           │   Schema Validation        │                      │
          │           │   Instance Methods         │                      │
          │           │   Static Methods           │                      │
          │           └──────────────┬───────────┘                      │
          └──────────────────────────┼──────────────────────────────────┘
                                     │
                                     ▼
          ┌──────────────────────────────────────────────────────────────┐
          │                       MONGODB                                │
          │                                                              │
          │   Collection: urls                                           │
          │   ┌────────────────────────────────────────────────────┐    │
          │   │  { shortCode, originalUrl, shortUrl, clickCount,   │    │
          │   │    isCustom, lastAccessed, expiresAt, createdAt }   │    │
          │   └────────────────────────────────────────────────────┘    │
          │                                                              │
          │   Indexes:                                                   │
          │   ├── shortCode (unique)  ← Primary redirect lookup          │
          │   ├── originalUrl         ← Duplicate detection              │
          │   ├── {createdBy, createdAt} (compound) ← Dashboard queries  │
          │   └── expiresAt (TTL, sparse) ← Auto-delete expired links    │
          └──────────────────────────────────────────────────────────────┘
```

---

## Request Flow: POST /api/shorten

```
Client
  │
  ├─ POST /api/shorten { url: "https://long-url.com" }
  │
  ▼
Rate Limiter (10 req / 15min)
  │
  ▼
Input Sanitizer (strip $operators)
  │
  ▼
urlController.createShortUrl()
  │
  ├─ validateUrl(url)           → 400 if invalid
  │
  ├─ Url.findByOriginalUrl()    → return existing if duplicate
  │
  ├─ generateUniqueCode(Url)    → nanoid 6-char slug
  │
  ├─ Url.create(...)            → MongoDB write
  │     └── E11000?             → 409 collision (retry)
  │
  └─ 201 { shortUrl, shortCode, ... }
```

---

## Request Flow: GET /:shortCode (Redirect)

```
Client
  │
  ├─ GET /x7k2m
  │
  ▼
urlController.redirectToUrl()
  │
  ├─ Url.findOne({ shortCode })   ← O(log n) B-tree index scan
  │     └── not found?            → 404
  │     └── expired?              → 410, delete record
  │
  ├─ urlRecord.recordClick()      ← async, non-blocking
  │     └── clickCount++
  │     └── lastAccessed = now
  │
  └─ res.redirect(302, originalUrl)
```

---

## Scalability Path

### Single Server (current)
```
Client → Express → MongoDB
```

### With Caching (next step)
```
Client → Express → Redis Cache → MongoDB
                       ↑
              Cache hot redirects (TTL: 24h)
              ~80% of traffic hits < 5% of URLs (Zipf distribution)
```

### Horizontally Scaled
```
Client → Load Balancer (Nginx/ALB)
             │
      ┌──────┴──────┐
      │             │
  Express 1     Express 2      (stateless — sessions in Redis if needed)
      │             │
      └──────┬──────┘
             │
        Redis Cluster          (redirect cache + rate limit state)
             │
      MongoDB Replica Set      (primary write + 2 secondaries for reads)
             │
      MongoDB Sharded          (shard key: shortCode for write distribution)
```

---

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Short code generation | nanoid | Cryptographic randomness, 56B key space at 6 chars |
| Redirect status | 302 | Ensures every click hits server → accurate analytics |
| Duplicate handling | Return existing | Better UX, avoids orphaned records |
| Analytics update | Fire-and-forget | Non-blocking — redirect latency unaffected by DB write |
| Error handling | Centralized middleware | Consistent response shape, no stack trace leaks |
| Rate limiting | Per-IP sliding window | Balances fairness and abuse prevention |
| Payload limit | 10kb | Prevents large-body DoS |
