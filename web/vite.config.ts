import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

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

// A VERSÃO DESTA MONTAGEM: o commit, com a hora de reserva fora do git. Vai embutida no código
// (import.meta.env.VITE_VERSAO) e num arquivo ao lado (versao.json). A aba aberta compara as duas e,
// quando o site no ar muda, oferece recarregar (ver VersaoNova.tsx) — o Syden fica aberto por dias, e
// sem isso quem não recarrega usa a versão de antes do deploy sem saber.
function versaoDaMontagem(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return String(Date.now());
  }
}
process.env.VITE_VERSAO ??= versaoDaMontagem();

const arquivoDeVersao: Plugin = {
  name: 'versao-do-syden',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'versao.json', source: JSON.stringify({ versao: process.env.VITE_VERSAO }) });
  },
};

// O QUARTO NOVO, SÓ NO DESENVOLVIMENTO (15/10/2026). O quarto de móveis soltos ainda é a página de teste
// (e2e/pixel-art/quarto/novo/quarto/quarto.html, gerada por montar.mjs), e o QuartoNovo.tsx a mostra num iframe. Ela é
// servida daqui, lida do disco a cada pedido (montar de novo e recarregar basta), e NÃO entra no build: até ele lançar,
// a home publicada continua sendo o quarto atual (decisão dele: "quando eu lançar, ele vai substituir o quarto atual").
const QUARTO_NOVO = fileURLToPath(new URL('../e2e/pixel-art/quarto/novo/quarto/quarto.html', import.meta.url));
const quartoNovo: Plugin = {
  name: 'quarto-novo',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(BASE + 'quarto-novo/', (_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(readFileSync(QUARTO_NOVO));
    });
  },
};

export default defineConfig({
  base: BASE,
  plugins: [react(), arquivoDeVersao, quartoNovo],
  build: {
    // O app sai numa subpasta, e os arquivos do site entram na raiz depois (scripts/montar-site.mjs).
    outDir: 'dist/app',
    chunkSizeWarningLimit: 1200, // o SDK do LiveKit sozinho já passa do limite padrão
  },
});
