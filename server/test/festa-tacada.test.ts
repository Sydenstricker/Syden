/** Uma tacada só (festa/tacada.ts): a mira e a força saem dos instantes dos dois apertos, e a distância é a da física do servidor. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { miraDaTacada, onda, tacadaDa, TACADA_MS, type DadosTacada } from '../src/festa/tacada.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

/** A melhor tacada que uma pessoa paciente acha: a mira varrida a cada 20 ms, e a força a cada 10 ms. */
function boaTacada(d: DadosTacada) {
  let melhor = { tMira: 0, tForca: 0, distancia: Infinity };
  for (let tMira = 0; tMira < d.periodoMiraMs; tMira += 20) {
    for (let dt = 200; dt <= 200 + d.periodoMs; dt += 10) {
      const r = tacadaDa(d, tMira, tMira + dt);
      if (r.distancia < melhor.distancia) melhor = { tMira, tForca: tMira + dt, distancia: r.distancia };
    }
  }
  return melhor;
}

test('tacada: as três mesas têm uma tacada que entra, e a força toda passa da conta', () => {
  for (const s of [1, 2, 3, 4, 5, 6]) {
    const r = rodadaDeTeste('tacada', { aleatorio: sorteioFixo(s) });
    const d = r.rodada.publico(ANA).dados as DadosTacada;
    assert.equal(boaTacada(d).distancia, 0, `semente ${s}`);
    // a força toda, na reta: nunca é a melhor (a toca não é "bater forte e pronto")
    const tMira = d.periodoMiraMs / 2;
    assert.ok(Math.abs(miraDaTacada(d.periodoMiraMs, tMira)) < 1e-9, 'a seta passa pelo meio');
    const forte = tMira + d.periodoMs / 2;
    assert.ok(Math.abs(onda(d.periodoMs, forte - tMira) - 1) < 1e-9);
    assert.ok(tacadaDa(d, tMira, forte).distancia > 0, `semente ${s}: a força toda não entra`);
  }
});

test('tacada: com 200 e 300 ms de rede, a Ana taca bem e a Bia mal, e a mais perto ganha', () => {
  const r = rodadaDeTeste('tacada', { aleatorio: sorteioFixo(4) });
  const d = r.rodada.publico(ANA).dados as DadosTacada;
  const boa = boaTacada(d);
  // cada aperto chega depois da metade da ida e volta (a tela mede antes, o servidor vê depois)
  r.em(boa.tMira + 100);
  r.rodada.acao(ANA, { tipo: 'acerto', t: boa.tMira });
  r.em(boa.tMira + 150);
  r.rodada.acao(BIA, { tipo: 'acerto', t: boa.tMira });
  r.em(boa.tForca + 100);
  r.rodada.acao(ANA, { tipo: 'resultado', t: boa.tForca });
  // a Bia taca com a força toda
  const forte = boa.tMira + d.periodoMs / 2;
  assert.ok(tacadaDa(d, boa.tMira, forte).distancia > boa.distancia);
  r.em(Math.max(forte, boa.tForca) + 150);
  r.rodada.acao(BIA, { tipo: 'resultado', t: forte });
  assert.equal(r.rodada.publico(ANA).fase, 'revelando');
  assert.equal(r.linhaDe(ANA).valor, Math.round(boa.distancia));
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('tacada: o aperto fora da hora, a força sem mira e a mira trocada depois não valem', () => {
  const r = rodadaDeTeste('tacada', { aleatorio: sorteioFixo(4) });
  const d = r.rodada.publico(ANA).dados as DadosTacada;
  const boa = boaTacada(d);
  // a Ana, pelo console, manda a força sem ter prendido a mira
  r.em(boa.tForca + 100);
  r.rodada.acao(ANA, { tipo: 'resultado', t: boa.tForca });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'invalido');
  // a Bia prende a mira tarde (o instante já passou: o "calculei a melhor e mando agora") e não vale; a primeira que vale fica
  const s = rodadaDeTeste('tacada', { aleatorio: sorteioFixo(4) });
  s.em(boa.tMira + 2000);
  s.rodada.acao(BIA, { tipo: 'acerto', t: boa.tMira });
  s.rodada.acao(BIA, { tipo: 'acerto', t: boa.tMira + 1950 });
  s.rodada.acao(BIA, { tipo: 'acerto', t: boa.tMira + 1960 });
  s.em(boa.tMira + 2600);
  s.rodada.acao(BIA, { tipo: 'resultado', t: boa.tMira + 2500 });
  const daBia = tacadaDa(d, boa.tMira + 1950, boa.tMira + 2500);
  assert.equal(s.rodada.publico(BIA).meu?.valor, Math.round(daBia.distancia));
  // a força mandada depois da hora também não vale
  const u = rodadaDeTeste('tacada', { aleatorio: sorteioFixo(4) });
  u.em(boa.tMira + 100);
  u.rodada.acao(ANA, { tipo: 'acerto', t: boa.tMira });
  u.em(boa.tForca + 2000);
  u.rodada.acao(ANA, { tipo: 'resultado', t: boa.tForca });
  assert.equal(u.rodada.publico(ANA).meu?.motivo, 'invalido');
  assert.ok(TACADA_MS > boa.tForca);
});

test('tacada: o robô dá uma distância plausível', () => {
  const r = rodadaDeTeste('tacada');
  const dados = r.rodada.publico(ANA).dados;
  for (let k = 0; k < 50; k++) {
    const rob = resultadoDoRobo('tacada', dados, Math.random, 4000);
    assert.equal(rob.motivo, null);
    assert.ok((rob.valor ?? -1) >= 0 && (rob.valor ?? 99) <= 45);
  }
});
