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
  // Na poltrona, afundado e com os braços nos apoios (pedido dele, 14/10/2026).
  'sentado-poltrona': ['estados/sentado-poltrona', 'estados/sentado-2'],
  lendo: ['estados/lendo-deitado', 'estados/lendo'],
  dormindo: ['estados/dormindo'],
  'dormindo-largado': ['estados/dormindo-largado', 'estados/dormindo'],
  // As TRANSIÇÕES (personagem/transicao.mjs): os quadros do meio entre o parado e a pose; ao contrário, levantar.
  // As fluidas (8 quadros, encadeadas por transicao.mjs) primeiro; onde ainda não existem, as de 2 quadros.
  sentar: ['transicoes/sentar-fluido', 'transicoes/sentar'],
  deitar: ['transicoes/deitar-fluido', 'transicoes/deitar'],
  'deitar-lendo': ['transicoes/deitar-lendo-fluido', 'transicoes/deitar-lendo'],
  // Na poltrona, o fim do sentar com os braços indo para os apoios.
  bracos: ['transicoes/bracos'],
};
// As 8 direções do personagem: as diagonais são as de uso; as outras 4 (de frente, de costas, de lado) servem à VIRADA.
const DELES = { sudeste: 'south-east', sudoeste: 'south-west', nordeste: 'north-east', noroeste: 'north-west', sul: 'south', oeste: 'west', norte: 'north', leste: 'east' };
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
// AS 4 POSIÇÕES DE CADA MÓVEL (girar.mjs): as 4 diagonais do mesmo móvel, na ordem do botão Girar. Móvel sem as 4
// vistas fica onde foi pintado.
const GIROS = { poltrona: 'poltrona-giros', abajur: 'criado-mudo-pes-giros', 'guarda-roupa': 'guarda-roupa-giros', cama: 'cama-casal-giros', mesa: 'mesa-teclado-giros' };
const ORDEM_DO_GIRO = ['south-west', 'north-west', 'north-east', 'south-east'];
for (const [id, pasta] of Object.entries(GIROS)) {
  const dir = path.join(AQUI, 'avulsos', pasta);
  if (ORDEM_DO_GIRO.every((d) => fs.existsSync(path.join(dir, d + '.png')))) ORDEM_DO_GIRO.forEach((d, l) => { IMAGENS['giro-' + id + l] = png(path.join(dir, d + '.png')); });
}
// A CADEIRA DO COMPUTADOR gira livre (física): as 8 vistas, e a que aparece é a mais perto do ângulo dela.
const OITO = ['south-west', 'south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west'];
if (OITO.every((d) => fs.existsSync(path.join(AQUI, 'avulsos', 'cadeira-giros', d + '.png')))) for (const d of OITO) IMAGENS['cadeira-' + d] = png(path.join(AQUI, 'avulsos', 'cadeira-giros', d + '.png'));
// OS ESTADOS DE UM MÓVEL (estado.mjs): o mesmo objeto, editado, nas mesmas vistas e no mesmo enquadramento.
const ESTADOS = { 'guarda-roupa': { aberto: 'guarda-roupa-aberto-giros' } };
for (const [id, estados] of Object.entries(ESTADOS)) for (const [nome, pasta] of Object.entries(estados)) {
  const dir = path.join(AQUI, 'avulsos', pasta);
  if (ORDEM_DO_GIRO.every((d) => fs.existsSync(path.join(dir, d + '.png')))) ORDEM_DO_GIRO.forEach((d, l) => { IMAGENS['giro-' + id + '-' + nome + l] = png(path.join(dir, d + '.png')); });
}
const MOVEIS = [...FIXOS, ...PUFES].map((m) => ({ id: m.id, pe: m.pe, alto: m.alto ?? 34, deitado: !!m.deitado, pufe: m.id.startsWith('pufe') }));
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
pufe pintados dentro dela e recortados, e a paisagem atrás do vidro. À direita, o conceito do ChatGPT. <b>Arraste qualquer móvel</b>
pelo chão (o pufe usa a versão pintada mais perto e a intensidade da luz do lugar). <b>Girar</b> (ou a tecla R) gira o
último móvel tocado. A arrumação fica guardada neste navegador; <b>Arrumação inicial</b> volta à de fábrica.</p>
<div class="barra">
  <button id="dia" aria-pressed="true">Dia</button><button id="noite" aria-pressed="false">Noite</button>
  <button id="grade" aria-pressed="false">Mostrar a grade</button>
  <button id="luz" aria-pressed="true">Luz do abajur à noite: pintada</button>
  <button id="vista" aria-pressed="false">Vista: 1</button>
  <button id="girar">Girar a poltrona</button>
  <button id="inicial">Arrumação inicial</button>
  <button id="tela-pc">Tela: automática</button>
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
// A CONTA DIRETA (desempenho, 14/10/2026): o chão é quase um paralelogramo, então a inversa da parte linear já cai a
// menos de um centésimo de casa; dois passos de Newton acertam o resto. O Newton puro, de 12 passos, em cada pixel,
// custava a maior parte dos ~9 s de abertura num processador 4× mais lento.
function uvRapido(x, y) {
  const { fundo: B, esquerda: L, direita: R } = CANTOS;
  const a1 = L[0] - B[0], a2 = L[1] - B[1], b1 = R[0] - B[0], b2 = R[1] - B[1], det = a1 * b2 - b1 * a2;
  const dx = x - B[0], dy = y - B[1];
  let u = ((dx * b2 - b1 * dy) / det) * N, v = ((a1 * dy - dx * a2) / det) * N;
  for (let i = 0; i < 2; i++) {
    const [px, py] = ponto(u, v), e = 0.01;
    const [ax, ay] = ponto(u + e, v), [bx, by] = ponto(u, v + e);
    const j11 = (ax - px) / e, j21 = (ay - py) / e, j12 = (bx - px) / e, j22 = (by - py) / e;
    const d2 = j11 * j22 - j12 * j21, ex = x - px, ey = y - py;
    u += (j22 * ex - j12 * ey) / d2; v += (-j21 * ex + j11 * ey) / d2;
  }
  return [u, v];
}
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
  // ============================== OS MÓVEIS SOLTOS (14/10/2026) ==============================
  // Pedido dele: "quero dar um layout inicial, mas quero permitir o usuário customizar o quarto como achar melhor". Todo
  // móvel se arrasta e gira (4 posições). Cada um tem as 4 vistas do MESMO móvel (girar.mjs), e o TAMANHO NO CHÃO sai do
  // próprio desenho (a cama pedida numa área saiu uma casa menor, e o coelho deitava longe dela): da quina da frente (o
  // ponto mais baixo) até a ponta da direita é o comprimento em u, até a da esquerda, em v (27 px por casa).
  // O layout inicial é o da PINTURA: enquanto um móvel pintado no quarto está no lugar e na posição de origem, é a
  // pintura dele que aparece (com a luz e a sombra de lá); mexido, entra a vista solta, com a intensidade da luz do lugar.
  const KX = (CANTOS.direita[0] - CANTOS.fundo[0]) / N;
  const VAZIA = new Uint8ClampedArray(W * W * 4);
  function pecaDeImagem(img, id) {
    const c = document.createElement('canvas'); c.width = W; c.height = W; const gc = c.getContext('2d'); gc.drawImage(img, 0, 0);
    const movel = gc.getImageData(0, 0, W, W).data;
    // A vista veio com a sombra pintada embaixo (cinza ou marrom chapado): tira-se a cor mais comum das últimas linhas.
    // Todas usam a sombra de contato da página, no formato do pé do móvel.
    let fundo = 0; for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3] > 127) fundo = Math.max(fundo, (k / W) | 0);
    const conta = {};
    for (let y = fundo - 5; y <= fundo; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if (movel[k + 3] > 127) { const cor = movel[k] + ',' + movel[k + 1] + ',' + movel[k + 2]; conta[cor] = (conta[cor] || 0) + 1; } }
    const [sombraCor, vezes] = Object.entries(conta).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    // Só é sombra a cor que mora no PÉ da imagem: a madeira da mesa e da cama e o contorno preto também são as mais
    // comuns nas últimas linhas, mas aparecem no móvel inteiro (tirá-las deixava a mesa transparente, 14/10/2026).
    const [sr, sg, sb] = sombraCor.split(',').map(Number), parecida = (k) => Math.abs(movel[k * 4] - sr) + Math.abs(movel[k * 4 + 1] - sg) + Math.abs(movel[k * 4 + 2] - sb) < 18;
    let emCima = 0; for (let k = 0; k < (fundo - 25) * W; k++) if (movel[k * 4 + 3] > 127 && parecida(k)) emCima++;
    if (vezes > 12 && emCima <= vezes * 0.1) for (let k = 0; k < W * W; k++) if (parecida(k)) movel[k * 4 + 3] = 0;
    let x0 = W, x1 = 0, y0 = W, y1 = 0;
    for (let k = 0; k < W * W; k++) { if (movel[k * 4 + 3] < 128) { movel[k * 4 + 3] = 0; continue; } const x = k % W, y = (k / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    let sx = 0, nb = 0; for (let x = 0; x < W; x++) for (let y = y1 - 2; y <= y1; y++) if (movel[(y * W + x) * 4 + 3]) { sx += x; nb++; }
    sx /= Math.max(1, nb);
    const peColuna = new Int16Array(W).fill(-1);
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3]) peColuna[k % W] = Math.max(peColuna[k % W], (k / W) | 0);
    let soma = 0, n = 0;
    for (let k = 0; k < W * W; k++) if (movel[k * 4 + 3] && ((k / W) | 0) < y0 + 8) { soma += k % W; n++; }
    // Da quina da frente (u1, v1): a ponta da DIREITA é (u0, v1), então a distância até ela é o comprimento em u; a da
    // esquerda é (u1, v0), o comprimento em v (x cresce com v e diminui com u).
    const mede = [Math.max(0.6, (x1 + 1 - sx) / KX), Math.max(0.6, (sx - x0) / KX)];
    // O MEIO DA BASE (para a cadeira, que é uma roda no chão): a largura das últimas 12 linhas é o pé de rodinhas; o meio
    // dele fica um quarto dessa largura acima do ponto mais baixo (a projeção 2:1 de um círculo).
    let bx0 = W, bx1 = 0;
    for (let y = y1 - 11; y <= y1; y++) for (let x = 0; x < W; x++) if (y >= 0 && movel[(y * W + x) * 4 + 3]) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); }
    const meioDaBase = [(bx0 + bx1 + 1) / 2, y1 - (bx1 - bx0 + 1) / 4];
    return { id, movel, sombra: VAZIA, topo: y0, peColuna, frente: [sx, y1], mede, centroTopo: soma / Math.max(1, n), meioDaBase, caixa: [x0, y0, x1 + 1, y1 + 1] };
  }
  const VISTAS = {};
  for (const id of ['poltrona', 'abajur', 'guarda-roupa', 'cama', 'mesa']) if (im['giro-' + id + '0']) VISTAS[id] = [0, 1, 2, 3].map((l) => pecaDeImagem(im['giro-' + id + l], id));
  // A TELA DO COMPUTADOR (pedido dele, 14/10/2026: "o monitor fica desligado; seria legal ele ter variações, como a
  // janela"). A mesa veio com a tela lisa, de um cinza só (estado.mjs, "teclado"); a tela é a maior região ligada dessa
  // cor no alto do desenho, e o CONTEÚDO é desenhado por código, coluna a coluna (a tela é um paralelogramo inclinado):
  // em cada coluna, de cima a baixo da tela, s vai de 0 a 1 na largura e t na altura. Ela brilha sozinha (não escurece
  // de noite) e, de noite, clareia um pouco o que está em volta. Só as vistas de frente têm tela; nas de costas, o
  // monitor mostra a traseira.
  function telaDaVista(peca) {
    const m = peca.movel, ate = peca.caixa[1] + Math.round((peca.caixa[3] - peca.caixa[1]) * 0.5);
    const conta = new Map();
    for (let y = peca.caixa[1]; y < ate; y++) for (let x = peca.caixa[0]; x < peca.caixa[2]; x++) {
      const k = (y * W + x) * 4; if (!m[k + 3]) continue;
      const r = m[k], g2 = m[k + 1], b = m[k + 2];
      if (Math.max(r, g2, b) - Math.min(r, g2, b) >= 25 || r + g2 + b <= 120) continue;
      const chave = r + ',' + g2 + ',' + b; conta.set(chave, (conta.get(chave) ?? 0) + 1);
    }
    const cor = [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0].split(',').map(Number);
    if (!cor) return null;
    const perto = (k) => m[k * 4 + 3] && Math.abs(m[k * 4] - cor[0]) + Math.abs(m[k * 4 + 1] - cor[1]) + Math.abs(m[k * 4 + 2] - cor[2]) < 14;
    // a maior região ligada
    const visto = new Uint8Array(W * W); let maior = [];
    for (let y = peca.caixa[1]; y < ate; y++) for (let x = peca.caixa[0]; x < peca.caixa[2]; x++) {
      const k0 = y * W + x; if (visto[k0] || !perto(k0)) continue;
      const fila = [k0]; visto[k0] = 1;
      for (let i = 0; i < fila.length; i++) { const k = fila[i]; for (const v of [k - 1, k + 1, k - W, k + W]) if (v >= 0 && v < W * W && !visto[v] && perto(v)) { visto[v] = 1; fila.push(v); } }
      if (fila.length > maior.length) maior = fila;
    }
    if (maior.length < 60) return null;
    // a tela é convexa: em cada coluna, de cima a baixo dela
    const col = new Map();
    for (const k of maior) { const x = k % W, y = (k / W) | 0, c = col.get(x); if (!c) col.set(x, [y, y]); else { c[0] = Math.min(c[0], y); c[1] = Math.max(c[1], y); } }
    const xs = [...col.keys()].sort((a, b) => a - b), x0 = xs[0], x1 = xs[xs.length - 1];
    const pts = [];
    for (const x of xs) { const [ya, yb] = col.get(x); for (let y = ya; y <= yb; y++) pts.push([x, y, (x - x0) / Math.max(1, x1 - x0), (y - ya) / Math.max(1, yb - ya)]); }
    return pts;
  }
  const TELAS = VISTAS.mesa ? VISTAS.mesa.map((p, l) => (l === 0 || l === 3 ? telaDaVista(p) : null)) : [];
  // O CONTEÚDO: "auto" segue o estado (em call, a chamada; à toa, a conversa; ausente, desligada); o botão escolhe.
  const CONTEUDOS = ['auto', 'call', 'conversa', 'jogo', 'desligada'];
  let conteudo = 'auto';
  const conteudoAgora = () => (conteudo !== 'auto' ? conteudo : estado === 'call' ? 'call' : estado === 'ausente' ? 'desligada' : 'conversa');
  const misturar = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  // A cor de um ponto (s, t) da tela, no instante "q" (quartos de segundo). Pixel art: blocos chapados, poucas cores.
  function corDaTela(s, t, q, tipo) {
    if (tipo === 'call') {
      // A chamada: quatro quadros com as pessoas (a cabeça redonda), a borda verde em quem fala, e a barra embaixo.
      if (t > 0.86) return s > 0.44 && s < 0.56 ? [214, 72, 72] : [28, 30, 44];
      const i = s < 0.5 ? 0 : 1, j = t < 0.43 ? 0 : 1, quem = i + j * 2, fala = Math.floor(q / 6) % 4;
      const ls = (s - i * 0.5) / 0.5, lt = (t - j * 0.43) / 0.43;
      if (ls < 0.06 || ls > 0.94 || lt < 0.07 || lt > 0.93) return quem === fala ? [96, 210, 120] : [28, 30, 44];
      const CORES = [[236, 170, 178], [160, 214, 196], [240, 214, 140], [190, 170, 230]];
      const dx = (ls - 0.5) * 1.6, dy = (lt - 0.48) * 1.1;
      if (dx * dx + dy * dy < 0.12) return CORES[quem];
      if (lt > 0.78 && Math.abs(ls - 0.5) < 0.34) return misturar(CORES[quem], [40, 44, 62], 0.45); // os ombros
      return [48, 52, 74];
    }
    if (tipo === 'conversa') {
      // A conversa do Syden: a barra dos canais à esquerda e as mensagens subindo devagar.
      if (s < 0.22) return t < 0.18 ? [120, 96, 170] : [40, 36, 56];
      const linha = Math.floor(t * 9 + q / 8) % 9;
      const larg = [0.6, 0.85, 0, 0.45, 0.75, 0, 0.9, 0.5, 0][linha];
      const lt = (t * 9 + q / 8) % 1;
      if (larg && lt > 0.3 && lt < 0.8 && (s - 0.28) / 0.66 < larg && s > 0.28) return linha % 3 === 1 ? [200, 190, 240] : [226, 222, 236];
      if (larg && s > 0.24 && s < 0.27 && lt > 0.2 && lt < 0.9) return [236, 170, 178];
      return [58, 54, 78];
    }
    if (tipo === 'jogo') {
      // Um joguinho de plataforma: céu, nuvem, chão, e o bonequinho pulando.
      const pulo = Math.abs(Math.sin(q / 3)) * 0.25, bx = 0.3 + ((q % 40) / 40) * 0.4;
      if (Math.abs(s - bx) < 0.05 && t > 0.62 - pulo && t < 0.74 - pulo) return [236, 120, 90];
      if (t > 0.74) return t > 0.8 ? [120, 86, 60] : [110, 190, 90];
      if (t > 0.18 && t < 0.28 && ((s + q / 60) % 1) > 0.55 && ((s + q / 60) % 1) < 0.8) return [246, 246, 250];
      return [130, 190, 236];
    }
    return null; // desligada: o cinza do desenho
  }
  // O GUARDA-ROUPA ABERTO (pedido dele, 14/10/2026: "precisa de mais estados, como temos na janela"): as portas abertas
  // com as roupas, nas mesmas 4 vistas. Clicar nele leva o coelho até lá e abre; clicar de novo fecha.
  const VISTAS_ABERTO = im['giro-guarda-roupa-aberto0'] ? [0, 1, 2, 3].map((l) => pecaDeImagem(im['giro-guarda-roupa-aberto' + l], 'guarda-roupa')) : null;
  let guardaRoupaAberto = false;
  // Para onde cada móvel olha em cada posição (a ordem das vistas: Girar anda nesta lista).
  const ORIENTA = ['sudoeste', 'noroeste', 'nordeste', 'sudeste'];
  const NOMES = { cadeira: 'a cadeira', pufe: 'o pufe', poltrona: 'a poltrona', abajur: 'o criado-mudo', 'guarda-roupa': 'o guarda-roupa', cama: 'a cama', tapete: 'o tapete', mesa: 'a mesa' };
  const pufes = MOVEIS.filter((m) => m.pufe);
  const fixos = MOVEIS.filter((m) => !m.pufe);
  const centro = (pe) => [(pe[0] + pe[1]) / 2, (pe[2] + pe[3]) / 2];
  const pintado = (id) => fixos.find((m) => m.id === id);
  // Onde cada móvel foi pintado, e para onde ele olha na pintura (o criado-mudo e o guarda-roupa, de frente para o quarto).
  const LADO_PINTADO = { abajur: 3, 'guarda-roupa': 3, cama: 0, tapete: 0 };
  // O tamanho em casas inteiras, para a grade: o pufe 2 × 2, o tapete 4 × 4, o resto medido no desenho.
  const tamDe = (id, lado) => {
    if (id === 'pufe') return [2, 2];
    if (id === 'tapete') return [4, 4];
    const m = VISTAS[id]?.[lado].mede;
    if (m) return m.map((d) => Math.max(1, Math.ceil(d - 0.25)));
    const pe = pintado(id).pe; return [pe[1] - pe[0], pe[3] - pe[2]];
  };
  const encaixar = (id, u, v, lado) => { const [tu, tv] = tamDe(id, lado); return [Math.round(u - tu / 2) + tu / 2, Math.round(v - tv / 2) + tv / 2]; };
  function arrumacaoInicial() {
    const a = { pufe: { c: centro(pintado('tapete') ? MOVEIS.find((m) => m.id === 'pufe-meio').pe : [4, 6, 4, 6]).map(Math.round), lado: 0 }, poltrona: { c: [3, 6], lado: 0 } };
    for (const m of fixos) a[m.id] = { c: centro(m.pe), lado: LADO_PINTADO[m.id] ?? 0 };
    // A cama de casal não foi pintada aqui: começa no canto da cama pintada, encostada na parede da esquerda.
    if (VISTAS.cama) { const [tu, tv] = tamDe('cama', 0); a.cama = { c: [1.5 + tu / 2, tv / 2], lado: 0 }; }
    // A mesa do computador: encostada na parede da janela, no canto da direita, virada para o quarto (como na home); a
    // poltrona vai para o meio.
    if (VISTAS.mesa) { const [tu, tv] = tamDe('mesa', 0); a.mesa = { c: encaixar('mesa', 1 + tu / 2, N - tv / 2, 0), lado: 0 }; a.poltrona = { c: [3, 4], lado: 0 }; }
    return a;
  }
  const INICIAL = arrumacaoInicial();
  // A ARRUMAÇÃO DE CADA UM fica no navegador por enquanto (na página de teste); no app, ela vai para o servidor.
  let ARR = JSON.parse(JSON.stringify(INICIAL));
  try {
    const guardada = JSON.parse(localStorage.getItem('syden-quarto-arrumacao-2') ?? 'null');
    if (guardada && Object.keys(INICIAL).every((id) => guardada[id]?.c)) ARR = guardada;
  } catch { /* sem guardar: começa da inicial */ }
  const guardar = () => { try { localStorage.setItem('syden-quarto-arrumacao-2', JSON.stringify(ARR)); } catch { /* fica só nesta visita */ } };
  const ehDeitado = (id) => id === 'tapete';
  // No lugar da pintura? (mesmo centro e mesma posição; a cama de casal nunca, ela não foi pintada aqui)
  const noLugar = (id, c = ARR[id].c, lado = ARR[id].lado) =>
    id !== 'pufe' && id !== 'poltrona' && !(id === 'guarda-roupa' && VISTAS_ABERTO) && !(id === 'abajur' && VISTAS.abajur) && pintado(id) && !(id === 'cama' && VISTAS.cama) && !(id === 'mesa')
    && Math.abs(c[0] - INICIAL[id].c[0]) < 0.01 && Math.abs(c[1] - INICIAL[id].c[1]) < 0.01 && lado === INICIAL[id].lado;
  // O pé na grade (a área que ocupa) e o pé MEDIDO (o do desenho, para a forma e a profundidade).
  const peDe = (id, c = ARR[id].c, lado = ARR[id].lado) => {
    if (noLugar(id, c, lado)) return pintado(id).pe;
    const [tu, tv] = tamDe(id, lado); return [c[0] - tu / 2, c[0] + tu / 2, c[1] - tv / 2, c[1] + tv / 2];
  };
  const peMedidoDe = (id, c = ARR[id].c, lado = ARR[id].lado) => {
    if (noLugar(id, c, lado) || !VISTAS[id]) return peDe(id, c, lado);
    const [du, dv] = VISTAS[id][lado].mede; return [c[0] - du / 2, c[0] + du / 2, c[1] - dv / 2, c[1] + dv / 2];
  };
  const sobrepoe = (a, b) => a[0] < b[1] - 0.01 && a[1] > b[0] + 0.01 && a[2] < b[3] - 0.01 && a[3] > b[2] + 0.01;
  let pegado = null, selecionado = 'poltrona', modo = 'dia', grade = false, arrastando = false, alvo = null;
  // Cabe aqui? Dentro do quarto e sem passar por cima de outro móvel (o tapete fica embaixo de tudo).
  const ocupa = (c, quem = pegado, lado = ARR[quem].lado) => {
    const pe = peDe(quem, c, lado);
    if (pe[0] < -0.01 || pe[2] < -0.01 || pe[1] > N + 0.01 || pe[3] > N + 0.01) return true;
    if (ehDeitado(quem)) return false;
    return Object.keys(ARR).some((id) => id !== quem && !ehDeitado(id) && sobrepoe(peDe(id), pe));
  };
  // ============================== A CADEIRA COM FÍSICA (pedido dele, 14/10/2026) ==============================
  // "Ter física de fato, não o sprite sendo renderizado." Ela é uma roda no chão: posição e velocidade em casas, o
  // atrito das rodinhas, e as batidas nas paredes e nos móveis (um círculo contra o pé de cada um), com quique e um giro
  // quando bate de raspão. O coelho andando também a empurra. O ângulo é contínuo; a vista é a mais perto das 8.
  // Ela é desenhada como o coelho (a cada quadro, só a região dela), nunca na fotografia da cena: remontar a cena a
  // cada quadro custaria um núcleo inteiro num computador modesto.
  const OITO = ['south-west', 'south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west'];
  const VISTAS_CADEIRA = im['cadeira-south-west'] ? OITO.map((d) => pecaDeImagem(im['cadeira-' + d], 'cadeira')) : null;
  const R_CADEIRA = 0.38;
  // A altura do assento acima do chão (medida na vista) e quanto o coelho sobe para sentar nela.
  const ASSENTO_CADEIRA = 34, SOBE_CADEIRA = 20;
  const cadeira = { u: 6, v: 6, vu: 0, vv: 0, th: 0, w: 0, presa: false, kin: null, alvo: null };
  window.cadeiraDoTeste = cadeira; // para as fotos e o teste
  // O lugar dela na mesa: S é sentado à mesa (encostado); P0, puxada para trás, de onde se senta. Virada para a mesa.
  function lugarNaMesa() {
    if (!ARR.mesa) return null;
    const olha = ORIENTA[ARR.mesa.lado], [fu, fv] = VET[olha], pe = peDe('mesa'), [cu, cv] = centro(pe);
    const borda = [cu + fu * (pe[1] - pe[0]) / 2, cv + fv * (pe[3] - pe[2]) / 2];
    return { S: [borda[0] + fu * 0.42, borda[1] + fv * 0.42], P0: [borda[0] + fu * 1.15, borda[1] + fv * 1.15], th: Math.atan2(-fv, -fu) };
  }
  // Onde ela começa: onde ficou da última vez, ou puxada na mesa (chamado no fim, quando tudo já existe).
  function iniciarCadeira() {
    let g0 = null;
    try { g0 = JSON.parse(localStorage.getItem('syden-quarto-cadeira') ?? 'null'); } catch { /* começa na mesa */ }
    if (g0 && Number.isFinite(g0.u)) Object.assign(cadeira, { u: g0.u, v: g0.v, th: g0.th });
    else { const L = lugarNaMesa(); if (L) Object.assign(cadeira, { u: L.P0[0], v: L.P0[1], th: L.th }); }
  }
  const guardarCadeira = () => { try { localStorage.setItem('syden-quarto-cadeira', JSON.stringify({ u: cadeira.u, v: cadeira.v, th: cadeira.th })); } catch { /* fica só nesta visita */ } };
  const indiceDaVista = () => (((Math.round(cadeira.th / (Math.PI / 4)) % 8) + 8) % 8);
  // De costas para a tela (o encosto na frente de quem senta): as vistas do norte.
  const cadeiraDeCostas = () => [4, 5, 6].includes(indiceDaVista());
  const ehDeitadoOuNada = (id) => ehDeitado(id);
  function empurrar(nu, nv, pen, quique) {
    cadeira.u += nu * pen; cadeira.v += nv * pen;
    const vn = cadeira.vu * nu + cadeira.vv * nv;
    if (vn < 0) {
      cadeira.vu -= (1 + quique) * vn * nu; cadeira.vv -= (1 + quique) * vn * nv;
      // De raspão, ela gira: a velocidade ao longo da batida vira giro.
      const vt = -cadeira.vu * nv + cadeira.vv * nu;
      cadeira.w = Math.max(-6, Math.min(6, cadeira.w + vt * 0.7)); // e nunca vira pião
    }
  }
  function colidir() {
    const r = R_CADEIRA, Q = 0.45;
    // As paredes: a da janela (u = 0) com a fileira das cortinas, a da esquerda (v = 0), e as bordas da frente.
    if (cadeira.u < 0.85 + r) empurrar(1, 0, 0.85 + r - cadeira.u, Q);
    if (cadeira.v < r) empurrar(0, 1, r - cadeira.v, Q);
    if (cadeira.u > N - r) empurrar(-1, 0, cadeira.u - (N - r), Q);
    if (cadeira.v > N - r) empurrar(0, -1, cadeira.v - (N - r), Q);
    // Os móveis: o ponto do pé mais perto do centro dela.
    for (const id of Object.keys(ARR)) {
      if (ehDeitadoOuNada(id)) continue;
      const [u0, u1, v0, v1] = peDe(id);
      const qu = Math.min(u1, Math.max(u0, cadeira.u)), qv = Math.min(v1, Math.max(v0, cadeira.v));
      let du = cadeira.u - qu, dv = cadeira.v - qv, d = Math.hypot(du, dv);
      if (d >= r) continue;
      if (d < 1e-6) { // o centro dentro do móvel: sai pelo lado mais perto
        const saidas = [[cadeira.u - u0, -1, 0], [u1 - cadeira.u, 1, 0], [cadeira.v - v0, 0, -1], [v1 - cadeira.v, 0, 1]].sort((a, b) => a[0] - b[0])[0];
        empurrar(saidas[1], saidas[2], saidas[0] + r, Q);
      } else empurrar(du / d, dv / d, r - d, Q);
    }
  }
  const comeco = { u: 0, v: 0 };
  function passoDaCadeira(dt) {
    if (!VISTAS_CADEIRA) return;
    const c = cadeira;
    if (c.kin) {
      const k = c.kin, f = Math.min(1, (performance.now() - k.t0) / k.dur), e = f * f * (3 - 2 * f);
      c.u = k.de[0] + (k.para[0] - k.de[0]) * e; c.v = k.de[1] + (k.para[1] - k.de[1]) * e;
      let dth = ((k.th - k.th0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      c.th = k.th0 + dth * e; c.vu = c.vv = c.w = 0;
      if (f >= 1) { c.kin = null; guardarCadeira(); k.depois?.(); }
      return;
    }
    if (c.presa && c.alvo) {
      // Arrastando: ela vai até o ponteiro com velocidade (e bate no que estiver no caminho, como empurrada).
      c.vu = Math.max(-12, Math.min(12, (c.alvo[0] - c.u) / Math.max(dt, 0.016)));
      c.vv = Math.max(-12, Math.min(12, (c.alvo[1] - c.v) / Math.max(dt, 0.016)));
    } else {
      const atrito = Math.exp(-2.4 * dt);
      c.vu *= atrito; c.vv *= atrito; c.w *= Math.exp(-4.5 * dt);
      if (Math.hypot(c.vu, c.vv) < 0.03) c.vu = c.vv = 0;
      if (Math.abs(c.w) < 0.05) c.w = 0;
    }
    const n = Math.max(1, Math.ceil((Math.hypot(c.vu, c.vv) * dt) / 0.08));
    for (let i = 0; i < n; i++) { c.u += (c.vu * dt) / n; c.v += (c.vv * dt) / n; colidir(); }
    c.th += c.w * dt;
  }
  const cadeiraMexendo = () => !!VISTAS_CADEIRA && (cadeira.presa || !!cadeira.kin || Math.hypot(cadeira.vu, cadeira.vv) > 0 || Math.abs(cadeira.w) > 0);
  let rolando = false, tAnterior = 0;
  function rolar(t) {
    const dt = Math.min(0.05, (t - tAnterior) / 1000); tAnterior = t;
    passoDaCadeira(dt);
    desenhar();
    if (cadeiraMexendo()) requestAnimationFrame(rolar);
    else { rolando = false; guardarCadeira(); }
  }
  function acordarCadeira() { if (VISTAS_CADEIRA && !rolando) { rolando = true; tAnterior = performance.now(); requestAnimationFrame(rolar); } }
  // Ela rola sozinha até um lugar (puxada para a mesa, ou com o coelho sentado), e então chama "depois".
  function levarCadeira(para, th, dur, depois) {
    cadeira.kin = { de: [cadeira.u, cadeira.v], para, th0: cadeira.th, th, t0: performance.now(), dur, depois };
    acordarCadeira();
  }
  // O coelho andando esbarra nela: empurra, com a velocidade dele.
  let coelhoAntes = null;
  function esbarrao(dt) {
    if (!VISTAS_CADEIRA) return;
    const antes = coelhoAntes; coelhoAntes = [coelho.u, coelho.v];
    if (!antes || coelho.destino === 'cadeira' && !coelho.caminho.length || cadeira.kin || cadeira.presa) return;
    const du = cadeira.u - coelho.u, dv = cadeira.v - coelho.v, d = Math.hypot(du, dv), r = R_CADEIRA + 0.22;
    if (d >= r || d < 1e-6) return;
    const vu = (coelho.u - antes[0]) / Math.max(dt, 0.016), vv = (coelho.v - antes[1]) / Math.max(dt, 0.016);
    cadeira.u += (du / d) * (r - d); cadeira.v += (dv / d) * (r - d);
    const vn = vu * (du / d) + vv * (dv / d);
    if (vn > 0) { cadeira.vu += (du / d) * vn * 1.5; cadeira.vv += (dv / d) * vn * 1.5; cadeira.w += (Math.random() - 0.5) * 2; }
    colidir();
    acordarCadeira();
  }
  // O TAPETE MEXIDO: o desenho é levado pelo chão, ponto a ponto (ele é plano, então girar é só girar a textura).
  const cacheDoTapete = new Map();
  function tapeteEm(c, lado) {
    const chave = c.join(',') + '|' + lado;
    if (cacheDoTapete.has(chave)) return cacheDoTapete.get(chave);
    const orig = pecas.tapete, [oc0, oc1] = INICIAL.tapete.c;
    const movel = new Uint8ClampedArray(W * W * 4), peColuna = new Int16Array(W).fill(-1);
    let y0 = W;
    for (let k = 0; k < W * W; k++) {
      if (casa[k] < 0) continue;
      let a = mapaU[k] - c[0], b = mapaV[k] - c[1];
      for (let r = 0; r < lado; r++) [a, b] = [-b, a];
      const [sx, sy] = ponto(oc0 + a, oc1 + b), X = Math.floor(sx), Y = Math.floor(sy);
      if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
      const s = (Y * W + X) * 4;
      if (!orig.movel[s + 3]) continue;
      for (let q = 0; q < 4; q++) movel[k * 4 + q] = orig.movel[s + q];
      peColuna[k % W] = Math.max(peColuna[k % W], (k / W) | 0); y0 = Math.min(y0, (k / W) | 0);
    }
    const p = { id: 'tapete', movel, sombra: VAZIA, topo: y0, peColuna, centroTopo: 0 };
    if (cacheDoTapete.size > 8) cacheDoTapete.clear();
    cacheDoTapete.set(chave, p);
    return p;
  }
  const luz = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return (diaBorrado[i] + diaBorrado[i + 1] + diaBorrado[i + 2]) / 3; };

  // A grade em pixel: a casa de cada pixel do chão; a borda é onde a casa muda.
  const casa = new Int16Array(W * W).fill(-1);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const [u, v] = uvRapido(x + 0.5, y + 0.5);
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
        const px = dados(img, null, w, h);
        let cx = 0, cy = 0, nq = 0;
        for (let k = 0; k < w * h; k++) if (px[k * 4 + 3] > 127) { cx += k % w; cy += (k / w) | 0; nq++; }
        quadros.push({ px, w, h, cx: cx / Math.max(1, nq), cy: cy / Math.max(1, nq) });
      }
      const q0 = quadros[0];
      let fundo = 0, sx = 0, n = 0;
      for (let k = 0; k < q0.w * q0.h; k++) if (q0.px[k * 4 + 3] > 127) fundo = Math.max(fundo, (k / q0.w) | 0);
      for (let x = 0; x < q0.w; x++) for (let y = fundo - 3; y <= fundo; y++) if (q0.px[(y * q0.w + x) * 4 + 3] > 127) { sx += x; n++; }
      let topo = q0.h; for (let k = 0; k < q0.w * q0.h; k++) if (q0.px[k * 4 + 3] > 127) { topo = (k / q0.w) | 0; break; }
      ANIM[nome][d] = { quadros, peX: sx / Math.max(1, n), peY: fundo, topo };
      // DEITADO, a âncora é o meio do corpo (ele fica estendido sobre a cama, não de pé num ponto).
      if (nome.startsWith('dormindo') || nome === 'lendo') {
        let x0 = q0.w, x1 = 0, y0 = q0.h, y1 = 0;
        for (let k = 0; k < q0.w * q0.h; k++) if (q0.px[k * 4 + 3] > 127) { const x = k % q0.w, y = (k / q0.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        ANIM[nome][d] = { quadros, peX: (x0 + x1) / 2, peY: (y0 + y1) / 2, topo: y0 };
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
    // A fileira junto da parede da janela (u = 0) é onde descem as cortinas e o peitoril, pintados na parede: ali o
    // coelho parecia atravessar a cortina (relato de 14/10/2026).
    if (i === 0) return false;
    const cu = i + 0.5, cv = j + 0.5;
    return !Object.keys(ARR).some((id) => { if (ehDeitado(id)) return false; const pe = peDe(id); return cu > pe[0] && cu < pe[1] && cv > pe[2] && cv < pe[3]; });
  };
  const todasAsCasas = () => [...Array(N * N).keys()].map((k) => [Math.floor(k / N), k % N]);
  // OS PONTOS SÃO DO MÓVEL: calculados de onde ele está AGORA (arrastou, o ponto foi junto; girou, o olhar mudou).
  // "ao": as casas do chão de onde se chega; "onde": onde o pé fica (null = fica na casa de chegada); "sobe": quantos px
  // acima do chão (o assento); "frente": a posição na ordem de desenho (logo depois do móvel, por cima dele).
  // No pufe ele senta PERTO DA BORDA do lado para onde olha (no meio, a distância até a beirada virava um salto).
  function assentoNoPufe() {
    // A borda é a do lado por onde ele SUBIU: virar no pufe muda para onde ele olha, não onde está sentado (relato de
    // 14/10/2026: virando para trás, ele pulava para a outra borda).
    const o = coelho.ladoDoPufe ?? coelho.olharNoPufe ?? 'sudeste', vet = { sudoeste: [1, 0], sudeste: [0, 1], nordeste: [-1, 0], noroeste: [0, -1] }[o];
    return [ARR.pufe.c[0] + vet[0] * 0.3, ARR.pufe.c[1] + vet[1] * 0.3];
  }
  // NA CADEIRA DO COMPUTADOR: ele senta com ela puxada para trás (P0) e então ela rola até a mesa com ele. O lugar de
  // chegada (as casas de onde se chega) é o da beirada em P0; sentado, ele vai onde a cadeira for.
  const OLHA_DO_VETOR = { '1,0': 'sudoeste', '0,1': 'sudeste', '-1,0': 'nordeste', '0,-1': 'noroeste' };
  function pontoDaCadeira() {
    const L = lugarNaMesa(), olha = OLHA_DO_VETOR[Math.round(Math.cos(L.th)) + ',' + Math.round(Math.sin(L.th))] ?? 'sudoeste';
    const [fu, fv] = VET[olha], beira = [L.P0[0] + fu * 0.7, L.P0[1] + fv * 0.7];
    const perto = todasAsCasas().filter(([i, j]) => livre(i, j)).sort((a, b) => Math.hypot(a[0] + 0.5 - beira[0], a[1] + 0.5 - beira[1]) - Math.hypot(b[0] + 0.5 - beira[0], b[1] + 0.5 - beira[1]));
    return { ao: perto.slice(0, 1), onde: [cadeira.u, cadeira.v], sobe: SOBE_CADEIRA, pose: 'sentado', olha, sobre: 'cadeira', atras: olha.startsWith('n') };
  }
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
    // A CAMA, em qualquer posição: a cabeceira fica do lado oposto ao olhar; ele deita no meio do colchão, a cabeça
    // para a cabeceira, e se prepara no lado comprido que dá para a frente da tela (u ou v maior).
    const olhaC = ORIENTA[ARR.cama.lado], [fu, fv] = VET[olhaC], peC = peMedidoDe('cama'), eixoU = fu !== 0;
    const cab = eixoU ? (fu > 0 ? peC[0] : peC[1]) : (fv > 0 ? peC[2] : peC[3]);
    const ondeC = eixoU ? [cab + fu * 1.25, (peC[2] + peC[3]) / 2 - 0.1] : [(peC[0] + peC[1]) / 2 - 0.1, cab + fv * 1.25];
    const beiraC = eixoU ? [ondeC[0], peC[3] + 0.12] : [peC[1] + 0.12, ondeC[1]];
    // O GUARDA-ROUPA: ele para na casa da frente dele, olhando para ele.
    const OPOSTO = { sudoeste: 'nordeste', nordeste: 'sudoeste', sudeste: 'noroeste', noroeste: 'sudeste' };
    const olhaG = ORIENTA[ARR['guarda-roupa'].lado], [gu, gv] = VET[olhaG], peG = peDe('guarda-roupa'), [gcu, gcv] = centro(peG);
    const frenteG = [Math.floor(gcu + gu * ((peG[1] - peG[0]) / 2 + 0.5)), Math.floor(gcv + gv * ((peG[3] - peG[2]) / 2 + 0.5))];
    const olhaP = ORIENTA[ARR.poltrona.lado];
    return {
      // O pufe é redondo: ele senta virado para qualquer um dos 4 lados (sorteado ao chegar) e vira de vez em quando.
      pufe: { ao: em2x2(ARR.pufe.c), onde: assentoNoPufe(), sobe: 26, pose: 'sentado', olha: coelho.olharNoPufe ?? 'sudeste', sobre: 'pufe' },
      // Virada de costas, o encosto fica NA FRENTE do coelho: ele é desenhado antes dela.
      poltrona: { ao: vizinhas(...peDe('poltrona')), onde: [...ARR.poltrona.c], sobe: 8, pose: 'sentado', olha: olhaP, sobre: 'poltrona', atras: olhaP.startsWith('n') },
      // Na cama ele DEITA (lendo ou dormindo), no meio do colchão, a cabeça para a cabeceira (pedido dele, 14/10/2026).
      cama: { ao: vizinhas(...peDe('cama')), onde: ondeC, beira: beiraC, sobe: 40, pose: 'na cama', olha: olhaC, sobre: 'cama' },
      'guarda-roupa': { ao: [frenteG].filter(([i, j]) => livre(i, j)), onde: null, sobe: 0, pose: 'parado', olha: OPOSTO[olhaG] },
      ...(VISTAS_CADEIRA && ARR.mesa ? { cadeira: pontoDaCadeira(), mesa: pontoDaCadeira() } : {}),
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
    // Sentado ou deitado: LEVANTA primeiro, e só então anda.
    const atual = coelho.destino && !coelho.caminho.length && !coelho.trans && !coelho.aproximar ? pontos()[coelho.destino] : null;
    if (atual && atual.onde && coelho.destino !== id) return levantar(() => ir(id));
    // Para sentar, ele anda até a casa livre MAIS PERTO DA BEIRADA (a da frente do assento): chegando por outra casa, o
    // último trecho em linha reta atravessava o móvel. No pufe, o lado para onde ele vai olhar é sorteado antes.
    let alvos = pt.ao;
    if (pt.onde) {
      if (id === 'pufe') coelho.olharNoPufe = coelho.ladoDoPufe = window.olharNoPufeDoTeste ?? ['sudeste', 'sudoeste', 'nordeste', 'noroeste'][Math.floor(Math.random() * 4)];
      const ro = roteiro(id, pontos()[id]), d = ([i, j]) => Math.hypot(i + 0.5 - ro.beira[0], j + 0.5 - ro.beira[1]);
      alvos = [[...pt.ao].sort((a, b) => d(a) - d(b))[0]];
    }
    const c = caminho(saida(), alvos);
    if (!c) return;
    if (id === 'mesa') return ir('cadeira');
    if (id === 'cadeira') { const L = lugarNaMesa(); levarCadeira(L.P0, L.th, 900); }
    coelho.pose = 'parado'; coelho.destino = id;
    andarAte(c);
  }
  // A COREOGRAFIA DE SENTAR (relato de 14/10/2026: "ele vai alterando a animação no ar; deveria primeiro chegar no
  // objeto"). Três tempos: (1) anda até a BEIRADA (o ponto do chão logo na frente do assento, ou ao lado da cama),
  // (2) vira de costas para o assento e toca os quadros de sentar ALI, com os pés no chão, (3) no fim, a pose no assento.
  // Levantar é o mesmo ao contrário, e só depois ele anda.
  const VET = { sudoeste: [1, 0], sudeste: [0, 1], nordeste: [-1, 0], noroeste: [0, -1] };
  // A TRANSIÇÃO PELO CENTRO DO CORPO (relato de 14/10/2026: "ele teleporta"). Cada quadro do meio tem outra forma (de pé,
  // agachado, sentado, deitado); posicionado pelo pé, o corpo pulava a cada troca. Agora a transição sabe a pose de SAÍDA
  // (de pé na beirada) e a de CHEGADA (no assento, ou deitado na cama), e o CENTRO do corpo desliza de uma para a outra,
  // com aceleração suave: cada quadro é desenhado com o próprio centro nesse caminho. O pé (para a sombra e a
  // profundidade) e a altura vão juntos.
  const ASSENTO = { pufe: 30, poltrona: 22, cama: 30, cadeira: ASSENTO_CADEIRA }; // a altura de verdade do assento (a linha das pernas)
  // Na cama, a pose sai de "dormindo": para deitar, do estado (ausente dorme); para LEVANTAR, do que ele está fazendo
  // (relato de 14/10/2026: ele dormia e levantava com o livro, porque o estado já tinha virado "à toa").
  function poseDoAssento(id, dormindo) {
    if (id === 'cama') return dormindo ? (coelho.largado || performance.now() - coelho.desde > 20000 ? 'dormindo-largado' : 'dormindo') : 'lendo';
    return id === 'poltrona' || id === 'cadeira' ? 'sentado-poltrona' : 'sentado';
  }
  function roteiro(id, pt, dormindo = estado === 'ausente') {
    let beira, nomeT;
    if (id === 'cama') {
      nomeT = dormindo ? 'deitar' : 'deitar-lendo';
      beira = pt.beira; // encostado na cama, no lado comprido da frente
    } else {
      const [vu, vv] = VET[pt.olha], r = id === 'pufe' ? 0.62 : 0.7; // no pufe, encostado na borda (0,45 do assento) antes de subir
      beira = [pt.onde[0] + vu * r, pt.onde[1] + vv * r];
      nomeT = 'sentar';
    }
    let quadros = [...quadrosDe(nomeT, pt.olha).quadros];
    // NA CAMA, PRIMEIRO SENTA NA BEIRADA (relato de 14/10/2026: "no primeiro quadro ele já está lendo"). O deitar do
    // PixelLab começa sentado, e o deitar-lendo, sentado com o livro aberto. Na frente vão os três primeiros do sentar (de
    // pé, agachando) e, para ler, o sentado SEM livro do deitar: ele senta, abre o livro e só então se deita.
    if (id === 'cama') {
      const sentar = quadrosDe('sentar', pt.olha).quadros.slice(0, 3);
      quadros = [...sentar, ...(nomeT === 'deitar-lendo' ? [quadrosDe('deitar', pt.olha).quadros[0]] : []), ...quadros];
    }
    // Na poltrona de frente, o fim do sentar já abre os braços até os apoios (trecho próprio, sem a poltrona inventada
    // que a primeira tentativa desenhou): os 4 primeiros quadros do sentar e os 2 dos braços.
    if ((id === 'poltrona' || id === 'cadeira') && ANIM.bracos?.[pt.olha]) quadros = [...quadros.slice(0, 4), ...ANIM.bracos[pt.olha].quadros];
    return { beira, atrasNaBeira: id !== 'cama' && pt.olha.startsWith('n'), quadros, de: { chao: beira, h: 0, anim: 'parado' }, para: { chao: pt.onde, h: pt.sobe, anim: poseDoAssento(id, dormindo) } };
  }
  const DUR_TOTAL = 1500; // a transição inteira (sentar, deitar), com quantos quadros tiver
  function tocar(id, pt, ro, reverso, depois) {
    if (semAndar || !ro.quadros.length) { depois(); return; }
    coelho.trans = {
      quadros: reverso ? [...ro.quadros].reverse() : ro.quadros, de: reverso ? ro.para : ro.de, para: reverso ? ro.de : ro.para,
      reverso, t0: performance.now(), dur: DUR_TOTAL * (ro.quadros.length > 6 ? 1.3 : 1), depois, alvo: id, dir: pt.olha, atrasNaBeira: ro.atrasNaBeira,
    };
  }
  // Onde fica o centro do corpo de uma pose em relação ao ponto do chão embaixo dela (sem a altura do assento).
  function desvioDaPose(pose, dir) {
    const a = quadrosDe(pose.anim, dir), q = a.quadros[0];
    return [q.cx - a.peX, q.cy - a.peY - 1];
  }
  // O último trecho a pé, fora da grade: da casa até a beirada (ou de volta).
  function aproximar(alvo, atras, sobre, depois) {
    if (semAndar) { coelho.u = alvo[0]; coelho.v = alvo[1]; depois(); return; }
    coelho.aproximar = { alvo, atras, sobre, depois };
  }
  function chegar() {
    const pt = coelho.destino && pontos()[coelho.destino];
    if (!pt) { coelho.pose = 'parado'; return; }
    if (!pt.onde) { if (coelho.destino === 'guarda-roupa' && VISTAS_ABERTO) guardaRoupaAberto = true; return chegarDeVez(); }
    coelho.largado = Math.random() < 0.5; // dormindo rígido ou largado: sorteado antes, a transição já vai para ele
    const id = coelho.destino, p2 = pontos()[id], ro = roteiro(id, p2);
    aproximar(ro.beira, ro.atrasNaBeira, id, () => { coelho.dir = p2.olha; tocar(id, p2, ro, false, () => chegarDeVez()); });
  }
  function levantar(depois) {
    if (coelho.destino === 'cadeira') {
      const L = lugarNaMesa();
      if (Math.hypot(cadeira.u - L.P0[0], cadeira.v - L.P0[1]) > 0.05) {
        coelho.descendo = true;
        levarCadeira(L.P0, L.th, 700, () => { coelho.descendo = false; levantar(depois); });
        return;
      }
    }
    // No pufe, virado para outro lado: primeiro se vira de volta para o lado por onde subiu (a virada suave leva até
    // 400 ms), e só então desce por ele.
    if (coelho.destino === 'pufe' && coelho.ladoDoPufe && coelho.olharNoPufe !== coelho.ladoDoPufe) {
      coelho.olharNoPufe = coelho.ladoDoPufe;
      coelho.descendo = true;
      setTimeout(() => { coelho.descendo = false; levantar(depois); }, 450);
      return;
    }
    const id = coelho.destino, pt = pontos()[id], ro = roteiro(id, pt, coelho.pose === 'dormindo');
    coelho.destino = null; coelho.pose = 'parado';
    tocar(id, pt, ro, true, () => {
      coelho.u = ro.beira[0]; coelho.v = ro.beira[1];
      const c = saida();
      aproximar([c[0] + 0.5, c[1] + 0.5], ro.atrasNaBeira, id, () => depois());
    });
  }
  function chegarDeVez() {
    const pt = coelho.destino && pontos()[coelho.destino];
    if (!pt) { coelho.pose = 'parado'; return; }
    coelho.dir = pt.olha;
    coelho.pose = coelho.destino === 'cama' ? (estado === 'ausente' ? 'dormindo' : 'lendo') : pt.pose;
    if (coelho.destino === 'cadeira') { const L = lugarNaMesa(); coelho.descendo = true; levarCadeira(L.S, L.th, 700, () => { coelho.descendo = false; if (coelho.redecidir) { coelho.redecidir = false; decidir(); } }); }
    // DORMINDO (ideia dele): às vezes rígido, às vezes largado; o rígido relaxa sozinho depois de um tempo.
    coelho.desde = performance.now();
  }
  // O ESTADO REAL DECIDE O LUGAR. Em call, a poltrona faz o papel do computador, que o quarto ainda não tem.
  function decidir() {
    if (coelho.trans || coelho.aproximar || coelho.descendo) { coelho.redecidir = true; return; } // no meio de sentar ou levantar: decide quando terminar
    if (estado === 'ausente' || (estado === 'atoa' && modo === 'noite')) {
      // Já na cama: só troca entre ler e dormir, sem levantar.
      if (coelho.destino === 'cama' && !coelho.caminho.length) { chegarDeVez(); return; }
      return ir('cama');
    }
    if (estado === 'call') return ir(VISTAS_CADEIRA && ARR.mesa ? 'cadeira' : 'poltrona');
    const atual = coelho.destino && !coelho.caminho.length ? pontos()[coelho.destino] : null;
    if (atual && atual.onde) return levantar(() => {});
    coelho.destino = null; coelho.pose = 'parado';
    const c = caminho(saida(), [saida()]); if (c) andarAte(c);
  }
  // À toa, de dia: de tempos em tempos, uma casa livre qualquer.
  function passear() {
    if (estado !== 'atoa' || modo === 'noite' || coelho.caminho.length || coelho.destino || coelho.trans || coelho.aproximar) return;
    const livres = todasAsCasas().filter(([i, j]) => livre(i, j));
    const c = caminho(saida(), [livres[Math.floor(Math.random() * livres.length)]]);
    if (c) andarAte(c);
  }
  const quadroBuf = new Uint8ClampedArray(W * W * 4), peBuf = new Int16Array(W).fill(-1), semSombra = new Uint8ClampedArray(W * W * 4);
  let ultimaCaixa = null, coelhoPe = null, coelhoTopo = 0, coelhoChave = 0, rotuloDoQuadro = '', coelhoLinha = W, coelhoSobre = null;
  function pecaDoCoelho() {
    const tr = coelho.trans, ap = coelho.aproximar;
    const pt = !tr && !ap && coelho.destino && !coelho.caminho.length ? pontos()[coelho.destino] : null;
    // No ponto, o olhar é o do móvel AGORA: girar a poltrona com ele sentado vira o coelho junto.
    if (pt) coelho.dir = pt.olha;
    let u, v, subida = 0, quadroT = null, sobreT = null, atrasT = false;
    let centroT = null, indiceT = 0;
    if (tr) {
      const f = Math.min(1, (performance.now() - tr.t0) / tr.dur);
      coelho.dir = tr.dir;
      // EM DUAS ETAPAS (relato de 14/10/2026: ele começava longe e deslizava pelo ar até o assento). Na primeira, ele SOBE
      // e o corpo passa da beirada para a BORDA do móvel (meia casa para dentro, no máximo); na segunda, já em cima, se
      // acomoda até o lugar (o meio da cama, o assento). "p" é o quanto ele já está no móvel (0 na beirada, 1 no lugar),
      // nos dois sentidos: ao levantar, ele vai do lugar à borda ainda em cima, e só então desce.
      const p = tr.reverso ? 1 - f : f, liso = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
      const B = tr.reverso ? tr.para : tr.de, S = tr.reverso ? tr.de : tr.para;
      const du = S.chao[0] - B.chao[0], dv = S.chao[1] - B.chao[1], dist = Math.hypot(du, dv) || 1, k = Math.min(1, 0.45 / dist);
      const borda = [B.chao[0] + du * k, B.chao[1] + dv * k];
      // O corpo passa a borda um pouco ANTES de a altura subir: sentado no ar ao lado do móvel era o "flutuar".
      // NO PUFE, UM PULINHO (relato de 14/10/2026: "ainda está deslizando"): o "sentar" do PixelLab é sentar NO CHÃO —
      // cinco quadros de pé e agachando, e só o último sentado. Subindo junto, ele chegava em cima do pufe ainda de pé.
      // Então ele agacha na beirada, com os pés no chão, e sobe de uma vez já sentado; o fim é se ajeitar no assento.
      const pulo = tr.alvo === 'pufe', n = tr.quadros.length;
      const eB = pulo ? liso((p - 0.36) / 0.3) : liso(p / 0.35);
      const e1 = pulo ? liso((p - 0.36) / 0.3) : liso((p - 0.08) / 0.47); // o impulso começa ainda agachado
      const e2 = pulo ? liso((p - 0.7) / 0.3) : liso((p - 0.55) / 0.45);
      const eO = pulo ? liso(p / 0.6) : liso(p);
      const iOrig = pulo ? (p < 0.45 ? Math.min(n - 2, Math.floor((p / 0.45) * (n - 1))) : n - 1) : Math.min(n - 1, Math.floor(p * n));
      indiceT = tr.reverso ? n - 1 - iOrig : iOrig;
      u = e2 > 0 ? borda[0] + (S.chao[0] - borda[0]) * e2 : B.chao[0] + (borda[0] - B.chao[0]) * eB;
      v = e2 > 0 ? borda[1] + (S.chao[1] - borda[1]) * e2 : B.chao[1] + (borda[1] - B.chao[1]) * eB;
      subida = B.h + (S.h - B.h) * e1;
      // O centro do corpo: o ponto do chão, menos a altura, mais o centro da forma (de pé → sentado ou deitado).
      const oB = desvioDaPose(B, tr.dir), oS = desvioDaPose(S, tr.dir), [gx, gy] = ponto(u, v);
      centroT = [gx + oB[0] + (oS[0] - oB[0]) * eO, gy - subida + oB[1] + (oS[1] - oB[1]) * eO];
      quadroT = { a: quadrosDe('parado', tr.dir), q: tr.quadros[indiceT] };
      sobreT = tr.alvo;
      atrasT = subida < 2 ? tr.atrasNaBeira : tr.alvo === 'poltrona' && tr.dir.startsWith('n');
    } else if (ap) { u = coelho.u; v = coelho.v; sobreT = ap.sobre; atrasT = ap.atras; }
    else [u, v] = pt && pt.onde ? pt.onde : [coelho.u, coelho.v];
    const sentado = (pt && pt.onde) || null;
    const [px, py] = ponto(u, v);
    if (ultimaCaixa) {
      const [a, b, c, d] = ultimaCaixa;
      for (let y = b; y < d; y++) for (let x = a; x < c; x++) if (x >= 0 && y >= 0 && x < W && y < W) quadroBuf[(y * W + x) * 4 + 3] = 0;
      peBuf.fill(-1);
    }
    // A ANIMAÇÃO pelo que ele está fazendo: andando, sentado (lendo ou dormindo, na cama), falando de pé, ou parado.
    const nomeAnim = coelho.caminho.length || ap ? 'andando'
      : pt && pt.onde ? (coelho.pose === 'lendo' ? 'lendo' : coelho.pose === 'dormindo' ? (coelho.largado || performance.now() - coelho.desde > 20000 ? 'dormindo-largado' : 'dormindo') : coelho.destino === 'poltrona' || coelho.destino === 'cadeira' ? 'sentado-poltrona' : 'sentado')
      : falando ? 'falando' : 'parado';
    // A VIRADA SUAVE (ideia dele, 14/10/2026): a direção que APARECE anda um passo por quadro no círculo das 8, pelo lado
    // mais curto, até a que ele quer; os passos do meio são a pose dele (de pé ou sentado) naquela direção. 90° = 200 ms.
    const ANEL = ['sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste', 'norte', 'nordeste', 'leste'];
    if (tr || semAndar || !coelho.dirVista) coelho.dirVista = coelho.dir;
    else if (coelho.dirVista !== coelho.dir && coelho.ultimoGiro !== coelho.quadro) {
      const i = ANEL.indexOf(coelho.dirVista), j = ANEL.indexOf(coelho.dir), dif = (j - i + 8) % 8;
      coelho.dirVista = ANEL[(i + (dif <= 4 ? 1 : -1) + 8) % 8];
      coelho.ultimoGiro = coelho.quadro;
    }
    const virando = coelho.dirVista !== coelho.dir;
    const animDaVirada = nomeAnim === 'sentado' || nomeAnim === 'sentado-poltrona' ? 'sentado' : 'parado';
    const a = quadroT ? quadroT.a : virando ? quadrosDe(animDaVirada, coelho.dirVista) : quadrosDe(nomeAnim, coelho.dir);
    // PARADO, a respiração é discreta (relato de 14/10/2026: o ciclo inteiro do PixelLab balançava "como bêbado", 5 px
    // na cabeça e 3 px para o lado). Só os quadros mais parecidos com a pose, devagar, a maior parte do tempo nela.
    const RESPIRA = [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 8, 8, 8];
    const iq = nomeAnim === 'parado' && !quadroT ? Math.min(a.quadros.length - 1, RESPIRA[coelho.quadro % RESPIRA.length]) : coelho.quadro % a.quadros.length;
    const quadro = quadroT ? quadroT.q : virando ? a.quadros[0] : a.quadros[iq];
    rotuloDoQuadro = (quadroT ? 'T' + indiceT + ':' + Math.round(centroT[0]) + ',' + Math.round(centroT[1]) : nomeAnim + iq) + coelho.dirVista + (falando ? Math.floor(coelho.quadro / 3) % 3 : '');
    const sw = quadro.w, sh = quadro.h;
    const altura = tr ? subida : sentado ? pt.sobe : 0;
    if (tr && quadroT && subida === 0) { /* na beirada: os pés do quadro no chão */ }
    // Na transição, pelo CENTRO do corpo; no resto, pelo pé.
    const X0 = Math.round(centroT ? centroT[0] - quadro.cx : px - a.peX), Y0 = Math.round(centroT ? centroT[1] - quadro.cy : py - a.peY - 1 - altura);
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
    window.caixaDoCoelho = ultimaCaixa; // para as fotos de perto do teste
    // [x, y do chão, altura do assento]: sentado, a sombra sai do assento e cai no chão em volta do móvel.
    coelhoPe = [px, py, altura];
    // A espessura dele na profundidade: de pé, fino; sentado, as pernas à frente; deitado, o corpo inteiro no colchão.
    const deitadoAgora = (pt && pt.onde && coelho.destino === 'cama') || (tr && tr.alvo === 'cama' && subida > 0);
    coelhoChave = py + (deitadoAgora ? 28 : (pt && pt.onde) || (tr && subida > 0) ? 10 : 5);
    // SENTADO OU DEITADO, o que fica abaixo da linha do assento (pernas, pés) está À FRENTE: cada pixel abaixo dela ganha
    // profundidade. Com uma profundidade só, os pés eram cobertos pela frente do assento e pela beirada da cama.
    // A linha das pernas é a altura de VERDADE do assento (na poltrona o desenho fica mais baixo que ele: a perna era cortada).
    const alvoAgora = tr ? tr.alvo : pt && pt.onde ? coelho.destino : null;
    coelhoLinha = altura > 0 ? py - Math.max(altura, ASSENTO[alvoAgora] ?? 0) - 4 : W;
    coelhoSobre = altura > 0 ? alvoAgora : null;
    const p = { id: 'coelho', movel: quadroBuf, sombra: semSombra, topo: Y0, peColuna: peBuf };
    // A ÁREA NO CHÃO: de pé, um quadradinho em volta do pé; sentado ou deitado, ele está SOBRE o móvel.
    const r = 0.3, area = [coelho.u - r, coelho.u + r, coelho.v - r, coelho.v + r];
    coelhoTopo = Y0 + a.topo;
    // Na transição e no trecho até a beirada, a ordem é a do móvel (antes ou depois dele).
    const sobre = sobreT ?? (sentado ? pt.sobre : null);
    return [{ p, dx: 0, dy: 0, fator: 1, pe: area, sobre, atras: sobreT ? atrasT : sentado ? !!pt.atras : false }];
  }
  // O BALÃO DE FALA (ideia dele, como no The Sims): o balão do D4 com os três pontos, que se acendem um de cada vez,
  // acima da cabeça. Desenhado por cima de tudo, em pixel: borda escura, miolo creme, rabicho apontando para a cabeça.
  const BALAO = [
    '..##################..',
    '.#cccccccccccccccccc#.',
    '#cccccccccccccccccccc#',
    '#cccccccccccccccccccc#',
    '#ccc11cccc22cccc33ccc#',
    '#ccc11cccc22cccc33ccc#',
    '#cccccccccccccccccccc#',
    '#cccccccccccccccccccc#',
    '.#cccccccccccccccccc#.',
    '..#####ccc##########..',
    '.......#cc#...........',
    '......#cc#............',
    '......##..............',
  ];
  function balao(px) {
    if (!ultimaCaixa) return;
    const [x0, , x1] = ultimaCaixa, bx = Math.round((x0 + x1) / 2 - 4), by = coelhoTopo - BALAO.length - 2;
    const aceso = Math.floor(coelho.quadro / 3) % 3;
    for (let y = 0; y < BALAO.length; y++) for (let x = 0; x < BALAO[y].length; x++) {
      const ch = BALAO[y][x];
      if (ch === '.') continue;
      const X = bx + x, Y = by + y;
      if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
      const cor = ch === '#' ? [58, 40, 34] : ch === 'c' ? [251, 244, 232] : Number(ch) - 1 === aceso ? [58, 40, 34] : [190, 172, 160];
      const k = (Y * W + X) * 4;
      px[k] = cor[0]; px[k + 1] = cor[1]; px[k + 2] = cor[2]; px[k + 3] = 255;
    }
  }

  // ============================== A FORMA DE CADA MÓVEL (o formato para escalar) ==============================
  // Cada móvel declara a sua forma UMA VEZ, em caixas: a fatia da área no chão que ela ocupa e a altura (px). Os lados
  // são relativos para onde o móvel OLHA ("frente", "tras", e os dois "lado"), então as 4 posições saem girando a forma.
  // Com ela, cada pixel do desenho sabe a ALTURA VISÍVEL (a caixa que a linha de visão encontra primeiro, de cima para
  // baixo): daí sai a profundidade (o coelho aparece na frente ou atrás pixel a pixel) e o ponto do chão embaixo dele
  // (a sombra). Móvel novo traz a forma dele; nada de camada recortada à mão (relato de 14/10/2026: a borda reta da
  // camada da frente cortava o coelho).
  const BRACO_POLTRONA = 34; // a altura do tampo dos braços da poltrona
  const FORMAS = {
    poltrona: [{ h: [0, 22] }, { lado: 'tras', fatia: 0.32, h: [0, 62] }, { lado: 'lados', fatia: 0.22, h: [0, BRACO_POLTRONA] }],
    pufe: [{ h: [0, 30] }],
    mesa: [{ h: [0, 42] }],
    // A cama olha para o sudoeste: a cabeceira fica atrás (u pequeno), os pés na frente.
    // A cama de casal (cama-casal-giros): colchão e cabeceira, sem peseira.
    cama: [{ h: [0, 30] }, { lado: 'tras', fatia: 0.1, h: [0, 62] }],
    abajur: [{ h: [0, 78] }],
    'guarda-roupa': [{ h: [0, 135] }],
  };
  const OLHA_DE = { cama: 'sudoeste' };
  // O TIPO de cada caixa, guardado por pixel: as pernas do coelho sentado passam à frente do assento, mas nunca do
  // encosto nem da face dos braços (relato de 14/10/2026: o rabo e o quadril apareciam por cima do encosto).
  const TIPO_DE_CAIXA = { base: 1, tras: 2, lados: 3, frente: 4 };
  // As caixas absolutas [u0, u1, v0, v1, h0, h1, tipo] de uma forma numa área, olhando para "olha".
  function caixasDe(area, olha, forma) {
    const [u0, u1, v0, v1] = area, du = u1 - u0, dv = v1 - v0;
    // O eixo do olhar e o sinal: sudoeste = +u, nordeste = -u, sudeste = +v, noroeste = -v.
    const eixoU = olha === 'sudoeste' || olha === 'nordeste', sinal = olha === 'sudoeste' || olha === 'sudeste' ? 1 : -1;
    const caixas = [];
    for (const c of forma) {
      const tipo = TIPO_DE_CAIXA[c.lado ?? 'base'];
      if (!c.lado || !olha) { caixas.push([u0, u1, v0, v1, ...c.h, tipo]); continue; }
      const fat = (lo, hi, f, doAlto) => (doAlto ? [hi - (hi - lo) * f, hi] : [lo, lo + (hi - lo) * f]);
      if (c.lado === 'frente' || c.lado === 'tras') {
        const noAlto = (c.lado === 'frente') === (sinal > 0);
        if (eixoU) caixas.push([...fat(u0, u1, c.fatia, noAlto), v0, v1, ...c.h, tipo]);
        else caixas.push([u0, u1, ...fat(v0, v1, c.fatia, noAlto), ...c.h, tipo]);
      } else for (const noAlto of [false, true]) {
        if (eixoU) caixas.push([u0, u1, ...fat(v0, v1, c.fatia, noAlto), ...c.h, tipo]);
        else caixas.push([...fat(u0, u1, c.fatia, noAlto), v0, v1, ...c.h, tipo]);
      }
    }
    return caixas;
  }
  // A altura visível de cada pixel de uma peça, guardada por posição (o móvel só muda quando é arrastado ou girado).
  const cacheDeAlturas = new Map();
  function alturasDe(it) {
    const chave = it.p.id + '|' + it.dx + '|' + it.dy + '|' + (it.olha ?? '');
    if (cacheDeAlturas.has(chave)) return cacheDeAlturas.get(chave);
    if (cacheDeAlturas.size > 24) cacheDeAlturas.clear();
    const hs = new Float32Array(W * W).fill(-1), tipos = new Int8Array(W * W), m = it.p.movel, cx = it.caixas ?? [];
    hs.tipos = tipos;
    const alto = Math.max(0, ...cx.map((c) => c[5]));
    for (let k = 0; k < W * W; k++) {
      if (!m[k * 4 + 3]) continue;
      if (it.deitado) { hs[k] = 0; continue; }
      const x = k % W + it.dx, y = ((k / W) | 0) + it.dy;
      // De cima para baixo: a primeira caixa que contém o ponto (chão em (x, y + h), altura h) é a superfície que se vê.
      for (let h = Math.ceil(alto); h >= 0; h--) {
        const Y = y + h;
        if (Y >= W || x < 0 || x >= W) continue;
        const g = Y * W + x, u = mapaU[g], v = mapaV[g];
        const achou = cx.find((c) => u >= c[0] && u <= c[1] && v >= c[2] && v <= c[3] && h >= c[4] && h <= c[5]);
        if (achou) { hs[k] = h; tipos[k] = achou[6]; break; }
      }
    }
    cacheDeAlturas.set(chave, hs);
    return hs;
  }
  const chaveDoPixel = new Float32Array(W * W);

  // A ORDEM DE DESENHO NO ISOMÉTRICO (14/10/2026): um número só por peça (a soma da casa da frente) errava com móvel
  // comprido (a cama) e com o coelho AO LADO de um móvel, e não na frente: ele aparecia cortado. O certo é comparar as
  // ÁREAS NO CHÃO: quem está inteiramente mais ao fundo num dos eixos (u ou v menor) é desenhado antes. O que fica
  // deitado (o tapete) vai primeiro; o coelho sentado vai logo depois do móvel (ou logo antes, se ele está de costas).
  function antes(a, b) {
    if (a.porCima !== b.porCima) return !b.porCima ? false : true; // a camada da frente vai por último
    if (a.deitado !== b.deitado) return !!a.deitado;
    if (a.sobre && a.sobre === b.p.id) return a.atras;
    if (b.sobre && b.sobre === a.p.id) return !b.atras;
    const e = 0.001;
    if (a.pe[1] <= b.pe[0] + e || a.pe[3] <= b.pe[2] + e) return true;
    if (b.pe[1] <= a.pe[0] + e || b.pe[3] <= a.pe[2] + e) return false;
    return a.pe[1] + a.pe[3] < b.pe[1] + b.pe[3];
  }
  function ordenar(itens) {
    const resto = [...itens], fila = [];
    while (resto.length) {
      let i = resto.findIndex((x) => !resto.some((y) => y !== x && antes(y, x) && !antes(x, y)));
      if (i < 0) i = 0; // um ciclo (não deve haver): segue na ordem
      fila.push(resto.splice(i, 1)[0]);
    }
    return fila;
  }

  // A SOMBRA DO COELHO (ideia dele, 14/10/2026): a silhueta projetada no chão, para o lado oposto à luz. De dia a luz é
  // a JANELA (o meio do vidro, alto: sombra curta e para a esquerda-frente); de noite, o ABAJUR (baixo e perto: sombra
  // mais comprida, para longe dele). Cada pixel do coelho a uma altura h acima do pé cai no chão a h × alongamento,
  // na direção contrária à da luz. Pixel art: sombra chapada, sem borrão. Só o chão escurece.
  const LUZ_DIA = { x: 420, y: 170, alongamento: 0.85, forca: 0.55 };
  const sombraBuf = new Uint8Array(W * W);
  // A ALTURA DO TAMPO de cada peça (onde a sombra cai em cima): o colchão, o tampo do pufe, o assento da poltrona. O que
  // fica acima (a cabeceira, o encosto) é lateral.
  const TAMPO = { cama: 30, pufe: 30, poltrona: 22, abajur: 52, 'guarda-roupa': 135 };
  // O mapa do chão: para cada pixel da tela, a casa (u, v) do ponto do chão ali. Calculado uma vez.
  const mapaU = new Float32Array(W * W), mapaV = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const [u, v] = uvRapido(x + 0.5, y + 0.5); mapaU[y * W + x] = u; mapaV[y * W + x] = v; }
  const dentroDaArea = (k, a) => mapaU[k] >= a[0] && mapaU[k] <= a[1] && mapaV[k] >= a[2] && mapaV[k] <= a[3];
  const chaoPx = new Int32Array(W * W).fill(-2), alturaPx = new Float32Array(W * W), tipoPx = new Int8Array(W * W);

  // A SOMBRA DO COELHO (relatos de 14/10/2026): cada pixel dele, a uma altura h, lança um raio que desce até o chão
  // afastando-se da luz. "alturaDoRaio" guarda, por ponto do chão, o raio mais alto que passa por cima; "forcaDoRaio",
  // quão escura a sombra é ali (mais forte perto dos pés, sumindo na ponta). Um pixel (de chão, de tapete ou de móvel) está
  // na sombra se o raio passa acima dele no ponto do chão que fica embaixo dele. A sombra de contato (embaixo dos pés)
  // entra na mesma camada. No fim, um borrão leve e poucos tons: macia nas bordas, ainda com cara de pixel art.
  const alturaDoRaio = new Float32Array(W * W), forcaDoRaio = new Float32Array(W * W), sombraFinal = new Float32Array(W * W);
  const tmp = new Float32Array(W * W), solido = new Float32Array(W * W);
  let listaAgora = [];
  let forcaDaSombra = 0.55, caixaDaSombra = null;
  function calcularSombra() {
    alturaDoRaio.fill(-1); forcaDoRaio.fill(0); sombraFinal.fill(0);
    caixaDaSombra = null;
    const c = ultimaCaixa, pe = coelhoPe;
    if (!c || !pe) return;
    const lp = lampada(), luz = modo === 'noite' ? { x: lp[0], y: lp[1] + 40, alongamento: 1.0, forca: 0.5 } : LUZ_DIA;
    forcaDaSombra = luz.forca;
    let dx = pe[0] - luz.x, dy = (pe[1] - luz.y) * 0.5;
    const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    const [x0, y0, x1, y1] = c;
    let bx0 = W, by0 = W, bx1 = 0, by1 = 0;
    // O SÓLIDO de cada ponto do chão: a altura do tampo do móvel que está em cima dele. O raio que desce até ele PARA ali
    // (a luz foi barrada): sem isso, a sombra atravessava a poltrona e aparecia de novo no chão do outro lado (duas
    // sombras), e cortava no meio do pufe.
    solido.fill(0);
    for (const it of listaAgora) {
      if (!it.caixas || it.deitado) continue;
      for (const c of it.caixas) {
        const cantos = [[c[0], c[2]], [c[1], c[2]], [c[0], c[3]], [c[1], c[3]]].map(([u, v]) => ponto(u, v));
        const xs = cantos.map((q) => q[0]), ys = cantos.map((q) => q[1]);
        for (let yy = Math.max(0, Math.floor(Math.min(...ys))); yy <= Math.min(W - 1, Math.ceil(Math.max(...ys))); yy++)
          for (let xx = Math.max(0, Math.floor(Math.min(...xs))); xx <= Math.min(W - 1, Math.ceil(Math.max(...xs))); xx++) {
            const k = yy * W + xx, u = mapaU[k], v = mapaV[k];
            if (u >= c[0] && u <= c[1] && v >= c[2] && v <= c[3] && c[5] > solido[k]) solido[k] = c[5];
          }
      }
    }
    const marca = (X, Y, h, f) => {
      if (X < 0 || Y < 0 || X >= W || Y >= W) return;
      const k = Y * W + X;
      if (h > alturaDoRaio[k]) alturaDoRaio[k] = h;
      if (f > forcaDoRaio[k]) forcaDoRaio[k] = f;
      bx0 = Math.min(bx0, X); bx1 = Math.max(bx1, X); by0 = Math.min(by0, Y); by1 = Math.max(by1, Y);
    };
    for (let y = Math.max(0, y0); y < Math.min(W, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (!quadroBuf[(y * W + x) * 4 + 3]) continue;
      const alto = Math.max(0, pe[1] - y);
      const comprimento = alto * luz.alongamento, passos = Math.max(1, Math.ceil(comprimento));
      for (let t = 0; t <= passos; t++) {
        const f = t / passos, X = Math.round(x + dx * comprimento * f), Y = Math.round(pe[1] + dy * comprimento * f);
        const h = alto * (1 - f), forca = 1 - 0.6 * (comprimento * f) / 90;
        const k = X >= 0 && Y >= 0 && X < W && Y < W ? Y * W + X : -1;
        if (k >= 0 && t > 1 && solido[k] > 0 && h <= solido[k]) { marca(X, Y, solido[k], forca); break; } // bateu no tampo
        marca(X, Y, h, forca);
      }
    }
    // O contato: uma mancha macia embaixo dos pés (sentado, embaixo do assento, no chão), mais forte no meio.
    for (let yy = -6; yy <= 6; yy++) for (let xx = -16; xx <= 16; xx++) {
      const d = (xx / 16) ** 2 + (yy / 6) ** 2;
      if (d < 1) marca(Math.round(pe[0] + xx), Math.round(pe[1] + yy), 0, 1.1 * (1 - d));
    }
    if (bx1 < bx0) return;
    caixaDaSombra = [Math.max(0, bx0 - 3), Math.max(0, by0 - 140), Math.min(W, bx1 + 4), Math.min(W, by1 + 4)];
    // O teste por pixel, só na caixa da sombra (mais a altura dos móveis acima dela).
    const X0 = Math.max(0, bx0 - 3), X1 = Math.min(W - 1, bx1 + 3), Y0 = Math.max(0, by0 - 140), Y1 = Math.min(W - 1, by1 + 3);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const k = y * W + x;
      if (dono[k] === 'coelho') continue;
      let G = k, h = 0;
      if (chaoPx[k] >= 0) { G = chaoPx[k]; h = alturaPx[k]; }
      else if (chaoPx[k] === -1 || casa[k] < 0) continue;
      if (alturaDoRaio[G] >= 0 && h <= alturaDoRaio[G] + 1) sombraFinal[k] = Math.min(1, forcaDoRaio[G]);
    }
    // Macia: dois borrões 3 × 3, e então poucos tons (quartos), como a luz é desenhada em pixel art.
    for (let passada = 0; passada < 3; passada++) {
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
        let soma = 0, n2 = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < W) { soma += sombraFinal[yy * W + xx]; n2++; } }
        tmp[y * W + x] = soma / n2;
      }
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) sombraFinal[y * W + x] = tmp[y * W + x];
    }
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const k = y * W + x;
      sombraFinal[k] = dono[k] === 'coelho' ? 0 : Math.round(sombraFinal[k] * 8) / 8;
    }
  }


  // O relógio: 10 quadros por segundo; o coelho anda 2,5 casas por segundo.
  let ultimo = performance.now(), proximoPasseio = 0, tempoDeDesenho = 0;
  setInterval(() => {
    const agora = performance.now(), dt = Math.min(0.25, (agora - ultimo) / 1000);
    ultimo = agora;
    coelho.quadro++;
    esbarrao(dt);
    if (coelho.trans && agora - coelho.trans.t0 >= coelho.trans.dur) { const d = coelho.trans.depois; coelho.trans = null; d(); if (coelho.redecidir && !coelho.trans) { coelho.redecidir = false; decidir(); } }
    // No pufe, de vez em quando vira para outro lado (ele é redondo).
    if (!coelho.trans && !coelho.descendo && coelho.destino === 'pufe' && !coelho.caminho.length && agora > (coelho.proximaVirada ?? 0)) {
      if (coelho.proximaVirada) {
        const L = ['sudeste', 'sudoeste', 'noroeste', 'nordeste'], i = L.indexOf(coelho.olharNoPufe ?? 'sudeste');
        coelho.olharNoPufe = L[(i + (Math.random() < 0.5 ? 1 : 3)) % 4];
      }
      coelho.proximaVirada = agora + 9000 + Math.random() * 7000;
    }
    if (coelho.aproximar) {
      const ap = coelho.aproximar, du = ap.alvo[0] - coelho.u, dv = ap.alvo[1] - coelho.v, dist = Math.hypot(du, dv), passo = 2 * dt;
      if (dist > 0.01) coelho.dir = Math.abs(du) >= Math.abs(dv) ? (du > 0 ? 'sudoeste' : 'nordeste') : (dv > 0 ? 'sudeste' : 'noroeste');
      if (dist <= passo) { coelho.u = ap.alvo[0]; coelho.v = ap.alvo[1]; coelho.aproximar = null; ap.depois(); if (coelho.redecidir && !coelho.trans && !coelho.aproximar) { coelho.redecidir = false; decidir(); } }
      else { coelho.u += (du / dist) * passo; coelho.v += (dv / dist) * passo; }
    } else if (coelho.caminho.length) {
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
    // Quem está ausente não está falando (relato de 14/10/2026: o balão aparecia com ele dormindo).
    if (estado === 'ausente' && falando) { falando = false; bf.setAttribute('aria-pressed', 'false'); }
    for (const o of document.querySelectorAll('[data-estado]')) o.setAttribute('aria-pressed', String(o === b));
    decidir();
  };
  const bf = document.getElementById('falando');
  bf.onclick = () => { if (estado === 'ausente') return; falando = !falando; bf.setAttribute('aria-pressed', String(falando)); };


  const tela = document.getElementById('tela'), g = tela.getContext('2d');
  // ============================== O DESENHO EM DUAS PARTES (desempenho, 14/10/2026) ==============================
  // Medido: redesenhar o quarto inteiro a cada quadro custava ~21 ms aqui e ~92 ms num processador 4× mais lento (um
  // núcleo inteiro). Agora: a CENA (móveis, luz, profundidades) é montada uma vez e só refeita quando algo nela muda
  // (arrastar, girar, dia/noite, janela, cortina, vista, grade); a cada quadro, só a REGIÃO do coelho, da sombra e do
  // balão é recalculada e enviada à tela; e, se nada mudou (sentado parado, dormindo), o quadro nem é desenhado.
  const D = new Float32Array(W * W * 3), fundoNoite = new Float32Array(W * W * 3);
  const eMovel = new Uint8Array(W * W), acesa = new Uint8Array(W * W), peY = new Int16Array(W * W);
  const baseD = new Float32Array(W * W * 3), baseEMovel = new Uint8Array(W * W), basePeY = new Int16Array(W * W);
  const baseDono = new Array(W * W).fill(''), baseChao = new Int32Array(W * W), baseAltura = new Float32Array(W * W), baseTipo = new Int8Array(W * W), baseChave = new Float32Array(W * W);
  let imagem = null, assinaturaCena = '', assinaturaQuadro = '', regiaoAnterior = null, lista = [], variante = null;
  const unir = (a, b) => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const prender = (r) => [Math.max(0, Math.floor(r[0])), Math.max(0, Math.floor(r[1])), Math.min(W, Math.ceil(r[2])), Math.min(W, Math.ceil(r[3]))];
  function restaurar(r) {
    const [x0, y0, x1, y1] = prender(r);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = y * W + x;
      D[k * 3] = baseD[k * 3]; D[k * 3 + 1] = baseD[k * 3 + 1]; D[k * 3 + 2] = baseD[k * 3 + 2];
      eMovel[k] = baseEMovel[k]; peY[k] = basePeY[k]; dono[k] = baseDono[k]; chaoPx[k] = baseChao[k]; alturaPx[k] = baseAltura[k]; tipoPx[k] = baseTipo[k]; chaveDoPixel[k] = baseChave[k];
    }
  }

  // Onde está a lâmpada (o alto do abajur), e se a luz pintada vale: só com o criado-mudo no lugar da pintura.
  let lampadaAgora = [0, 0], telaAgora = null, caixaDaTela = null;
  const lampada = () => lampadaAgora;
  // O criado-mudo pintado tinha falhas onde a cama antiga o tapava (relato de 14/10/2026, ao tirar a cama): ele é
  // sempre a vista solta, e a luz pintada vale com ele no lugar e na posição de origem.
  const naOrigem = (id) => Math.abs(ARR[id].c[0] - INICIAL[id].c[0]) < 0.01 && Math.abs(ARR[id].c[1] - INICIAL[id].c[1]) < 0.01 && ARR[id].lado === INICIAL[id].lado;
  const luzPintadaAgora = () => modo === 'noite' && luzPintada && naOrigem('abajur');
  // A pintura da noite sem a silhueta do criado-mudo: o buraco é preenchido com a luz em volta, de fora para dentro
  // (cada pixel vira a média dos vizinhos já preenchidos), feito uma vez.
  let noiteLimpa = null;
  function noiteAbajurSemMovel() {
    if (noiteLimpa) return noiteLimpa;
    const img = new Uint8ClampedArray(noiteAbajur), falta = new Uint8Array(W * W), mudou = new Uint8Array(W * W);
    img.mudou = mudou;
    for (let k = 0; k < W * W; k++) if (pecas.abajur.movel[k * 4 + 3]) falta[k] = 1;
    // quatro pixels de folga em volta (a borda do recorte tinha o contorno escuro e o brilho da cúpula)
    for (let volta = 0; volta < 4; volta++) {
      const borda = []; for (let k = W; k < W * W - W; k++) if (!falta[k]) { const x = k % W; if ((x > 0 && falta[k - 1]) || (x < W - 1 && falta[k + 1]) || falta[k - W] || falta[k + W]) borda.push(k); }
      for (const k of borda) falta[k] = 1;
    }
    for (let passada = 0, resta = 1; resta && passada < 80; passada++) {
      resta = 0; const agora = [];
      for (let k = W; k < W * W - W; k++) {
        if (!falta[k]) continue;
        let n = 0; const soma = [0, 0, 0];
        for (const v of [k - 1, k + 1, k - W, k + W]) if (!falta[v]) { n++; for (let c = 0; c < 3; c++) soma[c] += img[v * 4 + c]; }
        if (n) agora.push([k, soma.map((x) => x / n)]); else resta++;
      }
      for (const [k, cor] of agora) { for (let c = 0; c < 3; c++) img[k * 4 + c] = cor[c]; falta[k] = 0; mudou[k] = 1; }
      if (agora.length) resta = 1;
    }
    return (noiteLimpa = img);
  }
  function montarCena() {
    D.fill(0); fundoNoite.fill(0); eMovel.fill(0); acesa.fill(0); peY.fill(0); dono.fill('');
    const pintada = luzPintadaAgora(), fundoN = pintada ? noiteAbajur : noite;
    for (let k = 0; k < W * W; k++) for (let c = 0; c < 3; c++) { D[k * 3 + c] = base[k * 4 + c]; fundoNoite[k * 3 + c] = fundoN[k * 4 + c]; }
    // A pintura da noite com o abajur traz a silhueta do criado-mudo PINTADO; a vista solta é um pouco menor e deixava
    // um abajur fantasma por cima. Onde ele ficava, entra a noite sem ele.
    if (pintada) { const limpa = noiteAbajurSemMovel(); for (let k = 0; k < W * W; k++) if (limpa.mudou[k]) for (let c = 0; c < 3; c++) fundoNoite[k * 3 + c] = limpa[k * 4 + c]; }
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
    // Os móveis, de trás para a frente (a ordem pela área no chão).
    const [pu, pv] = ARR.pufe.c, [mx, my] = ponto(N / 2, N / 2);
    variante = pufes.reduce((a, b) => { const d = (m) => Math.hypot(centro(m.pe)[0] - pu, centro(m.pe)[1] - pv); return d(a) <= d(b) ? a : b; });
    const lista0 = Object.keys(ARR).map((id) => {
      const { c, lado: l } = ARR[id], olha = ORIENTA[l];
      if (id === 'pufe') {
        const p = pecas[variante.id];
        const [ox, oy] = p.base, [nx, ny] = ponto(pu, pv);
        // Só intensidade: a luz do chão onde ele está, sobre a luz do chão onde ele foi pintado.
        const fator = Math.min(1.3, Math.max(0.75, luz(nx, ny) / luz(ox, oy)));
        return { p: { ...p, id: 'pufe' }, dx: Math.round(nx - ox), dy: Math.round(ny - oy), fator, pe: [pu - 0.75, pu + 0.75, pv - 0.75, pv + 0.75], forma: FORMAS.pufe };
      }
      if (noLugar(id)) { const m = pintado(id); return { p: pecas[id], dx: 0, dy: 0, fator: 1, pe: m.pe, deitado: m.deitado, forma: FORMAS[id], olha }; }
      if (id === 'tapete') return { p: tapeteEm(c, l), dx: 0, dy: 0, fator: 1, pe: peDe(id), deitado: true };
      // A vista solta: a quina da frente do desenho vai para a quina da frente do pé, e a luz é a do lugar.
      const p = VISTAS[id][l], pe = peMedidoDe(id), [fx, fy] = ponto(pe[1], pe[3]), [nx, ny] = ponto(c[0], c[1]);
      const fator = Math.min(1.2, Math.max(0.8, luz(nx, ny) / luz(mx, my)));
      // Aberto: a vista aberta, posta onde a fechada estaria (o mesmo enquadramento).
      const desenho = id === 'guarda-roupa' && guardaRoupaAberto && VISTAS_ABERTO ? VISTAS_ABERTO[l] : p;
      return { p: desenho, dx: Math.round(fx - p.frente[0]), dy: Math.round(fy - p.frente[1]), fator, pe, contatoPe: pe, forma: FORMAS[id], olha };
    });
    for (const it of lista0) if (it.forma) it.caixas = caixasDe(it.pe, it.olha, it.forma);
    lista = ordenar(lista0);
    listaAgora = lista;
    chaoPx.fill(-2);
    chaveDoPixel.fill(-1);
    for (const it of lista) {
      const { p, dx, dy, fator, contato, raio, contatoPe } = it;
      const hs = alturasDe(it);
      // A sombra de contato de quem não a trouxe pintada (a poltrona): uma elipse no chão, mais escura no meio.
      const [rx, ry] = raio ?? [30, 15];
      if (contato) for (let y = Math.round(contato[1] - ry - 1); y <= contato[1] + ry + 1; y++) for (let x = Math.round(contato[0] - rx - 2); x <= contato[0] + rx + 2; x++) {
        const d = ((x - contato[0]) / rx) ** 2 + ((y - contato[1]) / ry) ** 2, k = y * W + x;
        if (d >= 1 || x < 0 || y < 0 || x >= W || y >= W || casa[k] < 0) continue;
        const f = 0.72 + 0.28 * d;
        for (let c = 0; c < 3; c++) { D[k * 3 + c] *= f; fundoNoite[k * 3 + c] *= f; }
      }
      // A SOMBRA DE CONTATO de quem não a trouxe pintada: o pé do móvel no chão, um pouco maior, mais escura por dentro.
      if (contatoPe) {
        const [u0, u1, v0, v1] = contatoPe, m = 0.14;
        for (let k = 0; k < W * W; k++) {
          if (casa[k] < 0) continue;
          const u = mapaU[k], v = mapaV[k];
          if (u < u0 - m || u > u1 + m || v < v0 - m || v > v1 + m) continue;
          const f = u > u0 && u < u1 && v > v0 && v < v1 ? 0.74 : 0.86;
          for (let c = 0; c < 3; c++) { D[k * 3 + c] *= f; fundoNoite[k * 3 + c] *= f; }
        }
      }
      for (let k = 0; k < W * W; k++) {
        const x = k % W + dx, y = ((k / W) | 0) + dy;
        if (x < 0 || y < 0 || x >= W || y >= W) continue;
        const d = y * W + x, a = p.sombra[k * 4 + 3];
        if (a) { const f = 1 - a / 255; for (let c = 0; c < 3; c++) { D[d * 3 + c] *= f; fundoNoite[d * 3 + c] *= f; } }
        if (p.movel[k * 4 + 3]) {
          for (let c = 0; c < 3; c++) D[d * 3 + c] = p.movel[k * 4 + c] * fator;
          eMovel[d] = 1; peY[d] = p.peColuna[k % W] + dy; dono[d] = p.id;
          // A altura visível (da forma) dá o ponto do chão embaixo dele e a profundidade; fora da forma, o pé da coluna.
          const h = hs[k];
          // O que fica DEITADO (o tapete) nunca está na frente de nada: com a profundidade do próprio pixel, a borda da
          // frente dele cortava as rodinhas da cadeira (relato de 14/10/2026).
          if (it.deitado) { chaoPx[d] = y * W + x; alturaPx[d] = 0; tipoPx[d] = 0; chaveDoPixel[d] = -1; }
          else if (h >= 0) { chaoPx[d] = (y + h) * W + x; alturaPx[d] = h; tipoPx[d] = hs.tipos[k]; chaveDoPixel[d] = y + h; }
          else { const pc = Math.min(W - 1, peY[d]); chaoPx[d] = pc * W + x; alturaPx[d] = pc - y; tipoPx[d] = 0; chaveDoPixel[d] = pc; }
          // A cúpula do abajur é luz: o alto da peça, nas cores claras. O abajur foi pintado APAGADO, e quem acende
          // é o código (na v1 ele veio aceso, com um halo recortado que brigava com esta luz).
          const m4 = k * 4;
          if (p.id === 'abajur' && ((k / W) | 0) < p.topo + 12 && p.movel[m4] + p.movel[m4 + 1] + p.movel[m4 + 2] > 360) acesa[d] = 1;
        }
      }
    }
    // A fotografia da cena, sem o coelho: a cada quadro, a região dele volta a ela.
    baseD.set(D); baseEMovel.set(eMovel); basePeY.set(peY); baseChao.set(chaoPx); baseAltura.set(alturaPx); baseTipo.set(tipoPx); baseChave.set(chaveDoPixel);
    for (let k = 0; k < W * W; k++) baseDono[k] = dono[k];
    const me = lista.find((i) => i.p.id === 'mesa');
    telaAgora = me && TELAS[ARR.mesa.lado] ? TELAS[ARR.mesa.lado].map(([x, y, s2, t2]) => [x + me.dx, y + me.dy, s2, t2]) : null;
    caixaDaTela = telaAgora ? telaAgora.reduce((c, [x, y]) => [Math.min(c[0], x - 34), Math.min(c[1], y - 34), Math.max(c[2], x + 35), Math.max(c[3], y + 35)], [W, W, 0, 0]) : null;
    const ab = lista.find((i) => i.p.id === 'abajur');
    lampadaAgora = ab ? [ab.p.centroTopo + ab.dx, ab.p.topo + ab.dy] : [0, 0];
    imagem = g.createImageData(W, W);
    sombraFinal.fill(0);
    passeFinal([0, 0, W, W]);
    pintarTela([0, 0, W, W]);
    document.getElementById('conceito').src = modo === 'dia' ? IMAGENS.conceitoDia : IMAGENS.conceitoNoite;
  }

  // A cor final de cada pixel de uma região: a luz da noite, a cortina, a sombra do coelho, a grade e o destino do arraste.
  function passeFinal(r) {
    const [x0, y0, x1, y1] = prender(r);
    const pintada = luzPintadaAgora(), razaoPe = pintada ? noiteAbajurPe : noitePe;
    const [lx, ly0] = lampada(), ly = ly0 + 6;
    const alvoOcupado = alvo ? ocupa(alvo) : false;
    // A luz da tela, de noite: o centro e a cor média, para clarear em volta.
    const tipoTela = conteudoAgora(), q = Math.floor(performance.now() / 250);
    let brilhoTela = null;
    if (telaAgora && modo === 'noite' && tipoTela !== 'desligada') {
      let sx = 0, sy = 0; for (const [x, y] of telaAgora) { sx += x; sy += y; }
      brilhoTela = [sx / telaAgora.length, sy / telaAgora.length, tipoTela === 'call' ? [90, 110, 160] : tipoTela === 'jogo' ? [120, 170, 210] : [140, 120, 190]];
    }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = y * W + x;
      const sombraAqui = sombraFinal[k];
      for (let c = 0; c < 3; c++) {
        let v = D[k * 3 + c];
        if (modo === 'noite') {
          // Com a luz pintada, os móveis só herdam a razão noite/dia (que já traz o abajur). Com a luz por código:
          // quente, caindo com a distância, em faixas como a luz é desenhada em pixel art.
          const brilho = pintada ? 0 : Math.floor(0.85 * Math.exp(-((x - lx) ** 2 + ((y - ly) * 1.4) ** 2) / (2 * 85 * 85)) * 12) / 12;
          const quente = [1, 0.72, 0.42][c] * brilho;
          if (acesa[k]) v = Math.min(255, v * [1.05, 0.8, 0.5][c] + [34, 14, 0][c]); // a cúpula acesa, laranja como na pintura
          // A luz de um móvel à noite é a do CHÃO no pé daquela coluna, e não a da parede atrás do pixel.
          else if (eMovel[k]) {
            const j = (Math.min(W - 1, peY[k] + 3) * W + x) * 4;
            const perto = pintada ? 0.75 * Math.exp(-((x - lx) ** 2 + ((y - ly) * 1.3) ** 2) / (2 * 60 * 60)) * [1, 0.7, 0.4][c] : 0;
            v = v * Math.min(pintada ? 1.2 : 0.9, razaoPe[j + c] / Math.max(1, diaPe[j + c])) + v * (quente + perto);
          }
          else v = fundoNoite[k * 3 + c] + base[k * 4 + c] * quente;
        }
        // A luz da janela, coada pelo linho: o quarto inteiro escurece por igual.
        if (fechada && modo === 'dia') v *= 0.86;
        if (sombraAqui) v *= 1 - sombraAqui * (1 - forcaDaSombra - (modo === 'noite' ? 0.12 : 0));
        imagem.data[k * 4 + c] = Math.min(255, v);
      }
      imagem.data[k * 4 + 3] = (modo === 'dia' ? foraDia : foraNoite)[k] && !eMovel[k] ? 0 : 255;
      if (brilhoTela) {
        const d2 = Math.hypot(x - brilhoTela[0], (y - brilhoTela[1]) * 1.3);
        if (d2 < 34) { const f = Math.floor((1 - d2 / 34) * 4) / 4 * 0.32; for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = Math.min(255, imagem.data[k * 4 + c] + brilhoTela[2][c] * f); }
      }
      // O destino do arraste, pintado nas próprias casas (pixel a pixel, sem polígono suavizado).
      if (alvo && casa[k] >= 0) {
        const i = Math.floor(casa[k] / N), j = casa[k] % N;
        const pa = peDe(pegado, alvo);
        if (i + 0.5 > pa[0] && i + 0.5 < pa[1] && j + 0.5 > pa[2] && j + 0.5 < pa[3]) {
          const cor = alvoOcupado ? [220, 80, 60] : [255, 240, 200];
          for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = imagem.data[k * 4 + c] * 0.65 + cor[c] * 0.35;
        }
      }
      if ((grade || alvo) && casa[k] >= 0 && !eMovel[k]) {
        const direita = x + 1 < W ? casa[k + 1] : -1, baixo = y + 1 < W ? casa[k + W] : -1;
        const cima = y > 0 ? casa[k - W] : -1;
        if ((direita !== casa[k] && direita >= 0) || (baixo !== casa[k] && baixo >= 0)) for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = Math.min(255, imagem.data[k * 4 + c] * 1.35 + 18);
        else if (cima >= 0 && cima !== casa[k]) for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] *= 0.7;
      }
    }
  }

  // Pinta o conteúdo da tela por cima da imagem (dentro da região r), só onde o pixel ainda é da mesa.
  function pintarTela(r) {
    if (!telaAgora) return;
    const tipo = conteudoAgora(), q = Math.floor(performance.now() / 250);
    for (const [x, y, s2, t2] of telaAgora) {
      if (x < r[0] || y < r[1] || x >= r[2] || y >= r[3]) continue;
      const k = y * W + x;
      if (dono[k] !== 'mesa') continue;
      const cor = corDaTela(s2, t2, q, tipo);
      if (!cor) continue;
      // de dia, a tela é um pouco mais apagada que de noite (o sol na sala)
      const f = modo === 'noite' ? 1 : 0.92;
      for (let c = 0; c < 3; c++) imagem.data[k * 4 + c] = cor[c] * f;
    }
  }
  function desenhar() {
    // A CENA muda? Refaz a fotografia (e a tela inteira).
    const assin = JSON.stringify([modo, luzPintada, vista, aberta, fechada, ARR, grade, alvo, pegado, guardaRoupaAberto]);
    if (assin !== assinaturaCena) { montarCena(); assinaturaCena = assin; assinaturaQuadro = ''; regiaoAnterior = [0, 0, W, W]; }
    // O COELHO deste quadro (enche quadroBuf e a caixa dele). Se nada mudou nele, o quadro não é desenhado.
    if (regiaoAnterior) restaurar(regiaoAnterior);
    pecaDoCoelho();
    const caixaC = ultimaCaixa ? [ultimaCaixa[0], ultimaCaixa[1] - 18, ultimaCaixa[2], ultimaCaixa[3]] : null; // com o balão
    const vc = VISTAS_CADEIRA ? VISTAS_CADEIRA[indiceDaVista()] : null, [cgx, cgy] = ponto(cadeira.u, cadeira.v);
    const cx0 = vc ? Math.round(cgx - vc.meioDaBase[0]) : 0, cy0 = vc ? Math.round(cgy - vc.meioDaBase[1]) : 0;
    const caixaCadeira = vc ? [cx0 + vc.caixa[0] - 18, cy0 + vc.caixa[1], cx0 + vc.caixa[2] + 18, cy0 + vc.caixa[3] + 8] : null;
    const telaMexe = telaAgora && conteudoAgora() !== 'desligada';
    const sig = JSON.stringify([ultimaCaixa, rotuloDoQuadro, coelhoChave, vc ? [cx0, cy0, indiceDaVista()] : 0, telaMexe ? Math.floor(performance.now() / 250) : 0, conteudoAgora()]);
    const mexeu = sig !== assinaturaQuadro;
    if (!mexeu && regiaoAnterior && regiaoAnterior[2] - regiaoAnterior[0] < W) { escreverLegenda(); return; }
    assinaturaQuadro = sig;
    if (caixaC) restaurar(caixaC);
    if (caixaCadeira) restaurar(caixaCadeira);
    // A CADEIRA: a sombra de contato embaixo das rodinhas, e então ela, por profundidade (o pé dela no chão).
    if (vc) {
      for (let yy = -7; yy <= 7; yy++) for (let xx = -17; xx <= 17; xx++) {
        const dd = (xx / 17) ** 2 + (yy / 7) ** 2, X = Math.round(cgx + xx), Y = Math.round(cgy + yy);
        if (dd >= 1 || X < 0 || Y < 0 || X >= W || Y >= W) continue;
        const k = Y * W + X;
        if (casa[k] < 0 || eMovel[k]) continue; // só no chão (sobre a mesa, ela a escurecia como se fosse vidro)
        const f = 0.7 + 0.3 * dd; for (let c = 0; c < 3; c++) D[k * 3 + c] *= f;
      }
      const chave = cgy + 4, fator = Math.min(1.2, Math.max(0.8, luz(cgx, cgy) / luz(...ponto(N / 2, N / 2))));
      for (let y = 0; y < vc.caixa[3]; y++) for (let x = vc.caixa[0]; x < vc.caixa[2]; x++) {
        const s4 = (y * W + x) * 4;
        if (!vc.movel[s4 + 3]) continue;
        const X = cx0 + x, Y = cy0 + y;
        if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
        const d = Y * W + X;
        if (eMovel[d] && chaveDoPixel[d] > chave) continue; // um móvel na frente dela
        for (let c = 0; c < 3; c++) D[d * 3 + c] = vc.movel[s4 + c] * fator;
        eMovel[d] = 1; dono[d] = 'cadeira'; chaveDoPixel[d] = chave; peY[d] = Math.round(cgy); chaoPx[d] = -1; tipoPx[d] = 0;
      }
    }
    // O coelho, por profundidade: o pixel dele aparece onde está mais à frente que o móvel ali.
    if (ultimaCaixa) {
      const [a0, b0, a1, b1] = ultimaCaixa;
      for (let y = Math.max(0, b0); y < Math.min(W, b1); y++) for (let x = Math.max(0, a0); x < Math.min(W, a1); x++) {
        const d = y * W + x, q = d * 4;
        if (!quadroBuf[q + 3]) continue;
        // AS PERNAS À FRENTE valem só sobre o assento e o tampo dos braços (onde ele apoia), nunca sobre o encosto nem a
        // face dos braços (relatos de 14/10/2026: o coelho "por cima do apoio", e o rabo por cima do encosto).
        const tipo = tipoPx[d], doMovel = coelhoSobre && dono[d].startsWith(coelhoSobre);
        const tampoDoBraco = tipo === 3 && alturaPx[d] >= BRACO_POLTRONA - 1;
        const pernas = doMovel && (tipo === 2 || (tipo === 3 && !tampoDoBraco)) ? 0 : Math.max(0, y - coelhoLinha) * 1.5;
        // O TAMPO DO ASSENTO nunca cobre quem está sentado nele: no pufe, de costas, o tampo da frente cortava o quadril.
        const noTampo = doMovel && tipo === 1 && alturaPx[d] >= (ASSENTO[coelhoSobre] ?? 99) - 1;
        if (dono[d] === 'cadeira' && coelhoSobre === 'cadeira') { if (cadeiraDeCostas()) continue; }
        else if (eMovel[d] && !noTampo && chaveDoPixel[d] > coelhoChave + pernas) continue; // o móvel está na frente
        for (let c = 0; c < 3; c++) D[d * 3 + c] = quadroBuf[q + c];
        eMovel[d] = 1; peY[d] = peBuf[x] >= 0 ? peBuf[x] : coelhoPe[1]; dono[d] = 'coelho'; chaoPx[d] = -1;
      }
    }
    calcularSombra();
    const agora = unir(unir(unir(caixaC, caixaDaSombra), caixaCadeira), telaMexe ? caixaDaTela : null);
    const r = prender(unir(agora, regiaoAnterior) ?? [0, 0, W, W]);
    passeFinal(r);
    pintarTela(r);
    if (falando) balao(imagem.data); // falando de pé ou sentado
    g.putImageData(imagem, 0, 0, r[0], r[1], r[2] - r[0], r[3] - r[1]);
    regiaoAnterior = agora;
    escreverLegenda();
  }
  function escreverLegenda() {
    const pf = lista.find((i) => i.p.id === 'pufe');
    document.getElementById('legenda').textContent = 'Poltrona olhando para ' + ORIENTA[ARR.poltrona.lado] + '. Escolhido: ' + NOMES[selecionado] + '. Pufe: versão "' + variante.id.replace('pufe-', '') + '"' + (modo === 'dia' && pf ? ', luz do lugar ×' + pf.fator.toFixed(2) : '') + '. Coelho: ' + (coelho.caminho.length ? 'andando' : falando && !coelho.destino ? 'falando' : coelho.pose) + ', olhando para ' + coelho.dir + (coelho.destino ? ' (' + coelho.destino + ')' : '') + '. Desenho do quadro: ' + Math.round(tempoDeDesenho) + ' ms.';
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
  // ARRASTA-SE O MÓVEL SOB O PONTEIRO (qualquer um; o tapete por baixo de tudo). O centro anda de casa em casa e só
  // fica onde cabe. Clicar sem arrastar leva o coelho até ele (se ele tiver o que fazer ali).
  const uvDoPonteiro = (e) => { const r = tela.getBoundingClientRect(); return uvDe((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * W / r.height); };
  let pegaDelta = [0, 0];
  const bgirar = document.getElementById('girar');
  const escolher = (id) => { selecionado = id; bgirar.textContent = 'Girar ' + NOMES[id]; bgirar.disabled = id === 'pufe'; };
  tela.addEventListener('pointerdown', (e) => {
    if (naJanela[pixelDo(e)]) return;
    const d = dono[pixelDo(e)];
    if (d === 'cadeira') {
      if (coelho.destino === 'cadeira') return; // com ele sentado (ou indo sentar), ela fica
      const [u, v] = uvDoPonteiro(e);
      cadeira.presa = true; cadeira.kin = null; escolher('cadeira'); pegaDelta = [cadeira.u - u, cadeira.v - v]; cadeira.alvo = [cadeira.u, cadeira.v];
      tela.setPointerCapture(e.pointerId); acordarCadeira();
      return;
    }
    if (!ARR[d]) return;
    pegado = d; escolher(d);
    const [u, v] = uvDoPonteiro(e);
    pegaDelta = [ARR[d].c[0] - u, ARR[d].c[1] - v];
    arrastando = true; tela.setPointerCapture(e.pointerId); alvo = [...ARR[d].c]; desenhar();
  });
  tela.addEventListener('pointermove', (e) => {
    if (cadeira.presa) { const [u, v] = uvDoPonteiro(e); cadeira.alvo = [u + pegaDelta[0], v + pegaDelta[1]]; return; }
    if (!arrastando) return;
    const [u, v] = uvDoPonteiro(e), c = encaixar(pegado, u + pegaDelta[0], v + pegaDelta[1], ARR[pegado].lado);
    const mesmo = Math.abs(c[0] - ARR[pegado].c[0]) < 0.6 && Math.abs(c[1] - ARR[pegado].c[1]) < 0.6;
    const novo = mesmo ? [...ARR[pegado].c] : c;
    if (!alvo || novo[0] !== alvo[0] || novo[1] !== alvo[1]) { alvo = novo; desenhar(); }
  });
  tela.addEventListener('pointerup', () => {
    // Soltou a cadeira: ela segue com a velocidade que tinha (jogada), e gira um pouco.
    if (cadeira.presa) {
      cadeira.presa = false; cadeira.alvo = null;
      const vel = Math.hypot(cadeira.vu, cadeira.vv), max = 7;
      if (vel > max) { cadeira.vu *= max / vel; cadeira.vv *= max / vel; }
      cadeira.w += (Math.random() - 0.5) * Math.min(vel, max) * 0.35;
      acordarCadeira();
      return;
    }
    if (!arrastando) return;
    arrastando = false;
    const atual = ARR[pegado].c;
    if (alvo && alvo[0] === atual[0] && alvo[1] === atual[1]) { // clicou sem arrastar
      if (pegado === 'guarda-roupa' && guardaRoupaAberto) guardaRoupaAberto = false;
      else if (pontos()[pegado]) ir(pegado);
    }
    else if (alvo && !ocupa(alvo)) { ARR[pegado] = { c: alvo, lado: ARR[pegado].lado }; guardar(); colidir(); acordarCadeira(); decidir(); }
    alvo = null; pegado = null; desenhar();
  });
  // GIRAR o móvel escolhido (o último que se tocou): a próxima das 4 posições. Se ele não couber girado ali, tenta a
  // seguinte; não cabendo em nenhuma, fica como está.
  const girar = () => {
    if (selecionado === 'cadeira') { levarCadeira([cadeira.u, cadeira.v], cadeira.th + Math.PI / 4, 250); return; }
    const id = selecionado;
    if (id === 'pufe') return;
    for (let passo = 1; passo < 4; passo++) {
      const lado = (ARR[id].lado + passo) % 4, c = noLugar(id) ? encaixar(id, ...ARR[id].c, lado) : encaixar(id, ...ARR[id].c, lado);
      if (!ocupa(c, id, lado)) { ARR[id] = { c, lado }; guardar(); decidir(); desenhar(); return; }
    }
  };
  bgirar.onclick = girar;
  document.addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') girar(); });
  document.getElementById('inicial').onclick = () => { ARR = JSON.parse(JSON.stringify(INICIAL)); guardar(); decidir(); desenhar(); };
  escolher('poltrona');
  const btela = document.getElementById('tela-pc'), NOMES_TELA = { auto: 'automática', call: 'em call', conversa: 'conversa', jogo: 'jogo', desligada: 'desligada' };
  btela.onclick = () => { conteudo = CONTEUDOS[(CONTEUDOS.indexOf(conteudo) + 1) % CONTEUDOS.length]; btela.textContent = 'Tela: ' + NOMES_TELA[conteudo]; assinaturaCena = ''; desenhar(); };
  iniciarCadeira();
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
