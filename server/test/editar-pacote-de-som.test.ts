/**
 * Editar pacote de som (12/10/2026): mover um som para outro pacote seu e baixar o volume de um som.
 * Veio de dois relatos do mesmo dia — o "Não chora", gravado estourado, estava no pacote Streamer e não
 * no Estourado; e o "faaaaah" de uma comunidade tocava alto do começo ao fim, o que o limitador não pega.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let db: typeof import('../src/db.js');

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  db = await import('../src/db.js');
  // A primeira conta do banco administra o Syden, e quem administra mexe em qualquer pacote: ela fica de
  // fora para os testes medirem a regra de quem é dono.
  await criarConta(app, 'primeiraconta');
});

after(async () => {
  await fechar();
});

describe('editar pacote de som', () => {
  it('move um som entre dois pacotes de quem pede, e só entre eles', async () => {
    const dono = await criarConta(app, 'donopacote');
    const outro = await criarConta(app, 'outropacote');
    const pedido = comToken(app, dono.token);
    const streamer = db.createPack('Streamer', 'falas', '🎙️', dono.user.id, false);
    const estourado = db.createPack('Estourado', 'alto', '🧨', dono.user.id, false);
    const alheio = db.createPack('Alheio', 'de outra pessoa', '📦', outro.user.id, false);
    const som = db.createPackSound(streamer, 'Não chora', '😭', 'audio/ogg', Buffer.from('OggS-chora'));

    const recusa = await pedido('PUT', `/api/packs/${streamer}/sounds/${som.id}/pacote`, { para: alheio });
    assert.equal(recusa.statusCode, 403, 'não leva som para pacote de outra pessoa');
    const deFora = await comToken(app, outro.token)('PUT', `/api/packs/${streamer}/sounds/${som.id}/pacote`, { para: alheio });
    assert.equal(deFora.statusCode, 403, 'nem tira som de pacote que não é seu');

    const certo = await pedido('PUT', `/api/packs/${streamer}/sounds/${som.id}/pacote`, { para: estourado });
    assert.equal(certo.statusCode, 200);
    assert.equal(db.findSound(som.id)!.packId, estourado);
    assert.equal(db.packSounds(streamer).length, 0);
  });

  it('o volume do som fica entre 10% e 100%, e chega ao soundboard', async () => {
    const dono = await criarConta(app, 'donovolume');
    const pedido = comToken(app, dono.token);
    const pacote = db.createPack('Meme alto', 'memes', '😂', dono.user.id, false);
    const som = db.createPackSound(pacote, 'Faaaaah', '😱', 'audio/ogg', Buffer.from('OggS-faah'));

    assert.equal((await pedido('PATCH', `/api/packs/${pacote}/sounds/${som.id}`, { volume: 0.3 })).statusCode, 200);
    assert.equal(db.findSound(som.id)!.volume, 0.3);
    assert.equal(db.findSound(som.id)!.name, 'Faaaaah', 'mexer no volume não muda o nome');

    await pedido('PATCH', `/api/packs/${pacote}/sounds/${som.id}`, { volume: 0 });
    assert.equal(db.findSound(som.id)!.volume, 0.1, 'baixar nunca vira sumir');

    await pedido('POST', `/api/packs/${pacote}/install`);
    const comunidade = (await pedido('GET', '/api/communities')).json() as { id: number }[];
    const quadro = (await pedido('GET', `/api/communities/${comunidade[0].id}/sounds`)).json() as { id: number; volume: number }[];
    assert.equal(quadro.find((s) => s.id === som.id)?.volume, 0.1, 'o soundboard recebe o volume para tocar');
  });
});
