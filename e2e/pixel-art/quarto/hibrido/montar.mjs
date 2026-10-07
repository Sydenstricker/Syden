// Monta a página do quarto híbrido (quarto.html): o cenário pintado inteiro, e por cima, para cada objeto
// clicável, a MÁSCARA dele (mascaras/<id>.png). Ao passar o mouse, o objeto ganha um contorno de 1 pixel
// do quarto em volta do próprio desenho, como em jogo; o clique só acerta onde há objeto. O coelho e o gato
// são peças soltas, recortadas do conceito pela mesma remoção de fundo, e respiram sem arrastar o cenário.
// O dia e a noite são duas pinturas do mesmo quarto, trocadas com transição.
//   node e2e/pixel-art/quarto/hibrido/montar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64 } from '../imagem.mjs';
import { OBJETOS, VIVOS } from './objetos.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const ESCALA = 3, W = 313, H = 314;
const src = (b64) => `data:image/png;base64,${b64}`;
const noite = ler64(path.join(AQUI, 'noite.png'));
const dia = ler64(path.join(AQUI, 'dia.png'));

// Limpa cada máscara: transparência sem meio-termo e só a maior mancha (a remoção às vezes deixa um
// pedaço de planta vizinha na borda da caixa).
const p = await abrir();
async function limpar(b64) {
  return p.evaluate(async (b64) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const w = im.width, h = im.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, w, h); const a = d.data;
    for (let i = 3; i < a.length; i += 4) a[i] = a[i] < 128 ? 0 : 255;
    const rot = new Int32Array(w * h).fill(-1); const tam = [];
    for (let s = 0; s < w * h; s++) {
      if (rot[s] !== -1 || !a[s * 4 + 3]) continue;
      const id = tam.length; let n = 0; const pilha = [s]; rot[s] = id;
      while (pilha.length) {
        const q = pilha.pop(); n++; const x = q % w, y = (q / w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nq = ny * w + nx; if (rot[nq] === -1 && a[nq * 4 + 3]) { rot[nq] = id; pilha.push(nq); }
        }
      }
      tam.push(n);
    }
    const fica = tam.indexOf(Math.max(...tam));
    for (let s = 0; s < w * h; s++) if (rot[s] !== fica) a[s * 4 + 3] = 0;
    g.putImageData(d, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, b64);
}
const mascara = {};
for (const o of [...OBJETOS, ...VIVOS]) mascara[o.id] = await limpar(ler64(path.join(AQUI, 'mascaras', o.id + '.png')));
await fechar();

const caixaCss = ([x0, y0, x1, y1]) => `left:${x0 * ESCALA}px;top:${y0 * ESCALA}px;width:${(x1 - x0) * ESCALA}px;height:${(y1 - y0) * ESCALA}px`;
// O destaque de um objeto: um pedaço das duas pinturas, recortado pela máscara, com o contorno por fora.
// O filtro fica no elemento de FORA, porque a máscara corta tudo o que o próprio elemento desenha.
const destaque = (o) => {
  const [x0, y0] = o.caixa;
  const fundo = (cena) => `background:var(--${cena}) ${-x0 * ESCALA}px ${-y0 * ESCALA}px/${W * ESCALA}px ${H * ESCALA}px`;
  const masc = `-webkit-mask:url(${src(mascara[o.id])}) 0 0/100% 100%;mask:url(${src(mascara[o.id])}) 0 0/100% 100%`;
  return `<div class="destaque" id="d-${o.id}" style="${caixaCss(o.caixa)}"><div class="corte noite" style="${fundo('noite')};${masc}"></div><div class="corte dia" style="${fundo('dia')};${masc}"></div></div>`;
};
const botoes = OBJETOS.map((o) => `<button class="alvo" data-id="${o.id}" aria-label="${o.nome}" style="${caixaCss(o.caixa)}"></button>`).join('');
// O coelho respira da cintura para cima: a metade de cima desce um pixel, a de baixo fica parada.
const vivos = VIVOS.map((v) => {
  const img = `<img src="${src(mascara[v.id])}" alt="">`;
  return `<button class="vivo ${v.id}" data-id="${v.id}" aria-label="${v.nome}" style="${caixaCss(v.caixa)}"><span class="parte baixo">${img}</span><span class="parte cima">${img}</span></button>`;
}).join('');

const dados = { objetos: [...VIVOS.map((v) => ({ ...v, vivo: true })), ...OBJETOS].map(({ id, nome, oque, caixa, vivo }) => ({ id, nome, oque, caixa, vivo: !!vivo })), mascaras: mascara };

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Quarto do coelho — híbrido</title>
<style>
  :root { --contorno:#f7e6c4; --noite:url(${src(noite)}); --dia:url(${src(dia)}); }
  body { margin:0; background:#1d1a20; color:#efe3d3; font:15px system-ui, sans-serif; display:flex; flex-direction:column; align-items:center; gap:14px; padding:20px; }
  .quarto { position:relative; width:${W * ESCALA}px; height:${H * ESCALA}px; }
  .quarto.na-mira { cursor:pointer; }
  img.cena { position:absolute; inset:0; width:100%; height:100%; image-rendering:pixelated; transition:opacity 1.4s; }
  .cena.dia, .corte.dia { opacity:0; transition:opacity 1.4s; } .de-dia .cena.dia, .de-dia .corte.dia { opacity:1; }
  .destaque { position:absolute; z-index:4; opacity:0; pointer-events:none; image-rendering:pixelated;
    filter: drop-shadow(${ESCALA}px 0 0 var(--contorno)) drop-shadow(-${ESCALA}px 0 0 var(--contorno)) drop-shadow(0 ${ESCALA}px 0 var(--contorno)) drop-shadow(0 -${ESCALA}px 0 var(--contorno)); }
  .destaque.aceso, .todos .destaque { opacity:1; }
  .corte { position:absolute; inset:0; image-rendering:pixelated; }
  .alvo { position:absolute; z-index:3; padding:0; border:0; background:none; pointer-events:none; }
  .alvo:focus-visible { outline:none; }
  .vivo { position:absolute; z-index:6; padding:0; border:0; background:none; pointer-events:none; }
  .vivo:focus-visible { outline:none; }
  .parte { position:absolute; inset:0; }
  .parte img { width:100%; height:100%; image-rendering:pixelated; display:block; transition:filter 1.4s; }
  .parte.baixo { clip-path:inset(55% 0 0 0); } .parte.cima { clip-path:inset(0 0 45% 0); }
  .coelho .parte.cima { animation: respirar 3.2s steps(1) infinite; } .gato .parte.cima { animation: respirar 4.4s steps(1) infinite; }
  @keyframes respirar { 0%,55% { transform:translateY(0) } 56%,100% { transform:translateY(${ESCALA}px) } }
  .vivo.aceso .parte img, .todos .vivo .parte img { filter: drop-shadow(${ESCALA}px 0 0 var(--contorno)) drop-shadow(-${ESCALA}px 0 0 var(--contorno)) drop-shadow(0 ${ESCALA}px 0 var(--contorno)) drop-shadow(0 -${ESCALA}px 0 var(--contorno)); }
  .de-dia .vivo:not(.aceso) .parte img { filter: brightness(1.22) saturate(.9); }
  .vivo.cutucado { animation: pulo .45s steps(3) 1; }
  @keyframes pulo { 0% { transform:translateY(0) } 50% { transform:translateY(-${4 * ESCALA}px) } 100% { transform:translateY(0) } }
  .rotulos { position:absolute; inset:0; pointer-events:none; z-index:10; }
  .rotulo { position:absolute; transform:translate(-50%, -100%); white-space:nowrap; background:#3a2d33; color:#efe3d3; padding:3px 8px; border-radius:6px; font-size:13px; opacity:0; transition:opacity .15s; }
  .rotulo.aceso, .todos .rotulo { opacity:1; }
  .controles { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
  .controles button { background:#4a3442; color:#efe3d3; border:0; border-radius:8px; padding:8px 14px; font:inherit; cursor:pointer; }
  .aviso { min-height:1.4em; color:#f2cf93; }
  p.nota { max-width:760px; color:#b9afbb; font-size:13px; text-align:center; margin:0; }
</style></head>
<body>
  <div class="controles"><button id="luz">Amanhecer</button><button id="nomes">Mostrar todos os nomes</button></div>
  <div class="quarto" id="quarto">
    <img class="cena noite" src="${src(noite)}" alt="">
    <img class="cena dia" src="${src(dia)}" alt="">
    ${OBJETOS.map(destaque).join('')}
    ${botoes}
    ${vivos}
    <div class="rotulos" id="rotulos"></div>
  </div>
  <div class="aviso" id="aviso" aria-live="polite"></div>
  <p class="nota">Página de teste, fora do Syden. O cenário é o conceito convertido para pixel art de verdade (${W} px, ampliado ${ESCALA}×).
  Cada objeto tem a máscara do próprio desenho: o contorno segue a forma, e o clique só acerta onde há objeto.</p>
<script>
  const { objetos, mascaras } = ${JSON.stringify(dados)};
  const k = ${ESCALA};
  const quarto = document.getElementById('quarto'), camada = document.getElementById('rotulos'), aviso = document.getElementById('aviso');
  // As máscaras viram matrizes de "tem objeto aqui?", para o clique acertar o desenho e não a caixa.
  const cheio = {};
  Promise.all(objetos.map((o) => new Promise((ok) => {
    const im = new Image(); im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      cheio[o.id] = { w: im.width, a: g.getImageData(0, 0, im.width, im.height).data }; ok();
    }; im.src = 'data:image/png;base64,' + mascaras[o.id];
  })));
  const elemento = (o) => o.vivo ? document.querySelector('.vivo.' + o.id) : document.getElementById('d-' + o.id);
  const rotulos = {};
  for (const o of objetos) {
    const r = document.createElement('span'); r.className = 'rotulo'; r.textContent = o.nome;
    r.style.left = ((o.caixa[0] + o.caixa[2]) / 2) * k + 'px'; r.style.top = o.caixa[1] * k - 6 + 'px';
    camada.append(r); rotulos[o.id] = r;
  }
  let atual = null;
  function acender(o) {
    if (atual === o) return;
    if (atual) { elemento(atual).classList.remove('aceso'); rotulos[atual.id].classList.remove('aceso'); }
    atual = o;
    quarto.classList.toggle('na-mira', !!o);
    if (o) { elemento(o).classList.add('aceso'); rotulos[o.id].classList.add('aceso'); }
  }
  // Os vivos vêm primeiro na lista: estão na frente de tudo.
  function sob(x, y) {
    for (const o of objetos) {
      const [x0, y0, x1, y1] = o.caixa, m = cheio[o.id];
      if (!m || x < x0 || y < y0 || x >= x1 || y >= y1) continue;
      if (m.a[((y - y0) * m.w + (x - x0)) * 4 + 3]) return o;
    }
    return null;
  }
  const ponto = (e) => { const r = quarto.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / k), Math.floor((e.clientY - r.top) / k)]; };
  quarto.addEventListener('pointermove', (e) => acender(sob(...ponto(e))));
  quarto.addEventListener('pointerleave', () => acender(null));
  function agir(o) {
    if (o.vivo) {
      const v = elemento(o); v.classList.remove('cutucado'); void v.offsetWidth; v.classList.add('cutucado');
      aviso.textContent = o.id === 'coelho' ? 'O coelho levou um susto.' : 'O gato nem ligou.';
      return;
    }
    aviso.textContent = 'Abriria: ' + o.nome + ' (' + o.oque + ')';
    if (o.id === 'abajur') document.getElementById('luz').click();
  }
  quarto.addEventListener('click', (e) => { const o = sob(...ponto(e)); if (o) agir(o); });
  // Teclado: cada objeto tem um botão invisível na caixa dele; o foco acende o mesmo contorno.
  for (const b of document.querySelectorAll('.alvo, .vivo')) {
    const o = objetos.find((x) => x.id === b.dataset.id);
    b.addEventListener('focus', () => acender(o)); b.addEventListener('blur', () => acender(null));
    b.addEventListener('click', (e) => { if (e.detail === 0) agir(o); });
  }
  document.getElementById('nomes').onclick = (e) => { const s = quarto.classList.toggle('todos'); e.target.textContent = s ? 'Esconder os nomes' : 'Mostrar todos os nomes'; };
  const luz = document.getElementById('luz');
  luz.onclick = () => { const d = quarto.classList.toggle('de-dia'); luz.textContent = d ? 'Anoitecer' : 'Amanhecer'; };
</script>
</body></html>
`;
fs.writeFileSync(path.join(AQUI, 'quarto.html'), html);
console.log('quarto.html', Math.round(html.length / 1024), 'KB');
