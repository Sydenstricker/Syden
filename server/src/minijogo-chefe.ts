/**
 * O CHEFE DA TURMA (05/11/2026): a turma inteira contra a toupeira-rei. A regra mora em server/src/chefe/motor.ts (sem banco,
 * para o teste do site rodá-la); aqui ela ganha o banco: o avatar de cada um e o troféu da estante ('chefe').
 */
import * as db from './db.js';
import { criarChefe, type OpcoesDoChefe } from './chefe/motor.js';
import type { Definicao } from './minijogo-motor.js';

export * from './chefe/motor.js';
export * from './chefe/conta.js';

const servicos: NonNullable<OpcoesDoChefe['servicos']> = {
  avatarDe: (userId) => db.avatarDoJogo(userId),
  guardarTrofeu: (t) => db.guardarTrofeu(t),
};

/** Com o banco (o avatar e o troféu); as outras opções, trocáveis no teste. */
export const criarChefeComBanco = (opcoes: Omit<OpcoesDoChefe, 'servicos'> = {}): Definicao => criarChefe({ ...opcoes, servicos });

export const chefe: Definicao = criarChefeComBanco();
