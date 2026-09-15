import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { createSiteServer } from './src/server/http.mjs';

export default defineConfig({
  output: 'static',
  // Whitespace and the exported script order are part of the visual contract.
  compressHTML: false,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  vite: {
    plugins: [{
      name: 'preserve-framer-cms-ranges',
      configureServer(server) {
        const transport = createSiteServer({ rootDirectory: fileURLToPath(new URL('./public/', import.meta.url)) });
        server.middlewares.use((req, res, next) => {
          const pathname = new URL(req.url, 'http://localhost').pathname;
          if (pathname === '/api/framercms' || (pathname.startsWith('/assets/cms/') && pathname.endsWith('.framercms'))) {
            transport.emit('request', req, res);
          } else next();
        });
      },
    }],
  },
});
