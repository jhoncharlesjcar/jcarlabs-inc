import fs from 'node:fs/promises';
import path from 'node:path';

async function scan(dir) {
  let leakCount = 0;
  let fileCount = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await scan(full);
      leakCount += sub.leakCount;
      fileCount += sub.fileCount;
    } else if (entry.name.endsWith('.html')) {
      fileCount++;
      const content = await fs.readFile(full, 'utf8');
      const leaks = [];
      if (/vertical logo/i.test(content)) leaks.push('Vertical Logo');
      if (/adam knoxville/i.test(content)) leaks.push('Adam Knoxville');
      if (/i break things/i.test(content)) leaks.push('I break things');
      if (/adam-knoxville-17\.png/i.test(content)) leaks.push('adam-knoxville-17.png');
      if (leaks.length) {
        console.error(`LEAK in ${full}:`, leaks);
        leakCount += leaks.length;
      }
    }
  }
  return { leakCount, fileCount };
}

const { leakCount, fileCount } = await scan('dist');
console.log(`Scanned ${fileCount} HTML files in dist/.`);
if (leakCount === 0) {
  console.log('✅ ZERO brand leaks found in dist/! All pages 100% clean.');
  process.exit(0);
} else {
  console.error(`❌ Found ${leakCount} leaks in dist/.`);
  process.exit(1);
}
