// QUANTA MEMÓRIA O QUARTO E O SALÃO SEGURAM, E ONDE (13/11/2026, pergunta dele: "precisamos de tanta RAM assim?").
//
// Abre o app de desenvolvimento, entra no quarto (ou no salão) e, DENTRO da página da cena, anota cada buffer grande
// (256 KB ou mais: os typed arrays criados e os getImageData) com o lugar do código que o criou. Depois da cena pronta e de
// recolher o lixo, mostra o que continua VIVO, somado por lugar, e a memória do processo da página pelo Windows.
//
//   node e2e/pixel-art/memoria-das-cenas.mjs [quarto|salao]   (API de teste na 3099 e site na 5174)
import { execSync } from 'node:child_process';
import { abrirNavegador, cadastrar, dispensarPresentes } from '../ajuda.mjs';

const CENA = process.argv[2] === 'salao' ? 'salao' : 'quarto';
const s = Date.now().toString().slice(-5);
const { browser } = await abrirNavegador({ argsExtras: ['--js-flags=--expose-gc'] });

// o processo da página (renderer) do Chrome do teste, pelo Windows: a memória privada, em MB
function memoriaDosRenderers() {
  const saida = execSync(
    `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | Where-Object { $_.CommandLine -like '*playwright*' -and $_.CommandLine -like '*--type=renderer*' } | ForEach-Object { $_.ProcessId.ToString() + ' ' + $_.PrivatePageCount }"`,
  ).toString();
  return saida.trim().split(/\r?\n/).filter(Boolean).map((l) => { const [pid, b] = l.split(' '); return { pid, mb: Math.round(Number(b) / 1048576) }; });
}
const gpu = () => {
  const saida = execSync(
    `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | Where-Object { $_.CommandLine -like '*playwright*' -and $_.CommandLine -like '*--type=gpu-process*' } | ForEach-Object { $_.PrivatePageCount }"`,
  ).toString();
  return Math.round(Number(saida.trim() || 0) / 1048576);
};

try {
  const contexto = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  // sem guarda (4 GB), para medir cada cena sozinha
  await contexto.addInitScript(() => {
    Error.stackTraceLimit = 30;
    try { Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 4 }); } catch (e) { self.erroDoInit = String(e); }
    const vivos = new Map();
    const registro = new FinalizationRegistry(([lugar, bytes]) => {
      const v = vivos.get(lugar); v.bytes -= bytes; v.n--;
    });
    const lugarAgora = () => {
      // o lugar e quem o chamou (os ajudantes como dados() são chamados de muitos lugares)
      const linhas = new Error().stack.split('\n').filter((x) => x.includes('localhost')).slice(0, 2);
      return linhas.map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+/, '').replace(/\?[^:)]*/, '').replace(/\/app\/[^ ]*\//, '')).join('  ←  ') || '?';
    };
    const anotar = (o, bytes) => {
      if (bytes < 262144) return;
      const lugar = lugarAgora();
      const v = vivos.get(lugar) ?? { bytes: 0, n: 0, criados: 0 };
      v.bytes += bytes; v.n++; v.criados++; vivos.set(lugar, v);
      registro.register(o, [lugar, bytes]);
    };
    for (const nome of ['Uint8Array', 'Uint8ClampedArray', 'Int8Array', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array']) {
      const Orig = self[nome];
      self[nome] = new Proxy(Orig, {
        construct(t, args, nt) {
          const o = Reflect.construct(t, args, nt);
          if (!(args[0] instanceof ArrayBuffer)) anotar(o, o.byteLength);
          return o;
        },
      });
    }
    const gid = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...a) { const d = gid.apply(this, a); anotar(d.data, d.data.byteLength); return d; };
    if (self.OffscreenCanvasRenderingContext2D) {
      const gio = OffscreenCanvasRenderingContext2D.prototype.getImageData;
      OffscreenCanvasRenderingContext2D.prototype.getImageData = function (...a) { const d = gio.apply(this, a); anotar(d.data, d.data.byteLength); return d; };
    }
    // as imagens decodificadas (ImageBitmap): o tamanho, somado (não são lixo recolhível como os buffers)
    let bitmaps = 0, nBitmaps = 0;
    const cib = self.createImageBitmap;
    self.createImageBitmap = (...a) => cib(...a).then((b) => { bitmaps += b.width * b.height * 4; nBitmaps++; return b; });
    self.memoriaDoTeste = () => ({
      lugares: [...vivos].map(([lugar, v]) => ({ lugar, mb: v.bytes / 1048576, vivos: v.n, criados: v.criados })).filter((x) => x.vivos > 0).sort((a, b) => b.mb - a.mb),
      bitmapsMb: bitmaps / 1048576, nBitmaps,
      heapMb: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
    });
  });
  const p = await contexto.newPage();
  await cadastrar(p, 'memoria' + s);
  await dispensarPresentes(p);
  const antes = memoriaDosRenderers(), gpuAntes = gpu();
  let frame;
  if (CENA === 'quarto') {
    await p.locator('.rail-logo').click();
    frame = await (await p.waitForSelector('.quarto-novo-caixa:not(.salao-novo) iframe', { timeout: 30000 })).contentFrame();
  } else {
    await p.locator('.rail-item:not(.rail-action)').first().click();
    await p.locator('.channel.inicio-link').click({ timeout: 15000 });
    frame = await (await p.waitForSelector('.salao-novo iframe', { timeout: 30000 })).contentFrame();
  }
  await frame.waitForFunction(() => typeof window.visitaDoTeste === 'function', null, { timeout: 90000 });
  console.log('página da cena:', frame.url(), await frame.evaluate(() => typeof window.memoriaDoTeste));
  await p.waitForTimeout(6000);
  for (let i = 0; i < 4; i++) { await frame.evaluate(() => window.gc && window.gc()); await p.waitForTimeout(500); }
  const m = await frame.evaluate(() => window.memoriaDoTeste());
  const depois = memoriaDosRenderers(), gpuDepois = gpu();
  const total = m.lugares.reduce((a, x) => a + x.mb, 0);
  console.log(`\n${CENA.toUpperCase()}: buffers grandes vivos ${total.toFixed(0)} MB; imagens decodificadas ${m.bitmapsMb.toFixed(0)} MB (${m.nBitmaps}); heap do JS ${m.heapMb?.toFixed(0)} MB`);
  console.log('renderers antes:', JSON.stringify(antes), ' depois:', JSON.stringify(depois), ` | GPU ${gpuAntes} → ${gpuDepois} MB`);
  console.log('\n   MB  vivos/criados  lugar');
  for (const x of m.lugares.slice(0, 30)) console.log(x.mb.toFixed(1).padStart(6), String(x.vivos).padStart(5) + '/' + String(x.criados).padEnd(6), x.lugar);
} finally {
  await browser.close();
}
