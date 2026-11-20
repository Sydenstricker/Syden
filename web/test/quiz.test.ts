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
