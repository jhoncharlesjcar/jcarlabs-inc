import { site, services } from '../content/corporate.mjs';
import { withUrlShim } from './url-shim.js';
import { withCmsFetch } from './cms-fetch.mjs';
import { applyCorporateHtml } from './corporate-html.mjs';

const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function corporateDocument(source, route) {
  const service = services.find((item) => item.route === route);
  const title = service ? `${service.title} — ${site.name}` : route === '/' ? site.title : null;
  const description = service?.description || (['/', '/services', '/contact'].includes(route) ? site.description : null);
  let result = withUrlShim(withCmsFetch(source));
  if (route === '/') result = result.replace('</head>', '<link rel="stylesheet" href="/hero-adjustments.css"></head>');
  if (title) result = result.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`);
  // [1.1] Eliminar meta etiquetas de Framer que revelan el proyecto original (incondicional).
  result = result.replace(/<meta\b[^>]*name="framer-search-index(?:-fallback)?"[^>]*>/g, '');
  result = result.replace(/<meta\b[^>]*name="framer-html-plugin"[^>]*>/g, '');
  result = result.replace(/<iframe\b[^>]*id="__framer-editorbar"[^>]*><\/iframe>/g, '');
  // [1.2] Actualizar og:title, og:description, twitter:title, twitter:description;
  // y eliminar og:url, og:image, twitter:image que apunten al dominio de Framer.
  result = result.replace(/<meta\b[^>]*>/g, (tag) => {
    if (/\b(?:property|name)="(?:og:url|og:image|twitter:image)"/.test(tag) && tag.includes('https://vertical.framer.media')) return '';
    const key = tag.match(/\b(?:property|name)="([^"]+)"/)?.[1];
    const value = ['og:title', 'twitter:title'].includes(key) ? title : ['description', 'og:description', 'twitter:description'].includes(key) ? description : null;
    return value ? tag.replace(/content="[^"]*"/, `content="${escape(value)}"`) : tag;
  });
  // [C-02] Eliminar canonical y og:url del HTML fuente (apuntan a vertical.framer.media).
  result = result.replace(/<link\b[^>]*rel="canonical"[^>]*>/g, '');
  result = result.replace(/<meta\b[^>]*property="og:url"[^>]*>/g, '');
  // [1.4 + 3.3] Insertar canonical, og:url y hreflang propios cuando haya dominio.
  if (site.origin && route !== '/404') {
    const canonicalUrl = `${site.origin}${route === '/' ? '' : route}`;
    const ogImageTag = site.socialImage
      ? `<meta property="og:image" content="${escape(site.socialImage)}"><meta name="twitter:image" content="${escape(site.socialImage)}">`
      : '';
    result = result.replace('</head>',
      `<link rel="canonical" href="${escape(canonicalUrl)}">` +
      `<meta property="og:url" content="${escape(canonicalUrl)}">` +
      `<link rel="alternate" hreflang="es-PE" href="${escape(canonicalUrl)}">` +
      ogImageTag +
      '</head>'
    );
  }
  // [3.1] Añadir noindex a rutas /thoughts (artículos de arte, redirigidas a /services).
  if (
    route === '/thoughts' || route.startsWith('/thoughts/') ||
    route === '/work/fragile-perfection' || route === '/work/silent-gravity' ||
    route === '/work/still-pressure' || route === '/work/surface-tension' ||
    route === '/work/unstable-sequence' || route === '/services/integraciones-sunat'
  ) {
    result = result.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>');
  }
  result = result.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (_, open, text, close) => {
    let schema;
    try { schema = JSON.parse(text); }
    catch { return _; }
    function clean(value) {
      if (!value || typeof value !== 'object') return;
      if (value.creator && typeof value.creator === 'object') {
        value.creator = { '@type': 'Organization', name: site.name, url: site.origin || undefined };
      }
      if (value.author && typeof value.author === 'object') {
        value.author = { '@type': 'Organization', name: site.name, url: site.origin || undefined };
      }
      for (const [key, item] of Object.entries(value)) {
        if (typeof item === 'string') {
          if (item.startsWith('https://vertical.framer.media')) {
            if (site.origin && (key === 'url' || key === '@id')) {
              value[key] = `${site.origin}${route === '/' ? '' : route}`;
            } else {
              delete value[key];
            }
          } else if (/adam knoxville/i.test(item)) {
            value[key] = site.name;
          }
        } else clean(item);
      }
    }
    clean(schema);
    if (service) { schema.name = service.title; schema.description = service.description; }
    else if (route === '/') { schema.name = site.name; schema.description = site.description; }
    return open + JSON.stringify(schema).replaceAll('<', '\\u003c') + close;
  });
  result = result.replace(/(<script data-production-metadata>[\s\S]*?const m=)(\{[^;]+\})(;)/, (_, open, json, close) => {
    let metadata;
    try { metadata = JSON.parse(json); }
    catch { return _; }
    if (title) metadata.title = title;
    if (description) metadata.description = description;
    return open + JSON.stringify(metadata).replaceAll('<', '\\u003c') + close;
  });
  return applyCorporateHtml(result);
}
