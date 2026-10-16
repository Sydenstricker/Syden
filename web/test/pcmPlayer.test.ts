import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// O tocador do som da transmissão do app (public/pcm-player.worklet.js) roda num AudioWorklet; aqui ele roda com
// um AudioWorkletProcessor de mentira, para conferir a conta da fila quando o som chega mais rápido do que toca.
type Tocador = {
  queue: Float32Array[];
  queued: number;
  offset: number;
  port: { onmessage: (e: { data: unknown }) => void };
  process: (i: unknown, o: Float32Array[][]) => boolean;
};

function carregar(): Tocador {
  let Classe: (new () => Tocador) | null = null;
  const fonte = readFileSync(new URL('../public/pcm-player.worklet.js', import.meta.url), 'utf8');
  class Base {
    port = { onmessage: (_e: { data: unknown }) => {} };
  }
  new Function('AudioWorkletProcessor', 'registerProcessor', fonte)(Base, (_nome: string, C: new () => Tocador) => {
    Classe = C;
  });
  assert.ok(Classe);
  return new (Classe as unknown as new () => Tocador)();
}

// Um pedaço de 10 ms do app: 480 quadros, dois canais intercalados.
const pedaco = (valor: number) => new Float32Array(960).fill(valor);
const quadrosNaFila = (t: Tocador) => t.queue.reduce((s, c) => s + c.length / 2, 0) - t.offset / 2;

test('a fila conta exatamente o que falta tocar, mesmo descartando com um pedaço pela metade', () => {
  const t = carregar();
  const saida = [[new Float32Array(128), new Float32Array(128)]];
  // toca um pouco (o primeiro pedaço fica pela metade) e então chega som demais de uma vez
  t.port.onmessage({ data: pedaco(0.1) });
  t.process([], saida);
  t.process([], saida);
  for (let i = 0; i < 60; i++) t.port.onmessage({ data: pedaco(0.2) });
  assert.equal(t.queued, quadrosNaFila(t));
  assert.ok(t.queued <= 48000 * 0.25, 'a fila respeita o teto de um quarto de segundo');
  // e continua tocando o som que chegou, sem buraco
  t.process([], saida);
  assert.ok(saida[0][0].every((v) => v === Math.fround(0.2)));
});
