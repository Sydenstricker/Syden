/**
 * Canteiro que encolhe (festa/canteiro.ts, o motor em festa/arena-da-horta.ts): o empurrão com aviso decidido no servidor, a
 * folga de quem leva, a borda que cai, a conferência da velocidade e os robôs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaAoVivo } from './festa-ajuda-aovivo.js';
import { sorteioFixo } from './festa-ajuda.js';
import { canteiroEm, CANTEIRO_MS, type DadosCanteiro } from '../src/festa/canteiro.js';
import { EMPURRAO_PREPARO } from '../src/festa/arena-da-horta.js';

const ANA = 1;
const BIA = 2;
type Q = { j: number[][]; g: number[][]; e: (string | number)[][] };

/** Anda de onde está até (x, y), a 90 por segundo, mandando a posição a cada 66 ms (como a tela). */
function andar(r: ReturnType<typeof rodadaAoVivo>, quem: number, de: [number, number], para: [number, number]) {
  let [x, y] = de;
  for (let k = 0; k < 200; k++) {
    const dx = para[0] - x;
    const dy = para[1] - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) break;
    const p = Math.min(d, 90 * 0.066);
    x += (dx / d) * p;
    y += (dy / d) * p;
    r.mandar(quem, { tipo: 'p', x, y, dx, dy });
    r.passos(1);
    // 66 ms por mensagem: um passo de 50 e mais um pouco a cada três
    if (k % 3 === 0) r.passos(0);
  }
  return [x, y] as [number, number];
}
const posDe = (r: ReturnType<typeof rodadaAoVivo>, quem: number) => (r.ultimo().q as Q).j.find((l) => l[0] === quem)!;

test('canteiro: o empurrão com aviso leva quem ficou na área para fora, e o último em pé ganha', () => {
  const r = rodadaAoVivo('canteiro');
  r.passos(1);
  // a Bia vai para perto da borda esquerda; a Ana chega do lado de dentro
  andar(r, BIA, [230, 100], [30, 100]);
  andar(r, ANA, [70, 100], [52, 100]);
  r.passos(4);
  assert.equal(posDe(r, BIA)[3], 1, 'a Bia está em pé');
  r.mandar(ANA, { tipo: 'e', dx: -1, dy: 0, x: 52, y: 100 });
  // a área aparece no quadro (o aviso), e a Bia fica parada
  r.passos(2);
  assert.equal((r.ultimo().q as Q).g.length, 1, 'o golpe aparece para todos antes de bater');
  r.passos(20);
  assert.equal(posDe(r, BIA)[3], 0, 'a Bia caiu');
  assert.ok(r.quadros.some((q) => (q.q as Q).e.some((e) => e[0] === 'c' && e[1] === BIA)), 'o evento da queda foi a todos');
  // o último em pé: a rodada acaba sozinha, sem esperar os 25 s
  r.passos(40);
  assert.equal(r.fase(), 'revelando');
  assert.ok(r.passou() < CANTEIRO_MS / 2);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('canteiro: quem sai da área durante o aviso escapa (quem leva tem folga, com 300 ms de rede)', () => {
  const r = rodadaAoVivo('canteiro');
  r.passos(1);
  let bia = andar(r, BIA, [230, 100], [100, 100]);
  andar(r, ANA, [70, 100], [118, 100]);
  r.mandar(ANA, { tipo: 'e', dx: -1, dy: 0, x: 118, y: 100 });
  // a Bia vê o aviso uns 300 ms depois de a Ana apertar (a ida da Ana, o quadro, a ida da Bia) e sai andando para baixo
  r.passos(6);
  bia = andar(r, BIA, bia, [100, 140]);
  r.passos(20);
  const b = posDe(r, BIA);
  assert.equal(b[3], 1, 'a Bia continua em pé');
  assert.ok(Math.abs(b[1] - 100) < 5 && b[2] > 130, `e onde ela andou: ${b}`);
  assert.ok(!r.quadros.some((q) => (q.q as Q).e.some((e) => e[0] === 'k')), 'ninguém levou');
});

test('canteiro: a trapaça óbvia não vale — o teletransporte, o empurrão em seguida e o resultado mandado pela tela', () => {
  const r = rodadaAoVivo('canteiro');
  r.passos(1);
  // pular do outro lado do canteiro de uma vez
  r.mandar(ANA, { tipo: 'p', x: 260, y: 100 });
  r.passos(3);
  assert.ok(posDe(r, ANA)[1] < 100, 'o pulo não valeu');
  // dois empurrões seguidos: só o primeiro
  r.mandar(ANA, { tipo: 'e', dx: 1, dy: 0 });
  r.mandar(ANA, { tipo: 'e', dx: 1, dy: 0 });
  r.passos(3);
  r.mandar(ANA, { tipo: 'e', dx: 0, dy: 1 });
  r.passos(3);
  assert.equal((r.ultimo().q as Q).g.length, 1);
  // o balde das mensagens: uma enxurrada não passa do limite (e não derruba nada)
  for (let k = 0; k < 500; k++) r.mandar(BIA, { tipo: 'p', x: 230, y: 100 });
  r.passos(3);
  // o 'resultado' da tela não trava ninguém em pé
  r.rodada.acao(BIA, { tipo: 'resultado', durou: CANTEIRO_MS });
  r.ateRevelar();
  assert.equal(r.linhaDe(BIA).motivo, 'invalido');
});

test('canteiro: quem fica na faixa que desmorona cai (com a folga da rede), e quem saiu a tempo não', () => {
  const r = rodadaAoVivo('canteiro', { aleatorio: sorteioFixo(5) });
  const d = r.rodada.publico(ANA).dados as DadosCanteiro;
  const e = d.etapas[0];
  const antes = canteiroEm(d, 0);
  // um ponto que some na primeira etapa, e um que fica
  const some: [number, number] = e.x0 > antes.x0 ? [antes.x0 + 8, 100] : e.x1 < antes.x1 ? [antes.x1 - 8, 100] : e.y0 > antes.y0 ? [150, antes.y0 + 8] : [150, antes.y1 - 8];
  r.passos(1);
  andar(r, ANA, [70, 100], some);
  andar(r, BIA, [230, 100], [150, 100]);
  while (r.passou() < e.t + 100) r.passos(1);
  assert.equal(posDe(r, ANA)[3], 1, 'a folga da rede: ainda não');
  while (r.passou() < e.t + 900) r.passos(1);
  assert.equal(posDe(r, ANA)[3], 0, 'a Ana caiu com a borda');
  assert.equal(posDe(r, BIA)[3], 1);
});

test('canteiro: com robôs, eles andam, empurram, e saem na revelação com o resultado do que fizeram', () => {
  for (const s of [1, 2, 3]) {
    const r = rodadaAoVivo('canteiro', { rede: new Map([[ANA, 200]]), robos: [-1, -2, -3], aleatorio: sorteioFixo(s) });
    const inicio = new Map((r.passos(1), (r.ultimo().q as Q).j.map((l) => [l[0], [l[1], l[2]]])));
    r.passos(60);
    const mexeram = (r.ultimo().q as Q).j.filter((l) => l[0] < 0 && (l[1] !== inicio.get(l[0])![0] || l[2] !== inicio.get(l[0])![1]));
    assert.ok(mexeram.length >= 2, 'os robôs andam');
    r.ateRevelar();
    assert.equal(r.fase(), 'revelando');
    for (const id of [-1, -2, -3]) assert.ok(r.linhaDe(id) && r.linhaDe(id).posicao !== null, `o robô ${id} na revelação`);
    assert.ok(r.quadros.some((q) => (q.q as Q).g.length > 0), 'algum robô empurrou');
  }
});

test('canteiro: o golpe leva o tempo do aviso para bater', () => {
  assert.ok(EMPURRAO_PREPARO >= 400, 'a preparação é visível com 200 ms de rede');
});
