// Os ícones do pacote da Microsoft Store, gerados do ícone do Syden.
//
// POR QUE ISTO PRECISOU EXISTIR. O Syden foi publicado na Store mostrando o logo do ELECTRON, e a causa
// é silenciosa: o electron-builder procura os ícones do pacote numa pasta `build/appx/`, e quando ela
// não existe ele usa os dele — que são os de exemplo, com a marca do Electron. Nada falha, nada avisa,
// e o pacote sai assinado e válido com a identidade visual errada.
//
// POR QUE O NAVEGADOR DESENHA, e não uma biblioteca de imagem: o projeto não tem nenhuma, e é o mesmo
// caminho de scripts/arte-da-loja.mjs e de reenquadrar-icone.mjs. Acrescentar uma dependência para
// redimensionar quatro PNGs seria uma dependência para sempre por um trabalho de um minuto.
//
//   node desktop/scripts/icones-da-loja.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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


const ORIGEM = caminho('desktop/build/icon.png');
const DESTINO = caminho('desktop/build/appx');

/**
 * Os quatro que o electron-builder exige, mais dois que ele usa quando existem.
 *
 * `margem` é a fração da imagem que fica de folga em volta. As lajotas grandes do menu Iniciar precisam
 * dela — a Microsoft desenha o fundo colorido e o logo tem de respirar dentro dele. O ícone de 44px é o
 * da barra de tarefas, e ali folga é desperdício: ele já é minúsculo.
 */
const TAMANHOS = [
  { arquivo: 'StoreLogo.png', largura: 50, altura: 50, margem: 0.06 },
  { arquivo: 'Square44x44Logo.png', largura: 44, altura: 44, margem: 0 },
  { arquivo: 'Square71x71Logo.png', largura: 71, altura: 71, margem: 0.08 },
  { arquivo: 'Square150x150Logo.png', largura: 150, altura: 150, margem: 0.16 },
  { arquivo: 'Square310x310Logo.png', largura: 310, altura: 310, margem: 0.2 },
  { arquivo: 'Wide310x150Logo.png', largura: 310, altura: 150, margem: 0.14 },
];

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)[0];

const base64 = readFileSync(ORIGEM).toString('base64');

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage();

const feitos = await page.evaluate(
  async ({ base64, tamanhos }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + base64;
    await img.decode();

    return tamanhos.map(({ arquivo, largura, altura, margem }) => {
      const tela = document.createElement('canvas');
      tela.width = largura;
      tela.height = altura;
      const ctx = tela.getContext('2d');

      // FUNDO TRANSPARENTE, e não branco. A Microsoft pinta o fundo da lajota com a cor que o app
      // declara; um quadrado branco por baixo apareceria como uma moldura em volta do desenho.
      ctx.clearRect(0, 0, largura, altura);

      // O desenho entra inteiro, centralizado, sem distorcer: o lado menor manda. A lajota larga
      // (310x150) é a que mais precisa disso — esticar o coelho nela ficaria grotesco.
      const util = Math.min(largura, altura) * (1 - margem * 2);
      const escala = util / Math.max(img.width, img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      ctx.drawImage(img, (largura - w) / 2, (altura - h) / 2, w, h);

      return { arquivo, dados: tela.toDataURL('image/png').split(',')[1] };
    });
  },
  { base64, tamanhos: TAMANHOS },
);

mkdirSync(DESTINO, { recursive: true });
for (const { arquivo, dados } of feitos) {
  const bytes = Buffer.from(dados, 'base64');
  writeFileSync(join(DESTINO, arquivo), bytes);
  console.log(`  ${arquivo.padEnd(24)} ${String(bytes.length).padStart(6)} bytes`);
}

await browser.close();

console.log('');
console.log(`${feitos.length} ícones em ${DESTINO}/`);
console.log('O electron-builder acha esta pasta sozinho. Sem ela, ele usa os de exemplo — com o logo do Electron.');
