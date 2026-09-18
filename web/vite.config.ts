import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// No GitHub Pages o site fica em https://<usuario>.github.io/<repo>/, então o build usa VITE_BASE=/<repo>/.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200 }, // o SDK do LiveKit sozinho já passa do limite padrão
});
