import ts from 'typescript';
import { site, services, sharedCopy, extraCopy } from '../../src/content/corporate.mjs';
const normalized = (value) => value.replace(/\s+/g, ' ').trim().toUpperCase();

export function createBrandScript(original, sourceBlocks, runtime) {
  const translations = Object.fromEntries(services.map((service) => {
    const sources = sourceBlocks[service.route];
    if (sources.length !== service.article.length) throw new Error(`Editorial block count changed: ${service.route}`);
    return [service.route, sources.map((source, index) => [source, service.article[index]])];
  }));
  const content = { ...sharedCopy,
    ...Object.fromEntries(services.map((service) => [normalized(service.oldTitle), service.label])),
    'JCAR LABS INC. — DESARROLLO WEB, SOFTWARE E INTELIGENCIA ARTIFICIAL': site.title,
  };
  const syntax = ts.createSourceFile('brand-content.js', original, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edits = [];
  function isKeyOrCondition(node) {
    const parent = node.parent;
    if (!parent) return false;
    // Don't replace property keys: { "KEY": "VALUE" }
    if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
    // Don't replace comparisons: foo === "BAR" or foo !== "BAR"
    if (ts.isBinaryExpression(parent)) return true;
    // Don't replace function/method call arguments: foo.includes("BAR"), get("BAR"), querySelector("BAR")
    if (ts.isCallExpression(parent)) return true;
    // Don't replace switch case expressions: case "BAR":
    if (ts.isCaseClause(parent)) return true;
    // Don't replace element access: obj["BAR"]
    if (ts.isElementAccessExpression(parent)) return true;
    return false;
  }
  function visit(node) {
    if (ts.isStringLiteral(node) && !isKeyOrCondition(node) && content[normalized(node.text)]) {
      edits.push([node.getStart(syntax), node.end, JSON.stringify(content[normalized(node.text)])]);
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  let result = original;
  for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) result = result.slice(0, start) + value + result.slice(end);
  const config = JSON.stringify({ services: services.map(({ article, ...service }) => service), extraCopy, translations });
  const setup = `  const corporate = ${config}\n  for (const service of corporate.services) {\n    const originalTitle = normalized(service.sourceTitle)\n    const previousDescription = replacements.get(normalized(service.sourceDescription))\n    replacements.set(originalTitle, service.label)\n    replacements.set(normalized(service.sourceDescription), service.description.toUpperCase())\n    if (previousDescription) replacements.set(normalized(previousDescription), service.description.toUpperCase())\n    Object.assign(detailPages[service.route], { title: service.title, lead: service.description, description: service.description, tags: service.tags })\n  }\n\n${runtime}\n`;
  result = result.replace('  function replaceCompositeText() {', setup + '\n  function replaceCompositeText() {');
  result = result.replace('      configureContactForm()\n      return', '      configureContactForm()\n      applyCorporateCopy()\n      return');
  // Export files use CRLF; preserve the original formatting while locating the lifecycle hook.
  if (!result.includes('      applyCorporateCopy()')) result = result.replace('      configureContactForm()\r\n      return', '      configureContactForm()\r\n      applyCorporateCopy()\r\n      return');
  if (!result.includes('      applyCorporateCopy()')) throw new Error('Corporate lifecycle hook was not inserted');
  return result;
}

export const robots = site.origin
  ? `User-agent: *\nAllow: /\nSitemap: ${site.origin}/sitemap.xml\n`
  : 'User-agent: *\nAllow: /\n';

function generateSitemap() {
  if (!site.origin) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Domain pending: set origin in src/content/corporate.mjs -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
  }
  const o = site.origin;
  const urls = [
    { loc: o,                                              priority: '1.0', changefreq: 'monthly' },
    { loc: `${o}/services`,                                priority: '0.9', changefreq: 'monthly' },
    { loc: `${o}/work`,                                    priority: '0.8', changefreq: 'monthly' },
    { loc: `${o}/contact`,                                 priority: '0.7', changefreq: 'yearly'  },
    { loc: `${o}/services/desarrollo-web`,                 priority: '0.8', changefreq: 'monthly' },
    { loc: `${o}/services/inteligencia-artificial`,        priority: '0.8', changefreq: 'monthly' },
    { loc: `${o}/services/desarrollo-full-stack`,          priority: '0.8', changefreq: 'monthly' },
    { loc: `${o}/services/software-empresarial`,          priority: '0.8', changefreq: 'monthly' },
    { loc: `${o}/services/auditoria-de-codigo`,            priority: '0.8', changefreq: 'monthly' },
    { loc: `${o}/work/sistema-hotelero`,                   priority: '0.6', changefreq: 'yearly'  },
    { loc: `${o}/work/nezus-bisuteria`,                    priority: '0.6', changefreq: 'yearly'  },
    { loc: `${o}/work/soluciones-empresariales`,           priority: '0.6', changefreq: 'yearly'  },
    { loc: `${o}/privacy-policy`,                          priority: '0.3', changefreq: 'yearly'  },
    { loc: `${o}/terms-of-use`,                            priority: '0.3', changefreq: 'yearly'  },
  ];
  const entries = urls.map(({ loc, priority, changefreq }) =>
    `  <url><loc>${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
export const sitemap = generateSitemap();
