import { ATRAS, ESCALA_DA_TELA, figuraNoChao, H, HORIZONTE, W, type Camera, type Desenho, type Figura } from './render';

/**
 * A CAIXA DE ITEM EM FATIAS (26/11/2026, decisão dele depois do piloto em e2e/sprite-stacking/: "ficou boa para a caixa;
 * de resto o ganho é marginal"). A caixa é um cubo com a figura de sempre (`caixa` em render.ts) pintada nas quatro faces e
 * no tampo, empilhado em fatias (sprite stacking): com a câmera virando, ela mostra os lados e gira com a fileira.
 *
 * Empilhar a cada quadro custava ~2 ms; por isso cada caixa é empilhada UMA vez por ângulo de visada (32 por volta) e por
 * faixa de distância, guardada pronta, e desenhada como as outras figuras (um drawImage). Só desenho: a física, o lugar
 * das caixas e o pegar não mudaram. Os números da câmera (ALTURA, FOCO) são os de render.ts.
 */
const ALTURA = 22;
const FOCO = 172 * ESCALA_DA_TELA;
/** O tamanho de um pixel das figuras no mundo é medido contra a lente de 172 (a da tela de 320 × 180), mesmo se a tela crescer. */
const LENTE_DAS_FIGURAS = 172;
const GIROS = 32;
const DISTANCIAS = [9, 13, 19, 28, 40, 58, 85, 125, 185, 270, 400];
const CONTORNO = '#2a1a14';
/**
 * O que ele escolheu na página de comparação (26/11/2026), com a tela em 640 × 360: a caixa 1,6× a figura de frente (a
 * primeira versão, a 0,72, virava mancha de longe), o miolo de madeira (de longe a parede de um pixel some na redução, e o
 * miolo vazio deixava ver o chão) e o TAMPO LISO, de tábuas (com a figura também no tampo, a caixa virava um borrão: o
 * tampo e a face dividiam os 12 pixels da cenoura). Sem o reforço de longe.
 */
const AJUSTE = { escala: 1.6, miolo: true, tampoLiso: true, longe: 0 };

/** Só para a página de comparação (e2e/sprite-stacking): mudar o tamanho e o miolo, e montar tudo de novo. */
export function ajustarCaixa(a: Partial<typeof AJUSTE>) {
  Object.assign(AJUSTE, a);
  prontas.clear();
  fatias = null;
}

interface Pronta {
  img: HTMLCanvasElement;
  ax: number;
  ay: number;
}
const prontas = new Map<string, Pronta>();
let fatias: HTMLCanvasElement[] | null = null;

/** localStorage['syden.caixaFatias'] = 'nao' volta à figura de frente (a foto do antes, na auditoria). */
let lida: boolean | null = null;
function desligada() {
  if (lida === null) {
    try {
      lida = localStorage.getItem('syden.caixaFatias') === 'nao';
    } catch {
      lida = false;
    }
  }
  return lida;
}

/** O cubo: a figura nas quatro faces (de baixo para cima) e no tampo. */
function fatiasDaCaixa(fig: HTMLCanvasElement): HTMLCanvasElement[] {
  const w = fig.width, h = fig.height, n = w;
  const d = fig.getContext('2d')!.getImageData(0, 0, w, h).data;
  const px = (u: number, v: number) => {
    const i = (Math.min(h - 1, v) * w + Math.min(w - 1, u)) * 4;
    return d[i + 3] ? `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` : null;
  };
  // o miolo de cada fatia é pintado com a cor mais comum da figura (a madeira): de longe a parede de um pixel some na
  // redução, e o miolo vazio deixava ver o chão por dentro (a caixa virava uma gaiola, achado da auditoria de 26/11/2026)
  const conta = new Map<string, number>();
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) { const c = px(u, v); if (c) conta.set(c, (conta.get(c) ?? 0) + 1); }
  const miolo = [...conta].sort((a, b) => b[1] - a[1]).map(([c]) => c).find((c) => c !== px(0, 0)) ?? px(1, 1);
  const lista: HTMLCanvasElement[] = [];
  for (let z = 0; z < h; z++) {
    const s = document.createElement('canvas');
    s.width = s.height = n;
    const g = s.getContext('2d')!;
    const linha = h - 1 - z;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let c: string | null = null;
        if (z === h - 1) c = AJUSTE.tampoLiso ? (x === 0 || y === 0 || x === n - 1 || y === n - 1 ? px(0, 0) : x % 4 === 0 ? px(1, 1) : px(2, 1)) : px(x, Math.floor((y * h) / n));
        else if (y === 0) c = px(x, linha);
        else if (y === n - 1) c = px(n - 1 - x, linha);
        else if (x === 0) c = px(n - 1 - y, linha);
        else if (x === n - 1) c = px(y, linha);
        else if (AJUSTE.miolo) c = miolo;
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    lista.push(s);
  }
  return lista;
}

function proj(cam: Camera, x: number, y: number, h: number) {
  const dx = x - cam.x, dy = y - cam.y;
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const z = dx * fx + dy * fy;
  const lado = -dx * fy + dy * fx;
  return { sx: W / 2 + (lado * FOCO) / z, sy: HORIZONTE + ((ALTURA - h) * FOCO) / z, z };
}

/** Empilha a caixa vista de frente, a `zRef` da câmera, girada `giro` em relação à visada. */
function montar(sl: HTMLCanvasElement[], tamanho: number, giro: number, zRef: number): Pronta {
  const n = sl[0].width;
  const cam: Camera = { x: 0, y: 0, angulo: 0 };
  const x = zRef, y = 0;
  const s = (tamanho * ATRAS) / LENTE_DAS_FIGURAS;
  const meio = (n * s) / 2;
  const ux = Math.cos(giro), uy = Math.sin(giro), vx = -uy, vy = ux;
  const voxTela = (s * FOCO) / zRef;
  const alto = sl.length * s;
  const cantos = [-1, 1].flatMap((i) => [-1, 1].flatMap((j) => [0, alto].map((hh) => proj(cam, x + (ux * i + vx * j) * meio, y + (uy * i + vy * j) * meio, hh))));
  const folga = Math.ceil(voxTela) + 2;
  const x0 = Math.floor(Math.min(...cantos.map((q) => q.sx))) - folga;
  const y0 = Math.floor(Math.min(...cantos.map((q) => q.sy))) - folga;
  const bw = Math.max(1, Math.ceil(Math.max(...cantos.map((q) => q.sx))) + folga - x0);
  const bh = Math.max(1, Math.ceil(Math.max(...cantos.map((q) => q.sy))) + folga - y0);
  const tela = () => {
    const c = document.createElement('canvas');
    c.width = bw;
    c.height = bh;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    return { c, g };
  };
  const pilha = tela();
  // cada fatia quantas vezes for preciso para não abrir fresta entre uma e outra
  const copias = Math.max(1, Math.ceil(voxTela));
  for (let i = 0; i < sl.length; i++)
    for (let k = 0; k < copias; k++) {
      const hh = (i + (k + 0.5) / copias) * s;
      const o = proj(cam, x - (ux + vx) * meio, y - (uy + vy) * meio, hh);
      const pu = proj(cam, x + (ux - vx) * meio, y + (uy - vy) * meio, hh);
      const pv = proj(cam, x + (vx - ux) * meio, y + (vy - uy) * meio, hh);
      pilha.g.setTransform((pu.sx - o.sx) / n, (pu.sy - o.sy) / n, (pv.sx - o.sx) / n, (pv.sy - o.sy) / n, o.sx - x0, o.sy - y0);
      pilha.g.drawImage(sl[i], 0, 0);
    }
  // o contorno: a silhueta escura atrás, deslocada nas quatro direções (a espessura de um pixel da caixa)
  const silh = tela();
  silh.g.drawImage(pilha.c, 0, 0);
  silh.g.globalCompositeOperation = 'source-in';
  silh.g.fillStyle = CONTORNO;
  silh.g.fillRect(0, 0, bw, bh);
  const fim = tela();
  const e = Math.max(1, Math.round(voxTela));
  for (const [ox, oy] of [[e, 0], [-e, 0], [0, e], [0, -e]]) fim.g.drawImage(silh.c, ox, oy);
  fim.g.drawImage(pilha.c, 0, 0);
  const pe = proj(cam, x, y, 0);
  return { img: fim.c, ax: pe.sx - x0, ay: pe.sy - y0 };
}

/**
 * A caixa de pé no chão em (x, y), girada `giro` no mundo. `tamanho` é o da figura de sempre (um pixel dela é um vóxel);
 * `pulso` amplia a caixa pronta (o pulsar devagar), sem montar outra.
 */
export function caixaNoChao(d: Desenho, cam: Camera, x: number, y: number, tamanho: number, giro: number, pulso = 1): Figura | null {
  if (desligada()) return figuraNoChao(d, cam, 'caixa', x, y, tamanho * pulso);
  const pr = proj(cam, x, y, 0);
  if (pr.z < 6) return null;
  fatias ??= fatiasDaCaixa(d.figuras.caixa);
  const visada = Math.atan2(y - cam.y, x - cam.x);
  const passo = (Math.PI * 2) / GIROS;
  const gi = ((Math.round((giro - visada) / passo) % GIROS) + GIROS) % GIROS;
  let di = 0;
  for (let i = 1; i < DISTANCIAS.length; i++) if (Math.abs(Math.log(DISTANCIAS[i] / pr.z)) < Math.abs(Math.log(DISTANCIAS[di] / pr.z))) di = i;
  const chave = `${tamanho}|${gi}|${di}`;
  let p = prontas.get(chave);
  if (!p) {
    p = montar(fatias, tamanho * AJUSTE.escala, gi * passo, DISTANCIAS[di]);
    prontas.set(chave, p);
  }
  // o REFORÇO DE LONGE (em teste): a caixa distante é desenhada maior que a perspectiva pede, como os itens nos jogos de
  // kart, para continuar legível; só desenho (a área de pegar não muda)
  const reforco = 1 + AJUSTE.longe * Math.min(1.5, Math.max(0, (pr.z - 30) / 90));
  const k = (DISTANCIAS[di] / pr.z) * pulso * reforco;
  const w = Math.round(p.img.width * k), h = Math.round(p.img.height * k);
  const dx = Math.round(pr.sx - p.ax * k), dy = Math.round(pr.sy - p.ay * k);
  if (w < 1 || h < 1 || dx > W || dx + w < 0 || dy > H || dy + h < 0) return null;
  const img = p.img;
  return { z: pr.z, desenhar: (ctx) => ctx.drawImage(img, dx, dy, w, h) };
}
