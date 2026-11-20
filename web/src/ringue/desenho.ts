/**
 * O DESENHO DO RINGUE (16/11/2026): tudo por código, menos o adversário, que é a folha do bicho da Briga (os Ultimate Monsters da
 * Quaternius, CC0, renderizados pelo Blender: web/public/briga/<fase>/<bicho>.png) ampliada, com as LUVAS desenhadas por cima. A
 * vista é de trás de quem joga: o coelho de costas embaixo, meio transparente para não esconder os avisos, com o pelo e a roupa
 * do avatar. Nenhum sangue nem machucado: quem leva pisca branco, e quem cai vê estrelinhas.
 *
 * O desenho só lê a luta (sim.ts) e o relógio da tela; nada aqui muda a regra.
 */
import { FOLHAS_DOS_BICHOS } from '../briga/folhasDosBichos';
import { coresDoJogador, type AvatarDoJogo } from '../coelho/cores';
import { MOLETOM_DO_MASCOTE, PELO_DO_MASCOTE } from '../corrida/coresDosAvatares';
import {
  ADVERSARIOS,
  ATINGIDO,
  ESQUIVA,
  GOLPE_SAINDO,
  IMPACTO_DO_FORTE,
  IMPACTO_DO_SOCO,
  LIVRA_ATE,
  PASSOS_DO_ROUND,
  ROUNDS,
  SOCO,
  SOCO_FORTE,
  TOQUES_PARA_LEVANTAR,
  FOLEGO,
  ESTRELAS,
  type Evento,
  type Luta,
} from './sim';

export const LARGURA = 384;
export const ALTURA = 216;
const MEIO = LARGURA / 2;
/** Onde fica o pé do adversário. */
const PE_Y = 170;
/** A ampliação de cada folha (pixel art só cresce bem em inteiros; o pesado, de folha maior, fica com 2 e ainda é o maior). */
const ESCALA: Record<string, number> = { macaco: 3, yeti: 2, 'demonio-azul': 3 };

/** A ordem dos desenhos na folha (a mesma de briga/sprites.ts e do briga-monstros-pos.py). */
const QUADRO = { parado: 0, prep: 10, golpe: 12, dor: 14, caido: 16, pulo: 19 } as const;

type Rgb = [number, number, number];
const cor = ([r, g, b]: Rgb, k = 1) => `rgb(${Math.round(Math.min(255, r * k))},${Math.round(Math.min(255, g * k))},${Math.round(Math.min(255, b * k))})`;

interface Efeito {
  tipo: 'pow' | 'faisca' | 'estrela';
  x: number;
  y: number;
  em: number;
}

const folhas = new Map<string, { img: HTMLImageElement; branca: HTMLCanvasElement | null }>();

/** A folha do bicho (carrega na primeira vez; até lá, null). */
function folha(bicho: string): { img: HTMLImageElement; branca: HTMLCanvasElement | null } | null {
  const f = FOLHAS_DOS_BICHOS[bicho];
  if (!f) return null;
  let x = folhas.get(bicho);
  if (!x) {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}briga/${f.fase}/${bicho}.png`;
    x = { img, branca: null };
    folhas.set(bicho, x);
  }
  if (!x.img.complete || !x.img.naturalWidth) return null;
  if (!x.branca) {
    const c = document.createElement('canvas');
    c.width = x.img.naturalWidth;
    c.height = x.img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(x.img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#fff8ec';
    g.fillRect(0, 0, c.width, c.height);
    x.branca = c;
  }
  return x;
}

/** Pede as três folhas de antemão (a apresentação do primeiro já aparece com ele). */
export function carregarFolhas(): Promise<void> {
  return Promise.all(
    ADVERSARIOS.map(
      (a) =>
        new Promise<void>((pronto) => {
          folha(a.bicho);
          const img = folhas.get(a.bicho)?.img;
          if (!img || (img.complete && img.naturalWidth)) return pronto();
          img.addEventListener('load', () => pronto(), { once: true });
          img.addEventListener('error', () => pronto(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/** A plateia: posições fixas, sorteadas uma vez por um gerador simples (o desenho é o mesmo em toda abertura). */
const PLATEIA: { x: number; y: number; r: number; c: string; fase: number }[] = (() => {
  const cores = ['#4a3f5c', '#5a4a3c', '#3f4f5c', '#5c3f4a', '#4f5c3f', '#6a5a7a', '#7a6a5a'];
  const lista = [];
  let s = 12345;
  const r = (n: number) => ((s = (s * 48271) % 2147483647), s % n);
  for (let fila = 0; fila < 4; fila++) {
    const y = 30 + fila * 11;
    for (let x = 4 + (fila % 2) * 6; x < LARGURA; x += 12) lista.push({ x: x + r(4), y: y + r(3), r: 4 + (fila >> 1), c: cores[r(cores.length)], fase: r(60) });
  }
  return lista;
})();

export class DesenhoDoRingue {
  private g: CanvasRenderingContext2D;
  private pelo: Rgb;
  private roupa: Rgb;
  private efeitos: Efeito[] = [];
  /** O tremor da tela (quem levou), até quando. */
  private tremeAte = 0;
  private flashAte = 0;
  /** O adversário pisca branco quando leva (pelo relógio da tela: no chão, a luta dele não anda). */
  private piscaAte = 0;
  /** O clarão vermelho de quando ele entra na fúria. */
  private furiaAte = 0;

  constructor(g: CanvasRenderingContext2D, avatar: AvatarDoJogo) {
    this.g = g;
    const c = coresDoJogador(avatar);
    this.pelo = c?.pelo ?? PELO_DO_MASCOTE[0];
    this.roupa = c?.roupa ?? MOLETOM_DO_MASCOTE[0];
    g.imageSmoothingEnabled = false;
  }

  /** Os eventos do passo viram efeitos na tela. */
  ouvir(eventos: Evento[], agora: number) {
    for (const e of eventos) {
      if (e.tipo === 'soco') {
        this.efeitos.push({ tipo: e.forte ? 'estrela' : 'pow', x: MEIO + e.lado * 22, y: e.forte ? 78 : 104, em: agora });
        this.piscaAte = agora + 130;
      }
      else if (e.tipo === 'bloqueado') this.efeitos.push({ tipo: 'faisca', x: MEIO + e.lado * 22, y: 100, em: agora });
      else if (e.tipo === 'atingido') {
        this.tremeAte = agora + 220;
        this.flashAte = agora + 90;
      } else if (e.tipo === 'raspou') this.tremeAte = agora + 100;
      // a fúria (20/11/2026): ele bufa, a tela treme e a luz fica vermelha por um instante
      else if (e.tipo === 'furia') {
        this.tremeAte = agora + 400;
        this.furiaAte = agora + 600;
      }
    }
  }

  desenhar(l: Luta, agora: number, dicaDoLevantar: boolean) {
    const g = this.g;
    g.save();
    if (this.tremeAte > agora) g.translate(Math.round(Math.sin(agora / 18) * 3), 0);
    this.fundo(agora, l);
    this.adversario(l, agora);
    this.efeitosNaTela(agora);
    this.coelho(l, agora);
    g.restore();
    if (this.flashAte > agora) {
      g.fillStyle = 'rgba(255,248,236,0.45)';
      g.fillRect(0, 0, LARGURA, ALTURA);
    }
    if (this.furiaAte > agora) {
      g.fillStyle = `rgba(220,40,30,${(0.3 * (this.furiaAte - agora)) / 600})`;
      g.fillRect(0, 0, LARGURA, ALTURA);
    }
    this.painel(l, agora, dicaDoLevantar);
  }

  // ------------------------------------------------------------------ o fundo e o ringue
  private fundo(agora: number, l: Luta) {
    const g = this.g;
    const ceu = g.createLinearGradient(0, 0, 0, 110);
    ceu.addColorStop(0, '#1b1a2b');
    ceu.addColorStop(1, '#2c2840');
    g.fillStyle = ceu;
    g.fillRect(0, 0, LARGURA, 120);
    // os refletores
    g.fillStyle = 'rgba(255, 240, 200, 0.06)';
    for (const x of [70, MEIO, 314]) {
      g.beginPath();
      g.moveTo(x - 6, 0);
      g.lineTo(x + 6, 0);
      g.lineTo(x + 60, 120);
      g.lineTo(x - 60, 120);
      g.fill();
    }
    // a plateia balança quando alguém cai ou na apresentação
    const animada = l.queda !== null || l.fase !== 'luta';
    for (const p of PLATEIA) {
      const pula = animada && Math.floor((agora / 16 + p.fase * 7) / 20) % 3 === 0 ? 2 : 0;
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y - pula, p.r, 0, Math.PI * 2);
      g.fill();
      g.fillRect(p.x - p.r - 1, p.y - pula + p.r - 1, p.r * 2 + 2, 8);
    }
    // o chão do ringue, em perspectiva
    g.fillStyle = '#7d8fb0';
    g.beginPath();
    g.moveTo(40, 96);
    g.lineTo(LARGURA - 40, 96);
    g.lineTo(LARGURA + 40, ALTURA);
    g.lineTo(-40, ALTURA);
    g.fill();
    g.fillStyle = '#8fa1c2';
    g.beginPath();
    g.moveTo(70, 104);
    g.lineTo(LARGURA - 70, 104);
    g.lineTo(LARGURA - 20, ALTURA);
    g.lineTo(20, ALTURA);
    g.fill();
    // a sombra do adversário
    g.fillStyle = 'rgba(30, 30, 50, 0.3)';
    g.beginPath();
    g.ellipse(MEIO, PE_Y + 2, 54, 9, 0, 0, Math.PI * 2);
    g.fill();
    // os postes e as cordas do fundo
    g.fillStyle = '#c9c4d8';
    g.fillRect(38, 52, 6, 46);
    g.fillRect(LARGURA - 44, 52, 6, 46);
    const cordas = ['#d8463c', '#f0ece4', '#3c6fd8'];
    for (let i = 0; i < 3; i++) {
      g.fillStyle = cordas[i];
      g.fillRect(44, 58 + i * 12, LARGURA - 88, 2);
    }
    // as cordas da frente, nos cantos de baixo
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = cordas[i];
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 120 + i * 14);
      g.lineTo(34, 100 + i * 10);
      g.moveTo(LARGURA, 120 + i * 14);
      g.lineTo(LARGURA - 34, 100 + i * 10);
      g.stroke();
    }
  }

  // ------------------------------------------------------------------ o adversário
  private adversario(l: Luta, agora: number) {
    const g = this.g;
    const A = ADVERSARIOS[l.adv];
    const a = l.a;
    const f = FOLHAS_DOS_BICHOS[A.bicho];
    const s = ESCALA[A.bicho] ?? 2;
    const alto = (f?.alto ?? 44) * s;
    let dx = 0;
    let dy = 0;
    let quadro: number = QUADRO.parado + (Math.floor(agora / 160) % 4);
    const gl = a.golpe;
    // a apresentação: ele entra pela frente, de baixo para cima
    if (l.fase === 'apresentacao') dy = Math.max(0, 40 - l.faseT) * 1.5;
    switch (a.estado) {
      case 'aviso':
      case 'finta':
        quadro = QUADRO.prep + (a.t < 10 ? 0 : 1);
        if (gl) {
          dx = -gl.lado * 6;
          dy = gl.id === 'por-cima' ? -8 : gl.id === 'de-baixo' ? 5 : -2;
        }
        if (a.estado === 'finta') dx += Math.floor(agora / 70) % 2 ? 2 : -2;
        else if (Math.floor(agora / 50) % 2) dx += 1;
        break;
      case 'golpe':
        quadro = QUADRO.golpe + (a.t < 4 ? 0 : 1);
        if (gl) dx = gl.lado * 14;
        dy = 4;
        break;
      case 'aberto':
        // esquivado, ele passa do ponto e fica sem guarda
        if (a.resultado === 'esquivou' && a.t < 14) {
          quadro = QUADRO.golpe + 1;
          dy = 6;
        } else quadro = QUADRO.dor;
        break;
      case 'atordoado':
        quadro = QUADRO.dor + (a.t < 8 ? 0 : 1);
        dx = Math.floor(agora / 40) % 2 ? 2 : -2;
        break;
      case 'provoca':
        quadro = QUADRO.pulo + (Math.floor(agora / 200) % 2);
        dy = Math.floor(agora / 200) % 2 ? -3 : 0;
        break;
      case 'caido':
        quadro = QUADRO.caido + Math.min(2, Math.floor(a.t / 8));
        dy = 6;
        break;
      case 'levantando':
        quadro = a.t < 20 ? QUADRO.caido + 1 : QUADRO.caido;
        break;
    }
    if (l.queda === 'adversario') quadro = QUADRO.caido + 2;
    const x = folha(A.bicho);
    // a fúria: o vapor vermelho atrás dele, pulsando (só desenho)
    if (a.furia && l.queda !== 'adversario' && a.estado !== 'caido') {
      const p = 0.5 + 0.5 * Math.sin(agora / 140);
      g.fillStyle = `rgba(230,50,40,${0.16 + 0.12 * p})`;
      g.beginPath();
      g.ellipse(MEIO + dx, PE_Y + dy - alto * 0.5, alto * (0.42 + 0.04 * p), alto * 0.58, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (x && f) {
      const L = f.lado;
      const piscando = this.piscaAte > agora && Math.floor(agora / 40) % 2 === 0;
      g.drawImage(piscando && x.branca ? x.branca : x.img, quadro * L, 0, L, L, Math.round(MEIO + dx - f.peX * s), Math.round(PE_Y + dy - f.peY * s), L * s, L * s);
    }
    // a marca da fúria em cima da cabeça: quatro cantos vermelhos que pulsam
    if (a.furia && l.queda !== 'adversario' && a.estado !== 'caido') {
      const cx = MEIO + dx + alto * 0.24;
      const cy = PE_Y + dy - alto * 0.92;
      const r = 5 + (Math.floor(agora / 180) % 2);
      g.strokeStyle = '#e8322a';
      g.lineWidth = 3;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.beginPath();
        g.moveTo(cx + sx * 2, cy + sy * r);
        g.quadraticCurveTo(cx + sx * 2, cy + sy * 2, cx + sx * r, cy + sy * 2);
        g.stroke();
      }
    }
    if (l.queda === 'adversario' || a.estado === 'caido') {
      // em cima da cabeça dele, que cai para a esquerda da tela (acima das orelhas do coelho)
      this.estrelinhas(MEIO + dx - 84, PE_Y - 64, agora);
      return;
    }
    if (l.fase === 'apresentacao' && l.faseT < 20) return;
    // as luvas acompanham o tamanho do bicho (a conta delas é a de um bicho de ~90 px)
    const cy = PE_Y + dy - alto * 0.55;
    const k = alto / 95;
    g.save();
    g.translate(MEIO + dx, cy);
    g.scale(k, k);
    g.translate(-(MEIO + dx), -cy);
    this.luvasDoAdversario(l, MEIO + dx, cy, agora);
    g.restore();
  }

  private luvasDoAdversario(l: Luta, cx: number, cy: number, agora: number) {
    const a = l.a;
    const A = ADVERSARIOS[l.adv];
    const gl = a.golpe;
    // as duas luvas: [x, y, raio] de cada uma (esquerda e direita da tela)
    let e: [number, number, number] = [cx - 18, cy + 6, 10];
    let d: [number, number, number] = [cx + 18, cy + 6, 10];
    let brilho: [number, number] | null = null;
    if (a.estado === 'guarda' || a.estado === 'levantando') {
      // a guarda: a luva do lado coberto sobe para a frente do rosto
      if (a.guarda <= 0) e = [cx - 10, cy - 6, 11];
      if (a.guarda >= 0) d = [cx + 10, cy - 6, 11];
    } else if ((a.estado === 'aviso' || a.estado === 'finta') && gl) {
      const k = Math.min(1, a.t / 10);
      // o recuo: a luva que vai bater vai para trás e para fora (fica menor e sobe)
      if (gl.id === 'por-cima') {
        e = [cx - 14, cy - 18 - 10 * k, 9];
        d = [cx + 14, cy - 18 - 10 * k, 9];
        brilho = [cx, cy - 30];
      } else if (gl.id === 'de-baixo') {
        d = [cx + 22, cy + 18 + 4 * k, 9];
        e = [cx - 10, cy - 6, 11];
        brilho = [d[0], d[1]];
      } else if (gl.lado < 0) {
        e = [cx - 22 - 10 * k, cy - 4 * k, 9];
        d = [cx + 10, cy - 6, 11];
        brilho = [e[0], e[1]];
      } else if (gl.lado > 0) {
        d = [cx + 22 + 10 * k, cy - 4 * k, 9];
        e = [cx - 10, cy - 6, 11];
        brilho = [d[0], d[1]];
      } else {
        // o direto: a luva da direita puxa para trás do ombro
        d = [cx + 16, cy - 2 - 4 * k, 9];
        e = [cx - 10, cy - 6, 11];
        brilho = [d[0], d[1]];
      }
      // a finta mexe a luva; o brilho só existe no golpe de verdade, e só na faixa dele
      if (a.estado === 'finta') {
        const w = Math.floor(agora / 90) % 2 ? 2 : -2;
        e = [e[0] + w, e[1], e[2]];
        d = [d[0] - w, d[1], d[2]];
        brilho = null;
      } else if (!gl.brilho || a.t < gl.brilho[0] || a.t > gl.brilho[1]) brilho = null;
    } else if (a.estado === 'golpe' && gl) {
      // o golpe saindo: a luva cresce na direção de quem joga
      const k = Math.min(1, a.t / 4) * (1 - Math.max(0, a.t - GOLPE_SAINDO + 4) / 4);
      const alvo: [number, number] = gl.id === 'por-cima' ? [MEIO, 120] : gl.id === 'de-baixo' ? [MEIO + 6, 150] : [MEIO + gl.lado * 40, 140];
      const mao = gl.lado < 0 ? 'e' : 'd';
      const p: [number, number, number] = [cx + (alvo[0] - cx) * k, cy + (alvo[1] - cy) * k, 10 + 14 * k];
      if (mao === 'e') e = p;
      else d = p;
    } else if (a.estado === 'aberto' && a.resultado === 'esquivou' && gl && a.t < 14) {
      // passou do ponto: a luva esticada para o lado onde o coelho estava
      const p: [number, number, number] = [cx + (gl.lado || 1) * 34, cy + 22, 13];
      if (gl.lado < 0) e = p;
      else d = p;
    } else if (a.estado === 'provoca' || a.estado === 'aberto' || a.estado === 'atordoado') {
      // sem guarda: as luvas caídas
      e = [cx - 24, cy + 20, 10];
      d = [cx + 24, cy + 20, 10];
    }
    this.luva(e[0], e[1], e[2], A.luva);
    this.luva(d[0], d[1], d[2], A.luva);
    if (brilho) this.brilho(brilho[0], brilho[1], agora);
  }

  private luva(x: number, y: number, r: number, c: string) {
    const g = this.g;
    g.fillStyle = 'rgba(20, 16, 30, 0.85)';
    g.beginPath();
    g.arc(x, y, r + 1.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    // o punho e o brilho do couro
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(x - r * 0.6, y + r * 0.45, r * 1.2, r * 0.35);
  }

  /** O brilho de quatro pontas na luva: a hora de interromper. */
  private brilho(x: number, y: number, agora: number) {
    const g = this.g;
    const t = 6 + (Math.floor(agora / 60) % 3) * 2;
    g.fillStyle = 'rgba(255, 236, 120, 0.4)';
    g.beginPath();
    g.arc(x, y, t * 1.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fffbe0';
    g.strokeStyle = '#7a5a10';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x, y - t * 1.8);
    g.lineTo(x + t * 0.35, y - t * 0.35);
    g.lineTo(x + t * 1.8, y);
    g.lineTo(x + t * 0.35, y + t * 0.35);
    g.lineTo(x, y + t * 1.8);
    g.lineTo(x - t * 0.35, y + t * 0.35);
    g.lineTo(x - t * 1.8, y);
    g.lineTo(x - t * 0.35, y - t * 0.35);
    g.closePath();
    g.stroke();
    g.fill();
  }

  private estrelinhas(x: number, y: number, agora: number) {
    const g = this.g;
    for (let i = 0; i < 3; i++) {
      const ang = agora / 260 + (i * Math.PI * 2) / 3;
      const px = x + Math.cos(ang) * 16;
      const py = y + Math.sin(ang) * 5;
      g.fillStyle = '#ffe070';
      this.estrelaCheia(px, py, 4);
    }
  }

  private estrelaCheia(x: number, y: number, r: number) {
    const g = this.g;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    g.closePath();
    g.fill();
  }

  private efeitosNaTela(agora: number) {
    const g = this.g;
    this.efeitos = this.efeitos.filter((e) => agora - e.em < 220);
    for (const e of this.efeitos) {
      const k = (agora - e.em) / 220;
      if (e.tipo === 'faisca') {
        g.strokeStyle = `rgba(230,230,240,${1 - k})`;
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const ang = (i * Math.PI) / 2 + 0.6;
          g.beginPath();
          g.moveTo(e.x + Math.cos(ang) * 4, e.y + Math.sin(ang) * 4);
          g.lineTo(e.x + Math.cos(ang) * (8 + k * 6), e.y + Math.sin(ang) * (8 + k * 6));
          g.stroke();
        }
      } else {
        const r = (e.tipo === 'estrela' ? 22 : 12) * (0.6 + k * 0.6);
        g.fillStyle = e.tipo === 'estrela' ? `rgba(255,224,90,${1 - k})` : `rgba(255,246,200,${1 - k})`;
        this.estrelaCheia(e.x, e.y, r);
      }
    }
  }

  // ------------------------------------------------------------------ o coelho de costas
  private coelho(l: Luta, agora: number) {
    const g = this.g;
    const j = l.j;
    let dx = 0;
    let dy = 0;
    if (j.estado === 'esquiva') {
      const k = j.t < 6 ? j.t / 6 : j.t <= LIVRA_ATE ? 1 : Math.max(0, (ESQUIVA - j.t) / (ESQUIVA - LIVRA_ATE));
      dx = j.lado * 60 * k;
      dy = 6 * k;
    } else if (j.estado === 'abaixado') {
      const k = j.t < 5 ? j.t / 5 : j.t <= LIVRA_ATE ? 1 : Math.max(0, (30 - j.t) / 4);
      dy = 26 * k;
    } else if (j.estado === 'atingido') {
      dy = 6 * Math.max(0, 1 - j.t / ATINGIDO);
    } else if (j.estado === 'caido') {
      dy = Math.min(70, j.t * 4 + 70);
    }
    if (l.queda === 'jogador') dy = 70;
    const cx = MEIO + dx;
    const base = ALTURA + 26 + dy;
    g.save();
    g.globalAlpha = 0.86;
    // o corpo: a roupa de costas (os ombros), a cabeça e as orelhas
    const roupa = cor(this.roupa);
    const pelo = cor(this.pelo);
    const peloEscuro = cor(this.pelo, 0.82);
    g.fillStyle = roupa;
    g.beginPath();
    g.moveTo(cx - 54, base);
    g.quadraticCurveTo(cx - 52, base - 44, cx - 26, base - 50);
    g.lineTo(cx + 26, base - 50);
    g.quadraticCurveTo(cx + 52, base - 44, cx + 54, base);
    g.fill();
    // o capuz
    g.fillStyle = cor(this.roupa, 0.8);
    g.beginPath();
    g.ellipse(cx, base - 48, 22, 8, 0, 0, Math.PI * 2);
    g.fill();
    // as orelhas (balançam um pouco quando ele esquiva)
    const inclina = j.estado === 'esquiva' ? -j.lado * 0.25 : 0;
    for (const lado of [-1, 1]) {
      g.save();
      g.translate(cx + lado * 10, base - 80);
      g.rotate(lado * 0.12 + inclina);
      g.fillStyle = peloEscuro;
      g.beginPath();
      g.ellipse(0, -13, 7, 15, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = pelo;
      g.beginPath();
      g.ellipse(0, -13, 5, 12, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // a cabeça, de costas
    g.fillStyle = peloEscuro;
    g.beginPath();
    g.arc(cx, base - 66, 21, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = pelo;
    g.beginPath();
    g.arc(cx - 1, base - 67, 19, 0, Math.PI * 2);
    g.fill();
    g.restore();
    if (l.queda === 'jogador') {
      this.estrelinhas(MEIO, 168, agora);
      return;
    }
    this.luvasDoCoelho(l, cx, base);
  }

  private luvasDoCoelho(l: Luta, cx: number, base: number) {
    const j = l.j;
    const creme = '#efe6d6';
    let e: [number, number, number] = [cx - 38, base - 58, 13];
    let d: [number, number, number] = [cx + 38, base - 58, 13];
    if (j.estado === 'guarda') {
      e = [cx - 16, base - 82, 15];
      d = [cx + 16, base - 82, 15];
    } else if (j.estado === 'socando') {
      // vai até o adversário (menor, de longe) e volta
      const k = j.t <= IMPACTO_DO_SOCO ? j.t / IMPACTO_DO_SOCO : Math.max(0, (SOCO - j.t) / (SOCO - IMPACTO_DO_SOCO));
      const alvo: [number, number] = [MEIO + j.lado * 22, 106];
      const p: [number, number, number] = [(j.lado < 0 ? e[0] : d[0]) + (alvo[0] - (j.lado < 0 ? e[0] : d[0])) * k, base - 58 + (alvo[1] - (base - 58)) * k, 13 - 5 * k];
      if (j.lado < 0) e = p;
      else d = p;
    } else if (j.estado === 'forte') {
      // o soco forte: recolhe embaixo e sobe por baixo, no meio
      const k = j.t <= IMPACTO_DO_FORTE ? j.t / IMPACTO_DO_FORTE : Math.max(0, (SOCO_FORTE - j.t) / (SOCO_FORTE - IMPACTO_DO_FORTE));
      const puxa = j.t < 8;
      d = puxa ? [cx + 30, base - 30, 14] : [cx + 30 + (MEIO - cx - 30) * k, base - 40 + (80 - base + 40) * k, 14 - 4 * k];
    } else if (j.estado === 'atingido' || j.estado === 'caido') {
      e = [cx - 44, base - 40, 13];
      d = [cx + 44, base - 40, 13];
    }
    this.luva(e[0], e[1], e[2], creme);
    this.luva(d[0], d[1], d[2], creme);
  }

  // ------------------------------------------------------------------ o painel
  private painel(l: Luta, agora: number, dicaDoLevantar: boolean) {
    const g = this.g;
    const A = ADVERSARIOS[l.adv];
    const j = l.j;
    // as barras de vida: a de quem joga à esquerda, a do adversário à direita (com a cor das luvas dele)
    this.barra(8, 8, 120, j.vida / 100, '#7fd06a');
    this.barra(LARGURA - 128, 8, 120, l.a.vida / A.vida, A.luva);
    // o fôlego: as bolinhas embaixo da barra (vazias e piscando quando cansado)
    for (let i = 0; i < FOLEGO; i++) {
      const cheia = i < j.folego && j.cansado === 0;
      g.fillStyle = cheia ? '#f08aa0' : j.cansado > 0 && Math.floor(agora / 200) % 2 ? '#7a4a58' : 'rgba(255,255,255,0.18)';
      g.fillRect(8 + i * 8, 20, 6, 5);
    }
    // as estrelas do soco forte
    for (let i = 0; i < ESTRELAS; i++) {
      g.fillStyle = i < j.estrelas ? '#ffd84a' : 'rgba(255,255,255,0.2)';
      this.estrelaCheia(14 + i * 14, 36, 6);
    }
    // o circuito: um ponto por adversário (os vencidos cheios)
    for (let i = 0; i < ADVERSARIOS.length; i++) {
      g.fillStyle = i < l.vencidas ? '#ffd84a' : i === l.adv ? ADVERSARIOS[i].luva : 'rgba(255,255,255,0.2)';
      g.beginPath();
      g.arc(LARGURA - 14 - (ADVERSARIOS.length - 1 - i) * 12, 26, 4, 0, Math.PI * 2);
      g.fill();
    }
    // o relógio do round e os rounds
    const seg = Math.ceil(((PASSOS_DO_ROUND - l.relogio) / 60) | 0);
    const relogio = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
    g.font = 'bold 13px ui-monospace, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillStyle = 'rgba(15,12,25,0.6)';
    g.fillRect(MEIO - 26, 4, 52, 26);
    g.fillStyle = '#fff6e0';
    g.fillText(relogio, MEIO, 7);
    for (let i = 0; i < ROUNDS; i++) {
      g.fillStyle = i < l.round ? '#fff6e0' : 'rgba(255,255,255,0.25)';
      g.fillRect(MEIO - 14 + i * 10, 23, 7, 3);
    }
    // a contagem de quem caiu, grande no meio
    if (l.queda !== null && l.contagem > 0) {
      g.font = 'bold 42px ui-monospace, monospace';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(15,12,25,0.55)';
      g.fillText(String(l.contagem), MEIO + 2, 72);
      g.fillStyle = '#fff6e0';
      g.fillText(String(l.contagem), MEIO, 70);
    }
    // caído: a barra dos toques para levantar
    if (dicaDoLevantar && l.queda === 'jogador') {
      const precisa = TOQUES_PARA_LEVANTAR[j.quedas - 1] ?? 0;
      if (precisa > 0) this.barra(MEIO - 60, 150, 120, Math.min(1, j.toques / precisa), '#ffd84a');
    }
  }

  private barra(x: number, y: number, w: number, k: number, c: string) {
    const g = this.g;
    g.fillStyle = 'rgba(15,12,25,0.7)';
    g.fillRect(x - 2, y - 2, w + 4, 10);
    g.fillStyle = c;
    g.fillRect(x, y, Math.max(0, Math.round(w * Math.max(0, Math.min(1, k)))), 6);
  }
}
