/**
 * AS CHAVES DA PORTEIRA (lote 5, 05/11/2026; a mecânica do "disputar as chaves, menos chaves que jogadores, e passar pela
 * porta", classe C do levantamento em docs/mario-party-3.md): as cenouras douradas abrem a porteira da horta, e há uma a menos
 * que a turma. Pegue uma e leve até a porteira (carregando, anda-se mais devagar); quem leva um EMPURRÃO deixa a cenoura cair.
 * Quem passa primeiro ganha; quem fica sem cenoura perde.
 *
 * A rede (o motor em ./arena-da-horta.ts): o servidor é o dono das cenouras. Pegar é um pedido ('pega'), e vale o PRIMEIRO que
 * chega, se o servidor sabe que a pessoa estava perto (com a folga da posição que ainda vinha a caminho). A cenoura que cai fica
 * meio segundo sem poder ser pega, para todos verem onde caiu. Ninguém cai: a horta é cercada.
 */
import { invalido, microjogo, type Resultado } from './comum.js';
import { arenaAoVivo, ARENA_A, ARENA_L, memoriaDaArena, VELOCIDADE, type CoelhoDaArena, type MemArena, type RegrasDaArena } from './arena-da-horta.js';

export const PORTEIRA_MS = 25000;
/** A porteira: no meio da cerca de cima. Chegar aqui com a cenoura é passar. */
export const PORTEIRA_X = 150;
export const PORTEIRA_MEIA = 18;
export const CERCA_Y = 26;
/** Quão perto (pelo que o servidor sabe) dá para pegar: o raio do coelho, a cenoura e a posição que vem a caminho. */
export const PEGA_RAIO = 26;
/** A cenoura que caiu fica este tempo no chão antes de poder ser pega. */
export const CAIDA_MS = 500;

export interface DadosPorteira {
  /** Onde cada cenoura começa. */
  chaves: [number, number][];
}
interface Chave {
  x: number;
  y: number;
  dono: number | null;
  livreEm: number;
  /** Já passou pela porteira (com o dono). */
  usada: boolean;
}
interface Extra {
  chaves: Chave[];
  passaram: number[];
}
type Mem = MemArena<Extra>;

const daPessoa = (mem: Mem, id: number) => mem.x.chaves.findIndex((k) => k.dono === id && !k.usada);

const regras: RegrasDaArena<DadosPorteira, Extra> = {
  chao: () => true,
  extra: (d) => ({ chaves: d.chaves.map(([x, y]) => ({ x, y, dono: null, livreEm: 0, usada: false })), passaram: [] }),
  // todos começam embaixo, longe da porteira
  largada: (_d, turma) => {
    const n = turma.jogadores.length;
    return new Map(turma.jogadores.map((id, i) => [id, [Math.round(40 + ((ARENA_L - 80) * (i + 0.5)) / n), ARENA_A - 22] as [number, number]]));
  },
  velocidade: (mem, c) => (daPessoa(mem, c.id) >= 0 ? VELOCIDADE * 0.8 : VELOCIDADE),
  pegar(_d, mem, c, i, passou) {
    const k = mem.x.chaves[i];
    if (!k || k.dono !== null || k.usada || passou < k.livreEm || daPessoa(mem, c.id) >= 0) return;
    if (Math.sqrt((k.x - c.x) * (k.x - c.x) + (k.y - c.y) * (k.y - c.y)) > PEGA_RAIO) return;
    k.dono = c.id;
    mem.eventos.push(['p', c.id, i]);
  },
  aoPasso({ mem, passou, agora }) {
    for (const [i, k] of mem.x.chaves.entries()) {
      if (k.usada) continue;
      if (k.dono === null) {
        // os robôs pegam ao passar por cima
        for (const c of mem.coelhos.values()) if (c.vivo && c.robo && k.dono === null) regras.pegar!(null as never, mem, c, i, passou);
        continue;
      }
      const c = mem.coelhos.get(k.dono)!;
      k.x = c.x;
      k.y = c.y;
      // chegou à porteira: passou, e sai da horta
      if (c.y <= CERCA_Y + 6 && Math.abs(c.x - PORTEIRA_X) <= PORTEIRA_MEIA) {
        k.usada = true;
        c.vivo = false;
        mem.x.passaram.push(c.id);
        c.pontos = mem.x.passaram.length;
        mem.eventos.push(['g', c.id, mem.x.passaram.length]);
      }
    }
    if (mem.fimEm === null && mem.x.passaram.length >= mem.x.chaves.length) mem.fimEm = agora + 900;
  },
  aoLevar(mem, v, _caiu, passou) {
    const i = daPessoa(mem, v.id);
    if (i < 0) return;
    const k = mem.x.chaves[i];
    k.dono = null;
    k.x = v.x;
    k.y = v.y;
    k.livreEm = passou + CAIDA_MS;
    mem.eventos.push(['s', v.id, i]);
  },
  metaDoRobo(_d, mem, c, passou) {
    if (daPessoa(mem, c.id) >= 0) return [PORTEIRA_X, CERCA_Y];
    let melhor: [number, number] | null = null;
    let dist = Infinity;
    for (const k of mem.x.chaves) {
      if (k.usada || (k.dono === null && passou < k.livreEm - 200)) continue;
      const d = (k.x - c.x) * (k.x - c.x) + (k.y - c.y) * (k.y - c.y);
      // a livre vale mais que a carregada (atrás de quem carrega, para empurrar)
      const peso = k.dono === null ? d : d * 2.2;
      if (peso < dist) {
        dist = peso;
        melhor = [k.x, k.y];
      }
    }
    return melhor;
  },
  quadro: (mem) => ({
    k: mem.x.chaves.map((k) => [Math.round(k.x), Math.round(k.y), k.dono ?? 0, k.usada ? 1 : 0, k.livreEm]),
    pp: mem.x.passaram,
  }),
  ultimoEmPe: false,
  resultado(_d, mem, c): Resultado {
    const ordem = mem.x.passaram.indexOf(c.id);
    const n = mem.x.chaves.length;
    if (ordem >= 0) return { motivo: null, valor: ordem + 1, chave: [ordem + 1] };
    // quem não passou: quem estava com a cenoura na mão fica na frente
    return { motivo: null, valor: 0, chave: [daPessoa(mem, c.id) >= 0 ? n + 1 : n + 2] };
  },
};

export default microjogo<DadosPorteira, Mem>({
  id: 'porteira',
  minimo: 2,
  gerar(aleatorio, turma) {
    const n = Math.max(1, (turma?.jogadores.length ?? 2) - 1);
    const chaves: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      // espalhadas pelo meio, nem perto da largada nem da porteira
      chaves.push([Math.round(40 + aleatorio() * (ARENA_L - 80)), Math.round(70 + aleatorio() * 70)]);
    }
    return { chaves };
  },
  duracao: () => PORTEIRA_MS + 1000,
  memoria: (dados, turma) => memoriaDaArena(regras, dados, turma),
  aoVivo: arenaAoVivo(regras),
  avaliar: () => invalido(),
  *noFim({ mem }) {
    // quem nunca mexeu o coelho não jogou: fica com zero ("Sem resposta")
    for (const c of mem.coelhos.values()) if (c.robo || c.mexeu) yield [c.id, regras.resultado(null as never, mem, c as CoelhoDaArena)];
  },
  robo(dados, aleatorio) {
    const ordem = 1 + Math.floor(aleatorio() * (dados.chaves.length + 1));
    return ordem > dados.chaves.length ? { motivo: null, valor: 0, chave: [ordem + 1] } : { motivo: null, valor: ordem, chave: [ordem] };
  },
});
