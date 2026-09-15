import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { installCmsFetch, withCmsFetch } from './cms-fetch.mjs';
import { corporateDocument } from './corporate-document.mjs';

const file = 'Ejo4jvBE8-indexes-default-0.framercms';
const remote = `https://framerusercontent.com/cms/export/version/${file}?range=145-288,429-896`;
function browser(origin) {
  const calls = [];
  const window = { location: new URL(`${origin}/services/desarrollo-web`), fetch: (...args) => { calls.push(args); return Promise.resolve('ok'); } };
  vm.runInNewContext(`(${installCmsFetch.toString()})()`, { window, URL, Request, Set });
  return { window, calls };
}

for (const origin of ['https://jcarlabs-inc.vercel.app', 'https://jcarlabs.com', 'http://localhost:4321', 'http://127.0.0.2:4322']) {
  test(`CMS uses same-origin function and preserves multi-ranges on ${origin}`, async () => {
    const { window, calls } = browser(origin);
    await window.fetch(remote);
    const actual = new URL(calls[0][0]);
    assert.equal(actual.origin, origin);
    assert.equal(actual.pathname, '/api/framercms');
    assert.equal(actual.searchParams.get('file'), file);
    assert.equal(actual.searchParams.get('range'), '145-288,429-896');
  });
}

test('Request inputs retain method, headers, signal and init overrides', async () => {
  const { window, calls } = browser('https://jcarlabs.com');
  const controller = new AbortController();
  const request = new Request(remote, { method: 'HEAD', headers: { 'X-Test': 'cms' }, signal: controller.signal });
  const init = { cache: 'no-store' };
  await window.fetch(request, init);
  assert.ok(calls[0][0] instanceof Request);
  assert.equal(calls[0][0].method, 'HEAD');
  assert.equal(calls[0][0].headers.get('X-Test'), 'cms');
  assert.equal(calls[0][1], init);
  controller.abort();
  assert.equal(calls[0][0].signal.aborted, true);
});

test('local binary URLs are redirected; unrelated requests remain untouched', async () => {
  const { window, calls } = browser('https://jcarlabs.com');
  await window.fetch(new URL(`https://jcarlabs.com/assets/cms/${file}?range=0-144`));
  assert.equal(new URL(calls[0][0]).pathname, '/api/framercms');
  for (const input of ['/contact', 'https://example.com/' + file, 'https://framerusercontent.com/cms/unknown.framercms']) {
    const init = { method: 'GET' };
    await window.fetch(input, init);
    assert.equal(calls.at(-1)[0], input);
    assert.equal(calls.at(-1)[1], init);
  }
});

test('every exported page installs the transport before the Framer bundle', () => {
  const routes = JSON.parse(readFileSync(new URL('../content/routes.json', import.meta.url), 'utf8'));
  for (const { route, file } of routes) {
    const source = readFileSync(new URL(`../content/pages/${file}`, import.meta.url), 'utf8');
    const html = corporateDocument(source, route);
    assert.equal((html.match(/data-jcar-cms-fetch/g) || []).length, 1, route);
    assert.doesNotMatch(html, /data-local-cms-fetch/, route);
    assert.ok(html.indexOf('data-jcar-cms-fetch') < html.indexOf('data-framer-bundle="main"'), route);
    assert.equal(withCmsFetch(html), html, route);
  }
});
