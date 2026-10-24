/**
 * O PING DA CHAMADA, como o do Discord (pedido de 24/10/2026): quanto o som leva para ir ao servidor de voz e voltar.
 *
 * Vem das estatísticas do próprio navegador, do par de rotas que a conexão escolheu (`candidate-pair`): é o caminho por
 * onde a voz passa de verdade. A cor é a referência que o número sozinho não dá ("medida sem referência alarma", ver
 * CLAUDE.md): verde é conversa normal, amarelo já se nota, vermelho atrapalha.
 *
 * OS CORTES SÃO OS DA CONVERSA, NÃO OS DE UM SERVIDOR VIZINHO. O servidor de voz fica na Alemanha, e do Brasil o ping
 * normal é de 180 a 230 ms: com o verde abaixo de 100, a tela ficaria amarela para todo mundo, sempre, e uma cor que nunca
 * muda não diz nada. A ITU (G.114) dá até 150 ms de ida como bom para conversa, ou seja, uns 300 de ida e volta; daí para
 * cima a pessoa começa a falar por cima da outra. Assim o amarelo e o vermelho aparecem só quando a conexão DE QUEM VÊ
 * piorou, que é quando vale olhar.
 */

export type NivelDoPing = 'bom' | 'medio' | 'ruim';

/** O tempo de ida e volta, em ms, de um relatório de estatísticas; null quando ele não diz. */
export function pingDoRelatorio(relatorio: RTCStatsReport | undefined): number | null {
  if (!relatorio) return null;
  let escolhido: string | undefined;
  const pares = new Map<string, { rtt?: number; nomeado?: boolean; estado?: string }>();
  relatorio.forEach((r) => {
    if (r.type === 'transport' && typeof r.selectedCandidatePairId === 'string') escolhido = r.selectedCandidatePairId;
    if (r.type === 'candidate-pair') {
      pares.set(r.id, { rtt: r.currentRoundTripTime, nomeado: r.nominated, estado: r.state });
    }
  });
  // O transporte diz qual par está em uso; o Firefox não diz, e aí vale o par nomeado que funcionou.
  const par = (escolhido && pares.get(escolhido)) || [...pares.values()].find((p) => p.nomeado && p.estado === 'succeeded');
  return par && typeof par.rtt === 'number' ? Math.round(par.rtt * 1000) : null;
}

export function nivelDoPing(ms: number): NivelDoPing {
  if (ms < 300) return 'bom';
  if (ms < 450) return 'medio';
  return 'ruim';
}
