// Monta quarto.html: o quarto na base sem porta (pl-512-janela-1), com os móveis recortados e a vista atrás do vidro,
// ao lado do conceito, de dia e de noite. A montagem acontece na própria página, num canvas, porque o pufe se arrasta:
//   - de dia, cada móvel é o recorte pintado; o pufe usa a versão pintada mais perto de onde está e só ganha a
//     INTENSIDADE da luz do lugar novo;
//   - de noite, o fundo é a noite montada (noite.mjs) com a luz do abajur pintada (noite-abajur.mjs), e os móveis são a
//     cor do dia vezes a razão noite/dia;
//   - a vista (../janela/) entra nos pixels do vidro, espelhada, e troca com a hora.
//   node e2e/pixel-art/quarto/novo/quarto/montar.mjs   → quarto.html
import fs from 'node:fs';
import path from 'node:path';
import { ler64 } from '../../imagem.mjs';
import { CANTOS, N } from './chao.mjs';
import { FIXOS, PUFES } from './lista.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const png = (arquivo) => 'data:image/png;base64,' + ler64(arquivo);
const IMAGENS = {
  base: png(path.join(AQUI, '..', 'bases', 'pl-512-janela-1.png')),
  vidro: png(path.join(AQUI, '..', 'janela', 'vidro.png')),
  vistaNoite: png(path.join(AQUI, '..', 'janela', 'vista-noite.png')),
  ...Object.fromEntries([1, 2, 3, 4].map((n) => ['vista' + n, png(path.join(AQUI, '..', 'janela', `vista-dia-${n}.png`))])),
  noite: png(path.join(AQUI, 'noite.png')),
  noiteAbajur: png(path.join(AQUI, 'noite-abajur.png')),
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
<title>Quarto do coelho</title>
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
<h1>O quarto do coelho</h1>
<p>À esquerda, o quarto: a base sem porta do PixelLab, com a cama, o criado-mudo com abajur, a estante, o tapete e o
pufe pintados dentro dela e recortados, e a paisagem atrás do vidro. À direita, o conceito do ChatGPT. <b>Arraste o pufe</b>
pelo chão: ele usa a versão pintada mais perto (perto da janela, no meio, na frente) e a intensidade da luz do lugar.</p>
<div class="barra">
  <button id="dia" aria-pressed="true">Dia</button><button id="noite" aria-pressed="false">Noite</button>
  <button id="grade" aria-pressed="false">Mostrar a grade</button>
  <button id="luz" aria-pressed="true">Luz do abajur à noite: pintada</button>
  <button id="vista" aria-pressed="false">Vista: 1</button>
</div>
<div class="lado">
  <figure><canvas id="tela" width="512" height="512" aria-label="O quarto do coelho"></canvas><figcaption id="legenda"></figcaption></figure>
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
function dados(im, filtro, w = W, h = W) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (filtro) g.filter = filtro;
  g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data;
}

(async () => {
  const im = {};
  for (const [k, src] of Object.entries(IMAGENS)) im[k] = await carregar(src);
  const base = dados(im.base), noite = dados(im.noite);
  // A vista: os pixels do vidro, e as paisagens (128 × 160), postas espelhadas em (330, 105), como em ../janela/.
  const vidro = dados(im.vidro), vistaNoite = dados(im.vistaNoite, null, 128, 160);
  const vistasDia = [1, 2, 3, 4].map((n) => dados(im['vista' + n], null, 128, 160));
  let vista = 0;
  const daVista = (v, x, y, c) => v[((y - 105) * 128 + (127 - (x - 330))) * 4 + c];
  // A luz, sem a cor das coisas: o quarto vazio borrado (a textura das tábuas some). Para o pufe de dia, bem
  // borrado (só o nível de luz do lugar); para a razão noite/dia, pouco, senão o desenho do luar some no tapete.
  const diaBorrado = dados(im.base, 'blur(10px)');
  const diaPouco = dados(im.base, 'blur(2px)'), noitePouco = dados(im.noite, 'blur(2px)');
  // A noite com a luz do abajur pintada (noite-abajur.mjs): o criado-mudo já está nela, aceso.
  const noiteAbajur = dados(im.noiteAbajur), noiteAbajurPouco = dados(im.noiteAbajur, 'blur(2px)');
  // A repintura veio numa caixa, e a borda reta dela aparece na parede: perto da borda, mistura com a noite limpa.
  const CAIXA_ABAJUR = [190, 100, 322, 292], FAIXA = 14; // a de noite-abajur.mjs
  for (const [img, ref] of [[noiteAbajur, noite], [noiteAbajurPouco, noitePouco]]) for (let k = 0; k < W * W; k++) {
    const x = k % W, y = (k / W) | 0, [x0, y0, x1, y1] = CAIXA_ABAJUR;
    const borda = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
    if (borda < 0 || borda >= FAIXA) continue;
    const t = (borda + 1) / (FAIXA + 1);
    for (let c = 0; c < 3; c++) img[k * 4 + c] = img[k * 4 + c] * t + ref[k * 4 + c] * (1 - t);
  }
  let luzPintada = true;
  // O cinza em volta do quarto (o fundo da base) fica transparente.
  // O cinza em volta do quarto fica transparente, preenchido a partir da borda e com folga de cor (só o cinza exato
  // deixava pontinhos claros). Um para cada versão: a noite, feita por edição, tem o contorno 1 ou 2 px diferente.
  function fundoDe(img) {
    const fora = new Uint8Array(W * W), fila = [];
    const parecido = (k) => [0, 1, 2].every((c) => Math.abs(img[k * 4 + c] - img[c]) < 24);
    for (let i = 0; i < W; i++) for (const k of [i, (W - 1) * W + i, i * W, i * W + W - 1]) if (!fora[k] && parecido(k)) { fora[k] = 1; fila.push(k); }
    for (let q = 0; q < fila.length; q++) {
      const k = fila[q], x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy, b = yy * W + xx;
        if (xx >= 0 && yy >= 0 && xx < W && yy < W && !fora[b] && parecido(b)) { fora[b] = 1; fila.push(b); }
      }
    }
    return fora;
  }
  const foraDia = fundoDe(base), foraNoite = fundoDe(noite);
  const pecas = {};
  for (const m of MOVEIS) {
    const movel = dados(im[m.id]), sombra = dados(im[m.id + '-sombra']);
    let x0 = W, y0 = W, x1 = 0;
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) { const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
    // O centro do alto da peça (no abajur, a cúpula): a média dos x das 8 primeiras linhas.
    let soma = 0, n = 0;
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3] && ((k / W) | 0) < y0 + 8) { soma += k % W; n++; }
    // A base DESENHADA (para o pufe): o ponto mais baixo da peça é a frente do círculo de baixo; o centro dele fica
    // meio pufe (0,75 casa em u e em v) para trás. A caixa pedida à ferramenta não serve: ela o desenhou deslocado.
    let y1 = 0; for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) y1 = Math.max(y1, (k / W) | 0);
    let sx = 0, nb = 0; for (let x = 0; x < W; x++) for (let y = y1 - 2; y <= y1; y++) if (movel[(y * W + x) * 4 + 3]) { sx += x; nb++; }
    const [cu0, cv0] = [(m.pe[0] + m.pe[1]) / 2, (m.pe[2] + m.pe[3]) / 2];
    const [ax, ay] = ponto(cu0, cv0), [bx, by] = ponto(cu0 + 0.75, cv0 + 0.75);
    const base = [sx / Math.max(1, nb) - (bx - ax), y1 - (by - ay)];
    pecas[m.id] = { ...m, movel, sombra, topo: y0, centroX: (x0 + x1) / 2, centroTopo: soma / Math.max(1, n), base };
  }
  // O pufe: onde está (o centro em u, v) e de que versão ele sai.
  const pufes = MOVEIS.filter((m) => m.pufe);
  const centro = (pe) => [(pe[0] + pe[1]) / 2, (pe[2] + pe[3]) / 2];
  let pufe = centro(pecas['pufe-meio'].pe).map(Math.round), modo = 'dia', grade = false, arrastando = false, alvo = null;
  // O pufe ocupa 2×2 casas e o centro dele fica num cruzamento da grade: assim a área acesa ao arrastar é
  // exatamente quatro casas desenhadas. Antes ele tinha 1,5 casa e saltava de meia em meia, fora das linhas.
  const LADO_PUFE = 2;
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
    const pintada = modo === 'noite' && luzPintada, fundoN = pintada ? noiteAbajur : noite, razaoN = pintada ? noiteAbajurPouco : noitePouco;
    for (let k = 0; k < W * W; k++) for (let c = 0; c < 3; c++) { D[k * 3 + c] = base[k * 4 + c]; fundoNoite[k * 3 + c] = fundoN[k * 4 + c]; }
    // A paisagem atrás do vidro, com um véu leve da cor do vidro (de dia, creme; de noite, azul).
    for (let k = 0; k < W * W; k++) if (vidro[k * 4 + 3] > 127) {
      const x = k % W, y = (k / W) | 0;
      for (let c = 0; c < 3; c++) {
        D[k * 3 + c] = daVista(vistasDia[vista], x, y, c) * 0.88 + [250, 243, 224][c] * 0.12;
        fundoNoite[k * 3 + c] = daVista(vistaNoite, x, y, c) * 0.9 + [40, 46, 80][c] * 0.1;
      }
    }
    // A ordem: o tapete primeiro; depois de trás para a frente, pela casa mais à frente do pé.
    const [pu, pv] = pufe;
    const variante = pufes.reduce((a, b) => { const d = (m) => Math.hypot(centro(m.pe)[0] - pu, centro(m.pe)[1] - pv); return d(a) <= d(b) ? a : b; });
    const lista = [...fixos.map((m) => ({ p: pecas[m.id], dx: 0, dy: 0, fator: 1, frente: m.deitado ? -1 : m.pe[1] + m.pe[3] })),
      (() => {
        const p = pecas[variante.id], [cu, cv] = centro(p.pe);
        const [ox, oy] = p.base, [nx, ny] = ponto(pu, pv);
        // Só intensidade: a luz do chão onde ele está, sobre a luz do chão onde ele foi pintado.
        const fator = Math.min(1.3, Math.max(0.75, luz(nx, ny) / luz(ox, oy)));
        return { p, dx: Math.round(nx - ox), dy: Math.round(ny - oy), fator, frente: pu + pv + LADO_PUFE };
      })()].sort((a, b) => a.frente - b.frente);
    for (const { p, dx, dy, fator } of lista) {
      // Com a luz pintada, o criado-mudo da noite pintada NÃO é usado: a repintura o redesenhou uns pixels ao lado, e
      // ao trocar dia e noite ele parecia empurrar a cabeceira. Vale o mesmo recorte do dia, com a luz da pintura.
      for (let k = 0; k < W * W; k++) {
        const x = k % W + dx, y = ((k / W) | 0) + dy;
        if (x < 0 || y < 0 || x >= W || y >= W) continue;
        const d = y * W + x, a = p.sombra[k * 4 + 3];
        if (a) { const f = 1 - a / 255; for (let c = 0; c < 3; c++) { D[d * 3 + c] *= f; fundoNoite[d * 3 + c] *= f; } }
        if (p.movel[k * 4 + 3]) {
          for (let c = 0; c < 3; c++) D[d * 3 + c] = p.movel[k * 4 + c] * fator;
          eMovel[d] = 1;
          // A cúpula do abajur (o alto da peça) é luz, não superfície: de noite ela não escurece.
          // A cúpula do abajur é luz: o alto da peça, nas cores claras. O abajur foi pintado APAGADO, e quem acende
          // é o código (na v1 ele veio aceso, com um halo recortado que brigava com esta luz).
          const m4 = k * 4;
          if (p.id === 'abajur' && y < p.topo + 12 && p.movel[m4] + p.movel[m4 + 1] + p.movel[m4 + 2] > 360) acesa[d] = 1;
        }
      }
    }
    const saida = g.createImageData(W, W);
    const ab = pecas.abajur, lx = ab.centroTopo, ly = ab.topo + 6;
    for (let k = 0; k < W * W; k++) {
      const x = k % W, y = (k / W) | 0;
      for (let c = 0; c < 3; c++) {
        let v = D[k * 3 + c];
        if (modo === 'noite') {
          // Com a luz pintada, os móveis só herdam a razão noite/dia (que já traz o abajur). Com a luz por código:
          // quente, caindo com a distância, em faixas como a luz é desenhada em pixel art.
          const brilho = pintada ? 0 : Math.floor(0.85 * Math.exp(-((x - lx) ** 2 + ((y - ly) * 1.4) ** 2) / (2 * 85 * 85)) * 12) / 12;
          const quente = [1, 0.72, 0.42][c] * brilho;
          if (acesa[k]) v = Math.min(255, v * [1.05, 0.8, 0.5][c] + [34, 14, 0][c]); // a cúpula acesa, laranja como na pintura
          else if (eMovel[k]) v = v * Math.min(pintada ? 1.2 : 0.9, razaoN[k * 4 + c] / Math.max(1, diaPouco[k * 4 + c])) + v * quente;
          else v = fundoNoite[k * 3 + c] + base[k * 4 + c] * quente;
        }
        saida.data[k * 4 + c] = Math.min(255, v);
      }
      saida.data[k * 4 + 3] = (modo === 'dia' ? foraDia : foraNoite)[k] && !eMovel[k] ? 0 : 255;
      // O destino do arraste, pintado nas próprias casas (pixel a pixel, sem polígono suavizado).
      if (alvo && casa[k] >= 0) {
        const i = Math.floor(casa[k] / N), j = casa[k] % N;
        if (i >= alvo[0] - 1 && i < alvo[0] + 1 && j >= alvo[1] - 1 && j < alvo[1] + 1) {
          const cor = ocupa(alvo) ? [220, 80, 60] : [255, 240, 200];
          for (let c = 0; c < 3; c++) saida.data[k * 4 + c] = saida.data[k * 4 + c] * 0.65 + cor[c] * 0.35;
        }
      }
      if ((grade || alvo) && casa[k] >= 0 && !eMovel[k]) {
        const direita = x + 1 < W ? casa[k + 1] : -1, baixo = y + 1 < W ? casa[k + W] : -1;
        const cima = y > 0 ? casa[k - W] : -1;
        if ((direita !== casa[k] && direita >= 0) || (baixo !== casa[k] && baixo >= 0)) for (let c = 0; c < 3; c++) saida.data[k * 4 + c] = Math.min(255, saida.data[k * 4 + c] * 1.35 + 18);
        else if (cima >= 0 && cima !== casa[k]) for (let c = 0; c < 3; c++) saida.data[k * 4 + c] *= 0.7;
      }
    }
    g.putImageData(saida, 0, 0);
    document.getElementById('legenda').textContent = 'Pufe: versão "' + variante.id.replace('pufe-', '') + '"' + (modo === 'dia' ? ', luz do lugar ×' + lista.find((i) => i.p.pufe).fator.toFixed(2) : '') + '.';
    document.getElementById('conceito').src = modo === 'dia' ? IMAGENS.conceitoDia : IMAGENS.conceitoNoite;
  }

  // Arrastar: o centro do pufe salta de cruzamento em cruzamento da grade, e só para onde cabe. A grade aparece
  // enquanto se arrasta.
  const casaDoPonteiro = (e) => {
    const r = tela.getBoundingClientRect();
    const [u, v] = uvDe((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * W / r.height);
    return [Math.round(u), Math.round(v)];
  };
  tela.addEventListener('pointerdown', (e) => { arrastando = true; tela.setPointerCapture(e.pointerId); alvo = casaDoPonteiro(e); desenhar(); });
  tela.addEventListener('pointermove', (e) => { if (!arrastando) return; const c = casaDoPonteiro(e); if (!alvo || c[0] !== alvo[0] || c[1] !== alvo[1]) { alvo = c; desenhar(); } });
  tela.addEventListener('pointerup', () => { arrastando = false; if (alvo && !ocupa(alvo)) pufe = alvo; alvo = null; desenhar(); });
  const botoes = { dia: document.getElementById('dia'), noite: document.getElementById('noite') };
  for (const [m, b] of Object.entries(botoes)) b.onclick = () => { modo = m; for (const [n, o] of Object.entries(botoes)) o.setAttribute('aria-pressed', String(n === m)); desenhar(); };
  const bg = document.getElementById('grade');
  bg.onclick = () => { grade = !grade; bg.setAttribute('aria-pressed', String(grade)); desenhar(); };
  const bv = document.getElementById('vista');
  bv.onclick = () => { vista = (vista + 1) % 4; bv.textContent = 'Vista: ' + (vista + 1) + (vista ? ' (de noite, a 1)' : ''); desenhar(); };
  const bl = document.getElementById('luz');
  bl.onclick = () => { luzPintada = !luzPintada; bl.setAttribute('aria-pressed', String(luzPintada)); bl.textContent = 'Luz do abajur à noite: ' + (luzPintada ? 'pintada' : 'por código'); desenhar(); };
  desenhar();
})();
</script>
</body></html>
`;
fs.writeFileSync(path.join(AQUI, 'quarto.html'), html);
console.log('quarto.html', Math.round(html.length / 1024), 'KB');
