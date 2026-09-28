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
  /**
   * O DESVIO PRECISA CHEGAR RÁPIDO A QUEM JÁ VISITOU O SITE.
   *
   * Ele é servido com quatro horas de cache no navegador, e o nome do arquivo não muda — então uma
   * correção nele demorava quatro horas para valer para quem tinha acabado de visitar. Aconteceu de
   * verdade: o conserto da volta do Google estava publicado e continuava sem funcionar, porque o
   * navegador seguia usando o script antigo. A impressão digital no endereço (ver montar-site.mjs) faz
   * arquivo novo virar endereço novo, e quem manda passa a ser o HTML, que vive dez minutos.
   */
  const { page, contexto } = await abrir();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const endereco = await page.evaluate(() => document.querySelector('script[src*="desviar"]')?.getAttribute('src') ?? '');
  const ok = /\?v=[0-9a-f]{8}$/.test(endereco);
  console.log(`  ${ok ? 'OK ' : 'XX '} o desvio tem impressão digital, e não fica preso no cache`);
  console.log(`        ${endereco}`);
  if (!ok) problemas.push(`o desvio é carregado como "${endereco}": uma correção nele levaria horas para chegar`);
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
  /**
   * QUEM CHEGA À RAIZ COM UM CÓDIGO NA MÃO PRECISA SER LEVADO AO SYDEN.
   *
   * Quatro endereços do Syden mandavam a pessoa para a raiz, porque a raiz ERA o Syden: a volta da
   * entrada social, o link de confirmação de e-mail, o de recuperação de senha e o convite. Depois da
   * mudança, todos passaram a cair na página de apresentação, que não faz nada com eles — e o sintoma é
   * o pior possível: o site abre bonito, e simplesmente não acontece nada. Nenhum erro, em lugar nenhum.
   *
   * A busca inteira tem de chegar do outro lado. Perder o `comprovante` no caminho é o mesmo que não
   * desviar: o Syden abre e não tem o que concluir.
   */
  const { page, contexto, barrados } = await abrir();
  const visitados = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visitados.push(frame.url());
  });

  for (const busca of ['?entrada=ok&comprovante=abc123', '?confirmar=xyz', '?recuperar=xyz', '?convite=xyz']) {
    visitados.length = 0;
    await page.goto(BASE + '/' + busca, { waitUntil: 'load' });
    await page.waitForURL(/\/app\//, { timeout: 10_000 }).catch(() => {});

    // Olhar o endereço FINAL não serve: o Syden limpa a barra assim que lê o código (senão, recarregar
    // gastaria de novo um comprovante já usado). O que interessa é se ele CHEGOU lá com a busca inteira.
    const chegouInteiro = visitados.some((endereco) => {
      const url = new URL(endereco);
      return url.pathname.startsWith('/app') && url.search === busca;
    });
    console.log(`  ${chegouInteiro ? 'OK ' : 'XX '} a raiz leva ${busca} para /app/ sem perder nada`);
    if (!chegouInteiro) {
      problemas.push(`${busca} não chegou inteiro a /app/ (passou por: ${visitados.join(' → ') || 'nada'})`);
    }
  }
  if (barrados.length) problemas.push(`a política barrou o reencaminhamento: ${barrados[0]}`);
  await contexto.close();
}

{
  /**
   * A PÁGINA QUE DEVOLVE A PESSOA AO APLICATIVO, nos dois endereços em que ela precisa existir.
   *
   * Ela é apontada pelo servidor a partir do SITE_URL dele, que pode estar na raiz ou em /app — e um 404
   * aqui não é uma página quebrada qualquer: é ninguém conseguindo entrar no app de desktop por Google,
   * Discord, GitHub ou Steam.
   *
   * O href do link é o melhor detector que existe para esta página: no HTML ele é `syden://entrada`
   * pelado, e quem lhe acrescenta a busca é o script. Se a política de segurança bloquear o script — o
   * jeito silencioso de esta página falhar —, o endereço fica sem o comprovante, e é isso que se mede.
   */
  const { page, contexto, barrados } = await abrir();
  const BUSCA = '?entrada=ok&comprovante=abc123';
  for (const caminho of ['/voltar-para-o-app.html', '/app/voltar-para-o-app.html']) {
    // 'domcontentloaded', e não 'load': a página tenta abrir o aplicativo sozinha logo depois de
    // carregar, e num navegador sem o Syden instalado (como este) essa tentativa fica pendurada. Esperar
    // o 'load' aqui seria esperar por um navegador que nunca vai responder.
    const resposta = await page.goto(BASE + caminho + BUSCA, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const href = await page.locator('#abrir').getAttribute('href');
    const texto = (await page.locator('#titulo').textContent())?.trim() ?? '';

    const ok = resposta?.status() === 200 && href === 'syden://entrada' + BUSCA && texto.length > 0;
    console.log(`  ${ok ? 'OK ' : 'XX '} ${caminho} devolve ao app com o comprovante`);
    console.log(`        link: ${href}`);
    if (resposta?.status() !== 200) problemas.push(`${caminho} não existe (${resposta?.status()}): o app de desktop ficaria sem volta`);
    else if (href !== 'syden://entrada' + BUSCA) problemas.push(`${caminho}: o link ficou "${href}" — o script não montou o endereço`);
  }
  if (barrados.length) problemas.push(`a política barrou algo na página de volta: ${barrados[0]}`);
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
