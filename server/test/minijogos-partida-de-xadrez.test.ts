/**
 * A PARTIDA DE XADREZ (minijogo-partida-de-xadrez.ts): a mesa de duas pessoas com as regras do chess.js. O mate do pastor
 * acaba com vitória de quem deu o mate; o lance que não vale é recusado; o robô, no Solo, joga lances legais e rápidos e
 * leva uma partida até o fim contra lances ao acaso.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import type { Contexto, Jogo } from '../src/minijogo-motor.js';
import { casaDe, lanceDoRobo, partidaDeXadrez } from '../src/minijogo-partida-de-xadrez.js';

function mesa(solo = false) {
  let relogio: (() => void) | null = null;
  let acabou = false;
  const ctx = {
    agendar: (_ms: number, f: () => void) => (relogio = f),
    avisar() {},
    terminar() {
      acabou = true;
    },
    naSala: () => [1, 2],
    nome: (id: number) => `p${id}`,
    comunidade: 0,
    solo,
  } as unknown as Contexto;
  const jogo = partidaDeXadrez.comecar(ctx, { naSala: [1], criadaPor: 1, corpo: {} }) as Jogo;
  return {
    jogo,
    andar: () => {
      const r = relogio;
      relogio = null;
      r?.();
    },
    acabou: () => acabou,
  };
}

test('o mate do pastor: quem dá o mate vence, e o lance que não vale é recusado', () => {
  const m = mesa();
  assert.equal(m.jogo.acao(2, { tipo: 'sentar' }), null);
  const v = m.jogo.publico(1) as { vez: 0 | 1; brancas: 0 | 1 };
  const brancas = v.brancas === 0 ? 1 : 2;
  const pretas = brancas === 1 ? 2 : 1;
  const lance = (quem: number, de: string, para: string) => m.jogo.acao(quem, { tipo: 'jogada', de: casaDe(de), para: casaDe(para) });
  assert.equal(lance(brancas, 'e2', 'e5'), 'Esse lance não vale.');
  assert.equal(lance(pretas, 'e7', 'e5'), 'Espere a sua vez.');
  for (const [q, de, para] of [
    [brancas, 'e2', 'e4'],
    [pretas, 'e7', 'e5'],
    [brancas, 'f1', 'c4'],
    [pretas, 'b8', 'c6'],
    [brancas, 'd1', 'h5'],
    [pretas, 'g8', 'f6'],
    [brancas, 'h5', 'f7'],
  ] as const)
    assert.equal(lance(q, de, para), null);
  const fim = m.jogo.publico(1) as { fase: string; vencedor: number; fimPor: string };
  assert.equal(fim.fase, 'fim');
  assert.equal(fim.fimPor, 'mate');
  assert.equal(fim.vencedor, v.brancas);
  assert.ok(m.acabou());
});

test('o robô joga lances legais, em pouco tempo, e a partida contra lances ao acaso chega ao fim', () => {
  let s = 7;
  const aleatorio = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const jogo = new Chess();
  let maisLento = 0;
  for (let k = 0; k < 400 && !jogo.isGameOver(); k++) {
    if (jogo.turn() === 'w') {
      const t0 = performance.now();
      const l = lanceDoRobo(jogo.fen(), aleatorio)!;
      maisLento = Math.max(maisLento, performance.now() - t0);
      const nome = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
      assert.ok(jogo.move({ from: nome(l.de), to: nome(l.para), promotion: 'q' }), 'o lance do robô tem de valer');
    } else {
      const ms = jogo.moves();
      jogo.move(ms[Math.floor(aleatorio() * ms.length)]);
    }
  }
  assert.ok(jogo.isGameOver(), 'em 400 lances a partida acaba');
  assert.ok(jogo.isCheckmate() && jogo.turn() === 'b', 'contra lances ao acaso, o robô dá o mate');
  assert.ok(maisLento < 1500, `o lance mais lento levou ${maisLento.toFixed(0)} ms`);
});

test('no Solo, o robô senta na hora e responde ao lance da pessoa', () => {
  const m = mesa(true);
  const v = m.jogo.publico(1) as { fase: string; vez: 0 | 1; brancas: 0 | 1; jogadores: { userId: number }[] };
  assert.equal(v.fase, 'jogando');
  assert.ok(v.jogadores.some((j) => j.userId < 0), 'o adversário é o robô');
  // se o robô abre, joga primeiro
  if (v.jogadores[v.vez].userId < 0) m.andar();
  const minha = m.jogo.publico(1) as { lances: { de: number; para: number }[] };
  assert.ok(minha.lances.length > 0);
  assert.equal(m.jogo.acao(1, { tipo: 'jogada', ...minha.lances[0] }), null);
  m.andar();
  const depois = m.jogo.publico(1) as { lances: unknown[] };
  assert.ok(depois.lances.length > 0, 'o robô jogou, e a vez voltou');
});
