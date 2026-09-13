import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFramerRanges } from '../src/lib/framer-ranges.mjs';

// Vercel includes dist/assets/cms/** at bundle time (see vercel.json → functions.includeFiles).
// __dirname points to /var/task/api/ in the Vercel Lambda environment.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cmsDir = path.resolve(__dirname, '..', 'dist', 'assets', 'cms');

const SECURITY_HEADERS = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
};

export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
export const RATE_LIMIT_MAX_REQUESTS = 60;

// In-memory sliding-window request tracker per IP
const ipRequestTimestamps = new Map();

/**
 * Check rate limit for a client IP using sliding-window algorithm.
 * @param {string} ip
 * @param {number} [now]
 * @param {number} [maxRequests]
 * @param {number} [windowMs]
 * @returns {{ allowed: boolean, limit: number, remaining: number, reset: number }}
 */
export function checkRateLimit(ip, now = Date.now(), maxRequests = RATE_LIMIT_MAX_REQUESTS, windowMs = RATE_LIMIT_WINDOW_MS) {
  const windowStart = now - windowMs;
  let timestamps = ipRequestTimestamps.get(ip);
  if (!timestamps) {
    timestamps = [];
    ipRequestTimestamps.set(ip, timestamps);
  }

  const validTimestamps = timestamps.filter(t => t > windowStart);
  ipRequestTimestamps.set(ip, validTimestamps);

  // Occasional pruning of stale IPs to prevent unbounded memory growth
  if (ipRequestTimestamps.size > 5000) {
    for (const [key, list] of ipRequestTimestamps.entries()) {
      if (list.length === 0 || list[list.length - 1] <= windowStart) {
        ipRequestTimestamps.delete(key);
      }
    }
  }

  if (validTimestamps.length >= maxRequests) {
    const oldest = validTimestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      reset: resetSeconds,
    };
  }

  validTimestamps.push(now);
  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - validTimestamps.length,
    reset: Math.ceil(windowMs / 1000),
  };
}

export function resetRateLimitStore() {
  ipRequestTimestamps.clear();
}

/**
 * Vercel serverless function — Framer CMS binary range protocol handler.
 *
 * Framer's runtime requests .framercms files with a custom ?range= query param
 * (e.g. ?range=0-1023,2048-4095) instead of the standard HTTP Range header.
 * This protocol cannot be served by a plain static CDN.
 *
 * Routing: vercel.json rewrites /assets/cms/:file → /api/framercms?file=:file
 * Vercel appends the original query string, so ?range= is automatically forwarded.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse}  res
 */
export default async function handler(req, res) {
  // ── Rate Limiting (60 req / 60 sec per IP) ────────────────────────────────
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    res.writeHead(429, {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/plain; charset=UTF-8',
      'Retry-After': String(rateLimit.reset),
      'RateLimit-Limit': String(rateLimit.limit),
      'RateLimit-Remaining': '0',
      'RateLimit-Reset': String(rateLimit.reset),
    });
    res.end('429 Too Many Requests');
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const file = url.searchParams.get('file');
  const range = url.searchParams.get('range');

  // ── Validate filename ─────────────────────────────────────────────────────
  if (
    !file ||
    !file.endsWith('.framercms') ||
    file.includes('..') ||
    file.includes('/') ||
    file.includes('\\')
  ) {
    res.writeHead(400, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('400 Bad Request');
    return;
  }

  const filePath = path.join(cmsDir, file);

  // Secondary path-traversal guard after join
  if (!filePath.startsWith(cmsDir + path.sep) && filePath !== cmsDir) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('403 Forbidden');
    return;
  }

  try {
    const source = await readFile(filePath);

    // ── No range param → return the full file ────────────────────────────────
    if (!range) {
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Content-Length': String(source.length),
      });
      res.end(req.method === 'HEAD' ? undefined : source);
      return;
    }

    // ── Parse the Framer multi-range format ──────────────────────────────────
    const ranges = parseFramerRanges(range, source.length);
    if (!ranges) {
      res.writeHead(416, {
        ...SECURITY_HEADERS,
        'Content-Range': `bytes */${source.length}`,
      });
      res.end();
      return;
    }

    // Concatenate all requested byte slices in order into a single buffer
    const body = Buffer.concat(
      ranges.map(({ start, end }) => source.subarray(start, end + 1))
    );

    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': String(body.length),
    });
    res.end(req.method === 'HEAD' ? undefined : body);

  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Not Found');
    } else {
      console.error('[framercms]', err);
      res.writeHead(500, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('500 Internal Server Error');
    }
  }
}
