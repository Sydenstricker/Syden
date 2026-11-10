import { coresDoJogador, type AvatarDoJogo } from '../coelho/cores';
import { CORES_DA_ESQUADRILHA } from '../nave/desenho';
import { ALTURA, ARENA, LARGURA } from './sim';

/**
 * O DESENHO DO DUELO DE AVIÕEZINHOS (05/11/2026), todo por código, numa tela de 320 × 240 ampliada em pixels inteiros: a horta
 * vista de cima (canteiros, a trilha, a cerca em volta), os teco-tecos com o coelho na cabine, a ervilha, a cenoura teleguiada
 * com a fumacinha, e os acertos. As figuras são mapas de pixels escritos aqui (uma letra, uma cor), girados ponto a ponto
 * (sem borrar) e guardados por direção. As asas têm a cor de cada um na largada (a mesma da Esquadrilha da toca), e o corpo
 * do avião e o coelho, as cores do avatar (a troca de paleta da corrida). Nada de imagem de ninguém.
 */

export type Cor = [number, number, number];


const deHex = (s: string): Cor => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mistura = (a: Cor, b: Cor, k: number): Cor => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k)) as Cor;
const CONTORNO: Cor = [43, 38, 51];

/** O teco-teco visto de cima, de bico para cima. W asa, w asa clara, D asa escura, T leme, f corpo, n bico, p hélice, h cabeça, e orelha, i dentro da orelha. */
const AVIAO = [
  '......ppppppp......',
  '.........n.........',
  '........fff........',
  '.WWWWWWWfffWWWWWWW.',
  'WwwwwwwwfhfwwwwwwwW',
  'WwwwwwwhhhhhwwwwwwW',
  '.DDDDDDDhhhDDDDDDD.',
  '.......ehhhe.......',
  '.......eifie.......',
  '.......eifie.......',
  '........efe........',
  '.........f.........',
  '.........f.........',
  '......TTTfTTT......',
  '......DTTTTTD......',
  '.........n.........',
];

/** A cenoura teleguiada, de ponta para cima (as folhas atrás). */
const CENOURA = ['..o..', '.ooo.', '.oOo.', '.ooo.', '.Ooo.', '.ooo.', '..g..', '.gGg.', 'g.g.g'];

const ERVILHA = ['.GGG.', 'GgggG', 'GglgG', 'GgggG', '.GGG.'];

export interface PaletaDoAviao {
  asa: Cor;
  corpo: Cor;
  pelo: Cor;
}

/** As cores do avião de quem largou em `largada`, com o avatar `avatar` (sem avatar pronto, o moletom do mascote). */
export function paletaDe(largada: number, avatar: number | string | null): PaletaDoAviao {
  const asa = deHex(CORES_DA_ESQUADRILHA[largada % CORES_DA_ESQUADRILHA.length]);
  const a = coresDoJogador(avatar);
  return { asa, corpo: a ? a.roupa : [61, 43, 54], pelo: a ? a.pelo : [236, 228, 240] };
}

export const corDaAsa = (largada: number) => CORES_DA_ESQUADRILHA[largada % CORES_DA_ESQUADRILHA.length];

/** Um mapa de letras vira uma grade de cores (null = vazio). */
function grade(mapa: string[], cores: Record<string, Cor>): (Cor | null)[][] {
  return mapa.map((linha) => [...linha].map((ch) => cores[ch] ?? null));
}

/**
 * GIRA A FIGURA PONTO A PONTO (o vizinho mais perto, sem borrar), num quadrado de `lado`, e põe o contorno escuro em volta. O
 * ângulo é o da direção: 0 é para cima, crescendo no sentido do relógio.
 */
function girar(g: (Cor | null)[][], angulo: number, lado: number, contorno: boolean): HTMLCanvasElement {
  const tela = document.createElement('canvas');
  tela.width = lado;
  tela.height = lado;
  const ctx = tela.getContext('2d')!;
  const img = ctx.createImageData(lado, lado);
  const h = g.length, w = g[0].length;
  const cx = (w - 1) / 2, cy = (h - 1) / 2, c = (lado - 1) / 2;
  const co = Math.cos(angulo), se = Math.sin(angulo);
  const cheio: boolean[] = new Array(lado * lado).fill(false);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      // O PONTO DA FIGURA QUE CAI AQUI, pela rotação ao contrário, olhando 4 × 4 pontinhos dentro do pixel e ficando com a
      // cor que mais aparece (o vazio conta): é o que deixa o desenho girado limpo, sem os dentes do vizinho mais perto
      const votos = new Map<Cor | null, number>();
      for (let sy4 = 0; sy4 < 4; sy4++) {
        for (let sx4 = 0; sx4 < 4; sx4++) {
          const dx = x - c + (sx4 - 1.5) / 4, dy = y - c + (sy4 - 1.5) / 4;
          const sx = Math.round(cx + dx * co + dy * se), sy = Math.round(cy - dx * se + dy * co);
          const v = sx < 0 || sy < 0 || sx >= w || sy >= h ? null : g[sy][sx];
          votos.set(v, (votos.get(v) ?? 0) + 1);
        }
      }
      let cor: Cor | null = null, mais = 0;
      for (const [v, k] of votos) if (k > mais || (k === mais && v !== null)) (cor = v), (mais = k);
      if (!cor || (votos.get(null) ?? 0) > 9) continue;
      const i = (y * lado + x) * 4;
      img.data[i] = cor[0];
      img.data[i + 1] = cor[1];
      img.data[i + 2] = cor[2];
      img.data[i + 3] = 255;
      cheio[y * lado + x] = true;
    }
  }
  if (contorno) {
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        if (cheio[y * lado + x]) continue;
        const vizinho = (x > 0 && cheio[y * lado + x - 1]) || (x < lado - 1 && cheio[y * lado + x + 1]) || (y > 0 && cheio[(y - 1) * lado + x]) || (y < lado - 1 && cheio[(y + 1) * lado + x]);
        if (!vizinho) continue;
        const i = (y * lado + x) * 4;
        img.data[i] = CONTORNO[0];
        img.data[i + 1] = CONTORNO[1];
        img.data[i + 2] = CONTORNO[2];
        img.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return tela;
}

const DIRECOES = 32;
const LADO_DO_AVIAO = 25;
const LADO_DA_CENOURA = 13;

/** O índice da direção (hx, hy) entre as `DIRECOES` guardadas. */
const indice = (hx: number, hy: number, quantas: number) => {
  const a = Math.atan2(hx, -hy);
  return ((Math.round((a / (2 * Math.PI)) * quantas) % quantas) + quantas) % quantas;
};

/** As figuras de um avião, por direção (e a sombra), feitas na primeira vez que se pedem. */
class FigurasDoAviao {
  private giros: (HTMLCanvasElement | undefined)[] = [];
  private sombras: (HTMLCanvasElement | undefined)[] = [];
  private g: (Cor | null)[][];
  private s: (Cor | null)[][];
  constructor(p: PaletaDoAviao) {
    const clara = mistura(p.asa, [255, 255, 255], 0.35);
    const pelo = p.pelo;
    this.g = grade(AVIAO, {
      W: p.asa,
      w: clara,
      T: mistura(p.asa, [0, 0, 0], 0.1),
      D: mistura(p.asa, [0, 0, 0], 0.3),
      f: p.corpo,
      n: [74, 68, 88],
      p: [214, 214, 222],
      h: pelo,
      e: mistura(pelo, [0, 0, 0], 0.08),
      i: [242, 163, 179],
    });
    this.s = grade(AVIAO, Object.fromEntries([...'WwTDfnhei'].map((k) => [k, [0, 0, 0] as Cor])));
  }
  figura(hx: number, hy: number) {
    const i = indice(hx, hy, DIRECOES);
    return (this.giros[i] ??= girar(this.g, (i / DIRECOES) * 2 * Math.PI, LADO_DO_AVIAO, true));
  }
  sombra(hx: number, hy: number) {
    const i = indice(hx, hy, DIRECOES);
    return (this.sombras[i] ??= girar(this.s, (i / DIRECOES) * 2 * Math.PI, LADO_DO_AVIAO, false));
  }
}

const figurasDaCenoura: HTMLCanvasElement[] = [];
const cenouraNa = (hx: number, hy: number) => {
  const i = indice(hx, hy, 16);
  return (figurasDaCenoura[i] ??= girar(
    grade(CENOURA, { o: [240, 138, 36], O: [196, 96, 26], g: [108, 191, 79], G: [63, 127, 52] }),
    (i / 16) * 2 * Math.PI,
    LADO_DA_CENOURA,
    true,
  ));
};
let figuraDaErvilha: HTMLCanvasElement | null = null;
const ervilha = () => (figuraDaErvilha ??= girar(grade(ERVILHA, { G: [63, 127, 52], g: [124, 200, 92], l: [214, 242, 190] }), 0, 7, true));

// ---------------------------------------------------------------------------------------------------------------------
// O CHÃO: a horta vista de cima, pintada uma vez
// ---------------------------------------------------------------------------------------------------------------------

function sorteio(semente: number) {
  let s = semente;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) | 0), ((s >>> 8) & 0xffff) / 0x10000);
}

export function pintarHorta(): HTMLCanvasElement {
  const tela = document.createElement('canvas');
  tela.width = LARGURA;
  tela.height = ALTURA;
  const g = tela.getContext('2d')!;
  const r = sorteio(42);
  const px = (x: number, y: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x, y, 1, 1);
  };
  // a grama, com tufos
  g.fillStyle = '#86b25f';
  g.fillRect(0, 0, LARGURA, ALTURA);
  for (let k = 0; k < 1400; k++) px(Math.floor(r() * LARGURA), Math.floor(r() * ALTURA), r() < 0.5 ? '#79a554' : '#94c06a');
  const [x0, y0, x1, y1] = ARENA;
  // os canteiros: faixas de terra com as fileiras, em blocos dos dois lados da trilha
  const canteiro = (cx: number, cy: number, w: number, h: number, planta: 'cenoura' | 'alface' | 'repolho') => {
    g.fillStyle = '#7a5434';
    g.fillRect(cx, cy, w, h);
    g.fillStyle = '#8c6440';
    for (let y = cy + 1; y < cy + h; y += 6) g.fillRect(cx + 1, y, w - 2, 1);
    for (let k = 0; k < (w * h) / 18; k++) px(cx + Math.floor(r() * w), cy + Math.floor(r() * h), '#6a462a');
    for (let y = cy + 3; y < cy + h - 1; y += 6) {
      for (let x = cx + 3; x < cx + w - 2; x += 8) {
        if (planta === 'cenoura') {
          px(x, y, '#6cbf4f');
          px(x + 1, y - 1, '#6cbf4f');
          px(x - 1, y - 1, '#3f7f34');
          px(x, y + 1, '#f08a24');
        } else if (planta === 'alface') {
          g.fillStyle = '#8fd46a';
          g.fillRect(x - 1, y - 1, 3, 2);
          px(x, y - 1, '#c8f0a0');
        } else {
          g.fillStyle = '#5c9f74';
          g.fillRect(x - 1, y - 1, 3, 3);
          px(x, y, '#9fd4b0');
        }
      }
    }
  };
  const plantas = ['cenoura', 'alface', 'repolho'] as const;
  const colunas = [x0 + 18, x0 + 82, 186, 250];
  const linhas = [y0 + 16, 128];
  let k = 0;
  for (const cy of linhas) for (const cx of colunas) canteiro(cx, cy, 48, 78, plantas[k++ % 3]);
  // a trilha em cruz, de terra batida
  g.fillStyle = '#c9a676';
  g.fillRect(x0, 108, x1 - x0, 14);
  g.fillRect(150, y0, 14, y1 - y0);
  for (let i = 0; i < 260; i++) px(x0 + Math.floor(r() * (x1 - x0)), 108 + Math.floor(r() * 14), '#b8956a');
  for (let i = 0; i < 200; i++) px(150 + Math.floor(r() * 14), y0 + Math.floor(r() * (y1 - y0)), '#b8956a');
  // a poça do regador e o espantalho-mastro no meio
  g.fillStyle = '#5c96be';
  g.beginPath();
  g.ellipse(157, 115, 9, 6, 0, 0, Math.PI * 2);
  g.fill();
  px(153, 113, '#a8d4ef');
  px(154, 113, '#a8d4ef');
  // fora da cerca: grama mais escura e as árvores dos cantos (de cima, copas redondas)
  g.fillStyle = 'rgba(30,50,20,0.22)';
  g.fillRect(0, 0, LARGURA, y0);
  g.fillRect(0, y1, LARGURA, ALTURA - y1);
  g.fillRect(0, y0, x0, y1 - y0);
  g.fillRect(x1, y0, LARGURA - x1, y1 - y0);
  // a cerca: as tábuas e os mourões
  g.fillStyle = '#a9794b';
  g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, 2);
  g.fillRect(x0 - 2, y1, x1 - x0 + 4, 2);
  g.fillRect(x0 - 2, y0, 2, y1 - y0);
  g.fillRect(x1, y0, 2, y1 - y0);
  g.fillStyle = '#6e4a2c';
  for (let x = x0 - 2; x <= x1; x += 12) {
    g.fillRect(x, y0 - 3, 3, 4);
    g.fillRect(x, y1 - 1, 3, 4);
  }
  for (let y = y0 - 2; y <= y1; y += 12) {
    g.fillRect(x0 - 3, y, 4, 3);
    g.fillRect(x1 - 1, y, 4, 3);
  }
  return tela;
}

// ---------------------------------------------------------------------------------------------------------------------
// A CENA
// ---------------------------------------------------------------------------------------------------------------------

export interface AviaoNaTela {
  id: number;
  x: number;
  y: number;
  hx: number;
  hy: number;
  paleta: PaletaDoAviao;
  nome: string | null;
  /** Do computador: o nome vai com a carinha de robô (a tela não finge que é gente). */
  robo: boolean;
  vidas: number;
  /** Piscando depois de um acerto; com o brilho da curva fechada; sendo perseguido por uma cenoura. */
  piscando: boolean;
  protegido: boolean;
  cacado: boolean;
  /** Só o meu: a carga da cenoura (0 a 1) enquanto segura o tiro. */
  carga: number;
}

export interface TiroNaTela {
  tipo: 'ervilha' | 'missil';
  x: number;
  y: number;
  dx: number;
  dy: number;
  rastro: number[];
}

/** Um efeito que dura alguns quadros: o acerto (penas e faíscas) e a queda (o avião girando e encolhendo, com fumaça). */
export interface Efeito {
  tipo: 'acerto' | 'queda';
  x: number;
  y: number;
  idade: number;
  paleta?: PaletaDoAviao;
  hx?: number;
  hy?: number;
}

const cacheDeFiguras = new Map<string, FigurasDoAviao>();
const figurasDe = (p: PaletaDoAviao) => {
  const chave = `${p.asa}|${p.corpo}|${p.pelo}`;
  let f = cacheDeFiguras.get(chave);
  if (!f) cacheDeFiguras.set(chave, (f = new FigurasDoAviao(p)));
  return f;
};

export function desenharCena(
  ctx: CanvasRenderingContext2D,
  cena: { horta: HTMLCanvasElement; avioes: AviaoNaTela[]; tiros: TiroNaTela[]; efeitos: Efeito[]; quadro: number; calmo: boolean },
) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cena.horta, 0, 0);
  const meio = (LADO_DO_AVIAO - 1) / 2;

  // as sombras dos aviões, no chão (o avião voa um pouco acima)
  ctx.globalAlpha = 0.22;
  for (const a of cena.avioes) ctx.drawImage(figurasDe(a.paleta).sombra(a.hx, a.hy), Math.round(a.x - meio + 4), Math.round(a.y - meio + 7));
  ctx.globalAlpha = 1;

  // a fumacinha das cenouras
  for (const t of cena.tiros) {
    if (t.tipo !== 'missil') continue;
    const r = t.rastro;
    for (let k = r.length - 2, idade = 0; k >= 0; k -= 6, idade++) {
      const tam = Math.max(1, 3 - Math.floor(idade / 2));
      ctx.fillStyle = `rgba(240,236,228,${Math.max(0.15, 0.7 - idade * 0.12)})`;
      ctx.fillRect(Math.round(r[k] - tam / 2), Math.round(r[k + 1] - tam / 2), tam, tam);
    }
  }

  // os aviões
  for (const a of cena.avioes) {
    if (a.piscando && !cena.calmo && Math.floor(cena.quadro / 4) % 2 === 1) continue;
    ctx.globalAlpha = a.piscando && cena.calmo ? 0.55 : 1;
    ctx.drawImage(figurasDe(a.paleta).figura(a.hx, a.hy), Math.round(a.x - meio), Math.round(a.y - meio));
    ctx.globalAlpha = 1;
    const ax = Math.round(a.x), ay = Math.round(a.y);
    // a curva fechada: um anel de brilho
    if (a.protegido) {
      ctx.strokeStyle = 'rgba(255,247,224,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ax + 0.5, ay + 0.5, 12, 0, Math.PI * 2);
      ctx.setLineDash(cena.calmo ? [] : [2, 2]);
      ctx.lineDashOffset = cena.calmo ? 0 : cena.quadro % 4;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // perseguido por uma cenoura: os cantos da mira, em vermelho
    if (a.cacado) {
      ctx.fillStyle = '#e2483d';
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const cx = ax + sx * 13, cy = ay + sy * 13;
        ctx.fillRect(cx - (sx > 0 ? 3 : 0), cy, 4, 1);
        ctx.fillRect(cx, cy - (sy > 0 ? 3 : 0), 1, 4);
      }
    }
    // as vidas: três pontinhos embaixo
    for (let v = 0; v < 3; v++) {
      ctx.fillStyle = '#2b2633';
      ctx.fillRect(ax - 7 + v * 5, ay + 12, 4, 4);
      ctx.fillStyle = v < a.vidas ? '#e2483d' : '#6b6478';
      ctx.fillRect(ax - 6 + v * 5, ay + 13, 2, 2);
    }
    // a carga da cenoura (só a minha): uma barrinha que enche, e a cenoura pronta pisca
    if (a.carga > 0) {
      ctx.fillStyle = '#2b2633';
      ctx.fillRect(ax - 7, ay + 17, 14, 3);
      ctx.fillStyle = a.carga >= 1 ? (Math.floor(cena.quadro / 6) % 2 && !cena.calmo ? '#fff7e0' : '#f08a24') : '#c4601a';
      ctx.fillRect(ax - 6, ay + 18, Math.round(12 * Math.min(1, a.carga)), 1);
    }
    if (a.nome) {
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2b2633';
      const largura = ctx.measureText(a.nome).width;
      const tx = a.robo ? ax + 4 : ax;
      ctx.strokeText(a.nome, tx, ay - 13);
      ctx.fillStyle = '#fff7e0';
      ctx.fillText(a.nome, tx, ay - 13);
      if (a.robo) {
        // a carinha de robô, em pixels, antes do nome
        const rx = Math.round(tx - largura / 2 - 8), ry = ay - 20;
        ctx.fillStyle = '#2b2633';
        ctx.fillRect(rx - 1, ry - 1, 8, 8);
        ctx.fillStyle = '#b8c4d4';
        ctx.fillRect(rx, ry + 1, 6, 5);
        ctx.fillRect(rx + 2, ry, 2, 1);
        ctx.fillStyle = '#4aa3df';
        ctx.fillRect(rx + 1, ry + 2, 1, 2);
        ctx.fillRect(rx + 4, ry + 2, 1, 2);
      }
    }
  }

  // os tiros
  for (const t of cena.tiros) {
    if (t.tipo === 'ervilha') ctx.drawImage(ervilha(), Math.round(t.x - 3), Math.round(t.y - 3));
    else ctx.drawImage(cenouraNa(t.dx, t.dy), Math.round(t.x - (LADO_DA_CENOURA - 1) / 2), Math.round(t.y - (LADO_DA_CENOURA - 1) / 2));
  }

  // os efeitos
  for (const e of cena.efeitos) {
    if (e.tipo === 'acerto') {
      const k = e.idade / 24;
      if (cena.calmo) {
        ctx.strokeStyle = `rgba(255,247,224,${1 - k})`;
        ctx.beginPath();
        ctx.arc(Math.round(e.x) + 0.5, Math.round(e.y) + 0.5, 10, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      // faíscas e penugem saindo em volta (oito direções fixas)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const d = 3 + e.idade * 0.9;
        ctx.fillStyle = i % 2 ? '#fff7e0' : '#f5c542';
        ctx.fillRect(Math.round(e.x + Math.cos(a) * d), Math.round(e.y + Math.sin(a) * d), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
      }
      if (e.idade < 6) {
        ctx.fillStyle = 'rgba(255,247,224,0.8)';
        ctx.fillRect(Math.round(e.x) - 3, Math.round(e.y) - 3, 7, 7);
      }
    } else if (e.paleta) {
      // a queda: o avião gira e encolhe até o chão, soltando fumaça
      const k = Math.min(1, e.idade / 60);
      const giro = cena.calmo ? 0 : e.idade * 0.25;
      const hx = e.hx ?? 0, hy = e.hy ?? -1;
      const fx = hx * Math.cos(giro) - hy * Math.sin(giro), fy = hx * Math.sin(giro) + hy * Math.cos(giro);
      const f = figurasDe(e.paleta).figura(fx, fy);
      const lado = Math.max(2, Math.round(LADO_DO_AVIAO * (1 - 0.6 * k)));
      ctx.globalAlpha = 1 - k * 0.5;
      ctx.drawImage(f, Math.round(e.x - lado / 2), Math.round(e.y - lado / 2 + k * 6), lado, lado);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(90,84,100,${0.5 - i * 0.1})`;
        ctx.fillRect(Math.round(e.x + 2 - i * 2), Math.round(e.y - 4 - i * 3 - (e.idade % 6)), 3, 3);
      }
      if (k >= 1) {
        // a marquinha no chão onde caiu (um X de terra)
        ctx.fillStyle = 'rgba(60,40,30,0.5)';
        ctx.fillRect(Math.round(e.x) - 3, Math.round(e.y) + 6, 7, 1);
        ctx.fillRect(Math.round(e.x), Math.round(e.y) + 3, 1, 7);
      }
    }
  }
}



// ---------------------------------------------------------------------------------------------------------------------
// A CÂMERA DE CADA UM (06/11/2026, pedido dele: "talvez funcione melhor somente com a câmera do usuário, como no jogo de
// corrida"): a cena inteira é desenhada no mundo (a horta de 320 × 240), e a tela mostra só um pedaço dele, em volta do
// próprio avião. Quem está fora da vista aparece como uma setinha na borda, na cor das asas dele; a cenoura que persegue
// você, como uma seta laranja.
// ---------------------------------------------------------------------------------------------------------------------

/** O tamanho da vista, em pixels do mundo (a mesma proporção 4:3 da tela). */
export const VISTA_L = 192;
export const VISTA_A = 144;
/** O quanto a câmera olha à frente do avião, na direção do voo. */
const OLHAR_A_FRENTE = 22;

export interface Camera {
  x: number;
  y: number;
}

/** O canto de cima da vista que põe (x, y) no meio, olhando um pouco à frente de (hx, hy), sem sair da horta pintada. */
export function alvoDaCamera(x: number, y: number, hx: number, hy: number): Camera {
  return {
    x: Math.min(LARGURA - VISTA_L, Math.max(0, x + hx * OLHAR_A_FRENTE - VISTA_L / 2)),
    y: Math.min(ALTURA - VISTA_A, Math.max(0, y + hy * OLHAR_A_FRENTE - VISTA_A / 2)),
  };
}

/** Uma marca na borda: um avião (na cor das asas) ou a cenoura que persegue você. */
export interface MarcaNaBorda {
  x: number;
  y: number;
  cor: string;
  cenoura: boolean;
}

/**
 * Copia o pedaço do mundo que a câmera vê para a tela, e põe na borda as setas de quem está fora da vista. `emCima` é quanto do
 * alto da vista o painel do jogo cobre (em pixels da vista): as setas de cima descem para baixo dele.
 */
export function desenharVista(
  ctx: CanvasRenderingContext2D,
  mundo: HTMLCanvasElement,
  camera: Camera,
  marcas: MarcaNaBorda[],
  quadro: number,
  calmo: boolean,
  emCima = 0,
) {
  ctx.imageSmoothingEnabled = false;
  const cx = Math.round(camera.x), cy = Math.round(camera.y);
  ctx.drawImage(mundo, cx, cy, VISTA_L, VISTA_A, 0, 0, VISTA_L, VISTA_A);
  const margem = 7;
  // o meio das setas é o meio do que sobra visível, abaixo do painel
  const topo = Math.min(VISTA_A / 2, Math.max(0, emCima));
  const meioX = VISTA_L / 2, meioY = (VISTA_A + topo) / 2;
  const meiaAltura = (VISTA_A - topo) / 2;
  for (const m of marcas) {
    const vx = m.x - cx, vy = m.y - cy;
    // dentro da vista (com o avião inteiro aparecendo), não precisa de seta
    if (vx >= 4 && vx <= VISTA_L - 4 && vy >= 4 && vy <= VISTA_A - 4) continue;
    const dx = vx - meioX, dy = vy - meioY;
    const k = Math.min(dx !== 0 ? (meioX - margem) / Math.abs(dx) : Infinity, dy !== 0 ? (meiaAltura - margem) / Math.abs(dy) : Infinity);
    const px = meioX + dx * k, py = meioY + dy * k;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    // a cenoura pisca devagar (é um aviso), menos para quem pediu menos movimento
    if (m.cenoura && !calmo && Math.floor(quadro / 10) % 3 === 2) continue;
    const ponta = 6, base = 4;
    const tri = (tam: number) => {
      ctx.beginPath();
      ctx.moveTo(px + ux * tam, py + uy * tam);
      ctx.lineTo(px - ux * tam * 0.6 - uy * base * (tam / ponta), py - uy * tam * 0.6 + ux * base * (tam / ponta));
      ctx.lineTo(px - ux * tam * 0.6 + uy * base * (tam / ponta), py - uy * tam * 0.6 - ux * base * (tam / ponta));
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = '#2b2633';
    tri(ponta + 2);
    ctx.fillStyle = m.cor;
    tri(ponta);
  }
}
