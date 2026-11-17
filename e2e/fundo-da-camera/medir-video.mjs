// A MEDIDA EM VÍDEO DO FUNDO DA CÂMERA (ver README.md, "Vídeo"): sem webcam, a câmera é SIMULADA. Os vídeos do Commons
// (lista.mjs, VIDEOS) são reduzidos pelo ffmpeg ao que uma webcam entrega ao app (640 × 360, 15 quadros por segundo), em quatro
// versões: limpa, com ruído de sensor, quarto escuro (escurecer + ruído forte) e comprimida (MJPEG de webcam barata). O
// PP-HumanSeg e o MediaPipe paisagem rodam quadro a quadro pelo onnxruntime-node com 2 núcleos, como no processo à parte do app,
// e medem-se:
//   - o tempo por quadro (o modelo, e com o preparo: reduzir e normalizar);
//   - o TREMOR: a IoU entre quadros seguidos e quantos pixels trocam de lado por pixel de contorno, com a máscara crua e com
//     as suavizações no tempo (média exponencial com alfa 0,5, 0,65 e 0,8, histerese no limiar, e a média que se adapta);
//   - o ARRASTO: um quadro parado que anda 6 px por quadro durante 1 s (a cabeça ou a mão mexendo) e para; quanto a máscara
//     suavizada fica atrás da crua, em px de contorno no quadro de 640, e quantos quadros ela leva para assentar.
// Monta resultados/video-comparar.html, com os vídeos lado a lado (crua × suavizada, sobre o quarto) para julgar a olho.
//   node e2e/fundo-da-camera/baixar.mjs && node e2e/fundo-da-camera/medir-video.mjs
// Precisa do ffmpeg no PATH. SO=<id do vídeo> mede um vídeo só; SEM_VIDEO=1 pula os vídeos de comparação.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filtroGuiado } from './guiado.mjs';
import { MODELOS, VIDEOS } from './lista.mjs';

const require = createRequire(import.meta.url);
const ort = require('onnxruntime-node');
const AQUI = dirname(fileURLToPath(import.meta.url));
const RES = join(AQUI, 'resultados');
const VID = join(RES, 'video');
mkdirSync(VID, { recursive: true });
const L = 640, A = 360, QPS = 15; // o quadro da webcam simulada
const GL = 320, GA = 180; // a grade comum onde as máscaras são comparadas (a metade do quadro)
const so = process.env.SO?.split(',');

// ---- a webcam simulada: o ffmpeg corta, reduz, tira a 15 qps e degrada ----
const VARIANTES = [
  { id: 'limpa', nome: 'limpa', filtro: '' },
  { id: 'ruido', nome: 'ruído de sensor', filtro: ',noise=c0s=10:c1s=6:c2s=6:allf=t' },
  // o mesmo escurecer da medida das fotos (gama 1,8 e teto em 90 de 255) e o ruído forte de quem sobe o ganho no escuro
  { id: 'escura', nome: 'quarto escuro', filtro: ",lutrgb=r='pow(val/255\\,1.8)*90':g='pow(val/255\\,1.8)*90':b='pow(val/255\\,1.8)*90',noise=c0s=22:c1s=14:c2s=14:allf=t" },
  // a webcam USB barata manda MJPEG; q 18 é a compressão de quem está no limite da USB 2
  { id: 'comprimida', nome: 'compressão MJPEG', filtro: '', mjpeg: 18 },
];

function quadrosDe(v, variante) {
  const base = `[0:v]fps=${QPS},scale=${L}:${A}:force_original_aspect_ratio=increase,crop=${L}:${A}${variante.filtro},format=rgb24`;
  const arq = join(AQUI, 'videos', v.arquivo);
  const ff = (args, entrada) => {
    const r = spawnSync('ffmpeg', args, { input: entrada, maxBuffer: 1 << 30 });
    if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr.toString().slice(-400));
    return r.stdout;
  };
  let bruto = ff(['-v', 'error', '-ss', String(v.inicio), '-t', String(v.duracao), '-i', arq, '-filter_complex', base, '-f', 'rawvideo', '-']);
  if (variante.mjpeg) {
    // codifica cada quadro em MJPEG e decodifica de volta, como o quadro chega da câmera
    const mj = ff(['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${L}x${A}`, '-r', String(QPS), '-i', '-', '-c:v', 'mjpeg', '-q:v', String(variante.mjpeg), '-f', 'mjpeg', '-'], bruto);
    bruto = ff(['-v', 'error', '-f', 'mjpeg', '-i', '-', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], mj);
  }
  const n = Math.floor(bruto.length / (L * A * 3));
  return Array.from({ length: n }, (_, i) => new Uint8Array(bruto.buffer, bruto.byteOffset + i * L * A * 3, L * A * 3));
}

// ---- o preparo: amostra bilinear com as tabelas feitas uma vez (o que o processo do app faria) ----
function preparador(m) {
  const [w, h] = m.entrada;
  const tab = (n, N) => {
    const i0 = new Int32Array(n), a = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const f = Math.min(N - 1.001, Math.max(0, ((i + 0.5) * N) / n - 0.5));
      i0[i] = f | 0;
      a[i] = f - (f | 0);
    }
    return [i0, a];
  };
  const [x0s, axs] = tab(w, L), [y0s, ays] = tab(h, A);
  const t = new Float32Array(3 * w * h);
  const [mul, soma] = m.normal === 'menos-um-um' ? [2 / 255, -1] : [1 / 255, 0];
  return (rgb) => {
    for (let y = 0; y < h; y++) {
      const r0 = y0s[y] * L, r1 = r0 + L, ay = ays[y];
      for (let x = 0; x < w; x++) {
        const c0 = x0s[x], ax = axs[x];
        const p00 = (r0 + c0) * 3, p01 = p00 + 3, p10 = (r1 + c0) * 3, p11 = p10 + 3;
        for (let k = 0; k < 3; k++) {
          const v = (rgb[p00 + k] * (1 - ax) + rgb[p01 + k] * ax) * (1 - ay) + (rgb[p10 + k] * (1 - ax) + rgb[p11 + k] * ax) * ay;
          t[k * w * h + y * w + x] = v * mul + soma;
        }
      }
    }
    return new ort.Tensor('float32', t, [1, 3, h, w]);
  };
}

/** A probabilidade de "pessoa" na saída (só os dois formatos destes modelos), w × h. */
function mascara(m, saida) {
  const [w, h] = m.entrada, n = w * h, d = saida.data, r = new Float32Array(n);
  if (m.saida === 'unica') for (let i = 0; i < n; i++) r[i] = d[i];
  else
    for (let i = 0; i < n; i++) {
      const a = d[i], b = d[n + i];
      r[i] = a >= 0 && b >= 0 && Math.abs(a + b - 1) < 0.01 ? b : 1 / (1 + Math.exp(a - b));
    }
  return r;
}

/** A máscara do modelo ampliada (bilinear) à grade comum GL × GA, de 0 a 1. */
function naGrade(m, p, GW = GL, GH = GA) {
  const [w, h] = m.entrada, r = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) {
    const fy = Math.min(h - 1.001, Math.max(0, ((y + 0.5) * h) / GH - 0.5)), y0 = fy | 0, ay = fy - y0;
    for (let x = 0; x < GW; x++) {
      const fx = Math.min(w - 1.001, Math.max(0, ((x + 0.5) * w) / GW - 0.5)), x0 = fx | 0, ax = fx - x0;
      const q = (yy, xx) => p[yy * w + xx];
      r[y * GW + x] = (q(y0, x0) * (1 - ax) + q(y0, x0 + 1) * ax) * (1 - ay) + (q(y0 + 1, x0) * (1 - ax) + q(y0 + 1, x0 + 1) * ax) * ay;
    }
  }
  return r;
}

// ---- as suavizações no tempo: cada uma recebe as máscaras cruas na grade e devolve a sequência suavizada (0 a 1) ----
// (laços simples: o Float32Array.from com função por pixel deixava a medida dez vezes mais lenta)
const ema = (alfa) => (seq) => {
  let ant = null;
  return seq.map((p) => {
    const r = new Float32Array(p);
    if (ant) for (let i = 0; i < r.length; i++) r[i] = alfa * ant[i] + (1 - alfa) * p[i];
    return (ant = r);
  });
};
// histerese: o pixel só vira pessoa acima de `alto` e só vira fundo abaixo de `baixo`; a saída é dura (0 ou 1)
const histerese = (baixo, alto, antes = (s) => s) => (seq) => {
  let est = null;
  return antes(seq).map((p) => {
    const r = new Float32Array(p.length);
    for (let i = 0; i < r.length; i++) {
      const v = p[i];
      r[i] = v > alto ? 1 : v < baixo ? 0 : est ? est[i] : v > 0.5 ? 1 : 0;
    }
    return (est = r);
  });
};
// a média que se adapta: segura (alfa 0,8) onde a mudança é pequena, que é o tremor, e solta (alfa 0,2) onde é grande, que é
// movimento de verdade
const adaptativa = (seq) => {
  let ant = null;
  return seq.map((p) => {
    const r = new Float32Array(p);
    if (ant)
      for (let i = 0; i < r.length; i++) {
        const d = Math.abs(p[i] - ant[i]), a = d < 0.2 ? 0.8 : d > 0.6 ? 0.2 : 0.8 - ((d - 0.2) / 0.4) * 0.6;
        r[i] = a * ant[i] + (1 - a) * p[i];
      }
    return (ant = r);
  });
};
const SUAVES = [
  { id: 'crua', nome: 'crua', f: (s) => s },
  { id: 'ema50', nome: 'média 0,5', f: ema(0.5) },
  { id: 'ema65', nome: 'média 0,65', f: ema(0.65) },
  { id: 'ema80', nome: 'média 0,8', f: ema(0.8) },
  { id: 'hist', nome: 'histerese 0,35–0,65', f: histerese(0.35, 0.65) },
  { id: 'ema50h', nome: 'média 0,5 + histerese', f: histerese(0.35, 0.65, ema(0.5)) },
  { id: 'adapt', nome: 'média que se adapta (0,8 → 0,2)', f: adaptativa },
  // COMO A PÁGINA MONTA (17/11/2026): a que se adapta, no tamanho do modelo (como o processo do app faz), ampliada ao quadro com o
  // smoothstep de 0,3 a 0,7; e o mesmo com o FILTRO GUIADO (guiado.mjs) antes do smoothstep. Estas duas pedem o quadro da câmera
  // e a máscara crua no tamanho do modelo (`ctx`); a saída volta à grade pela média de cada bloco
  { id: 'pagina', nome: 'a que se adapta, como a página monta', f: (s, ctx) => comoAPagina(ctx, false), pagina: true },
  { id: 'guiado', nome: 'a que se adapta + filtro guiado', f: (s, ctx) => comoAPagina(ctx, true), pagina: true },
];
const SEM_GUIADO = process.env.GUIADO === '0';
const efetiva = (v) => {
  const t = Math.min(1, Math.max(0, (v - 0.3) / 0.4));
  return t * t * (3 - 2 * t);
};
/** A sequência inteira como a página a monta, devolvida na grade GL × GA (a média de cada bloco do quadro cheio). */
function comoAPagina({ m, cruas, quadros }, guiado, GW = GL, GH = GA) {
  const [w, h] = m.entrada;
  const suaves = adaptativa(cruas);
  return suaves.map((p, t) => {
    const cheia = guiado ? filtroGuiado(quadros[t], L, A, 3, p, w, h) : naGrade(m, p, L, A);
    if (GW === L && GH === A) return Float32Array.from(cheia, efetiva);
    const r = new Float32Array(GW * GH), bx = L / GW, by = A / GH;
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        let soma = 0;
        for (let yy = 0; yy < by; yy++) for (let xx = 0; xx < bx; xx++) soma += efetiva(cheia[(y * by + yy) * L + x * bx + xx]);
        r[y * GW + x] = soma / (bx * by);
      }
    return r;
  });
}

// ---- as medidas ----
const bin = (p) => {
  const r = new Uint8Array(p.length);
  for (let i = 0; i < p.length; i++) r[i] = p[i] > 0.5 ? 1 : 0;
  return r;
};
/** Os pixels de contorno de uma máscara binária (pessoa com um vizinho fundo, ou o contrário), na grade. */
function contorno(b) {
  let n = 0;
  for (let y = 1; y < GA - 1; y++)
    for (let x = 1; x < GL - 1; x++) {
      const i = y * GL + x, v = b[i];
      if (b[i - 1] !== v || b[i + 1] !== v || b[i - GL] !== v || b[i + GL] !== v) n++;
    }
  return n;
}
/** O tremor de uma sequência: IoU média e a pior (p5) entre quadros seguidos, trocas por pixel de contorno, e quanto o alfa
 *  muda na faixa macia (onde ele está entre 0,1 e 0,9). */
function tremor(seq) {
  const ious = [], trocas = [];
  let somaDa = 0, nDa = 0;
  for (let t = 1; t < seq.length; t++) {
    const a = bin(seq[t - 1]), b = bin(seq[t]);
    let inter = 0, uniao = 0, troca = 0;
    for (let i = 0; i < a.length; i++) {
      inter += a[i] & b[i];
      uniao += a[i] | b[i];
      troca += a[i] ^ b[i];
    }
    ious.push(uniao ? inter / uniao : 1);
    trocas.push(troca / Math.max(1, contorno(b)));
    const p = seq[t - 1], q = seq[t];
    for (let i = 0; i < p.length; i++)
      if ((p[i] > 0.1 && p[i] < 0.9) || (q[i] > 0.1 && q[i] < 0.9)) {
        somaDa += Math.abs(p[i] - q[i]);
        nDa++;
      }
  }
  const ord = [...ious].sort((x, y) => x - y);
  return { iou: ious.reduce((s, x) => s + x, 0) / ious.length, iouP5: ord[Math.floor(ord.length * 0.05)], trocas: trocas.reduce((s, x) => s + x, 0) / trocas.length, dAlfa: nDa ? somaDa / nDa : 0 };
}
/** O arrasto: o quadro inteiro anda na horizontal, então a pessoa da máscara anda junto, e a diferença entre o centro (em x)
 *  da máscara crua e o da suavizada é quanto esta fica atrás, em px do quadro de 640. Durante o movimento: a média e a pior.
 *  Depois que para: quantos quadros até ficar a menos de 1 px, e o RESTO no último quadro (os pixels que discordam da crua por
 *  pixel de contorno, em px), que pega o que fica preso (a histerese segura o que caiu na faixa do meio). */
function centro(p) {
  let sx = 0, n = 0;
  for (let y = 0; y < GA; y++)
    for (let x = 0; x < GL; x++)
      if (p[y * GL + x] > 0.5) {
        sx += x;
        n++;
      }
  return n ? ((sx / n) * L) / GL : 0;
}
function arrasto(crua, suave, anda, para) {
  const atras = crua.map((p, t) => Math.abs(centro(p) - centro(suave[t])));
  const mov = atras.slice(anda, para);
  let assenta = 0;
  while (para + assenta < atras.length && atras[para + assenta] > 1) assenta++;
  const a = bin(crua.at(-1)), b = bin(suave.at(-1));
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] ^ b[i];
  return { medio: mov.reduce((s, x) => s + x, 0) / mov.length, max: Math.max(...mov), assenta, resto: ((d / Math.max(1, contorno(a))) * L) / GL };
}

// ---- rodar ----
// MODELOS_DO_VIDEO=id,id troca os modelos (o primeiro é a referência da fidelidade); PLACA=id,id roda esses pelo DirectML
// (os refinados de 17/11/2026), os outros com 2 núcleos
const mods = (process.env.MODELOS_DO_VIDEO ?? 'pphumanseg,mp-paisagem').split(',').map((id) => MODELOS.find((m) => m.id === id));
const naPlaca = new Set((process.env.PLACA ?? '').split(',').filter(Boolean));
const sessoes = {};
for (const m of mods) {
  const s = await ort.InferenceSession.create(join(AQUI, 'modelos', m.arquivo), naPlaca.has(m.id) ? { executionProviders: ['dml'], logSeverityLevel: 3 } : { intraOpNumThreads: 2, interOpNumThreads: 1, logSeverityLevel: 3 });
  sessoes[m.id] = { s, prep: preparador(m), nome: s.inputNames[0], saida: s.outputNames[0] };
  const t0 = new Uint8Array(L * A * 3).fill(128);
  for (let i = 0; i < 5; i++) await s.run({ [sessoes[m.id].nome]: sessoes[m.id].prep(t0) });
}
async function rodar(m, quadros) {
  const { s, prep, nome, saida } = sessoes[m.id];
  const tm = [], tt = [], mascaras = [];
  for (const q of quadros) {
    const t0 = performance.now();
    const ent = prep(q);
    const t1 = performance.now();
    const r = await s.run({ [nome]: ent });
    const t2 = performance.now();
    const p = mascara(m, r[saida]);
    tt.push(performance.now() - t0);
    tm.push(t2 - t1);
    mascaras.push(p);
  }
  return { tm, tt, mascaras };
}
const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p90 = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.9)];
const media = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

const limpas = {}; // video -> modelo -> máscaras cruas na grade, da versão limpa
const iouMedia = (as, bs) =>
  media(
    as.map((p, t) => {
      const a = bin(p), b = bin(bs[t]);
      let inter = 0, uniao = 0;
      for (let i = 0; i < a.length; i++) {
        inter += a[i] & b[i];
        uniao += a[i] | b[i];
      }
      return uniao ? inter / uniao : 1;
    }),
  );
const linhas = []; // { video, variante, modelo, tempo, suaves: { id: tremor } }
const tempos = {}; // modelo -> [ms]
const paraVideo = {}; // video/variante -> { quadros, por modelo: máscaras cruas no tamanho do modelo }
const videos = VIDEOS.filter((v) => !so || so.includes(v.id));
for (const v of videos) {
  if (!existsSync(join(AQUI, 'videos', v.arquivo))) throw new Error(`falta videos/${v.arquivo}: rode baixar.mjs`);
  for (const va of VARIANTES) {
    const quadros = quadrosDe(v, va);
    paraVideo[`${v.id}/${va.id}`] = { quadros, mascaras: {} };
    for (const m of mods) {
      const { tm, tt, mascaras } = await rodar(m, quadros);
      (tempos[m.id] ??= { modelo: [], total: [] }).modelo.push(...tm);
      tempos[m.id].total.push(...tt);
      paraVideo[`${v.id}/${va.id}`].mascaras[m.id] = mascaras;
      const grade = mascaras.map((p) => naGrade(m, p));
      const suaves = {};
      for (const sv of SUAVES) if (!(sv.id === 'guiado' && SEM_GUIADO)) suaves[sv.id] = tremor(sv.f(grade, { m, cruas: mascaras, quadros }));
      // a FIDELIDADE: a estabilidade sozinha não diz se a pessoa está lá (uma máscara vazia não treme). Compara, quadro a
      // quadro, com a máscara do mesmo modelo na versão limpa, e com a do PP-HumanSeg limpo (a referência, à falta de gabarito)
      if (va.id === 'limpa') (limpas[v.id] ??= {})[m.id] = grade;
      const fiel = { proprio: iouMedia(grade, limpas[v.id][m.id]), referencia: iouMedia(grade, limpas[v.id][mods[0].id]), area: media(grade.map((p) => bin(p).reduce((s, x) => s + x, 0) / p.length)) };
      linhas.push({ video: v, variante: va, modelo: m, suaves, fiel });
      const c = suaves.crua, e = suaves.ema65;
      console.log(`${v.id.padEnd(19)} ${va.id.padEnd(10)} ${m.id.padEnd(11)} ${quadros.length} quadros · ${mediana(tm).toFixed(1)} ms (com o preparo ${mediana(tt).toFixed(1)}) · IoU crua ${(c.iou * 100).toFixed(2)}% trocas ${c.trocas.toFixed(3)} · média 0,65: ${(e.iou * 100).toFixed(2)}% ${e.trocas.toFixed(3)}`);
    }
  }
}

// ---- o arrasto: um quadro de cada vídeo, parado 10 quadros, andando por 15 (1 s) e parado 15. Dois passos: 6 px por quadro
// (90 px/s, a cabeça mexendo) e 18 (270 px/s, a mão passando), este só na versão limpa ----
const PARADO = 10, ANDA = 15, DEPOIS = 15;
const CASOS = [{ passo: 6, variante: 'limpa' }, { passo: 6, variante: 'escura' }, { passo: 18, variante: 'limpa' }];
function deslocado(q, dx) {
  const r = new Uint8Array(q.length);
  for (let y = 0; y < A; y++)
    for (let x = 0; x < L; x++) {
      const sx = Math.min(L - 1, Math.max(0, x - dx));
      const o = (y * L + x) * 3, s = (y * L + sx) * 3;
      r[o] = q[s];
      r[o + 1] = q[s + 1];
      r[o + 2] = q[s + 2];
    }
  return r;
}
const arrastos = []; // { modelo, variante, suave, medio, max, assenta }
for (const m of mods)
  for (const { passo: PASSO, variante: vaId } of CASOS) {
    const acum = {};
    for (const v of videos) {
      const q0 = paraVideo[`${v.id}/${vaId}`].quadros[0];
      const seq = [];
      for (let t = 0; t < PARADO + ANDA + DEPOIS; t++) seq.push(deslocado(q0, Math.min(ANDA, Math.max(0, t - PARADO)) * PASSO - (ANDA * PASSO) / 2));
      const { mascaras } = await rodar(m, seq);
      const grade = mascaras.map((p) => naGrade(m, p));
      // as da página comparam com a crua montada do mesmo jeito (ampliada e com o smoothstep), senão o smoothstep sozinho conta
      const cruaPagina = SUAVES.some((sv) => sv.pagina) ? grade.map((p) => Float32Array.from(p, efetiva)) : null;
      for (const sv of SUAVES) if (!(sv.id === 'guiado' && SEM_GUIADO)) (acum[sv.id] ??= []).push(arrasto(sv.pagina ? cruaPagina : grade, sv.f(grade, { m, cruas: mascaras, quadros: seq }), PARADO + 3, PARADO + ANDA));
    }
    for (const sv of SUAVES) {
      const a = acum[sv.id];
      if (!a) continue;
      arrastos.push({ modelo: m, variante: vaId, passo: PASSO, suave: sv, medio: media(a.map((x) => x.medio)), max: Math.max(...a.map((x) => x.max)), assenta: Math.max(...a.map((x) => x.assenta)), resto: media(a.map((x) => x.resto)) });
    }
  }

// ---- os vídeos de comparação: 3 × 2 (em cima o PP-HumanSeg, embaixo o MediaPipe; crua | média 0,65 | a que se adapta) sobre
// o quarto. SUAVES_DO_VIDEO=crua,ema80,... troca as colunas ----
const COLUNAS = (process.env.SUAVES_DO_VIDEO ?? 'crua,ema65,adapt').split(',').map((id) => SUAVES.find((s) => s.id === id));
const NC = COLUNAS.length;
const quarto = spawnSync('ffmpeg', ['-v', 'error', '-i', join(AQUI, '../recorte-de-fundo/imagens/quarto.png'), '-vf', `scale=${L}:${A}:force_original_aspect_ratio=increase:flags=neighbor,crop=${L}:${A}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 }).stdout;
async function videoLadoALado(chave, arquivo) {
  const { quadros, mascaras } = paraVideo[chave];
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${NC * L}x${mods.length * A}`, '-r', String(QPS), '-i', '-', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(VID, arquivo)]);
  const fim = new Promise((ok, erro) => ff.on('close', (c) => (c === 0 ? ok() : erro(new Error('ffmpeg saiu com ' + c)))));
  const paineis = mods.flatMap((m) => {
    const cheia = mascaras[m.id].map((p) => naGrade(m, p, L, A));
    return COLUNAS.map((sv) => (sv.pagina ? comoAPagina({ m, cruas: mascaras[m.id], quadros }, sv.id === 'guiado', L, A) : sv.f(cheia)));
  });
  for (let t = 0; t < quadros.length; t++) {
    const out = Buffer.alloc(NC * mods.length * L * A * 3);
    paineis.forEach((pn, k) => {
      const ox = (k % NC) * L, oy = Math.floor(k / NC) * A, a = pn[t], q = quadros[t];
      for (let y = 0; y < A; y++)
        for (let x = 0; x < L; x++) {
          const i = y * L + x, al = Math.max(0, Math.min(1, a[i])), o = ((oy + y) * NC * L + ox + x) * 3;
          for (let c = 0; c < 3; c++) out[o + c] = q[i * 3 + c] * al + quarto[i * 3 + c] * (1 - al);
        }
    });
    if (!ff.stdin.write(out)) await new Promise((ok) => ff.stdin.once('drain', ok));
  }
  ff.stdin.end();
  await fim;
}
const feitos = [];
if (!process.env.SEM_VIDEO)
  for (const v of videos)
    for (const vaId of ['limpa', 'escura']) {
      const arq = `${v.id}-${vaId}.mp4`;
      await videoLadoALado(`${v.id}/${vaId}`, arq);
      feitos.push({ v, va: VARIANTES.find((x) => x.id === vaId), arq });
      console.log('vídeo', arq, (statSync(join(VID, arq)).size / 1e6).toFixed(1), 'MB');
    }

// ---- o relatório ----
const pct = (x) => (x * 100).toFixed(2) + '%';
const resumo = []; // por modelo × variante × suavização, a média dos vídeos
for (const m of mods)
  for (const va of VARIANTES)
    for (const sv of SUAVES) {
      const ls = linhas.filter((l) => l.modelo === m && l.variante === va).map((l) => l.suaves[sv.id]);
      resumo.push({ modelo: m.id, variante: va.id, suave: sv.id, iou: media(ls.map((x) => x.iou)), iouP5: Math.min(...ls.map((x) => x.iouP5)), trocas: media(ls.map((x) => x.trocas)), dAlfa: media(ls.map((x) => x.dAlfa)) });
    }
const tabTempo = mods.map((m) => `<tr><td>${m.nome}</td><td>${mediana(tempos[m.id].modelo).toFixed(1)} ms</td><td>${p90(tempos[m.id].modelo).toFixed(1)} ms</td><td>${mediana(tempos[m.id].total).toFixed(1)} ms</td><td>${p90(tempos[m.id].total).toFixed(1)} ms</td><td>${((mediana(tempos[m.id].total) * QPS) / 1000).toFixed(2)}</td></tr>`).join('');
const tabTremor = mods
  .map((m) =>
    VARIANTES.map(
      (va) =>
        `<tr><th colspan="5">${m.nome} · ${va.nome}</th></tr>` +
        SUAVES.map((sv) => {
          const r = resumo.find((x) => x.modelo === m.id && x.variante === va.id && x.suave === sv.id);
          return `<tr><td>${sv.nome}</td><td>${pct(r.iou)}</td><td>${pct(r.iouP5)}</td><td>${r.trocas.toFixed(3)}</td><td>${sv.id === 'hist' || sv.id === 'ema50h' ? '— (dura)' : r.dAlfa.toFixed(3)}</td></tr>`;
        }).join(''),
    ).join(''),
  )
  .join('');
const tabFiel = linhas
  .filter((l) => l.variante.id !== 'limpa' || l.modelo.id !== mods[0].id)
  .map((l) => `<tr><td>${l.video.nome}</td><td>${l.variante.nome}</td><td>${l.modelo.nome}</td><td>${pct(l.fiel.proprio)}</td><td>${pct(l.fiel.referencia)}</td><td>${(l.fiel.area * 100).toFixed(1)}%</td></tr>`)
  .join('');
const tabArrasto = arrastos.map((a) => `<tr><td>${a.modelo.nome}</td><td>${a.variante}, ${a.passo} px/quadro</td><td>${a.suave.nome}</td><td>${a.medio.toFixed(1)} px</td><td>${a.max.toFixed(1)} px</td><td>${a.assenta}</td><td>${a.resto.toFixed(2)} px</td></tr>`).join('');
// O papel de cada modelo no app (pedido dele, 17/11/2026: "adicionar o modelo no canto dos vídeos para eu saber e avaliar
// melhor"). Cada quadrado do mosaico leva o modelo e a coluna, por cima do vídeo (o vídeo em si não muda).
const PAPEL = { pphumanseg: 'Leve, o de hoje', 'ppmatting-v2-fp16': 'Completo', 'ppseg-v2-retrato': 'candidato a novo Leve' };
const rotulos = mods
  .flatMap((m, r) =>
    COLUNAS.map(
      (c, k) =>
        `<span class="rot" style="top:${((r / mods.length) * 100).toFixed(4)}%;left:${((k / NC) * 100).toFixed(4)}%"><b>${m.nome}</b>${PAPEL[m.id] ? ` · ${PAPEL[m.id]}` : ''}<br>${c.nome}</span>`,
    ),
  )
  .join('');
const blocos = feitos
  .map((f) => `<h3>${f.v.nome} · ${f.va.nome}</h3><div class="mosaico"><video src="video/${f.arq}" controls loop muted playsinline></video>${rotulos}</div>`)
  .join('\n');
const creditos = videos.map((v) => `<li><a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(v.commons.replaceAll(' ', '_'))}">${v.commons}</a> · ${v.autor} · ${v.licenca} · trecho de ${v.inicio} s a ${v.inicio + v.duracao} s</li>`).join('');
writeFileSync(
  join(RES, 'video-comparar.html'),
  `<!doctype html><meta charset="utf-8"><title>Fundo da câmera em vídeo</title><style>body{font:14px system-ui;background:#16181d;color:#ddd;margin:16px;max-width:1300px}table{border-collapse:collapse;margin-bottom:16px}td,th{border:1px solid #444;padding:3px 8px;text-align:left}a{color:#9cf}.mosaico{position:relative;max-width:1280px}.mosaico video{display:block;width:100%}.rot{position:absolute;margin:4px;padding:2px 6px;background:rgba(0,0,0,.7);color:#fff;font:12px/1.3 system-ui;border-radius:3px;pointer-events:none}</style>
<h1>Fundo da câmera: a webcam simulada</h1>
<p>${L} × ${A} a ${QPS} quadros por segundo, 2 núcleos (onnxruntime-node). Em cada vídeo, uma linha por modelo (de cima para baixo: ${mods.map((m) => m.nome).join(' · ')}) e as colunas: ${COLUNAS.map((c) => c.nome).join(' · ')}. Cada quadrado diz o modelo e a coluna no canto. O fundo é o quarto, onde o tremor mais aparece.</p>
<h2>Tempo por quadro</h2><table><tr><th>Modelo</th><th>Modelo (mediana)</th><th>p90</th><th>Com o preparo</th><th>p90</th><th>Núcleos a 15 qps</th></tr>${tabTempo}</table>
<h2>Tremor (a média dos vídeos)</h2><p>IoU entre quadros seguidos (100% = nada mudou; a fala e a cabeça mexem de verdade, então nunca é 100%), a pior (p5), os pixels que trocam de lado por pixel de contorno, e quanto o alfa muda por quadro na faixa macia.</p>
<table><tr><th>Suavização</th><th>IoU</th><th>IoU p5</th><th>Trocas / contorno</th><th>Δ alfa</th></tr>${tabTremor}</table>
<h2>Fidelidade (a máscara crua, sem gabarito)</h2><p>IoU média, quadro a quadro, com a máscara do mesmo modelo na versão limpa, e com a do PP-HumanSeg na versão limpa (a referência); e a fração do quadro que é pessoa. Uma máscara que some com a pessoa não treme, então a estabilidade sozinha não basta.</p><table><tr><th>Vídeo</th><th>Versão</th><th>Modelo</th><th>Contra a própria limpa</th><th>Contra o PP-HumanSeg limpo</th><th>Área de pessoa</th></tr>${tabFiel}</table>
<h2>Arrasto (um quadro andando 6 ou 18 px por quadro durante 1 s)</h2><p>Quanto a máscara suavizada fica atrás da crua, em px no quadro de 640 (média e pior durante o movimento; dividido pelo passo dá quadros), quantos quadros ela leva para chegar a menos de 1 px depois que para, e o que sobra 1 s depois de parar (px de contorno que discordam: o que ficou preso).</p>
<table><tr><th>Modelo</th><th>Versão</th><th>Suavização</th><th>Arrasto médio</th><th>Pior</th><th>Quadros para assentar</th><th>Resto parado</th></tr>${tabArrasto}</table>
<h2>Os vídeos</h2>${blocos}
<h2>Créditos</h2><ul>${creditos}</ul>`,
);
writeFileSync(join(RES, 'video-numeros.json'), JSON.stringify({ tempos: Object.fromEntries(mods.map((m) => [m.id, { modelo: mediana(tempos[m.id].modelo), modeloP90: p90(tempos[m.id].modelo), total: mediana(tempos[m.id].total), totalP90: p90(tempos[m.id].total) }])), resumo, porVideo: linhas.map((l) => ({ video: l.video.id, variante: l.variante.id, modelo: l.modelo.id, fiel: l.fiel, suaves: l.suaves })), arrastos: arrastos.map((a) => ({ modelo: a.modelo.id, variante: a.variante, passo: a.passo, suave: a.suave.id, medio: a.medio, max: a.max, assenta: a.assenta, resto: a.resto })) }, null, 2));
console.log('\nresultados/video-comparar.html');
