import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — относительные пути. Сайт работает на GitHub Pages
// по адресу https://<логин>.github.io/<любое-имя-репозитория>/ без правки конфига.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
});
