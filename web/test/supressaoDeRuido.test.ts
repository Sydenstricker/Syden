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

describe('o worklet do GTCRN (o que a thread de áudio roda)', () => {
  it('o quieto (mudo ou abaixo de −60 dBFS) não passa pelo modelo, e a voz que volta passa', async () => {
    // a thread de áudio, de mentira: o worklet só precisa da classe base e do registro
    let Classe: any;
    const g = globalThis as any;
    g.AudioWorkletProcessor = class { port = { postMessage() {}, onmessage: null }; };
    g.registerProcessor = (_: string, c: unknown) => (Classe = c);
    await import('../public/ruido/gtcrn.worklet.js' as string);
    const pesos = ler('gtcrn.bin');
    const w = new Classe({ processorOptions: { grafo: JSON.parse(ler('gtcrn.json').toString('utf8')), pesos: pesos.buffer.slice(pesos.byteOffset, pesos.byteOffset + pesos.byteLength) } });
    let rodadas = 0;
    const rodar = w.motor.rodar.bind(w.motor);
    w.motor.rodar = (e: unknown) => (rodadas++, rodar(e));
    const tocar = (s: number, f: (i: number) => number) => {
      let energia = 0;
      for (let b = 0; b < (s * 16000) / 128; b++) {
        const ent = new Float32Array(128).map((_, i) => f(b * 128 + i));
        const sai = new Float32Array(128);
        w.process([[ent]], [[sai]]);
        for (const v of sai) energia += v * v;
      }
      return energia;
    };
    const voz = (i: number) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / 16000) * (0.6 + 0.4 * Math.sin(i / 900));
    const antes = tocar(0.5, voz);
    assert.ok(rodadas >= 25);
    for (const [nome, f, para] of [['mudo', () => 0, true], ['quieto', () => 3e-4 * (Math.random() * 2 - 1), true], ['ventilador baixo', () => 5e-3 * (Math.random() * 2 - 1), false]] as const) {
      const r0 = rodadas;
      tocar(2, f);
      const r = rodadas - r0; // 2 s = 125 quadros
      assert.ok(para ? r <= 21 : r >= 120, `${nome}: o modelo rodou ${r} vezes em 2 s`);
    }
    const depois = tocar(0.5, voz);
    assert.ok(depois > 0.25 * antes, `a voz que volta saiu fraca: ${depois} contra ${antes}`);
  });
});
