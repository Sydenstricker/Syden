/**
 * CHÃO QUE DESMORONA (lote 5, 05/11/2026; a mecânica da "plataforma que se desfaz derrubando os outros", classe C do
 * levantamento em docs/mario-party-3.md): a turma num assoalho de tábuas sobre o lago da horta. A tábua em que alguém pisa
 * racha e cai um segundo depois, e de tempos em tempos uma racha sozinha; dá para EMPURRAR os outros (o golpe com aviso do
 * motor) para dentro de um buraco. Ganha quem fica mais tempo em cima.
 *
 * A rede (o motor em ./arena-da-horta.ts): o servidor é o dono das tábuas. Ele racha a tábua pela posição que conhece de cada
 * um (que chega uns 100 ms depois), e o quadro leva a todos quando cada uma cai. A tela não deixa andar para dentro de um
 * buraco que já existe (é parede); quem cai é quem ficou na tábua que caiu, decidido com a folga da rede (a tábua de `folga`
 * ms atrás), ou quem foi empurrado para um buraco.
 */
import { invalido, microjogo } from './comum.js';
import { arenaAoVivo, largadaEmRoda, memoriaDaArena, porSobrevivencia, roboDaArena, type MemArena, type RegrasDaArena } from './arena-da-horta.js';

export const DESMORONA_MS = 25000;
/** As tábuas: COLUNAS × LINHAS, de TABUA_L × TABUA_A, com o canto em (X0, Y0). */
export const COLUNAS = 10;
export const LINHAS = 7;
export const TABUA_L = 26;
export const TABUA_A = 24;
export const X0 = 20;
export const Y0 = 16;
/** Do racho à queda. */
export const RACHA_MS = 1100;
/** Quanto tempo de pé em cima (somando todo mundo) uma tábua aguenta antes de rachar: atravessar não racha, parar sim. */
export const AGUENTA_MS = 700;

export interface DadosDesmorona {
  /** As tábuas que racham sozinhas: [quando (ms desde o começo), qual]. */
  sozinhas: [number, number][];
}
interface Extra {
  /** Quando cada tábua cai (ms desde o começo), ou Infinity. */
  cai: number[];
  /** Quanto tempo de pé cada tábua já levou. */
  gasto: number[];
  /** O último passo (para somar o tempo). */
  ultimo: number;
}
type Mem = MemArena<Extra>;

/** A tábua de um ponto, ou −1 fora do assoalho. */
export function tabuaEm(x: number, y: number) {
  const c = Math.floor((x - X0) / TABUA_L);
  const l = Math.floor((y - Y0) / TABUA_A);
  if (c < 0 || l < 0 || c >= COLUNAS || l >= LINHAS) return -1;
  return l * COLUNAS + c;
}
const rachar = (mem: Mem, i: number, quando: number) => {
  if (i >= 0 && mem.x.cai[i] === Infinity) mem.x.cai[i] = quando + RACHA_MS;
};

const regras: RegrasDaArena<DadosDesmorona, Extra> = {
  chao(_d, mem, x, y, t) {
    const i = tabuaEm(x, y);
    return i >= 0 && mem.x.cai[i] > t;
  },
  extra: () => ({ cai: Array.from({ length: COLUNAS * LINHAS }, () => Infinity), gasto: Array.from({ length: COLUNAS * LINHAS }, () => 0), ultimo: 0 }),
  largada: (_d, turma) => largadaEmRoda(turma.jogadores, 85, 52),
  aoPasso({ dados, mem, passou }) {
    // quem está em pé racha a tábua em que está (pela posição que o servidor conhece)
    const dt = Math.min(200, Math.max(0, passou - mem.x.ultimo));
    mem.x.ultimo = passou;
    for (const c of mem.coelhos.values()) {
      if (!c.vivo || !(c.mexeu || c.robo)) continue;
      const i = tabuaEm(c.x, c.y);
      if (i < 0) continue;
      mem.x.gasto[i] += dt;
      if (mem.x.gasto[i] >= AGUENTA_MS) rachar(mem, i, passou);
    }
    for (const [t, i] of dados.sozinhas) if (t <= passou) rachar(mem, i, t);
  },
  metaDoRobo(_d, mem, c, passou) {
    // a tábua inteira mais perto, que não seja a de agora (quem fica parado cai)
    const agora = tabuaEm(c.x, c.y);
    const pisando = agora >= 0 && mem.x.cai[agora] !== Infinity;
    if (!pisando && (c.id + Math.floor(passou / 700)) % 3 !== 0) return null;
    let melhor: [number, number] | null = null;
    let dist = Infinity;
    for (let i = 0; i < mem.x.cai.length; i++) {
      if (i === agora || mem.x.cai[i] !== Infinity) continue;
      const x = X0 + (i % COLUNAS) * TABUA_L + TABUA_L / 2;
      const y = Y0 + Math.floor(i / COLUNAS) * TABUA_A + TABUA_A / 2;
      const d = (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y);
      if (d < dist) {
        dist = d;
        melhor = [x, y];
      }
    }
    return melhor;
  },
  // só as tábuas que já racharam (as outras estão inteiras)
  quadro: (mem) => ({ b: mem.x.cai.flatMap((t, i) => (t === Infinity ? [] : [[i, t]])) }),
  resultado: (_d, _mem, c) => porSobrevivencia(DESMORONA_MS, c),
};

export default microjogo<DadosDesmorona, Mem>({
  id: 'desmorona',
  minimo: 2,
  gerar(aleatorio) {
    // de 2,5 s em diante, uma tábua a cada ~0,9 s racha sozinha (as de fora primeiro, para o meio durar)
    const sozinhas: [number, number][] = [];
    for (let t = 2500; t < DESMORONA_MS; t += 900 + Math.floor(aleatorio() * 500)) {
      const borda = t < 12000;
      const c = borda ? (aleatorio() < 0.5 ? 0 : COLUNAS - 1) : Math.floor(aleatorio() * COLUNAS);
      const l = Math.floor(aleatorio() * LINHAS);
      sozinhas.push([t, l * COLUNAS + (borda && aleatorio() < 0.4 ? Math.floor(aleatorio() * COLUNAS) : c)]);
    }
    return { sozinhas };
  },
  duracao: () => DESMORONA_MS + 1000,
  memoria: (dados, turma) => memoriaDaArena(regras, dados, turma),
  aoVivo: arenaAoVivo(regras),
  avaliar: () => invalido(),
  *noFim({ mem }) {
    // quem nunca mexeu o coelho não jogou: fica com zero ("Sem resposta")
    for (const c of mem.coelhos.values()) if (c.robo || c.mexeu) yield [c.id, regras.resultado(null as never, mem, c)];
  },
  robo: (_d, aleatorio, passouMs) => roboDaArena(DESMORONA_MS, aleatorio, passouMs),
});
