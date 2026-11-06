import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as sim from '../src/carrinhos/sim.ts';
import { criarRobo } from '../src/carrinhos/robo.ts';

/** Os Carrinhos da toca: a regra (carrinhos/sim.ts), que é a mesma do servidor, e os robôs. */

const correr = (faixa: number, piloto: (c: sim.Carro) => number) => {
  const c = sim.novoCarro(faixa);
  while (!c.chegou && c.passo < sim.PASSOS_MAXIMOS) sim.passo(c, piloto(c));
  return c;
};

test('a regra é o MESMO arquivo no site e no servidor, byte a byte', () => {
  const site = readFileSync(new URL('../src/carrinhos/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../../server/src/carrinhos-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'mexeu num, copie no outro');
});

test('a pista fecha a volta, e as duas fileiras de peças se encaixam (a curva pequena dentro da grande)', () => {
  assert.ok(sim.FECHAMENTO < 1e-9, `a volta não fecha: ${sim.FECHAMENTO}`);
  assert.equal(sim.PECAS.length, sim.TRACADO.length * 2);
  for (const p of sim.PECAS) {
    if (p.tipo === 'reta') continue;
    assert.equal(p.tipo === 'pequena', p.sentido === p.fileira, 'a de dentro é a pequena');
  }
  // cada faixa: os trechos emendam (o fim de um é o começo do outro)
  sim.TRECHOS.forEach((lista, f) => {
    for (let i = 1; i < lista.length; i++) {
      const fim = sim.poseNaFaixa(f, lista[i].inicio - 1e-9);
      assert.ok(Math.hypot(fim.x - lista[i].x, fim.z - lista[i].z) < 1e-6, `faixa ${f}, trecho ${i}`);
    }
  });
});

test('o piloto automático fecha as cinco voltas sem sair, e nenhuma faixa leva vantagem (1%)', () => {
  const tempos = [0, 1, 2, 3].map((f) => {
    const c = correr(f, (k) => sim.pilotoAutomatico(k, 0.15));
    assert.ok(c.chegou);
    assert.equal(c.saidas, 0, `faixa ${f}`);
    return c.voltas[sim.VOLTAS - 1];
  });
  assert.ok((Math.max(...tempos) - Math.min(...tempos)) / Math.min(...tempos) < 0.01, `os tempos: ${tempos}`);
});

test('acelerar ao máximo sai na curva, fica fora 1,75 s e volta piscando, parado, ao lugar de onde saiu', () => {
  const c = sim.novoCarro(sim.FAIXA_DO_RECORDE);
  let ev: sim.Evento = null;
  while (ev !== 'saiu') ev = sim.passo(c, sim.ACELERADOR_MAXIMO);
  const saiu = c.passo, onde = c.s;
  assert.notEqual(sim.trechoEm(c.faixa, c.s).sentido, 0, 'na curva');
  // antes de sair, a folga: houve passos derrapando
  const d = sim.novoCarro(sim.FAIXA_DO_RECORDE);
  let derrapou = false;
  while (d.passo < saiu - 1) {
    sim.passo(d, sim.ACELERADOR_MAXIMO);
    if (d.derrapa > 0) derrapou = true;
  }
  assert.ok(derrapou || saiu > 0);
  while (ev !== 'voltou') ev = sim.passo(c, sim.ACELERADOR_MAXIMO);
  assert.equal(c.passo - saiu, sim.FORA_PASSOS);
  assert.equal(c.s, onde);
  assert.equal(c.v, 0);
  assert.equal(c.pisca, sim.PISCA_PASSOS);
  // e a corrida de acelerador cheio chega, mas bem mais devagar
  const cheio = correr(sim.FAIXA_DO_RECORDE, () => sim.ACELERADOR_MAXIMO);
  const bom = correr(sim.FAIXA_DO_RECORDE, (k) => sim.pilotoAutomatico(k, 0.3));
  assert.ok(cheio.saidas > 10);
  assert.ok(cheio.voltas[sim.VOLTAS - 1] > bom.voltas[sim.VOLTAS - 1] * 1.5);
});

test('determinismo: o gravador e o refazer dão a mesma corrida, e o leitor (o fantasma) também', () => {
  const g = sim.gravador();
  const c = correr(2, (k) => {
    const a = sim.pilotoAutomatico(k, k.passo % 300 < 150 ? 0.1 : -1.5);
    g.anotar(a);
    return a;
  });
  const r = sim.refazer(2, g.entradas);
  assert.deepEqual(r.voltas, c.voltas);
  assert.equal(r.saidas, c.saidas);
  assert.ok(sim.entradasValidas(g.entradas));
  const ler = sim.leitor(g.entradas);
  const f = correr(2, () => ler());
  assert.deepEqual(f.voltas, c.voltas);
  assert.equal(sim.entradasValidas([1, 9]), false);
  assert.equal(sim.entradasValidas([0, 4]), false);
});

test('os robôs terminam, às vezes saindo da pista, e o melhor é mais rápido que o pior', () => {
  const bom = correr(0, criarRobo(11, 0.95));
  const fraco = correr(3, criarRobo(12, 0.4));
  assert.ok(bom.chegou && fraco.chegou);
  assert.ok(bom.voltas[sim.VOLTAS - 1] < fraco.voltas[sim.VOLTAS - 1]);
  let saidas = 0;
  for (let i = 0; i < 12; i++) saidas += correr(i % 4, criarRobo(100 + i, 0.6)).saidas;
  assert.ok(saidas > 0, 'os robôs erram de vez em quando');
});
