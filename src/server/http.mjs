import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { parseFramerRanges } from '../lib/framer-ranges.mjs';
import { withUrlShim } from '../lib/url-shim.js';
import { legacyRedirectTarget } from '../lib/legacy-redirects.mjs';

// [2.2] HSTS solo en producción (bajo HTTPS). Activar con NODE_ENV=production o HTTPS=1.
const isProduction = process.env.NODE_ENV === 'production' || process.env.HTTPS === '1';

const MIME_TYPES = {
  default: 'application/octet-stream',
  html: 'text/html; charset=UTF-8',
  js: 'application/javascript',
  mjs: 'application/javascript',
  css: 'text/css',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  json: 'application/json',
  xml: 'application/xml; charset=UTF-8',
  txt: 'text/plain; charset=UTF-8',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  otf: 'font/otf',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

const SECURITY_HEADERS = {
  // [2.1, 2.3] frame-ancestors 'self' previene clickjacking; form-action limitado a 'self'.
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.framer.com https://framer.com https://*.framerusercontent.com https://*.framerstatic.com https://app.framerstatic.com; style-src 'self' 'unsafe-inline' https://*.framerstatic.com https://app.framerstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data: https: https://*.framerstatic.com https://app.framerstatic.com; connect-src 'self' https://api.framer.com https://*.framerusercontent.com https://*.framer.com https://events.framer.com https://*.framerstatic.com https://app.framerstatic.com; worker-src 'self' blob: https://*.framerstatic.com https://*.framer.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'",
  // [2.1] Compatibilidad con navegadores que no soportan frame-ancestors en CSP.
  'X-Frame-Options': 'SAMEORIGIN',
  // [2.2] HSTS activo solo cuando el servidor corre bajo HTTPS.
  ...(isProduction ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

const COMPRESSIBLE_EXTENSIONS = new Set(['html', 'css', 'js', 'mjs', 'json', 'svg', 'txt', 'xml']);
const RANGE_EXTENSIONS = new Set(['mp4', 'webm']);

function cacheControlFor(filePath, ext) {
  const normalized = filePath.replaceAll('\\', '/');
  if (normalized.endsWith('/brand-content.js') || normalized.endsWith('/accessibility.js')) {
    return 'no-cache, no-store, must-revalidate';
  }
  if (normalized.includes('/assets/js/') || normalized.includes('/assets/fonts/')) {
    return 'public, max-age=31536000, immutable';
  }
  if (normalized.includes('/assets/images/') || normalized.includes('/assets/videos/')) {
    return 'public, max-age=2592000';
  }
  if (ext === 'html') return 'no-cache';
  return 'public, max-age=3600';
}

function baseHeaders(filePath, ext, stat) {
  return {
    ...SECURITY_HEADERS,
    'Cache-Control': cacheControlFor(filePath, ext),
    'Content-Type': MIME_TYPES[ext] || MIME_TYPES.default,
    'ETag': `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`,
    'Last-Modified': stat.mtime.toUTCString(),
  };
}

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '');
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!match[1] && match[2]) start = Math.max(size - Number(match[2]), 0);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

async function sendBuffer(req, res, status, headers, buffer, allowCompression = true) {
  let body = buffer;
  const accepted = req.headers['accept-encoding'] || '';
  if (allowCompression && accepted.includes('br')) {
    body = await new Promise((resolve, reject) => zlib.brotliCompress(buffer, (error, result) => error ? reject(error) : resolve(result)));
    headers['Content-Encoding'] = 'br';
    headers['Vary'] = 'Accept-Encoding';
  } else if (allowCompression && accepted.includes('gzip')) {
    body = await new Promise((resolve, reject) => zlib.gzip(buffer, (error, result) => error ? reject(error) : resolve(result)));
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

export function createSiteServer({ rootDirectory, logRequests = false }) {
return http.createServer(async (req, res) => {
  if (logRequests) console.log(`${req.method} ${req.url}`);
  
  // Parse URL to strip query strings
  let parsedUrl;
  let pathname;
  try {
    parsedUrl = new URL(req.url, 'http://localhost');
    pathname = decodeURIComponent(parsedUrl.pathname).replace(/\/$/, '') || '/';
  } catch {
    res.writeHead(400, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('400 Bad Request');
    return;
  }

  const legacyTarget = legacyRedirectTarget(pathname);
  if (legacyTarget) {
    res.writeHead(301, { ...SECURITY_HEADERS, 'Cache-Control': 'public, max-age=86400', Location: legacyTarget });
    res.end();
    return;
  }

  // Match the explicit Vercel function URL in dev and local production too.
  if (pathname === '/api/framercms') {
    const file = parsedUrl.searchParams.get('file');
    if (!file || !/^[\w-]+\.framercms$/.test(file)) {
      res.writeHead(400, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('400 Bad Request');
      return;
    }
    pathname = `/assets/cms/${file}`;
  }
  
  // Resolve requests inside the site root and reject traversal attempts.
  const relativeUrl = pathname === '/404' || pathname === '/404/' ? '404.html' : pathname.replace(/^[/\\]+/, '');
  const siteRoot = path.resolve(rootDirectory);
  let filePath = path.resolve(siteRoot, relativeUrl);
  if (filePath !== siteRoot && !filePath.startsWith(siteRoot + path.sep)) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('403 Forbidden');
    return;
  }

  try {
    const stat = await fs.promises.stat(filePath);

    // If it's a directory, try to serve index.html
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      await fs.promises.stat(filePath); // Check if index.html exists
    }

    const fileStat = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).substring(1).toLowerCase();
    const headers = baseHeaders(filePath, ext, fileStat);

    // Framer CMS binaries use a query-string range protocol rather than the
    // standard HTTP Range header. Multiple requested slices are concatenated
    // in order and returned as one uncompressed 200 response.
    if (ext === 'framercms' && parsedUrl.searchParams.has('range')) {
      const ranges = parseFramerRanges(parsedUrl.searchParams.get('range'), fileStat.size);
      if (!ranges) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${fileStat.size}` });
        res.end();
        return;
      }
      const source = await fs.promises.readFile(filePath);
      const body = Buffer.concat(ranges.map(({ start, end }) => source.subarray(start, end + 1)));
      headers['Cache-Control'] = 'no-cache';
      headers['Content-Length'] = body.length;
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }

    if (req.headers['if-none-match'] === headers.ETag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }

    if (RANGE_EXTENSIONS.has(ext)) {
      headers['Accept-Ranges'] = 'bytes';
      const range = parseRange(req.headers.range, fileStat.size);
      if (req.headers.range && !range) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${fileStat.size}` });
        res.end();
        return;
      }
      if (range) {
        const { start, end } = range;
        headers['Content-Range'] = `bytes ${start}-${end}/${fileStat.size}`;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers);
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    if (ext === 'html') {
      let content = await fs.promises.readFile(filePath, 'utf-8');
      content = withUrlShim(content);
      await sendBuffer(req, res, 200, headers, Buffer.from(content), true);
    } else if (COMPRESSIBLE_EXTENSIONS.has(ext)) {
      const content = await fs.promises.readFile(filePath);
      await sendBuffer(req, res, 200, headers, content, true);
    } else {
      headers['Content-Length'] = fileStat.size;
      const stream = fs.createReadStream(filePath);
      res.writeHead(200, headers);
      if (req.method === 'HEAD') return res.end();
      stream.pipe(res);
    }

  } catch (err) {
    if (err.code === 'ENOENT') {
      // If file not found, serve the 404/index.html page if it exists
      try {
        const errorPage = path.join(rootDirectory, '404.html');
        await fs.promises.stat(errorPage);
        const errorStat = await fs.promises.stat(errorPage);
        const headers = { ...baseHeaders(errorPage, 'html', errorStat), 'Cache-Control': 'no-cache' };
        const content = await fs.promises.readFile(errorPage);
        await sendBuffer(req, res, 404, headers, content, true);
      } catch (fallbackErr) {
        res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('404 Not Found');
      }
    } else {
      console.error(err);
      res.writeHead(500, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('500 Internal Server Error');
    }
  }
});

}
