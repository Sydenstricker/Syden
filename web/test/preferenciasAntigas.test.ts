import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { converterPreferenciasAntigas } from '../src/settings';

// A conversão das preferências de quem já usava o Syden. Ela errou uma vez, e o modo como errou é o
// que este teste guarda: a marca de "já convertido" morava só nesta máquina, então a cópia que o
// servidor devolvia ao entrar desfazia a conversão.
//
// Por isso a conversão é uma FUNÇÃO PURA que roda em toda leitura, local ou vinda do servidor.

describe('as escolhas que saíram da tela não ficam guardadas', () => {
  it('o modo Leve vira Padrão', () => {
    // Sem isto, quem tinha o Leve guardado transmitiria com um modo que não existe mais nas tabelas
    // de useVoice.ts, e a transmissão quebraria ao começar.
    assert.deepEqual(converterPreferenciasAntigas({ screenQuality: 'light' }), { screenQuality: 'standard' });
    assert.deepEqual(converterPreferenciasAntigas({ screenQuality: 'smooth' }), { screenQuality: 'smooth' });
  });

  it('o codec escolhido à mão e o teto de quem assiste somem', () => {
    // Guardados, eles decidiriam a transmissão sem que ninguém pudesse mais ver nem mudar.
    const antigo = { screenCodec: 'vp8', codecEscolhidoAMao: true, qualidadeQueRecebo: 'baixa', theme: 'dark' };
    assert.deepEqual(converterPreferenciasAntigas(antigo), { theme: 'dark' });
  });

  it('roda quantas vezes for preciso, sem se atrapalhar', () => {
    // É o caso que quebrou: a conversão acontece ao ler o disco E ao receber do servidor, no mesmo
    // minuto. Ela precisa dar o mesmo resultado nas duas, e na terceira.
    const uma = converterPreferenciasAntigas({ screenQuality: 'light', screenCodec: 'h264', theme: 'dark' });
    const duas = converterPreferenciasAntigas(uma);
    assert.deepEqual(duas, uma);
    assert.equal(duas.theme, 'dark', 'e não perde o resto pelo caminho');
  });

  it('não inventa nada num pacote que nem fala de transmissão', () => {
    const outro = { theme: 'light', sounds: false };
    assert.deepEqual(converterPreferenciasAntigas(outro), outro);
  });
});
