import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCorporateHtml, BRAND_LEAK_PATTERNS } from './corporate-html.mjs';
import { corporateDocument } from './corporate-document.mjs';
import { site } from '../content/corporate.mjs';

const leaky = `<!DOCTYPE html><html lang="en"><head>
<meta name="generator" content="Framer e1541bb">
<title>Vertical</title>
</head><body>
<img src="assets/images/vertical-logo.svg" alt="Vertical Logo">
<div style="background: url('assets/images/adam-knoxville-17.png');"></div>
<div data-framer-name="Name"><h1 class="framer-text"><span>A</span><span>d</span><span>a</span><span>m</span> <span>K</span><span>n</span><span>o</span><span>x</span><span>v</span><span>i</span><span>l</span><span>l</span><span>e</span></h1></div>
<div data-framer-name="Title"><h2 class="framer-text"><span>V</span><span>I</span><span>S</span><span>U</span><span>A</span><span>L</span></h2></div>
<p>I break things</p>
<p>Adam Knoxville</p>
<p>hey@adamknoxville.design</p>
<p>(44) 7700 900 482</p>
<p>© 2026 VERTICAL BY ADAM KNOXVILLE. ALL WORK, ALL RIGHTS.</p>
<p>Fragile Perfection</p>
<p>Silent Gravity</p>
<a href="https://vertical.framer.media/contact">x</a>
<div data-framer-hydrate-v2="{&quot;title&quot;:&quot;Adam Knoxville&quot;,&quot;url&quot;:&quot;https://vertical.framer.media/&quot;}"></div>
</body></html>`;

test('build HTML strips template brand leaks', () => {
  const result = applyCorporateHtml(leaky);
  for (const pattern of BRAND_LEAK_PATTERNS) {
    assert.doesNotMatch(result, pattern, String(pattern));
  }
  assert.match(result, /lang="es"/);
  assert.match(result, /content="JCAR Labs Inc."/);
  assert.match(result, new RegExp(site.origin));
  assert.match(result, /contacto@jcarlabs.com/);
  assert.match(result, /alt="JCAR Labs Inc\. Logo"/);
  assert.match(result, /JCAR<\/span> <span style="white-space:nowrap">Labs/);
});

test('corporateDocument output for home has no Framer origin', () => {
  const result = corporateDocument(leaky, '/');
  assert.doesNotMatch(result, /vertical\.framer\.media/);
  assert.doesNotMatch(result, /Adam Knoxville/i);
  assert.match(result, /data-jcar-url-shim/);
  assert.match(result, /alt="JCAR Labs Inc\. Logo"/);
});

