import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GENEROS, generosDe, naFicha } from '../src/FicharioDeGeneros';
import { JOGOS } from '../src/minijogos';

test('o fichário: todo jogo da estante tem gênero, e todo gênero usado existe', () => {
  const ids = new Set(GENEROS.map((g) => g.id));
  // (o jogo sem aba saiu da estante: só o nome dele continua, para os troféus antigos)
  for (const jogo of JOGOS.filter((j) => j.abas.length > 0)) {
    const g = generosDe(jogo.id);
    assert.ok(g.length > 0, `o jogo ${jogo.id} não tem gênero no fichário (GENEROS_DOS_JOGOS)`);
    for (const x of g) assert.ok(ids.has(x), `${jogo.id}: gênero ${x} não existe`);
  }
});

test('o Minigolfe da toca saiu da estante (20/11/2026): sem aba e sem ficha, mas com o nome para os troféus', () => {
  const golfe = JOGOS.find((j) => j.id === 'golfe');
  assert.ok(golfe, 'a linha fica, pelo nome');
  assert.deepEqual(golfe.abas, []);
  assert.deepEqual(generosDe('golfe'), []);
  assert.deepEqual(JOGOS.find((j) => j.id === 'golfe3d')?.abas, ['solo', 'coletivo']);
});

test('a ficha filtra, e a ficha sem jogo aqui mostra tudo', () => {
  const jogos = JOGOS.filter((j) => j.abas.length > 0).map((j) => ({ id: j.id }));
  assert.ok(naFicha(jogos, 'mesa').every((j) => generosDe(j.id).includes('mesa')));
  assert.ok(naFicha(jogos, 'mesa').some((j) => j.id === 'truco'));
  assert.equal(naFicha(jogos, null).length, jogos.length);
  assert.equal(naFicha([{ id: 'truco' }], 'esporte').length, 1, 'sem jogo de esporte aqui: a estante não fica vazia');
});
