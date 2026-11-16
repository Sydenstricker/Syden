// O clipe sem recodificar (clipeCru/montar.ts): a régua de cada faixa e a janela que abre num quadro-chave.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { QuadroCru } from '../src/clipeCru/ganchoDaCifra';
import { codecDoVideo, escolherJanela, regua } from '../src/clipeCru/montar';

const quadro = (t: number, rtp: number, tipo: QuadroCru['tipo'] = 'delta'): QuadroCru => ({ t, rtp, tipo, dados: new ArrayBuffer(1) });

/** Vídeo a 30 quadros por segundo, com chegada atrasada por um tremor conhecido. */
function video(segundos: number, chaves: number[], comecoRtp = 4_000_000_000, tremor = (i: number) => (i % 5) * 7): QuadroCru[] {
  return Array.from({ length: segundos * 30 }, (_, i) => {
    const ms = (i * 1000) / 30;
    return quadro(1_000_000 + ms + 40 + tremor(i), (comecoRtp + i * 3000) >>> 0, chaves.some((s) => Math.round(s * 30) === i) ? 'key' : 'delta');
  });
}

describe('régua', () => {
  it('segue o RTP e não o tremor da chegada, e atravessa a volta dos 32 bits', () => {
    const v = video(10, [0], 0xffff_0000);
    const r = regua(v, 90_000);
    // passos certinhos de 1/30 s, apesar do tremor de até 28 ms na chegada
    for (let i = 1; i < r.length; i++) assert.ok(Math.abs(r[i] - r[i - 1] - 1000 / 30) < 1e-6);
    // ancorada no quadro que chegou mais depressa (tremor zero): 40 ms depois do envio
    assert.ok(Math.abs(r[0] - (1_000_000 + 40)) < 1e-6);
  });

  it('o vídeo e o som caem na mesma régua, mesmo com carimbos RTP sem relação', () => {
    const v = video(5, [0], 123);
    const a = Array.from({ length: 250 }, (_, i) => quadro(1_000_000 + i * 20 + 40 + (i % 3) * 9, (987_654_321 + i * 960) >>> 0, 'audio'));
    const rv = regua(v, 90_000), ra = regua(a, 48_000);
    assert.ok(Math.abs(rv[0] - ra[0]) < 1e-6);
    assert.ok(Math.abs(rv[30] - ra[50]) < 1e-6); // 1 s depois, nos dois
  });

  it('um carimbo que volta não faz o relógio andar para trás', () => {
    const q = [quadro(0, 9000), quadro(33, 12000), quadro(40, 11000), quadro(66, 15000)];
    const r = regua(q, 90_000);
    for (let i = 1; i < r.length; i++) assert.ok(r[i] >= r[i - 1]);
  });
});

describe('janela', () => {
  it('abre no quadro-chave mais perto ANTES dos últimos 30 s', () => {
    const v = video(60, [2, 20, 27, 45]);
    const j = escolherJanela(v, [], 30)!;
    assert.equal(j.video[0].tipo, 'key');
    assert.equal(j.video.length, v.length - 27 * 30); // começa no de 27 s (o fim é ~60 s: 30 s antes é ~30 s)
    assert.ok((j.fim - j.inicio) / 1000 > 30);
  });

  it('sem quadro-chave antes, abre no primeiro depois', () => {
    const v = video(40, [35]);
    const j = escolherJanela(v, [], 30)!;
    assert.equal(j.video.length, 5 * 30);
  });

  it('sem quadro-chave nenhum, não há clipe', () => {
    assert.equal(escolherJanela(video(10, []), [], 30), null);
  });

  it('o som entra só dentro da janela do vídeo', () => {
    const v = video(40, [5, 12]);
    const a = Array.from({ length: 40 * 50 }, (_, i) => quadro(1_000_000 + i * 20 + 40, i * 960, 'audio'));
    const j = escolherJanela(v, a, 30)!;
    assert.ok(j.tempoDoAudio[0] >= j.inicio);
    assert.ok(j.tempoDoAudio[j.tempoDoAudio.length - 1] <= j.fim + 20);
    assert.ok(Math.abs(j.audio.length - ((j.fim - j.inicio) / 20 + 1)) <= 2);
  });
});

describe('codec', () => {
  it('H.264 vai em MP4; VP8, VP9 e AV1 em WebM', () => {
    assert.equal(codecDoVideo('video/H264')?.mp4, true);
    assert.equal(codecDoVideo('video/VP8')?.mp4, false);
    assert.equal(codecDoVideo('video/VP9')?.codec, 'vp9');
    assert.equal(codecDoVideo('video/AV1')?.codec, 'av1');
    assert.equal(codecDoVideo('video/rtx'), null);
  });
});
