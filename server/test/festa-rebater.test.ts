/** Rebater o rabanete (festa/rebater.ts): cada tacada vale pelo erro em relação à chegada, conferida no relógio do servidor. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { chegadaDoRabanete, fimDoRebater, REBATER_ARREMESSOS, tacadaNoRabanete, type DadosRebater } from '../src/festa/rebater.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

test('rebater: os arremessos não se encostam, e o erro decide os metros', () => {
  for (let s = 1; s <= 10; s++) {
    const r = rodadaDeTeste('rebater', { aleatorio: sorteioFixo(s) });
    const d = r.rodada.publico(ANA).dados as DadosRebater;
    assert.equal(d.arremessos.length, REBATER_ARREMESSOS);
    for (let k = 1; k < d.arremessos.length; k++) assert.ok(d.arremessos[k].sai > chegadaDoRabanete(d.arremessos[k - 1]) + 1000);
    const a = chegadaDoRabanete(d.arremessos[0]);
    assert.equal(tacadaNoRabanete(d, a + 10).metros, 100);
    assert.equal(tacadaNoRabanete(d, a - 100).metros, 45);
    assert.equal(tacadaNoRabanete(d, a + 230).metros, 0, 'tarde demais: o taco passou');
    assert.equal(tacadaNoRabanete(d, a - 900).k, -1, 'fora da janela: não pega arremesso nenhum');
  }
});

test('rebater: com 200 e 300 ms de rede, quem rebate na hora vai mais longe; a segunda tacada no mesmo não conta', () => {
  const r = rodadaDeTeste('rebater', { aleatorio: sorteioFixo(2) });
  const d = r.rodada.publico(ANA).dados as DadosRebater;
  const eventos: [number, number, number][] = [];
  for (const a of d.arremessos) {
    const c = chegadaDoRabanete(a);
    eventos.push([c + 20 + 100, ANA, c + 20]);
    // a Bia adianta 100 ms, e bate de novo logo depois (já contou o primeiro)
    eventos.push([c - 100 + 150, BIA, c - 100]);
    eventos.push([c + 150, BIA, c]);
  }
  for (const [chega, quem, t] of eventos.sort((x, y) => x[0] - y[0])) {
    r.em(chega);
    r.rodada.acao(quem, { tipo: 'acerto', t });
  }
  r.em(fimDoRebater(d) + 300);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).valor, 100 * REBATER_ARREMESSOS);
  assert.equal(r.linhaDe(BIA).valor, 45 * REBATER_ARREMESSOS);
  assert.equal(r.linhaDe(ANA).posicao, 1);
});

test('rebater: as tacadas perfeitas mandadas depois da hora não valem', () => {
  const r = rodadaDeTeste('rebater', { aleatorio: sorteioFixo(2) });
  const d = r.rodada.publico(ANA).dados as DadosRebater;
  r.em(fimDoRebater(d) + 100);
  for (const a of d.arremessos) r.rodada.acao(ANA, { tipo: 'acerto', t: chegadaDoRabanete(a) });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  // só o último cabe na folga da rede
  assert.ok((r.rodada.publico(ANA).meu?.valor ?? 0) <= 100);
});

test('rebater: o robô não rebate o que ainda não chegou', () => {
  const r = rodadaDeTeste('rebater', { aleatorio: sorteioFixo(2) });
  const d = r.rodada.publico(ANA).dados as DadosRebater;
  for (let k = 0; k < 50; k++) {
    assert.equal(resultadoDoRobo('rebater', d, Math.random, chegadaDoRabanete(d.arremessos[0]) - 1).motivo, 'errou');
    assert.ok((resultadoDoRobo('rebater', d, Math.random, chegadaDoRabanete(d.arremessos[1]) + 1).valor ?? 0) <= 200);
  }
});
