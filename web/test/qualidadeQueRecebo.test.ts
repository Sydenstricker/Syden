import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VideoQuality } from 'livekit-client';
import { maiorQualidade } from '../src/qualidadeQueRecebo.js';

// "Sem teto" é a maior versão que a transmissão TEM (12/11/2026). Com duas versões o LiveKit as rotula "baixa" e "média";
// pedir "alta" fazia ele ignorar o tamanho do quadro e mandar 1080p a todo mundo, celular em pé incluído.
describe('o teto de quem assiste', () => {
  const com = (...qualidades: number[]) => ({ trackInfo: { layers: qualidades.map((quality) => ({ quality })) } }) as never;
  it('duas versões: o teto é a média, que é a de 1080p', () => {
    assert.equal(maiorQualidade(com(0, 1)), VideoQuality.MEDIUM);
  });
  it('três versões (quem ainda está com o site antigo aberto): a alta', () => {
    assert.equal(maiorQualidade(com(0, 1, 2)), VideoQuality.HIGH);
  });
  it('sem saber as camadas, a alta, como antes', () => {
    assert.equal(maiorQualidade({ trackInfo: undefined } as never), VideoQuality.HIGH);
  });
});
