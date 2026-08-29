import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service workers make dev debugging miserable; keep them to production only.
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Dragonboat Manager',
        short_name: 'Dragonboat',
        description: 'Club roster, events, and crew seating for dragon boat teams',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    // Two projects. The split is not about speed — it is what keeps a browser
    // API from quietly reaching the layers that must stay portable.
    projects: [
      {
        extends: true,
        test: {
          name: 'domain',
          environment: 'node',
          // Scoped to the pure layers on purpose. A wider glob would pull in
          // storage tests, which legitimately need a DOM, and the first
          // `@vitest-environment jsdom` docblock added to satisfy them would
          // hand every domain test a `window` without anyone noticing.
          include: ['src/domain/**/*.test.ts', 'src/utils/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          include: [
            'src/**/*.test.tsx',
            'src/components/**/*.test.ts',
            'src/data/**/*.test.ts',
            'src/stores/**/*.test.ts',
          ],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
});
