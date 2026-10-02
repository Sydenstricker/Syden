// Refaz os ladrilhos do pacote da Microsoft Store a partir de um desenho só.
//
// POR QUE EXISTE. O Syden 0.1.4 saiu com o coelho pequeno dentro de um quadrado escuro, e são duas
// causas somadas:
//
//   1. A ARTE JÁ VINHA COM MARGEM. No ladrilho de 150×150 o desenho ocupava 57% da largura, e no de
//      310×310, 50%. O Windows ainda acrescenta a margem dele por cima disso.
//   2. O FUNDO ERA #464646, o padrão do electron-builder quando ninguém define cor — um cinza
//      arbitrário que não é do Syden e que não combina com nada.
//
// A segunda se conserta no package.json (backgroundColor). A primeira é este script.
//
// QUANTO O DESENHO DEVE OCUPAR, e por que não é 100%: a Microsoft recomenda margem nos LADRILHOS
// (os quadrados grandes do menu Iniciar), porque eles aparecem colados uns nos outros e sem respiro
// viram uma parede. Já os ícones pequenos — barra de tarefas, lista de aplicativos, Store — aparecem
// sozinhos e devem encher o espaço, senão somem no meio dos vizinhos. Daí dois alvos diferentes.
//
// Usa NAVEGADOR em vez de biblioteca de imagem, pela mesma razão do reenquadrar-icone.mjs: o projeto
// não tem nenhuma, o Chrome dos testes já sabe abrir PNG, medir pixel e escrever PNG, e isto roda uma
// vez a cada troca de arte.
//
//   node scripts/ladrilhos-da-loja.mjs
//   node scripts/ladrilhos-da-loja.mjs --conferir     só mede o que existe hoje, não escreve nada
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const CAMINHOS_DO_CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const ENTRADA = 'desktop/build/icon.png';
const PASTA = 'desktop/build/appx';

/**
 * Cada arte do pacote, com o tamanho exigido pela Microsoft e quanto o desenho deve ocupar.
 *
 * `ocupa` é a fração do lado MENOR. O Wide é o único que não é quadrado, e nele o desenho se guia
 * pela altura — usar a largura faria um coelho gigante deitado.
 */
const LADRILHOS = [
  { nome: 'Square44x44Logo', largura: 44, altura: 44, ocupa: 0.92 },
  { nome: 'StoreLogo', largura: 50, altura: 50, ocupa: 0.92 },
  { nome: 'Square71x71Logo', largura: 71, altura: 71, ocupa: 0.66 },
  { nome: 'Square150x150Logo', largura: 150, altura: 150, ocupa: 0.66 },
  { nome: 'Wide310x150Logo', largura: 310, altura: 150, ocupa: 0.66 },
  { nome: 'Square310x310Logo', largura: 310, altura: 310, ocupa: 0.66 },

  // ---------------------------------------------------------------------------------------------
  // OS SEM PLACA (`altform-unplated`) — e eles são a resposta para o quadrado preto na barra de
  // tarefas.
  //
  // `backgroundColor: "transparent"` no package.json resolve o LADRILHO do menu Iniciar e não
  // resolve a barra de tarefas, e por um motivo que não se descobre lendo configuração: ali o
  // Windows não usa o Square44x44Logo comum. Ele procura uma variante com o sufixo
  // `_altform-unplated` e, quando ela não existe, desenha o ícone comum sobre uma PLACA opaca —
  // que é o quadrado que aparece ao lado de apps cujos ícones flutuam.
  //
  // Os quatro tamanhos são os que o Windows pede: 16 na lista, 24 na barra pequena, 32 na barra
  // normal, 48 no Alt+Tab. Sem o tamanho pedido, ele escala o mais próximo e o ícone sai borrado.
  //
  // Eles ocupam 100%: ícone pequeno aparece sozinho, e margem aqui só o faz sumir entre os vizinhos.
  // ---------------------------------------------------------------------------------------------
  { nome: 'Square44x44Logo.targetsize-16_altform-unplated', largura: 16, altura: 16, ocupa: 1 },
  { nome: 'Square44x44Logo.targetsize-24_altform-unplated', largura: 24, altura: 24, ocupa: 1 },
  { nome: 'Square44x44Logo.targetsize-32_altform-unplated', largura: 32, altura: 32, ocupa: 1 },
  { nome: 'Square44x44Logo.targetsize-48_altform-unplated', largura: 48, altura: 48, ocupa: 1 },
];

const soConferir = process.argv.includes('--conferir');

const executablePath = CAMINHOS_DO_CHROME.find((c) => existsSync(c));
if (!executablePath) throw new Error('Não achei o Chrome. Aponte com a variável CHROME_PATH.');
if (!existsSync(ENTRADA)) throw new Error(`Não achei ${ENTRADA}.`);

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();
await page.setContent('<body style="margin:0"></body>');

/** Mede quanto de uma arte é desenho e quanto é vazio. */
async function medir(caminho) {
  if (!existsSync(caminho)) return null;
  return page.evaluate(async (dados) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + dados;
    await img.decode();
    const c = new OffscreenCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
    for (let y = 0; y < img.height; y += 1) {
      for (let x = 0; x < img.width; x += 1) {
        if (data[(y * img.width + x) * 4 + 3] > 12) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    }
    return { largura: img.width, altura: img.height, desenho: { x0, y0, largura: x1 - x0 + 1, altura: y1 - y0 + 1 } };
  }, readFileSync(caminho).toString('base64'));
}

if (soConferir) {
  console.log('Quanto o desenho ocupa de cada arte hoje:\n');
  for (const l of LADRILHOS) {
    const m = await medir(`${PASTA}/${l.nome}.png`);
    if (!m) {
      console.log(`  ${l.nome.padEnd(20)} não existe`);
      continue;
    }
    const menor = Math.min(m.largura, m.altura);
    const agora = Math.max(m.desenho.largura, m.desenho.altura) / menor;
    const marca = Math.abs(agora - l.ocupa) < 0.06 ? 'ok  ' : 'MUDA';
    console.log(`  ${marca} ${l.nome.padEnd(20)} ${m.largura}×${m.altura}  ocupa ${Math.round(agora * 100)}%  (alvo ${Math.round(l.ocupa * 100)}%)`);
  }
  await browser.close();
  process.exit(0);
}

// O desenho de origem, já sem a margem que ele traz de fábrica.
const origem = await medir(ENTRADA);
if (!origem) throw new Error('não deu para medir ' + ENTRADA);
console.log(`Origem: ${ENTRADA} — desenho de ${origem.desenho.largura}×${origem.desenho.altura} dentro de ${origem.largura}×${origem.altura}\n`);

const base64 = readFileSync(ENTRADA).toString('base64');

for (const l of LADRILHOS) {
  const png = await page.evaluate(
    async ({ dados, corte, alvo }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + dados;
      await img.decode();

      const c = new OffscreenCanvas(alvo.largura, alvo.altura);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      // O desenho entra proporcional: nada de esticar. O lado menor do ladrilho manda.
      const menor = Math.min(alvo.largura, alvo.altura);
      const cabe = menor * alvo.ocupa;
      const escala = Math.min(cabe / corte.largura, cabe / corte.altura);
      const w = corte.largura * escala;
      const h = corte.altura * escala;

      ctx.drawImage(img, corte.x0, corte.y0, corte.largura, corte.altura, (alvo.largura - w) / 2, (alvo.altura - h) / 2, w, h);

      const blob = await c.convertToBlob({ type: 'image/png' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (const b of buf) bin += String.fromCharCode(b);
      return btoa(bin);
    },
    { dados: base64, corte: origem.desenho, alvo: l },
  );

  writeFileSync(`${PASTA}/${l.nome}.png`, Buffer.from(png, 'base64'));
  console.log(`  ${l.nome.padEnd(20)} ${l.largura}×${l.altura}, desenho ocupando ${Math.round(l.ocupa * 100)}%`);
}

await browser.close();
console.log('\nPronto. Isto vai para a BUILD, não para o site: só aparece numa versão nova na Store.');
