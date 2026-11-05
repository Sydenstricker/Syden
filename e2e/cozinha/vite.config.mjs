// A página de conferência da Cozinha da toca: `npx vite e2e/cozinha --port 5301` (da raiz). Mostra o JogoCozinha de verdade
// com um servidor de mentira (a mesma conferência das receitas), para ver a cozinha e rodar o piloto automático.
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../web/public', import.meta.url)),
  plugins: [react()],
  server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
};
