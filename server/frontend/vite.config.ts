import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@techstark/opencv-js'],
  },
  resolve: {
    alias: {
      '@circus-racing/types': path.resolve(__dirname, '../packages/types/src'),
    },
  },
  base: '/dashboard/',
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': 'http://localhost:3000',
    },
  },
});
