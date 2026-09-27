// A arte promocional da página do Syden na Microsoft Store.
//
// POR QUE NÃO É UMA CAPTURA DE TELA. A "super hero art" é usada quando a Store destaca um app numa
// vitrine, e ela escreve o NOME DO APP POR CIMA da imagem. Uma captura de tela ali vira um borrão
// com letras em cima: o que era interface fica pequeno demais para ler e atrapalhado demais para
// servir de fundo.
//
// Por isso o desenho é o oposto de uma captura: o coelho grande de um lado, e do outro um vazio
// deliberado — o espaço onde o texto da Microsoft vai cair. Um fundo cheio é um fundo que briga com
// o texto que ainda não está lá.
//
// POR QUE O NAVEGADOR desenha isto, e não uma biblioteca de imagem: o projeto não tem nenhuma, e
// acrescentar uma para uma arte que se refaz a cada troca de identidade visual seria uma dependência
// para sempre por um trabalho de um minuto. É o mesmo caminho de scripts/reenquadrar-icone.mjs.
//
//   node scripts/arte-da-loja.mjs
//   node scripts/arte-da-loja.mjs --largura 2400 --altura 1200 --saida imagem/outra.png
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const opcao = (nome, padrao) => {
  const i = process.argv.indexOf('--' + nome);
  return i >= 0 ? process.argv[i + 1] : padrao;
};

/** 1920x1080 é o tamanho que o Partner Center pede para a super hero art. */
const LARGURA = Number(opcao('largura', 1920));
const ALTURA = Number(opcao('altura', 1080));
const SAIDA = opcao('saida', 'imagem/loja-super-hero.png');
const LOGO = opcao('logo', 'imagem/icone-recortado.png');

/** As cores do tema escuro do Syden (ver web/src/styles.css). A arte tem de parecer o app. */
const FUNDO_ESCURO = '#1e1f22';
const FUNDO_CLARO = '#313338';
const DESTAQUE = '#5865f2';

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)[0];

const logoBase64 = readFileSync(LOGO).toString('base64');

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage();

const png = await page.evaluate(
  async ({ largura, altura, logoBase64, fundoEscuro, fundoClaro, destaque }) => {
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');

    // Fundo: o mesmo degradê que o Syden tem atrás da tela inicial, escuro à direita para o texto
    // branco da Microsoft ter contraste onde ele vai cair.
    const fundo = ctx.createLinearGradient(0, 0, largura, altura);
    fundo.addColorStop(0, fundoClaro);
    fundo.addColorStop(1, fundoEscuro);
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, largura, altura);

    // Um halo atrás do coelho, para ele não parecer recortado e colado sobre o fundo.
    const halo = ctx.createRadialGradient(largura * 0.28, altura * 0.5, 0, largura * 0.28, altura * 0.5, altura * 0.62);
    halo.addColorStop(0, destaque + '33');
    halo.addColorStop(1, destaque + '00');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, largura, altura);

    // Estrelinhas discretas, do lado de quem olha. Sem elas o fundo fica liso demais e a arte
    // parece um erro de carregamento em vez de uma escolha.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 90; i++) {
      // Distribuição fixa, e não sorteada: rodar o script duas vezes tem de dar a mesma imagem,
      // senão não dá para comparar uma versão com a outra.
      const x = ((i * 9973) % 1000) / 1000;
      const y = ((i * 7919) % 1000) / 1000;
      const r = 1 + (((i * 31) % 7) / 7) * 2;
      ctx.beginPath();
      ctx.arc(x * largura, y * altura, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // O coelho, à esquerda, ocupando pouco mais da metade da altura.
    const img = new Image();
    img.src = 'data:image/png;base64,' + logoBase64;
    await img.decode();
    const alturaDoLogo = altura * 0.58;
    const escala = alturaDoLogo / img.height;
    const larguraDoLogo = img.width * escala;
    ctx.drawImage(img, largura * 0.28 - larguraDoLogo / 2, (altura - alturaDoLogo) / 2, larguraDoLogo, alturaDoLogo);

    // O NOME NÃO É DESENHADO. A Store escreve "Syden" por cima desta arte, e desenhar aqui daria
    // dois títulos sobrepostos — o erro mais comum nesse tipo de banner.
    //
    // O que fica à direita é vazio de propósito: é onde o texto dela cai.

    return canvas.toDataURL('image/png').split(',')[1];
  },
  { largura: LARGURA, altura: ALTURA, logoBase64, fundoEscuro: FUNDO_ESCURO, fundoClaro: FUNDO_CLARO, destaque: DESTAQUE },
);

mkdirSync(SAIDA.split('/').slice(0, -1).join('/') || '.', { recursive: true });
writeFileSync(SAIDA, Buffer.from(png, 'base64'));
await browser.close();

console.log(`Escrito: ${SAIDA} (${LARGURA}x${ALTURA})`);
console.log('\nO lado direito está vazio de propósito: é onde a Store escreve o nome do app.');
