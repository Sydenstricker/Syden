// Roda os três modelos de recorte em todas as imagens, no Chrome, e monta a comparação lado a lado.
//   node e2e/recorte-de-fundo/baixar.mjs   (uma vez)
//   node e2e/recorte-de-fundo/medir.mjs
// Sai em resultados/: comparar.html (abrir no navegador), as figurinhas em PNG e medidas.json.
import { build } from 'esbuild';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../ajuda.mjs';
import { IMAGENS, MODELOS } from './lista.mjs';
import { montar } from './montar.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, 'resultados');
mkdirSync(SAIDA, { recursive: true });

// Os efeitos do passo 1 (o mesmo arquivo do site), para a figurinha sair com o contorno de verdade.
await build({ entryPoints: [join(AQUI, '..', '..', 'web', 'src', 'figurinhaEfeitos.ts')], bundle: true, format: 'esm', outfile: join(AQUI, 'efeitos.js'), logLevel: 'silent' });

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.onnx': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg' };
const servidor = createServer((pedido, resposta) => {
  const caminho = join(AQUI, decodeURIComponent(new URL(pedido.url, 'http://x').pathname));
  if (!caminho.startsWith(AQUI) || !existsSync(caminho) || statSync(caminho).isDirectory()) {
    resposta.writeHead(404).end();
    return;
  }
  // isolamento de origem: sem ele o wasm roda numa thread só
  resposta.writeHead(200, {
    'Content-Type': TIPOS[extname(caminho)] ?? 'application/octet-stream',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
  });
  createReadStream(caminho).pipe(resposta);
});
await new Promise((ok) => servidor.listen(4321, ok));


const { browser } = await abrirNavegador({ argsExtras: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'] });
// Uma página nova para cada modelo e provedor: um erro na placa de vídeo pode deixá-la num estado ruim para o seguinte.
async function novaPagina() {
  const p = await browser.newPage();
  p.on('console', (m) => m.type() === 'error' && !m.text().includes('[W:onnxruntime') && console.log('[página]', m.text().slice(0, 300)));
  await p.goto('http://localhost:4321/pagina.html');
  await p.waitForFunction(() => window.pronto, null, { timeout: 30000 });
  return p;
}
let page = await novaPagina();
const temPlaca = await page.evaluate(async () => !!(navigator.gpu && (await navigator.gpu.requestAdapter())));
console.log('placa de vídeo (WebGPU):', temPlaca ? 'sim' : 'não');
const nucleos = await page.evaluate(() => navigator.hardwareConcurrency);

const medidas = { nucleos, threads: Math.floor(nucleos / 2), temPlaca, modelos: {}, imagens: {} };
const salvar = (nome, url) => writeFileSync(join(SAIDA, nome), Buffer.from(url.split(',')[1], 'base64'));

for (const [arquivo, , recorte] of IMAGENS) {
  const r = await page.evaluate(([a, c]) => window.passo1(a, c), [arquivo, recorte ?? null]);
  salvar(`${arquivo}.passo1.png`, r.url);
  medidas.imagens[arquivo] = { passo1: r.fundo };
}

for (const [id, nome, arquivoDoModelo] of MODELOS) {
  const megas = statSync(join(AQUI, 'modelos', arquivoDoModelo)).size / 1e6;
  medidas.modelos[id] = { nome, megas: Math.round(megas), provedores: {} };
  for (const provedor of temPlaca ? ['webgpu', 'wasm'] : ['wasm']) {
    await page.close();
    page = await novaPagina();
    try {
      const aberto = await page.evaluate(([m, p]) => window.abrirModelo(m, p), [id, provedor]);
      const tempos = [];
      for (const [arquivo, , recorte] of IMAGENS) {
        const r = await page.evaluate(([m, p, a, c]) => window.recortar(m, p, a, c), [id, provedor, arquivo, recorte ?? null]);
        tempos.push(Math.round(r.ms));
        // a figurinha é a mesma nos dois provedores (a menos de arredondamento): guarda a do primeiro que rodou
        if (!Object.values(medidas.modelos[id].provedores).some((p) => !p.erro)) salvar(`${arquivo}.${id}.png`, r.url);
        console.log(`${id} ${provedor} ${arquivo}: ${Math.round(r.ms)} ms`);
      }
      medidas.modelos[id].provedores[provedor] = { abrirMs: Math.round(aberto.ms), tempos, primeiraMs: tempos[0], medianaMs: [...tempos].sort((a, b) => a - b)[tempos.length >> 1] };
    } catch (e) {
      console.log(`${id} ${provedor}: FALHOU`, String(e).slice(0, 300));
      medidas.modelos[id].provedores[provedor] = { erro: String(e).slice(0, 300) };
    }
  }
}
writeFileSync(join(SAIDA, 'medidas.json'), JSON.stringify(medidas, null, 2));

montar(IMAGENS, MODELOS, medidas);

await browser.close();
servidor.close();
console.log('pronto:', join(SAIDA, 'comparar.html'));
