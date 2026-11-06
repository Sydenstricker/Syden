/** As chaves da porteira (festa/porteira.ts): pegar vale para quem está perto e chega primeiro; o empurrão derruba a cenoura. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaAoVivo } from './festa-ajuda-aovivo.js';
import { sorteioFixo } from './festa-ajuda.js';
import { CERCA_Y, PORTEIRA_X, type DadosPorteira } from '../src/festa/porteira.js';

const ANA = 1;
const BIA = 2;
type Q = { j: number[][]; k: number[][]; pp: number[]; e: (string | number)[][] };
const posDe = (r: ReturnType<typeof rodadaAoVivo>, quem: number) => (r.ultimo().q as Q).j.find((l) => l[0] === quem)!;

function andar(r: ReturnType<typeof rodadaAoVivo>, quem: number, para: [number, number], vel = 75) {
  r.passos(1);
  let [x, y] = [posDe(r, quem)[1], posDe(r, quem)[2]];
  for (let k = 0; k < 400; k++) {
    const dx = para[0] - x;
    const dy = para[1] - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) break;
    const p = Math.min(d, vel * 0.05);
    x += (dx / d) * p;
    y += (dy / d) * p;
    r.mandar(quem, { tipo: 'p', x, y, dx, dy });
    r.passos(1);
  }
  r.passos(4);
  return [x, y] as [number, number];
}

test('porteira: quem chega perto pega a cenoura, leva à porteira e passa; quem fica sem perde', () => {
  const r = rodadaAoVivo('porteira', { aleatorio: sorteioFixo(1) });
  const { chaves } = r.rodada.publico(ANA).dados as DadosPorteira;
  assert.equal(chaves.length, 1, 'uma cenoura a menos que a turma');
  // a Bia pede de longe: não vale (ela está jogando: manda a posição de onde está)
  r.passos(1);
  r.mandar(BIA, { tipo: 'p', x: posDe(r, BIA)[1], y: posDe(r, BIA)[2] });
  r.mandar(BIA, { tipo: 'pega', i: 0 });
  r.passos(4);
  assert.equal((r.ultimo().q as Q).k[0][2], 0, 'de longe, não pega');
  andar(r, ANA, chaves[0]);
  r.mandar(ANA, { tipo: 'pega', i: 0 });
  r.passos(4);
  assert.equal((r.ultimo().q as Q).k[0][2], ANA, 'a Ana pegou');
  // a Bia chega depois e pede: já tem dona
  r.mandar(BIA, { tipo: 'pega', i: 0 });
  andar(r, ANA, [PORTEIRA_X, CERCA_Y]);
  r.passos(30);
  assert.equal(r.fase(), 'revelando', 'todas as cenouras passaram: acabou');
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('porteira: o empurrão derruba a cenoura, e ela fica um instante sem poder ser pega', () => {
  const r = rodadaAoVivo('porteira', { aleatorio: sorteioFixo(1) });
  const { chaves } = r.rodada.publico(ANA).dados as DadosPorteira;
  const [cx, cy] = chaves[0];
  andar(r, ANA, [cx, cy]);
  r.mandar(ANA, { tipo: 'pega', i: 0 });
  r.passos(4);
  const bia = andar(r, BIA, [cx + 24, cy]);
  r.mandar(BIA, { tipo: 'e', dx: -1, dy: 0, x: bia[0], y: bia[1] });
  r.passos(16);
  const k = (r.ultimo().q as Q).k[0];
  assert.equal(k[2], 0, 'a cenoura caiu');
  assert.ok(r.quadros.some((q) => (q.q as Q).e.some((e) => e[0] === 's' && e[1] === ANA)));
});

test('porteira: com robôs, eles pegam as cenouras e passam, e a rodada acaba', () => {
  const r = rodadaAoVivo('porteira', { rede: new Map([[ANA, 200]]), robos: [-1, -2, -3], aleatorio: sorteioFixo(9) });
  r.ateRevelar();
  const passaram = r.linhas().filter((l) => (l.valor ?? 0) > 0);
  assert.ok(passaram.length >= 2, `passaram: ${passaram.map((l) => l.userId)}`);
  assert.equal(r.linhaDe(ANA).motivo, 'nada', 'a Ana, que não jogou, não pontua');
});
