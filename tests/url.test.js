/**
 * URL Shortener — Test Suite
 *
 * Run: npm test
 *
 * Tests cover:
 *  - URL validation utility
 *  - POST /api/shorten (create, duplicate, invalid)
 *  - GET /:shortCode (redirect, 404)
 *  - GET /api/analytics/:shortCode
 *  - DELETE /api/url/:shortCode
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Url = require('../models/Url');
const { validateUrl, sanitizeAlias } = require('../utils/urlUtils');

// ─── Utility Tests ────────────────────────────────────────────────────────────

describe('validateUrl()', () => {
  test('accepts valid http URL', () => {
    expect(validateUrl('http://example.com').valid).toBe(true);
  });

  test('accepts valid https URL', () => {
    expect(validateUrl('https://example.com/path?q=1').valid).toBe(true);
  });

  test('rejects empty string', () => {
    expect(validateUrl('').valid).toBe(false);
  });

  test('rejects non-URL string', () => {
    expect(validateUrl('not-a-url').valid).toBe(false);
  });

  test('rejects localhost', () => {
    expect(validateUrl('http://localhost:3000').valid).toBe(false);
  });

  test('rejects private IP range', () => {
    expect(validateUrl('http://192.168.1.1').valid).toBe(false);
  });

  test('rejects URL exceeding 2048 chars', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2048);
    expect(validateUrl(longUrl).valid).toBe(false);
  });
});

describe('sanitizeAlias()', () => {
  test('strips special characters', () => {
    expect(sanitizeAlias('my alias!')).toBe('myalias');
  });

  test('allows hyphens and underscores', () => {
    expect(sanitizeAlias('my-alias_v2')).toBe('my-alias_v2');
  });

  test('trims whitespace', () => {
    expect(sanitizeAlias('  hello  ')).toBe('hello');
  });

  test('truncates to 20 chars', () => {
    expect(sanitizeAlias('a'.repeat(30)).length).toBe(20);
  });
});

// ─── API Tests ────────────────────────────────────────────────────────────────

// Connect to a test database before running
beforeAll(async () => {
  const testUri = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/url-shortener-test';
  await mongoose.connect(testUri);
});

// Clean up test data after each test
afterEach(async () => {
  await Url.deleteMany({});
});

// Close connection after all tests
afterAll(async () => {
  await mongoose.connection.close();
});

// ─── POST /api/shorten ────────────────────────────────────────────────────────

describe('POST /api/shorten', () => {
  test('creates a short URL and returns 201', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://www.example.com' });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('shortCode');
    expect(res.body.data).toHaveProperty('shortUrl');
    expect(res.body.data.originalUrl).toBe('https://www.example.com');
  });

  test('returns existing short URL for duplicate URL (200)', async () => {
    const url = 'https://www.duplicate-test.com';

    const first = await request(app).post('/api/shorten').send({ url });
    const second = await request(app).post('/api/shorten').send({ url });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.body.data.shortCode).toBe(first.body.data.shortCode);
  });

  test('creates short URL with custom alias', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://www.example.com', customAlias: 'test-alias' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.shortCode).toBe('test-alias');
    expect(res.body.data.isCustom).toBe(true);
  });

  test('returns 409 when custom alias is taken', async () => {
    await request(app)
      .post('/api/shorten')
      .send({ url: 'https://www.first.com', customAlias: 'taken' });

    const res = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://www.second.com', customAlias: 'taken' });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 for invalid URL', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ url: 'not-a-url' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 for missing URL field', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({});

    expect(res.statusCode).toBe(400);
  });
});

// ─── GET /:shortCode ──────────────────────────────────────────────────────────

describe('GET /:shortCode', () => {
  test('redirects to original URL (302)', async () => {
    const create = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://www.redirect-target.com' });

    const { shortCode } = create.body.data;

    const res = await request(app)
      .get(`/${shortCode}`)
      .redirects(0); // Don't follow redirect — check the 302

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://www.redirect-target.com');
  });

  test('returns 404 for unknown short code', async () => {
    const res = await request(app).get('/doesnotexist123');
    expect(res.statusCode).toBe(404);
  });

  test('increments click count on redirect', async () => {
    const create = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://www.click-counter.com' });

    const { shortCode } = create.body.data;

    // Perform two redirects
    await request(app).get(`/${shortCode}`).redirects(0);
    await request(app).get(`/${shortCode}`).redirects(0);

    // Small delay for async recordClick()
    await new Promise((r) => setTimeout(r, 100));

    const analytics = await request(app).get(`/api/analytics/${shortCode}`);
    expect(analytics.body.data.clickCount).toBe(2);
  });
});

// ─── GET /api/analytics/:shortCode ───────────────────────────────────────────

describe('GET /api/analytics/:shortCode', () => {
  test('returns analytics object', async () => {
    const create = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://www.analytics-test.com' });

    const { shortCode } = create.body.data;

    const res = await request(app).get(`/api/analytics/${shortCode}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('clickCount');
    expect(res.body.data).toHaveProperty('createdAt');
    expect(res.body.data).toHaveProperty('lastAccessed');
  });

  test('returns 404 for unknown short code', async () => {
    const res = await request(app).get('/api/analytics/unknowncode');
    expect(res.statusCode).toBe(404);
  });
});

// ─── DELETE /api/url/:shortCode ───────────────────────────────────────────────

describe('DELETE /api/url/:shortCode', () => {
  test('deletes a URL and returns 200', async () => {
    const create = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://www.to-be-deleted.com' });

    const { shortCode } = create.body.data;

    const del = await request(app).delete(`/api/url/${shortCode}`);
    expect(del.statusCode).toBe(200);
    expect(del.body.success).toBe(true);

    // Confirm it's gone
    const check = await request(app).get(`/api/analytics/${shortCode}`);
    expect(check.statusCode).toBe(404);
  });

  test('returns 404 when deleting non-existent code', async () => {
    const res = await request(app).delete('/api/url/nonexistent');
    expect(res.statusCode).toBe(404);
  });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  test('returns 200 with running status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
