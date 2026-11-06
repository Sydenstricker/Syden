/**
 * A jogada honesta dos microjogos do LOTE 5 (para a partida aleatória de minijogos-festa.test.ts): true se o id é do lote.
 * Os do lote 5 são AO VIVO: o que se joga vai pelo canal ao vivo, e aqui (sem socket) pela ação 'acerto' com `aoVivo`, que a
 * rodada aceita do mesmo jeito. Mandar a posição já é jogar: quem nunca mandou nada fica com zero ("Sem resposta"). O
 * resultado sai na revelação (o `noFim`), pelo que o servidor viu; o relógio da partida fecha a rodada.
 */
type Jogo = { publico(quem: number): Record<string, unknown>; acao(quem: number, corpo: Record<string, unknown>): string | null };

const DO_LOTE = new Set(['canteiro', 'desmorona', 'porteira', 'colheita', 'remada']);

export function jogadaHonestaDoLote5(
  micro: string,
  jogo: Jogo,
  quem: number,
  { avancar }: { andar: () => void; avancar: (ms: number) => void },
): boolean {
  if (!DO_LOTE.has(micro)) return false;
  avancar(300);
  // a posição de quem está parado no lugar (o servidor confere a velocidade; parado sempre vale)
  jogo.acao(quem, { tipo: 'acerto', aoVivo: micro === 'colheita' || micro === 'remada' ? { tipo: 'p', x: 150 } : { tipo: 'p', x: 150, y: 100 } });
  return true;
}
