import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escolherCodecDaTela } from '../src/escolherCodec';

// A escolha do codec da transmissão, que decide se a imagem vai ser codificada pela placa de vídeo ou
// pelo processador de quem transmite. O porquê de cada caso está em web/src/escolherCodec.ts.
//
// Este teste existe porque a resposta certa depende da MÁQUINA, e a máquina que roda o teste não é a
// máquina de quem transmite: a única forma de cobrir os quatro casos é perguntar a um navegador de
// mentira. O que se prova aqui é a DECISÃO, não a medição.

const navegador = (resposta: unknown) => ({ encodingInfo: async () => resposta as never });

describe('qual codec usar na transmissão de tela', () => {
  it('com H.264 saindo pela placa, escolhe H.264', async () => {
    const escolha = await escolherCodecDaTela(1920, 1080, 30, navegador({ supported: true, powerEfficient: true }));
    assert.deepEqual(escolha, { codec: 'h264', motivo: 'placa' });
  });

  it('com H.264 caindo no processador, fica no VP8', async () => {
    // H.264 por software costuma ser pior que VP8 por software. "Suporta" não é "vale a pena".
    const escolha = await escolherCodecDaTela(1920, 1080, 30, navegador({ supported: true, powerEfficient: false }));
    assert.deepEqual(escolha, { codec: 'vp8', motivo: 'processador' });
  });

  it('sem suporte a H.264, fica no VP8', async () => {
    const escolha = await escolherCodecDaTela(1280, 720, 30, navegador({ supported: false, powerEfficient: true }));
    assert.equal(escolha.codec, 'vp8');
  });

  it('num navegador que não sabe responder, fica no que sempre foi', async () => {
    // Nada de virar cobaia de palpite: sem resposta, o comportamento é o de antes desta função existir.
    assert.deepEqual(await escolherCodecDaTela(1920, 1080, 60, undefined), {
      codec: 'vp8',
      motivo: 'nao-deu-para-perguntar',
    });
  });

  it('a pergunta que dá erro não derruba a transmissão', async () => {
    const quebrado = {
      encodingInfo: async () => {
        throw new Error('tipo webrtc não conhecido');
      },
    };
    assert.deepEqual(await escolherCodecDaTela(1920, 1080, 60, quebrado), {
      codec: 'vp8',
      motivo: 'nao-deu-para-perguntar',
    });
  });

  it('a pergunta leva o tamanho e a taxa escolhidos, e não um valor genérico', async () => {
    // Uma placa pode dar conta de 720p e não de 1080p60 — perguntar "em geral" responderia outra coisa.
    let perguntado: { video?: { width?: number; height?: number; framerate?: number; contentType?: string } } = {};
    await escolherCodecDaTela(1920, 1080, 60, {
      encodingInfo: async (config: unknown) => {
        perguntado = config as typeof perguntado;
        return { supported: true, powerEfficient: true };
      },
    });
    assert.equal(perguntado.video?.width, 1920);
    assert.equal(perguntado.video?.height, 1080);
    assert.equal(perguntado.video?.framerate, 60);
    assert.equal(perguntado.video?.contentType, 'video/H264');
  });
});
