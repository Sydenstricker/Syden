/** Trinca da horta (festa/trinca.ts): cada parada vale na hora, e o servidor refaz a figura na janela. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste } from './festa-ajuda.js';
import { contarTrincas, ENTRE_PARADAS_MS, figuraNaJanela, paradasQueValem, PAUSA_MS, podeParar, TRINCA_MS, type DadosTrinca } from '../src/festa/trinca.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

/** O primeiro instante a partir de `desde` em que o rolo mostra a figura (bem no meio da janela dela). */
function quando(d: DadosTrinca, r: number, figura: number, desde: number) {
  for (let t = desde; t < TRINCA_MS; t++) if (figuraNaJanela(d.rolos[r], t) === figura && figuraNaJanela(d.rolos[r], t + 40) === figura) return t + 20;
  throw new Error('não passou');
}

/** As paradas de quem mira a figura `alvo` em `tentativas` tentativas. */
function paradasDeQuemMira(d: DadosTrinca, alvo: number, tentativas: number) {
  const paradas: number[] = [];
  let t = 400;
  for (let k = 0; k < tentativas; k++) {
    for (let r = 0; r < 3; r++) {
      t = quando(d, r, alvo, t + (r === 0 && k > 0 ? PAUSA_MS : ENTRE_PARADAS_MS));
      assert.ok(podeParar(paradas, t));
      paradas.push(t);
    }
  }
  return paradas;
}

test('trinca: quem mira faz trincas (com 200 e 300 ms de rede), e mais trincas ganha', () => {
  const r = rodadaDeTeste('trinca');
  const d = r.rodada.publico(ANA).dados as DadosTrinca;
  const daAna = paradasDeQuemMira(d, d.rolos[0].figuras[0], 4);
  const daBia = paradasDeQuemMira(d, d.rolos[0].figuras[1], 2);
  // a Bia, na terceira tentativa, para cada rolo numa figura diferente: nem par
  let t = daBia[daBia.length - 1] + PAUSA_MS;
  for (let rolo = 0; rolo < 3; rolo++) daBia.push((t = quando(d, rolo, d.rolos[0].figuras[2 + rolo], t + ENTRE_PARADAS_MS)));
  assert.deepEqual(contarTrincas(d, daAna), { trincas: 4, pares: 0 });
  const eventos: [number, number, Record<string, unknown>][] = [
    ...daAna.map((p) => [p + 200, ANA, { tipo: 'acerto', t: p }] as [number, number, Record<string, unknown>]),
    ...daBia.map((p) => [p + 300, BIA, { tipo: 'acerto', t: p }] as [number, number, Record<string, unknown>]),
  ];
  eventos.push([Math.max(...daAna) + 300, ANA, { tipo: 'resultado' }], [Math.max(...daBia) + 400, BIA, { tipo: 'resultado' }]);
  for (const [em, quem, corpo] of eventos.sort((a, b) => a[0] - b[0])) {
    r.em(em);
    r.rodada.acao(quem, corpo);
  }
  assert.deepEqual(r.linhas().map((l) => [l.userId, l.posicao, l.valor]), [
    [ANA, 1, 4],
    [BIA, 2, 2],
  ]);
});

test('trinca: as paradas mandadas depois, coladas umas nas outras, ou antes da pausa, não valem', () => {
  const r = rodadaDeTeste('trinca');
  const d = r.rodada.publico(ANA).dados as DadosTrinca;
  const perfeitas = paradasDeQuemMira(d, d.rolos[0].figuras[0], 3);
  // a Ana manda as nove paradas perfeitas de uma vez, no fim
  r.em(TRINCA_MS);
  for (const p of perfeitas) r.rodada.acao(ANA, { tipo: 'acerto', t: p });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'errou');
  // a Bia, pelo console, para os três rolos no mesmo instante: só o primeiro vale (e não há tentativa completa)
  const s = rodadaDeTeste('trinca');
  s.em(1000);
  for (let k = 0; k < 3; k++) s.rodada.acao(BIA, { tipo: 'acerto', t: 900 });
  s.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(s.rodada.publico(BIA).meu?.motivo, 'errou');
  // e a pausa entre uma tentativa e outra vale nos dois lados
  assert.equal(podeParar([400, 600, 800], 800 + ENTRE_PARADAS_MS), false);
  assert.equal(podeParar([400, 600, 800], 800 + PAUSA_MS), true);
});

test('trinca: o robô faz poucas tentativas num tempo curto', () => {
  const r = rodadaDeTeste('trinca');
  const dados = r.rodada.publico(ANA).dados;
  for (let k = 0; k < 200; k++) {
    assert.equal(resultadoDoRobo('trinca', dados, Math.random, 1_500).motivo, 'errou');
    assert.ok((resultadoDoRobo('trinca', dados, Math.random, TRINCA_MS).valor ?? 0) <= 9);
  }
});

test('trinca: paradas que chegam trocadas pela rede contam na ordem do instante (a mesma regra da tela)', () => {
  const r = rodadaDeTeste('trinca');
  const d = r.rodada.publico(ANA).dados as DadosTrinca;
  const paradas = paradasDeQuemMira(d, d.rolos[0].figuras[3], 2);
  assert.deepEqual(paradasQueValem([paradas[1], paradas[0], paradas[3], paradas[2], paradas[5], paradas[4]]), paradas);
});
