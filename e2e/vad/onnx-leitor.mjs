// Um leitor mínimo de arquivo ONNX (o formato protobuf, à mão), só para INSPECIONAR um modelo: quais operações ele usa,
// com que atributos, e os pesos. Serve para ver se um detector de voz cabe no interpretador do site (web/public/ruido/motor.js).
// O arquivo é dado de terceiro: só se lê, nada nele é executado.
//
//   node e2e/vad/onnx-leitor.mjs e2e/vad/modelos/silero_vad_16k_op15.onnx
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function campos(buf, ini = 0, fim = buf.length) {
  const out = [];
  let p = ini;
  const varint = () => { let r = 0n, s = 0n; for (;;) { const b = buf[p++]; r |= BigInt(b & 0x7f) << s; if (!(b & 0x80)) return r; s += 7n; } };
  while (p < fim) {
    const chave = Number(varint()), num = chave >> 3, tipo = chave & 7;
    if (tipo === 0) out.push({ num, v: varint() });
    else if (tipo === 2) { const n = Number(varint()); out.push({ num, ini: p, fim: p + n }); p += n; }
    else if (tipo === 5) { out.push({ num, f32: buf.readFloatLE(p) }); p += 4; }
    else if (tipo === 1) { p += 8; }
    else throw new Error('tipo protobuf ' + tipo);
  }
  return out;
}
const texto = (buf, c) => buf.toString('utf8', c.ini, c.fim);

function tensor(buf, c) {
  const t = { dims: [], tipo: 0, nome: '', dados: null };
  for (const f of campos(buf, c.ini, c.fim)) {
    if (f.num === 1) { if (f.v !== undefined) t.dims.push(Number(f.v)); else for (const d of campos(buf, f.ini, f.fim)) {} }
    else if (f.num === 2) t.tipo = Number(f.v);
    else if (f.num === 8) t.nome = texto(buf, f);
    else if (f.num === 9) t.raw = buf.subarray(f.ini, f.fim);
  }
  // dims empacotados
  return t;
}
function atributo(buf, c) {
  const a = { nome: '' };
  for (const f of campos(buf, c.ini, c.fim)) {
    if (f.num === 1) a.nome = texto(buf, f);
    else if (f.num === 2) a.f = f.f32;
    else if (f.num === 3) a.i = Number(BigInt.asIntN(64, f.v));
    else if (f.num === 4) a.s = texto(buf, f);
    else if (f.num === 5) a.t = tensor(buf, f);
    else if (f.num === 6) a.g = grafo(buf, f);
    else if (f.num === 8) { // ints (empacotado ou não)
      a.ints ??= [];
      if (f.v !== undefined) a.ints.push(Number(BigInt.asIntN(64, f.v)));
      else { let p = f.ini; while (p < f.fim) { let r = 0n, s = 0n; for (;;) { const b = buf[p++]; r |= BigInt(b & 0x7f) << s; if (!(b & 0x80)) break; s += 7n; } a.ints.push(Number(BigInt.asIntN(64, r))); } }
    }
  }
  return a;
}
export function grafo(buf, c) {
  const g = { nos: [], pesos: [], entradas: [], saidas: [] };
  for (const f of campos(buf, c.ini, c.fim)) {
    if (f.num === 1) {
      const no = { ent: [], sai: [], op: '', attr: {} };
      for (const h of campos(buf, f.ini, f.fim)) {
        if (h.num === 1) no.ent.push(texto(buf, h));
        else if (h.num === 2) no.sai.push(texto(buf, h));
        else if (h.num === 4) no.op = texto(buf, h);
        else if (h.num === 5) { const a = atributo(buf, h); no.attr[a.nome] = a; }
      }
      g.nos.push(no);
    } else if (f.num === 5) g.pesos.push(tensor(buf, f));
    else if (f.num === 11 || f.num === 12) {
      let nome = '';
      for (const h of campos(buf, f.ini, f.fim)) if (h.num === 1) nome = texto(buf, h);
      (f.num === 11 ? g.entradas : g.saidas).push(nome);
    }
  }
  return g;
}
export function lerOnnx(arq) {
  const buf = readFileSync(arq);
  const m = { opset: [] };
  for (const f of campos(buf)) {
    if (f.num === 7) m.grafo = grafo(buf, f);
    if (f.num === 8) { let d = '', v = 0; for (const h of campos(buf, f.ini, f.fim)) { if (h.num === 1) d = texto(buf, h); if (h.num === 2) v = Number(h.v); } m.opset.push(`${d || 'ai.onnx'}:${v}`); }
  }
  return m;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const m = lerOnnx(process.argv[2]);
  const ops = new Map();
  const visitar = (g, prof) => {
    for (const no of g.nos) {
      ops.set(no.op, (ops.get(no.op) || 0) + 1);
      for (const a of Object.values(no.attr)) if (a.g) visitar(a.g, prof + 1);
    }
  };
  visitar(m.grafo, 0);
  console.log('opset', m.opset.join(' '), '| entradas', m.grafo.entradas, '| saídas', m.grafo.saidas);
  console.log('operações:', [...ops].map(([k, v]) => `${k}×${v}`).join(', '));
  let n = 0; const tam = (t) => t.dims.reduce((a, b) => a * b, 1);
  const todosPesos = []; const juntar = (g) => { todosPesos.push(...g.pesos); for (const no of g.nos) for (const a of Object.values(no.attr)) { if (a.g) juntar(a.g); if (a.t) todosPesos.push(a.t); } };
  juntar(m.grafo);
  for (const t of todosPesos) if (t.tipo === 1) n += tam(t);
  console.log('pesos float:', n);
  if (process.argv[3] === '-v') {
    const mostrar = (g, ind) => { for (const no of g.nos) {
      const at = Object.values(no.attr).filter((a) => !a.g).map((a) => `${a.nome}=${a.ints ? '[' + a.ints + ']' : a.i ?? a.f ?? a.s ?? (a.t ? 't' + JSON.stringify(a.t.dims) : '?')}`).join(' ');
      console.log(ind + no.op, no.ent.join(','), '->', no.sai.join(','), at);
      for (const a of Object.values(no.attr)) if (a.g) { console.log(ind + '  [' + a.nome + ']'); mostrar(a.g, ind + '    '); }
    } };
    mostrar(m.grafo, '');
    for (const t of m.grafo.pesos) console.log('peso', t.nome, JSON.stringify(t.dims), t.tipo);
  }
}
