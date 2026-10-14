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
  cortinaDia: png(path.join(AQUI, 'cortina-dia.png')), cortinaNoite: png(path.join(AQUI, 'cortina-noite.png')),
  janelaAberta: png(path.join(AQUI, 'janela-aberta-dia.png')),
  // A poltrona solta, em duas orientações PINTADAS (avulso.mjs), a mesma poltrona de orelha: a 0 olha para a
  // esquerda, a 1 para a direita.
  // AS 4 POSIÇÕES DA POLTRONA (girar.mjs, 14/10/2026): as 4 diagonais do mesmo móvel, na ordem do botão Girar.
  poltrona0: png(path.join(AQUI, 'avulsos', 'poltrona-giros', 'south-west.png')),
  poltrona1: png(path.join(AQUI, 'avulsos', 'poltrona-giros', 'north-west.png')),
  poltrona2: png(path.join(AQUI, 'avulsos', 'poltrona-giros', 'north-east.png')),
  poltrona3: png(path.join(AQUI, 'avulsos', 'poltrona-giros', 'south-east.png')),
  ...Object.fromEntries([1, 2, 3, 4].map((n) => ['vista' + n, png(path.join(AQUI, '..', 'janela', `vista-dia-${n}.png`))])),
  ...Object.fromEntries([1, 2, 3, 4].map((n) => ['noite' + n, png(path.join(AQUI, '..', 'janela', `vista-noite-${n}.png`))])),
  noite: png(path.join(AQUI, 'noite.png')),
  noiteAbajur: png(path.join(AQUI, 'noite-abajur.png')),
  conceitoNoite: png(path.join(AQUI, '..', '..', 'hibrido', 'conceito-unzoom.png')),
  conceitoDia: png(path.join(AQUI, '..', '..', 'hibrido', 'dia.png')),
  // O COELHO PROVISÓRIO (14/10/2026): o do recado do salão, de frente, até o mascote isométrico nascer
  // (e2e/pixel-art/personagem/README.md). Serve para testar a estrutura: pontos, caminhada, ordem e luz.
  coelho: png(path.join(AQUI, '..', '..', '..', '..', '..', 'web', 'src', 'assets', 'salao', 'coelho-do-recado.png')),
};
// O MASCOTE ISOMÉTRICO (personagem/mascote/baixa-120, 14/10/2026): as 4 diagonais, paradas. Os nomes do PixelLab
// (south-east...) viram os do README (sudeste...).
const MASCOTE = path.join(AQUI, '..', '..', '..', 'personagem', 'mascote', 'baixa-120');
// AS ANIMAÇÕES DO MASCOTE (personagem/animar.mjs e estado.mjs): para cada animação, as pastas em ordem de preferência;
// cada direção vem da primeira que a tiver. Uma pasta com <direção>-<n>.png é uma animação; com <direção>.png, uma pose.
const PERS = path.join(AQUI, '..', '..', '..', 'personagem', 'mascote');
const FONTES = {
  andando: ['baixa-120/animacoes/andando-v3', 'baixa-120/animacoes/andando-v3b'],
  parado: ['baixa-120/animacoes/parado', 'baixa-120'],
  falando: ['baixa-120/animacoes/falando'],
  sentado: ['estados/sentado-2', 'estados/sentado'],
  lendo: ['estados/lendo'],
  dormindo: ['estados/dormindo'],
};
const DELES = { sudeste: 'south-east', sudoeste: 'south-west', nordeste: 'north-east', noroeste: 'north-west' };
const ANIMACOES = {};
for (const [nome, pastas] of Object.entries(FONTES)) {
  ANIMACOES[nome] = {};
  for (const [nossa, deles] of Object.entries(DELES)) {
    for (const p of pastas) {
      const dir = path.join(PERS, p);
      if (!fs.existsSync(dir)) continue;
      const quadros = fs.readdirSync(dir).filter((f) => f.startsWith(deles + '-') && /-\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/-(\d+)\.png$/)[1]) - Number(b.match(/-(\d+)\.png$/)[1]));
      const lista = quadros.length ? quadros : fs.existsSync(path.join(dir, deles + '.png')) ? [deles + '.png'] : [];
      if (lista.length) { ANIMACOES[nome][nossa] = lista.map((f) => png(path.join(dir, f))); break; }
    }
  }
}
for (const [nosso, deles] of [['sudeste', 'south-east'], ['sudoeste', 'south-west'], ['nordeste', 'north-east'], ['noroeste', 'north-west']]) {
  IMAGENS['mascote-' + nosso] = png(path.join(MASCOTE, deles + '.png'));
}
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
<p>À esquerda, o quarto: a base sem porta do PixelLab, com a cama, o criado-mudo com abajur, o guarda-roupa, o tapete e o
pufe pintados dentro dela e recortados, e a paisagem atrás do vidro. À direita, o conceito do ChatGPT. <b>Arraste o pufe</b>
pelo chão: ele usa a versão pintada mais perto (perto da janela, no meio, na frente) e a intensidade da luz do lugar.
A <b>poltrona</b> também se arrasta, e <b>Girar</b> (ou a tecla R) troca o lado para onde ela olha.</p>
<div class="barra">
  <button id="dia" aria-pressed="true">Dia</button><button id="noite" aria-pressed="false">Noite</button>
  <button id="grade" aria-pressed="false">Mostrar a grade</button>
  <button id="luz" aria-pressed="true">Luz do abajur à noite: pintada</button>
  <button id="vista" aria-pressed="false">Vista: 1</button>
  <button id="girar">Girar a poltrona</button>
  <button id="janela" aria-pressed="false">Janela: fechada</button>
  <button id="cortina" aria-pressed="false">Cortina: aberta</button>
</div>
<p><b>O coelho</b>: o mascote isométrico, com as animações dele (andando, parado, falando) e as poses (sentado, lendo,
dormindo), todas do mesmo personagem, no mesmo quadro e com a mesma âncora. A sombra vem da janela (de dia) ou do
abajur (de noite). O estado decide o
lugar; <b>clicar num móvel</b> (sem arrastar) o leva até ele; arrastar o pufe ou a poltrona com ele sentado leva o
coelho junto. Ver e2e/pixel-art/personagem/README.md.</p>
<div class="barra" id="estados">
  <button data-estado="atoa" aria-pressed="true">À toa</button>
  <button data-estado="call" aria-pressed="false">Em call</button>
  <button data-estado="ausente" aria-pressed="false">Ausente</button>
  <button id="falando" aria-pressed="false">Falando</button>
  <button id="semAndar" aria-pressed="false">Sem caminhada</button>
</div>
<div class="lado">
  <figure><canvas id="tela" width="512" height="512" aria-label="O quarto do coelho"></canvas><figcaption id="legenda"></figcaption></figure>
  <figure><img id="conceito" alt="O conceito"><figcaption>Conceito (ChatGPT), convertido para pixel art. A versão de dia é a repintura do quarto híbrido.</figcaption></figure>
</div>
</main>
<script>
const IMAGENS = ${JSON.stringify(IMAGENS)};
const MOVEIS = ${JSON.stringify(MOVEIS)};
const ANIMACOES = ${JSON.stringify(ANIMACOES)};
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
  const vidro = dados(im.vidro);
  const vistasNoite = [1, 2, 3, 4].map((n) => dados(im['noite' + n], null, 128, 160));
  const vistasDia = [1, 2, 3, 4].map((n) => dados(im['vista' + n], null, 128, 160));
  let vista = 0;
  // A CORTINA (cortina.mjs): fechada, a região da janela vem da repintura com as cortinas fechadas, a vista some, o luar
  // sai do chão e, de dia, o quarto escurece um pouco. Clicar na janela abre e fecha.
  // A região repintada e a barra (a ponta de baixo da cortina, que o original deixava aparecer: ver cortina.mjs).
  const REGIOES = [[[276, 64], [466, 158], [466, 318], [276, 268]], [[416, 298], [470, 312], [470, 344], [416, 340]]];
  const cortinaDia = dados(im.cortinaDia), cortinaNoite = dados(im.cortinaNoite);
  const naJanela = new Uint8Array(W * W);
  for (let k = 0; k < W * W; k++) {
    const x = k % W + 0.5, y = ((k / W) | 0) + 0.5;
    naJanela[k] = REGIOES.some((R) => { let s = false; for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const [xi, yi] = R[i], [xj, yj] = R[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; }) ? 1 : 0;
  }
  // O chão da noite sem o desenho do luar: o dia vezes a luz MÉDIA da noite (borrada), como as paredes de noite.mjs.
  const diaLargo = dados(im.base, 'blur(28px)'), noiteLarga = dados(im.noite, 'blur(28px)'), abajurLargo = dados(im.noiteAbajur, 'blur(28px)');
  let fechada = false;
  // A JANELA ABERTA (janela-aberta.mjs): as folhas abertas, e o vão pintado de magenta puro, que vira a máscara da
  // vista. A noite dela é a de dia vezes a luz da noite (a pintada tinha outras folhas, e elas pulariam ao trocar).
  const CAIXILHO = [[330,100],[436,153],[436,252],[330,205]];
  const abertaDia = dados(im.janelaAberta), noCaixilho = new Uint8Array(W * W), vao = new Uint8Array(W * W), vidroAberto = new Uint8Array(W * W);
  for (let k = 0; k < W * W; k++) {
    const x = k % W + 0.5, y = ((k / W) | 0) + 0.5; let s = false;
    for (let i = 0, j = CAIXILHO.length - 1; i < CAIXILHO.length; j = i++) { const [xi, yi] = CAIXILHO[i], [xj, yj] = CAIXILHO[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; }
    if (!s) continue;
    noCaixilho[k] = 1;
    const [R, G, B] = [abertaDia[k * 4], abertaDia[k * 4 + 1], abertaDia[k * 4 + 2]];
    if (R > 200 && G < 70 && B > 200) vao[k] = 1;
    else if (R === 250 && G === 243 && B === 224) vidroAberto[k] = 1;
  }
  let aberta = false;
  const daVista = (v, x, y, c) => v[((y - 105) * 128 + (127 - (x - 330))) * 4 + c];
  // A luz, sem a cor das coisas: o quarto vazio borrado (a textura das tábuas some). Para o pufe de dia, bem
  // borrado (só o nível de luz do lugar); para a razão noite/dia, pouco, senão o desenho do luar some no tapete.
  const diaBorrado = dados(im.base, 'blur(10px)');
  const diaPouco = dados(im.base, 'blur(2px)'), noitePouco = dados(im.noite, 'blur(2px)');
  // Para a luz no pé dos móveis, mais borrado: o desenho do luar no chão não pode virar listras no móvel.
  const diaPe = dados(im.base, 'blur(6px)');
  // A noite com a luz do abajur pintada (noite-abajur.mjs): o criado-mudo já está nela, aceso.
  const noiteAbajur = dados(im.noiteAbajur), noiteAbajurPouco = dados(im.noiteAbajur, 'blur(2px)');
  const noitePe = dados(im.noite, 'blur(6px)'), noiteAbajurPe = dados(im.noiteAbajur, 'blur(6px)');
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
  // Dois pixels creme soltos na borda de fora do friso (156,68 e 379,80 na base): a ponta clara da madeira encostada
  // no fundo, que vira um ponto branco sobre a página escura. Pixel claro com 2 ou mais vizinhos de fundo ganha a cor
  // do vizinho mais escuro, que é o contorno.
  function contorno(img, fora) {
    for (let k = 0; k < W * W; k++) {
      if (fora[k] || img[k * 4] + img[k * 4 + 1] + img[k * 4 + 2] <= 360) continue;
      const x = k % W, y = (k / W) | 0, viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (y + dy) * W + x + dx);
      if (viz.filter((n) => fora[n]).length < 2) continue;
      const escuro = viz.filter((n) => !fora[n]).sort((p, q) => img[p * 4] + img[p * 4 + 1] + img[p * 4 + 2] - (img[q * 4] + img[q * 4 + 1] + img[q * 4 + 2]))[0];
      if (escuro !== undefined) for (let c = 0; c < 3; c++) img[k * 4 + c] = img[escuro * 4 + c];
    }
  }
  contorno(base, foraDia); contorno(noite, foraNoite); contorno(noiteAbajur, foraNoite);
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
    // O pé de cada coluna: o pixel mais baixo da peça naquela coluna. É onde ela encosta no chão.
    const peColuna = new Int16Array(W).fill(-1);
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) peColuna[k % W] = Math.max(peColuna[k % W], (k / W) | 0);
    pecas[m.id] = { ...m, movel, sombra, topo: y0, centroX: (x0 + x1) / 2, centroTopo: soma / Math.max(1, n), base, peColuna };
  }
  // A POLTRONA: um móvel solto que não é redondo, para o botão de girar. Cada orientação é uma peça; a base desenhada
  // (o ponto mais baixo, menos um quarto da largura) vai para o cruzamento da grade, como no pufe.
  const poltronas = [im.poltrona0, im.poltrona1, im.poltrona2, im.poltrona3].map((img) => {
    const c = document.createElement('canvas'); c.width = W; c.height = W; const gc = c.getContext('2d'); gc.drawImage(img, 0, 0);
    const movel = gc.getImageData(0, 0, W, W).data;
    // Uma das duas veio com sombra pintada embaixo (marrom chapado) e a outra não: tira-se a cor mais comum das
    // últimas linhas, que é a da sombra. As duas usam a sombra de contato da página.
    let fundo = 0; for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3] > 127) fundo = Math.max(fundo, (k / W) | 0);
    const conta = {};
    for (let y = fundo - 5; y <= fundo; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if (movel[k + 3] > 127) { const cor = movel[k] + ',' + movel[k + 1] + ',' + movel[k + 2]; conta[cor] = (conta[cor] || 0) + 1; } }
    const [sombraCor, vezes] = Object.entries(conta).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    if (vezes > 12) { const [sr, sg, sb] = sombraCor.split(',').map(Number); for (let k = 0; k < W * W; k++) if (Math.abs(movel[k * 4] - sr) + Math.abs(movel[k * 4 + 1] - sg) + Math.abs(movel[k * 4 + 2] - sb) < 18) movel[k * 4 + 3] = 0; }
    let x0 = W, x1 = 0, y0 = W, y1 = 0;
    for (let k = 0; k < W * W; k++) { if (movel[k * 4 + 3] < 128) { movel[k * 4 + 3] = 0; continue; } const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    let sx = 0, nb = 0; for (let x = 0; x < W; x++) for (let y = y1 - 2; y <= y1; y++) if (movel[(y * W + x) * 4 + 3]) { sx += x; nb++; }
    const peColuna = new Int16Array(W).fill(-1);
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) peColuna[k % W] = Math.max(peColuna[k % W], (k / W) | 0);
    return { id: 'poltrona', movel, sombra: new Uint8ClampedArray(W * W * 4), topo: y0, peColuna, base: [sx / Math.max(1, nb), y1 - (x1 - x0) / 4] };
  });
  let poltrona = [3, 6], lado = 0, pegado = null;
  // Para onde a poltrona olha em cada posição (a ordem das imagens: Girar anda nesta lista).
  const ORIENTA = ['sudoeste', 'noroeste', 'nordeste', 'sudeste'];
  // O pufe: onde está (o centro em u, v) e de que versão ele sai.
  const pufes = MOVEIS.filter((m) => m.pufe);
  const centro = (pe) => [(pe[0] + pe[1]) / 2, (pe[2] + pe[3]) / 2];
  let pufe = centro(pecas['pufe-meio'].pe).map(Math.round), modo = 'dia', grade = false, arrastando = false, alvo = null;
  // O pufe ocupa 2×2 casas e o centro dele fica num cruzamento da grade: assim a área acesa ao arrastar é
  // exatamente quatro casas desenhadas. Antes ele tinha 1,5 casa e saltava de meia em meia, fora das linhas.
  const LADO_PUFE = 2;
  const fixos = MOVEIS.filter((m) => !m.pufe);
  const ocupa = (c, quem = pegado) => {
    const [u0, u1, v0, v1] = [c[0] - LADO_PUFE / 2, c[0] + LADO_PUFE / 2, c[1] - LADO_PUFE / 2, c[1] + LADO_PUFE / 2];
    if (u0 < 0 || v0 < 0 || u1 > N || v1 > N) return true;
    // Os dois soltos (pufe e poltrona), também 2 × 2 casas cada, não se sobrepõem.
    const outro = quem === 'poltrona' ? pufe : poltrona;
    if (Math.abs(c[0] - outro[0]) < LADO_PUFE && Math.abs(c[1] - outro[1]) < LADO_PUFE) return true;
    return fixos.some((m) => !m.deitado && u0 < m.pe[1] && u1 > m.pe[0] && v0 < m.pe[3] && v1 > m.pe[2]);
  };
  const luz = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return (diaBorrado[i] + diaBorrado[i + 1] + diaBorrado[i + 2]) / 3; };

  // A grade em pixel: a casa de cada pixel do chão; a borda é onde a casa muda.
  const casa = new Int16Array(W * W).fill(-1);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const [u, v] = uvDe(x + 0.5, y + 0.5);
    if (u >= 0 && v >= 0 && u < N && v < N) casa[y * W + x] = Math.floor(u) * N + Math.floor(v);
  }

  const dono = new Array(W * W).fill('');

  // ============================== O COELHO (ver e2e/pixel-art/personagem/README.md) ==============================
  // Provisório: o coelho do recado (faixa de 18 quadros, de frente). O pé é a âncora: o meio da última linha do quadro
  // fica no ponto do chão. Direção nas 4 diagonais da tela; aqui, sem o desenho de cada uma, espelha-se para "oeste"
  // e escurece-se para "de costas", só para VER a direção. A arte de verdade não espelha (a lição da poltrona).
  const QUADROS = 18, fw = im.coelho.width / QUADROS, fh = im.coelho.height;
  const folha = dados(im.coelho, null, im.coelho.width, fh);
  // AS ANIMAÇÕES: cada quadro decodificado uma vez. A ÂNCORA é do PRIMEIRO quadro de cada animação e direção (o meio da
  // última linha com desenho): de pé, é o pé; sentado, é o assento. Fixa na animação inteira, para o coelho não tremer.
  const ANIM = {};
  for (const [nome, porDir] of Object.entries(ANIMACOES)) {
    ANIM[nome] = {};
    for (const [d, srcs] of Object.entries(porDir)) {
      const quadros = [];
      for (const src of srcs) {
        const img = await carregar(src), w = img.width, h = img.height;
        quadros.push({ px: dados(img, null, w, h), w, h });
      }
      const q0 = quadros[0];
      let fundo = 0, sx = 0, n = 0;
      for (let k = 0; k < q0.w * q0.h; k++) if (q0.px[k * 4 + 3] > 127) fundo = Math.max(fundo, (k / q0.w) | 0);
      for (let x = 0; x < q0.w; x++) for (let y = fundo - 3; y <= fundo; y++) if (q0.px[(y * q0.w + x) * 4 + 3] > 127) { sx += x; n++; }
      ANIM[nome][d] = { quadros, peX: sx / Math.max(1, n), peY: fundo };
      // DEITADO, a âncora é o meio do corpo (ele fica estendido sobre a cama, não de pé num ponto).
      if (nome === 'dormindo') {
        let x0 = q0.w, x1 = 0, y0 = q0.h, y1 = 0;
        for (let k = 0; k < q0.w * q0.h; k++) if (q0.px[k * 4 + 3] > 127) { const x = k % q0.w, y = (k / q0.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        ANIM[nome][d] = { quadros, peX: (x0 + x1) / 2, peY: (y0 + y1) / 2 };
      }
    }
  }
  // A direção que falta numa animação: a do mesmo lado (de frente ↔ de frente), e por fim a pose parada.
  const PAR = { sudeste: 'sudoeste', sudoeste: 'sudeste', nordeste: 'noroeste', noroeste: 'nordeste' };
  function quadrosDe(nome, d) {
    const a = ANIM[nome] ?? {};
    return a[d] ?? a[PAR[d]] ?? (d.startsWith('n') ? a.sudoeste ?? a.sudeste : a.noroeste ?? a.nordeste) ?? ANIM.parado[d] ?? ANIM.parado.sudeste;
  }
  // O mascote: um quadro por direção. O pé é o meio da última linha com desenho (a âncora do README).
  const mascote = {};
  for (const d of ['sudeste', 'sudoeste', 'nordeste', 'noroeste']) {
    const img = im['mascote-' + d], w = img.width, h = img.height, px = dados(img, null, w, h);
    let fundo = 0, sx = 0, n = 0;
    for (let k = 0; k < w * h; k++) if (px[k * 4 + 3] > 127) fundo = Math.max(fundo, (k / w) | 0);
    for (let x = 0; x < w; x++) for (let y = fundo - 3; y <= fundo; y++) if (px[(y * w + x) * 4 + 3] > 127) { sx += x; n++; }
    mascote[d] = { px, w, h, peX: sx / Math.max(1, n), peY: fundo };
  }
  const coelho = { u: 6.5, v: 6.5, dir: 'sudeste', pose: 'parado', caminho: [], destino: null, quadro: 0 };
  let estado = 'atoa', falando = false, semAndar = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A casa ocupada: o pé dos móveis fixos (menos o tapete), e o pufe e a poltrona (2 × 2 em volta do cruzamento).
  const livre = (i, j) => {
    if (i < 0 || j < 0 || i >= N || j >= N) return false;
    const cu = i + 0.5, cv = j + 0.5;
    if (fixos.some((m) => !m.deitado && cu > m.pe[0] && cu < m.pe[1] && cv > m.pe[2] && cv < m.pe[3])) return false;
    return ![pufe, poltrona].some((c) => Math.abs(cu - c[0]) < 1 && Math.abs(cv - c[1]) < 1);
  };
  const todasAsCasas = () => [...Array(N * N).keys()].map((k) => [Math.floor(k / N), k % N]);
  // OS PONTOS SÃO DO MÓVEL: calculados de onde ele está AGORA (arrastou, o ponto foi junto; girou, o olhar mudou).
  // "ao": as casas do chão de onde se chega; "onde": onde o pé fica (null = fica na casa de chegada); "sobe": quantos px
  // acima do chão (o assento); "frente": a posição na ordem de desenho (logo depois do móvel, por cima dele).
  function pontos() {
    const vizinhas = (u0, u1, v0, v1) => {
      const r = [];
      for (let i = Math.floor(u0) - 1; i <= Math.ceil(u1); i++) for (let j = Math.floor(v0) - 1; j <= Math.ceil(v1); j++) {
        const dentro = i + 0.5 > u0 && i + 0.5 < u1 && j + 0.5 > v0 && j + 0.5 < v1;
        if (!dentro && livre(i, j)) r.push([i, j]);
      }
      return r;
    };
    const em2x2 = (c) => vizinhas(c[0] - 1, c[0] + 1, c[1] - 1, c[1] + 1);
    const cama = fixos.find((m) => m.id === 'cama').pe, gr = fixos.find((m) => m.id === 'guarda-roupa').pe;
    return {
      pufe: { ao: em2x2(pufe), onde: [pufe[0], pufe[1]], sobe: 26, pose: 'sentado', olha: 'sudeste', frente: pufe[0] + pufe[1] + LADO_PUFE + 0.01 },
      poltrona: { ao: em2x2(poltrona), onde: [poltrona[0], poltrona[1]], sobe: 20, pose: 'sentado', olha: ORIENTA[lado], frente: poltrona[0] + poltrona[1] + LADO_PUFE + (ORIENTA[lado].startsWith('n') ? -0.01 : 0.01) },
      // Na cama: recostado na cabeceira (o fundo, u pequeno), como no conceito.
      // Lendo, recostado na cabeceira (o fundo, u pequeno); dormindo, deitado no meio da cama, a cabeça para a cabeceira.
      cama: estado === 'ausente'
        ? { ao: vizinhas(...cama), onde: [(cama[0] + cama[1]) / 2 - 0.1, (cama[2] + cama[3]) / 2 - 0.15], sobe: 38, pose: 'na cama', olha: 'sudoeste', frente: cama[1] + cama[3] + 0.01 }
        : { ao: vizinhas(...cama), onde: [cama[0] + 0.9, (cama[2] + cama[3]) / 2], sobe: 30, pose: 'na cama', olha: 'sudoeste', frente: cama[1] + cama[3] + 0.01 },
      'guarda-roupa': { ao: [[Math.floor((gr[0] + gr[1]) / 2), Math.ceil(gr[3])]].filter(([i, j]) => livre(i, j)), onde: null, sobe: 0, pose: 'parado', olha: 'noroeste' },
    };
  }
  // A caminhada: busca em largura pela grade, nas 4 direções da grade (que na tela são as 4 diagonais).
  function caminho(de, para) {
    const alvo = new Set(para.map(([i, j]) => i * N + j)), veio = new Map([[de[0] * N + de[1], -1]]), fila = [de[0] * N + de[1]];
    for (let q = 0; q < fila.length; q++) {
      const k = fila[q];
      if (alvo.has(k)) { const r = []; for (let x = k; x !== -1; x = veio.get(x)) r.unshift([Math.floor(x / N), x % N]); return r; }
      const i = Math.floor(k / N), j = k % N;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const b = (i + di) * N + j + dj;
        if (!veio.has(b) && livre(i + di, j + dj)) { veio.set(b, k); fila.push(b); }
      }
    }
    return null;
  }
  const DIR = { '1,0': 'sudoeste', '-1,0': 'nordeste', '0,1': 'sudeste', '0,-1': 'noroeste' };
  // De onde o coelho sai: a casa dele, ou (se um móvel foi arrastado para cima dela) a casa livre mais perto.
  function saida() {
    const c = [Math.floor(coelho.u), Math.floor(coelho.v)];
    if (livre(...c)) return c;
    return todasAsCasas().filter(([i, j]) => livre(i, j)).sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]))[0];
  }
  function andarAte(c) {
    if (semAndar) { const f = c[c.length - 1]; coelho.u = f[0] + 0.5; coelho.v = f[1] + 0.5; coelho.caminho = []; chegar(); }
    else { coelho.u = c[0][0] + 0.5; coelho.v = c[0][1] + 0.5; coelho.caminho = c.slice(1); if (!coelho.caminho.length) chegar(); }
  }
  function ir(id) {
    const pt = pontos()[id];
    if (!pt || !pt.ao.length) return;
    const c = caminho(saida(), pt.ao);
    if (!c) return;
    coelho.pose = 'parado'; coelho.destino = id;
    andarAte(c);
  }
  function chegar() {
    const pt = coelho.destino && pontos()[coelho.destino];
    if (!pt) { coelho.pose = 'parado'; return; }
    coelho.dir = pt.olha;
    coelho.pose = coelho.destino === 'cama' ? (estado === 'ausente' ? 'dormindo' : 'lendo') : pt.pose;
  }
  // O ESTADO REAL DECIDE O LUGAR. Em call, a poltrona faz o papel do computador, que o quarto ainda não tem.
  function decidir() {
    if (estado === 'ausente' || (estado === 'atoa' && modo === 'noite')) return ir('cama');
    if (estado === 'call') return ir('poltrona');
    coelho.destino = null; coelho.pose = 'parado';
    const c = caminho(saida(), [saida()]); if (c) andarAte(c);
  }
  // À toa, de dia: de tempos em tempos, uma casa livre qualquer.
  function passear() {
    if (estado !== 'atoa' || modo === 'noite' || coelho.caminho.length || coelho.destino) return;
    const livres = todasAsCasas().filter(([i, j]) => livre(i, j));
    const c = caminho(saida(), [livres[Math.floor(Math.random() * livres.length)]]);
    if (c) andarAte(c);
  }
  const quadroBuf = new Uint8ClampedArray(W * W * 4), peBuf = new Int16Array(W).fill(-1), semSombra = new Uint8ClampedArray(W * W * 4);
  let ultimaCaixa = null, coelhoPe = null;
  function pecaDoCoelho() {
    const pt = coelho.destino && !coelho.caminho.length ? pontos()[coelho.destino] : null;
    // No ponto, o olhar é o do móvel AGORA: girar a poltrona com ele sentado vira o coelho junto.
    if (pt) coelho.dir = pt.olha;
    const sentado = pt && pt.onde;
    const [u, v] = sentado ? pt.onde : [coelho.u, coelho.v];
    const [px, py] = ponto(u, v);
    if (ultimaCaixa) {
      const [a, b, c, d] = ultimaCaixa;
      for (let y = b; y < d; y++) for (let x = a; x < c; x++) if (x >= 0 && y >= 0 && x < W && y < W) quadroBuf[(y * W + x) * 4 + 3] = 0;
      peBuf.fill(-1);
    }
    // A ANIMAÇÃO pelo que ele está fazendo: andando, sentado (lendo ou dormindo, na cama), falando de pé, ou parado.
    const nomeAnim = coelho.caminho.length ? 'andando'
      : pt && pt.onde ? (coelho.pose === 'lendo' ? 'lendo' : coelho.pose === 'dormindo' ? 'dormindo' : 'sentado')
      : falando ? 'falando' : 'parado';
    const a = quadrosDe(nomeAnim, coelho.dir);
    const quadro = a.quadros[coelho.quadro % a.quadros.length];
    const sw = quadro.w, sh = quadro.h;
    const X0 = Math.round(px - a.peX), Y0 = Math.round(py - a.peY - 1 - (sentado ? pt.sobe : 0));
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const s = (y * quadro.w + x) * 4;
      const fonte = quadro.px;
      if (fonte[s + 3] < 128) continue;
      const X = X0 + x, Y = Y0 + y;
      if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
      const d = (Y * W + X) * 4;
      quadroBuf[d] = fonte[s]; quadroBuf[d + 1] = fonte[s + 1]; quadroBuf[d + 2] = fonte[s + 2]; quadroBuf[d + 3] = 255;
      // A luz dele, de noite, é a do chão onde o pé está (como a dos móveis).
      peBuf[X] = Math.round(py);
    }
    ultimaCaixa = [X0, Y0, X0 + sw, Y0 + sh];
    // [x, y do chão, altura do assento]: sentado, a sombra sai do assento e cai no chão em volta do móvel.
    coelhoPe = [px, py + (sentado ? 0 : 0), sentado ? pt.sobe : 0];
    const p = { id: 'coelho', movel: quadroBuf, sombra: semSombra, topo: Y0, peColuna: peBuf };
    const frente = sentado ? pt.frente : coelho.u + coelho.v + 0.6;
    return [{ p, dx: 0, dy: 0, fator: 1, frente, ...(sentado ? {} : { contato: [px, py], raio: [12, 5] }) }];
  }
  // A SOMBRA DO COELHO (ideia dele, 14/10/2026): a silhueta projetada no chão, para o lado oposto à luz. De dia a luz é
  // a JANELA (o meio do vidro, alto: sombra curta e para a esquerda-frente); de noite, o ABAJUR (baixo e perto: sombra
  // mais comprida, para longe dele). Cada pixel do coelho a uma altura h acima do pé cai no chão a h × alongamento,
  // na direção contrária à da luz. Pixel art: sombra chapada, sem borrão. Só o chão escurece.
  const LUZ_DIA = { x: 420, y: 170, alongamento: 0.85, forca: 0.55 };
  const sombraBuf = new Uint8Array(W * W);
  function sombraDoCoelho(D, fundoNoite) {
    const c = ultimaCaixa, pe = coelhoPe;
    if (!c || !pe) return;
    const luz = modo === 'noite' ? { x: pecas.abajur.centroTopo, y: pecas.abajur.topo + 40, alongamento: 1.1, forca: 0.5 } : LUZ_DIA;
    // A direção da sombra no chão: do ponto da luz no chão até o pé, achatada como o chão isométrico (metade em y).
    let dx = pe[0] - luz.x, dy = (pe[1] - luz.y) * 0.5;
    const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    sombraBuf.fill(0);
    const [x0, y0, x1, y1] = c;
    for (let y = Math.max(0, y0); y < Math.min(W, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (!quadroBuf[(y * W + x) * 4 + 3]) continue;
      const h = Math.max(0, pe[1] - pe[2] - y); // a altura deste pixel acima do pé (sentado, acima do assento)
      const alto = h + pe[2]; // contando do chão: sentado, o assento também está no ar
      const sx = Math.round(x + dx * alto * luz.alongamento), sy = Math.round(pe[1] + dy * alto * luz.alongamento);
      for (const [ax, ay] of [[0, 0], [1, 0], [0, 1]]) {
        const X = sx + ax, Y = sy + ay;
        if (X >= 0 && Y >= 0 && X < W && Y < W && casa[Y * W + X] >= 0) sombraBuf[Y * W + X] = 1;
      }
    }
    for (let k = 0; k < W * W; k++) if (sombraBuf[k]) for (let c2 = 0; c2 < 3; c2++) { D[k * 3 + c2] *= luz.forca; fundoNoite[k * 3 + c2] *= luz.forca + 0.12; }
  }

  // O relógio: 10 quadros por segundo; o coelho anda 2,5 casas por segundo.
  let ultimo = performance.now(), proximoPasseio = 0, tempoDeDesenho = 0;
  setInterval(() => {
    const agora = performance.now(), dt = Math.min(0.25, (agora - ultimo) / 1000);
    ultimo = agora;
    coelho.quadro++;
    if (coelho.caminho.length) {
      const [i, j] = coelho.caminho[0], au = i + 0.5, av = j + 0.5, du = au - coelho.u, dv = av - coelho.v;
      const dist = Math.hypot(du, dv), passo = 2.5 * dt;
      coelho.dir = DIR[Math.sign(Math.round(du)) + ',' + Math.sign(Math.round(dv))] ?? coelho.dir;
      if (dist <= passo) { coelho.u = au; coelho.v = av; coelho.caminho.shift(); if (!coelho.caminho.length) chegar(); }
      else { coelho.u += (du / dist) * passo; coelho.v += (dv / dist) * passo; }
    } else if (agora > proximoPasseio) { proximoPasseio = agora + 4000 + Math.random() * 3000; passear(); }
    const t0 = performance.now();
    desenhar();
    tempoDeDesenho = performance.now() - t0;
  }, 100);
  for (const b of document.querySelectorAll('[data-estado]')) b.onclick = () => {
    estado = b.dataset.estado;
    for (const o of document.querySelectorAll('[data-estado]')) o.setAttribute('aria-pressed', String(o === b));
    decidir();
  };
  const bf = document.getElementById('falando');
  bf.onclick = () => { falando = !falando; bf.setAttribute('aria-pressed', String(falando)); };
  const bs = document.getElementById('semAndar');
  bs.setAttribute('aria-pressed', String(semAndar));
  bs.onclick = () => { semAndar = !semAndar; bs.setAttribute('aria-pressed', String(semAndar)); };

  const tela = document.getElementById('tela'), g = tela.getContext('2d');
  function desenhar() {
    const D = new Float32Array(W * W * 3); // a cena com as cores do dia
    dono.fill('');
    const eMovel = new Uint8Array(W * W), acesa = new Uint8Array(W * W), peY = new Int16Array(W * W);
    const fundoNoite = new Float32Array(W * W * 3);
    const pintada = modo === 'noite' && luzPintada, fundoN = pintada ? noiteAbajur : noite, razaoN = pintada ? noiteAbajurPouco : noitePouco;
    const razaoPe = pintada ? noiteAbajurPe : noitePe;
    for (let k = 0; k < W * W; k++) for (let c = 0; c < 3; c++) { D[k * 3 + c] = base[k * 4 + c]; fundoNoite[k * 3 + c] = fundoN[k * 4 + c]; }
    // A paisagem atrás do vidro, com um véu leve da cor do vidro (de dia, creme; de noite, azul).
    for (let k = 0; k < W * W; k++) if (vidro[k * 4 + 3] > 127) {
      const x = k % W, y = (k / W) | 0;
      for (let c = 0; c < 3; c++) {
        D[k * 3 + c] = daVista(vistasDia[vista], x, y, c) * 0.88 + [250, 243, 224][c] * 0.12;
        fundoNoite[k * 3 + c] = daVista(vistasNoite[vista], x, y, c) * 0.9 + [40, 46, 80][c] * 0.1;
      }
    }
    if (aberta) for (let k = 0; k < W * W; k++) {
      if (!noCaixilho[k]) continue;
      const x = k % W, y = (k / W) | 0;
      for (let c = 0; c < 3; c++) {
        if (vao[k]) { D[k * 3 + c] = daVista(vistasDia[vista], x, y, c); fundoNoite[k * 3 + c] = daVista(vistasNoite[vista], x, y, c); }
        else if (vidroAberto[k]) { D[k * 3 + c] = daVista(vistasDia[vista], x, y, c) * 0.8 + 250 * 0.2; fundoNoite[k * 3 + c] = daVista(vistasNoite[vista], x, y, c) * 0.85 + [40, 46, 80][c] * 0.15; }
        else { D[k * 3 + c] = abertaDia[k * 4 + c]; fundoNoite[k * 3 + c] = abertaDia[k * 4 + c] * Math.min(1, noitePe[k * 4 + c] / Math.max(1, diaPe[k * 4 + c])); }
      }
    }
    if (fechada) for (let k = 0; k < W * W; k++) {
      if (naJanela[k]) { for (let c = 0; c < 3; c++) { D[k * 3 + c] = cortinaDia[k * 4 + c]; fundoNoite[k * 3 + c] = cortinaNoite[k * 4 + c]; } }
      else if (casa[k] >= 0) { const larga = pintada ? abajurLargo : noiteLarga; for (let c = 0; c < 3; c++) fundoNoite[k * 3 + c] = base[k * 4 + c] * Math.min(1, larga[k * 4 + c] / Math.max(1, diaLargo[k * 4 + c])); }
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
      })(),
      (() => {
        // A poltrona foi pintada fora do quarto, com luz neutra: ganha a intensidade do lugar, em relação ao meio do chão.
        const p = poltronas[lado], [nx, ny] = ponto(poltrona[0], poltrona[1]), [mx, my] = ponto(N / 2, N / 2);
        const fator = Math.min(1.2, Math.max(0.8, luz(nx, ny) / luz(mx, my)));
        return { p, dx: Math.round(nx - p.base[0]), dy: Math.round(ny - p.base[1]), fator, frente: poltrona[0] + poltrona[1] + LADO_PUFE, contato: [nx, ny] };
      })(), ...pecaDoCoelho()].sort((a, b) => a.frente - b.frente);
    // A sombra do coelho vai DEPOIS do que fica deitado no chão (o tapete: frente -1) e antes dos móveis de pé, que a
    // cobrem quando estão na frente. Antes dos dois, o tapete a apagava.
    let sombraFeita = false;
    for (const { p, dx, dy, fator, contato, raio, frente } of lista) {
      if (!sombraFeita && frente >= 0) { sombraDoCoelho(D, fundoNoite); sombraFeita = true; }
      // A sombra de contato de quem não a trouxe pintada (a poltrona): uma elipse no chão, mais escura no meio.
      const [rx, ry] = raio ?? [30, 15];
      if (contato) for (let y = Math.round(contato[1] - ry - 1); y <= contato[1] + ry + 1; y++) for (let x = Math.round(contato[0] - rx - 2); x <= contato[0] + rx + 2; x++) {
        const d = ((x - contato[0]) / rx) ** 2 + ((y - contato[1]) / ry) ** 2, k = y * W + x;
        if (d >= 1 || x < 0 || y < 0 || x >= W || y >= W || casa[k] < 0) continue;
        const f = 0.72 + 0.28 * d;
        for (let c = 0; c < 3; c++) { D[k * 3 + c] *= f; fundoNoite[k * 3 + c] *= f; }
      }
      // Com a luz pintada, o criado-mudo da noite pintada NÃO é usado: a repintura o redesenhou uns pixels ao lado, e
      // ao trocar dia e noite ele parecia empurrar a cabeceira. Vale o mesmo recorte do dia, com a luz da pintura.
      for (let k = 0; k < W * W; k++) {
        const x = k % W + dx, y = ((k / W) | 0) + dy;
        if (x < 0 || y < 0 || x >= W || y >= W) continue;
        const d = y * W + x, a = p.sombra[k * 4 + 3];
        if (a) { const f = 1 - a / 255; for (let c = 0; c < 3; c++) { D[d * 3 + c] *= f; fundoNoite[d * 3 + c] *= f; } }
        if (p.movel[k * 4 + 3]) {
          for (let c = 0; c < 3; c++) D[d * 3 + c] = p.movel[k * 4 + c] * fator;
          eMovel[d] = 1; peY[d] = p.peColuna[k % W] + dy; dono[d] = p.id;
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
          // A luz de um móvel à noite é a do CHÃO no pé daquela coluna, e não a da parede atrás do pixel: o travesseiro,
          // colado no abajur, pegava o luar azul da parede atrás dele (relato de 08/10/2026).
          else if (eMovel[k]) {
            const j = (Math.min(W - 1, peY[k] + 3) * W + x) * 4;
            // O halo pintado na parede é pequeno; o abajur também esquenta os móveis em volta (o travesseiro ao
            // lado dele não pode ficar no azul da noite). Suave, sem faixas, só nos móveis.
            const perto = pintada ? 0.75 * Math.exp(-((x - lx) ** 2 + ((y - ly) * 1.3) ** 2) / (2 * 60 * 60)) * [1, 0.7, 0.4][c] : 0;
            v = v * Math.min(pintada ? 1.2 : 0.9, razaoPe[j + c] / Math.max(1, diaPe[j + c])) + v * (quente + perto);
          }
          else v = fundoNoite[k * 3 + c] + base[k * 4 + c] * quente;
        }
        // A luz da janela, coada pelo linho: o quarto inteiro escurece por igual. Deixar a região da janela de fora fazia
        // um retângulo claro na parede em volta da cortina (relato de 08/10/2026).
        if (fechada && modo === 'dia') v *= 0.86;
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
    document.getElementById('legenda').textContent = 'Poltrona olhando para ' + ORIENTA[lado] + '. Pufe: versão "' + variante.id.replace('pufe-', '') + '"' + (modo === 'dia' ? ', luz do lugar ×' + lista.find((i) => i.p.pufe).fator.toFixed(2) : '') + '. Coelho: ' + (coelho.caminho.length ? 'andando' : falando && !coelho.destino ? 'falando' : coelho.pose) + ', olhando para ' + coelho.dir + (coelho.destino ? ' (' + coelho.destino + ')' : '') + '. Desenho do quadro: ' + Math.round(tempoDeDesenho) + ' ms.';
    document.getElementById('conceito').src = modo === 'dia' ? IMAGENS.conceitoDia : IMAGENS.conceitoNoite;
  }

  // Arrastar: o centro do pufe salta de cruzamento em cruzamento da grade, e só para onde cabe. A grade aparece
  // enquanto se arrasta.
  const casaDoPonteiro = (e) => {
    const r = tela.getBoundingClientRect();
    const [u, v] = uvDe((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * W / r.height);
    return [Math.round(u), Math.round(v)];
  };
  const pixelDo = (e) => { const r = tela.getBoundingClientRect(); return Math.floor((e.clientY - r.top) * W / r.height) * W + Math.floor((e.clientX - r.left) * W / r.width); };
  const bc = document.getElementById('cortina');
  const trocarCortina = () => { fechada = !fechada; bc.setAttribute('aria-pressed', String(fechada)); bc.textContent = 'Cortina: ' + (fechada ? 'fechada' : 'aberta'); desenhar(); };
  bc.onclick = trocarCortina;
  // Na janela, o clique é da cortina, e a mão aparece; no resto, arrasta o pufe.
  const bj = document.getElementById('janela');
  const trocarJanela = () => { aberta = !aberta; bj.setAttribute('aria-pressed', String(aberta)); bj.textContent = 'Janela: ' + (aberta ? 'aberta' : 'fechada'); desenhar(); };
  bj.onclick = trocarJanela;
  // No vidro, abre e fecha a janela; no resto da janela (as cortinas), abre e fecha as cortinas. Com as cortinas
  // fechadas, o clique é sempre delas.
  tela.addEventListener('pointerdown', (e) => { const k = pixelDo(e); if (!naJanela[k]) return; if (noCaixilho[k] && !fechada) trocarJanela(); else trocarCortina(); });
  tela.addEventListener('pointermove', (e) => { if (!arrastando) tela.style.cursor = naJanela[pixelDo(e)] ? 'pointer' : 'grab'; });
  // Arrasta-se o que está sob o ponteiro: a poltrona, o pufe, ou nada (clicar no chão vazio não move ninguém).
  const sob = (e) => {
    const r = tela.getBoundingClientRect(), [u, v] = uvDe((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * W / r.height);
    const perto = (c) => Math.abs(u - c[0]) <= 1 && Math.abs(v - c[1]) <= 1;
    return perto(poltrona) ? 'poltrona' : perto(pufe) ? 'pufe' : null;
  };
  tela.addEventListener('pointerdown', (e) => {
    if (naJanela[pixelDo(e)]) return;
    pegado = sob(e);
    if (!pegado) { const d = dono[pixelDo(e)]; if (d === 'cama' || d === 'guarda-roupa') ir(d); return; }
    arrastando = true; tela.setPointerCapture(e.pointerId); alvo = casaDoPonteiro(e); desenhar();
  });
  tela.addEventListener('pointermove', (e) => { if (!arrastando) return; const c = casaDoPonteiro(e); if (!alvo || c[0] !== alvo[0] || c[1] !== alvo[1]) { alvo = c; desenhar(); } });
  tela.addEventListener('pointerup', () => {
    if (!arrastando) return;
    arrastando = false;
    const atual = pegado === 'poltrona' ? poltrona : pufe;
    if (alvo && alvo[0] === atual[0] && alvo[1] === atual[1]) ir(pegado); // clicou sem arrastar: o coelho vai até ele
    else if (alvo && !ocupa(alvo)) { if (pegado === 'poltrona') poltrona = alvo; else pufe = alvo; }
    alvo = null; desenhar();
  });
  // GIRAR (pedido dele em 08/10/2026): troca a orientação pintada da poltrona. As duas ocupam as mesmas 2 × 2 casas.
  const girar = () => { lado = (lado + 1) % 4; desenhar(); };
  document.getElementById('girar').onclick = girar;
  document.addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') girar(); });
  const botoes = { dia: document.getElementById('dia'), noite: document.getElementById('noite') };
  for (const [m, b] of Object.entries(botoes)) b.onclick = () => { modo = m; for (const [n, o] of Object.entries(botoes)) o.setAttribute('aria-pressed', String(n === m)); decidir(); desenhar(); };
  const bg = document.getElementById('grade');
  bg.onclick = () => { grade = !grade; bg.setAttribute('aria-pressed', String(grade)); desenhar(); };
  const bv = document.getElementById('vista');
  bv.onclick = () => { vista = (vista + 1) % 4; bv.textContent = 'Vista: ' + (vista + 1); desenhar(); };
  const bl = document.getElementById('luz');
  bl.onclick = () => { luzPintada = !luzPintada; bl.setAttribute('aria-pressed', String(luzPintada)); bl.textContent = 'Luz do abajur à noite: ' + (luzPintada ? 'pintada' : 'por código'); desenhar(); };
  desenhar();
})();
</script>
</body></html>
`;
fs.writeFileSync(path.join(AQUI, 'quarto.html'), html);
console.log('quarto.html', Math.round(html.length / 1024), 'KB');
