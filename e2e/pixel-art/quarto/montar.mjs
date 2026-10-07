// Monta a página de teste do quarto (quarto.html), fora do Syden: a casca, as peças por cima em ordem de
// profundidade, cada uma clicável e com o nome à vista, e a noite feita por código sobre a mesma arte.
//   node e2e/pixel-art/quarto/montar.mjs   → quarto.html (abre direto no navegador)
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const medidas = JSON.parse(fs.readFileSync(path.join(AQUI, 'pecas', 'pecas.json'), 'utf8'));
const img = (id) => 'data:image/png;base64,' + fs.readFileSync(path.join(AQUI, 'pecas', id + '.png')).toString('base64');

// x, y: canto de cima à esquerda, em pixels do quarto (a casca tem 241×246). A ordem da lista é a ordem de
// desenho: o que vem depois fica na frente. espelhar: vira a peça para a outra parede.
// funcao: o que o objeto abre na home (o rótulo que aparece). Sem funcao, é enfeite.
export const LUGARES = [
  { id: 'casca', x: 0, y: 0 },
  { id: 'janela', x: 128, y: 30 },
  { id: 'cortica', x: 196, y: 66, funcao: 'Caixa de ideias' },
  { id: 'poster', x: 72, y: 28, funcao: 'Coelhos' },
  { id: 'mural', x: 24, y: 58, funcao: 'Amigos' },
  { id: 'prateleira', x: 50, y: 70, funcao: 'Novidades' },
  { id: 'estante', x: 112, y: 96, funcao: 'Dia e noite' },
  { id: 'cama', x: 30, y: 98 },
  { id: 'gato', x: 96, y: 137 },
  { id: 'coelho', x: 46, y: 100, funcao: 'Coelho' },
  { id: 'mesa', x: 150, y: 92, funcao: 'Mini-games' },
  { id: 'fone', x: 214, y: 112, funcao: 'Salas de voz' },
  { id: 'porta', x: 10, y: 96, espelhar: true, funcao: 'Explorar' },
  { id: 'tapete', x: 64, y: 150 },
  { id: 'vaso', x: 196, y: 176, funcao: 'Plantar cenoura' },
  { id: 'guarda-roupa', x: 150, y: 128, funcao: 'Guarda-roupa', fora: true },
];

const ESCALA = 3;
const pecas = LUGARES.filter((l) => !l.fora).map((l, z) => {
  const m = medidas[l.id];
  const estilo = `left:${l.x * ESCALA}px;top:${l.y * ESCALA}px;width:${m.w * ESCALA}px;height:${m.h * ESCALA}px;z-index:${z}${l.espelhar ? ';transform:scaleX(-1)' : ''}`;
  if (!l.funcao) return `<img class="peca" src="${img(l.id)}" style="${estilo}" alt="">`;
  return `<button class="peca clicavel" style="${estilo}" data-nome="${l.funcao}" aria-label="${l.funcao}"><img src="${img(l.id)}" alt=""></button>`;
}).join('\n');

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Quarto do coelho — teste</title>
<style>
  :root { --fundo:#2a2228; --texto:#efe3d3; --rotulo:#3a2d33; }
  body { margin:0; background:var(--fundo); color:var(--texto); font:15px system-ui, sans-serif; display:flex; flex-direction:column; align-items:center; gap:14px; padding:20px; }
  .quarto { position:relative; width:${241 * ESCALA}px; height:${246 * ESCALA}px; }
  .peca { position:absolute; image-rendering:pixelated; }
  .peca img { width:100%; height:100%; image-rendering:pixelated; display:block; }
  button.peca { padding:0; border:0; background:none; cursor:pointer; }
  /* O contorno de quem pode ser clicado: drop-shadow segue o desenho, não a caixa. */
  button.peca:hover img, button.peca:focus-visible img { filter: drop-shadow(0 0 0 #f2cf93) drop-shadow(3px 0 0 #f2cf93) drop-shadow(-3px 0 0 #f2cf93) drop-shadow(0 3px 0 #f2cf93) drop-shadow(0 -3px 0 #f2cf93); }
  button.peca:focus-visible { outline:none; }
  .rotulos { position:absolute; inset:0; pointer-events:none; z-index:100; }
  .rotulo { position:absolute; transform:translate(-50%, -100%); white-space:nowrap; background:var(--rotulo); color:var(--texto); padding:3px 8px; border-radius:6px; font-size:13px; opacity:0; transition:opacity .15s; pointer-events:none; z-index:100; }
  .rotulo.aceso, .rotulos-sempre .rotulo { opacity:1; }
  /* A noite: uma camada escura por cima de tudo, com a luz das fontes abrindo buracos nela. */
  .noite { position:absolute; inset:0; pointer-events:none; z-index:90; opacity:0; transition:opacity 1.2s; mix-blend-mode:multiply;
    background:
      radial-gradient(circle at ${(112 + 20) * ESCALA}px ${(96 + 6) * ESCALA}px, rgba(255,200,130,1) 0, rgba(255,200,130,0) ${40 * ESCALA}px),
      radial-gradient(circle at ${(150 + 37) * ESCALA}px ${(92 + 22) * ESCALA}px, rgba(170,190,230,1) 0, rgba(170,190,230,0) ${26 * ESCALA}px),
      #3b3f66; }
  .brilho { position:absolute; inset:0; pointer-events:none; z-index:91; opacity:0; transition:opacity 1.2s; mix-blend-mode:screen;
    background: radial-gradient(circle at ${(112 + 20) * ESCALA}px ${(96 + 6) * ESCALA}px, rgba(242,170,90,.35) 0, rgba(242,170,90,0) ${30 * ESCALA}px); }
  .noite, .brilho { -webkit-mask:url(${img('casca')}) 0 0/100% 100% no-repeat; mask:url(${img('casca')}) 0 0/100% 100% no-repeat; }
  .quarto.e-noite .noite { opacity:.85; } .quarto.e-noite .brilho { opacity:1; }
  .controles { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
  .controles button { background:#4a3442; color:var(--texto); border:0; border-radius:8px; padding:8px 14px; font:inherit; cursor:pointer; }
  .aviso { min-height:1.4em; color:#f2cf93; }
  p.nota { max-width:720px; color:#b9afbb; font-size:13px; text-align:center; margin:0; }
</style></head>
<body>
  <div class="controles">
    <button id="luz">Anoitecer</button>
    <button id="rotulos">Mostrar todos os nomes</button>
  </div>
  <div class="quarto" id="quarto">
${pecas}
    <div class="noite"></div><div class="brilho"></div><div class="rotulos" id="rotulos-camada"></div>
  </div>
  <div class="aviso" id="aviso" aria-live="polite"></div>
  <p class="nota">Página de teste, fora do Syden. Peças do PixelLab (Pro, com o conceito como referência), ampliadas 3×.
  Passe o mouse ou use Tab para ver o que cada objeto abre. A noite é a mesma arte com uma camada por cima.</p>
<script>
  const quarto = document.getElementById('quarto');
  document.getElementById('luz').onclick = (e) => { const n = quarto.classList.toggle('e-noite'); e.target.textContent = n ? 'Amanhecer' : 'Anoitecer'; };
  document.getElementById('rotulos').onclick = (e) => { const s = quarto.classList.toggle('rotulos-sempre'); e.target.textContent = s ? 'Esconder os nomes' : 'Mostrar todos os nomes'; };
  const camada = document.getElementById('rotulos-camada');
  for (const b of document.querySelectorAll('button.peca')) {
    const r = document.createElement('span'); r.className = 'rotulo'; r.textContent = b.dataset.nome;
    r.style.left = (b.offsetLeft + b.offsetWidth / 2) + 'px'; r.style.top = (b.offsetTop - 4) + 'px';
    camada.append(r);
    const acender = (sim) => r.classList.toggle('aceso', sim);
    b.addEventListener('mouseenter', () => acender(true)); b.addEventListener('mouseleave', () => acender(false));
    b.addEventListener('focus', () => acender(true)); b.addEventListener('blur', () => acender(false));
  }
  for (const b of document.querySelectorAll('button.peca')) b.onclick = () => {
    document.getElementById('aviso').textContent = 'Abriria: ' + b.dataset.nome;
    if (b.dataset.nome === 'Dia e noite') document.getElementById('luz').click();
  };
</script>
</body></html>
`;
fs.writeFileSync(path.join(AQUI, 'quarto.html'), html);
console.log('quarto.html', Math.round(html.length / 1024), 'KB');
