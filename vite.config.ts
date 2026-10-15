/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-64.png'],
      manifest: {
        name: '가계부',
        short_name: '가계부',
        description: '결제 알림 자동 기록과 예산 관리',
        lang: 'ko',
        start_url: '.',
        display: 'standalone',
        background_color: '#f5f0fb',
        theme_color: '#8e62c6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
