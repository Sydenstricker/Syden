// Prova que o site continua inteiro depois de o Syden sair da raiz e ir para /app/.
//
// POR QUE ISTO EXISTE. Essa mudança de endereço tem um jeito de dar errado que nenhum teste comum
// pega: o app fica na raiz para TODO MUNDO QUE JÁ INSTALOU o programa, inclusive o pacote que está em
// certificação na Microsoft Store. Se a raiz virar a página de apresentação sem desviar o app, cada
// pessoa que abrir o programa instalado cai numa página sem entrada — e o revisor da Microsoft reprova
// por não conseguir avaliar o aplicativo. Ninguém descobre isso olhando o site no navegador, porque no
// navegador está tudo certo.
//
// O outro jeito de dar errado é a política de segurança. Ela usa `script-src 'self'`, e um script
// bloqueado por CSP não dá erro na tela: o desvio simplesmente não acontece. Por isso aqui o site é
// servido COM a política de verdade no cabeçalho, e cada violação é contada.
//
// Roda contra a pasta construída, sem internet e sem mexer em produção:
//
//   npm run build -w web
//   node e2e/site-em-duas-partes.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';
import { CSP } from './politica-de-seguranca.mjs';

const DIST = new URL('../web/dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PORTA = 4321;
const BASE = `http://localhost:${PORTA}`;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.lrc': 'text/plain; charset=utf-8',
};

/**
 * Um servidor que imita o GitHub Pages: serve arquivo estático, completa a pasta com index.html, e põe
 * a MESMA política de segurança que a Cloudflare põe na frente do site publicado.
 */
const servidor = createServer(async (pedido, resposta) => {
  const caminhoPedido = decodeURIComponent(new URL(pedido.url, BASE).pathname);
  let arquivo = join(DIST, normalize(caminhoPedido).replace(/^(\.\.[/\\])+/, ''));
  try {
    if ((await stat(arquivo)).isDirectory()) arquivo = join(arquivo, 'index.html');
  } catch {
    resposta.writeHead(404).end('não achei');
    return;
  }
  try {
    const dados = await readFile(arquivo);
    resposta.writeHead(200, {
      'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream',
      'content-security-policy': CSP,
    });
    resposta.end(dados);
  } catch {
    resposta.writeHead(404).end('não achei');
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
const problemas = [];

/** Abre uma página contando tudo o que a política barrou e todo erro de JavaScript. */
async function abrir({ comoApp = false } = {}) {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  const barrados = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) barrados.push(m.text());
  });
  page.on('pageerror', (e) => barrados.push('erro de JS: ' + e.message));

  if (comoApp) {
    // A ponte do Electron, imitada. É o único sinal que o site usa para saber que está dentro do app.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sydenDesktop', { value: { focus() {} }, configurable: true });
    });
  }
  return { page, contexto, barrados };
}

// ---------------------------------------------------------------------------------------------------
console.log('');

{
  const { page, contexto, barrados } = await abrir();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const titulo = await page.title();
  const h1 = (await page.locator('h1').first().textContent())?.trim() ?? '';
  const abas = await page.locator('.topo nav a').allTextContents();
  const ficou = new URL(page.url()).pathname;

  const ok = ficou === '/' && /Syden/.test(titulo) && h1.length > 10;
  console.log(`  ${ok ? 'OK ' : 'XX '} no navegador, a raiz mostra a apresentação`);
  console.log(`        título: ${titulo}`);
  console.log(`        h1: ${h1}`);
  console.log(`        abas: ${abas.join(' · ')}`);
  if (!ok) problemas.push('a raiz não mostrou a página de apresentação no navegador');
  if (ficou !== '/') problemas.push(`o navegador foi desviado para ${ficou}, e não devia`);
  if (!abas.some((a) => /Contribuir/i.test(a))) problemas.push('a aba de contribuir não está no menu');
  if (barrados.length) problemas.push(`a política barrou algo na apresentação: ${barrados[0]}`);
  await contexto.close();
}

{
  const { page, contexto, barrados } = await abrir({ comoApp: true });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  // O desvio é uma troca de página; esperar a rede parar não serve, porque o app nunca para.
  await page.waitForURL(/\/app\//, { timeout: 15_000 }).catch(() => {});
  const ficou = new URL(page.url()).pathname;

  const ok = ficou.startsWith('/app');
  console.log(`  ${ok ? 'OK ' : 'XX '} o app instalado é desviado da raiz para /app/`);
  console.log(`        parou em: ${ficou}`);
  if (!ok) problemas.push(`o app NÃO foi desviado: parou em ${ficou}. Todo pacote já instalado ficaria sem entrada.`);
  if (barrados.length) problemas.push(`a política barrou o desvio: ${barrados[0]}`);
  await contexto.close();
}

{
  const { page, contexto, barrados } = await abrir();
  await page.goto(BASE + '/app/', { waitUntil: 'load' });
  // O Syden pede a API, que não existe aqui. Basta o React ter montado a tela.
  await page.waitForSelector('#root *', { timeout: 20_000 }).catch(() => {});
  const montou = await page.locator('#root *').count();

  // Violações de CSP que falam da API local são esperadas: não há servidor nenhum neste teste.
  const daPolitica = barrados.filter((b) => !/api\.syden\.chat|live\.syden\.chat|Failed to fetch|NetworkError/i.test(b));
  const ok = montou > 0;
  console.log(`  ${ok ? 'OK ' : 'XX '} /app/ carrega o Syden (${montou} elementos desenhados)`);
  if (!ok) problemas.push('/app/ não desenhou nada: o app não carregou no novo endereço');
  if (daPolitica.length) problemas.push(`a política barrou algo no app: ${daPolitica[0]}`);
  await contexto.close();
}

{
  // As páginas que a Microsoft Store e a política de privacidade apontam NÃO PODEM ter mudado de
  // endereço. Uma delas é o link de privacidade declarado no envio, e um link quebrado ali é reprovação.
  const { page, contexto } = await abrir();
  for (const caminho of ['/privacidade.html', '/termos.html', '/contribuir.html']) {
    const resposta = await page.goto(BASE + caminho, { waitUntil: 'load' });
    const ok = resposta?.status() === 200;
    console.log(`  ${ok ? 'OK ' : 'XX '} ${caminho} continua no mesmo lugar (${resposta?.status()})`);
    if (!ok) problemas.push(`${caminho} sumiu: é um endereço declarado na Microsoft Store`);
  }
  await contexto.close();
}

{
  // O SYDEN NÃO PUBLICA MÚSICA NENHUMA, e isto confere que continua assim.
  //
  // Ver CLAUDE.md: não fazemos música própria, e música de terceiro precisa de licença. Houve uma
  // amostra gerada em web/public/musica/, que dali iria para o site publicado — hoje ela vive em
  // web/test/amostras/, como material de teste. Este teste existe para o dia em que alguém puser um
  // arquivo de áudio em web/public/ sem pensar: publicar música sem licença é o tipo de erro que só
  // aparece quando chega uma notificação.
  const { page, contexto } = await abrir();
  for (const caminho of ['/app/musica/hoje-e-seu-dia.wav', '/app/musica/']) {
    const resposta = await page.goto(BASE + caminho, { waitUntil: 'commit' });
    const ok = resposta?.status() === 404;
    console.log(`  ${ok ? 'OK ' : 'XX '} ${caminho} não está publicado (${resposta?.status()})`);
    if (!ok) problemas.push(`${caminho} está sendo publicado, e não deveria: música precisa de licença`);
  }
  await contexto.close();
}

await browser.close();
servidor.close();

console.log('');
if (problemas.length) {
  console.log('PROBLEMAS:');
  for (const p of problemas) console.log('  - ' + p);
  process.exit(1);
}
console.log('O site está em duas partes e as duas funcionam, com a política de segurança de verdade.');
