/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '가계부',
        short_name: '가계부',
        description: '결제 알림 자동 기록과 예산 관리',
        lang: 'ko',
        start_url: '.',
        display: 'standalone',
        background_color: '#f6f7f5',
        theme_color: '#2f6f5e',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
