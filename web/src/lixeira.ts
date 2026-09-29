/**
 * Quanto tempo resta para trazer um canal de volta.
 *
 * Isto é uma regra separada e testada porque é uma PROMESSA na tela: quem lê "some em 3 dias" está
 * decidindo se resolve isso hoje ou depois do fim de semana. Errar por um dia aqui custa um canal
 * inteiro, com as mensagens de todo mundo dentro — e o erro só apareceria no dia em que já não tem
 * conserto.
 *
 * A varredura do servidor apaga o que tem `deleted_at` ANTERIOR a agora menos trinta dias (ver
 * varrerCanaisApagados, em server/src/db.ts). Então o que se conta aqui é o mesmo instante: o canal
 * vive até deleted_at + 30 dias. A contagem é em dias INTEIROS para cima — faltando 2,3 dias, a tela
 * diz 3, porque arredondar para baixo prometeria menos tempo do que existe, e a pessoa poderia
 * desistir de um canal que ainda estava lá.
 */
export function diasQueRestam(apagadoEm: string, dias: number, agora: number = Date.now()): number {
  const quando = Date.parse(apagadoEm);
  // Data ilegível é do servidor, não da pessoa: dar o prazo cheio erra para o lado de não apressar
  // ninguém, e a lista continua utilizável.
  if (Number.isNaN(quando)) return dias;
  const fim = quando + dias * 24 * 60 * 60_000;
  return Math.max(0, Math.ceil((fim - agora) / (24 * 60 * 60_000)));
}

/**
 * Quantos dias a tela PROMETE antes de perguntar ao servidor.
 *
 * O número de verdade é o do servidor (DIAS_NA_LIXEIRA, em server/src/routes.ts): é ele que a
 * varredura obedece, e é ele que vem junto na lista da lixeira e na resposta de apagar. Esta cópia
 * existe por um motivo estreito — o diálogo de excluir precisa dizer o prazo ANTES de existir qualquer
 * canal apagado para perguntar sobre.
 *
 * Duas cópias do mesmo número desandam caladas, e esta desandaria do pior jeito: o aviso prometendo
 * trinta dias e a varredura apagando em sete. Então web/test/lixeira.test.ts LÊ o arquivo do servidor
 * e compara — se alguém mudar lá, o teste falha aqui, e não a promessa na tela de alguém.
 */
export const DIAS_NA_LIXEIRA = 30;
