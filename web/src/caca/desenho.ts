import { ALTURA, CHAO, LARGURA, type Praga, posicao } from './voo';

/**
 * O DESENHO DA CAÇA ÀS PRAGAS DA HORTA (04/11/2026). As contas são em unidades do jogo (320 × 180, as do voo), e a tela é
 * desenhada ESCALA vezes maior.
 *
 * A BARRACA DE TIRO (20/11/2026): o painel do fundo, as nuvens, as árvores, a grama, as cortinas, o balcão, a mira e os
 * algarismos dos pontos são do Shooting Gallery e do Crosshair Pack da Kenney (CC0, em public/caca/ com as licenças), e a arte
 * deles é vetorial achatada, não pixel art. Os patos e os alvos do pacote ficaram de fora de propósito: as pragas continuam as
 * nossas, por código, agora com o contorno do mesmo traço. Enquanto as imagens carregam (ou se falharem), o cenário por código de
 * antes é a reserva. O acerto não mudou: quem decide é a conta do voo.
 */

/** Quantas vezes a tela é maior que as unidades do jogo. */
export const ESCALA = 4;

const NOMES = [
  'bg_blue',
  'bg_wood',
  'cloud1',
  'cloud2',
  'tree_oak',
  'tree_pine',
  'grass1',
  'grass2',
  'curtain',
  'curtain_straight',
  'mira',
  'text_plus_small',
  'text_cross_small',
  'text_0_small',
  'text_1_small',
  'text_2_small',
  'text_3_small',
  'text_4_small',
  'text_5_small',
  'text_6_small',
  'text_7_small',
  'text_8_small',
  'text_9_small',
] as const;
export type Arte = Record<(typeof NOMES)[number], HTMLImageElement>;

let carregando: Promise<Arte | null> | null = null;
/** As imagens da barraca, uma vez por página; null se alguma falhar (fica o desenho por código, e a próxima partida tenta de novo). */
export function carregarArte(): Promise<Arte | null> {
  carregando ??= Promise.all(
    NOMES.map(
      (nome) =>
        new Promise<[string, HTMLImageElement]>((ok, erro) => {
          const img = new Image();
          img.onload = () => ok([nome, img]);
          img.onerror = erro;
          img.src = `${import.meta.env.BASE_URL}caca/${nome}.png`;
        }),
    ),
  ).then(
    (pares) => Object.fromEntries(pares) as Arte,
    () => {
      carregando = null;
      return null;
    },
  );
  return carregando;
}

function telaNova(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = LARGURA * ESCALA;
  c.height = ALTURA * ESCALA;
  return [c, c.getContext('2d')!];
}

/** O cenário parado, pintado uma vez numa tela à parte: a barraca com a arte, ou o de código enquanto ela não chega. */
export function pintarCenario(arte?: Arte | null): HTMLCanvasElement {
  if (arte) return pintarBarraca(arte);
  const [c, ctx] = telaNova();
  ctx.scale(ESCALA, ESCALA);
  // o céu, de cima para baixo
  const ceu = ctx.createLinearGradient(0, 0, 0, CHAO);
  ceu.addColorStop(0, '#7fb6e0');
  ceu.addColorStop(1, '#d6ecf5');
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, LARGURA, CHAO);
  // o sol e duas nuvens
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(272, 30, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, r] of [
    [60, 34, 9],
    [72, 30, 11],
    [86, 35, 8],
    [180, 54, 7],
    [190, 50, 9],
    [201, 55, 6],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // os morros ao longe
  ctx.fillStyle = '#8fbf7a';
  ctx.beginPath();
  ctx.moveTo(0, CHAO - 14);
  for (let x = 0; x <= LARGURA; x += 8) ctx.lineTo(x, CHAO - 18 - 10 * Math.sin(x / 47) - 6 * Math.sin(x / 19));
  ctx.lineTo(LARGURA, CHAO);
  ctx.lineTo(0, CHAO);
  ctx.fill();
  ctx.fillStyle = '#6fa75d';
  ctx.beginPath();
  ctx.moveTo(0, CHAO);
  for (let x = 0; x <= LARGURA; x += 8) ctx.lineTo(x, CHAO - 7 - 5 * Math.sin(x / 31 + 2));
  ctx.lineTo(LARGURA, CHAO);
  ctx.fill();
  // a cerca
  ctx.fillStyle = '#b98a5a';
  ctx.fillRect(0, CHAO - 9, LARGURA, 2);
  ctx.fillRect(0, CHAO - 4, LARGURA, 2);
  for (let x = 4; x < LARGURA; x += 16) ctx.fillRect(x, CHAO - 13, 3, 13);
  pintarHorta(ctx, false);
  return c;
}

/** A terra da horta, com os canteiros, as cenouras e as alfaces (o que as pragas querem). Com `traco`, no traço da Kenney. */
function pintarHorta(ctx: CanvasRenderingContext2D, traco: boolean) {
  ctx.fillStyle = traco ? '#8a5a34' : '#7a5236';
  ctx.fillRect(0, CHAO, LARGURA, ALTURA - CHAO);
  ctx.fillStyle = traco ? '#774b2a' : '#6a452c';
  for (let y = CHAO + 8; y < ALTURA; y += 12) ctx.fillRect(0, y, LARGURA, 4);
  for (let fileira = 0, y = CHAO + 6; y < ALTURA - 2; y += 12, fileira++) {
    for (let x = 10 + (fileira % 2) * 9; x < LARGURA; x += 18) {
      if ((x + fileira) % 3 === 0) {
        // a alface
        ctx.fillStyle = '#5c9e3c';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        if (traco) {
          ctx.strokeStyle = '#2f5a22';
          ctx.lineWidth = 0.6;
          ctx.stroke();
          ctx.fillStyle = '#8bc65a';
          ctx.beginPath();
          ctx.arc(x - 0.8, y - 0.8, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#4a8526';
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(x - 0.5, y + 2.5);
          ctx.lineTo(x - 0.5, y - 1);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#8bc65a';
          ctx.beginPath();
          ctx.arc(x - 1, y - 1, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (traco) {
        // a cenoura enterrada, com a rama em três folhas
        ctx.fillStyle = '#4f9a3a';
        ctx.strokeStyle = '#2f5a22';
        ctx.lineWidth = 0.5;
        for (const [dx, a] of [
          [-1.4, -0.45],
          [0, 0],
          [1.4, 0.45],
        ] as const) {
          ctx.beginPath();
          ctx.ellipse(x + dx, y - 3.2, 0.9, 2.8, a, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#ee8a32';
        ctx.strokeStyle = '#8a4a1c';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - 2.2, y - 0.6);
        ctx.lineTo(x + 2.2, y - 0.6);
        ctx.lineTo(x, y + 3.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = '#e07a2a';
        ctx.fillRect(x - 1, y, 3, 3);
        ctx.fillStyle = '#4f9a3a';
        ctx.fillRect(x - 2, y - 4, 1, 4);
        ctx.fillRect(x, y - 5, 1, 5);
        ctx.fillRect(x + 2, y - 4, 1, 4);
      }
    }
  }
}

/** Repete uma imagem na faixa [x0, x1) a partir de y, cortada em `alt` (tudo em pixels da tela). */
function ladrilhar(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x0: number, x1: number, y: number, escala: number, alt?: number) {
  const w = img.width * escala;
  const h = alt ?? img.height * escala;
  for (let x = x0; x < x1; x += w) ctx.drawImage(img, 0, 0, img.width, h / escala, Math.round(x), y, Math.ceil(w), h);
}

/** O fundo da barraca de tiro, com a arte da Kenney, em pixels da tela (1280 × 720). */
function pintarBarraca(arte: Arte): HTMLCanvasElement {
  const [c, ctx] = telaNova();
  const W = c.width;
  const chao = CHAO * ESCALA;
  // o painel azul da barraca, que faz de céu, clareando para o horizonte
  for (let y = 0; y < chao; y += arte.bg_blue.height) ladrilhar(ctx, arte.bg_blue, 0, W, y, 1);
  const nevoa = ctx.createLinearGradient(0, 0, 0, chao);
  nevoa.addColorStop(0, 'rgba(255,255,255,0.1)');
  nevoa.addColorStop(1, 'rgba(255,255,255,0.42)');
  ctx.fillStyle = nevoa;
  ctx.fillRect(0, 0, W, chao);
  // o sol, no traço do pacote (o miolo claro e o contorno marrom)
  ctx.fillStyle = '#ffd66b';
  ctx.strokeStyle = '#b8743a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(1010, 150, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff0b0';
  ctx.beginPath();
  ctx.arc(998, 138, 22, 0, Math.PI * 2);
  ctx.fill();
  // as nuvens
  ctx.drawImage(arte.cloud1, 170, 120);
  ctx.drawImage(arte.cloud2, 600, 230, arte.cloud2.width * 0.8, arte.cloud2.height * 0.8);
  ctx.drawImage(arte.cloud1, 830, 70, arte.cloud1.width * 0.7, arte.cloud1.height * 0.7);
  // as árvores do fundo, com o pé escondido na grama
  const topoDaGrama = chao - 96;
  const arvore = (img: HTMLImageElement, x: number, e: number) =>
    ctx.drawImage(img, x, topoDaGrama + 50 - img.height * e, img.width * e, img.height * e);
  arvore(arte.tree_pine, 70, 0.8);
  arvore(arte.tree_oak, 170, 0.95);
  arvore(arte.tree_pine, 720, 0.65);
  arvore(arte.tree_oak, 1000, 0.85);
  arvore(arte.tree_pine, 1110, 1);
  // a grama, alternando as duas peças (a 2 tem o capim mais alto)
  const altura = chao - topoDaGrama + 8;
  for (let i = 0, x = -30; x < W; i++, x += arte.grass1.width - 2) {
    const img = i % 2 ? arte.grass2 : arte.grass1;
    const dy = img.height - arte.grass1.height;
    ctx.drawImage(img, 0, 0, img.width, altura + dy, x, topoDaGrama - dy, img.width, altura + dy);
  }
  // a horta, na frente, com a borda de terra
  ctx.save();
  ctx.scale(ESCALA, ESCALA);
  pintarHorta(ctx, true);
  ctx.restore();
  ctx.fillStyle = '#5b3a22';
  ctx.fillRect(0, chao - 2, W, 6);
  return c;
}

/** O que fica NA FRENTE das pragas: o balcão, as cortinas dos lados e a sanefa. Transparente no resto. */
export function pintarFrente(arte: Arte): HTMLCanvasElement {
  const [c, ctx] = telaNova();
  const W = c.width;
  const H = c.height;
  // o balcão de madeira, embaixo
  const balcao = 40;
  ladrilhar(ctx, arte.bg_wood, 0, W, H - balcao, 0.6, balcao);
  ctx.fillStyle = '#6b4020';
  ctx.fillRect(0, H - balcao - 5, W, 7);
  // as cortinas dos lados (a imagem é a da direita; a da esquerda é ela espelhada)
  const e = 0.68;
  const cw = arte.curtain.width * e;
  const ch = arte.curtain.height * e;
  ctx.drawImage(arte.curtain, W - cw, 12, cw, ch);
  ctx.save();
  ctx.translate(cw, 12);
  ctx.scale(-1, 1);
  ctx.drawImage(arte.curtain, 0, 0, cw, ch);
  ctx.restore();
  // a sanefa, em cima
  ladrilhar(ctx, arte.curtain_straight, 0, W, 0, 0.5);
  return c;
}

/** Um número com os algarismos do pacote ("+150", "×2"), centrado em (x, y) nas unidades do jogo; `alt` é a altura. */
function numeroDaArte(ctx: CanvasRenderingContext2D, arte: Arte, texto: string, x: number, y: number, alt: number, alinhar: 'centro' | 'direita' = 'centro') {
  const imgs = [...texto].map((ch) =>
    ch === '+' ? arte.text_plus_small : ch === '×' ? arte.text_cross_small : arte[`text_${ch}_small` as keyof Arte],
  );
  const e = alt / 37;
  const passo = (img: HTMLImageElement) => img.width * e - 0.6;
  const larg = imgs.reduce((s, img) => s + passo(img), 0);
  let cx = alinhar === 'centro' ? x - larg / 2 : x - larg;
  for (const img of imgs) {
    const h = img.height * e;
    ctx.drawImage(img, cx, y - h / 2, img.width * e, h);
    cx += passo(img);
  }
}

/** O corvo, virado para onde voa, com as asas batendo pelo tempo. */
function corvo(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, ms: number) {
  const asa = Math.sin(ms / 70);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#141219';
  ctx.lineWidth = 0.8;
  ctx.fillStyle = '#2c2a33';
  // a asa de trás
  ctx.beginPath();
  ctx.moveTo(-2, -1);
  ctx.lineTo(-7, -2 - 8 * asa);
  ctx.lineTo(3, -1);
  ctx.fill();
  // o corpo e o rabo
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, -1);
  ctx.lineTo(-12, -3);
  ctx.lineTo(-12, 3);
  ctx.lineTo(-7, 2);
  ctx.fill();
  // a cabeça, o bico e o olho
  ctx.beginPath();
  ctx.arc(7, -2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8a33a';
  ctx.beginPath();
  ctx.moveTo(10, -3);
  ctx.lineTo(14, -1.5);
  ctx.lineTo(10, -0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f5f2e8';
  ctx.beginPath();
  ctx.arc(7.8, -3, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#141219';
  ctx.beginPath();
  ctx.arc(8.1, -3, 0.45, 0, Math.PI * 2);
  ctx.fill();
  // a asa da frente
  ctx.fillStyle = '#3d3a47';
  ctx.beginPath();
  ctx.moveTo(-1, 0);
  ctx.lineTo(-4, 1 - 9 * asa);
  ctx.lineTo(5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** O gafanhoto, de lado, com a perna grande de trás encolhendo no pulo. */
function gafanhoto(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, ms: number) {
  const pulo = Math.abs(Math.sin(ms / 180));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // a perna grande de trás (atrás do corpo)
  ctx.strokeStyle = '#3f6f1f';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(-6, -5 + 3 * pulo);
  ctx.lineTo(-3 - 5 * pulo, 4);
  ctx.stroke();
  ctx.fillStyle = '#5f9e2f';
  ctx.strokeStyle = '#2f5a1a';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 3, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7cbf45';
  ctx.beginPath();
  ctx.arc(6, -1.5, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.arc(7, -2.3, 0.7, 0, Math.PI * 2);
  ctx.fill();
  // as antenas
  ctx.strokeStyle = '#3f6f1f';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(7, -3.5);
  ctx.lineTo(12, -8);
  ctx.moveTo(6, -3.5);
  ctx.lineTo(10, -9);
  ctx.stroke();
  // as perninhas
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(2, 2);
  ctx.lineTo(3, 5);
  ctx.moveTo(4, 2);
  ctx.lineTo(6, 4.5);
  ctx.stroke();
  ctx.restore();
}

/** A MOSCA (21/11/2026): o corpinho escuro e listrado, os olhos vermelhos grandes e as asas zunindo (um borrão claro). */
function mosca(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, ms: number) {
  const asa = Math.sin(ms / 18);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.lineJoin = 'round';
  // as asas: dois borrões claros, batendo depressa
  ctx.fillStyle = 'rgba(220, 235, 255, 0.7)';
  ctx.strokeStyle = 'rgba(80, 90, 110, 0.55)';
  ctx.lineWidth = 0.5;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-1 + k * 0.5, -3.5 - 1.5 * asa * k, 4, 1.8, -0.6 - 0.5 * asa * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // o corpo, com as listras
  ctx.fillStyle = '#2b2a33';
  ctx.strokeStyle = '#141219';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(-1, 0.5, 4, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#5a5866';
  ctx.beginPath();
  ctx.moveTo(-2.5, -1.5);
  ctx.lineTo(-2.5, 2.5);
  ctx.moveTo(-0.5, -1.8);
  ctx.lineTo(-0.5, 2.8);
  ctx.stroke();
  // a cabeça e os olhos vermelhos
  ctx.fillStyle = '#2b2a33';
  ctx.beginPath();
  ctx.arc(3.2, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c8322a';
  ctx.beginPath();
  ctx.arc(4, -0.8, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A TOUPEIRA (21/11/2026): o montinho de terra fica no chão a vida inteira dela, e ela sai dele até a cintura (o que está abaixo
 * da boca do buraco não aparece): o focinho rosa, os olhinhos pequenos e as patas largas de cavar.
 */
function toupeira(ctx: CanvasRenderingContext2D, x: number, y: number, boca: number, ms: number) {
  ctx.save();
  // o corpo, cortado na boca do buraco
  ctx.beginPath();
  ctx.rect(x - 14, boca - 40, 28, 40);
  ctx.clip();
  const olha = Math.sin(ms / 160) * 0.8;
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#5a4636';
  ctx.strokeStyle = '#1d1712';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0, 3, 6.5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // as patas largas, de cavar
  ctx.fillStyle = '#e8a6a0';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(k * 6, 4, 2.6, 1.8, k * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // o focinho rosa e os olhinhos
  ctx.fillStyle = '#f0a0a8';
  ctx.beginPath();
  ctx.ellipse(olha, -3.5, 2.2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#141219';
  ctx.fillRect(-2.6 + olha, -6.4, 1, 1);
  ctx.fillRect(1.6 + olha, -6.4, 1, 1);
  ctx.restore();
  // o montinho de terra na frente
  ctx.fillStyle = '#6b4424';
  ctx.strokeStyle = '#3a2412';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(x, boca + 2, 12, 4.5, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a5a32';
  ctx.fillRect(x - 6, boca - 1, 2, 1);
  ctx.fillRect(x + 3, boca - 2, 2, 1);
}

/** A JOANINHA (20/11/2026), o bicho amigo: o casco vermelho de bolinhas abrindo um pouco no voo, as asas batendo. */
function joaninha(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, ms: number) {
  const asa = Math.sin(ms / 45);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.lineJoin = 'round';
  // as asas finas, por trás do casco
  ctx.fillStyle = 'rgba(235, 240, 255, 0.75)';
  ctx.strokeStyle = 'rgba(80, 90, 110, 0.6)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(-1, -4 - 2 * asa, 5, 2, -0.5 - 0.4 * asa, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // a cabeça preta, com os olhinhos
  ctx.fillStyle = '#1d1b22';
  ctx.beginPath();
  ctx.arc(5, 0.5, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5f2e8';
  ctx.fillRect(6, -0.7, 0.9, 0.9);
  // o casco
  ctx.fillStyle = '#d83a2e';
  ctx.strokeStyle = '#141219';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // a risca do meio e as bolinhas
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.stroke();
  ctx.fillStyle = '#141219';
  for (const [bx, by] of [[-2.5, -2], [1.5, -2.2], [-1, 2], [2.5, 1.8]] as const) {
    ctx.beginPath();
    ctx.arc(bx, by, 0.95, 0, Math.PI * 2);
    ctx.fill();
  }
  // o brilho
  ctx.fillStyle = 'rgba(255, 230, 220, 0.7)';
  ctx.fillRect(-3, -3.2, 1.6, 0.8);
  ctx.restore();
}

/** A CENOURA da rodada bônus (20/11/2026), girando enquanto sobe e cai. */
function cenoura(ctx: CanvasRenderingContext2D, x: number, y: number, ms: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ms / 260);
  ctx.lineJoin = 'round';
  // a rama
  ctx.fillStyle = '#4f9a3a';
  ctx.strokeStyle = '#2f5a1a';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-1, -6);
  ctx.lineTo(-4, -11);
  ctx.lineTo(0, -8);
  ctx.lineTo(1, -12);
  ctx.lineTo(2, -7);
  ctx.lineTo(5, -10);
  ctx.lineTo(2, -5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // a raiz
  ctx.fillStyle = '#e07a2a';
  ctx.strokeStyle = '#7a3a12';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-3.5, -6);
  ctx.lineTo(3.5, -6);
  ctx.lineTo(0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#b85a1c';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-2, -2);
  ctx.lineTo(0, -1.5);
  ctx.moveTo(1, 2);
  ctx.lineTo(2.2, 2.4);
  ctx.stroke();
  ctx.restore();
}

/** Uma praga que caiu: gira e despenca, com o "+pontos" subindo. */
export interface Queda {
  x: number;
  y: number;
  tipo: Praga['tipo'];
  dir: number;
  em: number;
  pontos: number;
  /** A dourada: os pontos sobem em dourado. */
  dourada?: boolean;
}

export interface Quadro {
  cenario: HTMLCanvasElement;
  /** A frente da barraca (cortinas e balcão), por cima das pragas; null enquanto a arte não chegou. */
  frente?: HTMLCanvasElement | null;
  /** A arte carregada (a mira e os algarismos); sem ela, o desenho por código. */
  arte?: Arte | null;
  /** O tempo da onda agora (ms), ou null antes de começar. */
  ms: number | null;
  pragas: Praga[];
  abatidas: ReadonlySet<number>;
  quedas: Queda[];
  agora: number;
  mira: { x: number; y: number } | null;
  /** O clarão do último tiro. */
  tiro: { x: number; y: number; em: number } | null;
  /** O multiplicador do combo agora (1, 2 ou 3): aparece no canto quando passa de 1. */
  multiplicador?: number;
}

export function desenhar(ctx: CanvasRenderingContext2D, q: Quadro) {
  const arte = q.arte ?? null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(q.cenario, 0, 0);
  ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);
  if (q.ms !== null) {
    q.pragas.forEach((p, i) => {
      if (q.abatidas.has(i)) return;
      const pos = posicao(p, q.ms!);
      if (!pos) return;
      const dir = p.vx >= 0 ? 1 : -1;
      if (p.dourada) brilhoDourado(ctx, pos.x, pos.y, q.ms! + i * 41);
      if (p.tipo === 'corvo') corvo(ctx, pos.x, pos.y, dir, q.ms! + i * 37);
      else if (p.tipo === 'joaninha') joaninha(ctx, pos.x, pos.y, dir, q.ms! + i * 29);
      else if (p.tipo === 'cenoura') cenoura(ctx, pos.x, pos.y, q.ms! + i * 113);
      else if (p.tipo === 'mosca') mosca(ctx, pos.x, pos.y, dir, q.ms! + i * 31);
      else if (p.tipo === 'toupeira') toupeira(ctx, pos.x, pos.y, p.y0 - 2, q.ms! + i * 61);
      else gafanhoto(ctx, pos.x, pos.y, dir, q.ms! + i * 53);
    });
  }
  // as que caíram
  for (const queda of q.quedas) {
    const s = (q.agora - queda.em) / 1000;
    if (s > 1.2) continue;
    if (queda.tipo === 'joaninha') {
      // a joaninha não cai: sai voando assustada, para cima, e some
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - s / 0.9);
      joaninha(ctx, queda.x + queda.dir * 40 * s, queda.y - 90 * s, queda.dir, q.agora);
      ctx.restore();
      continue;
    }
    if (queda.tipo === 'cenoura') {
      // a cenoura estoura em pedacinhos laranja (e umas folhas)
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - s / 0.7);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.fillStyle = k % 3 === 0 ? '#4f9a3a' : '#e07a2a';
        ctx.fillRect(queda.x + Math.cos(a) * 26 * s, queda.y + Math.sin(a) * 18 * s + 40 * s * s, 2, 2);
      }
      ctx.restore();
      continue;
    }
    if (queda.tipo === 'toupeira') {
      // a toupeira acertada some de volta no buraco, tonta (as estrelinhas em volta)
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - s / 0.8);
      const boca = CHAO + 10;
      toupeira(ctx, queda.x, queda.y + 40 * s, boca, 0);
      ctx.fillStyle = '#ffd65a';
      for (let k = 0; k < 3; k++) {
        const a = s * 9 + (k * Math.PI * 2) / 3;
        ctx.fillRect(queda.x + Math.cos(a) * 8 - 1, queda.y - 10 + Math.sin(a) * 3 - 1, 2, 2);
      }
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - s / 1.2);
    ctx.translate(queda.x, queda.y + 120 * s * s);
    ctx.rotate(queda.dir * s * 6);
    if (queda.tipo === 'corvo') corvo(ctx, 0, 0, queda.dir, 0);
    else if (queda.tipo === 'mosca') mosca(ctx, 0, 0, queda.dir, 0);
    else gafanhoto(ctx, 0, 0, queda.dir, 0);
    ctx.restore();
    // as penas (ou as folhas) que voam
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - s / 0.8);
    ctx.fillStyle = queda.tipo === 'corvo' || queda.tipo === 'mosca' ? '#3d3a47' : '#7cbf45';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.fillRect(queda.x + Math.cos(a) * 22 * s, queda.y + Math.sin(a) * 16 * s + 20 * s * s, 2, 1);
    }
    ctx.restore();
  }
  // a barraca, na frente das pragas
  if (q.frente) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(q.frente, 0, 0);
    ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);
  }
  // os pontos de cada queda, por cima de tudo
  for (const queda of q.quedas) {
    const s = (q.agora - queda.em) / 1000;
    if (s > 1.2) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - s / 1.2);
    // a pena do amigo é negativa: os algarismos da arte não têm o "menos", e ela vai no desenho por código, em vermelho
    const negativo = queda.pontos < 0;
    const texto = negativo ? `−${-queda.pontos}` : `+${queda.pontos}`;
    const y = Math.max(16, queda.y - 10 - 18 * s);
    if (arte && !negativo) {
      if (queda.dourada) {
        ctx.shadowColor = '#ffd23a';
        ctx.shadowBlur = 14;
      }
      numeroDaArte(ctx, arte, texto, queda.x, y, 12);
    } else {
      ctx.fillStyle = negativo ? '#ff6b5a' : queda.dourada ? '#ffd23a' : '#fff8d6';
      ctx.strokeStyle = '#4a3420';
      ctx.lineWidth = 2;
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(texto, queda.x, y);
      ctx.fillText(texto, queda.x, y);
    }
    ctx.restore();
  }
  // o clarão do tiro: a tela inteira acende um instante, e o ponto do tiro com o anel que abre (19/11/2026)
  if (q.tiro && q.agora - q.tiro.em < 140) {
    const k = (q.agora - q.tiro.em) / 140;
    if (k < 0.35) {
      ctx.fillStyle = `rgba(255, 250, 220, ${0.16 * (1 - k / 0.35)})`;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
    }
    ctx.fillStyle = `rgba(255, 250, 210, ${1 - k})`;
    ctx.beginPath();
    ctx.arc(q.tiro.x, q.tiro.y, 6 - 2 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 220, 140, ${1 - k})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(q.tiro.x, q.tiro.y, 6 + 10 * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // o combo no canto (só o número: ×2, ×3), abaixo da sanefa
  if (q.multiplicador && q.multiplicador > 1) {
    ctx.save();
    if (arte) {
      if (q.multiplicador >= 3) {
        ctx.shadowColor = '#ffd23a';
        ctx.shadowBlur = 14;
      }
      numeroDaArte(ctx, arte, `×${q.multiplicador}`, LARGURA - 22, 20, 12, 'direita');
    } else {
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#4a3420';
      ctx.fillStyle = q.multiplicador >= 3 ? '#ffd23a' : '#fff8d6';
      ctx.strokeText(`×${q.multiplicador}`, LARGURA - 6, 16);
      ctx.fillText(`×${q.multiplicador}`, LARGURA - 6, 16);
    }
    ctx.restore();
  }
  // a mira
  if (q.mira) {
    const { x, y } = q.mira;
    if (arte) {
      const lado = 24;
      ctx.drawImage(arte.mira, x - lado / 2, y - lado / 2, lado, lado);
    } else {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(40, 24, 16, 0.6)';
      desenharMira(ctx, x, y);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#fff3e0';
      desenharMira(ctx, x, y);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function desenharMira(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.moveTo(x - 11, y);
  ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y);
  ctx.lineTo(x + 11, y);
  ctx.moveTo(x, y - 11);
  ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y + 11);
  ctx.stroke();
}

/** O BRILHO DA DOURADA (19/11/2026): um halo amarelo atrás da praga, com faíscas que giram. */
function brilhoDourado(ctx: CanvasRenderingContext2D, x: number, y: number, ms: number) {
  ctx.save();
  ctx.globalAlpha = 0.45 + 0.2 * Math.sin(ms / 90);
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath();
  ctx.ellipse(x, y, 13, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff6c8';
  for (let k = 0; k < 4; k++) {
    const a = ms / 160 + (k * Math.PI) / 2;
    ctx.fillRect(Math.round(x + Math.cos(a) * 15), Math.round(y + Math.sin(a) * 10), 2, 2);
  }
  ctx.restore();
}

/**
 * O COELHO DA MOITA (19/11/2026): no fim da onda, ele sobe de trás da moita. Alegre (os braços para cima) quando a onda foi
 * boa; rindo (a mão na barriga, os olhos fechados de rir) quando quase tudo fugiu. Por código, sem texto. `s` é o tempo (ms)
 * desde que a cena começou.
 */
export function desenharCoelhoDaMoita(ctx: CanvasRenderingContext2D, w: number, h: number, alegre: boolean, s: number) {
  ctx.clearRect(0, 0, w, h);
  const sobe = Math.min(1, s / 450);
  const cx = Math.round(w / 2);
  const base = h - 8;
  const y = Math.round(base - 34 * sobe + (alegre ? Math.abs(Math.sin(s / 160)) * -3 : Math.sin(s / 70) * 1.5));
  // o coelho (atrás da moita)
  ctx.save();
  ctx.fillStyle = '#f2ece2';
  ctx.strokeStyle = '#4a3420';
  ctx.lineWidth = 1;
  // as orelhas
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + d * 5, y - 22, 3, 9, d * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f2b7b0';
    ctx.beginPath();
    ctx.ellipse(cx + d * 5, y - 22, 1.3, 6, d * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ece2';
  }
  // o corpo e a cabeça
  ctx.beginPath();
  ctx.ellipse(cx, y + 8, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, y - 6, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // os braços
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f2ece2';
  ctx.beginPath();
  if (alegre) {
    const balanco = Math.sin(s / 120) * 3;
    ctx.moveTo(cx - 8, y + 4);
    ctx.lineTo(cx - 15, y - 10 + balanco);
    ctx.moveTo(cx + 8, y + 4);
    ctx.lineTo(cx + 15, y - 10 - balanco);
  } else {
    ctx.moveTo(cx - 8, y + 4);
    ctx.lineTo(cx - 2, y + 11);
    ctx.moveTo(cx + 8, y + 4);
    ctx.lineTo(cx + 2, y + 11);
  }
  ctx.stroke();
  // o rosto
  ctx.fillStyle = '#2a2a2a';
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1;
  if (alegre) {
    ctx.fillRect(cx - 4, y - 8, 2, 2);
    ctx.fillRect(cx + 2, y - 8, 2, 2);
    ctx.beginPath();
    ctx.arc(cx, y - 4, 3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    // os olhos fechados de rir e a boca aberta
    ctx.beginPath();
    ctx.moveTo(cx - 5, y - 7);
    ctx.lineTo(cx - 3, y - 9);
    ctx.lineTo(cx - 1, y - 7);
    ctx.moveTo(cx + 1, y - 7);
    ctx.lineTo(cx + 3, y - 9);
    ctx.lineTo(cx + 5, y - 7);
    ctx.stroke();
    ctx.fillStyle = '#7a2e2e';
    ctx.beginPath();
    ctx.ellipse(cx, y - 2, 3, 2 + Math.abs(Math.sin(s / 70)), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // a moita, na frente
  ctx.fillStyle = '#4f8a35';
  for (const [dx, r] of [[-16, 10], [0, 13], [16, 10], [-8, 9], [8, 9]] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx, base, r, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = '#6aa64a';
  for (const [dx, dy] of [[-12, -6], [4, -9], [14, -4], [-3, -3]] as const) ctx.fillRect(cx + dx, base + dy, 2, 2);
  // as estrelinhas da alegria
  if (alegre) {
    ctx.fillStyle = '#ffd23a';
    for (let k = 0; k < 3; k++) {
      const a = s / 300 + (k * 2 * Math.PI) / 3;
      ctx.fillRect(Math.round(cx + Math.cos(a) * 24), Math.round(y - 12 + Math.sin(a) * 8), 2, 2);
    }
  }
}
