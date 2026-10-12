import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORIAS, RODADAS_STOP } from '../../server/src/minijogo-stop';
import { OBJETOS as DO_SERVIDOR } from '../../server/src/minijogos';
import { IDIOMAS } from '../src/i18n/idiomas';
import { CATEGORIAS_DO_STOP, letrasDoStop, OBJETOS, tamanhoLegivel } from '../src/minijogos';

describe('mini-games: o Stop', () => {
  it('o site e o servidor têm as mesmas categorias', () => {
    assert.deepEqual(Object.keys(CATEGORIAS_DO_STOP).sort(), [...CATEGORIAS].sort());
  });

  it('todo idioma tem letras para sortear as rodadas, sem repetir', () => {
    for (const { codigo } of IDIOMAS) {
      const letras = Array.from(letrasDoStop(codigo).letras);
      assert.equal(new Set(letras).size, letras.length, `${codigo}: letra repetida`);
      assert.ok(letras.length >= RODADAS_STOP, codigo);
    }
  });
});

describe('mini-games: o "Qual é maior?"', () => {
  it('o site e o servidor têm os mesmos objetos (o nome mora aqui, o tamanho lá)', () => {
    assert.deepEqual(Object.keys(OBJETOS).sort(), Object.keys(DO_SERVIDOR).sort());
  });

  it('o tamanho aparece na unidade que faz sentido', () => {
    assert.equal(tamanhoLegivel(0.0002, 'pt-BR'), '2 µm');
    assert.equal(tamanhoLegivel(0.5, 'pt-BR'), '5 mm');
    assert.equal(tamanhoLegivel(6.7, 'pt-BR'), '6,7 cm');
    assert.equal(tamanhoLegivel(550, 'pt-BR'), '5,5 m');
    assert.equal(tamanhoLegivel(347_400_000, 'pt-BR'), '3.474 km');
    assert.equal(tamanhoLegivel(550, 'en'), '5.5 m');
  });
});
