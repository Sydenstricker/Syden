import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as sim from '../src/planador/sim.ts';

/** O Planador da toca: a regra (planador/sim.ts), que é a mesma do servidor, e o piloto automático. */

const voar = (d: sim.Desafio, piloto: (v: sim.Voo) => number) => {
  const v = sim.novoVoo(d);
  const g = sim.gravador();
  while (!v.fim) {
    const c = piloto(v);
    g.anotar(c);
    sim.passo(v, c);
  }
  return { v, entradas: g.entradas };
};

test('a regra é o MESMO arquivo no site e no servidor, byte a byte', () => {
  const site = readFileSync(new URL('../src/planador/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/planador-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'mexeu num, copie no outro');
});

test('dentro do voo, nada de seno, cosseno, sorteio nem relógio', () => {
  const texto = readFileSync(new URL('../src/planador/sim.ts', import.meta.url), 'utf8');
  for (const proibido of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.random', 'Date.now', 'performance.now', 'Math.pow']) {
    assert.ok(!texto.includes(proibido), proibido);
  }
});

for (const d of sim.DESAFIOS) {
  test(`${d.id}: o piloto automático passa por todos os anéis e pousa de leve no alvo`, () => {
    const { v } = voar(d, sim.pilotoAutomatico);
    const r = v.fim!;
    assert.equal(r.como, 'pousou', JSON.stringify(r));
    assert.equal(r.aneis, d.aneis.length, 'todos os anéis');
    assert.ok(r.precisao >= 25, `perto do alvo: ${r.distancia} m`);
    assert.ok(r.suavidade > 0, 'de leve');
    assert.equal(r.total, r.pontosAneis + r.precisao + r.suavidade + r.bonus);
  });

  test(`${d.id}: refazer os mesmos comandos dá os mesmos pontos (o fantasma e o servidor)`, () => {
    const { v, entradas } = voar(d, sim.pilotoAutomatico);
    assert.ok(sim.entradasValidas(entradas, d));
    assert.deepEqual(sim.refazer(d, entradas).fim, v.fim);
    const ler = sim.leitor(entradas);
    const f = sim.novoVoo(d);
    while (!f.fim) sim.passo(f, ler());
    assert.deepEqual(f.fim, v.fim);
  });
}

test('a asa mergulhando até o chão bate: só os anéis valem', () => {
  const d = sim.desafioPorId('asa-1')!;
  const { v } = voar(d, () => sim.CIMA);
  assert.equal(v.fim!.como, 'batida');
  assert.equal(v.fim!.total, v.fim!.pontosAneis);
});

test('o salto sem abrir o paraquedas é batida', () => {
  const { v } = voar(sim.desafioPorId('queda-1')!, () => 0);
  assert.equal(v.fim!.como, 'batida');
});

test('a mochila: o combustível acaba, e quem não decola não pousa (o tempo acaba)', () => {
  const d = sim.desafioPorId('mochila-1')!;
  const parado = voar(d, () => 0).v;
  assert.equal(parado.fim!.como, 'tempo');
  assert.equal(parado.h, 0);
  const v = sim.novoVoo(d);
  while (!v.fim && v.combustivel > 0) sim.passo(v, sim.BOTAO | sim.CIMA);
  assert.equal(v.combustivel, 0);
  sim.passo(v, sim.BOTAO);
  assert.equal(v.jato, 0, 'sem combustível, o jato não acende');
  const pulo = sim.novoVoo(d);
  for (let i = 0; i < 180; i++) sim.passo(pulo, sim.BOTAO);
  while (!pulo.fim) sim.passo(pulo, 0);
  assert.equal(pulo.fim!.como, 'batida', 'subiu, soltou o jato e caiu');
});

test('entradas inválidas', () => {
  const d = sim.DESAFIOS[0];
  assert.ok(!sim.entradasValidas([], d));
  assert.ok(!sim.entradasValidas([1, 32], d));
  assert.ok(!sim.entradasValidas([0, 1], d));
  assert.ok(!sim.entradasValidas([1.5, 1], d));
  assert.ok(!sim.entradasValidas([d.passosMaximos + 1, 0], d));
  assert.ok(sim.entradasValidas([10, 31, 5, 0], d));
});
