/** Balsa a dois (festa/remada.ts): a balsa é do servidor; a remada de um lado empurra para o outro; o limite de remadas. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaAoVivo } from './festa-ajuda-aovivo.js';
import { sorteioFixo } from './festa-ajuda.js';
import { CORRENTEZA, type DadosRemada } from '../src/festa/remada.js';

type Q = { b: number[][]; c: number[][] };

test('remada: a remada da esquerda leva a balsa para a direita (com 300 ms de rede), e a dupla rema para pegar cenouras', () => {
  const rede = new Map([[1, 200], [2, 300], [3, 200], [4, 300]]);
  const r = rodadaAoVivo('remada', { rede, aleatorio: sorteioFixo(3) });
  const d = r.rodada.publico(1).dados as DadosRemada;
  const [a, b] = d.lados;
  assert.notEqual(a.esq, a.dir, 'duplas de verdade');
  r.passos(2);
  const x0 = (r.ultimo().q as Q).b[0][0];
  r.mandar(a.esq, { tipo: 'rema' });
  r.passos(12);
  assert.ok((r.ultimo().q as Q).b[0][0] > x0 + 8, 'foi para a direita');
  assert.equal((r.ultimo().q as Q).b[1][0], 150, 'a outra balsa não se mexeu');
  // a dupla A rema para a próxima cenoura, como gente: olha, decide, rema
  for (let k = 0; k < 300 && r.fase() === 'jogando'; k++) {
    const [x, y, vx] = (r.ultimo().q as Q).b[0];
    const alvo = d.cenouras.find(([cy], i) => cy > y + 30 && !(r.ultimo().q as Q).c[0].includes(i));
    if (alvo && k % 5 === 0) {
      const quer = alvo[1] - (x + vx * Math.min(1.2, (alvo[0] - y) / CORRENTEZA));
      if (quer > 10) r.mandar(a.esq, { tipo: 'rema' });
      if (quer < -10) r.mandar(a.dir, { tipo: 'rema' });
    }
    r.passos(1);
  }
  r.mandar(b.esq, { tipo: 'rema' });
  r.ateRevelar();
  const pa = r.linhaDe(a.esq);
  assert.ok((pa.valor ?? 0) >= 4, `a dupla A pegou ${pa.valor}`);
  assert.equal(r.linhaDe(a.dir).posicao, pa.posicao, 'a dupla divide a posição');
  assert.equal(r.linhaDe(b.dir).motivo, 'nada', 'quem não remou não pontua');
});

test('remada: remar mais rápido que o remo deixa não vale', () => {
  const r = rodadaAoVivo('remada', { rede: new Map([[1, 200], [2, 200], [3, 200], [4, 200]]), aleatorio: sorteioFixo(3) });
  const d = r.rodada.publico(1).dados as DadosRemada;
  r.passos(2);
  for (let k = 0; k < 40; k++) r.mandar(d.lados[0].esq, { tipo: 'rema' });
  r.passos(4);
  for (let k = 0; k < 40; k++) r.mandar(d.lados[1].esq, { tipo: 'rema' });
  r.passos(4);
  r.mandar(d.lados[1].esq, { tipo: 'rema' });
  r.passos(8);
  const [b0, b1] = (r.ultimo().q as Q).b;
  // 40 remadas de uma vez valem uma (a balsa anda o de uma remada, não o de 40)
  assert.ok(b0[0] < 175, `uma remada só: ${b0[0]}`);
  assert.ok(b1[0] < 200);
});

test('remada: no Solo, os robôs remam e pegam cenouras', () => {
  const r = rodadaAoVivo('remada', { rede: new Map([[1, 200]]), robos: [-1, -2, -3], aleatorio: sorteioFixo(8) });
  r.ateRevelar();
  const robos = [-1, -2, -3].map((id) => r.linhaDe(id));
  assert.ok(robos.some((l) => (l.valor ?? 0) >= 4), `${robos.map((l) => l.valor)}`);
});
