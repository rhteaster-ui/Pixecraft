import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'pixcraft-metadata-and-offline',
      transformIndexHtml(html) {
        const domain = process.env.PIXCRAFT_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
        if (!domain) return html;
        const u = new URL(domain.includes('://') ? domain : `https://${domain}`);
        const origin = u.origin;
        return html
          .replace('content="/og.png"', `content="${origin}/og.png"`)
          .replace('</head>', `<meta property="og:url" content="${origin}/"/><link rel="canonical" href="${origin}/"/></head>`);
      },
      closeBundle() {
        if (existsSync('dist/assets') && existsSync('dist/sw.js')) {
          const assets = readdirSync('dist/assets').map(f => `/assets/${f}`);
          writeFileSync('dist/precache.json', JSON.stringify(assets));
          const hash = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);
          writeFileSync('dist/sw.js', readFileSync('dist/sw.js', 'utf8').replace('pixcraft-shell-v1', `pixcraft-shell-${hash}`));
        }
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  },
  build: {
    target: 'es2022'
  }
});
