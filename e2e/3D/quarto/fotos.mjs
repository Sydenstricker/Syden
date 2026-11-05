// As fotos do piloto do quarto low poly. Antes: na raiz, `npx vite e2e/3D/quarto --port 5200`. Depois: `node e2e/3D/quarto/fotos.mjs`.
// Tira o quarto de dia e de noite, e o coelho usando a cama, o sofá, a poltrona e a cadeira, em e2e/3D/quarto/fotos/.
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../../ajuda.mjs';

const PASTA = fileURLToPath(new URL('./fotos/', import.meta.url));
const ENDERECO = process.env.ENDERECO ?? 'http://localhost:5200/';

const { browser, contexto } = await abrirNavegador({ viewport: { width: 1100, height: 800 } });
const pagina = await contexto.newPage();
const erros = [];
pagina.on('pageerror', (e) => erros.push(String(e)));
pagina.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && erros.push(m.text()));
pagina.on('response', (r) => r.status() >= 400 && !r.url().endsWith('favicon.ico') && erros.push(`${r.status()} ${r.url()}`));
await pagina.goto(ENDERECO);
await pagina.waitForFunction(() => window.quartoPronto, null, { timeout: 60000 });
await pagina.waitForTimeout(800);
const foto = (nome) => pagina.screenshot({ path: `${PASTA}${nome}.png` });

await foto('dia');
await pagina.evaluate(() => window.noiteDoTeste(true));
await pagina.waitForTimeout(400);
await foto('noite');
await pagina.evaluate(() => window.noiteDoTeste(false));
for (const [id, nome] of process.env.SO_HORA ? [] : [
  ['cama', 'deitado'],
  ['sofa', 'sentado-sofa'],
  ['poltrona', 'sentado-poltrona'],
  ['cadeira', 'no-computador'],
]) {
  await pagina.evaluate((i) => window.usarDoTeste(i), id);
  await pagina.waitForTimeout(6500);
  await foto(nome);
}
await browser.close();
if (erros.length) {
  console.error(erros.join('\n'));
  process.exit(1);
}
console.log('fotos em', PASTA);
