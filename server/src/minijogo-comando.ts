/**
 * O COMANDO CENOURA (16/11/2026): correr e atirar de lado, em turma. A regra mora em server/src/comando/motor.ts (sem banco,
 * para o teste rodá-la); aqui ela ganha o banco: o avatar de cada um e o troféu da estante ('comando').
 */
import * as db from './db.js';
import { criarComando, type OpcoesDoComando } from './comando/motor.js';
import type { Definicao } from './minijogo-motor.js';

export * from './comando/motor.js';
export * from './comando/conta.js';

const servicos: NonNullable<OpcoesDoComando['servicos']> = {
  avatarDe: (userId) => db.avatarDoJogo(userId),
  guardarTrofeu: (t) => db.guardarTrofeu(t),
};

/** Com o banco (o avatar e o troféu); as outras opções, trocáveis no teste. */
export const criarComandoComBanco = (opcoes: Omit<OpcoesDoComando, 'servicos'> = {}): Definicao => criarComando({ ...opcoes, servicos });

export const comando: Definicao = criarComandoComBanco();
