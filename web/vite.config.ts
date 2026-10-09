import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-v2.png'],
      manifest: {
        id: '/',
        name: 'NioCM — Agentic Terminal',
        short_name: 'NioCM',
        description: 'A workspace for terminals and AI coding agents.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        prefer_related_applications: false,
        background_color: '#f8fafc',
        theme_color: '#008080',
        icons: [
          { src: '/icons/icon-192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2}', 'icons/*.png', 'favicon.svg'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/(?:ws|health)(?:[/?]|$)/],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:1422',
        ws: true,
      },
      '/health': {
        target: 'http://127.0.0.1:1422',
      },
    },
  },
})
