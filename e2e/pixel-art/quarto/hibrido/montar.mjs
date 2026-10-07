// Monta a página do quarto híbrido (quarto.html): o cenário pintado inteiro, as áreas de clique por cima
// (um contorno ao passar o mouse e o nome do que abre), e as peças vivas — o coelho e o gato — recortadas
// do conceito para poderem se mexer. O dia e a noite são duas pinturas do mesmo quarto, trocadas com
// transição. O que ainda não foi pintado cai no conceito puro.
//   node e2e/pixel-art/quarto/hibrido/montar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64 } from '../imagem.mjs';
import { nativo } from './pintar-caixas.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const existe = (n) => fs.existsSync(path.join(AQUI, n + '.png'));
const ESCALA = 3, W = 313, H = 314;

// As áreas de clique, marcadas sobre ver-unzoom.png (900 px de largura, 10 px de margem) e convertidas
// para os pixels do quarto. Uma função pode ter mais de um polígono.
const pt = ([x, y]) => [Math.round(((x - 10) * W) / 900), Math.round(((y - 10) * W) / 900)];
export const OBJETOS = [
  { nome: 'Novidades', oque: 'prateleira de livros', poligonos: [[[95, 300], [228, 238], [234, 302], [100, 365]]] },
  { nome: 'Dia e noite', oque: 'abajur', poligonos: [[[146, 382], [202, 382], [202, 470], [146, 470]]] },
  { nome: 'Coelhos', oque: 'pôster do coelho', poligonos: [[[326, 140], [394, 110], [394, 230], [326, 260]]] },
  { nome: 'Amigos', oque: 'quadros e fotos', poligonos: [[[252, 192], [320, 164], [320, 264], [252, 298]], [[326, 264], [380, 244], [380, 296], [326, 308]]] },
  { nome: 'Explorar', oque: 'janela', poligonos: [[[440, 88], [688, 176], [688, 382], [440, 300]]] },
  { nome: 'Caixa de ideias', oque: 'quadro de cortiça', poligonos: [[[696, 226], [768, 244], [768, 338], [696, 320]]] },
  { nome: 'Mini-games', oque: 'computador', poligonos: [[[672, 343], [782, 385], [782, 472], [700, 502], [616, 462], [672, 432]]] },
  { nome: 'Salas de voz', oque: 'fone de ouvido', poligonos: [[[793, 386], [848, 386], [848, 448], [793, 448]]] },
  { nome: 'Guarda-roupa', oque: 'gavetas da cama', poligonos: [[[343, 548], [556, 470], [562, 524], [354, 612]]] },
  { nome: 'Plantar cenoura', oque: 'vaso', poligonos: [[[88, 532], [168, 532], [168, 616], [88, 616]]] },
].map((o) => ({ ...o, poligonos: o.poligonos.map((p) => p.map(pt)) }));

// As peças vivas: o que mudou entre o conceito e o quarto sem eles, dentro da caixa de cada uma.
const VIVOS = [
  { id: 'coelho', nome: 'Coelho', caixa: nativo([262, 288, 398, 474]) },
  { id: 'gato', nome: 'Gato', caixa: nativo([392, 370, 480, 420]) },
];
const base = ler64(path.join(AQUI, 'conceito-unzoom.png'));
const semVivos = existe('passo1-sem-coelho');
const cenaNoite = existe('noite') ? ler64(path.join(AQUI, 'noite.png')) : semVivos ? ler64(path.join(AQUI, 'passo1-sem-coelho.png')) : base;
const dia = existe('dia') ? ler64(path.join(AQUI, 'dia.png')) : null;
const vivos = [];
if (semVivos) {
  const p = await abrir();
  const vazio = ler64(path.join(AQUI, 'passo1-sem-coelho.png'));
  for (const v of VIVOS) {
    const [x0, y0, x1, y1] = v.caixa;
    const b64 = await p.evaluate(async ({ base, vazio, x0, y0, x1, y1 }) => {
      const carregar = async (b) => { const i = new Image(); i.src = 'data:image/png;base64,' + b; await i.decode(); return i; };
      const [a, b] = [await carregar(base), await carregar(vazio)];
      const w = x1 - x0, h = y1 - y0;
      const ler = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, x0, y0, w, h, 0, 0, w, h); return [c, g, g.getImageData(0, 0, w, h)]; };
      const [ca, ga, da] = ler(a);
      const [, , db] = ler(b);
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2]);
        da.data[i + 3] = d < 60 ? 0 : 255;
      }
      // Fica só a maior mancha: a repintura mexeu também na coberta em volta, e isso não é o bicho.
      const rot = new Int32Array(w * h).fill(-1); const tam = [];
      for (let s0 = 0; s0 < w * h; s0++) {
        if (rot[s0] !== -1 || !da.data[s0 * 4 + 3]) continue;
        const id = tam.length; let n = 0; const pilha = [s0]; rot[s0] = id;
        while (pilha.length) {
          const q = pilha.pop(); n++; const x = q % w, y = (q / w) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nq = ny * w + nx; if (rot[nq] === -1 && da.data[nq * 4 + 3]) { rot[nq] = id; pilha.push(nq); }
          }
        }
        tam.push(n);
      }
      const fica = tam.indexOf(Math.max(...tam));
      for (let s0 = 0; s0 < w * h; s0++) if (rot[s0] !== fica) da.data[s0 * 4 + 3] = 0;
      ga.putImageData(da, 0, 0);
      return ca.toDataURL('image/png').split(',')[1];
    }, { base, vazio, x0, y0, x1, y1 });
    vivos.push({ ...v, b64 });
  }
  await fechar();
}

const src = (b64) => `data:image/png;base64,${b64}`;
const svg = OBJETOS.map((o, i) => o.poligonos.map((p) => `<polygon data-i="${i}" points="${p.map((q) => q.join(',')).join(' ')}"/>`).join('')).join('');
const vivosHtml = vivos
  .map((v) => `<button class="vivo ${v.id}" aria-label="${v.nome}" data-nome="${v.nome}" style="left:${v.caixa[0] * ESCALA}px;top:${v.caixa[1] * ESCALA}px;width:${(v.caixa[2] - v.caixa[0]) * ESCALA}px;height:${(v.caixa[3] - v.caixa[1]) * ESCALA}px"><img src="${src(v.b64)}" alt=""></button>`)
  .join('');

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Quarto do coelho — híbrido</title>
<style>
  body { margin:0; background:#1d1a20; color:#efe3d3; font:15px system-ui, sans-serif; display:flex; flex-direction:column; align-items:center; gap:14px; padding:20px; }
  .quarto { position:relative; width:${W * ESCALA}px; height:${H * ESCALA}px; }
  .quarto > img.cena { position:absolute; inset:0; width:100%; height:100%; image-rendering:pixelated; transition:opacity 1.4s; }
  .cena.dia { opacity:0; } .quarto.de-dia .cena.dia { opacity:1; }
  svg.areas { position:absolute; inset:0; width:100%; height:100%; z-index:5; }
  svg.areas polygon { fill:transparent; stroke:transparent; stroke-width:1; cursor:pointer; outline:none; }
  svg.areas polygon.aceso { fill:rgba(247,230,196,.10); stroke:#f2cf93; }
  .vivo { position:absolute; padding:0; border:0; background:none; cursor:pointer; z-index:6; }
  .vivo img { width:100%; height:100%; image-rendering:pixelated; display:block; }
  .vivo:hover img, .vivo:focus-visible img { filter: drop-shadow(3px 0 0 #f2cf93) drop-shadow(-3px 0 0 #f2cf93) drop-shadow(0 3px 0 #f2cf93) drop-shadow(0 -3px 0 #f2cf93); }
  .vivo:focus-visible { outline:none; }
  .vivo img { transition: filter 1.4s; } .de-dia .vivo:not(:hover):not(:focus-visible) img { filter: brightness(1.22) saturate(.9); }
  /* Respirar: um pixel do quarto para baixo e de volta, em degrau, como pixel art se mexe. */
  .coelho img { animation: respirar 3.2s steps(1) infinite; } .gato img { animation: respirar 4.4s steps(1) infinite; }
  @keyframes respirar { 0%,55% { transform:translateY(0) } 56%,100% { transform:translateY(${ESCALA}px) } }
  .cutucado img { animation: pulo .5s steps(3) 1 !important; }
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
  <div class="controles">${dia ? '<button id="luz">Amanhecer</button>' : ''}<button id="nomes">Mostrar todos os nomes</button></div>
  <div class="quarto" id="quarto">
    <img class="cena noite" src="${src(cenaNoite)}" alt="">
    ${dia ? `<img class="cena dia" src="${src(dia)}" alt="">` : ''}
    <svg class="areas" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${svg}</svg>
    ${vivosHtml}
    <div class="rotulos" id="rotulos"></div>
  </div>
  <div class="aviso" id="aviso" aria-live="polite"></div>
  <p class="nota">Página de teste, fora do Syden. O cenário é o conceito convertido para pixel art de verdade (${W} px, ampliado ${ESCALA}×),
  com o que faltava repintado no estilo dele. O coelho e o gato são peças à parte: respiram, e pulam quando cutucados.</p>
<script>
  const OBJ = ${JSON.stringify(OBJETOS.map((o) => ({ nome: o.nome, oque: o.oque })))};
  const quarto = document.getElementById('quarto'), camada = document.getElementById('rotulos'), aviso = document.getElementById('aviso');
  const k = ${ESCALA};
  const rotulo = (texto, x, y) => { const r = document.createElement('span'); r.className = 'rotulo'; r.textContent = texto; r.style.left = x + 'px'; r.style.top = y + 'px'; camada.append(r); return r; };
  const grupos = {};
  for (const p of document.querySelectorAll('svg.areas polygon')) (grupos[p.dataset.i] ??= []).push(p);
  for (const [i, ps] of Object.entries(grupos)) {
    const pts = ps.flatMap((p) => p.getAttribute('points').split(' ').map((q) => q.split(',').map(Number)));
    const cx = (Math.min(...pts.map((q) => q[0])) + Math.max(...pts.map((q) => q[0]))) / 2, topo = Math.min(...pts.map((q) => q[1]));
    const r = rotulo(OBJ[i].nome, cx * k, topo * k - 4);
    const acender = (sim) => { r.classList.toggle('aceso', sim); ps.forEach((p) => p.classList.toggle('aceso', sim)); };
    const agir = () => { aviso.textContent = 'Abriria: ' + OBJ[i].nome + ' (' + OBJ[i].oque + ')'; if (OBJ[i].nome === 'Dia e noite') document.getElementById('luz')?.click(); };
    for (const p of ps) {
      p.setAttribute('tabindex', '0'); p.setAttribute('role', 'button'); p.setAttribute('aria-label', OBJ[i].nome);
      p.addEventListener('mouseenter', () => acender(true)); p.addEventListener('mouseleave', () => acender(false));
      p.addEventListener('focus', () => acender(true)); p.addEventListener('blur', () => acender(false));
      p.addEventListener('click', agir); p.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && agir());
    }
  }
  for (const v of document.querySelectorAll('.vivo')) {
    const r = rotulo(v.dataset.nome, v.offsetLeft + v.offsetWidth / 2, v.offsetTop - 4);
    v.addEventListener('mouseenter', () => r.classList.add('aceso')); v.addEventListener('mouseleave', () => r.classList.remove('aceso'));
    v.addEventListener('focus', () => r.classList.add('aceso')); v.addEventListener('blur', () => r.classList.remove('aceso'));
    v.onclick = () => { v.classList.remove('cutucado'); void v.offsetWidth; v.classList.add('cutucado'); aviso.textContent = v.dataset.nome === 'Coelho' ? 'O coelho levou um susto.' : 'O gato nem ligou.'; };
  }
  document.getElementById('nomes').onclick = (e) => { const s = quarto.classList.toggle('todos'); e.target.textContent = s ? 'Esconder os nomes' : 'Mostrar todos os nomes'; };
  const luz = document.getElementById('luz');
  if (luz) luz.onclick = () => { const d = quarto.classList.toggle('de-dia'); luz.textContent = d ? 'Anoitecer' : 'Amanhecer'; };
</script>
</body></html>
`;
fs.writeFileSync(path.join(AQUI, 'quarto.html'), html);
console.log('quarto.html', Math.round(html.length / 1024), 'KB | sem coelho:', semVivos, '| noite repintada:', existe('noite'), '| dia:', !!dia);
