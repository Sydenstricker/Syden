/**
 * O LOTE C DA SEGUNDA AUDITORIA (20/11/2026), o lado da tela: o que a tela sabe das variantes é o mesmo que o servidor sabe.
 * A régua do truco mineiro segue a força do servidor; os mares da Batalha naval e a Copa do Celeiro são as mesmas listas.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ehManilha, MANILHAS_MINEIRAS, MINEIRO, reguaDaForca } from '../src/contasDasMesas';
import { casasDoNavio, encosta, inicioDoNavio, MARES, MARES_DA_NAVAL } from '../src/naval3d/montagem';
import { COPA_DO_CELEIRO, TORRES, TORRES_DA_COPA } from '../src/torre/fases';
import * as truco from '../../server/src/minijogo-truco';
import * as naval from '../../server/src/minijogo-naval';
import * as torre from '../../server/src/torre';

test('o truco mineiro: a régua segue a força do servidor, e a marca da manilha só nas quatro fixas', () => {
  assert.equal(MINEIRO, truco.MINEIRO);
  assert.deepEqual([...MANILHAS_MINEIRAS], [...truco.MANILHAS_MINEIRAS]);
  const { valores, manilhas } = reguaDaForca(MINEIRO);
  // cada valor por uma carta dele que não é manilha (o 4 de ouros, não o de paus)
  const comum = (v: string) => truco.NAIPES.map((n) => `${v}${n}`).find((c) => !(MANILHAS_MINEIRAS as readonly string[]).includes(c))!;
  const cartas = [...valores.map(comum), ...manilhas];
  assert.equal(cartas.length, 14);
  for (let k = 1; k < cartas.length; k++) assert.ok(truco.forca(cartas[k], MINEIRO) > truco.forca(cartas[k - 1], MINEIRO), `${cartas[k - 1]} < ${cartas[k]}`);
  for (const c of truco.baralho()) {
    assert.equal(ehManilha(c, MINEIRO), truco.forca(c, MINEIRO) >= 100, c);
    assert.equal(ehManilha(c, '7'), truco.forca(c, '7') >= 100, c);
  }
});

test('a Batalha naval: os mares da tela são os do servidor, e as contas da montagem batem em cada mar', () => {
  assert.deepEqual(
    Object.entries(MARES).map(([n, f]) => [n, [...f]]),
    Object.entries(naval.MARES).map(([n, f]) => [n, [...f]]),
  );
  assert.deepEqual(
    MARES_DA_NAVAL.map((m) => m.lado),
    [8, 10, 12],
  );
  for (const n of [8, 10, 12]) {
    for (let casa = 0; casa < n * n; casa++) {
      for (const deitado of [true, false]) {
        assert.deepEqual(casasDoNavio(casa, 4, deitado, n), naval.casasDoNavio(casa, 4, deitado, n));
        const inicio = inicioDoNavio(casa, 1, 3, deitado, n);
        assert.ok(casasDoNavio(inicio, 3, deitado, n), 'o navio empurrado cabe no mar');
      }
    }
    const frota = naval.sortearFrota(Math.random, [], n);
    for (const [i, navio] of frota.entries()) assert.equal(encosta(navio, frota.filter((_, k) => k !== i), n), naval.encosta(navio, frota.filter((_, k) => k !== i), n));
  }
});

test('a Copa do Celeiro: as torres da tela são as do servidor, na mesma ordem', () => {
  assert.equal(COPA_DO_CELEIRO, torre.COPA_DO_CELEIRO);
  assert.deepEqual(TORRES_DA_COPA, torre.TORRES_DA_COPA);
  assert.deepEqual(
    TORRES.map((t) => t.id),
    TORRES_DA_COPA,
  );
});
