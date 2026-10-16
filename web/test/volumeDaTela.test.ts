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
