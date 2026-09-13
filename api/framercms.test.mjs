import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { checkRateLimit, resetRateLimitStore, RATE_LIMIT_MAX_REQUESTS } from './framercms.js';

test('rate limiting allows up to max requests in window', () => {
  resetRateLimitStore();
  const testIp = '192.168.1.100';
  const now = 1000000;

  for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
    const result = checkRateLimit(testIp, now, RATE_LIMIT_MAX_REQUESTS, 60000);
    assert.equal(result.allowed, true, `Request ${i + 1} should be allowed`);
    assert.equal(result.remaining, RATE_LIMIT_MAX_REQUESTS - (i + 1));
  }

  // 61st request should be rejected
  const blocked = checkRateLimit(testIp, now, RATE_LIMIT_MAX_REQUESTS, 60000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.reset > 0, true);
});

test('rate limit isolates different IP addresses', () => {
  resetRateLimitStore();
  const ip1 = '10.0.0.1';
  const ip2 = '10.0.0.2';
  const now = 1000000;

  for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
    checkRateLimit(ip1, now, RATE_LIMIT_MAX_REQUESTS, 60000);
  }
  assert.equal(checkRateLimit(ip1, now, RATE_LIMIT_MAX_REQUESTS, 60000).allowed, false);
  assert.equal(checkRateLimit(ip2, now, RATE_LIMIT_MAX_REQUESTS, 60000).allowed, true);
});

test('rate limit expires old timestamps after window duration', () => {
  resetRateLimitStore();
  const testIp = '10.0.0.3';
  const t0 = 1000000;

  for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
    checkRateLimit(testIp, t0, RATE_LIMIT_MAX_REQUESTS, 60000);
  }
  assert.equal(checkRateLimit(testIp, t0, RATE_LIMIT_MAX_REQUESTS, 60000).allowed, false);

  // After 61 seconds (61000ms), window has shifted past t0
  const t1 = t0 + 61000;
  const result = checkRateLimit(testIp, t1, RATE_LIMIT_MAX_REQUESTS, 60000);
  assert.equal(result.allowed, true);
});

test('handler returns 429 when rate limit is exceeded', async () => {
  resetRateLimitStore();
  const ip = '172.16.0.5';

  function createMockRes() {
    return {
      statusCode: null,
      headers: {},
      body: null,
      writeHead(code, headers) {
        this.statusCode = code;
        this.headers = headers;
      },
      end(payload) {
        this.body = payload;
      },
    };
  }

  const req = {
    url: '/api/framercms?file=test.framercms',
    headers: { 'x-forwarded-for': ip },
  };

  // Exhaust rate limit
  for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
    const res = createMockRes();
    await handler(req, res);
  }

  // 61st request via handler
  const res = createMockRes();
  await handler(req, res);

  assert.equal(res.statusCode, 429);
  assert.equal(res.body, '429 Too Many Requests');
  assert.equal(res.headers['Retry-After'], '60');
  assert.equal(res.headers['RateLimit-Limit'], '60');
  assert.equal(res.headers['RateLimit-Remaining'], '0');
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
});

test('handler rejects invalid or traversal filenames with 400', async () => {
  resetRateLimitStore();
  const createMockRes = () => ({
    statusCode: null,
    headers: {},
    body: null,
    writeHead(code, headers) { this.statusCode = code; this.headers = headers; },
    end(payload) { this.body = payload; },
  });

  const badFiles = [
    '',
    'notcms.json',
    '../secret.framercms',
    'sub/dir.framercms',
    'sub\\dir.framercms',
  ];

  for (const file of badFiles) {
    const res = createMockRes();
    await handler({ url: `/api/framercms?file=${file}`, headers: {} }, res);
    assert.equal(res.statusCode, 400, `Expected 400 for file ${file}`);
  }
});
