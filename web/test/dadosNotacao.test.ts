import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ajustarModificador, comandoDeRolar, linhasParaIniciativa, linhasParaLista, somarDado } from '../src/dadosNotacao';

test('somarDado: começa, aumenta o igual e acrescenta o diferente', () => {
  assert.equal(somarDado('', 20), '1d20');
  assert.equal(somarDado('1d20', 20), '2d20');
  assert.equal(somarDado('d20', 20), '2d20');
  assert.equal(somarDado('2d6+3', 6), '3d6+3');
  assert.equal(somarDado('2d6', 8), '2d6+1d8');
  assert.equal(somarDado('1d100', 10), '1d100+1d10');
  assert.equal(somarDado('1d10', '%'), '1d10+1d%');
  assert.equal(somarDado('1d%', '%'), '2d%');
  assert.equal(somarDado('4d6dl1', 6), '5d6dl1');
  assert.equal(somarDado('100d6', 6), '100d6');
});

test('ajustarModificador: soma, troca o sinal e zera', () => {
  assert.equal(ajustarModificador('1d20', 1), '1d20+1');
  assert.equal(ajustarModificador('1d20+1', 1), '1d20+2');
  assert.equal(ajustarModificador('1d20+1', -1), '1d20');
  assert.equal(ajustarModificador('1d20', -2), '1d20-2');
  assert.equal(ajustarModificador('1d20-2', 3), '1d20+1');
  assert.equal(ajustarModificador('2d6+1d8', 1), '2d6+1d8+1');
  assert.equal(ajustarModificador('', 1), '');
});

test('linhas: itens e iniciativa com modificador', () => {
  assert.deepEqual(linhasParaLista(' a \n\n b\n'), ['a', 'b']);
  assert.deepEqual(linhasParaIniciativa('Ana +3\nBia\nCris - 1\nDragão Vermelho +10'), [
    { nome: 'Ana', mod: 3 },
    { nome: 'Bia', mod: 0 },
    { nome: 'Cris', mod: -1 },
    { nome: 'Dragão Vermelho', mod: 10 },
  ]);
});

test('o comando /r', () => {
  assert.equal(comandoDeRolar('/r 2d6+3'), '2d6+3');
  assert.equal(comandoDeRolar('/roll d20 vantagem'), 'd20 vantagem');
  assert.equal(comandoDeRolar('/rolar'), '');
  assert.equal(comandoDeRolar('  /R 1d4 '), '1d4');
  assert.equal(comandoDeRolar('/resolver 2d6'), null);
  assert.equal(comandoDeRolar('oi /r 2d6'), null);
});
