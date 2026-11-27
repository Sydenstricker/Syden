/**
 * Os dados do chat: a notação, as contas e os sorteios (server/src/dados.ts). Sem banco, com o sorteador na mão.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dividirEmTimes, embaralhar, ErroDeDados, escolher, iniciativa, lerExpressao, LIMITES, moeda, numero, resumoDoDado, rolar, sorteadorDeVerdade } from '../src/dados.js';

/** Um sorteador que devolve os valores da lista, na ordem (e dá erro se pedirem mais do que há). */
function fixo(...valores: number[]) {
  let i = 0;
  return (faces: number) => {
    assert.ok(i < valores.length, 'sorteou mais vezes do que o teste previa');
    const v = valores[i++];
    assert.ok(v >= 1 && v <= faces, `o valor ${v} não cabe num dado de ${faces} faces`);
    return v;
  };
}

test('soma simples: 2d6+3', () => {
  const r = rolar('2d6+3', fixo(4, 5));
  assert.equal(r.total, 12);
  assert.equal(r.expressao, '2d6+3');
  assert.deepEqual(r.termos[0].tipo === 'dados' ? r.termos[0].rolados : [], [4, 5]);
  assert.equal(resumoDoDado(r), '🎲 2d6+3 = 12');
});

test('aceita maiúsculas, espaços, "d20" sozinho e o d%', () => {
  assert.equal(rolar(' D20 + 5 ', fixo(7)).total, 12);
  assert.equal(rolar('d%', fixo(42)).total, 42);
  assert.equal(rolar('1d100', fixo(100)).total, 100);
});

test('subtrai termos e dados', () => {
  assert.equal(rolar('1d8-2', fixo(3)).total, 1);
  assert.equal(rolar('2d6-1d4', fixo(6, 6, 3)).total, 9);
  assert.equal(rolar('10-d6', fixo(4)).total, 6);
});

test('vantagem e desvantagem: dois d20, fica um', () => {
  const v = rolar('d20+5 vantagem', fixo(3, 17));
  assert.equal(v.total, 22);
  assert.equal(v.modo, 'vantagem');
  assert.equal(v.expressao, '2d20kh1+5');
  const d = rolar('d20+5 desvantagem', fixo(3, 17));
  assert.equal(d.total, 8);
  assert.equal(d.modo, 'desvantagem');
  assert.equal(rolar('vantagem', fixo(2, 9)).total, 9);
  assert.throws(() => rolar('2d6 vantagem', fixo(1, 1)), ErroDeDados);
});

test('manter e descartar: 4d6dl1, 2d20kl1, 5d6kh3', () => {
  const r = rolar('4d6dl1', fixo(6, 2, 5, 3));
  assert.equal(r.total, 14);
  const t = r.termos[0];
  assert.ok(t.tipo === 'dados');
  assert.deepEqual(t.usados, [true, false, true, true]);
  assert.equal(rolar('5d6kh3', fixo(1, 6, 5, 2, 4)).total, 15);
  assert.equal(rolar('3d6dh1', fixo(1, 6, 5)).total, 6);
  assert.equal(rolar('2d20k1', fixo(4, 15)).total, 15);
  assert.throws(() => rolar('4d6kh2dl1', fixo(1, 1, 1, 1)), ErroDeDados);
});

test('dados que explodem: o máximo rola de novo', () => {
  const r = rolar('2d6!', fixo(6, 3, 4));
  assert.equal(r.total, 6 + 3 + 4);
  const t = r.termos[0];
  assert.ok(t.tipo === 'dados');
  assert.deepEqual(t.rolados, [6, 3, 4]);
});

test('a explosão tem teto', () => {
  const r = rolar('1d2!', () => 2);
  const t = r.termos[0];
  assert.ok(t.tipo === 'dados');
  assert.equal(t.rolados.length, 1 + LIMITES.explosoesPorDado);
});

test('contar sucessos: 6d10>=8', () => {
  const r = rolar('6d10>=8', fixo(10, 7, 8, 1, 9, 3));
  assert.equal(r.total, 3);
  assert.equal(rolar('4d6<3', fixo(1, 2, 3, 6)).total, 2);
  assert.equal(rolar('3d6>5+2', fixo(6, 6, 1)).total, 4);
});

test('o dado de dois resultados (4dF) vai de -1 a 1', () => {
  const r = rolar('4dF', fixo(1, 2, 3, 3));
  assert.equal(r.total, -1 + 0 + 1 + 1);
  assert.throws(() => rolar('4dF!', fixo(1, 1, 1, 1)), ErroDeDados);
});

test('crítico e falha só no d20 sozinho', () => {
  assert.equal(rolar('d20', fixo(20)).destaque, 'critico');
  assert.equal(rolar('d20+3', fixo(1)).destaque, 'falha');
  assert.equal(rolar('d20', fixo(11)).destaque, null);
  assert.equal(rolar('2d20', fixo(20, 20)).destaque, null);
  assert.equal(rolar('d20 vantagem', fixo(1, 20)).destaque, 'critico');
  assert.equal(rolar('d20 desvantagem', fixo(1, 20)).destaque, 'falha');
  assert.equal(rolar('d20+d6', fixo(20, 3)).destaque, null);
});

test('expressões inválidas dão erro em português', () => {
  for (const ruim of ['', '   ', 'abc', '2d', 'd1', '2d1001', '101d6', '+', '5', '2d6 3', '2d6++3', 'd20 sorte', '3d6>=']) {
    assert.throws(() => lerExpressao(ruim), ErroDeDados, `"${ruim}" devia ser recusada`);
  }
  assert.throws(() => lerExpressao('x'.repeat(101)), /até 100/);
  assert.throws(() => lerExpressao('100d6+100d6+1d6'), /no máximo 200/);
  assert.throws(() => lerExpressao('1d6+1+1+1+1+1+1+1+1+1+1'), /até 10 termos/);
});

test('com o sorteador de verdade: sempre dentro das faces, e bate com a soma', () => {
  for (let i = 0; i < 300; i++) {
    const r = rolar('3d8+2', sorteadorDeVerdade);
    const t = r.termos[0];
    assert.ok(t.tipo === 'dados');
    assert.ok(t.rolados.every((v) => v >= 1 && v <= 8));
    assert.equal(r.total, t.rolados.reduce((a, b) => a + b, 0) + 2);
  }
});

test('o sorteador de verdade não tem viés visível num d6 (30 mil rolagens)', () => {
  const contagem = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 30000; i++) contagem[sorteadorDeVerdade(6) - 1]++;
  for (const c of contagem) assert.ok(c > 4600 && c < 5400, `contagem fora do esperado: ${contagem}`);
});

test('moeda', () => {
  assert.equal(moeda(fixo(1)).resultado, 'cara');
  assert.equal(moeda(fixo(2)).resultado, 'coroa');
  assert.equal(resumoDoDado(moeda(fixo(2))), '🪙 Coroa');
});

test('número entre A e B, inclusive nas pontas e com faixa grande', () => {
  assert.equal(numero(5, 10, fixo(1)).valor, 5);
  assert.equal(numero(5, 10, fixo(6)).valor, 10);
  assert.equal(numero(-3, 3, fixo(4)).valor, 0);
  for (let i = 0; i < 200; i++) {
    const n = numero(1, 1_000_000, sorteadorDeVerdade);
    assert.ok(n.valor >= 1 && n.valor <= 1_000_000);
  }
  assert.throws(() => numero(10, 5), ErroDeDados);
  assert.throws(() => numero(1, 1.5), ErroDeDados);
  assert.throws(() => numero(1, 2_000_000_000), ErroDeDados);
});

test('escolher: a roleta limpa a lista e sorteia uma', () => {
  const e = escolher([' pizza ', 'sushi', 'pizza', '', 'lanche'], fixo(2));
  assert.deepEqual(e.opcoes, ['pizza', 'sushi', 'lanche']);
  assert.equal(e.opcoes[e.escolhida], 'sushi');
  assert.throws(() => escolher(['só uma']), ErroDeDados);
  assert.throws(() => escolher(Array.from({ length: 51 }, (_, i) => `o${i}`)), ErroDeDados);
});

test('embaralhar guarda os mesmos itens', () => {
  const o = embaralhar(['a', 'b', 'c', 'd'], sorteadorDeVerdade);
  assert.deepEqual([...o.itens].sort(), ['a', 'b', 'c', 'd']);
});

test('times: tamanhos que diferem em no máximo um, ninguém repetido', () => {
  const nomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const r = dividirEmTimes(nomes, 3, sorteadorDeVerdade);
  assert.equal(r.times.length, 3);
  assert.ok(Math.max(...r.times.map((t) => t.length)) - Math.min(...r.times.map((t) => t.length)) <= 1);
  assert.deepEqual(r.times.flat().sort(), nomes);
  assert.throws(() => dividirEmTimes(['a', 'b'], 3), ErroDeDados);
  assert.throws(() => dividirEmTimes(nomes, 9), ErroDeDados);
});

test('iniciativa: d20 + modificador, do maior para o menor', () => {
  // dado de ana 10, desempate de ana 1; dado de bia 15; dado de caio 10 com modificador maior
  const r = iniciativa(
    [
      { nome: 'ana', mod: 0 },
      { nome: 'bia', mod: 1 },
      { nome: 'caio', mod: 2 },
    ],
    fixo(10, 1, 15, 1, 8, 1),
  );
  assert.deepEqual(
    r.entradas.map((e) => [e.nome, e.total]),
    [
      ['bia', 16],
      ['caio', 10],
      ['ana', 10],
    ],
  );
  assert.throws(() => iniciativa([{ nome: 'ana', mod: 0 }, { nome: 'ana', mod: 1 }]), /duas vezes/);
  assert.throws(() => iniciativa([{ nome: '', mod: 0 }]), ErroDeDados);
  assert.throws(() => iniciativa([{ nome: 'a', mod: 99 }]), ErroDeDados);
  assert.throws(() => iniciativa([]), ErroDeDados);
});
