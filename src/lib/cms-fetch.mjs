// Install before Framer's async bundle, on every hostname and every route.
export function installCmsFetch() {
  const originalFetch = window.fetch.bind(window);
  const files = new Set([
    'Ejo4jvBE8-chunk-default-0.framercms',
    'Ejo4jvBE8-indexes-default-0.framercms',
    'PuvR7bUan-chunk-default-0.framercms',
    'PuvR7bUan-indexes-default-0.framercms',
  ]);
  window.fetch = function (input, init) {
    const isRequest = input instanceof Request;
    const url = new URL(isRequest ? input.url : String(input), window.location.href);
    const file = url.pathname.split('/').pop();
    const isFramer = url.hostname === 'framerusercontent.com' || url.hostname.endsWith('.framerusercontent.com');
    const isLocalAsset = url.origin === window.location.origin && /^\/assets\/(cms|js)\//.test(url.pathname);
    if (!files.has(file) || (!isFramer && !isLocalAsset)) return originalFetch(input, init);

    // Call the function directly: Vercel serves existing static files before
    // rewrites, so /assets/cms/*.framercms?range= would return the WHOLE file.
    const endpoint = new URL('/api/framercms', window.location.href);
    endpoint.search = url.search;
    endpoint.searchParams.set('file', file);
    const request = isRequest ? new Request(endpoint.href, input) : endpoint.href;
    return originalFetch(request, init);
  };
}

export function withCmsFetch(html) {
  if (!html) return html;
  const result = html.replace(/<script\b[^>]*data-local-cms-fetch[^>]*>[\s\S]*?<\/script>/g, '');
  if (result.includes('data-jcar-cms-fetch')) return result;
  return result.replace(/<head([^>]*)>/i, `<head$1><script data-jcar-cms-fetch>(${installCmsFetch.toString()})();</script>`);
}
