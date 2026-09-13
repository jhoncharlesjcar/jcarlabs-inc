import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = path.join(root, 'public');
const pagesDir = path.join(root, 'src', 'content', 'pages');

// 1. Optimize restored-*.css by removing duplicate remote @font-face rules
const cssFiles = [
  'restored-contact.css',
  'restored-privacy.css',
  'restored-project.css',
  'restored-service-detail.css',
  'restored-services.css',
  'restored-terms.css',
  'restored-work.css',
];

let totalBefore = 0;
let totalAfter = 0;

for (const name of cssFiles) {
  const filePath = path.join(publicDir, name);
  const content = await fs.readFile(filePath, 'utf8');
  totalBefore += content.length;

  // Remove all @font-face blocks (single line and multiline)
  // Handles: @font-face { ... } with comments
  let cleaned = content.replace(/\/\*[\s\S]*?\*\/\s*/g, (comment) => {
    // Keep comments that are not font annotations
    if (/latin|cyrillic|vietnamese|greek/i.test(comment)) return '';
    return comment;
  });

  // Remove @font-face { ... } blocks
  cleaned = cleaned.replace(/@font-face\s*\{[^}]*\}\s*/g, '');

  // Trim extraneous whitespace
  cleaned = cleaned.trim() + '\n';
  totalAfter += cleaned.length;

  await fs.writeFile(filePath, cleaned, 'utf8');
  const reduction = (((content.length - cleaned.length) / content.length) * 100).toFixed(1);
  console.log(`${name}: ${(content.length / 1024).toFixed(1)} KB -> ${(cleaned.length / 1024).toFixed(1)} KB (-${reduction}%)`);
}

console.log(`\nCSS Optimization Summary:`);
console.log(`Total Before: ${(totalBefore / 1024).toFixed(1)} KB`);
console.log(`Total After:  ${(totalAfter / 1024).toFixed(1)} KB`);
console.log(`Saved:        ${((totalBefore - totalAfter) / 1024).toFixed(1)} KB (-${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}%)\n`);

// 2. Remove preconnect to fonts.gstatic.com from all HTML pages
async function getHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

const htmlFiles = await getHtmlFiles(pagesDir);
let htmlUpdated = 0;

for (const file of htmlFiles) {
  let html = await fs.readFile(file, 'utf8');
  const original = html;

  html = html.replace(/\s*<link\s+href="https:\/\/fonts\.gstatic\.com"\s+rel="preconnect"\s+crossorigin(?:="")?>/g, '');
  html = html.replace(/\s*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.gstatic\.com"\s+crossorigin(?:="")?>/g, '');

  if (html !== original) {
    await fs.writeFile(file, html, 'utf8');
    htmlUpdated++;
  }
}

console.log(`Removed preconnect from ${htmlUpdated} of ${htmlFiles.length} HTML files.`);
