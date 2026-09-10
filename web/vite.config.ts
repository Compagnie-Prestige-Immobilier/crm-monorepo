import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    // Le panneau v1 est repris tel quel : ses imports Next et son client d'API
    // généré pointent sur des cales locales.
    alias: [
      {
        find: '@crm/api-client/query',
        replacement: resolve(import.meta.dirname, 'src/api/compat/query.ts'),
      },
      {
        find: '@crm/api-client',
        replacement: resolve(import.meta.dirname, 'src/api/compat/index.ts'),
      },
      { find: 'next/link', replacement: resolve(import.meta.dirname, 'src/shims/next-link.tsx') },
      {
        find: 'next/navigation',
        replacement: resolve(import.meta.dirname, 'src/shims/next-navigation.ts'),
      },
      { find: 'next/image', replacement: resolve(import.meta.dirname, 'src/shims/next-image.tsx') },
      {
        find: 'next/script',
        replacement: resolve(import.meta.dirname, 'src/shims/next-script.tsx'),
      },
      {
        find: 'next-themes',
        replacement: resolve(import.meta.dirname, 'src/shims/next-themes.tsx'),
      },
      { find: '@', replacement: resolve(import.meta.dirname, 'src') },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      // `Host` reste celui du navigateur : l'API compare `Origin` à `Host` sur chaque écriture.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    // La CSP n'autorise pas `font-src data:` : chaque police reste un fichier.
    assetsInlineLimit: 0,
  },
});
