/**
 * A ARENA DOS COELHOS (17/11/2026): o modo de luta em tempo real dos Bichos da Toca. A regra mora em server/src/arena/motor.ts
 * (sem banco, para o teste rodá-la); aqui ela ganha o banco: o avatar de cada um, a equipe guardada na aventura (os três da
 * frente), o troféu da estante ('bichos-arena') e o recorde de vitórias seguidas do Solo (a tabela comum).
 */
import * as db from './db.js';
import { criarArena, type OpcoesDaArena } from './arena/motor.js';
import { lerAventura } from './minijogo-bichos.js';
import type { Definicao } from './minijogo-motor.js';

export * from './arena/motor.js';
export * from './arena/conta.js';

const servicos: NonNullable<OpcoesDaArena['servicos']> = {
  avatarDe: (userId) => db.avatarDoJogo(userId),
  equipeDe: (userId) => lerAventura(db.aventuraDosBichos(userId))?.equipe.map((b) => b.especie) ?? [],
  guardarTrofeu: (t) => db.guardarTrofeu(t),
  // as vitórias seguidas do Solo (20/11/2026): a tabela comum, maior é melhor; o valor é o que o motor contou
  recordeDoSolo: (userId, variante) => db.recordeDoSolo(userId, 'bichos-arena', variante)?.valor ?? null,
  guardarRecorde: (userId, variante, valor) => db.guardarRecordeDoSolo(userId, 'bichos-arena', variante, valor, false),
};

/** Com o banco; as outras opções, trocáveis no teste. */
export const criarArenaComBanco = (opcoes: Omit<OpcoesDaArena, 'servicos'> = {}): Definicao => criarArena({ ...opcoes, servicos });

export const arena: Definicao = criarArenaComBanco();
