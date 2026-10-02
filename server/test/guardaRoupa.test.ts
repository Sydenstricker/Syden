import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOGO, acharItem, podeVestir } from '../src/guardaRoupa.js';

// Este arquivo não abre banco nenhum: o catálogo é uma lista, e as regras dele são só regras.

test('não existe código repetido no catálogo', () => {
  const vistos = new Set<string>();
  for (const item of CATALOGO) {
    assert.ok(!vistos.has(item.codigo), 'código repetido: ' + item.codigo);
    vistos.add(item.codigo);
  }
});

// O GUARDA-ROUPA NÃO TEM ITEM DE PAGANTE, e isto é o que garante que ninguém acrescente um por distração.
// Quem contribui já tinha acesso a tudo antes de contribuir: a contribuição é doação, não compra.
// Só insígnia pode ser exclusiva, porque ela significa uma história, e não um pagamento.
test('o guarda-roupa inteiro é grátis; só insígnia depende de ter acontecido alguma coisa', () => {
  for (const item of CATALOGO) {
    assert.ok(
      item.comoSeGanha === 'livre' || item.tipo === 'insignia',
      item.codigo + ' não é livre e não é insígnia — virou item de pagante sem querer?',
    );
  }
});

test('todo cosmético do catálogo se veste sem ter nada no inventário', () => {
  for (const item of CATALOGO) {
    if (item.tipo === 'insignia') continue;
    assert.ok(podeVestir(item.codigo, item.tipo, []), item.codigo + ' tinha que ser de graça');
  }
});

test('cor e fundo grátis se vestem sem ter nada no inventário', () => {
  assert.ok(podeVestir('carmim', 'cor', []));
  assert.ok(podeVestir('aurora', 'fundo', []));
  assert.ok(podeVestir(null, 'cor', []), 'tirar a cor é sempre permitido');
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

// Se o guarda-roupa oferecesse uma cor que o app não sabe pintar, a pessoa escolheria e nada aconteceria.
test('os grátis cobrem tudo o que já existia antes do guarda-roupa', () => {
  for (const codigo of ['padrao', 'carmim', 'laranja', 'ouro', 'limao', 'menta', 'ceu', 'anil', 'lavanda', 'rosa']) {
    assert.ok(podeVestir(codigo, 'cor', []), codigo + ' era grátis antes do guarda-roupa e tem que continuar sendo');
  }
  for (const codigo of ['nenhum', 'vila', 'poente', 'floresta', 'aurora', 'brasa', 'oceano', 'estrelas']) {
    assert.ok(podeVestir(codigo, 'fundo', []), codigo + ' era grátis antes do guarda-roupa e tem que continuar sendo');
  }
});
