// O nome dos emojis da comunidade (nomeDoEmoji.ts, 03/11/2026: "tentei fazer o coração e não saiu").
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nomeDeEmoji } from '../src/nomeDoEmoji';

test('acento e maiúscula viram o nome guardado', () => {
  assert.equal(nomeDeEmoji('Coração'), 'coracao');
  assert.equal(nomeDeEmoji('pão de açúcar'), 'pao_de_acucar');
  assert.equal(nomeDeEmoji('Pepe Triste'), 'pepe_triste');
  assert.equal(nomeDeEmoji('  __ok__ '), 'ok');
});
