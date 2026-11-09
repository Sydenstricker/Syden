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

test('o GIF do avatar vai até 5 MB (eram 2), e o ícone da comunidade continua em 2', async () => {
  const como = comToken(app, (await criarConta(app, 'gifgrande')).token);
  // o GIF de 1 × 1 com um enchimento depois do fim (o decodificador para no fim, e o arquivo fica do tamanho que se quer)
  const deTamanho = (bytes: number) => {
    const base = Buffer.from(gif.split(',')[1], 'base64');
    return 'data:image/gif;base64,' + Buffer.concat([base, Buffer.alloc(bytes - base.length, 0)]).toString('base64');
  };
  const quatro = await como('PUT', '/api/me/avatar', { image: deTamanho(4 * 1024 * 1024) });
  assert.equal(quatro.statusCode, 200, quatro.body);
  assert.equal(quatro.json().avatarAnimado, true);
  assert.equal((await como('PUT', '/api/me/avatar', { image: deTamanho(6 * 1024 * 1024) })).statusCode >= 400, true, 'passou dos 5 MB');
  const comunidade = (await como('POST', '/api/communities', { name: 'Ícone grande' })).json() as { id: number };
  assert.equal((await como('PUT', `/api/communities/${comunidade.id}/icon`, { image: deTamanho(3 * 1024 * 1024) })).statusCode, 400, 'o ícone fica nos 2 MB');
});

// O WEBP ANIMADO (09/11/2026, relato: "até no celular o GIF fica em loop"): o avatar por link guarda o arquivo como veio, e o
// "copiar endereço da imagem" do GIPHY dá um WEBP animado. A marca olhava só o tipo GIF, e ele tocava em laço nas listas.
const webp = (animado: boolean) => {
  const vp8x = Buffer.alloc(18);
  vp8x.write('VP8X', 0, 'latin1');
  vp8x.writeUInt32LE(10, 4);
  vp8x[8] = animado ? 0x02 : 0;
  vp8x.writeUIntLE(9, 12, 3); // 10 de largura
  vp8x.writeUIntLE(9, 15, 3); // 10 de altura
  const corpo = Buffer.concat([Buffer.from('WEBP', 'latin1'), vp8x, Buffer.alloc(200, 1)]);
  const cabeca = Buffer.alloc(8);
  cabeca.write('RIFF', 0, 'latin1');
  cabeca.writeUInt32LE(corpo.length, 4);
  return 'data:image/webp;base64,' + Buffer.concat([cabeca, corpo]).toString('base64');
};

test('o WEBP animado também marca o avatar, e o parado não', async () => {
  const como = comToken(app, (await criarConta(app, 'webpanima')).token);
  const animado = await como('PUT', '/api/me/avatar', { image: webp(true) });
  assert.equal(animado.statusCode, 200, animado.body);
  assert.equal(animado.json().avatarAnimado, true);
  const parado = await como('PUT', '/api/me/avatar', { image: webp(false) });
  assert.equal(parado.statusCode, 200, parado.body);
  assert.equal(parado.json().avatarAnimado, false);
});

test('o PNG animado (APNG) marca, o PNG comum não', async () => {
  const { imagemAnimada } = await import('../src/imagemAnimada.js');
  const pedaco = (tipo: string, dados = Buffer.alloc(0)) => {
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    return Buffer.concat([tam, Buffer.from(tipo, 'latin1'), dados, Buffer.alloc(4)]);
  };
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = pedaco('IHDR', Buffer.alloc(13));
  const apng = Buffer.concat([assinatura, ihdr, pedaco('acTL', Buffer.alloc(8)), pedaco('IDAT', Buffer.alloc(5)), pedaco('IEND')]);
  const comum = Buffer.concat([assinatura, ihdr, pedaco('IDAT', Buffer.alloc(5)), pedaco('IEND')]);
  assert.equal(imagemAnimada('image/png', apng), true);
  assert.equal(imagemAnimada('image/png', comum), false);
  assert.equal(imagemAnimada('image/jpeg', Buffer.alloc(10)), false);
});
