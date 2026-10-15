import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarVigiaDePicote } from '../src/vigiaDePicote';

/** A supressão de ruído atrasando vira uma linha no diário de saúde (ver vigiaDePicote.ts). */
describe('o vigia de picote', () => {
  const montar = () => {
    const relatos: string[] = [];
    let t = 0;
    const vigiar = criarVigiaDePicote((m) => relatos.push(m), () => t);
    return { relatos, vigiar, passar: (ms: number) => (t += ms) };
  };

  it('a primeira medida não conta (o começo sempre tem faltas)', () => {
    const { relatos, vigiar } = montar();
    vigiar({ motor: 'dpdfnet', msPorQuadro: 2, quadroMs: 10, faltas: 90 });
    assert.equal(relatos.length, 0);
  });

  it('faltas acima do limite viram um relato com o motor e o custo', () => {
    const { relatos, vigiar } = montar();
    vigiar({ motor: 'dpdfnet', msPorQuadro: 2, quadroMs: 10, faltas: 0 });
    vigiar({ motor: 'dpdfnet', msPorQuadro: 9.4, quadroMs: 10, faltas: 37 });
    assert.equal(relatos.length, 1);
    assert.match(relatos[0], /37 faltas/);
    assert.match(relatos[0], /DPDFNet/);
    assert.match(relatos[0], /9\.4 ms por quadro de 10 ms/);
  });

  it('poucas faltas e custo folgado: nada', () => {
    const { relatos, vigiar } = montar();
    for (let i = 0; i < 5; i++) vigiar({ motor: 'dpdfnet', msPorQuadro: 1.5, quadroMs: 10, faltas: 3 });
    assert.equal(relatos.length, 0);
  });

  it('no site, o custo acima de 80% do quadro é relatado (não há faltas para contar)', () => {
    const { relatos, vigiar } = montar();
    vigiar({ motor: 'gtcrn', msPorQuadro: 2, quadroMs: 16 });
    vigiar({ motor: 'gtcrn', msPorQuadro: 14, quadroMs: 16 });
    assert.equal(relatos.length, 1);
    assert.match(relatos[0], /GTCRN a 14\.0 ms por quadro de 16 ms/);
  });

  it('no máximo um relato a cada 10 minutos', () => {
    const { relatos, vigiar, passar } = montar();
    vigiar({ motor: 'dpdfnet', msPorQuadro: 2, quadroMs: 10, faltas: 0 });
    for (let i = 0; i < 20; i++) { vigiar({ motor: 'dpdfnet', msPorQuadro: 9, quadroMs: 10, faltas: 50 }); passar(5000); }
    assert.equal(relatos.length, 1);
    passar(10 * 60_000);
    vigiar({ motor: 'dpdfnet', msPorQuadro: 9, quadroMs: 10, faltas: 50 });
    assert.equal(relatos.length, 2);
  });
});
