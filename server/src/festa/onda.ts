/**
 * ONDA NO AÇUDE (lote 6, 05/11/2026; do Tidal Toss em docs/mario-party-3.md, só a mecânica do um contra três): um coelho, na
 * margem, bate o remo na água e manda ondas; os outros estão numa jangada do outro lado e pulam quando a onda passa. Quem não
 * está no ar quando a onda chega cai na água e está fora. Se todos caem, ganha o solitário; se sobra alguém na jangada, ganha o
 * grupo inteiro (as equipes do formato: a posição é por equipe).
 *
 * A REDE: a onda leva de VIAGEM_RAPIDA a VIAGEM_LENTA para atravessar o açude, e é esse tempo que paga a internet. O remo vai
 * ao servidor pelo canal ao vivo ({ onda: 0 | 1 }) e a onda é CARIMBADA com o relógio do servidor na chegada (não com o que o
 * solitário diz); o passo seguinte a leva a todos (o quadro), e cada um a vê sair dali, já andando o tanto que o atraso comeu.
 * O pulo vai do mesmo jeito ({ pulo: t }, o instante na tela de quem pulou), conferido pelo `cabe`, e os quadros levam os pulos
 * aos outros (para a jangada pular junto na tela de todos). Quem cai não é dito por ninguém: o servidor refaz a conta com os
 * pulos que recebeu (a pessoa estava no ar durante a passagem da onda?), e a tela de quem pulou faz a mesma conta na hora.
 *
 * O SOLITÁRIO NÃO ENCOSTA DUAS ONDAS: a chegada de uma fica a `espacoMs` (mais, com menos gente no grupo) de todas as outras, e
 * por isso toda onda é pulável. O que ele tem é o ritmo: a rápida e a lenta, a pausa, a finta.
 *
 * OS ROBÔS: no remo, mandam ondas num ritmo variado; na jangada, pulam quase sempre na hora (cada onda tem a chance dela de
 * pegá-los). Os dois pelo mesmo caminho das pessoas (as ondas e os pulos na memória), então a conta é uma só.
 */
import { FOLGA_ACIMA, invalido, microjogo, numero, type Conferencia, type Resultado } from './comum.js';
import { acaso, elencoDa, memoriaDe, papelDe, prender, umContraTodos, type Elenco } from './lote6-elenco.js';

export const ONDA_MS = 17000;
export const VIAGEM_RAPIDA = 1500;
export const VIAGEM_LENTA = 2300;
/** Metade da passagem da onda pela jangada: o pulo tem de cobrir de A − PASSAGEM a A + PASSAGEM. */
export const PASSAGEM_MS = 120;
export const NO_AR_MS = 650;
/** Depois de cair na jangada, quanto até poder pular de novo. */
export const RECARGA_MS = 250;
/** O espaço mínimo entre as chegadas de duas ondas, pelo tamanho do grupo (1, 2, 3 ou mais). */
export const espacoMs = (grupo: number) => (grupo <= 1 ? 1600 : grupo === 2 ? 1300 : 1000);
/** A última chegada possível, e a primeira remada. */
export const ULTIMA_CHEGADA = ONDA_MS - 500;
export const PRIMEIRA_REMADA = 800;
/** Entre duas remadas, no mínimo. */
export const ENTRE_REMADAS = 300;
/** O robô na jangada erra uma onda com esta chance. */
export const ERRO_DO_ROBO = 0.1;

export const viagem = (tipo: number) => (tipo === 1 ? VIAGEM_LENTA : VIAGEM_RAPIDA);

export interface Onda {
  /** Quando saiu (ms desde o começo, relógio do servidor). */
  l: number;
  /** 0 a rápida, 1 a lenta. */
  tipo: number;
}
export interface DadosOnda extends Elenco {
  semente: number;
}
/** O que vai à tela: os dados, as ondas, e os pulos de cada um do grupo (pelo id). */
export interface VistaOnda extends DadosOnda {
  ondas: Onda[];
  pulos: Record<string, number[]>;
}
/** O quadro do canal ao vivo: o mesmo, quando algo muda. */
export type QuadroOnda = Pick<VistaOnda, 'ondas' | 'pulos'>;

interface Mem {
  ondas: Onda[];
  pulos: Map<number, number[]>;
  /** Mudou desde o último quadro; saiu onda (o estado também muda: o aviso vai à sala). */
  mudou: boolean;
  saiuOnda: boolean;
  /** O ritmo do robô no remo: a próxima remada. */
  proximaDoRobo: number;
  /** A rodada pede o resultado dos robôs um a um, na ordem deles: este é o próximo. */
  vezDoRobo: number;
}

const chegadaDe = (o: Onda) => o.l + viagem(o.tipo);

/** A primeira onda (índice) que pegou alguém com estes pulos, ou null. Só contam as ondas já passadas até `ate`. */
export function derrubadoPor(ondas: Onda[], pulos: number[], ate = Infinity): number | null {
  const ordem = ondas.map((o, i) => [chegadaDe(o), i] as const).sort((a, b) => a[0] - b[0]);
  for (const [a, i] of ordem) {
    if (a + PASSAGEM_MS > ate) break;
    if (!pulos.some((j) => j <= a - PASSAGEM_MS && j + NO_AR_MS >= a + PASSAGEM_MS)) return i;
  }
  return null;
}

/** Quantos do grupo caíram, e se o solitário ganhou (todos caíram). */
function placar(d: DadosOnda, mem: Mem) {
  const caidos = d.grupo.filter((id) => derrubadoPor(mem.ondas, mem.pulos.get(id) ?? []) !== null).length;
  return { caidos, soloGanha: d.grupo.length > 0 && caidos === d.grupo.length };
}

/** O resultado de alguém: a equipe que ganhou tem `chave` [0]; a outra, 'errou' (zero ponto). O valor é quantos caíram. */
function resultadoDe(d: DadosOnda, mem: Mem, quem: number): Resultado {
  const papel = papelDe(d, quem);
  if (!papel) return invalido();
  const { caidos, soloGanha } = placar(d, mem);
  const ganhou = papel === 'solo' ? soloGanha : !soloGanha;
  return ganhou ? { motivo: null, valor: caidos, chave: [0] } : { motivo: 'errou', valor: caidos, chave: [] };
}

/** Uma remada: a onda sai AGORA, no relógio do servidor; a chegada não encosta em outra, nem passa do fim. */
function remar(d: DadosOnda, mem: Mem, passou: number, tipo: number) {
  const nova = { l: passou, tipo };
  const a = chegadaDe(nova);
  const ultima = mem.ondas[mem.ondas.length - 1];
  if (passou < PRIMEIRA_REMADA || a > ULTIMA_CHEGADA) return false;
  if (ultima && passou - ultima.l < ENTRE_REMADAS) return false;
  if (mem.ondas.some((o) => Math.abs(chegadaDe(o) - a) < espacoMs(d.grupo.length))) return false;
  mem.ondas.push(nova);
  mem.mudou = mem.saiuOnda = true;
  return true;
}

/** Um pulo, no instante da tela de quem pulou: não antes de a pessoa voltar à jangada. */
function pular(mem: Mem, quem: number, t: number) {
  const meus = mem.pulos.get(quem) ?? [];
  if (meus.length && t < meus[meus.length - 1] + NO_AR_MS + RECARGA_MS - FOLGA_ACIMA) return;
  meus.push(t);
  mem.pulos.set(quem, meus);
  mem.mudou = true;
}

function receber({ dados, mem, quem, corpo, passou, cabe }: Conferencia<DadosOnda, Mem>) {
  const papel = papelDe(dados, quem);
  if (papel === 'solo' && (corpo.onda === 0 || corpo.onda === 1)) remar(dados, mem, passou, corpo.onda);
  else if (papel === 'grupo' && numero(corpo.pulo)) {
    const t = Math.round(corpo.pulo);
    if (t >= 0 && cabe(t)) pular(mem, quem, t);
  }
}

const quadro = (mem: Mem): QuadroOnda => ({ ondas: mem.ondas, pulos: Object.fromEntries(mem.pulos) });

export default microjogo<DadosOnda, Mem>({
  id: 'onda',
  minimo: 2,
  equipes: umContraTodos,
  gerar: (aleatorio, turma) => ({ ...elencoDa(turma), semente: Math.floor(aleatorio() * 1_000_000) }),
  duracao: () => ONDA_MS + 1500,
  memoria: (dados) => prender(dados, { ondas: [], pulos: new Map(), mudou: false, saiuOnda: false, proximaDoRobo: PRIMEIRA_REMADA + 400, vezDoRobo: 0 }),
  vista: ({ dados, mem }): { dados: VistaOnda } => ({ dados: { ...dados, ...quadro(mem) } }),
  aoVivo: {
    passoMs: 50,
    receber,
    passo({ dados, mem, passou, avisar }) {
      // o robô no remo: ondas num ritmo variado (a rápida e a lenta, umas pausas)
      if (dados.robos.includes(dados.solo) && passou >= mem.proximaDoRobo) {
        const k = mem.ondas.length;
        const tipo = acaso(dados.semente, k, 7) < 0.5 ? 0 : 1;
        if (remar(dados, mem, passou, tipo) || remar(dados, mem, passou, 1 - tipo)) {
          mem.proximaDoRobo = passou + 700 + Math.floor(acaso(dados.semente, k, 9) * 900);
        } else mem.proximaDoRobo = passou + 100;
      }
      // os robôs na jangada: pulam uns 300 ms antes de cada onda chegar, a não ser na que os pega
      for (const id of dados.grupo) {
        if (!dados.robos.includes(id)) continue;
        mem.ondas.forEach((o, i) => {
          const antes = 260 + Math.floor(acaso(dados.semente, id, i, 3) * 120);
          const t = chegadaDe(o) - antes;
          if (passou >= t && passou < t + 50 && acaso(dados.semente, id, i) >= ERRO_DO_ROBO) pular(mem, id, t);
        });
      }
      if (!mem.mudou) return null;
      mem.mudou = false;
      // a onda nova também vai pelo estado, para quem está sem o canal ao vivo (o quadro não chega); o pulo, só pelo quadro
      if (mem.saiuOnda) avisar();
      mem.saiuOnda = false;
      return quadro(mem);
    },
  },
  avaliar({ dados, mem, quem, passou, abaixo }) {
    // o fim só vale no fim (antes disso, ainda pode vir onda): quem manda cedo não conta
    if (passou < ONDA_MS - abaixo) return invalido();
    return resultadoDe(dados, mem, quem);
  },
  *noFim({ dados, mem }) {
    // quem fez alguma coisa (remou ou pulou) e não mandou o fim conta pelo que o servidor viu
    const humanos = [dados.solo, ...dados.grupo].filter((id) => !dados.robos.includes(id));
    for (const quem of humanos) {
      if (papelDe(dados, quem) === 'solo' ? mem.ondas.length > 0 : mem.pulos.has(quem)) yield [quem, resultadoDe(dados, mem, quem)] as [number, Resultado];
    }
  },
  robo(dados, aleatorio, passouMs) {
    // numa rodada de verdade, o robô tem o resultado da equipe dele, pela conta do servidor
    const mem = memoriaDe<Mem>(dados);
    if (mem && dados.robos.length) return resultadoDe(dados, mem, dados.robos[mem.vezDoRobo++ % dados.robos.length]);
    // fora dela (o teste do contrato): um resultado plausível
    const caidos = Math.min(3, Math.floor(aleatorio() * 4 * Math.min(1, passouMs / ONDA_MS)));
    return caidos === 3 ? { motivo: 'errou', valor: 3, chave: [] } : { motivo: null, valor: caidos, chave: [0] };
  },
});
