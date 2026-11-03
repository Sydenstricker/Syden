/**
 * Endereço de teste nunca sai (email.ts, 03/11/2026): os testes de tela gastavam a cota do Resend, que é a mesma da
 * produção, mandando confirmação para "@exemplo.test".
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enderecoDeTeste } from '../src/email.js';

test('os domínios de teste ficam em rascunho', () => {
  for (const e of ['duda1@exemplo.test', 'ana@exemplo.teste', 'x@example.com', 'y@mail.example.org', 'z@foo.invalid', 'w@pc.localhost', 'k@EXEMPLO.TEST']) {
    assert.equal(enderecoDeTeste(e), true, e);
  }
});

test('os de verdade saem', () => {
  for (const e of ['fulano@gmail.com', 'alguem@syden.chat', 'a@testes.com.br', 'b@exemplos.com', 'c@meuexample.com', 'd@contest.org']) {
    assert.equal(enderecoDeTeste(e), false, e);
  }
});
