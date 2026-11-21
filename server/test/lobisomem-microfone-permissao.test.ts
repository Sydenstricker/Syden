/**
 * O MICROFONE DO LOBISOMEM NA PERMISSÃO DA SALA (20/11/2026): a mesma conta que monta o token de entrada e a permissão ao
 * vivo (permissaoNaSala, em routes.ts) tira o microfone e o "som da tela" de quem a partida calou, e deixa a câmera e a tela.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { servidorDeTeste } from './ajuda.js';

const { fechar } = await servidorDeTeste();
after(() => fechar());
const { permissaoNaSala } = await import('../src/routes.js');
const { liberarSala, silenciarNaSala } = await import('../src/silencio-do-jogo.js');
const { TrackSource } = await import('livekit-server-sdk');

test('calado pela partida: sem microfone e sem som da tela, com câmera e tela; solto, tudo de volta', () => {
  const canal = { id: 4242, communityId: 1 };
  assert.deepEqual(permissaoNaSala(canal, 7).canPublishSources, [], 'tudo liberado');
  silenciarNaSala(canal.id, new Map([[7, 'noite']]));
  const calado = permissaoNaSala(canal, 7);
  assert.equal(calado.canPublish, true);
  assert.deepEqual(calado.canPublishSources, [TrackSource.CAMERA, TrackSource.SCREEN_SHARE]);
  assert.deepEqual(permissaoNaSala(canal, 8).canPublishSources, [], 'quem só assiste continua falando');
  assert.deepEqual(permissaoNaSala({ id: 4243, communityId: 1 }, 7).canPublishSources, [], 'em outra sala, nada');
  liberarSala(canal.id);
  assert.deepEqual(permissaoNaSala(canal, 7).canPublishSources, []);
});
