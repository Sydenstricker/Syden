// Gera todos os PNGs do ícone do Syden a partir de um desenho só: web/public/syden-icon.svg.
//
// O ícone é o D4 do rebrand de 05/10/2026 (orelhas, balão e três pontos), entregue em vetor. Vetor
// não serve para tudo: o Windows, a Store e o manifesto do site pedem PNG, cada um num tamanho. Este
// script desenha o SVG nesses tamanhos — e depois disso o scripts/ladrilhos-da-loja.mjs faz os
// ladrilhos da Store a partir do desktop/build/icon.png que sai daqui.
//
// O MASCARÁVEL é o único diferente. Quem o usa (Android, atalho instalado) recorta o ícone num círculo
// ou numa gota, e só garante o miolo: um círculo de 40% do lado em volta do centro. O D4 vai até a
// borda do quadrado (a ponta do balão fica a 47% do centro), então nele o fundo enche tudo e o
// desenho encolhe para 80%, cabendo inteiro na zona segura.
//
// Usa o Chrome dos testes, como os outros scripts de ícone: o projeto não tem biblioteca de imagem.
//
//   node scripts/icone-da-marca.mjs
//   node scripts/ladrilhos-da-loja.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const CAMINHOS_DO_CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const ORIGEM = 'web/public/syden-icon.svg';
/** A cor do fundo do ícone, a mesma do SVG. É ela que enche o mascarável. */
const FUNDO = '#1E2533';

const SAIDAS = [
  { arquivo: 'desktop/build/icon.png', lado: 512 },
  { arquivo: 'web/public/icon-512.png', lado: 512 },
  { arquivo: 'web/public/icon-192.png', lado: 192 },
  { arquivo: 'web/public/icon-maskable-512.png', lado: 512, mascaravel: true },
];

const executablePath = CAMINHOS_DO_CHROME.find((c) => existsSync(c));
if (!executablePath) throw new Error('Não achei o Chrome. Aponte com a variável CHROME_PATH.');

const svg = readFileSync(ORIGEM, 'utf8');
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();
await page.setContent('<body style="margin:0"></body>');

for (const saida of SAIDAS) {
  const png = await page.evaluate(
    async ({ svg, lado, mascaravel, fundo }) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await img.decode();
      const c = new OffscreenCanvas(lado, lado);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      if (mascaravel) {
        ctx.fillStyle = fundo;
        ctx.fillRect(0, 0, lado, lado);
        const w = lado * 0.8;
        ctx.drawImage(img, (lado - w) / 2, (lado - w) / 2, w, w);
      } else {
        ctx.drawImage(img, 0, 0, lado, lado);
      }
      const blob = await c.convertToBlob({ type: 'image/png' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (const b of buf) bin += String.fromCharCode(b);
      return btoa(bin);
    },
    { svg, lado: saida.lado, mascaravel: !!saida.mascaravel, fundo: FUNDO },
  );
  writeFileSync(saida.arquivo, Buffer.from(png, 'base64'));
  console.log(`  ${saida.arquivo.padEnd(34)} ${saida.lado}×${saida.lado}${saida.mascaravel ? ' (mascarável)' : ''}`);
}

await browser.close();
console.log('\nAgora: node scripts/ladrilhos-da-loja.mjs, para os ladrilhos da Store saírem deste ícone.');
