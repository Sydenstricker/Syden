/**
 * Colheita em dupla (festa/colheita.ts): as duplas, soltar perto do morango, apanhar na hora certa com a cesta embaixo (quem
 * apanha decide, o servidor confere), a posição por equipe, e o robô parceiro.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaAoVivo } from './festa-ajuda-aovivo.js';
import { sorteioFixo } from './festa-ajuda.js';
import { duplas, QUEDA_MS, type DadosColheita } from '../src/festa/colheita.js';

type Q = { x: [number, number][]; f: [number, number, number, number, number][]; c: number[][]; p: number[] };

/** Leva alguém (1D) até x, a 100 por segundo. */
function ir(r: ReturnType<typeof rodadaAoVivo>, quem: number, de: number, para: number) {
  let x = de;
  while (Math.abs(para - x) > 0.5) {
    x += Math.sign(para - x) * Math.min(Math.abs(para - x), 5);
    r.mandar(quem, { tipo: 'p', x });
    r.passos(1);
  }
  return x;
}

test('colheita: as duplas saem de duas em duas, e a de um só fica com a árvore sozinha', () => {
  const eq = duplas([1, 2, 3, 4, 5], sorteioFixo(1));
  assert.deepEqual(eq.map((e) => e.length), [2, 2, 1]);
  assert.deepEqual(eq.flat().sort(), [1, 2, 3, 4, 5]);
});

test('colheita: o galho solta, a cesta apanha na hora certa (com 200 e 300 ms de rede), e a dupla divide a posição', () => {
  const rede = new Map([[1, 200], [2, 300], [3, 200], [4, 300]]);
  const r = rodadaAoVivo('colheita', { rede, aleatorio: sorteioFixo(4) });
  const d = r.rodada.publico(1).dados as DadosColheita;
  const eqs = r.rodada.publico(1).equipes!;
  assert.equal(eqs.length, 2);
  const [a, b] = d.papeis;
  // a dupla A joga; da dupla B só a cesta manda a posição (e não apanha nada)
  r.mandar(b.cesta, { tipo: 'p', x: 150 });
  let galho = 150;
  let cesta = 150;
  let pontos = 0;
  for (const [i, m] of d.morangos.slice(0, 3).entries()) {
    while (r.passou() < m.t + 100) r.passos(1);
    // os dois vão juntos para baixo do morango
    while (Math.abs(galho - m.x) > 0.5 || Math.abs(cesta - m.x) > 0.5) {
      galho += Math.sign(m.x - galho) * Math.min(Math.abs(m.x - galho), 6);
      cesta += Math.sign(m.x - cesta) * Math.min(Math.abs(m.x - cesta), 7);
      r.mandar(a.galho!, { tipo: 'p', x: galho });
      r.mandar(a.cesta, { tipo: 'p', x: cesta });
      r.passos(1);
    }
    r.mandar(a.galho!, { tipo: 'solta', i });
    r.passos(4);
    const q = (r.ultimo().q as Q).f.find((f) => f[0] === i && f[1] === 0);
    assert.ok(q, `o morango ${i} saiu do galho`);
    // a cesta diz que pegou quando a queda acaba na tela dela (uma ida depois do servidor)
    while (r.passou() < q![3] + QUEDA_MS + 150) r.passos(1);
    r.mandar(a.cesta, { tipo: 'pego', i });
    r.passos(4);
    pontos += m.ouro ? 2 : 1;
    assert.equal((r.ultimo().q as Q).p[0], pontos);
  }
  r.ateRevelar();
  assert.equal(r.linhaDe(a.galho!).posicao, 1);
  assert.equal(r.linhaDe(a.cesta).posicao, 1, 'a dupla divide a posição');
  assert.equal(r.linhaDe(a.cesta).pontos, r.linhaDe(a.galho!).pontos);
  assert.equal(r.linhaDe(b.cesta).posicao, 2);
  assert.equal(r.linhaDe(b.galho!).motivo, 'nada', 'quem não jogou não leva os pontos da dupla');
});

test('colheita: a trapaça não vale — soltar de longe, dizer que pegou antes da hora ou com a cesta longe', () => {
  const r = rodadaAoVivo('colheita', { rede: new Map([[1, 200], [2, 200]]), aleatorio: sorteioFixo(6) });
  const d = r.rodada.publico(1).dados as DadosColheita;
  // com dois, são duas "duplas" de um: a árvore solta sozinha
  assert.ok(d.papeis.every((p) => p.galho === null));
  const quem = d.papeis[0].cesta;
  const m = d.morangos[0];
  r.mandar(quem, { tipo: 'p', x: 150 });
  while (!(r.ultimo()?.q as Q | undefined)?.f.some((f) => f[0] === 0 && f[1] === 0)) r.passos(1);
  const q = (r.ultimo().q as Q).f.find((f) => f[0] === 0 && f[1] === 0)!;
  // antes da hora
  r.mandar(quem, { tipo: 'pego', i: 0 });
  r.passos(2);
  assert.equal((r.ultimo().q as Q).p[0], 0, 'antes de chegar ao chão');
  // na hora, mas com a cesta longe (se o morango está longe de 150)
  while (r.passou() < q[3] + QUEDA_MS + 100) r.passos(1);
  r.mandar(quem, { tipo: 'pego', i: 0 });
  r.passos(3);
  assert.equal((r.ultimo().q as Q).p[0], Math.abs(m.x - 150) <= 30 ? (m.ouro ? 2 : 1) : 0);
  // o pulo da cesta de um lado ao outro não vale
  r.mandar(quem, { tipo: 'p', x: 20 });
  r.passos(2);
  r.mandar(quem, { tipo: 'p', x: 280 });
  r.passos(2);
  assert.ok((r.ultimo().q as Q).x.find(([id]) => id === quem)![1] < 60);
});

test('colheita: no Solo, o robô parceiro colhe e apanha, e a dupla pontua', () => {
  const r = rodadaAoVivo('colheita', { rede: new Map([[1, 200]]), robos: [-1, -2, -3], aleatorio: sorteioFixo(2) });
  r.ateRevelar();
  const robos = [-1, -2, -3].map((id) => r.linhaDe(id));
  assert.ok(robos.some((l) => (l.valor ?? 0) >= 5), `as duplas de robôs apanham: ${robos.map((l) => l.valor)}`);
});
