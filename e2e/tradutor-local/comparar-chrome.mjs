// As mesmas mensagens pelo Translator do Chrome (o tradutor do navegador), para comparar com o Bergamot.
//   node e2e/tradutor-local/comparar-chrome.mjs   → resultados/chrome.json
// Abre um Chrome com janela: criar o tradutor baixa o modelo e pede um gesto da pessoa (o clique do teste dá o gesto).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const mensagens = JSON.parse(fs.readFileSync(path.join(AQUI, 'mensagens.json'), 'utf8'));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false });
const p = await b.newPage();
await p.goto('https://example.com');
await p.evaluate(() => { document.body.innerHTML = '<button id=b>ok</button>'; });
const resultado = {};
for (const lingua of ['en', 'es', 'ja', 'ar']) {
  await p.evaluate((l) => { window.criado = null; document.getElementById('b').onclick = () => { window.criado = Translator.create({ sourceLanguage: l, targetLanguage: 'pt' }).then((t) => (window.tradutor = t)); }; }, lingua);
  await p.click('#b');
  const t0 = Date.now();
  await p.waitForFunction(() => window.tradutor && window.criado, null, { timeout: 300000 }).catch(() => {});
  const ok = await p.evaluate(async () => { try { await window.criado; return true; } catch (e) { return String(e); } });
  if (ok !== true) { resultado[lingua] = { erro: ok }; console.log(lingua, ok); continue; }
  const carga = Date.now() - t0;
  const linhas = await p.evaluate(async (frases) => {
    const r = [];
    for (const f of frases) { const t = performance.now(); const s = await window.tradutor.translate(f); r.push({ traducao: s, ms: Math.round(performance.now() - t) }); }
    return r;
  }, mensagens[lingua]);
  await p.evaluate(() => { window.tradutor.destroy?.(); window.tradutor = null; });
  const tempos = linhas.map((l) => l.ms).sort((a, b) => a - b);
  resultado[lingua] = { cargaMs: carga, medianaMs: tempos[Math.floor(tempos.length / 2)], linhas };
  console.log(lingua, 'carga', carga, 'ms · mediana', resultado[lingua].medianaMs, 'ms');
}
fs.writeFileSync(path.join(AQUI, 'resultados', 'chrome.json'), JSON.stringify(resultado, null, 1));
await b.close();
