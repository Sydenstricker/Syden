/**
 * A TORTA DE CENOURA, EM DUPLA (05/11/2026; do Eatsa Pizza do levantamento em docs/mario-party-3.md, só a mecânica): cada dupla
 * tem a sua torta, e come mordendo, alternando duas teclas (← e →, A e L, ou os dois botões no toque: a mesma tecla duas vezes
 * não morde). As mordidas das duas pessoas da dupla vão para a mesma torta; a dupla que acabar primeiro ganha, e as outras ficam
 * pelo tanto que comeram. Sobrando um sem par, ele come uma torta menor (do tamanho de uma pessoa). Sozinho, a raposa come a
 * dela ao lado, só para dar o ritmo.
 *
 * NO FORMATO DE SEMPRE (ver ./lote4-turma.ts): as duplas saem da ordem de chegada (o 1º com o 2º, o 3º com o 4º…), e as duas
 * pessoas da dupla dividem a mesma chave. As mordidas vão ao vivo como um total ('acerto' `{ n, t }`), conferido contra o
 * ritmo de quem morde muito (`contar`).
 *
 * COM AS EQUIPES IMPOSTAS (20/11/2026: o 2 contra 2 e o 1 contra 3 do Tabuleiro da turma; ver ./lote4-turma.ts): cada equipe
 * é uma torta do tamanho dela (45 mordidas por pessoa: no 1 contra 3, a de um contra a de três, a mesma conta por cabeça), e os
 * robôs dela mordem no ritmo de quem joga bem.
 */
import { microjogo, type Largada, type Resultado } from './comum.js';
import { avisarComFreio, contar, entrar, equipeImposta, impostas, toquesDoRobo, type Contagem, type Impostas } from './lote4-turma.js';

export const TORTA_MS = 20000;
/** Mordidas por pessoa da dupla (a torta de uma dupla tem o dobro). */
export const MORDIDAS = 45;
/** O ritmo de quem morde muito, alternando duas teclas; acima disso não é gente. */
export const RITMO_MAXIMO = 12;
/** A raposa (sozinho): mordidas por segundo. */
export const RITMO_DA_RAPOSA = 3.6;
export const PASSO_MS = 500;
/** Os robôs de uma equipe imposta (alternar duas teclas vai mais rápido que puxar a seta certa). */
export const RITMO_DO_ROBO_NA_TORTA = 7;

export interface VistaTorta {
  /** Cada dupla: quanto da torta já foi (0 a 1), e quando acabou (ms), ou null. A última pode ser a raposa. */
  duplas: { comido: number; acabou: number | null; tamanho: number; raposa?: boolean }[];
  /** A minha dupla (-1: não estou). */
  minha: number;
  /** As minhas mordidas, como o servidor as aceitou. */
  mordidas: number;
}

interface Mem {
  l: Largada<undefined, Mem> | null;
  membros: number[];
  placar: Map<number, Contagem>;
  /** Quando cada dupla acabou (ms desde o começo, no relógio do servidor). */
  acabou: Map<number, number>;
  avisadoEm?: number;
  comeco: number;
  /** As equipes impostas por quem chamou (o Tabuleiro), ou null. */
  im: Impostas | null;
}

const duplaDe = (mem: Mem, id: number) => (mem.im ? equipeImposta(mem.im, id) : Math.floor(mem.membros.indexOf(id) / 2));
const quantasDuplas = (mem: Mem) => (mem.im ? mem.im.equipes.length : Math.ceil(mem.membros.length / 2));
const tamanho = (mem: Mem, d: number) => (mem.im ? mem.im.equipes[d].length : Math.min(2, mem.membros.length - d * 2));
/** Quem come a torta `d`: a dupla pela chegada, ou a equipe imposta inteira (os robôs dela comem sozinhos). */
const daDupla = (mem: Mem, d: number) => (mem.im ? mem.im.equipes[d] : mem.membros.slice(d * 2, d * 2 + 2));
const mordidasDe = (mem: Mem, id: number, passou: number) =>
  mem.im?.robos.includes(id) ? toquesDoRobo(Math.min(passou, TORTA_MS), 0, RITMO_DO_ROBO_NA_TORTA) : (mem.placar.get(id)?.n ?? 0);
const comidoDe = (mem: Mem, d: number, passou = Infinity) => {
  let soma = 0;
  for (const id of daDupla(mem, d)) soma += mordidasDe(mem, id, passou);
  return Math.min(1, soma / (MORDIDAS * tamanho(mem, d)));
};
/** Quem joga: os que entraram e, nas equipes impostas, os robôs delas. */
const quemJoga = (mem: Mem) => (mem.im ? [...mem.membros.filter((id) => duplaDe(mem, id) >= 0), ...mem.im.robos.filter((id) => duplaDe(mem, id) >= 0)] : mem.membros);
/** Nas equipes impostas, a torta que os robôs acabaram (o passo do relógio confere). */
function conferirTortas(mem: Mem, passou: number) {
  if (!mem.im) return;
  for (let d = 0; d < quantasDuplas(mem); d++) if (!mem.acabou.has(d) && comidoDe(mem, d, passou) >= 1) mem.acabou.set(d, passou);
}

function resultadoDe(mem: Mem, id: number): Resultado {
  const d = duplaDe(mem, id);
  const n = mordidasDe(mem, id, TORTA_MS);
  const acabou = mem.acabou.get(d);
  if (acabou !== undefined) return { motivo: null, valor: n, chave: [0, acabou] };
  const comido = Math.floor(comidoDe(mem, d, TORTA_MS) * 1000);
  if (comido === 0) return { motivo: 'errou', valor: 0, chave: [] };
  return { motivo: null, valor: n, chave: [1, -comido] };
}

export default microjogo<undefined, Mem>({
  id: 'torta',
  gerar: () => undefined,
  duracao: () => TORTA_MS + 1000,
  aceitaEquipes: true,
  memoria: (_dados, turma) => ({ l: null, membros: [], placar: new Map(), acabou: new Map(), comeco: 0, im: impostas(turma) }),
  iniciar(l) {
    const { mem } = l;
    mem.l = l;
    mem.comeco = l.agora();
    // o passo do relógio: a sala relida (a raposa come sozinha) e o fim
    const passo = () => {
      const passou = l.agora() - mem.comeco;
      if (passou >= TORTA_MS) return l.agendar(1000, l.revelar);
      conferirTortas(mem, passou);
      if (mem.im && mem.acabou.size >= quantasDuplas(mem)) return l.revelar();
      l.avisar();
      l.agendar(Math.min(PASSO_MS, TORTA_MS - passou), passo);
    };
    l.agendar(PASSO_MS, passo);
  },
  vista({ mem, quem, passou, fase }) {
    const duplas: VistaTorta['duplas'] = [];
    const p = fase === 'revelando' ? TORTA_MS : passou;
    for (let d = 0; d < quantasDuplas(mem); d++) duplas.push({ comido: comidoDe(mem, d, p), acabou: mem.acabou.get(d) ?? null, tamanho: tamanho(mem, d) });
    if (!mem.im && mem.membros.length === 1) {
      const comido = Math.min(1, (RITMO_DA_RAPOSA * Math.max(0, p - 600)) / 1000 / MORDIDAS);
      duplas.push({ comido, acabou: null, tamanho: 1, raposa: true });
    }
    const v: VistaTorta = {
      duplas,
      minha: mem.membros.includes(quem) ? duplaDe(mem, quem) : -1,
      mordidas: mem.placar.get(quem)?.n ?? 0,
    };
    return { dados: v };
  },
  acerto(c) {
    const { mem, quem, corpo, passou, agora } = c;
    if (corpo.entrar === 1) {
      entrar(mem.membros, quem);
      return;
    }
    if (!mem.membros.includes(quem) || passou > TORTA_MS + 1000) return;
    const d = duplaDe(mem, quem);
    if (d < 0) return;
    if (mem.acabou.has(d)) return;
    if (!contar(mem.placar, c as never, RITMO_MAXIMO)) return;
    if (comidoDe(mem, d, passou) >= 1) {
      mem.acabou.set(d, passou);
      // todas as duplas acabaram: revela
      conferirTortas(mem, passou);
      if (mem.acabou.size >= quantasDuplas(mem)) return mem.l!.revelar();
      mem.l!.avisar();
      return;
    }
    avisarComFreio(mem, agora);
  },
  avaliar: ({ mem, quem }) => (mem.membros.includes(quem) ? resultadoDe(mem, quem) : { motivo: 'invalido', valor: null, chave: [] }),
  *noFim({ mem }) {
    for (const id of quemJoga(mem)) yield [id, resultadoDe(mem, id)] as [number, Resultado];
  },
  robo(_dados, aleatorio, passouMs) {
    // de 6 a 8,5 mordidas por segundo, numa dupla de robôs iguais
    const ritmo = 6 + aleatorio() * 2.5;
    const p = Math.min(passouMs, TORTA_MS);
    const acaba = Math.round((MORDIDAS * 1000) / ritmo);
    const n = Math.floor((Math.min(p, acaba) * ritmo) / 1000);
    if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
    return acaba <= p ? { motivo: null, valor: n, chave: [0, acaba] } : { motivo: null, valor: n, chave: [1, -Math.floor((n / MORDIDAS) * 1000)] };
  },
});
