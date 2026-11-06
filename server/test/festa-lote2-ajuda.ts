/**
 * AS JOGADAS HONESTAS DO LOTE 2 (05/11/2026), para os testes da partida inteira (a Festa e o Tabuleiro): o mesmo contrato de
 * `jogadaHonesta` em ./festa-ajuda.ts, que só precisa chamar esta quando o microjogo é de um dos sete. Devolve false se não é.
 * Começa logo depois da largada; `avancar` anda o relógio.
 */
import type { DadosChuva } from '../src/festa/chuva.js';
import type { DadosCipo } from '../src/festa/lote2sim.js';
import { PASSO_MS, pilotoDaGalinha, pilotoDaNuvem, type DadosGalinha, type DadosRegar, type Entrada } from '../src/festa/lote2sim.js';
import type { DadosGelo } from '../src/festa/gelo.js';

type Jogo = { publico(quem: number): Record<string, unknown>; acao(quem: number, corpo: Record<string, unknown>): string | null };

export function jogadaHonestaDoLote2(micro: string, jogo: Jogo, quem: number, { avancar }: { avancar: (ms: number) => void }): boolean {
  const dados = jogo.publico(quem).dados;
  // as entradas de um piloto, cada uma na hora dela (100 ms de rede), e o fim
  const pelasEntradas = (e: Entrada[], fimMs: number) => {
    let em = 0;
    for (const [p, dx, dy] of e) {
      avancar(p * PASSO_MS + 100 - em);
      em = p * PASSO_MS + 100;
      jogo.acao(quem, { tipo: 'acerto', p, dx, dy });
    }
    avancar(fimMs + 100 - em);
    jogo.acao(quem, { tipo: 'resultado' });
  };
  if (micro === 'gelo') {
    // a primeira cenoura, com tempo de sobra para ter chegado a ela
    const c = (dados as DadosGelo).cenouras[0];
    avancar(c.t + 1600);
    jogo.acao(quem, { tipo: 'acerto', i: 0, t: c.t + 1500, x: c.x, y: c.y });
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'chuva') {
    const itens = (dados as DadosChuva).itens;
    const i = itens.findIndex((it) => it.tipo !== 2);
    avancar(itens[i].t + 100);
    jogo.acao(quem, { tipo: 'acerto', i, t: itens[i].t, x: itens[i].x });
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'rio') {
    avancar(300);
    jogo.acao(quem, { tipo: 'acerto', b: [200] });
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'brasas') {
    avancar(1000);
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'cipo') {
    const t = Math.round((dados as DadosCipo).periodos[0] * 0.25);
    avancar(t);
    jogo.acao(quem, { tipo: 'acerto', t });
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'regar') {
    pelasEntradas(pilotoDaNuvem(dados as DadosRegar), 22_000);
  } else if (micro === 'galinha') {
    pelasEntradas(pilotoDaGalinha(dados as DadosGalinha), 20_000);
  } else return false;
  return true;
}
