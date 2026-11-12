import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ENVIO_DO_FLUIDO_MBPS, recomendar, taxaDoEnvio } from '../src/recomendarModo.js';

// O botão "Recomendar para este computador" (12/11/2026): o que já aconteceu vale mais que as medidas, depois a placa,
// depois a internet. O Fluido só com as três a favor.
describe('a recomendação de modo', () => {
  const bom = { envioMbps: 30, placaDa60: true, ultimoFluido: null } as const;
  it('internet com folga, placa que dá 60 e nada contra: Fluido', () => {
    assert.deepEqual(recomendar(bom), { modo: 'smooth', motivo: 'cabe', envioMbps: 30 });
    assert.equal(recomendar({ ...bom, ultimoFluido: 'aguentou' }).modo, 'smooth');
  });
  it('o Fluido que caiu para 30 na última transmissão pesa mais que tudo', () => {
    assert.deepEqual(recomendar({ ...bom, ultimoFluido: 'caiu' }), { modo: 'standard', motivo: 'caiu', envioMbps: 30 });
  });
  it('sem a placa, Padrão; sem a internet, Padrão', () => {
    assert.equal(recomendar({ ...bom, placaDa60: false }).motivo, 'placa');
    assert.equal(recomendar({ ...bom, envioMbps: ENVIO_DO_FLUIDO_MBPS - 0.1 }).motivo, 'internet');
    assert.equal(recomendar({ ...bom, envioMbps: ENVIO_DO_FLUIDO_MBPS }).modo, 'smooth');
  });
});

describe('a taxa de envio', () => {
  it('tira os primeiros pedaços, da conexão esquentando, e fica com a mediana', () => {
    assert.equal(taxaDoEnvio([2, 4, 20, 22, 21, 23, 19]), 21);
    assert.equal(taxaDoEnvio([3, 9, 10, 11]), 10);
  });
  it('internet lenta manda poucos pedaços, e dois bastam; um só não', () => {
    assert.equal(taxaDoEnvio([2.1, 2.3]), 2.3);
    assert.equal(taxaDoEnvio([2.1]), null);
    assert.equal(taxaDoEnvio([]), null);
  });
});
