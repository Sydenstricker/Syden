// Prova a tela de abertura: aparece antes do JavaScript e some quando o Syden monta.
//
// AS DUAS FALHAS POSSÍVEIS SÃO SILENCIOSAS E OPOSTAS, e é por isso que isto é medido em vez de olhado:
//
//   1. Ela não aparecer — e aí volta o retângulo branco de sempre, que ninguém nota porque em internet
//      boa dura um piscar. O problema só existe para quem tem internet ruim, que é justamente quem não
//      vai reclamar.
//   2. Ela não SUMIR — e aí fica um coelho por cima do Syden inteiro para sempre. Isso quebraria o app
//      de um jeito óbvio, mas depende de um seletor de CSS (#root:not(:empty)) que nada avisa se parar
//      de casar: basta alguém pôr um espaço dentro do #root no HTML.
//
// A página é servida por um servidor local com atraso proposital no JavaScript, para que exista um
// momento em que o HTML já chegou e o app ainda não — que é o momento inteiro da questão.
//
//   npm run build -w web
//   node e2e/abertura.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';
import { CSP } from './politica-de-seguranca.mjs';

const DIST = new URL('../web/dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PORTA = 4323;
const BASE = `http://localhost:${PORTA}`;
/** O atraso que cria a janela de tempo a ser medida. É o que uma internet ruim faz de graça. */
const ATRASO_DO_JS_MS = 1500;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

const servidor = createServer(async (pedido, resposta) => {
  const caminho = decodeURIComponent(new URL(pedido.url, BASE).pathname);
  let arquivo = join(DIST, normalize(caminho).replace(/^(\.\.[/\\])+/, ''));
  try {
    if ((await stat(arquivo)).isDirectory()) arquivo = join(arquivo, 'index.html');
  } catch {
    resposta.writeHead(404).end();
    return;
  }
  // Só o pacote do app é atrasado. Atrasar tudo atrasaria também o HTML, e aí não haveria janela.
  if (arquivo.endsWith('.js') && arquivo.includes('assets')) {
    await new Promise((r) => setTimeout(r, ATRASO_DO_JS_MS));
  }
  try {
    const dados = await readFile(arquivo);
    resposta.writeHead(200, {
      'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream',
      'content-security-policy': CSP,
    });
    resposta.end(dados);
  } catch {
    resposta.writeHead(404).end();
  }
});

await new Promise((pronto) => servidor.listen(PORTA, pronto));

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)[0];

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const barrados = [];
page.on('console', (m) => {
  if (/Content Security Policy|Refused to/i.test(m.text())) barrados.push(m.text());
});

const problemas = [];
const checa = (ok, texto, detalhe = '') => {
  console.log(`  ${ok ? 'OK ' : 'XX '} ${texto}${detalhe ? '   ' + detalhe : ''}`);
  if (!ok) problemas.push(texto);
};

console.log('');
// 'commit' e não 'load': o objetivo é olhar a página ANTES de o pacote chegar.
await page.goto(BASE + '/app/', { waitUntil: 'commit' });
await page.waitForTimeout(400);

const antes = await page.evaluate(() => {
  const abertura = document.getElementById('abertura');
  const raiz = document.getElementById('root');
  const caixa = abertura?.getBoundingClientRect();
  return {
    existe: Boolean(abertura),
    visivel: abertura ? getComputedStyle(abertura).display !== 'none' : false,
    formas: abertura?.querySelectorAll('path, circle').length ?? 0,
    animadas: abertura ? [...abertura.querySelectorAll('*')].filter((e) => e.getAnimations?.().length).length : 0,
    largura: Math.round(caixa?.width ?? 0),
    fundo: getComputedStyle(document.body).backgroundColor,
    appMontado: (raiz?.childElementCount ?? 0) > 0,
    // Texto na tela de abertura contraria a regra do CLAUDE.md: aqui não há como traduzir.
    texto: (abertura?.textContent ?? '').trim(),
  };
});

checa(!antes.appMontado, 'o pacote ainda não chegou — é a janela de tempo que interessa');
checa(antes.existe && antes.visivel, 'a abertura está na tela antes do JavaScript');
checa(antes.formas >= 5, 'o coelho foi desenhado', antes.formas + ' formas');
checa(antes.animadas >= 2, 'e está animado', antes.animadas + ' animadas');
checa(antes.largura > 100, 'com tamanho de verdade', antes.largura + 'px');
checa(antes.fundo === 'rgb(49, 51, 56)', 'o fundo já é escuro, sem clarão branco', antes.fundo);
checa(antes.texto === '', 'sem texto, porque aqui não há como traduzir', JSON.stringify(antes.texto));

// O React monta antes de a sessão ser conferida. A abertura NÃO pode sair aí: sairia para dar lugar a
// uma tela vazia esperando o servidor — que foi exatamente o defeito da primeira versão, que usava um
// seletor de CSS disparado pela montagem.
await page.waitForSelector('#root *', { timeout: 20_000 }).catch(() => {});
const montouEm = await page.evaluate(() => performance.now());
const aindaNaTela = await page.evaluate(() => Boolean(document.getElementById('abertura')));
checa(aindaNaTela, 'a abertura continua na tela depois de o React montar', Math.round(montouEm) + 'ms');

// Espera ela sair sozinha, e mede QUANDO.
const saiuEm = await page.evaluate(
  () =>
    new Promise((pronto) => {
      const olhar = () => {
        if (!document.getElementById('abertura')) return pronto(performance.now());
        setTimeout(olhar, 30);
      };
      olhar();
    }),
);

const depois = await page.evaluate(() => ({
  appMontado: (document.getElementById('root')?.childElementCount ?? 0) > 0,
  aindaTem: Boolean(document.getElementById('abertura')),
}));

checa(depois.appMontado, 'o Syden montou');
checa(!depois.aindaTem, 'e a abertura saiu de cena');
// O PISO DE DOIS SEGUNDOS é a razão de este teste existir na forma atual. Sem ele, em internet boa a
// abertura vira um piscar que ninguém identifica — e um borrão de meio segundo passa impressão de
// falha, não de identidade. O desconto de 100ms é folga de relógio, não de regra.
checa(saiuEm >= 2000 - 100, 'ficou pelo menos dois segundos na tela', Math.round(saiuEm) + 'ms');
checa(barrados.length === 0, 'a política de segurança não barrou nada', barrados[0] ?? '');

await browser.close();
servidor.close();

console.log('');
if (problemas.length) {
  console.log('PROBLEMAS:');
  for (const p of problemas) console.log('  - ' + p);
  process.exit(1);
}
console.log('A abertura aparece no primeiro quadro e sai de cena quando o Syden chega.');
