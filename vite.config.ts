/// <reference types="vitest/config" />
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // relative base so the build works on GitHub Pages (/<repo>/) or any static host
  base: './',
  plugins: [
    react(),
    // `npm run dev:lan` serves HTTPS on your network so a tablet or phone can use the microphone
    ...(process.env.LAN_HTTPS ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Clef Coach',
        short_name: 'Clef Coach',
        description: 'Learn to read treble and bass clef on piano and guitar — with your real instrument.',
        theme_color: '#06070d',
        background_color: '#06070d',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        categories: ['education', 'music'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
