/** Três flechas (festa/flecha.ts): a flecha sobe reta do arco, e o servidor confere quais balões ela fura no relógio dele. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { aljavaNova, atirar, FLECHA_MS, FLECHA_RECARGA_MS, FLECHAS, flechada, type DadosFlecha } from '../src/festa/flecha.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

/** As melhores três flechas que uma pessoa atenta acha, de 10 em 10 ms, uma depois da outra. */
function boasFlechas(d: DadosFlecha) {
  const a = aljavaNova();
  const tiros: number[] = [];
  let desde = 0;
  for (let n = 0; n < FLECHAS; n++) {
    let melhor = { t: desde, pontos: -1 };
    for (let t = desde; t <= Math.min(FLECHA_MS, desde + 4000); t += 10) {
      const p = flechada(d, t, a.estourados).reduce((s, i) => s + d.baloes[i].valor, 0);
      if (p > melhor.pontos) melhor = { t, pontos: p };
    }
    atirar(d, a, melhor.t);
    tiros.push(melhor.t);
    desde = melhor.t + FLECHA_RECARGA_MS;
  }
  return { tiros, pontos: a.pontos };
}

test('flecha: dá para furar balões com as três; a quarta e a colada na anterior não saem', () => {
  for (let s = 1; s <= 8; s++) {
    const r = rodadaDeTeste('flecha', { aleatorio: sorteioFixo(s) });
    const d = r.rodada.publico(ANA).dados as DadosFlecha;
    assert.ok(boasFlechas(d).pontos >= 4, `semente ${s}`);
  }
  const d = rodadaDeTeste('flecha').rodada.publico(ANA).dados as DadosFlecha;
  const a = aljavaNova();
  assert.ok(atirar(d, a, 1000));
  assert.equal(atirar(d, a, 1500), null, 'o arco ainda armando');
  assert.ok(atirar(d, a, 2200));
  assert.ok(atirar(d, a, 3400));
  assert.equal(atirar(d, a, 6000), null, 'acabaram as flechas');
});

test('flecha: com 200 e 300 ms de rede, o servidor vê os mesmos balões furados que a tela', () => {
  const r = rodadaDeTeste('flecha', { aleatorio: sorteioFixo(3) });
  const d = r.rodada.publico(ANA).dados as DadosFlecha;
  const boa = boasFlechas(d);
  const eventos: [number, number, number][] = [];
  for (const t of boa.tiros) eventos.push([t + 100, ANA, t]);
  // a Bia atira a cada 1,2 s desde o começo, sem mirar
  for (let k = 0; k < FLECHAS; k++) eventos.push([500 + k * 1200 + 150, BIA, 500 + k * 1200]);
  for (const [chega, quem, t] of eventos.sort((x, y) => x[0] - y[0])) {
    r.em(chega);
    r.rodada.acao(quem, { tipo: 'acerto', t });
  }
  r.em(FLECHA_MS + 300);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).valor, boa.pontos);
  assert.equal(r.linhaDe(ANA).posicao, 1);
});

test('flecha: as flechas perfeitas mandadas depois da hora não valem', () => {
  const r = rodadaDeTeste('flecha', { aleatorio: sorteioFixo(3) });
  const d = r.rodada.publico(ANA).dados as DadosFlecha;
  const boa = boasFlechas(d);
  r.em(FLECHA_MS);
  for (const t of boa.tiros) r.rodada.acao(ANA, { tipo: 'acerto', t });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  assert.ok((r.rodada.publico(ANA).meu?.valor ?? 0) < boa.pontos || boa.tiros[2] > FLECHA_MS - 600);
});

test('flecha: o robô não atira antes do tempo', () => {
  const d = rodadaDeTeste('flecha').rodada.publico(ANA).dados;
  for (let k = 0; k < 50; k++) assert.equal(resultadoDoRobo('flecha', d, Math.random, 1000).motivo, 'errou');
});
