import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: {
      // Polyfill Node.js modules for browser compatibility
      module: '/src/polyfills/module-shim.ts',
    },
  },
  build: {
    rollupOptions: {
      // Externalize node-specific modules from @character-foundry/core
      external: ['module'],
      output: {
        globals: {
          module: '{}',
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@character-foundry/core'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'robots.txt',
        'logo.png',
        'logo-*.png',
        'apple-touch-icon.png',
        'userscript.js',
      ],
      manifest: {
        name: 'Card Architect',
        short_name: 'CardArch',
        description: 'CCv2/CCv3 character card editor with offline support',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['utilities', 'productivity'],
        icons: [
          {
            src: '/logo-48.png',
            sizes: '48x48',
            type: 'image/png',
          },
          {
            src: '/logo-72.png',
            sizes: '72x72',
            type: 'image/png',
          },
          {
            src: '/logo-96.png',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            src: '/logo-144.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: '/logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/logo-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/logo-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Precache all app assets for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Cache Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache Google Fonts webfont files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache images with a cache-first strategy
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
        // Handle navigation requests (SPA)
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  define: {
    // Vue feature flags for Milkdown Crepe (which uses Vue internally)
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['purrsephone.local.vega.nyc', 'card-architect.local.vega.nyc'],
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/user': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
    },
  },
});
