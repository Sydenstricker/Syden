import { Chao, HORTA, MUNDO, NEVE, PRAIA, RES, sorteio, type DefinicaoDaPista, type Pista, type Tema } from '../corrida/pista';
import { arenaPorId, centroDa, naParede, type Arena } from './sim';

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

export interface ArenaPintada extends Pista {
  arena: Arena;
  enfeites: Enfeite[];
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
};

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
        else {
          cor = T.grama[Math.floor((x + y * 0.6) / 28) & 1];
          if (((ruido >>> 4) & 0x3f) === 0) cor = T.gramaPonto;
        }
      } else if (borda < 5) {
        tipo = Chao.Zebra;
        const s = a.circulo ? Math.atan2(y - a.circulo[1], x - a.circulo[0]) * a.circulo[2] : x + y;
        cor = Math.floor(s / 9) % 2 === 0 ? COR.zebraA : COR.zebraB;
      } else {
        tipo = Chao.Asfalto;
        // o piso de jogar: em placas grandes, com os riscos das rodas
        cor = visual.piso[(Math.floor(x / 48) + Math.floor(y / 48)) & 1];
        if (((ruido >>> 6) & 0x7f) === 0) cor = visual.risco;
        if (borda < 9) cor = T.gramaEscura;
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

  // OS OBSTÁCULOS: paredes para o kart (a física bate nelas), com o desenho de cada um no chão; o que fica de pé por cima
  // (a árvore, a pedra, as cenouras do canteiro) é um enfeite, desenhado como figura
  const enfeites: Enfeite[] = [];
  for (const [ox, oy, r, qual] of a.circulos) {
    pintarCirculo(chao, textura, ox, oy, r, (d, tx, ty) => {
      if (qual === 'agua') return [Chao.Parede, d > r - 3 ? COR.aguaBorda : COR.agua[((tx >> 2) + (ty >> 4)) & 1]];
      if (qual === 'canteiro') return [Chao.Parede, d > r - 3 ? COR.caixoteBorda : (ty >> 2) % 2 ? COR.sulco : COR.terra[tx & 1]];
      if (qual === 'pedra') return [Chao.Parede, COR.pedra[((tx >> 2) + (ty >> 2)) & 1]];
      // a árvore: a sombra da copa no chão, e a figura de pé
      return [Chao.Parede, T.gramaEscura];
    });
    if (qual === 'arvore') enfeites.push({ x: ox, y: oy, figura: T.arvore, tamanho: 2.6 });
    if (qual === 'pedra') enfeites.push({ x: ox, y: oy + r * 0.4, figura: 'pedra', tamanho: r / 7 });
    if (qual === 'canteiro') {
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2 + sorte();
        const rr = r * (0.25 + 0.5 * sorte());
        enfeites.push({ x: ox + Math.cos(ang) * rr, y: oy + Math.sin(ang) * rr, figura: 'cenoura', tamanho: 1.1 });
      }
    }
  }
  for (const [x0, y0, x1, y1, qual] of a.muros) {
    for (let ty = Math.floor(y0 * K); ty < Math.ceil(y1 * K); ty++) {
      for (let tx = Math.floor(x0 * K); tx < Math.ceil(x1 * K); tx++) {
        const k = ty * RES + tx;
        const bx = tx / K - x0, by = ty / K - y0;
        const naBorda = bx < 1.5 || by < 1.5 || x1 - tx / K < 1.5 || y1 - ty / K < 1.5;
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
    // o muro de pé: um bloco de figuras ao longo do lado de cima, para ele ter altura na câmera
    const fig = qual === 'feno' ? 'feno' : 'caixote';
    const passos = Math.max(1, Math.round((x1 - x0) / 14));
    for (let i = 0; i < passos; i++) {
      for (let jj = 0; jj < Math.max(1, Math.round((y1 - y0) / 14)); jj++) {
        enfeites.push({ x: x0 + ((i + 0.5) * (x1 - x0)) / passos, y: y0 + (jj + 0.9) * 14, figura: fig, tamanho: 1.15 });
      }
    }
  }
  // a cerca de fora, de pé: postes em volta da borda (só o desenho; a parede é o chão)
  const postes: Enfeite[] = [];
  if (a.circulo) {
    const [ccx, ccy, r] = a.circulo;
    const n = Math.round((2 * Math.PI * r) / 40);
    for (let i = 0; i < n; i++) postes.push({ x: ccx + Math.cos((i / n) * Math.PI * 2) * (r + 3), y: ccy + Math.sin((i / n) * Math.PI * 2) * (r + 3), figura: 'poste', tamanho: 1 });
  } else {
    const [x0, y0, x1, y1] = a.retangulo!;
    for (let x = x0; x <= x1; x += 40) postes.push({ x, y: y0 - 3, figura: 'poste', tamanho: 1 }, { x, y: y1 + 3, figura: 'poste', tamanho: 1 });
    for (let y = y0 + 40; y < y1; y += 40) postes.push({ x: x0 - 3, y, figura: 'poste', tamanho: 1 }, { x: x1 + 3, y, figura: 'poste', tamanho: 1 });
  }
  enfeites.push(...postes);
  // e as árvores de fora da arena, longe da cerca, para o horizonte não ficar vazio
  for (let i = 0, tent = 0; i < 70 && tent < 3000; tent++) {
    const x = 30 + sorte() * (MUNDO - 60), y = 30 + sorte() * (MUNDO - 60);
    if (ateABorda(x, y) > -24) continue;
    if (enfeites.some((e) => Math.hypot(e.x - x, e.y - y) < 30)) continue;
    enfeites.push({ x, y, figura: T.arvore, tamanho: 2.6 });
    i++;
  }

  const [lx0, ly0] = a.largadas[0];
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
    largada: { x: lx0, y: ly0, angulo: Math.atan2(cy - ly0, cx - lx0) },
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

/** A largada `i` (a direção é para o centro): x, y e o ângulo. */
export function largadaDa(a: Arena, i: number): { x: number; y: number; angulo: number } {
  const [x, y] = a.largadas[i % a.largadas.length];
  const [cx, cy] = centroDa(a);
  return { x, y, angulo: Math.atan2(cy - y, cx - x) };
}

/** O ponto é livre para o kart (para os testes e os robôs). */
export const livre = (a: Arena, x: number, y: number) => !naParede(a, x, y, -1);
