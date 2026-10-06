import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// ADVERTÊNCIAS E SILÊNCIO TEMPORÁRIO (ver advertencias-routes.ts e o bloco em db.ts).
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');
const automod = await import('../src/automod.js');

const dona = comToken(app, (await criarConta(app, 'dona-adv')).token);
const admin = comToken(app, (await criarConta(app, 'admin-adv')).token);
const membro = comToken(app, (await criarConta(app, 'membro-adv')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã das advertências' })).json();
await admin('POST', '/api/communities/join', { code: comunidade.inviteCode });
await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
const ids = Object.fromEntries(
  ((await dona('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; username: string }[]).map((m) => [m.username, m.id]),
);
await dona('PUT', `/api/communities/${comunidade.id}/members/${ids['admin-adv']}`, { role: 'admin' });
const canais = (await dona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const geral = canais.find((c) => c.type === 'text')!;
const sala = canais.find((c) => c.type === 'voice')!;
const url = (quem: string, o: string) => `/api/communities/${comunidade.id}/members/${ids[quem]}/${o}`;

test('quem pode agir sobre quem: a mesma regra da remoção', async () => {
  assert.equal((await membro('POST', url('admin-adv', 'advertencias'), { motivo: 'não pode' })).statusCode, 403, 'membro não adverte');
  assert.equal((await admin('POST', url('dona-adv', 'advertencias'), { motivo: 'não pode' })).statusCode, 403, 'ninguém age sobre o dono');
  assert.equal((await admin('PUT', url('admin-adv', 'silencio'), { minutos: 5 })).statusCode, 400, 'nem sobre si');
  const outroAdmin = comToken(app, (await criarConta(app, 'admin2-adv')).token);
  await outroAdmin('POST', '/api/communities/join', { code: comunidade.inviteCode });
  const id2 = ((await dona('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; username: string }[]).find((m) => m.username === 'admin2-adv')!.id;
  await dona('PUT', `/api/communities/${comunidade.id}/members/${id2}`, { role: 'admin' });
  assert.equal((await admin('PUT', `/api/communities/${comunidade.id}/members/${id2}/silencio`, { minutos: 5 })).statusCode, 403, 'admin não age sobre admin');
  assert.equal((await dona('PUT', `/api/communities/${comunidade.id}/members/${id2}/silencio`, { minutos: 0 })).statusCode, 200, 'o dono age');
});

test('a advertência fica registrada, com autor e motivo, e só quem administra a vê', async () => {
  assert.equal((await admin('POST', url('membro-adv', 'advertencias'), { motivo: 'x' })).statusCode, 400, 'motivo curto');
  const r = await admin('POST', url('membro-adv', 'advertencias'), { motivo: 'Xingou na conversa' });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().autor, 'admin-adv');
  assert.equal((await membro('GET', url('membro-adv', 'advertencias'))).statusCode, 403);
  const lista = (await dona('GET', url('membro-adv', 'advertencias'))).json();
  assert.deepEqual(
    lista.map((a: { motivo: string }) => a.motivo),
    ['Xingou na conversa'],
  );
});

test('silenciado: não escreve, não entra na voz, e a lista de membros mostra até quando', async () => {
  assert.equal((await admin('PUT', url('membro-adv', 'silencio'), { minutos: 7 })).statusCode, 400, 'só os tempos da lista');
  const r = await admin('PUT', url('membro-adv', 'silencio'), { minutos: 60 });
  assert.equal(r.statusCode, 200, r.body);
  assert.ok(Date.parse(r.json().silenciadoAte) > Date.now() + 59 * 60_000);
  assert.match(automod.barrarMensagem(db.findChannel(geral.id)!, ids['membro-adv'], 'oi')!, /em silêncio nesta comunidade por mais 60 min/);
  assert.equal((await membro('POST', `/api/channels/${sala.id}/voice-token`)).statusCode, 403);
});

test('tirar o silêncio libera na hora; e o silêncio vencido some sozinho', async () => {
  await admin('PUT', url('membro-adv', 'silencio'), { minutos: 0 });
  assert.equal(automod.barrarMensagem(db.findChannel(geral.id)!, ids['membro-adv'], 'voltei'), null);
  db.silenciar(comunidade.id, ids['membro-adv'], new Date(Date.now() - 1000).toISOString());
  assert.equal(db.silenciadoAte(comunidade.id, ids['membro-adv']), null);
  const membros = (await dona('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; silenciadoAte: string | null }[];
  assert.equal(membros.find((m) => m.id === ids['membro-adv'])!.silenciadoAte, null);
});
