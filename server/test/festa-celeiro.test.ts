/** As cartas do celeiro (festa/celeiro.ts): em turnos, só quem está na vez vira, e o que há debaixo da carta só sai quando ela é virada. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { MOSTRA_MS, RAPOSA, VEZ_MS, type VistaCeleiro } from '../src/festa/celeiro.js';
import { JUNTAR_MS } from '../src/festa/lote4-turma.js';

const ANA = 1;
const BIA = 2;
const CAIO = 3;

const vista = (r: ReturnType<typeof rodadaDeTeste>, quem = ANA) => r.rodada.publico(quem).dados as VistaCeleiro;

function comTres(semente: number) {
  const r = rodadaDeTeste('celeiro', { rede: new Map([[ANA, 200], [BIA, 300], [CAIO, 250]]), aleatorio: sorteioFixo(semente) });
  for (const q of [ANA, BIA, CAIO]) {
    r.em(150);
    r.rodada.acao(q, { tipo: 'acerto', entrar: 1 });
  }
  r.em(JUNTAR_MS);
  r.andar();
  return r;
}
/** Quem está na vez agora. */
const naVez = (r: ReturnType<typeof rodadaDeTeste>) => {
  for (const q of [ANA, BIA, CAIO]) {
    const v = vista(r, q);
    if (v.vez >= 0 && v.vez === v.eu) return { quem: q, n: v.n };
  }
  return null;
};

test('celeiro: a vista não conta o que há debaixo das cartas, nem a quem assiste', () => {
  const r = comTres(3);
  const v = vista(r);
  assert.equal(v.cartas, 12);
  assert.deepEqual(v.viradas, []);
  assert.ok(!('baralho' in v));
  assert.equal(vista(r, 99).eu, -1, 'quem assiste não está na turma');
  assert.equal(v.turma.length, 3);
});

test('celeiro: só quem está na vez vira, uma carta por vez, e a raposa tira do jogo', () => {
  const r = comTres(5);
  const vez = naVez(r)!;
  const outro = [ANA, BIA, CAIO].find((q) => q !== vez.quem)!;
  // o outro tenta virar fora da vez: nada
  r.avancar(300);
  r.rodada.acao(outro, { tipo: 'acerto', vira: 0, n: vez.n });
  assert.equal(vista(r).viradas.length, 0);
  // quem está na vez vira duas (a segunda já não vale: a vez acabou)
  r.rodada.acao(vez.quem, { tipo: 'acerto', vira: 0, n: vez.n });
  r.rodada.acao(vez.quem, { tipo: 'acerto', vira: 1, n: vez.n });
  assert.equal(vista(r).viradas.length, 1);
  // e todos jogam até acabar: cada um vira até achar a dourada, ou guarda com 2
  for (let k = 0; k < 40 && r.rodada.publico(ANA).fase === 'jogando'; k++) {
    r.andar();
    const v = naVez(r);
    if (!v) continue;
    const ja = vista(r).viradas.map((c) => c.i);
    const minhas = vista(r, v.quem);
    r.avancar(250);
    if (minhas.turma[minhas.eu].cenouras >= 2) r.rodada.acao(v.quem, { tipo: 'acerto', guarda: 1, n: v.n });
    else r.rodada.acao(v.quem, { tipo: 'acerto', vira: [...Array(12).keys()].find((i) => !ja.includes(i)), n: v.n });
  }
  assert.equal(r.rodada.publico(ANA).fase, 'revelando');
  const final = vista(r);
  for (const [k, q] of [ANA, BIA, CAIO].map((q) => [vista(r, q).eu, q] as const)) {
    const p = final.turma[k];
    const linha = r.linhaDe(q);
    if (p.fora === 'raposa') assert.equal(linha.motivo, 'errou');
    else assert.equal(linha.valor, p.cenouras);
  }
  assert.ok(final.viradas.every((c) => c.tipo === RAPOSA || c.tipo >= 1));
});

test('celeiro: quem não decide na vez guarda sozinho, e a partida acaba', () => {
  const r = comTres(8);
  for (let k = 0; k < 10 && r.rodada.publico(ANA).fase === 'jogando'; k++) r.andar();
  assert.equal(r.rodada.publico(ANA).fase, 'revelando');
  assert.ok(r.agora() - r.largou <= JUNTAR_MS + 3 * VEZ_MS + MOSTRA_MS);
  for (const q of [ANA, BIA, CAIO]) assert.equal(r.linhaDe(q).motivo, 'errou', 'sem cenoura nenhuma');
});
