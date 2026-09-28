import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// O SYDEN MORA EM /app/, E A RAIZ É O SITE DE APRESENTAÇÃO.
//
// Antes o app ficava na raiz de syden.chat, e quem chegava pelo link da Store caía direto numa tela de
// login sem nunca ler o que o Syden é. Agora a raiz explica o produto (web/site/) e o app fica embaixo.
//
// POR QUE O ENDEREÇO ESTÁ ESCRITO AQUI, E NÃO NUMA VARIÁVEL DO GITHUB. Porque errar isto abre o site em
// branco para todo mundo ao mesmo tempo: com o `base` errado, a página pede os arquivos no lugar errado
// e o navegador não acha nada. Uma variável de painel web pode estar com outro valor guardado de meses
// atrás, e ninguém lembra de conferir. Aqui está no código, versionado, e aparece na revisão.
//
// Os apps JÁ INSTALADOS carregam a raiz e continuam funcionando: a página de apresentação detecta a
// ponte do Electron e desvia para /app/ (ver web/site/desviar-para-o-app.js). É o que permitiu fazer
// esta mudança sem esperar build nova nem quebrar o pacote que está em certificação.
const BASE = process.env.VITE_BASE || '/app/';

export default defineConfig({
  base: BASE,
  plugins: [react()],
  build: {
    // O app sai numa subpasta, e os arquivos do site entram na raiz depois (scripts/montar-site.mjs).
    outDir: 'dist/app',
    chunkSizeWarningLimit: 1200, // o SDK do LiveKit sozinho já passa do limite padrão
  },
});
