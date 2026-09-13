import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pagesDir = path.join(root, 'src', 'content', 'pages');

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

const files = await getHtmlFiles(pagesDir);
console.log(`Found ${files.length} HTML files to inspect.`);

let updatedCount = 0;

for (const file of files) {
  let content = await fs.readFile(file, 'utf8');
  const original = content;

  // 1. Sanitize Logo Alt Text
  content = content.replaceAll('alt="Vertical Logo"', 'alt="JCAR Labs Inc. Logo"');
  content = content.replaceAll('alt="vertical logo"', 'alt="JCAR Labs Inc. Logo"');

  // 2. Sanitize Texture / Template image references
  content = content.replaceAll('assets/images/adam-knoxville-17.png', 'assets/images/vertical-logo.svg');
  content = content.replaceAll('assets/images/adam-knoxville.jpg', 'assets/images/hero-image-6.jpg');

  // 3. Sanitize JSON-LD schema
  content = content.replaceAll(
    '"creator":{"@type":"Person","name":"Adam Knoxville"}',
    '"creator":{"@type":"Organization","name":"JCAR Labs Inc."}'
  );
  content = content.replaceAll(
    '"author":{"@type":"Person","name":"Adam Knoxville"}',
    '"author":{"@type":"Organization","name":"JCAR Labs Inc."}'
  );

  // 4. Sanitize Footers & Common Branding
  content = content.replaceAll('© 2026 Vertical by Adam Knoxville. All work, all rights.', '© 2026 JCAR Labs Inc. Todos los derechos reservados.');
  content = content.replaceAll('© 2026 VERTICAL BY ADAM KNOXVILLE. ALL WORK, ALL RIGHTS.', '© 2026 JCAR LABS INC. TODOS LOS DERECHOS RESERVADOS.');
  content = content.replaceAll('by Adam Knoxville', 'by JCAR Labs Inc.');
  content = content.replaceAll('Photo of Adam Knoxville in hat', 'Photo of JCAR Labs Inc.');
  content = content.replaceAll('hey@adamknoxville.design', 'contacto@jcarlabs.com');
  content = content.replaceAll('HEY@ADAMKNOXVILLE.DESIGN', 'CONTACTO@JCARLABS.COM');

  // 5. In index.html specific sections
  if (file.endsWith(path.join('pages', 'index.html'))) {
    // Hero letter-split
    content = content.replace(
      /(<div [^>]*data-framer-name="Name"[^>]*><h1\b[^>]*>)([\s\S]*?)(<\/h1><\/div>)/,
      (_, open, _inner, close) => `${open}<span style="white-space:nowrap">JCAR</span> <span style="white-space:nowrap">Labs</span>${close}`
    );
    content = content.replace(
      /(<div [^>]*data-framer-name="Title"[^>]*><h2\b[^>]*>)([\s\S]*?)(<\/h2><\/div>)/,
      (_, open, _inner, close) => `${open}<span style="white-space:nowrap">DESARROLLO WEB · SOFTWARE · IA</span>${close}`
    );
    content = content.replaceAll('>I break things<', '>CREAMOS SOLUCIONES<');
    content = content.replaceAll('>to see WHAT<', '>DIGITALES QUE<');
    content = content.replaceAll('>THEY ARE MADE OF<', '>HACEN CRECER NEGOCIOS<');
    content = content.replaceAll('IDX/AK', 'JCAR/LABS');

    // Section 11 - About: Author Name (Image 2)
    // Replace green Adam Knoxville in Author Name SVG
    content = content.replace(
      /(data-framer-name="Author Name"[^>]*>[\s\S]*?<p\b[^>]*>)([\s\S]*?)(<\/p>)/,
      (_, open, _match, close) => `${open}JCAR LABS INC${close}`
    );

    // Section 11 - About: Signature Alt text (Image 3)
    content = content.replaceAll('alt="Signature"', 'alt="Jhon Charles — CEO de Jcar Labs Inc."');

    // Section 11 - About: Subtitle under signature: "Independent Visual Artist" letter-split -> "CEO de Jcar Labs Inc." (Image 3)
    content = content.replace(
      /(<div class="framer-i5ly5t" data-framer-name="Subtitle"[^>]*><p\b[^>]*>)([\s\S]*?)(<\/p><\/div>)/,
      (_, open, _inner, close) => `${open}<span style="white-space:nowrap">CEO de Jcar Labs Inc.</span>${close}`
    );

    // Split Adam / KNOXVILLE spans
    content = content.replace(
      /<span [^>]*>Adam<\/span>\s*<span [^>]*>KNOXVILLE<\/span>/gi,
      '<span style="white-space:nowrap">JCAR</span> <span style="white-space:nowrap">LABS</span>'
    );
  }

  // 6. In contact/index.html specific sections
  if (file.endsWith(path.join('pages', 'contact', 'index.html'))) {
    content = content.replace(/Adam Knoxville <span [^>]*>\/ Vertical<\/span>/, 'JCAR Labs Inc.');
    content = content.replaceAll('>Independent Visual Artist<', '>Equipo de Desarrollo y Tecnología<');
  }

  // 7. General replacements
  content = content.replaceAll('alt="Adam Knoxville"', 'alt="JCAR Labs Inc."');
  content = content.replaceAll('alt="adam knoxville"', 'alt="JCAR Labs Inc."');
  content = content.replaceAll('>Adam Knoxville<', '>JCAR Labs Inc.<');
  content = content.replaceAll('>Adam KNOXVILLE<', '>JCAR LABS INC<');
  content = content.replaceAll('Adam Knoxville', 'JCAR Labs Inc.');
  content = content.replaceAll('Adam KNOXVILLE', 'JCAR LABS INC');

  if (content !== original) {
    await fs.writeFile(file, content, 'utf8');
    const rel = path.relative(root, file);
    console.log(`Updated: ${rel}`);
    updatedCount++;
  }
}

console.log(`Sanitization complete: ${updatedCount} of ${files.length} files updated.`);
