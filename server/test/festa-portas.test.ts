/** Quem está em qual toca? (festa/portas.ts): os passeios vão prontos, o bicho perguntado só no fim. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { BICHOS, FORA, fimDosPasseios, ondeFica, PASSEIOS, TOCAS, type DadosPortas } from '../src/festa/portas.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;
const CAIO = 3;

test('portas: os passeios fazem sentido, e o perguntado está numa toca', () => {
  for (let s = 1; s <= 50; s++) {
    const r = rodadaDeTeste('portas', { aleatorio: sorteioFixo(s) });
    const d = r.rodada.publico(ANA).dados as DadosPortas;
    assert.equal(d.pergunta, -1);
    assert.equal(new Set(d.bichos).size, BICHOS);
    assert.equal(d.passeios.length, PASSEIOS);
    const lugar = d.bichos.map(() => FORA);
    for (const p of d.passeios) {
      assert.equal(p.de, lugar[p.b], 'sai de onde estava');
      assert.notEqual(p.para, p.de, 'vai para outro lugar');
      assert.ok(p.para === FORA || (p.para >= 0 && p.para < TOCAS));
      lugar[p.b] = p.para;
    }
    assert.ok(d.passos.every((ms, k) => k === 0 || ms <= d.passos[k - 1]), 'cada vez mais rápido');
    r.andar();
    const depois = r.rodada.publico(ANA).dados as DadosPortas;
    assert.notEqual(ondeFica(depois)[depois.pergunta], FORA);
  }
});

test('portas: a toca certa e rápida ganha', () => {
  const r = rodadaDeTeste('portas', { rede: new Map([[ANA, 200], [BIA, 300], [CAIO, 250]]) });
  r.andar();
  const d = r.rodada.publico(ANA).dados as DadosPortas;
  const fim = fimDosPasseios(d);
  const certa = ondeFica(d)[d.pergunta];
  r.em(fim + 1500 + 300);
  r.rodada.acao(BIA, { tipo: 'resultado', toca: certa, t: fim + 1500 });
  r.em(fim + 800 + 250);
  r.rodada.acao(CAIO, { tipo: 'resultado', toca: (certa + 1) % TOCAS, t: fim + 800 });
  r.em(fim + 1900 + 200);
  r.rodada.acao(ANA, { tipo: 'resultado', toca: certa, t: fim + 1900 });
  assert.deepEqual(r.linhas().map((l) => [l.userId, l.posicao, l.valor]), [
    [BIA, 1, 1500],
    [ANA, 2, 1900],
    [CAIO, null, null],
  ]);
  assert.equal(r.rodada.publico(ANA).resposta, certa);
});

test('portas: responder antes do fim dos passeios, ou fora das tocas, não vale', () => {
  const r = rodadaDeTeste('portas');
  r.em(3000);
  r.rodada.acao(ANA, { tipo: 'resultado', toca: 0, t: 3000 });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'invalido');
  r.andar();
  const fim = fimDosPasseios(r.rodada.publico(BIA).dados as DadosPortas);
  r.em(fim + 500);
  r.rodada.acao(BIA, { tipo: 'resultado', toca: 3, t: fim + 400 });
  assert.equal(r.rodada.publico(BIA).meu?.motivo, 'invalido');
});

test('portas: o robô erra às vezes', () => {
  const r = rodadaDeTeste('portas');
  const dados = r.rodada.publico(ANA).dados;
  const erros = Array.from({ length: 300 }, () => resultadoDoRobo('portas', dados, Math.random)).filter((x) => x.motivo === 'errou').length;
  assert.ok(erros > 30 && erros < 150);
});
