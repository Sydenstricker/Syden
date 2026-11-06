/** Destampe os potes (festa/potes.ts): cada pote aberto vale na hora, com tempo de mão para as voltas dele. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste } from './festa-ajuda.js';
import { GIRO_MINIMO_MS, POTES_MS, type DadosPotes } from '../src/festa/potes.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

test('potes: quem gira mais depressa abre mais potes (com 200 e 300 ms de rede)', () => {
  const r = rodadaDeTeste('potes');
  const { potes } = r.rodada.publico(ANA).dados as DadosPotes;
  const eventos: [number, number, Record<string, unknown>][] = [];
  // a Ana gira a cada 110 ms; a Bia a cada 160 ms, e erra o lado no terceiro pote
  for (const [quem, giro, rede] of [[ANA, 110, 200], [BIA, 160, 300]]) {
    let t = 500;
    for (let i = 0; i < potes.length; i++) {
      t += potes[i].voltas * giro + (quem === BIA && i === 2 ? 2 * giro : 0) + 150;
      if (t > POTES_MS) break;
      eventos.push([t + rede, quem, { tipo: 'acerto', i, t }]);
    }
    eventos.push([POTES_MS + rede, quem, { tipo: 'resultado' }]);
  }
  for (const [em, quem, corpo] of eventos.sort((a, b) => a[0] - b[0])) {
    r.em(em);
    r.rodada.acao(quem, corpo);
  }
  const ana = r.linhaDe(ANA);
  const bia = r.linhaDe(BIA);
  assert.ok((ana.valor ?? 0) >= 15, `a Ana abriu ${ana.valor}`);
  assert.ok((bia.valor ?? 0) < (ana.valor ?? 0));
  assert.deepEqual([ana.posicao, bia.posicao], [1, 2]);
});

test('potes: pular pote, abrir rápido demais, ou mandar a lista no fim, não vale', () => {
  const r = rodadaDeTeste('potes');
  const { potes } = r.rodada.publico(ANA).dados as DadosPotes;
  // pular o primeiro
  r.em(2000);
  r.rodada.acao(ANA, { tipo: 'acerto', i: 1, t: 1900 });
  // vinte potes em 20 ms (o console)
  for (let i = 0; i < 20; i++) r.rodada.acao(BIA, { tipo: 'acerto', i, t: 1900 + i });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).motivo, 'errou');
  assert.equal(r.linhaDe(BIA).valor, 1, 'só o primeiro (que teve tempo de mão)');
  // a lista certinha mandada no fim
  const s = rodadaDeTeste('potes');
  s.em(POTES_MS);
  let t = 400;
  for (let i = 0; i < 10; i++) s.rodada.acao(ANA, { tipo: 'acerto', i, t: (t += potes[i].voltas * GIRO_MINIMO_MS * 2) });
  s.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(s.rodada.publico(ANA).meu?.motivo, 'errou');
});

test('potes: o robô não abre mais do que caberia no tempo', () => {
  const r = rodadaDeTeste('potes');
  const dados = r.rodada.publico(ANA).dados;
  for (let k = 0; k < 100; k++) {
    assert.equal(resultadoDoRobo('potes', dados, Math.random, 300).motivo, 'errou');
    const bom = resultadoDoRobo('potes', dados, Math.random, POTES_MS).valor ?? 0;
    assert.ok(bom >= 8 && bom <= 22, `o robô abriu ${bom}`);
  }
});

test('potes: dois potes que chegam trocados pela rede valem os dois', () => {
  const r = rodadaDeTeste('potes');
  const { potes } = r.rodada.publico(ANA).dados as DadosPotes;
  // dois potes abertos depressa (um giro a cada 65 ms), mandados com um instante de diferença: o segundo chega antes
  const t0 = 400 + potes[0].voltas * 65;
  const t1 = t0 + potes[1].voltas * 65;
  r.em(t1 + 150);
  r.rodada.acao(ANA, { tipo: 'acerto', i: 1, t: t1 });
  r.rodada.acao(ANA, { tipo: 'acerto', i: 0, t: t0 });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(r.rodada.publico(ANA).meu?.valor, 2);
});
