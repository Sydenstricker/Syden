/** Bate quando der a flor (festa/flor.ts): a próxima figura só vai quando sai, e bater na errada elimina. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste } from './festa-ajuda.js';
import { FIGURAS, FLOR, FLORES, PARECIDA, type DadosFlor } from '../src/festa/flor.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;
const CAIO = 3;

const figurasDe = (r: ReturnType<typeof rodadaDeTeste>, quem = ANA) => (r.rodada.publico(quem).dados as DadosFlor).figuras;

test('flor: as figuras saem uma a uma, e a lista toda só na revelação', () => {
  const r = rodadaDeTeste('flor', { aleatorio: Math.random });
  assert.equal(figurasDe(r).length, 1, 'só a primeira no começo');
  r.andar();
  assert.equal(figurasDe(r).length, 2);
  r.ateRevelar();
  const todas = figurasDe(r);
  assert.equal(todas.length, FIGURAS);
  assert.equal(todas.filter((f) => f.tipo === FLOR).length, FLORES);
  assert.ok(todas.some((f) => f.tipo === PARECIDA));
  assert.ok(todas.slice(0, 3).every((f) => f.tipo !== FLOR), 'nunca flor logo de cara');
  assert.ok(todas.every((f, i) => i === 0 || f.tipo !== todas[i - 1].tipo), 'a mesma figura duas vezes seguidas não se vê trocar');
});

test('flor: a Ana bate em todas as flores, a Bia na parecida (sai), o Caio reage mais devagar', () => {
  const r = rodadaDeTeste('flor', { rede: new Map([[ANA, 200], [BIA, 300], [CAIO, 250]]) });
  for (let n = 0; n < FIGURAS + 2 && r.rodada.publico(ANA).fase === 'jogando'; n++) {
    const saiu = r.agora();
    const figuras = figurasDe(r, ANA);
    figurasDe(r, BIA);
    figurasDe(r, CAIO);
    const i = figuras.length - 1;
    if (figuras[i].tipo === FLOR) {
      r.em(saiu - r.largou + 100 + 280);
      r.rodada.acao(ANA, { tipo: 'acerto', i, reacaoMs: 280 });
      r.em(saiu - r.largou + 400 + 250);
      r.rodada.acao(CAIO, { tipo: 'acerto', i, reacaoMs: 400 });
    }
    if (figuras[i].tipo === PARECIDA) r.rodada.acao(BIA, { tipo: 'acerto', i, reacaoMs: 300 });
    r.em(saiu - r.largou);
    r.andar();
  }
  r.ateRevelar();
  assert.equal(r.linhaDe(ANA).valor, FLORES);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(CAIO).valor, FLORES);
  assert.equal(r.linhaDe(CAIO).posicao, 2, 'as mesmas flores, a soma das reações desempata');
  assert.equal(r.linhaDe(BIA).motivo, 'errou');
});

test('flor: bater numa figura que ainda não saiu, ou com a reação maior do que o tempo que passou, não vale', () => {
  const r = rodadaDeTeste('flor');
  figurasDe(r, ANA);
  // a próxima ainda não saiu (e a Ana não sabe qual é): não conta, nem elimina
  r.rodada.acao(ANA, { tipo: 'acerto', i: 5, reacaoMs: 300 });
  // anda até a primeira flor
  while (figurasDe(r).at(-1)!.tipo !== FLOR) r.andar();
  const i = figurasDe(r, BIA).length - 1;
  r.avancar(200);
  r.rodada.acao(BIA, { tipo: 'acerto', i, reacaoMs: 900 });
  r.rodada.acao(ANA, { tipo: 'acerto', i, reacaoMs: 40 });
  r.ateRevelar();
  assert.equal(r.linhaDe(BIA).motivo, 'nada', '900 ms de reação em 200 ms não cabem: não contou');
  assert.equal(r.linhaDe(ANA).motivo, 'cedo', '40 ms é chute');
});

test('flor: o robô não bate em flor que ainda não saiu', () => {
  const r = rodadaDeTeste('flor');
  r.ateRevelar();
  const dados = r.rodada.publico(ANA).dados as DadosFlor;
  const primeira = dados.figuras.find((f) => f.tipo === FLOR)!.t;
  for (let k = 0; k < 50; k++) {
    const rob = resultadoDoRobo('flor', dados, Math.random, primeira);
    assert.ok(rob.motivo !== null || (rob.valor ?? 0) === 0);
  }
});
