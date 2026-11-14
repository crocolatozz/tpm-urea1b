import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const DEV_SELF_DESTROY_SW = `
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await self.caches.keys();
      await Promise.all(keys.map((k) => self.caches.delete(k)));
    } catch {}
    try {
      await self.registration.unregister();
    } catch {}
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if ('navigate' in client) {
          client.navigate(client.url).catch(() => {});
        }
      }
    } catch {}
  })());
});
`;

const DEV_LEGACY_SCRIPT_RECOVERY = `
(async function () {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
  window.location.reload();
})();
`;

function devSwCleanupPlugin() {
  return {
    name: 'dev-sw-cleanup',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname === '/sw.js' || pathname === '/dev-sw.js') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
          res.setHeader('Service-Worker-Allowed', '/');
          res.end(DEV_SELF_DESTROY_SW);
          return;
        }
        if (pathname === '/dashboard.js' || pathname === '/kolase.js') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
          res.end(DEV_LEGACY_SCRIPT_RECOVERY);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  const basePath = isBuild ? './' : '/';

  return {
    base: basePath,
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: false,
    },
    plugins: [
      devSwCleanupPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [],
        manifest: {
          id: basePath,
          name: 'Dashboard TPM Urea 1B',
          short_name: 'TPM Urea 1B',
          description:
            'Monitoring jadwal inspeksi mesin dan kolase foto dokumentasi Before & After TPM Urea 1B (v2.2.0).',
          start_url: basePath,
          scope: basePath,
          display: 'standalone',
          background_color: '#121212',
          theme_color: '#121212',
          icons: [
            {
              src: 'favicon.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          skipWaiting: false,
          clientsClaim: false,
          cleanupOutdatedCaches: true,
          navigateFallback: isBuild ? 'index.html' : null,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}'],
          globIgnores: ['**/version.json'],
          runtimeCaching: [
            {
              urlPattern: /version\.json/i,
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/firestore'],
          },
        },
      },
    },
  };
});
