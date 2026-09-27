// Reenquadra o ícone do Syden: acha onde o desenho realmente começa e tira a sobra em volta.
//
// Por que existe: o ícone tem margem de folga, e quem mostra ele dentro de um círculo (a tela de
// autorização do GitHub, a lista de apps do Windows) recorta os cantos e ainda põe margem própria. O
// resultado é um coelho pequeno no meio de um vazio enorme.
//
// Por que usa NAVEGADOR em vez de uma biblioteca de imagem: o projeto não tem nenhuma, e acrescentar uma
// só para isso seria uma dependência a mais para sempre. O Chrome que os testes de ponta a ponta já
// usam sabe abrir PNG, medir pixel e escrever PNG — e este script roda uma vez a cada troca de arte.
//
//   node scripts/reenquadrar-icone.mjs
//   node scripts/reenquadrar-icone.mjs --margem 4 --saida imagem/logo-redondo.png
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const CAMINHOS_DO_CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function argumento(nome, padrao) {
  const i = process.argv.indexOf('--' + nome);
  return i === -1 ? padrao : process.argv[i + 1];
}

const ENTRADA = argumento('entrada', 'desktop/build/icon.png');
const SAIDA = argumento('saida', 'imagem/icone-recortado.png');
const LADO = Number(argumento('lado', 512));
/** Folga que sobra em volta do desenho, em % do lado. Zero encosta o desenho na borda. */
const MARGEM = Number(argumento('margem', 6));

const executavel = CAMINHOS_DO_CHROME.find((c) => c);
const browser = await chromium.launch(executavel ? { executablePath: executavel } : {});
const page = await browser.newPage();

const original = readFileSync(ENTRADA).toString('base64');

const resultado = await page.evaluate(
  async ({ dados, lado, margem }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + dados;
    await img.decode();

    const medir = document.createElement('canvas');
    medir.width = img.width;
    medir.height = img.height;
    const ctx = medir.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, img.width, img.height).data;

    // Onde o desenho começa e termina. "Desenho" é o que não é transparente E não é branco: a arte tem
    // fundo branco em algumas versões e fundo vazio em outras, e os dois contam como sobra.
    let esquerda = img.width;
    let direita = -1;
    let cima = img.height;
    let baixo = -1;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
        const vazio = a < 12 || (r > 248 && g > 248 && b > 248);
        if (vazio) continue;
        if (x < esquerda) esquerda = x;
        if (x > direita) direita = x;
        if (y < cima) cima = y;
        if (y > baixo) baixo = y;
      }
    }
    if (direita < 0) return { erro: 'a imagem inteira parece vazia' };

    // O recorte é QUADRADO e centrado no desenho: esticar para caber deformaria o coelho.
    const largura = direita - esquerda + 1;
    const altura = baixo - cima + 1;
    const ladoDoCorte = Math.max(largura, altura);
    const centroX = esquerda + largura / 2;
    const centroY = cima + altura / 2;

    const folga = 1 + (margem * 2) / 100;
    const corte = ladoDoCorte * folga;

    const saida = document.createElement('canvas');
    saida.width = lado;
    saida.height = lado;
    const sctx = saida.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(img, centroX - corte / 2, centroY - corte / 2, corte, corte, 0, 0, lado, lado);

    return {
      antes: { largura: img.width, altura: img.height },
      desenho: { esquerda, cima, largura, altura },
      // Quanto do quadro o desenho ocupava antes, e quanto ocupa agora.
      ocupacaoAntes: Math.round((ladoDoCorte / Math.max(img.width, img.height)) * 100),
      ocupacaoDepois: Math.round((100 / folga) * 100) / 100,
      png: saida.toDataURL('image/png'),
    };
  },
  { dados: original, lado: LADO, margem: MARGEM },
);

await browser.close();

if (resultado.erro) {
  console.error(resultado.erro);
  process.exit(1);
}

writeFileSync(SAIDA, Buffer.from(resultado.png.split(',')[1], 'base64'));

console.log(`entrada: ${ENTRADA} (${resultado.antes.largura}x${resultado.antes.altura})`);
console.log(`o desenho ocupava ${resultado.ocupacaoAntes}% do quadro; agora ocupa ${resultado.ocupacaoDepois}%`);
console.log(`saída: ${SAIDA} (${LADO}x${LADO})`);
