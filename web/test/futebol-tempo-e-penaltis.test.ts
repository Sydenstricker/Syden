/**
 * O Futebol dos coelhos, a segunda auditoria (20/11/2026): o tempo de jogo e o gol de ouro na simulação (as duas cópias, ver
 * futebol.test.ts), e os pênaltis da mini-copa do Solo (web/src/futebol/penaltis.ts, só do site).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as sim from '../src/futebol/sim';
import { ALTA, chute, chuteDoRobo, decidido, defesa, FORTE, FRACA, mergulhoDoGoleiro } from '../src/futebol/penaltis';

const parado = (m: sim.Mundo) => {
  while (!m.fim) sim.passoDoMundo(m, () => sim.NADA);
  return m;
};

test('o tempo de jogo: a partida acaba nos passos escolhidos', () => {
  const m = parado(sim.novoMundo([[-1], [-2]], 1, 2 * 60 * sim.PASSOS_POR_SEGUNDO));
  assert.equal(m.passo, 2 * 60 * sim.PASSOS_POR_SEGUNDO);
  const padrao = parado(sim.novoMundo([[-1], [-2]]));
  assert.equal(padrao.passo, sim.PARTIDA_PASSOS, 'sem escolher, os 3 minutos de sempre');
});

test('o gol de ouro: o empate vai à prorrogação; sem gol nela, fica o empate', () => {
  const m = parado(sim.novoMundo([[-1], [-2]], 1, 600, true));
  assert.equal(m.passo, 600 + sim.PRORROGACAO_PASSOS);
  assert.equal(m.prorrogacao, true);
  assert.deepEqual(m.placar, [0, 0]);
  // sem o gol de ouro, acaba no tempo
  const sem = parado(sim.novoMundo([[-1], [-2]], 1, 600, false));
  assert.equal(sem.passo, 600);
});

test('o gol de ouro: na prorrogação, o primeiro gol acaba a partida', () => {
  const m = sim.novoMundo([[-1], [-2]], 1, 600, true);
  while (!m.prorrogacao) sim.passoDoMundo(m, () => sim.NADA);
  assert.equal(m.fim, false);
  sim.marcarGol(m, 1);
  assert.equal(m.fim, true);
  assert.ok(m.eventos.some((e) => e.tipo === 'fim'));
  // com placar diferente no fim do tempo, não há prorrogação
  const n = sim.novoMundo([[-1], [-2]], 1, 600, true);
  sim.marcarGol(n, 0);
  parado(n);
  assert.equal(n.prorrogacao, false);
  assert.equal(n.passo, 600);
});

test('pênaltis: fraca o goleiro pega, forte demais vai por cima, no canto com força nem o pulo certo pega', () => {
  assert.equal(chute(0, FRACA - 0.01, 2), 'defesa');
  assert.equal(chute(0, ALTA + 0.01, 2), 'fora');
  assert.equal(chute(0, 0.5, 2), 'gol');
  assert.equal(chute(0, 0.5, 0), 'defesa');
  assert.equal(chute(0, FORTE, 0), 'gol', 'no canto, com força');
  assert.equal(chute(1, FORTE, 1), 'defesa', 'no meio, não');
  assert.equal(defesa({ canto: 2, fora: false }, 2), 'defesa');
  assert.equal(defesa({ canto: 2, fora: false }, 0), 'gol');
  assert.equal(defesa({ canto: 2, fora: true }, 0), 'fora');
});

test('pênaltis: o goleiro e o cobrador robôs sorteiam com as chances certas', () => {
  let s = 1;
  const aleatorio = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let certos = 0;
  for (let i = 0; i < 3000; i++) if (mergulhoDoGoleiro(0, 0, aleatorio) === 0) certos++;
  assert.ok(certos / 3000 > 0.26 && certos / 3000 < 0.34, `${certos}`);
  let fora = 0;
  const cantos = [0, 0, 0];
  for (let i = 0; i < 3000; i++) {
    const r = chuteDoRobo(aleatorio);
    cantos[r.canto]++;
    if (r.fora) fora++;
  }
  assert.ok(fora / 3000 > 0.07 && fora / 3000 < 0.13);
  assert.ok(cantos.every((n) => n > 850));
});

test('pênaltis: acaba quando não há mais como virar, e as alternadas depois das cinco', () => {
  const v = true;
  const x = false;
  assert.equal(decidido([v, v, v], [x, x, x]), 0, '3 a 0 com duas para cada: não alcança');
  assert.equal(decidido([v, v, v], [x, x]), null, 'o robô ainda tem três');
  assert.equal(decidido([v, v, v, v, v], [v, v, v, v, v]), null, 'empatou nas cinco');
  assert.equal(decidido([v, v, v, v, v, x], [v, v, v, v, v]), null, 'errei a alternada, o robô ainda cobra');
  assert.equal(decidido([v, v, v, v, v, x], [v, v, v, v, v, v]), 1);
  assert.equal(decidido([v, v, v, v, v, v], [v, v, v, v, v, x]), 0);
  assert.equal(decidido([x, x, x, x, x], [x, x, x, x, v]), 1);
});
