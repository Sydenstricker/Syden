import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

// O QUARTO NOVO E O SALÃO ISOMÉTRICO (lançados em 16/10/2026: "o quarto novo substitui para todo mundo, assim como o
// salão isométrico"). As duas cenas são as páginas montadas por e2e/pixel-art/quarto/novo/quarto/montar.mjs, e o
// QuartoNovo.tsx e o SalaoNovo.tsx as mostram num iframe. No desenvolvimento, servidas daqui, lidas do disco a cada
// pedido (montar de novo e recarregar basta). No build, montadas para publicar (--publicar, ver montar.mjs): a página
// em quarto-novo/ e salao-novo/, as imagens e o script em assets/, com a impressão digital no nome.
const QUARTO_NOVO = fileURLToPath(new URL('../e2e/pixel-art/quarto/novo/quarto/quarto.html', import.meta.url));
const SALAO_NOVO = fileURLToPath(new URL('../e2e/pixel-art/salao/salao.html', import.meta.url));
const quartoNovo: Plugin = {
  name: 'quarto-novo',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(BASE + 'quarto-novo/', (_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(readFileSync(QUARTO_NOVO));
    });
    // O SALÃO NOVO, do mesmo jeito (SalaoNovo.tsx): a página do salão isométrico, montada por montar.mjs salao.
    server.middlewares.use(BASE + 'salao-novo/', (_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(readFileSync(SALAO_NOVO));
    });
  },
};

const MONTAR = fileURLToPath(new URL('../e2e/pixel-art/quarto/novo/quarto/montar.mjs', import.meta.url));
let pastaDoBuild = 'dist/app';
const cenasNoBuild: Plugin = {
  name: 'cenas-no-build',
  apply: 'build',
  configResolved(config) {
    pastaDoBuild = join(config.root, config.build.outDir);
  },
  closeBundle() {
    for (const [cena, pasta] of [[null, 'quarto-novo'], ['salao', 'salao-novo']] as const) {
      const args = [MONTAR, ...(cena ? [cena] : []), '--publicar', join(pastaDoBuild, pasta), join(pastaDoBuild, 'assets'), '../assets/'];
      process.stdout.write(execFileSync(process.execPath, args, { encoding: 'utf8' }));
    }
  },
};

export default defineConfig({
  base: BASE,
  plugins: [react(), arquivoDeVersao, quartoNovo, cenasNoBuild],
  build: {
    // O app sai numa subpasta, e os arquivos do site entram na raiz depois (scripts/montar-site.mjs).
    outDir: 'dist/app',
    chunkSizeWarningLimit: 1200, // o SDK do LiveKit sozinho já passa do limite padrão
  },
});
