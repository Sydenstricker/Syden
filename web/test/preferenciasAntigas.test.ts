import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { converterPreferenciasAntigas } from '../src/settings';

// A conversão do padrão antigo de codec. Ela errou uma vez, e o modo como errou é o que este teste
// guarda: a marca de "já convertido" morava só nesta máquina, então a cópia que o servidor devolvia ao
// entrar desfazia a conversão — e a partir da segunda vez o automático nunca mais aparecia.
//
// Por isso a conversão é uma FUNÇÃO PURA que roda em toda leitura, local ou vinda do servidor, e a
// marca viaja dentro do próprio pacote de preferências.

describe('o padrão antigo de codec vira automático', () => {
  it('vp8 sem escolha à mão vira auto', () => {
    assert.deepEqual(converterPreferenciasAntigas({ screenCodec: 'vp8' }), { screenCodec: 'auto' });
  });

  it('vp8 ESCOLHIDO à mão continua vp8', () => {
    const escolhido = { screenCodec: 'vp8', codecEscolhidoAMao: true };
    assert.deepEqual(converterPreferenciasAntigas(escolhido), escolhido, 'escolha de gente não se desfaz sozinha');
  });

  it('h264 não é mexido', () => {
    const outro = { screenCodec: 'h264' };
    assert.deepEqual(converterPreferenciasAntigas(outro), outro);
  });

  it('roda quantas vezes for preciso, sem se atrapalhar', () => {
    // É o caso que quebrou: a conversão acontece ao ler o disco E ao receber do servidor, no mesmo
    // minuto. Ela precisa dar o mesmo resultado nas duas, e na terceira.
    const uma = converterPreferenciasAntigas({ screenCodec: 'vp8', theme: 'dark' });
    const duas = converterPreferenciasAntigas(uma);
    assert.deepEqual(duas, uma);
    assert.equal(duas.theme, 'dark', 'e não perde o resto pelo caminho');
  });

  it('não inventa nada num pacote que nem fala de codec', () => {
    const semCodec = { theme: 'light', sounds: false };
    assert.deepEqual(converterPreferenciasAntigas(semCodec), semCodec);
  });
});
