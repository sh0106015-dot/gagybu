/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { CSP } from './csp';

export default defineConfig({
  // GitHub Pages(https://아이디.github.io/저장소/)에서는 배포 작업이 BASE_PATH=/저장소/ 를 넘겨준다.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    {
      // 배포본에만 외부 전송 차단 규칙(CSP)을 넣는다.
      name: 'inject-csp',
      apply: 'build',
      transformIndexHtml: (html: string) =>
        html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        ),
    },
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
