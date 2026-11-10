// O TOQUE DE CADA PESSOA E OS GRUPOS (09/11/2026, pedido dele): o toque que soa é o escolhido para a pessoa, senão o do grupo
// dela, senão o padrão. "Silenciar" é um toque como os outros.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toqueDe } from '../src/toquesDeLigacao';

const guardado = {
  grupos: [
    { id: 'cs', nome: 'CS', toque: 'bipe' as const },
    { id: 'fac', nome: 'Faculdade', toque: 'silencio' as const },
  ],
  pessoas: {
    '1': { grupo: 'cs' },
    '2': { grupo: 'cs', toque: 'suave' as const },
    '3': { toque: 'silencio' as const },
    '4': { grupo: 'fac' },
  },
};

test('o da pessoa vale mais que o do grupo, e o do grupo mais que o padrão', () => {
  assert.equal(toqueDe(1, guardado), 'bipe');
  assert.equal(toqueDe(2, guardado), 'suave');
  assert.equal(toqueDe(3, guardado), 'silencio');
  assert.equal(toqueDe(4, guardado), 'silencio');
  assert.equal(toqueDe(99, guardado), 'padrao');
});
