import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// O tocador do som da transmissão do app (public/pcm-player.worklet.js) roda num AudioWorklet; aqui ele roda com
// um AudioWorkletProcessor de mentira, para conferir a folga, as faltas e o excesso (auditoria do áudio, 17/10/2026).
type Tocador = {
  escritos: number;
  lidos: number;
  alvo: number;
  faltas: number;
  tocando: boolean;
  port: { onmessage: (e: { data: unknown }) => void; postMessage: (m: unknown) => void };
  process: (i: unknown, o: Float32Array[][]) => boolean;
};

function carregar(): Tocador {
  let Classe: (new () => Tocador) | null = null;
  const fonte = readFileSync(new URL('../public/pcm-player.worklet.js', import.meta.url), 'utf8');
  class Base {
    port = { onmessage: (_e: { data: unknown }) => {}, postMessage: (_m: unknown) => {} };
  }
  new Function('AudioWorkletProcessor', 'registerProcessor', 'currentTime', fonte)(
    Base,
    (_nome: string, C: new () => Tocador) => {
      Classe = C;
    },
    0,
  );
  assert.ok(Classe);
  return new (Classe as unknown as new () => Tocador)();
}

// Um pedaço de 10 ms do app: 480 quadros, dois canais intercalados.
const pedaco = (valor: number) => new Float32Array(960).fill(valor);
const bloco = () => [[new Float32Array(128), new Float32Array(128)]];
const naFila = (t: Tocador) => t.escritos - t.lidos;

test('só começa a tocar com a folga guardada (~40 ms), e não picota o primeiro pedaço', () => {
  const t = carregar();
  const saida = bloco();
  t.port.onmessage({ data: pedaco(0.2) });
  t.process([], saida);
  assert.ok(saida[0][0].every((v) => v === 0), 'com 10 ms guardados, ainda silêncio');
  for (let i = 0; i < 3; i++) t.port.onmessage({ data: pedaco(0.2) });
  t.process([], saida); // começa com uma rampa curta
  t.process([], saida);
  assert.ok(saida[0][0].every((v) => v === Math.fround(0.2)));
  assert.equal(t.faltas, 0);
});

test('o excesso sai aos poucos, sem pular som, e só o absurdo (página congelada) pula de uma vez', () => {
  const t = carregar();
  const saida = bloco();
  for (let i = 0; i < 15; i++) t.port.onmessage({ data: pedaco(0.2) }); // 150 ms: bem acima do alvo + sobra
  t.process([], saida);
  t.process([], saida);
  const antes = naFila(t);
  t.process([], saida);
  const consumidos = antes - naFila(t);
  assert.ok(consumidos > 128 && consumidos < 134, `acelera um pouco (${consumidos} quadros num bloco de 128)`);
  assert.ok(saida[0][0].every((v) => Math.abs(v - 0.2) < 1e-6), 'e continua tocando o som que chegou, sem buraco');

  for (let i = 0; i < 80; i++) t.port.onmessage({ data: pedaco(0.3) }); // 800 ms de uma vez
  assert.ok(naFila(t) <= 48000 * 0.5, 'nunca passa de meio segundo de atraso: acima disso, volta ao alvo');
});

test('na falta, desce até zero sem degrau, conta a falta e aumenta a folga', () => {
  const t = carregar();
  const saida = bloco();
  for (let i = 0; i < 5; i++) t.port.onmessage({ data: pedaco(0.5) });
  const alvo = t.alvo;
  for (let i = 0; i < 20 && t.faltas === 0; i++) t.process([], saida);
  assert.equal(t.faltas, 1);
  const l = saida[0][0];
  assert.ok(l.every((v) => Number.isFinite(v)));
  assert.equal(l[l.length - 1], 0, 'termina em zero');
  for (let i = 1; i < l.length; i++) assert.ok(Math.abs(l[i] - l[i - 1]) < 0.05, 'sem degrau');
  assert.ok(t.alvo > alvo);
  assert.equal(t.tocando, false);
});

test('pela porta direta do app chega ao mesmo lugar', () => {
  const t = carregar();
  const porta = { onmessage: null as null | ((e: { data: unknown }) => void), close() {} };
  t.port.onmessage({ data: { porta } });
  for (let i = 0; i < 5; i++) porta.onmessage?.({ data: pedaco(0.2) });
  assert.equal(naFila(t), 5 * 480);
});
