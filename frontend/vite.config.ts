import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API = process.env.VITE_DEV_API || 'http://localhost:4000';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': API, '/uploads': API, '/sitemap.xml': API, '/robots.txt': API } },
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 600 },
});
