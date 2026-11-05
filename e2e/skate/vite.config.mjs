// A página de conferência do Rolê do coelho (o skate): `npx vite e2e/skate --port 5300` (da raiz). Mostra o JogoSkate de verdade
// com um servidor de mentira (guarda os pontos e o recorde na memória), para ver a pista e rodar o piloto automático.
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../web/public', import.meta.url)),
  plugins: [react()],
  server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
};
