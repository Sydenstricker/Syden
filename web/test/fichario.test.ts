import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GENEROS, generosDe, naFicha } from '../src/FicharioDeGeneros';
import { JOGOS } from '../src/minijogos';

test('o fichário: todo jogo da estante tem gênero, e todo gênero usado existe', () => {
  const ids = new Set(GENEROS.map((g) => g.id));
  for (const jogo of JOGOS) {
    const g = generosDe(jogo.id);
    assert.ok(g.length > 0, `o jogo ${jogo.id} não tem gênero no fichário (GENEROS_DOS_JOGOS)`);
    for (const x of g) assert.ok(ids.has(x), `${jogo.id}: gênero ${x} não existe`);
  }
});

test('a ficha filtra, e a ficha sem jogo aqui mostra tudo', () => {
  const jogos = JOGOS.map((j) => ({ id: j.id }));
  assert.ok(naFicha(jogos, 'mesa').every((j) => generosDe(j.id).includes('mesa')));
  assert.ok(naFicha(jogos, 'mesa').some((j) => j.id === 'truco'));
  assert.equal(naFicha(jogos, null).length, jogos.length);
  assert.equal(naFicha([{ id: 'truco' }], 'esporte').length, 1, 'sem jogo de esporte aqui: a estante não fica vazia');
});
