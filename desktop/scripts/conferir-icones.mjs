// Confere os ícones do pacote da Store: existem, têm o tamanho exato, não estão vazios nem tortos.
//
// POR QUE ISTO EXISTE. O Syden foi publicado na Microsoft Store com o logo do ELECTRON. A causa é uma
// pasta que não existia (desktop/build/appx/), e o sintoma foi nenhum: o electron-builder usa os
// ícones de exemplo dele quando não acha os seus, sem aviso, e o pacote sai assinado e válido com a
// identidade visual errada. Um erro que não fala precisa de alguém perguntando.
//
//   node desktop/scripts/icones-da-loja.mjs      gera
//   node desktop/scripts/conferir-icones.mjs     confere
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

/**
 * OS CAMINHOS SAEM DAQUI, e não de onde o comando foi digitado.
 *
 * A primeira versão usava 'desktop/build/...', que só funciona da raiz do projeto. Rodando de dentro
 * de desktop/ — que é onde se está quando se acabou de gerar o pacote — vira 'desktop/desktop/...' e o
 * Node reclama de módulo não encontrado, que não tem nada a ver com o problema. Ferramenta que só
 * funciona de um lugar falha justamente na hora em que se está em outro.
 */
const RAIZ = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const caminho = (relativo) => join(RAIZ, relativo);


const PASTA = caminho('desktop/build/appx');
const FONTE = caminho('desktop/build/icon.png');

/** Os quatro primeiros são obrigatórios: sem eles o electron-builder cai nos de exemplo. */
const ESPERADOS = {
  'StoreLogo.png': [50, 50],
  'Square44x44Logo.png': [44, 44],
  'Square150x150Logo.png': [150, 150],
  'Wide310x150Logo.png': [310, 150],
  'Square71x71Logo.png': [71, 71],
  'Square310x310Logo.png': [310, 310],
};

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)[0];

if (!existsSync(PASTA)) {
  console.error(`${PASTA} não existe — o pacote sairia com o logo do Electron.`);
  console.error('Gere com: node desktop/scripts/icones-da-loja.mjs');
  process.exit(1);
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage();

/** Tamanho do arquivo, e a caixa do que está visível dentro dele. */
async function medir(caminho) {
  const base64 = readFileSync(caminho).toString('base64');
  return page.evaluate(async (base64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + base64;
    await img.decode();
    const tela = document.createElement('canvas');
    tela.width = img.width;
    tela.height = img.height;
    const ctx = tela.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, img.width, img.height).data;

    let visiveis = 0;
    let minX = Infinity;
    let maxX = -1;
    let minY = Infinity;
    let maxY = -1;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] <= 20) continue;
      visiveis++;
      const p = i / 4;
      const x = p % img.width;
      const y = (p / img.width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { w: img.width, h: img.height, visiveis, minX, maxX, minY, maxY, lw: maxX - minX + 1, lh: maxY - minY + 1 };
  }, base64);
}

const fonte = await medir(FONTE);
const proporcaoFonte = fonte.lw / fonte.lh;
console.log(`  fonte: ${fonte.w}x${fonte.h}, desenho ${fonte.lw}x${fonte.lh} (proporção ${proporcaoFonte.toFixed(3)})\n`);

const problemas = [];

for (const [nome, [largura, altura]] of Object.entries(ESPERADOS)) {
  const caminho = join(PASTA, nome);
  if (!existsSync(caminho)) {
    console.log(`  XX  ${nome.padEnd(24)} NÃO EXISTE`);
    problemas.push(`${nome} não existe`);
    continue;
  }

  const m = await medir(caminho);
  const tamanhoOk = m.w === largura && m.h === altura;

  /**
   * A TOLERÂNCIA ACOMPANHA O TAMANHO, e essa é a lição desta ferramenta.
   *
   * A primeira versão usava 5% fixos e acusou três ícones de distorcidos. Não estavam: o desenho usa a
   * MESMA escala nos dois eixos, por construção, e não tem como distorcer. O que acontece num ícone de
   * 44 pixels é que a borda suave do desenho fica com transparência abaixo do limiar e some da medição
   * — dois pixels a menos numa altura de 34 já dão 6%. Medir coisa pequena com régua de coisa grande
   * acusa inocente, e ferramenta que acusa inocente para de ser lida.
   */
  const folga = 2 / Math.min(m.lw, m.lh) + 0.02;
  const proporcao = m.lw / m.lh;
  const semDistorcao = Math.abs(proporcao / proporcaoFonte - 1) < folga;

  const centradoX = Math.abs(m.minX - (m.w - 1 - m.maxX)) <= 2;
  const centradoY = Math.abs(m.minY - (m.h - 1 - m.maxY)) <= 2;
  const temDesenho = m.visiveis > 100;
  const cabe = m.lw <= m.w && m.lh <= m.h;

  const ok = tamanhoOk && semDistorcao && centradoX && centradoY && temDesenho && cabe;
  const queixas = [
    tamanhoOk ? '' : `tamanho ${m.w}x${m.h}, esperado ${largura}x${altura}`,
    semDistorcao ? '' : 'distorcido',
    centradoX && centradoY ? '' : 'fora do centro',
    temDesenho ? '' : 'vazio',
    cabe ? '' : 'transbordando',
  ].filter(Boolean);

  console.log(
    `  ${ok ? 'OK ' : 'XX '} ${nome.padEnd(24)} ${String(m.w + 'x' + m.h).padEnd(9)} ` +
      `desenho ${String(m.lw + 'x' + m.lh).padEnd(9)} ${queixas.join(', ')}`,
  );
  if (!ok) problemas.push(`${nome}: ${queixas.join(', ')}`);
}

// Um PNG estranho na pasta vai para dentro do pacote junto. Melhor saber.
const sobrando = readdirSync(PASTA).filter((n) => !(n in ESPERADOS));
if (sobrando.length) console.log(`\n  (também na pasta, e vai junto no pacote: ${sobrando.join(', ')})`);

await browser.close();

console.log('');
if (problemas.length) {
  console.log('PROBLEMAS:');
  for (const p of problemas) console.log('  - ' + p);
  process.exit(1);
}
console.log('Os ícones do pacote estão certos: tamanho exato, sem distorção, centralizados.');
