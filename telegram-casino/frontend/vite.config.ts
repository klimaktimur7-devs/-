import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.trycloudflare.com', '.serveousercontent.com'],
    proxy: {
      '/auth': 'http://localhost:3000',
      '/me': 'http://localhost:3000',
      '/deposits': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
