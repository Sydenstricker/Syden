/**
 * O DESENHO DO PINBALL DA HORTA: a mesa em pixel art, feita por código numa tela de 240 × 400 (a medida da regra, sim.ts) que a
 * página amplia com os pixels nítidos. O fundo (a moldura de madeira, a grama com os canteiros, as cercas) é desenhado uma vez;
 * por cima, a cada quadro, o que muda: as luzes, os repolhos que piscam, as cenouras em pé ou caídas, as palhetas, a mola, a bola
 * e o coelho da toca (o mascote, da folha do Pulo do coelho, web/public/plataforma/coelho.png). Tudo com retângulos de 1 pixel
 * (as linhas e os círculos são traçados à mão), para a borda ficar de pixel e não borrada.
 *
 * O desenho pode usar o que quiser (só a regra é que não tem seno): ele lê a mesa e não a muda.
 */
import {
  MESAS,
  SAPO,
  ALVOS_X,
  ALVOS_Y,
  ALTURA,
  DIRECOES,
  ESTILINGUE_DIR,
  ESTILINGUE_ESQ,
  GUIA_DA_ORBITA_X,
  LARGURA,
  MOLA_Y,
  PALHETA,
  PAREDES,
  PISTAS_X,
  PIVO_DIR,
  PIVO_ESQ,
  PONTOS_DO_ARCO,
  RAIA_DIR,
  RAIA_ESQ,
  RAIA_X,
  RAIO,
  type Mesa,
} from './sim';

type Ctx = CanvasRenderingContext2D;

const COR = {
  madeira: '#6b3f22',
  madeiraClara: '#8a5530',
  madeiraEscura: '#4a2a16',
  grama: '#4f8a3a',
  gramaEscura: '#447a31',
  gramaClara: '#62a046',
  terra: '#8a5a32',
  terraEscura: '#6d4425',
  cerca: '#efdcae',
  cercaSombra: '#a88a5a',
  laranja: '#ee8a2f',
  laranjaEscura: '#b85c1a',
  folha: '#5fbf4a',
  folhaEscura: '#2f7a2a',
  repolho: '#8fd16a',
  repolhoEscuro: '#4f9a3e',
  apagada: '#3e2a1a',
  luz: '#ffd65a',
  bola: '#d8dde6',
  bolaSombra: '#7d8594',
  bolaBrilho: '#ffffff',
  palheta: '#f4e7c5',
  borracha: '#d2433a',
  toca: '#2a1a10',
};

// ---------------------------------------------------------------------------------------------------------------------
// os traços à mão: ponto, linha, círculo cheio, polígono cheio
// ---------------------------------------------------------------------------------------------------------------------

function ponto(c: Ctx, x: number, y: number, cor: string, t = 1) {
  c.fillStyle = cor;
  c.fillRect(Math.round(x - (t - 1) / 2), Math.round(y - (t - 1) / 2), t, t);
}

function linha(c: Ctx, x0: number, y0: number, x1: number, y1: number, cor: string, t = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  c.fillStyle = cor;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    c.fillRect(Math.round(x - (t - 1) / 2), Math.round(y - (t - 1) / 2), t, t);
  }
}

function circulo(c: Ctx, cx: number, cy: number, r: number, cor: string) {
  c.fillStyle = cor;
  for (let y = Math.ceil(cy - r); y <= Math.floor(cy + r); y++) {
    const dy = y + 0.5 - cy;
    const m = r * r - dy * dy;
    if (m < 0) continue;
    const w = Math.sqrt(m);
    const a = Math.round(cx - w);
    const b = Math.round(cx + w);
    if (b > a) c.fillRect(a, y, b - a, 1);
  }
}

function poligono(c: Ctx, pts: [number, number][], cor: string) {
  let topo = Infinity;
  let base = -Infinity;
  for (const [, y] of pts) {
    topo = Math.min(topo, y);
    base = Math.max(base, y);
  }
  c.fillStyle = cor;
  for (let y = Math.floor(topo); y <= Math.ceil(base); y++) {
    const yy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + ((yy - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.round(xs[i]);
      const b = Math.round(xs[i + 1]);
      if (b > a) c.fillRect(a, y, b - a, 1);
    }
  }
}

/** Um número pseudo-aleatório fixo por posição (o salpicado da grama e da madeira é sempre o mesmo). */
const ruido = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------------------------------------------------------------
// O FUNDO (uma vez)
// ---------------------------------------------------------------------------------------------------------------------

/** O contorno da área de jogo: o arco do alto, as laterais e o fundo. */
function contorno(): [number, number][] {
  return [[8, ALTURA], ...PONTOS_DO_ARCO.map(([x, y]) => [x, y] as [number, number]), [RAIA_DIR, ALTURA]];
}

/**
 * O TEMA DE CADA MESA (19/11/2026): a horta (verde) e o pomar no outono (a grama dourada; os rebatedores viram abóboras). Só a
 * cor da grama e o desenho dos rebatedores mudam.
 */
const TEMAS = [
  { grama: '#4f8a3a', gramaEscura: COR.gramaEscura, gramaClara: COR.gramaClara },
  { grama: '#8a7d34', gramaEscura: '#7d702e', gramaClara: '#a8963f' },
  // o lago (24/11/2026): a água, com as ondinhas claras no lugar do salpicado da grama
  { grama: '#3f7f96', gramaEscura: '#387489', gramaClara: '#8fd0e6' },
];

export function desenharFundo(mesa = 0): HTMLCanvasElement {
  const tema = TEMAS[mesa] ?? TEMAS[0];
  const g = MESAS[mesa] ?? MESAS[0];
  const tela = document.createElement('canvas');
  tela.width = LARGURA;
  tela.height = ALTURA;
  const c = tela.getContext('2d')!;
  // a moldura de madeira, com os veios
  c.fillStyle = COR.madeira;
  c.fillRect(0, 0, LARGURA, ALTURA);
  for (let y = 0; y < ALTURA; y++)
    for (let x = 0; x < LARGURA; x++) {
      const r = ruido(x >> 2, y);
      if (r < 0.08) ponto(c, x, y, COR.madeiraEscura);
      else if (r > 0.93) ponto(c, x, y, COR.madeiraClara);
    }
  // a grama
  poligono(c, contorno(), tema.grama);
  // os canteiros: faixas diagonais um tom abaixo, e o salpicado da grama
  const dentro = c.getImageData(0, 0, LARGURA, ALTURA);
  const verde = [parseInt(tema.grama.slice(1, 3), 16), parseInt(tema.grama.slice(3, 5), 16), parseInt(tema.grama.slice(5, 7), 16)];
  for (let y = 0; y < ALTURA; y++)
    for (let x = 0; x < LARGURA; x++) {
      const i = (y * LARGURA + x) * 4;
      const d = dentro.data;
      if (d[i] !== verde[0] || d[i + 1] !== verde[1] || d[i + 2] !== verde[2]) continue;
      const faixa = ((x + y) >> 4) % 2 === 0;
      const r = ruido(x, y);
      if (faixa) ponto(c, x, y, tema.gramaEscura);
      if (r > 0.96) ponto(c, x, y, tema.gramaClara);
      else if (r < 0.03) ponto(c, x, y, COR.folhaEscura);
    }
  // a raia da mola é um canal de madeira escura
  c.fillStyle = COR.madeiraEscura;
  c.fillRect(RAIA_ESQ, 140, RAIA_DIR - RAIA_ESQ, MOLA_Y + RAIO - 140);
  // a terra embaixo dos repolhos e em volta da toca
  if (mesa !== 2) for (const r of g.repolhos) circulo(c, r.x, r.y + 2, r.r + 4, COR.terraEscura);
  // no lago, a sombra das folhas é a água mais funda, e a toca fica numa ilhota
  if (mesa === 2) for (const r of g.repolhos) circulo(c, r.x, r.y + 2, r.r + 4, '#2f667a');
  circulo(c, g.toca.x, g.toca.y + 1, 12, COR.terraEscura);
  circulo(c, g.toca.x, g.toca.y, 10, COR.terra);
  // a raia da órbita, de terra batida
  c.fillStyle = COR.terra;
  c.fillRect(9, 110, GUIA_DA_ORBITA_X - 10, 80);
  // os estilingues (o corpo; o elástico é desenhado por cima, porque pisca)
  for (const t of [ESTILINGUE_ESQ, ESTILINGUE_DIR]) poligono(c, t, COR.laranjaEscura);
  // as cercas: todas as paredes que não mudam
  for (const p of PAREDES) {
    if (p.tipo === 'alvo' || p.tipo === 'estilingue') continue;
    if (p.tipo === 'porta') {
      linha(c, p.ax, p.ay, p.bx, p.by, COR.laranja, 2);
      continue;
    }
    linha(c, p.ax + 1, p.ay + 1, p.bx + 1, p.by + 1, COR.cercaSombra, 2);
    linha(c, p.ax, p.ay, p.bx, p.by, COR.cerca, 2);
  }
  for (const k of g.circulos) if (k.tipo === 'poste') circulo(c, k.x, k.y, k.r, COR.cerca);
  // as setas pintadas no chão da raia da órbita
  for (const [x, y] of [
    [16, 172],
    [16, 140],
  ])
    poligono(c, [[x, y - 4], [x + 4, y + 2], [x - 4, y + 2]], COR.cercaSombra);
  return tela;
}

// ---------------------------------------------------------------------------------------------------------------------
// O QUADRO
// ---------------------------------------------------------------------------------------------------------------------

/** A cenoura: o corpo laranja e as folhas, de pé (o alvo) ou pequena (as luzes). */
function cenoura(c: Ctx, x: number, y: number, alt: number, acesa: boolean) {
  const corpo = acesa ? COR.laranja : COR.apagada;
  poligono(c, [[x - 3, y], [x + 3, y], [x, y + alt]], corpo);
  linha(c, x - 2, y + 2, x - 1, y + 2, acesa ? COR.laranjaEscura : COR.madeiraEscura);
  ponto(c, x - 1, y - 1, acesa ? COR.folha : COR.madeiraEscura);
  ponto(c, x + 1, y - 2, acesa ? COR.folha : COR.madeiraEscura);
  ponto(c, x, y - 2, acesa ? COR.folhaEscura : COR.madeiraEscura);
}

/** A vitória-régia do lago: a folha redonda com o corte e a borda virada; acesa, a flor abre no meio. */
function vitoria(c: Ctx, x: number, y: number, r: number, aceso: boolean) {
  circulo(c, x, y, r + 1, COR.folhaEscura);
  circulo(c, x, y, r, aceso ? '#c9f0a0' : '#5aa845');
  circulo(c, x, y, r - 3, aceso ? '#e4ffc8' : '#6fbf55');
  // o corte da folha, até o meio
  poligono(c, [[x, y], [x + r + 1, y - 4], [x + r + 1, y + 1]], '#3f7f96');
  // as nervuras
  const nervura = aceso ? '#a8d880' : '#4f9a3e';
  linha(c, x, y, x - r + 3, y, nervura);
  linha(c, x, y, x, y - r + 3, nervura);
  linha(c, x, y, x, y + r - 3, nervura);
  // a flor: rosa, aberta quando acende
  circulo(c, x - 2, y + 2, aceso ? 4 : 2.5, aceso ? '#ffd0e6' : '#e88ab8');
  if (aceso) circulo(c, x - 2, y + 2, 1.5, '#ffd65a');
}

/** O sapo da raia de saída: aceso, verde e de olhos abertos; usado, apagado na pedra. */
function sapo(c: Ctx, x: number, y: number, aceso: boolean, pisca: boolean) {
  circulo(c, x, y + 3, 7, '#6b6b5e');
  const corpo = aceso ? '#5fbf4a' : '#3d5a32';
  circulo(c, x, y, 5, corpo);
  circulo(c, x - 3, y - 4, 2, corpo);
  circulo(c, x + 3, y - 4, 2, corpo);
  ponto(c, x - 3, y - 4, aceso ? '#ffffff' : '#2a3a20');
  ponto(c, x + 3, y - 4, aceso ? '#ffffff' : '#2a3a20');
  linha(c, x - 2, y + 1, x + 2, y + 1, aceso ? COR.folhaEscura : '#2a3a20');
  if (aceso && pisca) circulo(c, x, y + 9, 1.5, COR.luz);
}

/** A abóbora do pomar: o corpo laranja com os gomos e o cabinho. */
function abobora(c: Ctx, x: number, y: number, r: number, aceso: boolean) {
  circulo(c, x, y, r + 1, COR.laranjaEscura);
  circulo(c, x, y, r, aceso ? '#fff2c2' : COR.laranja);
  const gomo = aceso ? '#f0d890' : COR.laranjaEscura;
  linha(c, x - r / 2, y - r + 3, x - r / 2, y + r - 3, gomo);
  linha(c, x, y - r + 2, x, y + r - 2, gomo);
  linha(c, x + r / 2, y - r + 3, x + r / 2, y + r - 3, gomo);
  c.fillStyle = COR.folhaEscura;
  c.fillRect(x - 1, y - r - 2, 3, 4);
}

function repolho(c: Ctx, x: number, y: number, r: number, aceso: boolean) {
  circulo(c, x, y, r + 1, COR.folhaEscura);
  circulo(c, x, y, r, aceso ? '#fff7c2' : COR.repolhoEscuro);
  circulo(c, x - 1, y - 1, r - 3, aceso ? '#ffffff' : COR.repolho);
  // as nervuras das folhas
  const nervura = aceso ? '#e8e0a0' : COR.repolhoEscuro;
  linha(c, x - r + 3, y, x - 2, y - 1, nervura);
  linha(c, x + r - 3, y - 2, x + 1, y, nervura);
  linha(c, x - 2, y + r - 4, x, y + 1, nervura);
  circulo(c, x, y, 2.5, aceso ? '#ffffff' : '#b7e58f');
}

function palheta(c: Ctx, lado: -1 | 1, estado: number) {
  const p = lado < 0 ? PIVO_ESQ : PIVO_DIR;
  const [dx, dy] = DIRECOES[estado];
  const ux = -lado * dx;
  const tx = p.x + ux * PALHETA;
  const ty = p.y + dy * PALHETA;
  const nx = -dy;
  const ny = ux;
  const capsula = (r0: number, r1: number, cor: string) => {
    poligono(
      c,
      [
        [p.x + nx * r0, p.y + ny * r0],
        [tx + nx * r1, ty + ny * r1],
        [tx - nx * r1, ty - ny * r1],
        [p.x - nx * r0, p.y - ny * r0],
      ],
      cor,
    );
    circulo(c, p.x, p.y, r0, cor);
    circulo(c, tx, ty, r1, cor);
  };
  capsula(6.5, 4.5, COR.borracha);
  capsula(5, 3, COR.palheta);
  circulo(c, p.x, p.y, 1.5, COR.cercaSombra);
}

/** O mascote da toca: a folha do Pulo do coelho (17 × 31 por quadro). */
let folhaDoCoelho: HTMLImageElement | null = null;
function coelho(): HTMLImageElement | null {
  if (!folhaDoCoelho && typeof Image !== 'undefined') {
    folhaDoCoelho = new Image();
    folhaDoCoelho.src = `${import.meta.env.BASE_URL}plataforma/coelho.png`;
  }
  return folhaDoCoelho?.complete && folhaDoCoelho.naturalWidth > 0 ? folhaDoCoelho : null;
}

export interface Texto {
  x: number;
  y: number;
  texto: string;
  ate: number;
  cor: string;
}

export function desenharMesa(c: Ctx, fundo: HTMLCanvasElement, k: Mesa, textos: Texto[], quadro: number) {
  c.imageSmoothingEnabled = false;
  c.drawImage(fundo, 0, 0);
  const pisca = (quadro >> 4) % 2 === 0;
  const g = MESAS[k.mesa] ?? MESAS[0];
  const TOCA = g.toca;

  // as pistas do alto: uma cenoura acesa em cada
  PISTAS_X.forEach((x, n) => cenoura(c, x, 50, 8, k.pistas[n]));
  // o multiplicador do bônus: ×2 a ×5, as quatro luzes entre os estilingues
  for (let i = 0; i < 4; i++) {
    const acesa = k.mult >= i + 2;
    circulo(c, 95 + i * 12, 292, 3, acesa ? COR.luz : COR.apagada);
    if (acesa) ponto(c, 94 + i * 12, 291, '#ffffff');
  }
  // a luz da bola salva, entre as palhetas
  if (k.salva > 0 && (k.salva > 120 || pisca)) circulo(c, 113, 386, 3, COR.luz);
  else circulo(c, 113, 386, 3, COR.apagada);

  // a toca e o coelho: acesa, ela pisca; com a bola dentro, o coelho pula
  const comBola = k.bolas.some((b) => b.presa > 0);
  if (k.tocaAcesa && pisca) circulo(c, TOCA.x, TOCA.y, 9, COR.luz);
  circulo(c, TOCA.x, TOCA.y, 7, COR.toca);
  const folha = coelho();
  if (folha) {
    const pulo = comBola ? Math.abs(((quadro >> 1) % 8) - 4) : 0;
    c.drawImage(folha, comBola ? 17 * 2 : 0, 0, 17, 31, TOCA.x + 6, TOCA.y - 34 - pulo, 17, 31);
  }
  // as três luzes da colheita, embaixo da toca (as cenouras derrubadas)
  for (let i = 0; i < 3; i++) cenoura(c, TOCA.x - 8 + i * 8, TOCA.y + 14, 5, !k.alvos[i]);

  // os repolhos (piscam quando acertados) e os elásticos dos estilingues
  for (const r of g.repolhos) (k.mesa === 1 ? abobora : k.mesa === 2 ? vitoria : repolho)(c, r.x, r.y, r.r, k.passo - k.acesoEm[r.n!] < 6);
  for (const [t, n] of [
    [ESTILINGUE_ESQ, 3],
    [ESTILINGUE_DIR, 4],
  ] as const)
    linha(c, t[0][0], t[0][1], t[2][0], t[2][1], k.passo - k.acesoEm[n] < 6 ? '#ffffff' : COR.borracha, 2);

  // as cenouras: de pé (o alvo) ou o buraco de onde saíram
  ALVOS_Y.forEach(([a, b], i) => {
    if (k.alvos[i]) {
      c.fillStyle = COR.laranjaEscura;
      c.fillRect(ALVOS_X - 2, a, 4, b - a);
      c.fillStyle = COR.laranja;
      c.fillRect(ALVOS_X - 2, a + 1, 3, b - a - 2);
      ponto(c, ALVOS_X + 3, a + 2, COR.folha, 2);
      ponto(c, ALVOS_X + 3, b - 3, COR.folha, 2);
    } else {
      c.fillStyle = COR.madeiraEscura;
      c.fillRect(ALVOS_X - 1, a + 2, 2, b - a - 4);
    }
  });

  // a mola: a mola encolhe com a carga
  const topo = MOLA_Y + RAIO + (k.carga / 50) * 6;
  c.fillStyle = COR.cercaSombra;
  for (let y = topo; y < ALTURA - 2; y += 2) c.fillRect(RAIA_X - 3, Math.round(y), 7, 1);
  c.fillStyle = COR.borracha;
  c.fillRect(RAIA_X - 4, Math.round(topo), 9, 2);

  // as palhetas
  palheta(c, -1, k.esq);
  palheta(c, 1, k.dir);

  // A RAMPA (19/11/2026): a boca com as três setas que acendem, e o trilho de dois fios até o alto, por cima da mesa
  // (o lago, 24/11/2026, tem duas)
  for (const rampa of g.rampa2 ? [g, g.rampa2] : [g]) {
    for (let i = 0; i < 3; i++) {
      const acesa = ((quadro >> 3) + i) % 3 === 0;
      const y = rampa.boca.y + 10 + i * 6;
      const xm = (rampa.boca.x0 + rampa.boca.x1) / 2;
      linha(c, xm - 4, y + 3, xm, y, acesa ? COR.luz : COR.apagada);
      linha(c, xm, y, xm + 4, y + 3, acesa ? COR.luz : COR.apagada);
    }
    for (let i = 0; i < rampa.trilho.length - 1; i++) {
      const [ax, ay] = rampa.trilho[i];
      const [bx, by] = rampa.trilho[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const l = Math.hypot(dx, dy) || 1;
      const nx = (-dy / l) * 3.5;
      const ny = (dx / l) * 3.5;
      linha(c, ax + nx, ay + ny, bx + nx, by + ny, '#c9d3dc');
      linha(c, ax - nx, ay - ny, bx - nx, by - ny, '#8796a5');
    }
  }
  // o sapo do lago, na raia de saída da esquerda, um pouco acima do sensor
  if (g.sapo) sapo(c, 16, SAPO.y - 22, k.sapo, pisca);

  // as bolas
  for (const b of k.bolas) {
    circulo(c, b.x + 1, b.y + 1.5, RAIO, 'rgba(0,0,0,0.3)');
    circulo(c, b.x, b.y, RAIO, COR.bolaSombra);
    circulo(c, b.x - 0.5, b.y - 0.5, RAIO - 1, COR.bola);
    ponto(c, b.x - 1.5, b.y - 1.5, COR.bolaBrilho, 2);
  }

  // a mesa travada escurece
  if (k.tilt) {
    c.fillStyle = 'rgba(20, 10, 5, 0.45)';
    c.fillRect(0, 0, LARGURA, ALTURA);
  }

  // os pontos que sobem de onde foram feitos
  c.font = 'bold 8px monospace';
  c.textAlign = 'center';
  for (const t of textos) {
    const falta = t.ate - quadro;
    const y = Math.round(t.y - (40 - falta) * 0.4);
    c.fillStyle = '#2a1a10';
    c.fillText(t.texto, Math.round(t.x) + 1, y + 1);
    c.fillStyle = t.cor;
    c.fillText(t.texto, Math.round(t.x), y);
  }
}
