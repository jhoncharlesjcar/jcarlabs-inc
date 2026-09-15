import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import handler, { resetRateLimitStore } from './framercms.js';
import { createSiteServer } from '../src/server/http.mjs';
import { fileURLToPath } from 'node:url';

test('Vercel function and local transport return identical CMS byte ranges', async () => {
  resetRateLimitStore();
  const servers = [http.createServer(handler), createSiteServer({ rootDirectory: fileURLToPath(new URL('../public', import.meta.url)) })];
  try {
    for (const server of servers) {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${server.address().port}/api/framercms`;
      for (const collection of ['Ejo4jvBE8', 'PuvR7bUan']) {
        const file = `${collection}-indexes-default-0.framercms`;
        const source = await readFile(new URL(`../public/assets/cms/${file}`, import.meta.url));
        for (const range of ['0-144', '145-288,429-896']) {
          const url = `${base}?file=${file}&range=${range}`;
          const response = await fetch(url);
          const expected = Buffer.concat(range.split(',').map(part => { const [a, b] = part.split('-').map(Number); return source.subarray(a, b + 1); }));
          assert.equal(response.status, 200);
          assert.equal(response.headers.get('content-type'), 'application/octet-stream');
          assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
          const head = await fetch(url, { method: 'HEAD' });
          assert.equal(Number(head.headers.get('content-length')), expected.length);
          assert.equal((await head.arrayBuffer()).byteLength, 0);
        }
        assert.equal((await fetch(`${base}?file=${file}&range=999999-9999999`)).status, 416);
      }
      assert.equal((await fetch(`${base}?file=..%2Fsecret.framercms`)).status, 400);
    }
  } finally {
    for (const server of servers) await new Promise(resolve => server.close(resolve));
  }
});
