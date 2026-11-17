// A MEDIDA DO FUNDO DA CÂMERA (ver README.md): cada candidato rodando pelo onnxruntime-node, como rodaria no processo à
// parte do app (o mesmo caminho do ruído e do recorte das figurinhas), sobre as fotos reduzidas ao quadro de uma webcam
// (640 × 360). Mede o tempo por quadro com 1, 2 e 4 núcleos e na placa (DirectML), e monta resultados/comparar.html com a
// pessoa sobre o fundo apagado, o desfocado e uma imagem, para julgar o contorno a olho.
//   node e2e/fundo-da-camera/baixar.mjs && node e2e/fundo-da-camera/medir.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { filtroGuiado } from './guiado.mjs';
import { FOTOS, MODELOS } from './lista.mjs';
import { ampliar, qualidadeDaBorda } from './qualidade.mjs';
import { realcar } from './realce.mjs';

const require = createRequire(import.meta.url);
const ort = require('onnxruntime-node');
const AQUI = dirname(fileURLToPath(import.meta.url));
const RES = join(AQUI, 'resultados');
mkdirSync(RES, { recursive: true });
const L = 640, A = 360; // o quadro da câmera
const RODADAS = Number(process.env.RODADAS ?? 40);
const so = process.env.SO?.split(',');
// SAIDA=nome escreve resultados/<nome>.html e <nome>-tempos.json, sem apagar o comparar.html de antes
const SAIDA = process.env.SAIDA ?? 'comparar';

// ---- as fotos, reduzidas a 640 × 360 pelo Chrome (corte no meio, como a câmera em 16:9) ----
const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const pagina = await navegador.newPage();
await pagina.setContent('<html><body></body></html>');
const quadros = [];
for (const f of FOTOS) {
  const url = 'data:image/jpeg;base64,' + readFileSync(join(AQUI, 'fotos', f.arquivo)).toString('base64');
  const b64 = await pagina.evaluate(
    async ({ url, L, A, escura }) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = new OffscreenCanvas(L, A), g = c.getContext('2d');
      const esc = Math.max(L / img.naturalWidth, A / img.naturalHeight);
      const w = img.naturalWidth * esc, h = img.naturalHeight * esc;
      g.drawImage(img, (L - w) / 2, (A - h) / 2 * 0.6, w, h); // um pouco acima do meio: o rosto costuma estar no alto
      if (escura) {
        // um quarto à noite: pouca luz e o ruído do sensor
        const d = g.getImageData(0, 0, L, A);
        for (let i = 0; i < d.data.length; i += 4)
          for (let k = 0; k < 3; k++) d.data[i + k] = Math.max(0, Math.min(255, Math.pow(d.data[i + k] / 255, 1.8) * 90 + (Math.random() - 0.5) * 14));
        g.putImageData(d, 0, 0);
      }
      const px = g.getImageData(0, 0, L, A).data;
      let s = '';
      for (let i = 0; i < px.length; i += 8192) s += String.fromCharCode(...px.subarray(i, i + 8192));
      return btoa(s);
    },
    { url, L, A, escura: !!f.escura },
  );
  quadros.push({ ...f, rgba: new Uint8Array(Buffer.from(b64, 'base64')) });
}

// ---- pré e pós de cada modelo ----
const IMAGENET = [[0.485, 0.229], [0.456, 0.224], [0.406, 0.225]];
function entrada(m, rgba, deslocar = 0) {
  rgba = realcar(rgba, L, A, 4, m.realce);
  const [w, h] = m.entrada;
  const t = new Float32Array(3 * w * h);
  const nhwc = m.saida === 'multiclasse';
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // amostra bilinear do quadro (o "deslocar" é a câmera tremendo uns pixels: a medida de estabilidade)
      const fx = Math.min(L - 1.001, Math.max(0, ((x + 0.5) * L) / w - 0.5 + deslocar)), fy = Math.min(A - 1.001, Math.max(0, ((y + 0.5) * A) / h - 0.5));
      const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
      for (let k = 0; k < 3; k++) {
        const p = (yy, xx) => rgba[(yy * L + xx) * 4 + k];
        let v = (p(y0, x0) * (1 - ax) + p(y0, x0 + 1) * ax) * (1 - ay) + (p(y0 + 1, x0) * (1 - ax) + p(y0 + 1, x0 + 1) * ax) * ay;
        v /= 255;
        if (m.normal === 'menos-um-um') v = (v - 0.5) / 0.5;
        else if (m.normal === 'imagenet') v = (v - IMAGENET[k][0]) / IMAGENET[k][1];
        t[nhwc ? (y * w + x) * 3 + k : k * w * h + y * w + x] = v;
      }
    }
  return new ort.Tensor('float32', t, nhwc ? [1, h, w, 3] : [1, 3, h, w]);
}

/** A probabilidade de "pessoa" em cada ponto da saída, w × h, de 0 a 1. */
function mascara(m, saida) {
  const [w, h] = m.entrada, n = w * h, d = saida.data;
  const r = new Float32Array(n);
  if (m.saida === 'unica') for (let i = 0; i < n; i++) r[i] = d[i];
  else if (m.saida === 'sigmoide') for (let i = 0; i < n; i++) r[i] = 1 / (1 + Math.exp(-d[i]));
  else if (m.saida === 'minmax') {
    // o U²-Net: a saída já passou pela sigmoide, e o rembg a estica entre o menor e o maior do quadro
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < n; i++) (mn = Math.min(mn, d[i])), (mx = Math.max(mx, d[i]));
    for (let i = 0; i < n; i++) r[i] = (d[i] - mn) / Math.max(1e-6, mx - mn);
  } else if (m.saida === 'duas-classes') {
    for (let i = 0; i < n; i++) {
      const a = d[i], b = d[n + i];
      r[i] = a >= 0 && b >= 0 && Math.abs(a + b - 1) < 0.01 ? b : 1 / (1 + Math.exp(a - b)); // já é softmax? senão, aplica
    }
  } else {
    // multiclasse, NHWC com 6 classes: 0 é o fundo, as outras (cabelo, pele, roupa, acessórios) são a pessoa
    for (let i = 0; i < n; i++) {
      const v = d.subarray(i * 6, i * 6 + 6);
      const soma = v.reduce((s, x) => s + x, 0);
      if (Math.abs(soma - 1) < 0.01) r[i] = 1 - v[0];
      else {
        const mx = Math.max(...v), e = v.map((x) => Math.exp(x - mx)), t = e.reduce((s, x) => s + x, 0);
        r[i] = 1 - e[0] / t;
      }
    }
  }
  return r;
}

/** Quanto duas máscaras concordam (pessoa = acima de 0,5), de 0 a 1. Com a segunda deslocada, compara o mesmo lugar. */
function concordancia(m, a, b, deslocar) {
  const [w, h] = m.entrada, dx = Math.round((deslocar * w) / L);
  let inter = 0, uniao = 0;
  for (let y = 0; y < h; y++)
    for (let x = Math.max(0, dx); x < w - Math.max(0, -dx) - Math.abs(dx); x++) {
      const p = a[y * w + x] > 0.5, q = b[y * w + x - dx] > 0.5;
      inter += p && q ? 1 : 0;
      uniao += p || q ? 1 : 0;
    }
  return uniao ? inter / uniao : 1;
}

const CONFIGS = [
  { id: 'cpu-1', nome: '1 núcleo', opcoes: { intraOpNumThreads: 1, interOpNumThreads: 1 } },
  { id: 'cpu-2', nome: '2 núcleos', opcoes: { intraOpNumThreads: 2, interOpNumThreads: 1 } },
  { id: 'cpu-4', nome: '4 núcleos', opcoes: { intraOpNumThreads: 4, interOpNumThreads: 1 } },
  { id: 'dml', nome: 'placa (DirectML)', opcoes: { executionProviders: ['dml'] } },
];
const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p90 = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.9)];

const resultados = [];
for (const m of MODELOS.filter((m) => !so || so.includes(m.id))) {
  const caminho = join(AQUI, 'modelos', m.arquivo);
  const linha = { modelo: m, tempos: {}, mascaras: [], estabilidade: [], cruas: [] };
  // CONFIGS=cpu-2,dml mede só essas (os refinados levam segundos por quadro no processador); as máscaras saem da de 4
  // núcleos, ou da última da lista
  const configs = m.configs ? CONFIGS.filter((c) => m.configs.includes(c.id)) : process.env.CONFIGS ? CONFIGS.filter((c) => process.env.CONFIGS.split(',').includes(c.id)) : CONFIGS;
  const daMascara = configs.some((c) => c.id === 'cpu-4') ? 'cpu-4' : configs.at(-1).id;
  for (const c of configs) {
    let sessao;
    try {
      sessao = await ort.InferenceSession.create(caminho, { ...c.opcoes, logSeverityLevel: 3 });
    } catch (e) {
      linha.tempos[c.id] = { erro: String(e.message ?? e).slice(0, 120) };
      continue;
    }
    const nome = sessao.inputNames[0];
    const tens = entrada(m, quadros[0].rgba);
    for (let i = 0; i < (m.aquecer ?? 5); i++) await sessao.run({ [nome]: tens });
    const so_modelo = [], com_pre = [];
    for (let i = 0; i < (m.rodadas ?? RODADAS); i++) {
      const t0 = performance.now();
      const t = entrada(m, quadros[i % quadros.length].rgba);
      const t1 = performance.now();
      const s = await sessao.run({ [nome]: t });
      const t2 = performance.now();
      mascara(m, s[sessao.outputNames[0]]);
      com_pre.push(performance.now() - t0);
      so_modelo.push(t2 - t1);
    }
    linha.tempos[c.id] = { modelo: mediana(so_modelo), p90: p90(so_modelo), total: mediana(com_pre) };
    console.log(m.id.padEnd(15), c.id.padEnd(6), `modelo ${mediana(so_modelo).toFixed(1)} ms (p90 ${p90(so_modelo).toFixed(1)}), com o preparo ${mediana(com_pre).toFixed(1)} ms`);
    if (c.id === daMascara) {
      for (const q of quadros) {
        const a = mascara(m, (await sessao.run({ [nome]: entrada(m, q.rgba) }))[sessao.outputNames[0]]);
        const b = mascara(m, (await sessao.run({ [nome]: entrada(m, q.rgba, 3) }))[sessao.outputNames[0]]);
        linha.mascaras.push(Buffer.from(Uint8Array.from(a, (v) => Math.round(Math.max(0, Math.min(1, v)) * 255))).toString('base64'));
        linha.estabilidade.push(concordancia(m, a, b, 3));
        linha.cruas.push(a);
      }
    }
    await sessao.release?.();
  }
  resultados.push(linha);
}

// ---- A BORDA (17/11/2026): a franja, o corte e a largura (qualidade.mjs), com a máscara como a página a monta (ampliada e com
// o smoothstep de 0,3 a 0,7) e com o filtro guiado (guiado.mjs) antes dele. Cada modelo ganha uma linha "+ filtro guiado" no
// comparativo. GUIADO=0 pula. ----
const suave = (a, b) => (m) => Float32Array.from(m, (v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
});
const efetiva = suave(0.3, 0.7);
const comGuiado = [];
for (const r of resultados) {
  const [w, h] = r.modelo.entrada;
  r.borda = [];
  const g = { modelo: { ...r.modelo, id: r.modelo.id + '-guiado', nome: r.modelo.nome + ' + filtro guiado', entrada: [L, A] }, tempos: {}, mascaras: [], estabilidade: r.estabilidade, borda: [] };
  quadros.forEach((q, qi) => {
    const m = r.cruas[qi];
    if (!m) return;
    const crua = efetiva(ampliar(m, w, h, L, A));
    r.borda.push(qualidadeDaBorda(q.rgba, L, A, 4, crua));
    // o comparativo mostra o que a página mostraria: a máscara já ampliada e com o smoothstep
    (r.desenho ??= []).push(Buffer.from(Uint8Array.from(crua, (v) => Math.round(v * 255))).toString('base64'));
    if (process.env.GUIADO === '0') return;
    const t0 = performance.now();
    const fg = efetiva(filtroGuiado(q.rgba, L, A, 4, m, w, h));
    g.tempoJs = (g.tempoJs ?? 0) + performance.now() - t0;
    g.borda.push(qualidadeDaBorda(q.rgba, L, A, 4, fg));
    g.mascaras.push(Buffer.from(Uint8Array.from(fg, (v) => Math.round(v * 255))).toString('base64'));
  });
  if (g.mascaras.length) comGuiado.push(g);
}
const media = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
// NO ESCURO (17/11/2026): a franja e o corte não veem a pessoa que SOME (máscara vazia não tem borda). Cada foto escura é a
// mesma foto clara escurecida, no mesmo enquadramento: a IoU entre as duas máscaras do MESMO modelo diz quanto ele se manteve.
for (const r of resultados) {
  if (!r.cruas?.length) continue;
  r.fielEscura = [];
  quadros.forEach((q, qi) => {
    if (!q.escura) return;
    const ci = quadros.findIndex((c) => c.arquivo === q.arquivo && !c.escura);
    const a = r.cruas[qi], b = r.cruas[ci];
    let inter = 0, uniao = 0;
    for (let i = 0; i < a.length; i++) {
      const p = a[i] > 0.5, c = b[i] > 0.5;
      inter += p && c ? 1 : 0;
      uniao += p || c ? 1 : 0;
    }
    r.fielEscura.push(uniao ? inter / uniao : 1);
  });
  console.log('escuro', r.modelo.id.padEnd(24), r.fielEscura.map((x) => (x * 100).toFixed(1) + '%').join(' · '));
}
for (const r of [...resultados, ...comGuiado]) {
  const b = r.borda;
  if (!b?.length) continue;
  r.bordaMedia = { franja: media(b.map((x) => x.franja)), corte: media(b.map((x) => x.corte)), largura: media(b.map((x) => x.largura)) };
  console.log('borda', r.modelo.id.padEnd(24), `franja ${(r.bordaMedia.franja * 100).toFixed(1)}%  corte ${(r.bordaMedia.corte * 100).toFixed(1)}%  largura ${r.bordaMedia.largura.toFixed(2)} px`);
}
resultados.push(...comGuiado);

// ---- a comparação: cada máscara ampliada ao quadro e os três fundos, montados pelo Chrome ----
const quarto = 'data:image/png;base64,' + readFileSync(join(AQUI, '../recorte-de-fundo/imagens/quarto.png')).toString('base64');
const fotos = await pagina.evaluate(
  async ({ quadros, resultados, L, A, quarto }) => {
    const fundo = new Image();
    fundo.src = quarto;
    await fundo.decode();
    const saida = [];
    for (let qi = 0; qi < quadros.length; qi++) {
      const cam = new OffscreenCanvas(L, A);
      const rgba = Uint8ClampedArray.from(atob(quadros[qi].rgba), (ch) => ch.charCodeAt(0));
      cam.getContext('2d').putImageData(new ImageData(rgba, L, A), 0, 0);
      const linha = [];
      for (const r of resultados) {
        const [w, h] = r.modelo.entrada;
        const m8 = Uint8Array.from(atob(r.mascaras[qi]), (ch) => ch.charCodeAt(0));
        const mc = new OffscreenCanvas(w, h), md = new ImageData(w, h);
        for (let i = 0; i < w * h; i++) md.data.set([255, 255, 255, m8[i]], i * 4);
        mc.getContext('2d').putImageData(md, 0, 0);
        // a pessoa: o quadro com a máscara ampliada (bilinear) como alfa
        const pessoa = new OffscreenCanvas(L, A), pg = pessoa.getContext('2d');
        pg.imageSmoothingQuality = 'high';
        pg.drawImage(mc, 0, 0, L, A);
        pg.globalCompositeOperation = 'source-in';
        pg.drawImage(cam, 0, 0);
        const tres = new OffscreenCanvas(L * 3, A), tg = tres.getContext('2d');
        tg.fillStyle = '#000';
        tg.fillRect(0, 0, L, A);
        tg.drawImage(pessoa, 0, 0);
        tg.save();
        tg.beginPath();
        tg.rect(L, 0, L, A);
        tg.clip();
        tg.filter = 'blur(10px)';
        tg.drawImage(cam, L, 0);
        tg.restore();
        tg.drawImage(pessoa, L, 0);
        const esc = Math.max(L / fundo.naturalWidth, A / fundo.naturalHeight);
        tg.save();
        tg.beginPath();
        tg.rect(2 * L, 0, L, A);
        tg.clip();
        tg.imageSmoothingEnabled = false;
        tg.drawImage(fundo, 2 * L + (L - fundo.naturalWidth * esc) / 2, (A - fundo.naturalHeight * esc) / 2, fundo.naturalWidth * esc, fundo.naturalHeight * esc);
        tg.restore();
        tg.drawImage(pessoa, 2 * L, 0);
        const blob = await tres.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
        linha.push(btoa(s));
      }
      saida.push(linha);
    }
    return saida;
  },
  {
    quadros: quadros.map((q) => ({ rgba: Buffer.from(q.rgba).toString('base64') })),
    resultados: resultados.map((r) => (r.desenho ? { modelo: { ...r.modelo, entrada: [L, A] }, mascaras: r.desenho } : { modelo: r.modelo, mascaras: r.mascaras })),
    L,
    A,
    quarto,
  },
);
await navegador.close();

const tabela = resultados
  .map((r) => {
    const t = (id) => (r.tempos[id]?.erro ? 'falha' : r.tempos[id] ? `${r.tempos[id].modelo.toFixed(1)} ms` : '–');
    const est = r.estabilidade.reduce((s, x) => s + x, 0) / r.estabilidade.length;
    const mb = (readFileSync(join(AQUI, 'modelos', r.modelo.arquivo)).length / 1e6).toFixed(1);
    const bd = r.bordaMedia ? `<td>${(r.bordaMedia.franja * 100).toFixed(1)}%</td><td>${(r.bordaMedia.corte * 100).toFixed(1)}%</td><td>${r.bordaMedia.largura.toFixed(2)} px</td>` : '<td>–</td><td>–</td><td>–</td>';
    return `<tr><td>${r.modelo.nome}</td><td>${mb} MB</td><td>${t('cpu-1')}</td><td>${t('cpu-2')}</td><td>${t('cpu-4')}</td><td>${t('dml')}</td><td>${(est * 100).toFixed(1)}%</td><td>${r.fielEscura ? r.fielEscura.map((x) => (x * 100).toFixed(0) + '%').join(' · ') : '–'}</td>${bd}<td>${r.modelo.licenca}</td></tr>`;
  })
  .join('\n');
const blocos = FOTOS.map(
  (f, qi) =>
    `<h2>${f.nome}</h2>` +
    resultados
      .map((r, ri) => {
        writeFileSync(join(RES, `${qi}-${r.modelo.id}.jpg`), Buffer.from(fotos[qi][ri], 'base64'));
        return `<figure><img src="${qi}-${r.modelo.id}.jpg" loading="lazy"><figcaption>${r.modelo.nome} · estabilidade ${(r.estabilidade[qi] * 100).toFixed(1)}%</figcaption></figure>`;
      })
      .join(''),
).join('\n');
writeFileSync(
  join(RES, `${SAIDA}.html`),
  `<!doctype html><meta charset="utf-8"><title>Fundo da câmera</title><style>body{font:14px system-ui;background:#16181d;color:#ddd;margin:16px}table{border-collapse:collapse}td,th{border:1px solid #444;padding:4px 8px}img{width:100%;max-width:1920px}figure{margin:0 0 14px}</style>
<h1>Fundo da câmera: os candidatos</h1><p>Quadro de 640 × 360. Tempo: a mediana do modelo por quadro, depois de aquecido. Estabilidade: quanto a máscara concorda com ela mesma com a câmera 3 px ao lado (100% = nada treme). Franja: quanto do que aparece na borda é fundo (a parede vazando); corte: quanto da pessoa a borda joga fora; largura: a espessura da borda em px (qualidade.mjs). As linhas "+ filtro guiado" têm o tempo do filtro na placa medido no app, não aqui.</p>
<table><tr><th>Modelo</th><th>Arquivo</th><th>1 núcleo</th><th>2 núcleos</th><th>4 núcleos</th><th>Placa</th><th>Estabilidade</th><th>No escuro (IoU com a mesma foto clara)</th><th>Franja</th><th>Corte</th><th>Largura da borda</th><th>Licença</th></tr>${tabela}</table>
<p>Cada linha: fundo apagado · desfocado · imagem (o quarto).</p>${blocos}`,
);
writeFileSync(join(RES, SAIDA === 'comparar' ? 'tempos.json' : `${SAIDA}-tempos.json`), JSON.stringify(resultados.map((r) => ({ id: r.modelo.id, tempos: r.tempos, estabilidade: r.estabilidade, fielEscura: r.fielEscura, borda: r.borda, bordaMedia: r.bordaMedia })), null, 2));
console.log('\nresultados/comparar.html');
