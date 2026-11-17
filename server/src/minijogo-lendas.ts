/**
 * LENDAS DA TOCA (16/11/2026): o RPG de turnos da turma. A regra mora em lendas-regras.ts (sem banco, para o teste rodá-la);
 * aqui ela ganha o banco: o avatar de cada um e o troféu da estante ('lendas').
 */
import * as db from './db.js';
import { criarLendas, type OpcoesDasLendas } from './lendas-regras.js';
import type { Definicao } from './minijogo-motor.js';

export * from './lendas-regras.js';

const servicos: NonNullable<OpcoesDasLendas['servicos']> = {
  avatarDe: (userId) => db.avatarDoJogo(userId),
  guardarTrofeu: (t) => db.guardarTrofeu(t),
};

export const lendas: Definicao = criarLendas({ servicos });
