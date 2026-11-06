// O Rolê do coelho na tela, com o piloto automático: sobe a página de conferência (vite.config.mjs, porta 5300) antes:
//   npx vite e2e/skate --port 5300
//   node e2e/skate/fotos.mjs            (uns 30 s: confere ollie, grind e pontos, e tira as fotos)
//   COMPLETO=1 node e2e/skate/fotos.mjs (o minuto inteiro, até a tela do fim)
// As fotos vão para e2e/skate/fotos/.
import { chromium } from 'file:///U:/Repos/Janja/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pasta = fileURLToPath(new URL('./fotos/', import.meta.url));
mkdirSync(pasta, { recursive: true });
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pagina = await navegador.newPage({ viewport: { width: 1000, height: 820 } });
const erros = [];
pagina.on('pageerror', (e) => erros.push(String(e)));
pagina.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && erros.push(m.text()));
pagina.on('response', (r) => r.status() >= 400 && !r.url().endsWith('favicon.ico') && erros.push(r.status() + ' ' + r.url()));
await pagina.goto('http://localhost:5300/?piloto');
await pagina.waitForSelector('.skate-tela', { timeout: 30000 });
await pagina.bringToFront();

const visto = { grind: false, manual: false, ar: false, caiu: 0 };
const fotos = new Set();
const ler = () => pagina.evaluate(() => { const k = window.skateSessaoDoTeste; return k && { modo: k.modo, pontos: k.pontos, passo: k.passo, terminou: k.terminou, combo: k.combo.length }; });
const fim = Date.now() + (process.env.COMPLETO ? 80_000 : 32_000);
while (Date.now() < fim) {
  const k = await ler();
  if (k) {
    if (k.modo === 'caido') visto.caiu++;
    for (const m of ['grind', 'manual', 'ar']) {
      if (k.modo === m) {
        visto[m] = true;
        if (!fotos.has(m)) {
          fotos.add(m);
          await pagina.screenshot({ path: pasta + m + '.png' });
        }
      }
    }
    if (k.terminou) break;
  }
  await pagina.waitForTimeout(50);
}
await pagina.screenshot({ path: pasta + 'rodando.png' });
const k = await ler();
console.log('sessão:', k, 'visto:', visto);
if (process.env.COMPLETO) {
  await pagina.waitForSelector('.skate-fim', { timeout: 20000 });
  await pagina.screenshot({ path: pasta + 'fim.png' });
  console.log('fim:', await pagina.textContent('.skate-fim'));
}
if (erros.length) console.log('erros:', erros);
await navegador.close();
if (!visto.grind || !visto.ar || !(k.pontos > 0) || erros.length) {
  console.log('FALHOU');
  process.exit(1);
}
console.log('ok');
