import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OBJETOS as DO_SERVIDOR } from '../../server/src/minijogos';
import { OBJETOS, tamanhoLegivel } from '../src/minijogos';

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
