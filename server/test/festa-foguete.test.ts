/** O foguete de cenoura (festa/foguete.ts): cada bombada vale pelo ritmo, conferida na hora pelo relógio do servidor. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste } from './festa-ajuda.js';
import { bombaNova, bombar, FOGUETE_BATIDAS, FOGUETE_PRIMEIRA_MS, fimDoFoguete, METROS_POR_PONTO, type DadosFoguete } from '../src/festa/foguete.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;
const batida = (d: DadosFoguete, k: number) => FOGUETE_PRIMEIRA_MS + k * d.periodoMs;

test('foguete: na mosca vale 3, perto 2, longe 1; a segunda na mesma batida e a fora do ritmo engasgam', () => {
  const d = { periodoMs: 600 };
  const b = bombaNova();
  assert.equal(bombar(d, b, batida(d, 0) + 30), 3);
  assert.equal(bombar(d, b, batida(d, 0) + 60), -1, 'a mesma batida de novo');
  assert.equal(bombar(d, b, batida(d, 1) - 120), 2);
  assert.equal(bombar(d, b, batida(d, 2) + 200), 1);
  assert.equal(bombar(d, b, batida(d, 3) + 290), -1, 'no meio entre duas batidas');
  assert.equal(b.ar, 3 - 1 + 2 + 1 - 1);
  // martelar sem ritmo não enche: o ar nunca fica negativo, e quase tudo engasga
  const m = bombaNova();
  for (let t = 0; t < fimDoFoguete(d); t += 50) bombar(d, m, t);
  assert.ok(m.ar < FOGUETE_BATIDAS, `martelando: ${m.ar}`);
});

test('foguete: com 200 e 300 ms de rede, quem bombeia no ritmo sobe mais que quem atrasa', () => {
  const r = rodadaDeTeste('foguete');
  const d = r.rodada.publico(ANA).dados as DadosFoguete;
  const eventos: [number, number, number][] = [];
  for (let k = 0; k < FOGUETE_BATIDAS; k++) {
    eventos.push([batida(d, k) + 20 + 100, ANA, batida(d, k) + 20]);
    eventos.push([batida(d, k) + 130 + 150, BIA, batida(d, k) + 130]);
  }
  for (const [chega, quem, t] of eventos.sort((a, b) => a[0] - b[0])) {
    r.em(chega);
    r.rodada.acao(quem, { tipo: 'acerto', t });
  }
  r.em(fimDoFoguete(d) + 300);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).valor, FOGUETE_BATIDAS * 3 * METROS_POR_PONTO);
  assert.equal(r.linhaDe(BIA).valor, FOGUETE_BATIDAS * 2 * METROS_POR_PONTO);
  assert.equal(r.linhaDe(ANA).posicao, 1);
});

test('foguete: as bombadas perfeitas mandadas depois da hora não valem', () => {
  const r = rodadaDeTeste('foguete');
  const d = r.rodada.publico(ANA).dados as DadosFoguete;
  r.em(fimDoFoguete(d));
  for (let k = 0; k < FOGUETE_BATIDAS; k++) r.rodada.acao(ANA, { tipo: 'acerto', t: batida(d, k) });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  // só as últimas, que ainda cabem na folga da rede
  assert.ok((r.rodada.publico(ANA).meu?.valor ?? 0) <= 2 * 3 * METROS_POR_PONTO);
});

test('foguete: o robô não bombeia batidas que ainda não vieram', () => {
  const r = rodadaDeTeste('foguete');
  const d = r.rodada.publico(ANA).dados as DadosFoguete;
  for (let k = 0; k < 50; k++) {
    const rob = resultadoDoRobo('foguete', d, Math.random, batida(d, 3) + 10);
    assert.ok((rob.valor ?? 0) <= 4 * 3 * METROS_POR_PONTO);
  }
});
