/**
 * LENDAS DA TOCA (16/11/2026): o RPG de turnos da turma. A regra mora em lendas-regras.ts (sem banco, para o teste rodá-la);
 * aqui ela ganha o banco: o avatar de cada um, o troféu da estante ('lendas') e o recorde do Solo (a tabela comum).
 */
import * as db from './db.js';
import { criarLendas, type OpcoesDasLendas } from './lendas-regras.js';
import type { Definicao } from './minijogo-motor.js';

export * from './lendas-regras.js';

const servicos: NonNullable<OpcoesDasLendas['servicos']> = {
  avatarDe: (userId) => db.avatarDoJogo(userId),
  guardarTrofeu: (t) => db.guardarTrofeu(t),
  // o recorde do Solo (19/11/2026), na tabela comum: as rodadas até o dragão, contadas pelo servidor
  // (21/11/2026: a variante é o nível de desafio; o 0 continua na de sempre)
  guardarRecorde: (userId, rodadas, extra, variante) => db.guardarRecordeDoSolo(userId, 'lendas', variante, rodadas, true, extra),
};

export const lendas: Definicao = criarLendas({ servicos });
