/**
 * A jogada honesta dos microjogos do LOTE 6 (os de um contra três), para a partida aleatória de minijogos-festa.test.ts: true se
 * o id é do lote. Pensada para quem joga contra alguém que não faz nada (o teste da partida): no remo ou lá em cima, derruba o
 * grupo parado; no grupo, o solitário parado não manda nada, e quem está no grupo ganha.
 */
import { ONDA_MS, PRIMEIRA_REMADA, type DadosOnda } from '../src/festa/onda.js';
import { LADEIRA_MS, PRIMEIRA_ABOBORA, aboborasPara, type DadosLadeira } from '../src/festa/ladeira.js';
import { faixaInicial } from '../src/festa/ladeira-sim.js';

type Jogo = { publico(quem: number): Record<string, unknown>; acao(quem: number, corpo: Record<string, unknown>): string | null };

export function jogadaHonestaDoLote6(
  micro: string,
  jogo: Jogo,
  quem: number,
  { avancar }: { andar: () => void; avancar: (ms: number) => void },
): boolean {
  if (micro !== 'onda' && micro !== 'ladeira') return false;
  const d = jogo.publico(quem).dados as DadosOnda | DadosLadeira;
  const aoVivo = (corpo: Record<string, unknown>) => jogo.acao(quem, { tipo: 'acerto', aoVivo: corpo });
  if (micro === 'onda') {
    // uma onda derruba quem não pula
    let t = 0;
    if (d.solo === quem) {
      avancar(PRIMEIRA_REMADA + 200);
      t = PRIMEIRA_REMADA + 200;
      aoVivo({ onda: 0 });
    }
    avancar(ONDA_MS + 200 - t);
  } else {
    // as abóboras na faixa de quem sobe parado, uma a cada 1,2 s, até acabarem
    let t = 0;
    if (d.solo === quem) {
      const faixa = faixaInicial(0);
      avancar(PRIMEIRA_ABOBORA + 100);
      t = PRIMEIRA_ABOBORA + 100;
      for (let k = 0; k < aboborasPara(d.grupo.length) && t < LADEIRA_MS - 2000; k++) {
        aoVivo({ faixa });
        avancar(1200);
        t += 1200;
      }
    }
    avancar(LADEIRA_MS + 200 - t);
  }
  jogo.acao(quem, { tipo: 'resultado' });
  return true;
}
