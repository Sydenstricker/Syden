/**
 * COLHEITA EM DUPLA (lote 5, 05/11/2026; a mecânica do "um colhe na árvore e joga, o parceiro apanha com a cesta", 2 contra 2,
 * classe C do levantamento em docs/mario-party-3.md): cada dupla tem a SUA árvore de morangos (as mesmas frutas, na mesma hora,
 * para todas as duplas). Quem está no galho anda até o morango maduro e o solta; quem está embaixo corre com a cesta para
 * apanhar. Ganha a dupla que apanhar mais (o dourado vale 2). Na dupla de um só, a árvore solta os morangos sozinha.
 *
 * A REDE: o contato é só DENTRO da dupla, e as duplas não se tocam. O servidor é o dono dos morangos: soltar é um pedido (vale
 * se quem pede está perto do morango, pela posição que o servidor conhece), e o morango cai num tempo fixo (QUEDA_MS), igual em
 * todas as telas. Apanhar, QUEM APANHA DECIDE (como o kart: quem leva decide se foi atingido): a tela de quem tem a cesta diz
 * "peguei" quando o morango chega à cesta NELA; o servidor confere a hora (a queda acabou, com a rede da pessoa) e se a cesta,
 * pelo que ele sabe, estava embaixo. A queda é longa o bastante para quem apanha ver o morango sair com 200 ms de rede.
 */
import { inteiro, invalido, microjogo, numero, type Conferencia, type PassoAoVivo, type Resultado, type Turma } from './comum.js';

export const COLHEITA_MS = 25000;
/** Do galho à cesta. */
export const QUEDA_MS = 1300;
/** O galho e o chão vão de MIN_X a MAX_X. */
export const MIN_X = 20;
export const MAX_X = 280;
export const VEL_GALHO = 130;
export const VEL_CESTA = 150;
/** Quão perto do morango (pelo servidor) dá para soltar, e quão perto a cesta tem de estar para apanhar. */
export const ALCANCE_GALHO = 24;
export const ALCANCE_CESTA = 30;
/** O morango maduro que ninguém colhe cai sozinho depois disto (e se perde, se ninguém apanhar). */
export const MADURO_MS = 4000;
/** Entre um soltar e outro. */
const ESPERA_SOLTAR = 350;

export interface Morango {
  /** Quando amadurece (ms desde o começo). */
  t: number;
  x: number;
  ouro: boolean;
}
export interface DadosColheita {
  morangos: Morango[];
  /** Quem está no galho e quem está com a cesta, em cada dupla (o galho null: a árvore solta sozinha). */
  papeis: { galho: number | null; cesta: number }[];
}

interface Queda {
  /** O morango (o índice em `morangos`). */
  i: number;
  equipe: number;
  x: number;
  /** Quando saiu do galho (ms desde o começo). */
  t: number;
  /** 0 caindo, 1 apanhado, 2 perdido. */
  estado: 0 | 1 | 2;
}
interface Pessoa {
  x: number;
  credito: number;
  em: number;
  /** O robô: o próximo instante em que reage. */
  pensaEm: number;
}
interface Mem {
  pessoas: Map<number, Pessoa>;
  /** Por equipe: quais morangos já saíram do galho. */
  colhidos: Set<number>[];
  quedas: Queda[];
  pontos: number[];
  soltouEm: Map<number, number>;
  ultimoPasso: number;
  /** Quem mandou alguma coisa (quem não jogou fica com zero, mesmo com a dupla pontuando). */
  agiu: Set<number>;
}

const valor = (m: Morango) => (m.ouro ? 2 : 1);
const PADRAO: Turma = { jogadores: [1, 2], robos: [], equipes: [[1], [2]], equipeDe: (q) => (q === 1 ? 0 : 1) };

/** As duplas: na ordem sorteada, de duas em duas (sobra uma de um só, se for ímpar; com dois, cada um por si). */
export function duplas(jogadores: number[], aleatorio: () => number) {
  const l = [...jogadores];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  // dois: um contra o outro, cada um com a cesta embaixo da sua árvore
  if (l.length <= 2) return l.map((id) => [id]);
  const r: number[][] = [];
  for (let i = 0; i < l.length; i += 2) r.push(l.slice(i, i + 2));
  return r;
}

const soltar = (mem: Mem, dados: DadosColheita, equipe: number, i: number, passou: number) => {
  if (mem.colhidos[equipe].has(i)) return;
  mem.colhidos[equipe].add(i);
  mem.quedas.push({ i, equipe, x: dados.morangos[i].x, t: passou, estado: 0 });
};

export default microjogo<DadosColheita, Mem>({
  id: 'colheita',
  minimo: 2,
  equipes: duplas,
  gerar(aleatorio, turma = PADRAO) {
    const morangos: Morango[] = [];
    for (let t = 800; t < COLHEITA_MS - QUEDA_MS - 600; t += 750 + Math.floor(aleatorio() * 650)) {
      morangos.push({ t, x: Math.round(MIN_X + 15 + aleatorio() * (MAX_X - MIN_X - 30)), ouro: morangos.length > 3 && aleatorio() < 0.15 });
    }
    const papeis = (turma.equipes ?? turma.jogadores.map((id) => [id])).map((e) => (e.length >= 2 ? { galho: e[0], cesta: e[1] } : { galho: null, cesta: e[0] }));
    return { morangos, papeis };
  },
  duracao: () => COLHEITA_MS + 1000,
  memoria(dados, turma = PADRAO) {
    return {
      pessoas: new Map(turma.jogadores.map((id) => [id, { x: 150, credito: 0, em: 0, pensaEm: 0 }])),
      colhidos: dados.papeis.map(() => new Set<number>()),
      quedas: [],
      pontos: dados.papeis.map(() => 0),
      soltouEm: new Map(),
      ultimoPasso: 0,
      agiu: new Set(turma.robos),
    };
  },
  aoVivo: {
    passoMs: 50,
    passo(p: PassoAoVivo<DadosColheita, Mem>) {
      const { dados, mem, passou, agora, turma } = p;
      const dt = Math.min(0.2, Math.max(0, (passou - mem.ultimoPasso) / 1000));
      mem.ultimoPasso = passou;
      dados.papeis.forEach((papel, eq) => {
        // o galho sem gente (a dupla de um só): a árvore solta cada morango um tempo depois de amadurecer
        if (papel.galho === null) {
          for (const [i, m] of dados.morangos.entries()) if (passou >= m.t + 700 + ((i * 397) % 500)) soltar(mem, dados, eq, i, passou);
        }
        // o robô do galho: vai ao morango maduro mais antigo e o solta
        if (papel.galho !== null && turma.robos.includes(papel.galho)) {
          const eu = mem.pessoas.get(papel.galho)!;
          const alvo = dados.morangos.findIndex((m, i) => m.t <= passou && !mem.colhidos[eq].has(i));
          if (alvo >= 0) {
            const dx = dados.morangos[alvo].x - eu.x;
            eu.x += Math.sign(dx) * Math.min(Math.abs(dx), VEL_GALHO * 0.8 * dt);
            if (Math.abs(dx) < 8 && agora >= eu.pensaEm) {
              eu.pensaEm = agora + 250 + p.aleatorio() * 400;
              soltar(mem, dados, eq, alvo, passou);
            }
          }
        }
        // o robô da cesta: corre para o morango que chega primeiro (depois de "ver"), e apanha quase sempre
        if (turma.robos.includes(papel.cesta)) {
          const eu = mem.pessoas.get(papel.cesta)!;
          const vindo = mem.quedas.filter((q) => q.equipe === eq && q.estado === 0 && passou - q.t > 250).sort((a, b) => a.t - b.t)[0];
          if (vindo) {
            const dx = vindo.x - eu.x;
            eu.x += Math.sign(dx) * Math.min(Math.abs(dx), VEL_CESTA * 0.85 * dt);
          }
          for (const q of mem.quedas) {
            if (q.equipe !== eq || q.estado !== 0 || passou < q.t + QUEDA_MS) continue;
            if (Math.abs(q.x - eu.x) <= ALCANCE_CESTA - 6 && p.aleatorio() < 0.85) {
              q.estado = 1;
              mem.pontos[eq] += valor(dados.morangos[q.i]);
            } else q.estado = 2;
          }
        }
      });
      // o maduro que ninguém colheu cai sozinho
      dados.papeis.forEach((_, eq) => {
        for (const [i, m] of dados.morangos.entries()) if (passou >= m.t + MADURO_MS) soltar(mem, dados, eq, i, m.t + MADURO_MS);
      });
      // o que chegou ao chão e ninguém disse que apanhou: perdido (com a folga de quem tem a cesta)
      for (const q of mem.quedas) {
        if (q.estado !== 0) continue;
        const cesta = dados.papeis[q.equipe].cesta;
        if (passou > q.t + QUEDA_MS + Math.min(p.folgaDe(cesta), 900)) q.estado = 2;
      }
      mem.quedas = mem.quedas.filter((q) => q.estado === 0 || passou - q.t < QUEDA_MS + 2500);
      return {
        x: [...mem.pessoas].map(([id, pe]) => [id, Math.round(pe.x)]),
        f: mem.quedas.map((q) => [q.i, q.equipe, q.x, q.t, q.estado]),
        // por equipe, os morangos que já saíram do galho (para não desenhar o que já caiu)
        c: mem.colhidos.map((s) => [...s]),
        p: mem.pontos,
      };
    },
    receber(c: Conferencia<DadosColheita, Mem>) {
      const { dados, mem, quem, corpo, agora, passou, abaixo } = c;
      const eq = c.turma?.equipeDe(quem) ?? -1;
      const papel = dados.papeis[eq];
      const eu = mem.pessoas.get(quem);
      if (!papel || !eu) return;
      mem.agiu.add(quem);
      const noGalho = papel.galho === quem;
      if (corpo.tipo === 'p' && numero(corpo.x)) {
        // a velocidade de cada um (um balde de distância, que aguenta a internet que engasga)
        const vel = noGalho ? VEL_GALHO : VEL_CESTA;
        eu.credito = Math.min(vel, eu.credito + (vel * Math.max(0, agora - eu.em)) / 1000);
        eu.em = agora;
        const x = Math.min(MAX_X, Math.max(MIN_X, corpo.x));
        const d = Math.abs(x - eu.x);
        if (d > eu.credito + 6) return;
        eu.credito -= d;
        eu.x = x;
      } else if (corpo.tipo === 'solta' && noGalho && inteiro(corpo.i)) {
        const m = dados.morangos[corpo.i];
        if (!m || passou < m.t - 50 || agora - (mem.soltouEm.get(quem) ?? -Infinity) < ESPERA_SOLTAR) return;
        if (Math.abs(m.x - eu.x) > ALCANCE_GALHO) return;
        mem.soltouEm.set(quem, agora);
        soltar(mem, dados, eq, corpo.i, passou);
      } else if (corpo.tipo === 'pego' && papel.cesta === quem && inteiro(corpo.i)) {
        const q = mem.quedas.find((f) => f.equipe === eq && f.i === corpo.i && f.estado === 0);
        if (!q) return;
        // a queda acabou na tela de quem apanha: nunca antes do fim (só um fio), e no máximo a rede dela depois
        if (passou < q.t + QUEDA_MS - 80 || passou > q.t + QUEDA_MS + abaixo) return;
        // e a cesta estava embaixo, pelo que o servidor sabe (a posição que chegou até agora)
        if (Math.abs(q.x - eu.x) > ALCANCE_CESTA) return;
        q.estado = 1;
        mem.pontos[eq] += valor(dados.morangos[q.i]);
      }
    },
  },
  avaliar: () => invalido(),
  *noFim({ dados, mem }) {
    for (const [eq, papel] of dados.papeis.entries()) {
      const r: Resultado = { motivo: null, valor: mem.pontos[eq], chave: [-mem.pontos[eq]] };
      for (const id of [papel.galho, papel.cesta]) if (id !== null && mem.agiu.has(id)) yield [id, r] as [number, Resultado];
    }
  },
  robo(dados, aleatorio, passouMs) {
    const caidos = dados.morangos.filter((m) => m.t + QUEDA_MS + 700 <= passouMs).length;
    const n = Math.round(caidos * (0.45 + aleatorio() * 0.35));
    return { motivo: null, valor: n, chave: [-n] };
  },
});
