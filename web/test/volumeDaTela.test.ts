import assert from 'node:assert/strict';
import { test } from 'node:test';

// O volume da transmissão de cada pessoa fica guardado (e sobe para a conta); calar é só desta sessão. Relato de
// 16/10/2026: as transmissões de um amigo chegavam todas sem som — calar uma vez gravava 0 para sempre.
const guardado = new Map<string, string>([['syden.screenVolumes', JSON.stringify({ 7: 0, 8: 1.5 })]]);
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => guardado.get(k) ?? null,
  setItem: (k: string, v: string) => void guardado.set(k, v),
  removeItem: (k: string) => void guardado.delete(k),
};
const { alternarMudoDaTela, getScreenVolume, setScreenVolume } = await import('../src/voiceVolumes');
const sala = { remoteParticipants: new Map() } as unknown as Parameters<typeof setScreenVolume>[0];
const gravado = () => JSON.parse(guardado.get('syden.screenVolumes') ?? '{}') as Record<string, number>;

test('um zero que já estava gravado não cala a transmissão', () => {
  assert.equal(getScreenVolume(7), 1);
});

test('calar pelo alto-falante não grava o zero, e o clique seguinte devolve o volume de antes', () => {
  assert.equal(alternarMudoDaTela(sala, 8), 0);
  assert.equal(getScreenVolume(8), 0);
  assert.equal(gravado()[8] ?? 1.5, 1.5, 'o volume guardado continua o mesmo');
  assert.equal(alternarMudoDaTela(sala, 8), 1.5);
});

test('a régua no zero cala só nesta sessão; acima dele, o volume fica guardado', () => {
  setScreenVolume(sala, 9, 0);
  assert.equal(getScreenVolume(9), 0);
  assert.equal(gravado()[9], undefined);
  setScreenVolume(sala, 9, 0.4);
  assert.equal(getScreenVolume(9), 0.4);
  assert.equal(gravado()[9], 0.4);
});

// A voz de cada pessoa vai até 200% (02/11/2026). O que não pode: o volume da PESSOA no LiveKit passar de 1 (ele o repete
// em cada faixa nova, e o navegador dá erro acima de 1 no elemento de áudio, derrubando o som).
test('a voz vai até 200%, sem nunca pôr mais de 1 no volume da pessoa', async () => {
  const { getUserVolume, setUserVolume } = await import('../src/voiceVolumes');
  const pedidos: number[] = [];
  const naFaixa: number[] = [];
  const microfone = { setVolume: (v: number) => void naFaixa.push(v) };
  const pessoa = {
    setVolume: (v: number) => void pedidos.push(v),
    getTrackPublication: () => ({ track: microfone }),
  };
  const comGente = { remoteParticipants: new Map([['5', pessoa]]) } as unknown as Parameters<typeof setUserVolume>[0];
  setUserVolume(comGente, 5, 3);
  assert.equal(getUserVolume(5), 2, 'o teto é 200%');
  assert.ok(pedidos.every((v) => v <= 1), 'o volume da pessoa nunca passa de 1');
  // Sem Web Audio (aqui, no Node), a faixa recebe o máximo que existe, e não um número que daria erro.
  assert.ok(naFaixa.every((v) => v <= 1));
  setUserVolume(comGente, 5, 0.5);
  assert.equal(pedidos.at(-1), 0.5);
});

// 09/11/2026, "o botão de calar as lives não funciona": o LiveKit repete o volume em cada elemento que se liga depois com
// `if (this.elementVolume)`, e 0 é falso. A faixa chega (e recebe o 0) antes do <audio>; o elemento nascia a 100%.
test('a transmissão calada continua calada quando o elemento de áudio se liga depois', async () => {
  const ouvintes = new Map<string, () => void>();
  const pedidos: number[] = [];
  const faixa = {
    setVolume: (v: number) => void pedidos.push(v),
    on: (evento: string, f: () => void) => void ouvintes.set(evento, f),
  };
  const pessoa = { setVolume() {}, getTrackPublication: (fonte: string) => (fonte === 'screen_share_audio' ? { track: faixa } : undefined) };
  const comGente = { remoteParticipants: new Map([['11', pessoa]]) } as unknown as Parameters<typeof setScreenVolume>[0];
  assert.equal(alternarMudoDaTela(comGente, 11), 0);
  pedidos.length = 0;
  ouvintes.get('elementAttached')?.();
  await Promise.resolve();
  assert.deepEqual(pedidos, [0], 'o elemento novo recebe o 0 de novo');
  alternarMudoDaTela(comGente, 11);
  pedidos.length = 0;
  ouvintes.get('elementAttached')?.();
  await Promise.resolve();
  assert.deepEqual(pedidos, [], 'com som, o LiveKit já cuida do volume');
});
