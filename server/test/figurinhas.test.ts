/**
 * AS FIGURINHAS (figurinhas-routes.ts e a rota de mandar, em chat-routes.ts). O que este arquivo segura:
 *
 *   1. a coleção é de cada pessoa: criar, listar, tirar; a de outra pessoa não se tira nem se manda;
 *   2. só entra imagem (o tipo é lido dos bytes), e a coleção tem teto;
 *   3. mandar vira uma mensagem sem texto com UM anexo marcado como figurinha, que aponta para o mesmo arquivo;
 *   4. quem recebeu salva na própria coleção pela chave do anexo, e sem a chave não salva;
 *   5. o arquivo da coleção só abre com a chave;
 *   6. a figurinha retirada por direito autoral sai também das coleções.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const db = await import('../src/db.js');
after(fechar);

const png = (recheio: string) => 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(recheio)]).toString('base64');

const dono = await criarConta(app, 'donodasfigurinhas'); // a primeira conta cuida do Syden
const ana = await criarConta(app, 'ana-fig');
const bia = await criarConta(app, 'bia-fig');
const comoDono = comToken(app, dono.token);
const comoAna = comToken(app, ana.token);
const comoBia = comToken(app, bia.token);

const comunidade = (await comoAna('POST', '/api/communities', { name: 'Amigos do CS' })).json() as { id: number; inviteCode?: string };
const convite = (await comoAna('GET', `/api/communities/${comunidade.id}`)).json().inviteCode ?? comunidade.inviteCode;
await comoBia('POST', '/api/communities/join', { code: convite });
const canais = (await comoAna('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const canal = canais.find((c) => c.type === 'text')!;

test('a coleção é de cada pessoa, só aceita imagem e se manda como um anexo marcado', async () => {
  // 2. só imagem
  assert.equal((await comoAna('POST', '/api/figurinhas', { image: 'data:audio/ogg;base64,' + Buffer.from('OggS1234').toString('base64') })).statusCode, 400);

  // 1. criar e listar
  const criada = await comoAna('POST', '/api/figurinhas', { image: png('glock-da-doninha'), width: 512, height: 400 });
  assert.equal(criada.statusCode, 200, criada.body);
  const fig = criada.json() as { id: number; key: string; mime: string };
  assert.equal(fig.mime, 'image/png');
  // a mesma imagem duas vezes é uma só
  assert.equal((await comoAna('POST', '/api/figurinhas', { image: png('glock-da-doninha') })).json().id, fig.id);
  const lista = (await comoAna('GET', '/api/figurinhas')).json() as { figurinhas: { id: number }[]; maximo: number };
  assert.deepEqual(lista.figurinhas.map((f) => f.id), [fig.id]);
  assert.equal((await comoBia('GET', '/api/figurinhas')).json().figurinhas.length, 0, 'a coleção da Ana não é da Bia');

  // 5. o arquivo só abre com a chave
  assert.equal((await comoBia('GET', `/api/figurinhas/${fig.id}/${fig.key}`)).statusCode, 200);
  assert.equal((await comoBia('GET', `/api/figurinhas/${fig.id}/errada`)).statusCode, 404);

  // a figurinha de outra pessoa não se manda nem se tira
  assert.equal((await comoBia('POST', `/api/channels/${canal.id}/figurinha`, { figurinhaId: fig.id })).statusCode, 404);
  assert.equal((await comoBia('DELETE', `/api/figurinhas/${fig.id}`)).statusCode, 404);

  // 3. mandar
  const mandada = await comoAna('POST', `/api/channels/${canal.id}/figurinha`, { figurinhaId: fig.id });
  assert.equal(mandada.statusCode, 200, mandada.body);
  const msg = mandada.json() as { id: number; content: string; attachments: { id: number; key: string; figurinha?: number; mime: string }[] };
  assert.equal(msg.content, '');
  assert.equal(msg.attachments.length, 1);
  assert.equal(msg.attachments[0].figurinha, 1);
  // quem lê a conversa vê a marca
  const historico = (await comoBia('GET', `/api/channels/${canal.id}/messages`)).json() as { id: number; attachments: { figurinha?: number }[] }[] | { messages: { id: number; attachments: { figurinha?: number }[] }[] };
  const mensagens = Array.isArray(historico) ? historico : historico.messages;
  assert.equal(mensagens.find((m) => m.id === msg.id)?.attachments[0].figurinha, 1);
  // o anexo abre pelo endereço de sempre
  assert.equal((await comoBia('GET', `/api/attachments/${msg.attachments[0].id}/${msg.attachments[0].key}`)).statusCode, 200);

  // 4. a Bia salva pela chave do anexo (e sem a chave, não)
  assert.equal((await comoBia('POST', '/api/figurinhas/salvar', { anexoId: msg.attachments[0].id, key: 'errada' })).statusCode, 404);
  const salva = await comoBia('POST', '/api/figurinhas/salvar', { anexoId: msg.attachments[0].id, key: msg.attachments[0].key });
  assert.equal(salva.statusCode, 200, salva.body);
  assert.equal((await comoBia('GET', '/api/figurinhas')).json().figurinhas.length, 1);

  // um anexo comum não vira figurinha
  const comum = await comoAna('POST', `/api/channels/${canal.id}/messages`, { files: [{ name: 'foto.png', data: png('foto-comum') }] });
  const anexoComum = (comum.json() as { attachments: { id: number; key: string }[] }).attachments[0];
  assert.equal((await comoBia('POST', '/api/figurinhas/salvar', { anexoId: anexoComum.id, key: anexoComum.key })).statusCode, 404);

  // 1. tirar
  assert.equal((await comoAna('DELETE', `/api/figurinhas/${fig.id}`)).statusCode, 200);
  assert.equal((await comoAna('GET', '/api/figurinhas')).json().figurinhas.length, 0);
});

test('a figurinha retirada por direito autoral sai também das coleções', async () => {
  const fig = (await comoAna('POST', '/api/figurinhas', { image: png('figurinha-de-terceiro') })).json() as { id: number };
  const msg = (await comoAna('POST', `/api/channels/${canal.id}/figurinha`, { figurinhaId: fig.id })).json() as { attachments: { id: number; key: string }[] };
  await comoBia('POST', '/api/figurinhas/salvar', { anexoId: msg.attachments[0].id, key: msg.attachments[0].key });
  const antesBia = (await comoBia('GET', '/api/figurinhas')).json().figurinhas.length;
  assert.ok(antesBia >= 1);

  const achados = (await comoDono('GET', '/api/direito-autoral/procurar?q=figurinha')).json() as { tipo: string; id: number }[];
  const alvo = achados.find((c) => c.tipo === 'anexo' && c.id === msg.attachments[0].id);
  assert.ok(alvo, 'a figurinha mandada aparece na busca pelo nome "figurinha"');
  const r = await comoDono('POST', '/api/direito-autoral/retirar', { tipo: 'anexo', id: alvo!.id, reclamante: 'Estúdio X', aviso: 'Retirada.' });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await comoAna('GET', '/api/figurinhas')).json().figurinhas.length, 0, 'saiu da coleção de quem criou');
  assert.equal((await comoBia('GET', '/api/figurinhas')).json().figurinhas.length, antesBia - 1, 'e da de quem salvou');
  void db;
});
