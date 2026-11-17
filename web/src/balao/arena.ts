import { Chao, HORTA, MUNDO, NEVE, PRAIA, RES, sorteio, type DefinicaoDaPista, type Pista, type Tema } from '../corrida/pista';
import { arenaPorId, centroDa, MARGEM_DO_KART, naParede, type Arena } from './sim';

/**
 * AS ARENAS DO ESTOURA-BALÃO, PINTADAS (05/11/2026). A forma de cada uma está em números em sim.ts (o servidor também a
 * conhece); aqui ela vira o chão que a física da corrida lê (o mesmo `Pista`: o mapa do que é cada ponto e a textura que a
 * câmera deita em perspectiva), com o TEMA da pista de mesmo nome (as cores, a árvore, o céu e os morros).
 *
 * A física do kart conta voltas pela linha do meio; numa arena não há volta, então a "linha do meio" é uma ronda em volta
 * do centro (é por ela que os coelhos do computador passeiam quando não têm a quem seguir), e as voltas nunca acabam.
 */

/** O tema de cada arena (o da pista da corrida de mesmo nome) e as cores do chão de jogar, que não é grama nem areia. */
const VISUAL: Record<string, { tema: Tema; piso: [number, number]; risco: number }> = {
  horta: { tema: HORTA.tema, piso: [rgb(170, 128, 88), rgb(162, 120, 82)], risco: rgb(146, 106, 70) },
  praia: { tema: PRAIA.tema, piso: [rgb(236, 214, 164), rgb(228, 206, 156)], risco: rgb(212, 188, 138) },
  neve: { tema: NEVE.tema, piso: [rgb(214, 222, 236), rgb(206, 214, 230)], risco: rgb(186, 196, 216) },
};

function rgb(r: number, g: number, b: number) {
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

export const temaDaArena = (id: string): Tema => (VISUAL[id] ?? VISUAL.horta).tema;

/** Uma figura de pé em cima de um obstáculo (o desenho de render.ts ou o de balao/render.ts) e o tamanho. */
export interface Enfeite {
  x: number;
  y: number;
  figura: string;
  tamanho: number;
}

/**
 * Um obstáculo DE PÉ (06/11/2026): o contorno no chão, em pedaços curtos (cada pedaço é uma figura, para os karts entrarem na
 * frente e atrás dele na ordem certa), a altura e as cores. Com tampa é um bloco cheio (a pedra, o fardo, o caixote); sem
 * tampa, uma mureta (a beira do lago, o canteiro, a cerca), que se vê dos dois lados.
 */
export interface Solido {
  pedacos: PedacoDeSolido[];
  /** O meio do contorno (a ponta dos triângulos da tampa). */
  cx: number;
  cy: number;
  altura: number;
  tampa: boolean;
  cores: CoresDoSolido;
}

export interface PedacoDeSolido {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Para fora do sólido (a face que se vê de fora). */
  nx: number;
  ny: number;
  /** A face de fora e a de dentro, já com a luz (que vem do noroeste). */
  fora: string;
  dentro: string;
  /** Começa num canto do contorno (o desenho marca a aresta de pé). */
  canto: boolean;
}

interface CoresDoSolido {
  face: [number, number, number];
  topo: string;
  linha: string;
  /** O que se risca na face: as cordas do fardo (de pé, a cada pedaço), a tábua do caixote e o travessão da cerca (deitados). */
  risco?: { cor: string; tipo: 'pe' | 'deitado' };
}

export interface ArenaPintada extends Pista {
  arena: Arena;
  enfeites: Enfeite[];
  solidos: Solido[];
}

/** Um ponto de uma figura (de render.ts) mede isto no mundo, com tamanho 1: a lente da câmera (ATRAS / FOCO). */
const PIXEL_DA_FIGURA = 38 / 172;

const SOLIDO: Record<'pedra' | 'feno' | 'caixote' | 'margem' | 'canteiro' | 'cerca', CoresDoSolido> = {
  pedra: { face: [150, 142, 138], topo: '#c4bcb6', linha: '#2a2428' },
  feno: { face: [222, 184, 92], topo: '#f0d48a', linha: '#4a3018', risco: { cor: '#96603a', tipo: 'pe' } },
  caixote: { face: [176, 124, 70], topo: '#cfa068', linha: '#2a1a14', risco: { cor: '#6e4626', tipo: 'deitado' } },
  margem: { face: [196, 182, 140], topo: '#e0d4ac', linha: '#5a5040' },
  canteiro: { face: [150, 98, 56], topo: '#c08a52', linha: '#3a2414' },
  cerca: { face: [196, 150, 98], topo: '#e0bc88', linha: '#3a2618', risco: { cor: '#7a5434', tipo: 'deitado' } },
};

/** A luz vem do noroeste (de cima e da esquerda no mapa): a face virada para ela é a clara. */
const LUZ = [-0.6, -0.8];
const sombreado = (c: [number, number, number], nx: number, ny: number) => {
  const f = 0.6 + 0.4 * Math.max(0, nx * LUZ[0] + ny * LUZ[1]);
  return `rgb(${Math.round(c[0] * f)}, ${Math.round(c[1] * f)}, ${Math.round(c[2] * f)})`;
};

/** Um contorno redondo de `lados` lados. */
function circulo(cx: number, cy: number, r: number, lados: number): [number, number][] {
  return Array.from({ length: lados }, (_, i) => [cx + Math.cos((i / lados) * Math.PI * 2) * r, cy + Math.sin((i / lados) * Math.PI * 2) * r]);
}

/** O sólido de um contorno (convexo, em qualquer sentido), cortado em pedaços de no máximo `passo`. */
function solido(contorno: [number, number][], altura: number, tampa: boolean, cores: CoresDoSolido, passo = 10): Solido {
  const cx = contorno.reduce((s, p) => s + p[0], 0) / contorno.length;
  const cy = contorno.reduce((s, p) => s + p[1], 0) / contorno.length;
  const pedacos: PedacoDeSolido[] = [];
  for (let i = 0; i < contorno.length; i++) {
    const [ax, ay] = contorno[i], [bx, by] = contorno[(i + 1) % contorno.length];
    const len = Math.hypot(bx - ax, by - ay);
    let nx = (by - ay) / len, ny = -(bx - ax) / len;
    // para fora: o lado oposto ao meio
    if (nx * ((ax + bx) / 2 - cx) + ny * ((ay + by) / 2 - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const n = Math.max(1, Math.ceil(len / passo));
    for (let j = 0; j < n; j++) {
      pedacos.push({
        ax: ax + ((bx - ax) * j) / n,
        ay: ay + ((by - ay) * j) / n,
        bx: ax + ((bx - ax) * (j + 1)) / n,
        by: ay + ((by - ay) * (j + 1)) / n,
        nx,
        ny,
        fora: sombreado(cores.face, nx, ny),
        dentro: sombreado(cores.face, -nx, -ny),
        canto: j === 0 && contorno.length <= 8,
      });
    }
  }
  return { pedacos, cx, cy, altura, tampa, cores };
}

/** A sombra no chão: a cor mais escura. */
function escurecer(cor: number) {
  const f = 0.7;
  const r = cor & 0xff, g = (cor >> 8) & 0xff, b = (cor >> 16) & 0xff;
  return rgb(Math.round(r * f), Math.round(g * f), Math.round(b * f));
}

const K = RES / MUNDO;

const COR = {
  agua: [rgb(70, 128, 168), rgb(84, 144, 182)],
  aguaBorda: rgb(196, 182, 140),
  pedra: [rgb(140, 132, 128), rgb(122, 114, 112)],
  terra: [rgb(150, 104, 66), rgb(138, 94, 58)],
  sulco: rgb(112, 76, 48),
  feno: [rgb(226, 190, 96), rgb(206, 168, 78)],
  fenoCorda: rgb(150, 96, 52),
  caixote: [rgb(184, 132, 76), rgb(160, 112, 62)],
  caixoteBorda: rgb(96, 64, 40),
  gelo: [rgb(176, 214, 236), rgb(166, 204, 228)],
  geloRisco: rgb(236, 248, 255),
  turbo: rgb(244, 176, 60),
  turboFundo: rgb(150, 70, 40),
  zebraA: rgb(196, 70, 62),
  zebraB: rgb(232, 226, 210),
  flor: [rgb(236, 120, 150), rgb(246, 214, 96), rgb(236, 236, 230), rgb(186, 140, 220)],
  trilha: [rgb(196, 162, 112), rgb(184, 150, 102)],
};

/** Um ruído suave de 0 a 1 (a média de quatro cantos de uma grade de `lado`), para o piso e a grama não serem xadrez. */
function ruidoSuave(x: number, y: number, lado: number, semente: number) {
  const h = (i: number, j: number) => {
    let v = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(semente, 2246822519);
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };
  const gx = x / lado, gy = y / lado;
  const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j;
  const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = h(i, j) + (h(i + 1, j) - h(i, j)) * su;
  const b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * su;
  return a + (b - a) * sv;
}

/** Mistura duas cores (do formato da textura) em `t` (0 a 1). */
function misturar(c1: number, c2: number, t: number) {
  const r = Math.round((c1 & 0xff) + ((c2 & 0xff) - (c1 & 0xff)) * t);
  const g = Math.round(((c1 >> 8) & 0xff) + (((c2 >> 8) & 0xff) - ((c1 >> 8) & 0xff)) * t);
  const b = Math.round(((c1 >> 16) & 0xff) + (((c2 >> 16) & 0xff) - ((c1 >> 16) & 0xff)) * t);
  return rgb(r, g, b);
}

let guardada: ArenaPintada | null = null;

/** A arena pintada (uns 300 ms e ~24 MB): fica guardada SÓ A ÚLTIMA, como a pista da corrida. */
export function arenaPintada(id: string): ArenaPintada {
  if (guardada?.arena.id !== id) guardada = montarArena(arenaPorId(id));
  return guardada;
}

export function montarArena(a: Arena): ArenaPintada {
  const visual = VISUAL[a.id] ?? VISUAL.horta;
  const T = visual.tema;
  const [cx, cy] = centroDa(a);
  // a ronda: um círculo em volta do centro, por onde a física conta "voltas" que nunca acabam
  const raioDaRonda = a.circulo ? a.circulo[2] * 0.62 : Math.min(a.retangulo![2] - a.retangulo![0], a.retangulo![3] - a.retangulo![1]) * 0.32;
  const N = 96;
  const lx = new Float32Array(N), ly = new Float32Array(N), la = new Float32Array(N + 1);
  for (let i = 0; i < N; i++) {
    lx[i] = cx + Math.cos((i / N) * Math.PI * 2) * raioDaRonda;
    ly[i] = cy + Math.sin((i / N) * Math.PI * 2) * raioDaRonda;
  }
  for (let i = 0; i < N; i++) la[i + 1] = la[i] + Math.hypot(lx[(i + 1) % N] - lx[i], ly[(i + 1) % N] - ly[i]);
  const def: DefinicaoDaPista = { ...HORTA, id: `balao-${a.id}`, voltas: 1e9, turbos: [], lagos: [], caixas: [], tema: T };

  const chao = new Uint8Array(RES * RES);
  const textura = new Uint32Array(RES * RES);
  const sorte = sorteio(a.id.length * 131 + 7);
  /** A distância até a borda (para a zebra e a sombra dela), positiva dentro. */
  const ateABorda = (x: number, y: number) => {
    if (a.circulo) return a.circulo[2] - Math.hypot(x - a.circulo[0], y - a.circulo[1]);
    const [x0, y0, x1, y1] = a.retangulo!;
    return Math.min(x - x0, x1 - x, y - y0, y1 - y);
  };
  for (let ty = 0; ty < RES; ty++) {
    const y = (ty + 0.5) / K;
    for (let tx = 0; tx < RES; tx++) {
      const x = (tx + 0.5) / K;
      const k = ty * RES + tx;
      const ruido = (tx * 73856093) ^ (ty * 19349663);
      const borda = ateABorda(x, y);
      let tipo: Chao, cor: number;
      if (borda < 0) {
        // fora da arena: o gramado (ou a areia) do tema, e a cerca logo depois da borda
        tipo = Chao.Parede;
        if (borda > -6) cor = T.cerca[(((tx >> 3) + (ty >> 3)) & 1)];
        else if (borda > -26 && borda < -12) {
          // A TRILHA em volta da cerca (16/11/2026, "o cenário é simples demais"): terra batida, com as bordas comidas
          const beira = Math.min(borda + 26, -12 - borda);
          cor = beira < 1.5 + ruidoSuave(x, y, 6, 3) * 2 ? T.gramaEscura : COR.trilha[ruidoSuave(x, y, 9, 4) > 0.55 ? 1 : 0];
          if (((ruido >>> 5) & 0x3f) === 0) cor = T.gramaPonto;
        } else {
          // a grama em faixas de cortador, com manchas mais escuras e mais claras (o ruído), e os pontinhos
          const faixa = T.grama[Math.floor((x + y * 0.6) / 28) & 1];
          const mancha = ruidoSuave(x, y, 40, 1);
          cor = mancha < 0.3 ? misturar(faixa, T.gramaEscura, 0.45) : mancha > 0.78 ? misturar(faixa, T.gramaPonto, 0.25) : faixa;
          if (((ruido >>> 4) & 0x3f) === 0) cor = T.gramaPonto;
        }
      } else if (borda < MARGEM_DO_KART + 5) {
        // a zebra ao pé da cerca; a faixa da margem, encostada nela, é parede, na sombra da cerca
        tipo = borda < MARGEM_DO_KART ? Chao.Parede : Chao.Zebra;
        const s = a.circulo ? Math.atan2(y - a.circulo[1], x - a.circulo[0]) * a.circulo[2] : x + y;
        cor = Math.floor(s / 9) % 2 === 0 ? COR.zebraA : COR.zebraB;
        if (tipo === Chao.Parede) cor = escurecer(cor);
      } else {
        tipo = Chao.Asfalto;
        // O PISO DE JOGAR (16/11/2026): era um xadrez de duas cores; agora a terra (a areia, a neve batida) é manchada pelo
        // ruído, com as marcas de pneu em volta do centro e as pedrinhas. Só a cor: o chão continua o mesmo para o kart.
        const m = ruidoSuave(x, y, 34, 2) * 0.7 + ruidoSuave(x, y, 9, 5) * 0.3;
        cor = misturar(visual.piso[0], visual.piso[1], m);
        if (m < 0.28) cor = misturar(cor, visual.risco, 0.5);
        const rc = Math.hypot(x - cx, y - cy);
        // as marcas de pneu: anéis finos e interrompidos, por onde os karts rodam
        if ((Math.abs(rc - 150) < 1.2 || Math.abs(rc - 158) < 1.2 || Math.abs(rc - 232) < 1.2) && ruidoSuave(x, y, 22, 6) > 0.4) cor = misturar(cor, visual.risco, 0.8);
        if (((ruido >>> 6) & 0x7f) === 0) cor = visual.risco;
        else if (((ruido >>> 9) & 0xff) === 1) cor = misturar(visual.piso[0], rgb(250, 248, 240), 0.5);
      }
      chao[k] = tipo;
      textura[k] = cor;
    }
  }

  // AS MANCHAS: a grama que segura, o gelo que escorrega e as placas de turbo (só no piso, nunca na parede)
  for (const [mx, my, r, qual] of a.manchas) {
    pintarCirculo(chao, textura, mx, my, r, (d, tx, ty) => {
      const k = ty * RES + tx;
      if (chao[k] !== Chao.Asfalto) return null;
      if (qual === 'grama') return [Chao.Grama, d > r - 2 ? T.gramaEscura : T.grama[((tx >> 3) + (ty >> 3)) & 1]];
      if (qual === 'gelo') return [Chao.Gelo, ((tx * 7 + ty * 3) & 31) === 0 ? COR.geloRisco : COR.gelo[((tx >> 3) + (ty >> 4)) & 1]];
      // o turbo: anéis claros e escuros, com a borda escura
      return [Chao.Turbo, d > r - 2 || Math.floor(d / 3) % 2 ? COR.turboFundo : COR.turbo];
    });
  }

  // OS OBSTÁCULOS (refeitos em 06/11/2026: "os elementos no cenário não ficaram claros, são várias áreas que não podem ser
  // ultrapassadas"). Cada um é parede no chão para a física, com o desenho dele, e um SÓLIDO de pé (render.ts levanta as
  // faces em perspectiva): a pedra, o fardo e o caixote são blocos com tampa; o lago e o canteiro têm uma mureta em volta; a
  // arena tem a cerca. Em volta de cada um, a faixa de MARGEM_DO_KART é parede também, pintada como a sombra dele: o centro
  // do kart para ali, e o desenho do kart encosta no do obstáculo. A árvore é a figura de pé, com a copa da largura da
  // sombra (e do que bloqueia).
  const enfeites: Enfeite[] = [];
  const solidos: Solido[] = [];
  const M = MARGEM_DO_KART;
  for (const [ox, oy, r, qual] of a.circulos) {
    pintarCirculo(chao, textura, ox, oy, r + M, (d, tx, ty) => {
      const k = ty * RES + tx;
      if (d > r) return [Chao.Parede, chao[k] === Chao.Parede ? textura[k] : escurecer(textura[k])];
      if (qual === 'agua') return [Chao.Parede, d > r - 3 ? COR.aguaBorda : COR.agua[((tx >> 2) + (ty >> 4)) & 1]];
      if (qual === 'canteiro') return [Chao.Parede, d > r - 3 ? COR.caixoteBorda : (ty >> 2) % 2 ? COR.sulco : COR.terra[tx & 1]];
      if (qual === 'pedra') return [Chao.Parede, COR.pedra[((tx >> 2) + (ty >> 2)) & 1]];
      // a árvore: a sombra da copa no chão, e a figura de pé
      return [Chao.Parede, T.gramaEscura];
    });
    if (qual === 'arvore') enfeites.push({ x: ox, y: oy, figura: T.arvore, tamanho: (2 * r) / (20 * PIXEL_DA_FIGURA) });
    if (qual === 'pedra') solidos.push(solido(circulo(ox, oy, r, 14), Math.min(14, Math.round(r * 0.75)), true, SOLIDO.pedra));
    if (qual === 'agua') solidos.push(solido(circulo(ox, oy, r, 24), 3, false, SOLIDO.margem));
    if (qual === 'canteiro') {
      solidos.push(solido(circulo(ox, oy, r, 24), 6, false, SOLIDO.canteiro));
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2 + sorte();
        const rr = r * (0.2 + 0.5 * sorte());
        enfeites.push({ x: ox + Math.cos(ang) * rr, y: oy + Math.sin(ang) * rr, figura: 'cenoura', tamanho: 1.1 });
      }
    }
  }
  for (const [x0, y0, x1, y1, qual] of a.muros) {
    for (let ty = Math.floor((y0 - M) * K); ty < Math.ceil((y1 + M) * K); ty++) {
      for (let tx = Math.floor((x0 - M) * K); tx < Math.ceil((x1 + M) * K); tx++) {
        const k = ty * RES + tx;
        const x = (tx + 0.5) / K, y = (ty + 0.5) / K;
        if (x <= x0 - M || x >= x1 + M || y <= y0 - M || y >= y1 + M) continue;
        if (x <= x0 || x >= x1 || y <= y0 || y >= y1) {
          // a sombra (só uma vez onde duas se cruzam)
          if (chao[k] !== Chao.Parede) textura[k] = escurecer(textura[k]);
          chao[k] = Chao.Parede;
          continue;
        }
        const bx = x - x0, by = y - y0;
        const naBorda = bx < 1.5 || by < 1.5 || x1 - x < 1.5 || y1 - y < 1.5;
        chao[k] = Chao.Parede;
        textura[k] =
          qual === 'feno'
            ? naBorda || Math.abs(bx - (x1 - x0) / 3) < 1 || Math.abs(bx - (2 * (x1 - x0)) / 3) < 1
              ? COR.fenoCorda
              : COR.feno[(ty >> 1) & 1]
            : naBorda || Math.abs(bx - by) < 1.2 || Math.abs(bx + by - (x1 - x0)) < 1.2
              ? COR.caixoteBorda
              : COR.caixote[(tx >> 3) & 1];
      }
    }
    const contorno: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    solidos.push(qual === 'feno' ? solido(contorno, 9, true, SOLIDO.feno) : solido(contorno, 12, true, SOLIDO.caixote));
  }
  // A CERCA de fora, de pé, em cima da borda (a parede é o chão de fora e a faixa da margem)
  if (a.circulo) solidos.push(solido(circulo(a.circulo[0], a.circulo[1], a.circulo[2], 96), 6, false, SOLIDO.cerca, 20));
  else {
    const [x0, y0, x1, y1] = a.retangulo!;
    solidos.push(solido([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 6, false, SOLIDO.cerca, 20));
  }
  // O LADO DE FORA (16/11/2026, relato dele: "o cenário é simples demais"), no jeito das pistas da corrida: as árvores em
  // volta (mais perto e mais juntas que antes, de tamanhos diferentes, com a sombra), os canteiros de cenoura e as flores
  // (onde o tema tem grama: na praia e na neve, só as árvores do tema). Tudo fora da cerca: dentro, nada de pé que não bloqueie.
  const comFlores = !T.areia && T.arvore !== 'pinheiro-neve';
  const ocupado = (x: number, y: number, d: number) => enfeites.some((e) => Math.hypot(e.x - x, e.y - y) < d);
  for (let i = 0, tent = 0; i < 130 && tent < 6000; tent++) {
    const x = 30 + sorte() * (MUNDO - 60), y = 30 + sorte() * (MUNDO - 60);
    const b = ateABorda(x, y);
    // a primeira fileira logo depois da trilha, as outras mais soltas até o horizonte
    if (b > -34 || ocupado(x, y, b > -90 ? 20 : 30)) continue;
    // as da primeira fileira, grandes: de dentro da arena, são elas que aparecem por cima da cerca
    const tamanho = b > -90 ? 3.4 + sorte() * 1.3 : 2.2 + sorte() * 1.1;
    enfeites.push({ x, y, figura: T.arvore, tamanho });
    pintarCirculo(chao, textura, x + 4, y + 3, 7 + tamanho * 2, (_d, tx, ty) => [chao[ty * RES + tx] as Chao, escurecer(textura[ty * RES + tx])]);
    i++;
  }
  for (let i = 0, tent = 0; i < 46 && tent < 4000; tent++) {
    const x = 30 + sorte() * (MUNDO - 60), y = 30 + sorte() * (MUNDO - 60);
    const b = ateABorda(x, y);
    if (b > -30 || b < -160 || ocupado(x, y, 16)) continue;
    if (comFlores && T.canteiros && i % 3 === 0) {
      // um canteiro: a terra com sulcos e três cenouras
      pintarCirculo(chao, textura, x, y, 9, (d, tx, ty) => [Chao.Parede, d > 8 ? COR.caixoteBorda : (ty >> 2) % 2 ? COR.sulco : COR.terra[tx & 1]]);
      for (let c = -1; c <= 1; c++) enfeites.push({ x: x + c * 5, y: y + (c & 1) * 2, figura: 'cenoura', tamanho: 1 });
    } else if (comFlores) {
      // uma moita de flores: os pontinhos coloridos no chão e a figura de pé
      const cor = COR.flor[Math.floor(sorte() * COR.flor.length)];
      for (let f = 0; f < 14; f++) {
        const fx = Math.floor((x + (sorte() - 0.5) * 22) * K), fy = Math.floor((y + (sorte() - 0.5) * 22) * K);
        if (fx > 0 && fy > 0 && fx < RES - 1 && fy < RES - 1) textura[fy * RES + fx] = textura[fy * RES + fx + 1] = cor;
      }
      enfeites.push({ x, y, figura: 'flor', tamanho: 1.3 });
    } else {
      // na praia e na neve: uma árvore pequena a mais
      enfeites.push({ x, y, figura: T.arvore, tamanho: 1.5 + sorte() * 0.6 });
    }
    i++;
  }

  const l0 = largadaDa(a, 0);
  return {
    def,
    arena: a,
    lx,
    ly,
    la,
    comprimento: la[N],
    chao,
    textura,
    objetos: [],
    enfeites,
    solidos,
    largada: l0,
  };
}

function pintarCirculo(
  chao: Uint8Array,
  textura: Uint32Array,
  cx: number,
  cy: number,
  r: number,
  f: (d: number, tx: number, ty: number) => [Chao, number] | null,
) {
  for (let ty = Math.max(0, Math.floor((cy - r) * K)); ty <= Math.min(RES - 1, Math.ceil((cy + r) * K)); ty++) {
    for (let tx = Math.max(0, Math.floor((cx - r) * K)); tx <= Math.min(RES - 1, Math.ceil((cx + r) * K)); tx++) {
      const d = Math.hypot((tx + 0.5) / K - cx, (ty + 0.5) / K - cy);
      if (d > r) continue;
      const v = f(d, tx, ty);
      if (!v) continue;
      chao[ty * RES + tx] = v[0];
      textura[ty * RES + tx] = v[1];
    }
  }
}

/**
 * A largada `i`: x, y e o ângulo. A direção é para o centro, MAS LIVRE (16/11/2026, a auditoria): na Horta, as largadas dos
 * cantos olhavam bem para a árvore do canto, e quem segurava ↑ na largada (e o piloto automático) ficava empacado nela.
 * Olhando do centro para os lados, de 15 em 15°, vale a primeira direção com uns 90 de chão livre à frente. Só a tela e a
 * física deste computador leem o ângulo: o servidor confere a posição, não para onde o kart aponta.
 */
export function largadaDa(a: Arena, i: number): { x: number; y: number; angulo: number } {
  const [x, y] = a.largadas[i % a.largadas.length];
  const [cx, cy] = centroDa(a);
  const centro = Math.atan2(cy - y, cx - x);
  const passo = Math.PI / 12;
  for (let k = 0; k <= 6; k++) {
    for (const lado of k === 0 ? [0] : [1, -1]) {
      const ang = centro + lado * k * passo;
      const fx = Math.cos(ang), fy = Math.sin(ang);
      let livreAFrente = true;
      for (let d = 6; d <= 90 && livreAFrente; d += 4) livreAFrente = livre(a, x + fx * d, y + fy * d);
      if (livreAFrente) return { x, y, angulo: ang };
    }
  }
  return { x, y, angulo: centro };
}

/** O ponto é livre para o kart (para os testes e os robôs): fora das paredes e da margem do kart. */
export const livre = (a: Arena, x: number, y: number) => !naParede(a, x, y, -MARGEM_DO_KART - 1);
