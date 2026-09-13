import { site, sharedCopy, extraCopy } from '../content/corporate.mjs';

const normalized = (value) => String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();

const LEAK_PAIRS = [
  ['© 2026 VERTICAL BY ADAM KNOXVILLE. ALL WORK, ALL RIGHTS.', '© 2026 JCAR LABS INC. TODOS LOS DERECHOS RESERVADOS.'],
  ['ADAM KNOXVILLE / VERTICAL', 'JCAR Labs Inc.'],
  ['hey@adamknoxville.design', 'contacto@jcarlabs.com'],
  ['HEY@ADAMKNOXVILLE.DESIGN', 'CONTACTO@JCARLABS.COM'],
  ['(44) 7700 900 482', '+51 904 615 337'],
  ['Fragile Perfection', 'Sistema Hotelero'],
  ['Silent Gravity', 'Nezus Bisutería'],
  ['Adam Knoxville', 'JCAR Labs Inc.'],
  ['VERTICAL BY', 'JCAR LABS INC. —'],
  ['alt="Vertical Logo"', 'alt="JCAR Labs Inc. Logo"'],
  ['alt="vertical logo"', 'alt="JCAR Labs Inc. Logo"'],
  ['Vertical Logo', 'JCAR Labs Inc. Logo'],
  ['assets/images/adam-knoxville-17.png', 'assets/images/vertical-logo.svg'],
  ['adam-knoxville-17.png', 'vertical-logo.svg'],
  ['adam-knoxville.jpg', 'hero-image-6.jpg'],
  ['I break things', 'Creamos soluciones'],
  ['I BREAK THINGS', 'CREAMOS SOLUCIONES'],
  ['to see WHAT', 'digitales que'],
  ['TO SEE WHAT', 'DIGITALES QUE'],
  ['THEY ARE MADE OF', 'HACEN CRECER NEGOCIOS'],
  ['they are made of', 'hacen crecer negocios'],
  ['VISUAL ARTIST/CREATOR', 'DESARROLLO WEB · SOFTWARE · IA'],
  ['INDEPENDENT VISUAL ARTIST', 'CEO de Jcar Labs Inc.'],
  ['Independent Visual Artist', 'CEO de Jcar Labs Inc.'],
  ['alt="Signature"', 'alt="Jhon Charles — CEO de Jcar Labs Inc."'],
  ['IDX/AK', 'JCAR/LABS'],
  ['PHASE/BREAK', 'FASE/IDEA'],
  ['PHASE/BUILD', 'FASE/DISEÑO'],
  ['PHASE/BEND', 'FASE/DESARROLLO'],
  ['PHASE/RELEASE', 'FASE/ESCALA'],
];

function dictionary() {
  const map = new Map();
  for (const [from, to] of Object.entries(sharedCopy)) map.set(normalized(from), to);
  for (const [from, to] of Object.entries(extraCopy)) map.set(normalized(from), to);
  return map;
}

function applyLeaks(text) {
  let result = text;
  if (site.origin) result = result.replaceAll('https://vertical.framer.media', site.origin);
  for (const [from, to] of LEAK_PAIRS) result = result.replaceAll(from, to);
  return result;
}

function applyExactDictionary(text, dict) {
  const key = normalized(text);
  if (!dict.has(key)) return text;
  const leading = text.match(/^\s*/)[0];
  const trailing = text.match(/\s*$/)[0];
  return leading + dict.get(key) + trailing;
}

function walkJson(value, dict) {
  if (typeof value === 'string') return applyExactDictionary(applyLeaks(value), dict);
  if (Array.isArray(value)) return value.map((item) => walkJson(item, dict));
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = walkJson(value[key], dict);
  }
  return value;
}

export function applyCorporateHtml(html) {
  let result = applyLeaks(html);
  result = result.replace(/<html\b([^>]*\blang=")en(")/i, '<html$1es$2');
  result = result.replace(/<meta\b[^>]*name="generator"[^>]*>/i, '<meta name="generator" content="JCAR Labs Inc.">');

  // Replace letter-split author name in hero
  result = result.replace(
    /(<div [^>]*data-framer-name="Name"[^>]*><h1\b[^>]*>)([\s\S]*?)(<\/h1><\/div>)/,
    (_, open, _inner, close) => `${open}<span style="white-space:nowrap">JCAR</span> <span style="white-space:nowrap">Labs</span>${close}`
  );
  // Replace letter-split author title in hero
  result = result.replace(
    /(<div [^>]*data-framer-name="Title"[^>]*><h2\b[^>]*>)([\s\S]*?)(<\/h2><\/div>)/,
    (_, open, _inner, close) => `${open}<span style="white-space:nowrap">DESARROLLO WEB · SOFTWARE · IA</span>${close}`
  );

  // Replace Section 11 Author Name in SVG
  result = result.replace(
    /(data-framer-name="Author Name"[^>]*>[\s\S]*?<p\b[^>]*>)([\s\S]*?)(<\/p>)/,
    (_, open, _match, close) => `${open}JCAR LABS INC${close}`
  );
  // Replace Section 11 Subtitle below signature
  result = result.replace(
    /(<div class="framer-i5ly5t" data-framer-name="Subtitle"[^>]*><p\b[^>]*>)([\s\S]*?)(<\/p><\/div>)/,
    (_, open, _inner, close) => `${open}<span style="white-space:nowrap">CEO de Jcar Labs Inc.</span>${close}`
  );

  const dict = dictionary();
  result = result.replace(/<(p|h1|h2|h3|h4|h5|h6|span|a|li|button|label|time|cite)(\b[^>]*)>([^<]*)<\/\1>/gi, (match, tag, attrs, text) => {
    const next = applyExactDictionary(text, dict);
    return next === text ? match : `<${tag}${attrs}>${next}</${tag}>`;
  });

  result = result.replace(/data-framer-hydrate-v2="([^"]*)"/g, (_match, encoded) => {
    try {
      const json = JSON.parse(encoded.replaceAll('&quot;', '"'));
      return `data-framer-hydrate-v2="${JSON.stringify(walkJson(json, dict)).replaceAll('"', '&quot;')}"`;
    } catch {
      return `data-framer-hydrate-v2="${applyLeaks(encoded)}"`;
    }
  });

  return result;
}

export const BRAND_LEAK_PATTERNS = [
  /Adam Knoxville/i,
  /VERTICAL BY/i,
  /vertical\.framer\.media/i,
  /hey@adamknoxville/i,
  /\(44\) 7700 900 482/,
  /Fragile Perfection/,
  /Silent Gravity/,
  /Vertical Logo/i,
  /I break things/i,
  /adam-knoxville/i,
];
