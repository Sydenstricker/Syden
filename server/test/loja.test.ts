import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOGO, acharItem, podeVestir } from '../src/loja.js';

// Este arquivo não abre banco nenhum: o catálogo é uma lista, e as regras dele são só regras.

test('não existe código repetido no catálogo', () => {
  const vistos = new Set<string>();
  for (const item of CATALOGO) {
    assert.ok(!vistos.has(item.codigo), 'código repetido: ' + item.codigo);
    vistos.add(item.codigo);
  }
});

test('todo item de contribuinte tem nível, e nenhum outro tem', () => {
  for (const item of CATALOGO) {
    if (item.comoSeGanha === 'contribuinte') assert.ok(item.nivel, item.codigo + ' precisa de nível');
    else assert.equal(item.nivel, undefined, item.codigo + ' não devia ter nível');
  }
});

test('cor e fundo grátis se vestem sem ter nada no inventário', () => {
  assert.ok(podeVestir('carmim', 'cor', []));
  assert.ok(podeVestir('aurora', 'fundo', []));
  assert.ok(podeVestir(null, 'cor', []), 'tirar a cor é sempre permitido');
});

// Este é o teste que importa: a loja não pode virar um jeito de conseguir de graça o que é dos outros.
test('item de contribuinte só se veste tendo no inventário', () => {
  assert.equal(podeVestir('prisma', 'cor', []), false);
  assert.ok(podeVestir('prisma', 'cor', ['prisma']));
});

test('insígnia de conquista não se veste só porque se pediu', () => {
  assert.equal(podeVestir('primeiros-25', 'insignia', []), false);
  assert.ok(podeVestir('primeiros-25', 'insignia', ['primeiros-25']));
});

test('código inventado é recusado, mesmo dizendo que está no inventário', () => {
  // Um app adulterado manda o que quiser; quem decide é o servidor.
  assert.equal(podeVestir('moldura-de-administrador', 'moldura', ['moldura-de-administrador']), false);
  assert.equal(acharItem('moldura-de-administrador'), undefined);
});

test('item do tipo errado é recusado: cor não é moldura', () => {
  assert.equal(podeVestir('carmim', 'moldura', []), false, 'uma cor de nome não pode virar moldura de avatar');
  assert.equal(podeVestir('prata', 'cor', []), false);
});

// Se a loja oferecesse uma cor que o app não sabe pintar, a pessoa escolheria e nada aconteceria.
test('os grátis cobrem tudo o que já existia antes da loja', () => {
  for (const codigo of ['padrao', 'carmim', 'laranja', 'ouro', 'limao', 'menta', 'ceu', 'anil', 'lavanda', 'rosa']) {
    assert.ok(podeVestir(codigo, 'cor', []), codigo + ' era grátis antes da loja e tem que continuar sendo');
  }
  for (const codigo of ['nenhum', 'vila', 'poente', 'floresta', 'aurora', 'brasa', 'oceano', 'estrelas']) {
    assert.ok(podeVestir(codigo, 'fundo', []), codigo + ' era grátis antes da loja e tem que continuar sendo');
  }
});
