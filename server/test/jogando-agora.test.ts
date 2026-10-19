import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  PRAZO_MS,
  esquecerServidor,
  esquecerTudoDoJogando,
  jogandoNaComunidade,
  marcarJogando,
  tirarJogando,
  varrerJogando,
} from '../src/jogando-agora.js';

const sempre = () => true;
beforeEach(esquecerTudoDoJogando);

test('uma pessoa está num servidor só por comunidade: marcar outro troca', () => {
  marcarJogando(1, 10, 100, 0);
  marcarJogando(1, 10, 200, 1);
  assert.equal(jogandoNaComunidade(1).get(100), undefined);
  assert.equal(jogandoNaComunidade(1).get(200)?.length, 1);
});

test('some sozinho depois do prazo, e marcar de novo recomeça o prazo', () => {
  marcarJogando(1, 10, 100, 0);
  marcarJogando(1, 11, 100, 0);
  marcarJogando(1, 11, 100, PRAZO_MS - 1000);
  assert.deepEqual(varrerJogando(sempre, sempre, PRAZO_MS), [1]);
  assert.deepEqual(jogandoNaComunidade(1).get(100)?.map((j) => j.userId), [11]);
});

test('recarregar a página não apaga; fechar o Syden apaga na segunda varredura', () => {
  marcarJogando(1, 10, 100, 0);
  let aberto = false;
  assert.deepEqual(varrerJogando(() => aberto, sempre, 60_000), [], 'a primeira varredura sem o Syden só anota');
  aberto = true;
  assert.deepEqual(varrerJogando(() => aberto, sempre, 120_000), [], 'voltou: a anotação some');
  aberto = false;
  varrerJogando(() => aberto, sempre, 180_000);
  assert.deepEqual(varrerJogando(() => aberto, sempre, 240_000), [1]);
  assert.equal(jogandoNaComunidade(1).size, 0);
});

test('quem saiu da comunidade sai da lista; servidor apagado leva quem estava nele', () => {
  marcarJogando(1, 10, 100, 0);
  marcarJogando(1, 11, 200, 0);
  assert.deepEqual(varrerJogando(sempre, (_c, u) => u !== 10, 1), [1]);
  assert.equal(esquecerServidor(1, 200), true);
  assert.equal(jogandoNaComunidade(1).size, 0);
  assert.equal(tirarJogando(1, 11), false);
});
