/**
 * O RECORDE DO SOLO PELA TABELA COMUM (db.ts, `solo_recordes`), SEM PRENDER O JOGO AO BANCO NA IMPORTAÇÃO (19/11/2026).
 *
 * Os jogos de palavra (Sudoku, Palavra secreta, quizzes) são importados pelos testes do site e por testes do servidor que não
 * sobem o banco: importar db.js no topo abriria o arquivo do banco de verdade. Por isso o banco entra só aqui, por import
 * dinâmico, e só numa partida do Solo. O valor que vai ao banco é SEMPRE o que o jogo calculou no servidor.
 */
import type { RecordeDoSolo } from './db.js';

export type ResultadoDoRecorde = { antes: number | null; novo: boolean };

/** Lê o recorde atual (para a tela mostrar antes de terminar). */
export function lerRecordeDoSolo(userId: number, jogo: string, variante: string, depois: (r: RecordeDoSolo | null) => void) {
  void import('./db.js')
    .then((db) => depois(db.recordeDoSolo(userId, jogo, variante)))
    .catch(() => {});
}

/** Guarda se for o melhor; `depois` recebe o de antes e se virou recorde. */
export function guardarRecordeDoSolo(
  userId: number,
  jogo: string,
  variante: string,
  valor: number,
  menorMelhor: boolean,
  extra: unknown,
  depois: (r: ResultadoDoRecorde) => void,
) {
  void import('./db.js')
    .then((db) => depois(db.guardarRecordeDoSolo(userId, jogo, variante, valor, menorMelhor, extra)))
    .catch(() => {});
}
