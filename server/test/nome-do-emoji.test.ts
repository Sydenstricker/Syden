// O nome dos emojis da comunidade e dos pacotes, a mesma regra (nome-do-emoji.ts, 03/11/2026).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nomeDeEmoji } from '../src/nome-do-emoji.js';

test('"coração" é coracao, e não cora_o', () => {
  assert.equal(nomeDeEmoji('coração'), 'coracao');
  assert.equal(nomeDeEmoji('Pão de Açúcar'), 'pao_de_acucar');
  assert.equal(nomeDeEmoji('x'), null);
  assert.equal(nomeDeEmoji('a'.repeat(33)), null);
});
