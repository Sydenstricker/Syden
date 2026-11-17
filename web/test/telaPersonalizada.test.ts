import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { presetPersonalizado, tamanhoNativo } from '../src/telaPersonalizada.js';

const NATIVO_1080 = { largura: 1920, altura: 1080 };

describe('a transmissão personalizada', () => {
  it('Full HD a 30 é o Padrão de tamanho e taxa, e a 60 é o Fluido', () => {
    const p30 = presetPersonalizado('1080', 30, NATIVO_1080);
    assert.deepEqual([p30.largura, p30.altura, p30.taxa], [1920, 1080, 5_000_000]);
    assert.equal(presetPersonalizado('1080', 60, NATIVO_1080).taxa, 8_000_000);
  });

  it('o desempate segue os quadros: 15 segura a nitidez, 60 os quadros, 30 equilibra', () => {
    assert.equal(presetPersonalizado('1080', 15, NATIVO_1080).degradacao, 'maintain-resolution');
    assert.equal(presetPersonalizado('1080', 15, NATIVO_1080).conteudo, 'detail');
    assert.equal(presetPersonalizado('1080', 60, NATIVO_1080).degradacao, 'maintain-framerate');
    assert.equal(presetPersonalizado('1080', 30, NATIVO_1080).degradacao, 'balanced');
  });

  it('HD não ganha a versão menor (já é pequena); Full HD ganha, e nunca com mais quadros que a escolhida', () => {
    assert.equal(presetPersonalizado('720', 30, NATIVO_1080).menor, null);
    assert.equal(presetPersonalizado('1080', 15, NATIVO_1080).menor?.quadros, 15);
    assert.equal(presetPersonalizado('1080', 60, NATIVO_1080).menor?.quadros, 30);
  });

  it('a Nativa usa os pixels de verdade, até 4K, com a taxa crescendo menos que os pixels e um teto', () => {
    const n = tamanhoNativo(1920, 1080, 1.5); // 1920 × 1080 lógicos num Windows a 150%: 2880 × 1620 de verdade
    assert.deepEqual(n, { largura: 2880, altura: 1620 });
    const p = presetPersonalizado('nativa', 30, n);
    assert.ok(p.taxa > 5_000_000 && p.taxa < 5_000_000 * 2.25, String(p.taxa));
    const k8 = tamanhoNativo(7680, 4320, 1);
    assert.deepEqual(k8, { largura: 3840, altura: 2160 });
    assert.ok(presetPersonalizado('nativa', 60, k8).taxa <= 16_000_000);
  });
});
