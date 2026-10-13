import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  envDir: '..', // le .env est à la racine du projet
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/ws': { target: 'ws://localhost:3001', ws: true } },
  },
});
