import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORIAS_DO_QUIZ, ordemDosPedacos, PEDACOS_DA_BANDEIRA, ROTULOS, textoDoValor, textoDosParentes } from '../src/quiz';

test('o quiz: a família mostra os parentes, sem a própria figura, até três', () => {
  const nomes = new Map([
    ['Z', 'Zeus'],
    ['H', 'Hera'],
    ['A', 'Atena'],
    ['P', 'Posêidon'],
    ['D', 'Deméter'],
  ]);
  const nomeDe = (id: string) => nomes.get(id);
  assert.equal(textoDosParentes(['Z'], nomeDe), '—');
  assert.equal(textoDosParentes(['Z', 'H', 'A'], nomeDe), 'Hera, Atena');
  assert.equal(textoDosParentes(['Z', 'H', 'A', 'P', 'D'], nomeDe), 'Hera, Atena, Posêidon +1');
  assert.equal(textoDosParentes(undefined, nomeDe), '—');
});

test('o quiz: o gênero da figura, e o vazio como "—"', () => {
  const t = (chave: string) => chave;
  assert.equal(textoDoValor('mitologia', 'genero', 'feminino', t), 'Feminino');
  assert.equal(textoDoValor('mitologia', 'genero', '', t), '—');
  assert.ok(ROTULOS.mitologia.colunas.genero && ROTULOS.mitologia.colunas.familia);
});

test('o quiz: o modo Bandeira é uma escolha dos países, e os pedaços se abrem numa ordem da ficha', () => {
  assert.deepEqual(
    CATEGORIAS_DO_QUIZ.paises?.map((c) => c.id),
    ['tudo', 'bandeira'],
  );
  const ordem = ordemDosPedacos('a'.repeat(32));
  assert.deepEqual([...ordem].sort(), Array.from({ length: PEDACOS_DA_BANDEIRA }, (_, i) => i), 'cada pedaço uma vez');
  assert.deepEqual(ordemDosPedacos('a'.repeat(32)), ordem, 'a mesma ficha, a mesma ordem');
  const ordens = new Set(['0', '1', '2', '3', '4', '5', '6', '7'].map((f) => ordemDosPedacos(f.repeat(32)).join()));
  assert.ok(ordens.size > 1, 'fichas diferentes, ordens diferentes');
});

test('o quiz, os temas do lote D (21/11/2026): todo valor dos dados tem rótulo, e os números saem com a unidade', async () => {
  const { readFileSync } = await import('node:fs');
  const { pesoLegivel, QUIZZES } = await import('../src/quiz');
  for (const tema of ['elementos', 'dinossauros', 'estados', 'animais'] as const) {
    assert.ok(QUIZZES.includes(tema));
    const itens = JSON.parse(readFileSync(new URL(`../../server/assets/quiz/${tema}.json`, import.meta.url), 'utf8')) as Record<string, unknown>[];
    const rotulos = ROTULOS[tema];
    for (const [coluna, mapa] of Object.entries(rotulos.valores)) {
      for (const item of itens) {
        const valores = Array.isArray(item[coluna]) ? (item[coluna] as unknown[]) : [item[coluna]];
        for (const v of valores) assert.ok(mapa[String(v)], `${tema}/${String(item.id)}: ${coluna} = ${String(v)} sem rótulo`);
      }
    }
    for (const coluna of Object.keys(itens[0])) if (coluna !== 'id' && coluna !== 'nome' && coluna !== 'raro') assert.ok(rotulos.colunas[coluna], `${tema}: a coluna ${coluna}`);
  }
  const t = (chave: string) => chave;
  assert.equal(textoDoValor('dinossauros', 'periodo', 2, t), 'Jurássico');
  assert.equal(textoDoValor('animais', 'continentes', ['africa', 'asia'], t), 'África, Ásia');
  assert.equal(textoDoValor('estados', 'litoral', 'nao', t), 'Não');
  assert.match(pesoLegivel(6000), /^6 t$/);
  assert.match(pesoLegivel(0.003), /^3 g$/);
});
