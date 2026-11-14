import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  const basePath = isBuild ? './' : '/';

  return {
    base: basePath,
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
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
            'Monitoring jadwal inspeksi mesin dan kolase foto dokumentasi Before & After TPM Urea 1B (v2.0.0).',
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
          enabled: true,
          type: 'module',
          suppressWarnings: true,
        },
      }),
    ],
  };
});
