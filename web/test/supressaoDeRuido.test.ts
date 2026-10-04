import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
// @ts-expect-error — JavaScript puro, sem tipos: é o mesmo arquivo que a thread de áudio carrega.
import { criarMotor } from '../public/ruido/motor.js';

// A supressão de ruído roda o GTCRN num interpretador de ONNX escrito à mão (web/public/ruido/motor.js),
// porque o Syden não dá ao site a permissão de WebAssembly. Escrito à mão, ele pode errar em silêncio:
// um índice trocado não dá erro nenhum, só uma voz estranha. Por isso a saída é comparada com a do
// motor oficial (onnxruntime), gravada em gtcrn-referencia.json.

const pasta = new URL('../public/ruido/', import.meta.url);
const ler = (nome: string) => readFileSync(new URL(nome, pasta));

function motor() {
  const pesos = ler('gtcrn.bin');
  return criarMotor(JSON.parse(ler('gtcrn.json').toString('utf8')), pesos.buffer.slice(pesos.byteOffset, pesos.byteOffset + pesos.byteLength));
}

describe('supressão de ruído (GTCRN em JavaScript puro)', () => {
  it('dá os mesmos números que o motor oficial, quadro a quadro, com memória entre eles', () => {
    const ref = JSON.parse(readFileSync(new URL('./gtcrn-referencia.json', import.meta.url), 'utf8')) as Record<string, number[]>;
    const m = motor();
    const caches = { conv_cache: new Float32Array(16896), tra_cache: new Float32Array(96), inter_cache: new Float32Array(1056) };
    // A mesma entrada pseudoaleatória que gerou a referência (semente 12345).
    let semente = 12345;
    const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
    for (let q = 1; q <= 40; q++) {
      const mix = new Float32Array(514).map((_, i) => aleatorio() * (i < 120 ? 2 : 0.3));
      const s = m.rodar({ mix, ...caches });
      caches.conv_cache = s.conv_cache_out.slice();
      caches.tra_cache = s.tra_cache_out.slice();
      caches.inter_cache = s.inter_cache_out.slice();
      const esperado = ref['quadro' + q];
      if (!esperado) continue;
      // O quadro 40 só bate se a memória (os caches) passou certa pelos 39 anteriores.
      let pior = 0;
      for (let i = 0; i < esperado.length; i++) pior = Math.max(pior, Math.abs(s.enh[i] - esperado[i]));
      assert.ok(pior < 1e-3, `quadro ${q}: diferença de ${pior} para o motor oficial`);
    }
  });

  it('cabe no tempo: um quadro de 16 ms custa bem menos que 16 ms', () => {
    const m = motor();
    const mix = new Float32Array(514).fill(0.1);
    const caches = { conv_cache: new Float32Array(16896), tra_cache: new Float32Array(96), inter_cache: new Float32Array(1056) };
    for (let i = 0; i < 20; i++) m.rodar({ mix, ...caches }); // aquecer
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) m.rodar({ mix, ...caches });
    const ms = (performance.now() - t0) / 100;
    // Medido: ~2 ms num Ryzen 7 3700X. O teto aqui é folgado de propósito (máquina de CI é lenta),
    // mas pega o dia em que alguém trocar um laço e o modelo deixar de caber em tempo real.
    assert.ok(ms < 12, `${ms.toFixed(2)} ms por quadro`);
  });

  it('a licença do modelo acompanha o modelo', () => {
    // MIT: a licença precisa ir junto com os pesos, como a OFL vai junto com as fontes.
    assert.match(ler('GTCRN-LICENSE.txt').toString('utf8'), /MIT License[\s\S]*Rong Xiaobin/);
    assert.match(ler('ORIGEM.txt').toString('utf8'), /github\.com\/Xiaobin-Rong\/gtcrn/);
  });

  it('não usa eval, Function nem WebAssembly — nada que a política do site barre', () => {
    for (const arquivo of ['motor.js', 'gtcrn.worklet.js']) {
      const codigo = ler(arquivo).toString('utf8').replace(/^\s*\/\/.*$/gm, '');
      assert.doesNotMatch(codigo, /\beval\s*\(|new Function|WebAssembly/, arquivo);
    }
  });
});
