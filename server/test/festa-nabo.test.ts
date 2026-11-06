/** O arremesso do nabo (festa/nabo.ts): a soltura vale pelo giro naquele instante, conferida no relógio do servidor. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { arremesso, NABO_GIRO_MS, NABO_VEZ_MS, NABO_VEZES, voltasDoNabo, type DadosNabo } from '../src/festa/nabo.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

/** O instante (ms na vez) mais tarde, antes de `ate`, em que o nabo passa pelo meio do campo (uma volta inteira). */
function noMeio(g: { v0: number; a: number }, ate: number) {
  let melhor = 0;
  for (let ms = 0; ms <= ate; ms++) {
    const v = voltasDoNabo(g, ms);
    if (v - Math.floor(v) < 0.004 || v - Math.floor(v) > 0.996) melhor = ms;
  }
  return melhor;
}

test('nabo: girando mais rápido vai mais longe; fora do campo é falta; tonto depois do giro', () => {
  const g = { v0: 0.6, a: 0.35 };
  const cedo = noMeio(g, 1800);
  const tarde = noMeio(g, NABO_GIRO_MS);
  assert.ok(cedo > 0 && tarde > cedo);
  assert.ok(arremesso(g, tarde)! > arremesso(g, cedo)!, 'mais tarde, mais longe');
  // meia volta depois do meio do campo: para trás
  let atras = tarde;
  while (Math.abs(voltasDoNabo(g, atras) - voltasDoNabo(g, tarde) - 0.5) > 0.01) atras--;
  assert.equal(arremesso(g, atras), null);
  assert.equal(arremesso(g, NABO_GIRO_MS + 1), null, 'tonto');
});

test('nabo: com 200 e 300 ms de rede, vale o melhor das três vezes, e a soltura de cada vez é a primeira', () => {
  const r = rodadaDeTeste('nabo', { aleatorio: sorteioFixo(5) });
  const d = r.rodada.publico(ANA).dados as DadosNabo;
  const eventos: [number, number, number][] = [];
  const metrosDaAna: number[] = [];
  for (let k = 0; k < NABO_VEZES; k++) {
    // a Ana solta cada vez mais tarde; a Bia solta sempre cedo
    const ms = noMeio(d.giros[k], 1500 + k * 1500);
    metrosDaAna.push(arremesso(d.giros[k], ms)!);
    eventos.push([k * NABO_VEZ_MS + ms + 100, ANA, k * NABO_VEZ_MS + ms]);
    const daBia = noMeio(d.giros[k], 1500);
    eventos.push([k * NABO_VEZ_MS + daBia + 150, BIA, k * NABO_VEZ_MS + daBia]);
    // e solta de novo na mesma vez, mais tarde: não conta
    eventos.push([k * NABO_VEZ_MS + 4000 + 150, BIA, k * NABO_VEZ_MS + 4000]);
  }
  for (const [chega, quem, t] of eventos.sort((a, b) => a[0] - b[0])) {
    r.em(chega);
    r.rodada.acao(quem, { tipo: 'acerto', t });
  }
  r.em(NABO_VEZES * NABO_VEZ_MS);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).valor, Math.max(...metrosDaAna));
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('nabo: a soltura perfeita mandada depois da hora não vale', () => {
  const r = rodadaDeTeste('nabo', { aleatorio: sorteioFixo(5) });
  const d = r.rodada.publico(ANA).dados as DadosNabo;
  const ms = noMeio(d.giros[0], NABO_GIRO_MS);
  r.em(ms + 2000);
  r.rodada.acao(ANA, { tipo: 'acerto', t: ms });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'errou');
});

test('nabo: o robô não joga uma vez que ainda não começou', () => {
  const r = rodadaDeTeste('nabo');
  const d = r.rodada.publico(ANA).dados;
  for (let k = 0; k < 50; k++) {
    assert.equal(resultadoDoRobo('nabo', d, Math.random, 500).motivo, 'errou');
    const rob = resultadoDoRobo('nabo', d, Math.random, NABO_VEZES * NABO_VEZ_MS);
    assert.ok((rob.valor ?? 0) > 10 && (rob.valor ?? 0) < 40, String(rob.valor));
  }
});
