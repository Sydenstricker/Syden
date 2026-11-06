/** O revezamento do riacho (festa/revezamento.ts): um desce sozinho, os outros revezam o remo; só rema quem está com o remo. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { REMADAS_POR_TRECHO, REVEZA_MS, TRECHOS, type VistaRevezamento } from '../src/festa/revezamento.js';
import { JUNTAR_MS } from '../src/festa/lote4-turma.js';

const ANA = 1;
const BIA = 2;
const CAIO = 3;
type R = ReturnType<typeof rodadaDeTeste>;
const vista = (r: R, q: number) => r.rodada.publico(q).dados as VistaRevezamento;

/**
 * Cada um rema no seu ritmo só quando a tela dele vê o remo na mão (o estado chega meia ida e volta depois), e manda o total
 * a cada 200 ms, que chega meia ida e volta depois.
 */
function remar(r: R, ritmos: Map<number, [number, number]>) {
  const local = new Map([...ritmos.keys()].map((q) => [q, { n: 0, desde: -1, mandado: 0 }]));
  for (let t = JUNTAR_MS; t <= REVEZA_MS && r.rodada.publico(ANA).fase === 'jogando'; t += 50) {
    r.em(t);
    for (const [q, [porSegundo, rede]] of ritmos) {
      const l = local.get(q)!;
      const v = vista(r, q);
      if (v.remando && l.desde < 0) l.desde = t + rede / 2;
      if (!v.remando) l.desde = -1;
      if (l.desde >= 0 && t >= l.desde && t % 200 === 0) {
        l.n += Math.round((porSegundo * 200) / 1000);
        r.rodada.acao(q, { tipo: 'acerto', n: l.n, t: t - rede / 2 });
      }
    }
  }
}

test('revezamento: a equipe reveza o remo trecho a trecho, e quem desce sozinho rema tudo', () => {
  const r = rodadaDeTeste('revezamento', { rede: new Map([[ANA, 200], [BIA, 300], [CAIO, 250]]), aleatorio: sorteioFixo(2) });
  r.em(100);
  for (const q of [ANA, BIA, CAIO]) r.rodada.acao(q, { tipo: 'acerto', entrar: 1 });
  r.em(JUNTAR_MS);
  r.andar();
  const papeis = [ANA, BIA, CAIO].map((q) => vista(r, q).papel);
  assert.equal(papeis.filter((p) => p === 'sozinho').length, 1);
  const sozinho = [ANA, BIA, CAIO][papeis.indexOf('sozinho')];
  const equipe = [ANA, BIA, CAIO].filter((q) => q !== sozinho);
  // só o primeiro da equipe está com o remo
  assert.deepEqual(equipe.map((q) => vista(r, q).remando), [true, false]);
  // o segundo da equipe tenta remar fora da vez: não conta
  r.em(JUNTAR_MS + 1000);
  r.rodada.acao(equipe[1], { tipo: 'acerto', n: 5, t: JUNTAR_MS + 800 });
  assert.equal(vista(r, ANA).equipe.remadas, 0);
  // quem vai sozinho rema mais devagar
  remar(r, new Map([[sozinho, [5, 250]], [equipe[0], [8, 200]], [equipe[1], [8, 300]]]));
  r.ateRevelar();
  assert.equal(vista(r, ANA).equipe.remadas, TRECHOS * REMADAS_POR_TRECHO);
  assert.equal(r.linhaDe(equipe[0]).posicao, 1);
  assert.equal(r.linhaDe(equipe[1]).posicao, 1, 'a equipe divide a posição');
  assert.equal(r.linhaDe(sozinho).posicao, 3);
  assert.ok((r.linhaDe(equipe[1]).valor ?? 0) > 0, 'o segundo remou no trecho dele');
});

test('revezamento: remadas acima do ritmo de gente são cortadas', () => {
  const r = rodadaDeTeste('revezamento', { rede: new Map([[ANA, 200]]) });
  r.em(100);
  r.rodada.acao(ANA, { tipo: 'acerto', entrar: 1 });
  r.em(JUNTAR_MS);
  r.andar();
  assert.equal(vista(r, ANA).sozinho.raposa, true);
  r.em(JUNTAR_MS + 1000);
  r.rodada.acao(ANA, { tipo: 'acerto', n: 90, t: JUNTAR_MS + 900 });
  assert.ok(vista(r, ANA).equipe.remadas <= 14, `${vista(r, ANA).equipe.remadas}`);
});
