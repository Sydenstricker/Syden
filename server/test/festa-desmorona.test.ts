/** Chão que desmorona (festa/desmorona.ts): a tábua pisada racha e cai, quem fica nela cai (com a folga), e o robô foge. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaAoVivo } from './festa-ajuda-aovivo.js';
import { sorteioFixo } from './festa-ajuda.js';
import { RACHA_MS, tabuaEm } from '../src/festa/desmorona.js';

const ANA = 1;
const BIA = 2;
type Q = { j: number[][]; g: number[][]; e: (string | number)[][]; b: [number, number][] };
const posDe = (r: ReturnType<typeof rodadaAoVivo>, quem: number) => (r.ultimo().q as Q).j.find((l) => l[0] === quem)!;

test('desmorona: a tábua em que se pisa racha, e quem fica parado nela cai com a folga da rede; quem sai a tempo, não', () => {
  const r = rodadaAoVivo('desmorona', { aleatorio: sorteioFixo(2) });
  r.passos(1);
  // a Ana pisa (manda a posição de largada) e fica parada; a Bia anda de tábua em tábua
  const ana = posDe(r, ANA);
  r.mandar(ANA, { tipo: 'p', x: ana[1], y: ana[2] });
  r.passos(18);
  const tabua = tabuaEm(ana[1], ana[2]);
  const marcada = (r.ultimo().q as Q).b.find(([i]) => i === tabua);
  assert.ok(marcada, 'a tábua da Ana rachou');
  let bia: [number, number] = [posDe(r, BIA)[1], posDe(r, BIA)[2]];
  const ate = r.passou() + RACHA_MS + 1500;
  let k = 0;
  while (r.passou() < ate) {
    // a Bia anda para cima e para baixo, a 80 por segundo, sem ficar numa tábua mais que meio segundo
    bia = [bia[0], 100 + 30 * ((Math.floor(k / 12) % 2) * 2 - 1) * ((k % 12) / 12)];
    r.mandar(BIA, { tipo: 'p', x: bia[0], y: bia[1] });
    r.passos(1);
    k++;
  }
  assert.equal(posDe(r, ANA)[3], 0, 'a Ana caiu');
  assert.ok(r.quadros.some((q) => (q.q as Q).e.some((e) => e[0] === 'c' && e[1] === ANA)));
});

test('desmorona: a tábua cai na hora para o servidor, mas quem estava nela só cai depois da folga da rede dele', () => {
  const r = rodadaAoVivo('desmorona', { rede: new Map([[ANA, 300], [BIA, 300]]), aleatorio: sorteioFixo(3) });
  r.passos(1);
  const ana = posDe(r, ANA);
  r.mandar(ANA, { tipo: 'p', x: ana[1], y: ana[2] });
  r.passos(18);
  const tabua = tabuaEm(ana[1], ana[2]);
  const cai = (r.ultimo().q as Q).b.find(([i]) => i === tabua)![1];
  while (r.passou() < cai + 100) r.passos(1);
  assert.equal(posDe(r, ANA)[3], 1, 'ainda em pé logo depois: a folga');
  // ela sai a tempo NA TELA DELA (a posição chega 150 ms depois): o servidor aceita, porque a tábua de 300 + 300 ms atrás existia
  r.mandar(ANA, { tipo: 'p', x: ana[1] + 30, y: ana[2] });
  r.passos(10);
  assert.equal(posDe(r, ANA)[3], 1, 'saiu a tempo, com 300 ms de rede');
});

test('desmorona: com robôs, a rodada acaba quando sobra um, e eles fogem das tábuas que racham', () => {
  for (const s of [4, 5]) {
    const r = rodadaAoVivo('desmorona', { rede: new Map([[ANA, 200]]), robos: [-1, -2, -3], aleatorio: sorteioFixo(s) });
    r.ateRevelar();
    assert.equal(r.fase(), 'revelando');
    // a Ana (que não andou) cai pelas tábuas que racham sozinhas; algum robô dura mais que ela
    const robos = [-1, -2, -3].map((id) => r.linhaDe(id));
    assert.ok(robos.every((l) => l.posicao !== null));
    assert.ok(robos.some((l) => (l.valor ?? 0) > 8000), `os robôs duram: ${robos.map((l) => l.valor)}`);
  }
});
