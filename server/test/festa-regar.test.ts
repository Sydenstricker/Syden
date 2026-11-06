/**
 * Regar a horta (festa/regar.ts): cada mudança de direção vai na hora, e a água é a da simulação do servidor, a mesma da tela
 * (festa/lote2sim.ts, duas cópias iguais: este arquivo confere também que elas batem byte a byte).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { PASSO_MS, pilotoDaNuvem, REGAR_PASSOS, regar, type DadosRegar } from '../src/festa/lote2sim.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

test('lote2sim: as duas cópias (servidor e site) são iguais byte a byte', () => {
  const doServidor = readFileSync(new URL('../src/festa/lote2sim.ts', import.meta.url));
  const doSite = readFileSync(new URL('../../web/src/festa/lote2sim.ts', import.meta.url));
  assert.ok(doServidor.equals(doSite), 'server/src/festa/lote2sim.ts e web/src/festa/lote2sim.ts diferem');
});

test('regar: quem sopra na hora (200 e 300 ms de rede) tem a água que a tela mostrou', () => {
  const r = rodadaDeTeste('regar', { aleatorio: sorteioFixo(5) });
  const d = r.rodada.publico(ANA).dados as DadosRegar;
  const e = pilotoDaNuvem(d);
  const naTela = regar(d, e).agua;
  assert.ok(naTela > REGAR_PASSOS * 0.4, `o piloto molha bem: ${naTela} de ${REGAR_PASSOS}`);
  // a Bia, parada no meio, só molha quando o canteiro do meio tem sede (e o vento a leva)
  const ev: [number, number, Record<string, unknown>][] = [];
  for (const [p, dx, dy] of e) ev.push([p * PASSO_MS + 200, ANA, { tipo: 'acerto', p, dx, dy }]);
  ev.push([300, BIA, { tipo: 'acerto', p: 0, dx: 0, dy: -1 }]);
  ev.push([600, BIA, { tipo: 'acerto', p: 8, dx: 0, dy: 0 }]);
  ev.push([22_000 + 200, ANA, { tipo: 'resultado' }]);
  ev.push([22_000 + 300, BIA, { tipo: 'resultado' }]);
  for (const [t, quem, corpo] of ev.sort((a, b) => a[0] - b[0])) {
    r.em(t);
    r.rodada.acao(quem, corpo);
  }
  assert.equal(r.linhaDe(ANA).valor, naTela * PASSO_MS);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.ok((r.linhaDe(BIA).valor ?? 0) < naTela * PASSO_MS);
});

test('regar: a lista inteira mandada no fim, ou um passo no futuro, não refaz a partida', () => {
  const r = rodadaDeTeste('regar', { aleatorio: sorteioFixo(6) });
  const d = r.rodada.publico(ANA).dados as DadosRegar;
  const e = pilotoDaNuvem(d);
  const perfeita = regar(d, e).agua;
  // a Ana manda tudo no fim: cada mudança vale só a partir de agora, e a partida vira outra
  r.em(21_800);
  for (const [p, dx, dy] of e) r.rodada.acao(ANA, { tipo: 'acerto', p, dx, dy });
  // a Bia manda, no começo, a direção de daqui a 5 s: não vale
  r.em(1000);
  r.rodada.acao(BIA, { tipo: 'acerto', p: 125, dx: 1, dy: 1 });
  r.em(22_300);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.ok((r.linhaDe(ANA).valor ?? 0) < perfeita * PASSO_MS * 0.5, `${r.linhaDe(ANA).valor} contra ${perfeita * PASSO_MS}`);
  assert.equal(r.linhaDe(BIA).motivo, 'errou');
});

test('regar: o robô não molha mais do que coube', () => {
  const r = rodadaDeTeste('regar');
  const d = r.rodada.publico(ANA).dados as DadosRegar;
  for (let k = 0; k < 30; k++) assert.ok((resultadoDoRobo('regar', d, Math.random, 4_000).valor ?? 0) <= 4_000);
});
