import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ESTADO_INICIAL,
  FOLGA_PARA_VOLTAR_MS,
  JUSTO_POR_MS,
  fracaoPerdida,
  proximoApertoDeQuemAssiste as passo,
  type EstadoDoAperto,
  type Medida,
} from '../src/apertoDeQuemAssiste.js';

const semFoco = (agora: number, extra: Partial<Medida> = {}): Medida => ({ comFoco: false, pressao: 'nominal', perdaDeQuadros: null, agora, ...extra });

/** Roda uma medida por segundo, de `de` a `ate` (ms), com a mesma leitura. */
function correr(estado: EstadoDoAperto, de: number, ate: number, extra: Partial<Medida>) {
  for (let t = de; t <= ate; t += 1000) estado = passo(estado, semFoco(t, extra));
  return estado;
}

describe('quem assiste sem foco com o computador apertado', () => {
  it('com foco nunca aperta, nem com o processador crítico', () => {
    const e = passo(ESTADO_INICIAL, { comFoco: true, pressao: 'critical', perdaDeQuadros: 0.9, agora: 0 });
    assert.equal(e.apertado, false);
  });

  it('sem foco e folgado, a imagem fica a maior (quem só assiste no segundo monitor não perde nada)', () => {
    assert.equal(correr(ESTADO_INICIAL, 0, 60_000, {}).apertado, false);
  });

  it('"serious" aperta na hora; "fair" só depois de alguns segundos seguidos', () => {
    assert.equal(passo(ESTADO_INICIAL, semFoco(0, { pressao: 'serious' })).apertado, true);
    assert.equal(correr(ESTADO_INICIAL, 0, JUSTO_POR_MS - 1000, { pressao: 'fair' }).apertado, false);
    assert.equal(correr(ESTADO_INICIAL, 0, JUSTO_POR_MS, { pressao: 'fair' }).apertado, true);
  });

  it('"fair" com uma leitura normal no meio recomeça a conta', () => {
    let e = correr(ESTADO_INICIAL, 0, JUSTO_POR_MS - 1000, { pressao: 'fair' });
    e = passo(e, semFoco(JUSTO_POR_MS));
    e = correr(e, JUSTO_POR_MS + 1000, JUSTO_POR_MS + 3000, { pressao: 'fair' });
    assert.equal(e.apertado, false);
  });

  it('sem a leitura do processador (Firefox), a perda de quadros basta, em duas medidas seguidas', () => {
    assert.equal(correr(ESTADO_INICIAL, 0, 10_000, { pressao: null, perdaDeQuadros: 0.05 }).apertado, false);
    // uma medida só (a troca de versão perde quadros num segundo) não desce
    let e = passo(ESTADO_INICIAL, semFoco(0, { pressao: null, perdaDeQuadros: 0.5 }));
    e = passo(e, semFoco(1000, { pressao: null, perdaDeQuadros: 0 }));
    e = passo(e, semFoco(2000, { pressao: null, perdaDeQuadros: 0.5 }));
    assert.equal(e.apertado, false);
    e = passo(e, semFoco(3000, { pressao: null, perdaDeQuadros: 0.2 }));
    assert.equal(e.apertado, true);
  });

  it('volta à maior depois de folgado por um tempo, e não antes', () => {
    let e = passo(ESTADO_INICIAL, semFoco(0, { pressao: 'serious' }));
    e = correr(e, 1000, FOLGA_PARA_VOLTAR_MS, {});
    assert.equal(e.apertado, true);
    e = passo(e, semFoco(FOLGA_PARA_VOLTAR_MS + 1000));
    assert.equal(e.apertado, false);
  });

  it('"fair" não conta como folga para voltar', () => {
    let e = passo(ESTADO_INICIAL, semFoco(0, { pressao: 'serious' }));
    e = correr(e, 1000, 60_000, { pressao: 'fair' });
    assert.equal(e.apertado, true);
  });

  it('apertou de novo depois de voltar: fica a menor até o foco, sem subir e descer', () => {
    let e = passo(ESTADO_INICIAL, semFoco(0, { pressao: 'serious' }));
    e = correr(e, 1000, FOLGA_PARA_VOLTAR_MS + 1000, {});
    assert.equal(e.apertado, false);
    e = passo(e, semFoco(FOLGA_PARA_VOLTAR_MS + 2000, { pressao: 'serious' }));
    e = correr(e, FOLGA_PARA_VOLTAR_MS + 3000, 10 * FOLGA_PARA_VOLTAR_MS, {});
    assert.equal(e.apertado, true);
    // o foco devolve a maior e zera a memória
    e = passo(e, { comFoco: true, pressao: 'nominal', perdaDeQuadros: null, agora: 11 * FOLGA_PARA_VOLTAR_MS });
    assert.deepEqual(e, ESTADO_INICIAL);
  });
});

describe('a fração de quadros perdidos', () => {
  it('é a perda entre duas leituras, e nada sem leitura anterior ou com pouco vídeo', () => {
    assert.equal(fracaoPerdida(null, { decodificados: 100, perdidos: 0 }), null);
    assert.equal(fracaoPerdida({ decodificados: 100, perdidos: 0 }, { decodificados: 127, perdidos: 3 }), 0.1);
    assert.equal(fracaoPerdida({ decodificados: 100, perdidos: 0 }, { decodificados: 105, perdidos: 0 }), null);
  });

  it('contadores que voltam (vídeo novo trocou o antigo) não decidem nada', () => {
    assert.equal(fracaoPerdida({ decodificados: 500, perdidos: 9 }, { decodificados: 30, perdidos: 0 }), null);
  });
});
