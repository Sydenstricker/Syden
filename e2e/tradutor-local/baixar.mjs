// Baixa o wasm do Bergamot (o mesmo que o Firefox usa) e os modelos dos pares pedidos, da distribuição pública
// do Firefox (Remote Settings). Escolhe, para cada par, a versão mais nova entregue ao Firefox de computador.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const RS = 'https://firefox.settings.services.mozilla.com/v1/buckets/main/collections';
const ANEXOS = 'https://firefox-settings-attachments.cdn.mozilla.net/';
const PARES = process.argv.slice(2).length ? process.argv.slice(2) : ['en-pt', 'es-en', 'ja-en', 'ar-en', 'ko-en', 'zh-Hans-en'];
const DESKTOP = new Set(['', "env.appinfo.OS != 'Android' || env.channel != 'release'", ...(process.env.ANDROID ? ["env.appinfo.OS == 'Android' "] : [])]);
const versao = (v) => v.split(/[.a]/).map(Number);
const maisNova = (a, b) => { const x = versao(a.version), y = versao(b.version); for (let i = 0; i < 4; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0); return false; };
const estavel = (r) => !/a/.test(r.version);

async function baixar(registro, destino) {
  if (fs.existsSync(destino) && crypto.createHash('sha256').update(fs.readFileSync(destino)).digest('hex') === registro.attachment.hash) return;
  const r = await fetch(ANEXOS + registro.attachment.location);
  if (!r.ok) throw new Error(registro.name + ': ' + r.status);
  const b = Buffer.from(await r.arrayBuffer());
  if (crypto.createHash('sha256').update(b).digest('hex') !== registro.attachment.hash) throw new Error(registro.name + ': hash não confere');
  fs.writeFileSync(destino, b);
}

const pasta = path.join(AQUI, 'modelos');
fs.mkdirSync(pasta, { recursive: true });
const wasm = (await (await fetch(RS + '/translations-wasm/records')).json()).data.filter((r) => r.name === 'bergamot-translator').reduce((a, b) => (maisNova(b, a) ? b : a));
await baixar(wasm, path.join(pasta, 'bergamot-translator.wasm'));
console.log('wasm', wasm.version, (wasm.attachment.size / 1e6).toFixed(1), 'MB');

const todos = (await (await fetch(RS + '/translations-models/records')).json()).data.filter((r) => DESKTOP.has(r.filter_expression ?? '') && estavel(r));
const manifesto = {};
for (const par of PARES) {
  const i = par.lastIndexOf('-'), de = par.slice(0, i), para = par.slice(i + 1);
  const doPar = todos.filter((r) => r.fromLang === de && r.toLang === para);
  if (!doPar.length) { console.log(par, 'NÃO EXISTE'); continue; }
  const topo = doPar.reduce((a, b) => (maisNova(b, a) ? b : a)).version;
  const arquivos = {};
  let bytes = 0;
  for (const r of doPar.filter((r) => r.version === topo)) {
    const destino = path.join(pasta, `${par}${process.env.ANDROID ? '-android' : ''}.${r.fileType}`);
    await baixar(r, destino);
    arquivos[r.fileType] = { arquivo: path.basename(destino), nome: r.name };
    bytes += r.attachment.size;
  }
  manifesto[par + (process.env.ANDROID ? '-android' : '')] = { versao: topo, bytes, arquivos };
  console.log(par, topo, Object.keys(arquivos).join('+'), (bytes / 1e6).toFixed(1), 'MB');
}
const antigo = fs.existsSync(path.join(pasta, 'manifesto.json')) ? JSON.parse(fs.readFileSync(path.join(pasta, 'manifesto.json'), 'utf8')) : {};
fs.writeFileSync(path.join(pasta, 'manifesto.json'), JSON.stringify({ ...antigo, ...manifesto }, null, 1));
