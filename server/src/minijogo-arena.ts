/**
 * A ARENA DOS COELHOS (17/11/2026): o modo de luta em tempo real dos Bichos da Toca. A regra mora em server/src/arena/motor.ts
 * (sem banco, para o teste rodá-la); aqui ela ganha o banco: o avatar de cada um, a equipe guardada na aventura (os três da
 * frente) e o troféu da estante ('bichos-arena').
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
};

/** Com o banco; as outras opções, trocáveis no teste. */
export const criarArenaComBanco = (opcoes: Omit<OpcoesDaArena, 'servicos'> = {}): Definicao => criarArena({ ...opcoes, servicos });

export const arena: Definicao = criarArenaComBanco();
