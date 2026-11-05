import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chao, chaoEm } from '../src/corrida/pista';
import { montarArena } from '../src/balao/arena';
import { criarPartida, type EventoDoBalao, type ResultadoDoSolo } from '../src/balao/partida';
import { ARENAS, BALOES, caminhoDoRepolho, DURACAO_PASSOS, itemDaCaixa, naParede } from '../src/balao/sim';

/**
 * O Estoura-balão no site: as arenas pintadas batem com a forma que o servidor conhece (sim.ts), o repolho não atravessa
 * parede, o sorteio das caixas é o combinado, e uma partida do Solo inteira (eu no piloto automático contra três coelhos do
 * computador) acaba, com caixas pegas, itens usados e balões estourados, sem ninguém dentro de parede nem andando mais do que
 * o servidor aceita.
 */

const arenas = ARENAS.map((a) => montarArena(a));

/** Um sorteio fixo para os testes. */
function sorteio(semente: number) {
  let s = semente;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

test('o chão pintado é a forma que o servidor conhece (parede é parede nos dois lados)', () => {
  const r = sorteio(3);
  for (const p of arenas) {
    let conferidos = 0;
    for (let i = 0; i < 20000; i++) {
      const x = 100 + r() * 824, y = 100 + r() * 824;
      // perto da beira de uma parede, o arredondamento da textura (meia unidade) decide: fica de fora
      if (naParede(p.arena, x, y, -1) !== naParede(p.arena, x, y, 1)) continue;
      conferidos++;
      assert.equal(chaoEm(p, x, y) === Chao.Parede, naParede(p.arena, x, y), `${p.arena.id}: (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
    assert.ok(conferidos > 15000);
  }
});

test('as largadas e as caixas ficam no chão de andar, longe das paredes', () => {
  for (const p of arenas) {
    assert.equal(p.arena.largadas.length, 8, p.arena.id);
    for (const [x, y] of [...p.arena.largadas, ...p.arena.caixas]) {
      assert.ok(!naParede(p.arena, x, y, -10), `${p.arena.id}: (${x}, ${y}) perto de parede`);
      assert.notEqual(chaoEm(p, x, y), Chao.Parede);
    }
  }
});

test('o repolho quica e não entra em parede; o mesmo lançamento dá sempre o mesmo caminho', () => {
  const r = sorteio(11);
  for (const p of arenas) {
    let lancados = 0;
    while (lancados < 300) {
      const x = 150 + r() * 724, y = 150 + r() * 724;
      if (naParede(p.arena, x, y, -6)) continue;
      const dx = r() - 0.5, dy = r() - 0.5;
      const l = { n: 10, x, y, dx, dy };
      const c = caminhoDoRepolho(p.arena, l)!;
      assert.ok(c.length >= 4);
      for (let k = 0; k < c.length; k += 2) assert.ok(!naParede(p.arena, c[k], c[k + 1], 2), `${p.arena.id}: o repolho entrou na parede em (${c[k]}, ${c[k + 1]})`);
      assert.deepEqual(caminhoDoRepolho(p.arena, l), c);
      lancados++;
    }
  }
  // direção que não é vetor não vale
  assert.equal(caminhoDoRepolho(ARENAS[0], { n: 0, x: 500, y: 300, dx: 0, dy: 0 }), null);
});

test('o sorteio das caixas: o repolho é o mais comum, a alface a mais rara', () => {
  const conta: Record<string, number> = { cenoura: 0, repolho: 0, lama: 0, alface: 0 };
  for (let k = 0; k < 4000; k++) conta[itemDaCaixa(12345, 7, k)]++;
  assert.ok(conta.repolho > 1400 && conta.repolho < 1800, JSON.stringify(conta));
  assert.ok(conta.alface > 450 && conta.alface < 750, JSON.stringify(conta));
  assert.ok(conta.cenoura > 800 && conta.lama > 600, JSON.stringify(conta));
  // o mesmo pedido, o mesmo item (o servidor faz a mesma conta)
  assert.equal(itemDaCaixa(99, -3, 4), itemDaCaixa(99, -3, 4));
});

for (const p of arenas) {
  test(`uma partida do Solo na ${p.arena.id}: o piloto automático e três robôs jogam até o fim`, () => {
    const eu = 1;
    const robos = [-1, -2, -3];
    const participantes = [eu, ...robos].map((id, i) => ({ id, nome: String(id), avatar: null, largada: i }));
    const eventos: EventoDoBalao[] = [];
    let fim: ResultadoDoSolo | null = null;
    const partida = criarPartida({
      arena: p,
      comandos: { acelera: false, freia: false, vira: 0, derrapa: false },
      eu,
      piloto: true,
      autopiloto: () => true,
      participantes,
      robos,
      semente: 4242,
      baloes: new Map(participantes.map((q) => [q.id, BALOES])),
      rivais: new Map(),
      eventos,
      aoFim: (r) => (fim = r),
    });
    const antes = new Map(partida.locais.map((l) => [l.id, { x: l.kart.x, y: l.kart.y, n: 0 }]));
    let maior = 0;
    while (!fim && partida.n < DURACAO_PASSOS + 10) {
      partida.passo();
      for (const l of partida.locais) {
        if (!partida.temBalao(l.id)) continue;
        assert.ok(!naParede(p.arena, l.kart.x, l.kart.y, 2), `${l.id} dentro da parede em (${l.kart.x}, ${l.kart.y}) no passo ${partida.n}`);
        // o que o servidor aceita: a cada 4 passos, no máximo o turbo
        if (partida.n % 4 === 0) {
          const a = antes.get(l.id)!;
          const d = Math.hypot(l.kart.x - a.x, l.kart.y - a.y);
          maior = Math.max(maior, d / 4);
          assert.ok(d <= (4 * 185 * 1.1) / 60 + 8, `${l.id} andou ${d.toFixed(1)} em 4 passos`);
          antes.set(l.id, { x: l.kart.x, y: l.kart.y, n: partida.n });
        }
      }
    }
    assert.ok(fim, 'a partida acabou');
    const r = fim as unknown as ResultadoDoSolo;
    const caixas = partida.locais.reduce((s, l) => s + l.caixas, 0);
    const usados = eventos.filter((e) => e.tipo === 'repolho' || e.tipo === 'lama' || e.tipo === 'cenoura' || e.tipo === 'alface').length;
    const estourados = eventos.filter((e) => e.tipo === 'estourou').length;
    console.log(`${p.arena.id}: ${(partida.n / 60).toFixed(1)} s, ${caixas} caixas, ${usados} itens, ${estourados} balões estourados; eu ${r.posicao}º de ${r.total}`);
    assert.ok(caixas >= 8, `${caixas} caixas pegas`);
    assert.ok(usados >= 6, `${usados} itens usados`);
    assert.ok(estourados >= 2, `${estourados} balões estourados`);
    assert.ok(r.posicao >= 1 && r.posicao <= 4 && r.total === 4);
    // um balão nunca volta: a sequência de cada um só desce
    const ultimo = new Map<number, number>();
    for (const e of eventos) {
      if (e.tipo !== 'estourou') continue;
      assert.ok(e.baloes < (ultimo.get(e.alvo) ?? BALOES));
      ultimo.set(e.alvo, e.baloes);
    }
  });
}
