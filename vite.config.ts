import { fileURLToPath, URL } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  base: '/well-read/',
  resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'well-read',
        short_name: 'well-read',
        description: 'A curated literature feed',
        start_url: '/well-read/',
        scope: '/well-read/',
        display: 'standalone',
        theme_color: '#F8F2E7',
        background_color: '#F8F2E7',
        icons: [
          {
            src: '/well-read/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/well-read/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/well-read/icons/icon-192-maskable.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: '/well-read/icons/icon-512-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/well-read/index.html',
        navigateFallbackAllowlist: [/^(?!\/well-read\/data\/).*/],
        runtimeCaching: [
          {
            urlPattern: /\/well-read\/data\/manifest\.json/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'manifest-cache',
            },
          },
          {
            urlPattern: /\/well-read\/data\/shard-.*\.json/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'shard-cache',
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
