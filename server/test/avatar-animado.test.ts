// O avatar em GIF (04/11/2026): o servidor guarda o GIF como veio e diz que ele é ANIMADO, para o site mostrá-lo parado nas
// listas e animado ao passar o mouse. O que este teste prende: o GIF marca, a outra imagem não, e a marca acompanha a pessoa
// em toda parte em que ela aparece (o /api/me e a lista de membros da comunidade).
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

// um GIF de verdade, de 1 × 1
const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2000, 3)]).toString('base64');

test('o GIF marca o avatar como animado, e trocar por outra imagem tira a marca', async () => {
  const conta = await criarConta(app, 'quemanima');
  const como = comToken(app, conta.token);

  const comGif = await como('PUT', '/api/me/avatar', { image: gif });
  assert.equal(comGif.statusCode, 200, comGif.body);
  assert.equal(comGif.json().avatarAnimado, true);

  // na lista de membros também, que é de onde o site tira o avatar de cada um
  const comunidade = (await como('POST', '/api/communities', { name: 'Os do GIF' })).json() as { id: number };
  const membros = (await como('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; avatarAnimado?: boolean }[];
  assert.equal(membros.find((m) => m.id === conta.user.id)?.avatarAnimado, true);

  const comPng = await como('PUT', '/api/me/avatar', { image: png });
  assert.equal(comPng.json().avatarAnimado, false);

  // sem foto, não há o que animar
  await como('PUT', '/api/me/avatar', { image: gif });
  const semFoto = await como('DELETE', '/api/me/avatar');
  assert.equal(semFoto.json().avatarAnimado, false);
});
