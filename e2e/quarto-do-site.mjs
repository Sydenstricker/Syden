// O quarto do topo da página de apresentação é o menu dela, e responde como o da home do app: o clique
// acerta o DESENHO, não a caixa (pedidos de 10/10/2026).
//
// Para cada objeto, acha pela própria máscara um pixel do desenho e um pixel vazio dentro da caixa: o do
// desenho tem de acender e, clicado, levar à seção do objeto (visível na tela); o vazio não pode acender
// aquele objeto. Nunca há dois acesos ao mesmo tempo. E o abajur troca o dia, o Enter funciona pelo
// teclado, o coelho leva à Customização e o gato só pula.
//
//   npm run build -w web
//   node e2e/quarto-do-site.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { CSP } from './politica-de-seguranca.mjs';

const DIST = new URL('../web/dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const servidor = createServer(async (pedido, resposta) => {
  let caminho = join(DIST, decodeURIComponent(pedido.url.split('?')[0]));
  try {
    if ((await stat(caminho)).isDirectory()) caminho = join(caminho, 'index.html');
    resposta.writeHead(200, { 'content-type': TIPOS[extname(caminho)] ?? 'application/octet-stream', 'content-security-policy': CSP });
    resposta.end(await readFile(caminho));
  } catch {
    resposta.writeHead(404);
    resposta.end();
  }
}).listen(4326);

const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
const erros = [];
p.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
p.on('response', (r) => r.status() >= 400 && erros.push(`${r.status()} ${r.url()}`));
await p.goto('http://localhost:4326/', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);

let falhas = 0;
const marcar = (ok, texto) => {
  console.log((ok ? '  OK  ' : '  XX  ') + texto);
  if (!ok) falhas++;
};
const topo = async () => {
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(150);
};

/** Para cada objeto: um pixel cheio (o mais perto do centro) e um vazio da máscara, em coordenadas de tela. */
const medirPontos = () =>
  p.evaluate(async () => {
    const q = document.getElementById('quarto').getBoundingClientRect();
    const fora = [];
    for (const el of document.querySelectorAll('#quarto .obj[data-caixa]')) {
      const nome = el.dataset.mascara ? `quarto/${el.dataset.mascara}.png` : `quarto/mascara-${el.className.match(/obj-([\w-]+)/)[1]}.png`;
      const [x0, y0] = el.dataset.caixa.split(',').map(Number);
      const im = new Image();
      im.src = nome;
      await im.decode();
      const c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      const a = g.getImageData(0, 0, im.width, im.height).data;
      let cheio = null;
      let vazio = null;
      let melhor = 1e9;
      const cx = im.width / 2;
      const cy = im.height / 2;
      for (let y = 0; y < im.height; y++)
        for (let x = 0; x < im.width; x++) {
          const opaco = a[(y * im.width + x) * 4 + 3];
          const d = (x - cx) ** 2 + (y - cy) ** 2;
          if (opaco && d < melhor) {
            melhor = d;
            cheio = [x, y];
          }
          if (!opaco && !vazio) vazio = [x, y];
        }
      const tela = ([x, y]) => [q.left + ((x0 + x + 0.5) / 313) * q.width, q.top + ((y0 + y + 0.5) / 314) * q.height];
      fora.push({ nome: el.getAttribute('aria-label'), classe: el.className, href: el.getAttribute('href'), cheio: tela(cheio), vazio: vazio && tela(vazio) });
    }
    return fora;
  });

const acesos = () => p.evaluate(() => [...document.querySelectorAll('#quarto .aceso')].map((e) => e.getAttribute('aria-label')));

for (const o of await medirPontos()) {
  await topo();
  await p.mouse.move(...o.cheio);
  const agora = await acesos();
  marcar(agora.length === 1 && agora[0] === o.nome, `${o.nome}: o desenho acende, e só ele (acesos: ${agora.join(', ') || 'nenhum'})`);
  if (o.vazio) {
    await p.mouse.move(...o.vazio);
    const depois = await acesos();
    marcar(!depois.includes(o.nome) && depois.length <= 1, `${o.nome}: o vazio da caixa não o acende`);
  }
  if (o.href && !o.href.startsWith('#')) {
    // Link para outra página (o vaso): o clique navega até ela, e volta-se à inicial para seguir.
    await p.mouse.click(...o.cheio);
    await p.waitForURL('**/' + o.href);
    marcar(true, `${o.nome}: o clique leva a ${o.href}`);
    await p.goto('http://localhost:4326/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
  } else if (o.href) {
    await p.mouse.click(...o.cheio);
    await p.waitForTimeout(900);
    const chegada = await p.evaluate((href) => {
      const alvo = document.querySelector(href);
      const r = alvo?.getBoundingClientRect();
      return { hash: location.hash, visivel: Boolean(r && r.top < innerHeight && r.bottom > 0) };
    }, o.href);
    marcar(chegada.hash === o.href && chegada.visivel, `${o.nome}: o clique leva a ${o.href} (${chegada.hash}, ${chegada.visivel ? 'na tela' : 'fora da tela'})`);
  }
}

await topo();
const pontos = await medirPontos();
const abajur = pontos.find((o) => o.classe.includes('obj-abajur'));
await p.mouse.click(...abajur.cheio);
marcar(await p.evaluate(() => document.getElementById('quarto').classList.contains('de-dia')), 'abajur: acende o dia');

await p.focus('.obj-poster');
await p.keyboard.press('Enter');
await p.waitForTimeout(900);
marcar((await p.evaluate(() => location.hash)) === '#amigos', 'teclado: Enter no pôster leva a Amigos');

await topo();
const gato = await p.evaluate(() => {
  const q = document.getElementById('quarto').getBoundingClientRect();
  return [q.left + (150 / 313) * q.width, q.top + (134 / 314) * q.height];
});
const antes = await p.evaluate(() => location.hash);
await p.mouse.click(...gato);
await p.waitForTimeout(80);
marcar(await p.evaluate(() => document.querySelector('.quarto-vivo.gato').classList.contains('cutucado')), 'gato: pula quando cutucado');
marcar((await p.evaluate(() => location.hash)) === antes, 'gato: não leva a lugar nenhum');

console.log('erros no console:', erros.length ? erros : 'nenhum', '| falhas:', falhas);
await navegador.close();
servidor.close();
if (falhas || erros.length) process.exitCode = 1;
