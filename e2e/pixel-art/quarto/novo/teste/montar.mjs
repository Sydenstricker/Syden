// Monta teste.html: o quarto novo (base pl-512-sem-1) com os móveis recortados, posto ao lado do conceito, de dia e
// de noite. A montagem acontece na própria página, num canvas, porque o pufe se arrasta pela grade:
//   - de dia, cada móvel é o recorte pintado; o pufe usa a versão pintada mais perto de onde está e só ganha a
//     INTENSIDADE da luz do lugar novo (a razão entre a luz do chão lá e onde ele foi pintado);
//   - de noite, o fundo é a noite pintada (noite.png), os móveis são a cor do dia vezes a razão noite/dia do quarto
//     vazio (o que cancela a cor do chão e deixa só a luz), e o abajur acende por código.
//   node e2e/pixel-art/quarto/novo/teste/montar.mjs   → teste.html
import fs from 'node:fs';
import path from 'node:path';
import { ler64 } from '../../imagem.mjs';
import { CANTOS, N } from './chao.mjs';
import { FIXOS, PUFES } from './lista.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const png = (arquivo) => 'data:image/png;base64,' + ler64(arquivo);
const IMAGENS = {
  base: png(path.join(AQUI, '..', 'bases', 'pl-512-sem-1.png')),
  noite: png(path.join(AQUI, 'noite.png')),
  conceitoNoite: png(path.join(AQUI, '..', '..', 'hibrido', 'conceito-unzoom.png')),
  conceitoDia: png(path.join(AQUI, '..', '..', 'hibrido', 'dia.png')),
};
const MOVEIS = [...FIXOS, ...PUFES].map((m) => ({ id: m.id, pe: m.pe, deitado: !!m.deitado, pufe: m.id.startsWith('pufe') }));
for (const m of MOVEIS) {
  IMAGENS[m.id] = png(path.join(AQUI, 'pecas', m.id + '.png'));
  IMAGENS[m.id + '-sombra'] = png(path.join(AQUI, 'pecas', m.id + '-sombra.png'));
}

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quarto novo: teste</title>
<style>
  :root { --fundo: #2a2522; --texto: #efe6dc; --suave: #b9ab9c; --botao: #4a3f38; --ativo: #8a6a4a; }
  body { margin: 0; background: var(--fundo); color: var(--texto); font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 1240px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 12px; color: var(--suave); max-width: 80ch; }
  .barra { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  button { background: var(--botao); color: var(--texto); border: 0; border-radius: 6px; padding: 8px 14px; font: inherit; cursor: pointer; }
  button[aria-pressed="true"] { background: var(--ativo); }
  .lado { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 760px) { .lado { grid-template-columns: 1fr; } }
  figure { margin: 0; }
  figcaption { color: var(--suave); font-size: 13px; margin-top: 4px; }
  canvas, .lado img { width: 100%; aspect-ratio: 1; image-rendering: pixelated; display: block; }
  canvas { cursor: grab; touch-action: none; }
</style></head>
<body><main>
<h1>Quarto novo: base com móveis, luz por código</h1>
<p>À esquerda, o teste: a base <b>pl-512-sem-1</b> do PixelLab, com o criado-mudo e abajur, a cama, a estante, o tapete
e o pufe pintados dentro dela e depois recortados. À direita, o conceito do ChatGPT convertido para pixel art. <b>Arraste o
pufe</b> pelo chão: ele usa a versão pintada mais perto (há três: perto da janela, no meio e na frente) e a intensidade da luz do
lugar novo.</p>
<div class="barra">
  <button id="dia" aria-pressed="true">Dia</button><button id="noite" aria-pressed="false">Noite</button>
  <button id="grade" aria-pressed="false">Mostrar a grade</button>
</div>
<div class="lado">
  <figure><canvas id="tela" width="512" height="512" aria-label="O quarto do teste"></canvas><figcaption id="legenda"></figcaption></figure>
  <figure><img id="conceito" alt="O conceito"><figcaption>Conceito (ChatGPT), convertido para pixel art. A versão de dia é a repintura do quarto híbrido.</figcaption></figure>
</div>
</main>
<script>
const IMAGENS = ${JSON.stringify(IMAGENS)};
const MOVEIS = ${JSON.stringify(MOVEIS)};
const CANTOS = ${JSON.stringify(CANTOS)}, N = ${N};
const W = 512;
function ponto(u, v) {
  const a = u / N, b = v / N, { fundo: B, esquerda: L, direita: R, frente: F } = CANTOS;
  return [0, 1].map((k) => B[k] * (1 - a) * (1 - b) + L[k] * a * (1 - b) + R[k] * (1 - a) * b + F[k] * a * b);
}
// O inverso: de um pixel para (u, v), pelo método de Newton na interpolação bilinear.
function uvDe(x, y) {
  let u = 4, v = 4;
  for (let i = 0; i < 12; i++) {
    const [px, py] = ponto(u, v), e = 0.01;
    const [ax, ay] = ponto(u + e, v), [bx, by] = ponto(u, v + e);
    const j11 = (ax - px) / e, j21 = (ay - py) / e, j12 = (bx - px) / e, j22 = (by - py) / e;
    const det = j11 * j22 - j12 * j21, dx = x - px, dy = y - py;
    u += (j22 * dx - j12 * dy) / det; v += (-j21 * dx + j11 * dy) / det;
  }
  return [u, v];
}
const carregar = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = src; });
function dados(im, filtro) {
  const c = document.createElement('canvas'); c.width = W; c.height = W; const g = c.getContext('2d');
  if (filtro) g.filter = filtro;
  g.drawImage(im, 0, 0); return g.getImageData(0, 0, W, W).data;
}

(async () => {
  const im = {};
  for (const [k, src] of Object.entries(IMAGENS)) im[k] = await carregar(src);
  const base = dados(im.base), noite = dados(im.noite);
  // A luz, sem a cor das coisas: o quarto vazio borrado (a textura das tábuas some). Para o pufe de dia, bem
  // borrado (só o nível de luz do lugar); para a razão noite/dia, pouco, senão o desenho do luar some no tapete.
  const diaBorrado = dados(im.base, 'blur(10px)');
  const diaPouco = dados(im.base, 'blur(2px)'), noitePouco = dados(im.noite, 'blur(2px)');
  // O cinza em volta do quarto (o fundo da base) fica transparente.
  const fora = new Uint8Array(W * W);
  for (let k = 0; k < W * W; k++) if (['0', '1', '2'].every((c) => Math.abs(base[k * 4 + +c] - base[+c]) < 3)) fora[k] = 1;
  const pecas = {};
  for (const m of MOVEIS) {
    const movel = dados(im[m.id]), sombra = dados(im[m.id + '-sombra']);
    let x0 = W, y0 = W, x1 = 0;
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) { const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
    pecas[m.id] = { ...m, movel, sombra, topo: y0, centroX: (x0 + x1) / 2 };
  }
  // O pufe: onde está (o centro em u, v) e de que versão ele sai.
  const pufes = MOVEIS.filter((m) => m.pufe);
  const centro = (pe) => [(pe[0] + pe[1]) / 2, (pe[2] + pe[3]) / 2];
  let pufe = centro(pecas['pufe-meio'].pe), modo = 'dia', grade = false, arrastando = false, alvo = null;
  const LADO_PUFE = 1.5;
  const fixos = MOVEIS.filter((m) => !m.pufe);
  const ocupa = (c) => {
    const [u0, u1, v0, v1] = [c[0] - LADO_PUFE / 2, c[0] + LADO_PUFE / 2, c[1] - LADO_PUFE / 2, c[1] + LADO_PUFE / 2];
    if (u0 < 0 || v0 < 0 || u1 > N || v1 > N) return true;
    return fixos.some((m) => !m.deitado && u0 < m.pe[1] && u1 > m.pe[0] && v0 < m.pe[3] && v1 > m.pe[2]);
  };
  const luz = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return (diaBorrado[i] + diaBorrado[i + 1] + diaBorrado[i + 2]) / 3; };

  // A grade em pixel: a casa de cada pixel do chão; a borda é onde a casa muda.
  const casa = new Int16Array(W * W).fill(-1);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const [u, v] = uvDe(x + 0.5, y + 0.5);
    if (u >= 0 && v >= 0 && u < N && v < N) casa[y * W + x] = Math.floor(u) * N + Math.floor(v);
  }

  const tela = document.getElementById('tela'), g = tela.getContext('2d');
  function desenhar() {
    const D = new Float32Array(W * W * 3); // a cena com as cores do dia
    const eMovel = new Uint8Array(W * W), acesa = new Uint8Array(W * W);
    const fundoNoite = new Float32Array(W * W * 3);
    for (let k = 0; k < W * W; k++) for (let c = 0; c < 3; c++) { D[k * 3 + c] = base[k * 4 + c]; fundoNoite[k * 3 + c] = noite[k * 4 + c]; }
    // A ordem: o tapete primeiro; depois de trás para a frente, pela casa mais à frente do pé.
    const [pu, pv] = pufe;
    const variante = pufes.reduce((a, b) => { const d = (m) => Math.hypot(centro(m.pe)[0] - pu, centro(m.pe)[1] - pv); return d(a) <= d(b) ? a : b; });
    const lista = [...fixos.map((m) => ({ p: pecas[m.id], dx: 0, dy: 0, fator: 1, frente: m.deitado ? -1 : m.pe[1] + m.pe[3] })),
      (() => {
        const p = pecas[variante.id], [cu, cv] = centro(p.pe);
        const [ox, oy] = ponto(cu, cv), [nx, ny] = ponto(pu, pv);
        // Só intensidade: a luz do chão onde ele está, sobre a luz do chão onde ele foi pintado.
        const fator = Math.min(1.3, Math.max(0.75, luz(nx, ny) / luz(ox, oy)));
        return { p, dx: Math.round(nx - ox), dy: Math.round(ny - oy), fator, frente: pu + pv + LADO_PUFE };
      })()].sort((a, b) => a.frente - b.frente);
    for (const { p, dx, dy, fator } of lista) {
      for (let k = 0; k < W * W; k++) {
        const x = k % W + dx, y = ((k / W) | 0) + dy;
        if (x < 0 || y < 0 || x >= W || y >= W) continue;
        const d = y * W + x, a = p.sombra[k * 4 + 3];
        if (a) { const f = 1 - a / 255; for (let c = 0; c < 3; c++) { D[d * 3 + c] *= f; fundoNoite[d * 3 + c] *= f; } }
        if (p.movel[k * 4 + 3]) {
          for (let c = 0; c < 3; c++) D[d * 3 + c] = p.movel[k * 4 + c] * fator;
          eMovel[d] = 1;
          // A cúpula do abajur (o alto da peça) é luz, não superfície: de noite ela não escurece.
          if (p.id === 'abajur' && y < p.topo + 26) acesa[d] = 1;
        }
      }
    }
    const saida = g.createImageData(W, W);
    const ab = pecas.abajur, lx = ab.centroX, ly = ab.topo + 14;
    for (let k = 0; k < W * W; k++) {
      const x = k % W, y = (k / W) | 0;
      for (let c = 0; c < 3; c++) {
        let v = D[k * 3 + c];
        if (modo === 'noite') {
          // A luz do abajur: quente, caindo com a distância. Soma luz proporcional à cor do que ilumina.
          const brilho = 0.85 * Math.exp(-((x - lx) ** 2 + ((y - ly) * 1.4) ** 2) / (2 * 85 * 85));
          const quente = [1, 0.72, 0.42][c] * brilho;
          if (acesa[k]) v = Math.min(255, v * 1.08);
          else if (eMovel[k]) v = v * Math.min(1.6, noitePouco[k * 4 + c] / Math.max(1, diaPouco[k * 4 + c])) + v * quente;
          else v = fundoNoite[k * 3 + c] + base[k * 4 + c] * quente;
        }
        saida.data[k * 4 + c] = Math.min(255, v);
      }
      saida.data[k * 4 + 3] = fora[k] && !eMovel[k] ? 0 : 255;
      if (grade && casa[k] >= 0 && !eMovel[k]) {
        const direita = x + 1 < W ? casa[k + 1] : -1, baixo = y + 1 < W ? casa[k + W] : -1;
        const cima = y > 0 ? casa[k - W] : -1;
        if ((direita !== casa[k] && direita >= 0) || (baixo !== casa[k] && baixo >= 0)) for (let c = 0; c < 3; c++) saida.data[k * 4 + c] = Math.min(255, saida.data[k * 4 + c] * 1.35 + 18);
        else if (cima >= 0 && cima !== casa[k]) for (let c = 0; c < 3; c++) saida.data[k * 4 + c] *= 0.7;
      }
    }
    g.putImageData(saida, 0, 0);
    if (alvo) {
      const [cu, cv] = alvo, h = LADO_PUFE / 2;
      g.beginPath(); [[-h, -h], [h, -h], [h, h], [-h, h]].forEach(([a, b], i) => { const [px, py] = ponto(cu + a, cv + b); i ? g.lineTo(px, py) : g.moveTo(px, py); });
      g.closePath(); g.fillStyle = ocupa(alvo) ? 'rgba(220,80,60,.35)' : 'rgba(255,240,200,.3)'; g.fill();
    }
    document.getElementById('legenda').textContent = 'Teste. Pufe: versão "' + variante.id.replace('pufe-', '') + '"' + (modo === 'dia' ? ', luz do lugar ×' + lista.find((i) => i.p.pufe).fator.toFixed(2) : '') + '.';
    document.getElementById('conceito').src = modo === 'dia' ? IMAGENS.conceitoDia : IMAGENS.conceitoNoite;
  }

  // Arrastar: o centro do pufe salta de meia em meia casa, e só para onde cabe.
  const casaDoPonteiro = (e) => {
    const r = tela.getBoundingClientRect();
    const [u, v] = uvDe((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * W / r.height);
    return [Math.round(u * 2) / 2, Math.round(v * 2) / 2];
  };
  tela.addEventListener('pointerdown', (e) => { arrastando = true; tela.setPointerCapture(e.pointerId); alvo = casaDoPonteiro(e); desenhar(); });
  tela.addEventListener('pointermove', (e) => { if (!arrastando) return; const c = casaDoPonteiro(e); if (!alvo || c[0] !== alvo[0] || c[1] !== alvo[1]) { alvo = c; desenhar(); } });
  tela.addEventListener('pointerup', () => { arrastando = false; if (alvo && !ocupa(alvo)) pufe = alvo; alvo = null; desenhar(); });
  const botoes = { dia: document.getElementById('dia'), noite: document.getElementById('noite') };
  for (const [m, b] of Object.entries(botoes)) b.onclick = () => { modo = m; for (const [n, o] of Object.entries(botoes)) o.setAttribute('aria-pressed', String(n === m)); desenhar(); };
  const bg = document.getElementById('grade');
  bg.onclick = () => { grade = !grade; bg.setAttribute('aria-pressed', String(grade)); desenhar(); };
  desenhar();
})();
</script>
</body></html>
`;
fs.writeFileSync(path.join(AQUI, 'teste.html'), html);
console.log('teste.html', Math.round(html.length / 1024), 'KB');
