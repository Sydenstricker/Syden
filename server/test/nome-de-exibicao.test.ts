import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// O NOME DE EXIBIÇÃO DA CONTA (ver /api/me/nome-de-exibicao, em routes.ts): vale em todo o Syden, conversas privadas
// incluídas, e o apelido da comunidade fica por cima dele lá dentro. O username não muda: é o de entrar e o do @.
const { app, fechar } = await servidorDeTeste();
after(fechar);

const ana = await criarConta(app, 'ana-exibicao');
const beto = await criarConta(app, 'beto-exibicao');
const aAna = comToken(app, ana.token);
const oBeto = comToken(app, beto.token);
const comunidade = (await aAna('POST', '/api/communities', { name: 'Clã do nome' })).json();
await oBeto('POST', '/api/communities/join', { code: comunidade.inviteCode });
const trocar = (nome: unknown) => oBeto('PUT', '/api/me/nome-de-exibicao', { nomeDeExibicao: nome });

test('a pessoa escolhe o nome, limpo, e o nome da conta não muda', async () => {
  const r = await trocar('  Beto   da  Silva ');
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().nomeDeExibicao, 'Beto da Silva');
  const eu = (await oBeto('GET', '/api/me')).json();
  assert.equal(eu.nomeDeExibicao, 'Beto da Silva');
  assert.equal(eu.username, 'beto-exibicao');
});

test('ele chega aos outros: na lista de membros, na mensagem e na conversa privada', async () => {
  const membros = (await aAna('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; nomeDeExibicao: string | null }[];
  assert.equal(membros.find((m) => m.id === beto.user.id)!.nomeDeExibicao, 'Beto da Silva');

  const conversa = (await aAna('POST', '/api/direct', { userIds: [beto.user.id] })).json();
  // A mensagem de texto vai pelo socket; aqui ela é gravada direto, e o que importa é a leitura.
  const db = await import('../src/db.js');
  db.createMessage(conversa.id, beto.user.id, 'oi');
  const mensagens = (await aAna('GET', `/api/channels/${conversa.id}/messages`)).json() as { author: { id: number; nomeDeExibicao?: string | null } }[];
  assert.equal(mensagens.find((m) => m.author.id === beto.user.id)!.author.nomeDeExibicao, 'Beto da Silva');

  const conversas = (await aAna('GET', '/api/direct')).json() as { id: number; members: { id: number; nomeDeExibicao?: string | null }[] }[];
  const dela = conversas.find((c) => c.id === conversa.id)!;
  assert.equal(dela.members.find((m) => m.id === beto.user.id)!.nomeDeExibicao, 'Beto da Silva');
});

test('vazio ou só invisível volta ao nome da conta; longo é recusado', async () => {
  assert.equal((await trocar('x'.repeat(33))).statusCode, 400);
  assert.equal((await trocar('Ana‮odom')).json().nomeDeExibicao, 'Anaodom', 'o caractere de inverter o texto sai');
  assert.equal((await trocar('​')).json().nomeDeExibicao, null);
  assert.equal((await trocar('Beto')).json().nomeDeExibicao, 'Beto');
  assert.equal((await trocar('')).json().nomeDeExibicao, null);
});
