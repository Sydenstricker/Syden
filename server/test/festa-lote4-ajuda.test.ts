/** A jogada honesta do lote 4 (festa-lote4-ajuda.ts) faz ponto em cada microjogo do lote, com a Bia sem responder. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste } from './festa-ajuda.js';
import { jogadaHonestaDoLote4 } from './festa-lote4-ajuda.js';

for (const id of ['relampago', 'ponteriacho', 'celeiro', 'esconde', 'cabo', 'torta', 'tambor', 'revezamento']) {
  test(`lote 4: a jogada honesta de ${id} vale ponto, e quem não joga aparece com zero`, () => {
    for (let s = 0; s < 8; s++) {
      const r = rodadaDeTeste(id, { rede: new Map([[1, 100], [2, 300]]), aleatorio: Math.random });
      assert.equal(jogadaHonestaDoLote4(id, r.rodada, 1, { andar: () => r.andar(), avancar: (ms) => r.avancar(ms) }), true);
      r.ateRevelar();
      assert.equal(r.linhaDe(1).posicao, 1, `${id}: ${JSON.stringify(r.linhaDe(1))}`);
      assert.equal(r.linhaDe(2).motivo, 'nada');
    }
  });
}
test('lote 4: um id de outro lote não é daqui', () => {
  const r = rodadaDeTeste('saque');
  assert.equal(jogadaHonestaDoLote4('saque', r.rodada, 1, { andar: () => r.andar(), avancar: (ms) => r.avancar(ms) }), false);
});
