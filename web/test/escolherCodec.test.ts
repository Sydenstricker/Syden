import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escolherCodecDaTela } from '../src/escolherCodec';

// A escolha do codec da transmissão, que decide se a imagem vai ser codificada pela placa de vídeo ou
// pelo processador de quem transmite. O porquê de cada caso está em web/src/escolherCodec.ts.
//
// Este teste existe porque a resposta certa depende da MÁQUINA, e a máquina que roda o teste não é a
// máquina de quem transmite: a única forma de cobrir os casos é perguntar a um navegador de mentira.
// O que se prova aqui é a DECISÃO, não a medição.

type Resposta = { supported?: boolean; powerEfficient?: boolean };
type Pergunta = { video?: { width?: number; height?: number; framerate?: number; contentType?: string; scalabilityMode?: string } };

/** Um navegador de mentira que responde por codec: { 'video/VP9': {...}, 'video/H264': {...} }. */
const navegador = (respostas: Record<string, Resposta>) => ({
  encodingInfo: async (config: unknown) => respostas[(config as Pergunta).video?.contentType ?? ''] ?? { supported: false },
});
const PLACA = { supported: true, powerEfficient: true };
const PROCESSADOR = { supported: true, powerEfficient: false };

describe('qual codec usar na transmissão de tela', () => {
  it('com VP9 saindo pela placa, escolhe VP9 — mesmo que o H.264 também saia', async () => {
    // Os dois pela placa: o VP9 comprime melhor, então é menos internet pelo mesmo processador.
    const escolha = await escolherCodecDaTela(1920, 1080, 30, navegador({ 'video/VP9': PLACA, 'video/H264': PLACA }));
    assert.deepEqual(escolha, { codec: 'vp9', motivo: 'placa' });
  });

  it('VP9 só por software NUNCA é escolhido: quem transmite costuma estar jogando', async () => {
    const escolha = await escolherCodecDaTela(1920, 1080, 30, navegador({ 'video/VP9': PROCESSADOR, 'video/H264': PLACA }));
    assert.deepEqual(escolha, { codec: 'h264', motivo: 'placa' });
  });

  it('com H.264 saindo pela placa (o caso da NVIDIA), escolhe H.264', async () => {
    const escolha = await escolherCodecDaTela(1920, 1080, 30, navegador({ 'video/H264': PLACA }));
    assert.deepEqual(escolha, { codec: 'h264', motivo: 'placa' });
  });

  it('com nada saindo pela placa, fica no VP8', async () => {
    // H.264 e VP9 por software costumam ser piores que VP8 por software. "Suporta" não é "vale a pena".
    const escolha = await escolherCodecDaTela(1920, 1080, 30, navegador({ 'video/VP9': PROCESSADOR, 'video/H264': PROCESSADOR }));
    assert.deepEqual(escolha, { codec: 'vp8', motivo: 'processador' });
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

  it('se só a pergunta do VP9 falha, a do H.264 ainda vale', async () => {
    // Um navegador que não conhece scalabilityMode pode recusar só a pergunta do VP9.
    const meioQuebrado = {
      encodingInfo: async (config: unknown) => {
        if ((config as Pergunta).video?.contentType === 'video/VP9') throw new Error('scalabilityMode desconhecido');
        return PLACA;
      },
    };
    assert.deepEqual(await escolherCodecDaTela(1920, 1080, 30, meioQuebrado), { codec: 'h264', motivo: 'placa' });
  });

  it('as perguntas levam o tamanho e a taxa escolhidos, e a do VP9 leva o jeito em que ele sai', async () => {
    // Uma placa pode dar conta de 720p e não de 1080p60 — perguntar "em geral" responderia outra coisa.
    // E o VP9 sai como camadas separadas de uma camada só (L1T3): é isso que a placa precisa saber fazer.
    const perguntas: Pergunta[] = [];
    await escolherCodecDaTela(1920, 1080, 60, {
      encodingInfo: async (config: unknown) => {
        perguntas.push(config as Pergunta);
        return { supported: false };
      },
    });
    const vp9 = perguntas.find((p) => p.video?.contentType === 'video/VP9');
    const h264 = perguntas.find((p) => p.video?.contentType === 'video/H264');
    assert.equal(vp9?.video?.scalabilityMode, 'L1T3');
    for (const pergunta of [vp9, h264]) {
      assert.equal(pergunta?.video?.width, 1920);
      assert.equal(pergunta?.video?.height, 1080);
      assert.equal(pergunta?.video?.framerate, 60);
    }
  });
});
