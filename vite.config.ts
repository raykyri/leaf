import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyDirBeforeWrite: true,
    sourcemap: true,
  },
  server: {
    port: 3334,
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
      '/oauth': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
      '/healthz': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
