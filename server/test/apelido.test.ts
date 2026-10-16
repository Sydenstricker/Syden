import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// O APELIDO NA COMUNIDADE (ver cargos-routes.ts): cada um troca o seu; quem administra troca o de qualquer um.
const { app, fechar } = await servidorDeTeste();
after(fechar);

const dona = comToken(app, (await criarConta(app, 'dona-apelido')).token);
const membro = comToken(app, (await criarConta(app, 'membro-apelido')).token);
const outro = comToken(app, (await criarConta(app, 'outro-apelido')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã dos apelidos' })).json();
const segunda = (await dona('POST', '/api/communities', { name: 'Outro clã' })).json();
for (const quem of [membro, outro]) await quem('POST', '/api/communities/join', { code: comunidade.inviteCode });
await membro('POST', '/api/communities/join', { code: segunda.inviteCode });
type M = { id: number; username: string; apelido: string | null };
const membros = async (id: number) => (await dona('GET', `/api/communities/${id}/members`)).json() as M[];
const idDe = async (nome: string) => (await membros(comunidade.id)).find((m) => m.username === nome)!.id;
const membroId = await idDe('membro-apelido');
const outroId = await idDe('outro-apelido');
const url = (id: number) => `/api/communities/${comunidade.id}/members/${id}/apelido`;

test('cada um troca o próprio apelido, e ele vale só naquela comunidade', async () => {
  const r = await membro('PUT', url(membroId), { apelido: '  Fernando   do  Clã ' });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().apelido, 'Fernando do Clã');
  assert.equal((await membros(comunidade.id)).find((m) => m.id === membroId)!.apelido, 'Fernando do Clã');
  assert.equal((await membros(segunda.id)).find((m) => m.id === membroId)!.apelido, null, 'na outra comunidade, o nome da conta');
});

test('vazio volta ao nome da conta; longo é recusado', async () => {
  assert.equal((await membro('PUT', url(membroId), { apelido: 'x'.repeat(33) })).statusCode, 400);
  assert.equal((await membro('PUT', url(membroId), { apelido: '   ' })).json().apelido, null);
});

test('caractere invisível ou de inverter o texto não entra no apelido (revisão de 16/10/2026)', async () => {
  assert.equal((await membro('PUT', url(membroId), { apelido: '\u200B' })).json().apelido, null, 'só invisível: como apagar');
  assert.equal((await membro('PUT', url(membroId), { apelido: 'Ana\u202Eodom' })).json().apelido, 'Anaodom');
  assert.equal((await membro('PUT', url(membroId), { apelido: 'Turma 👨\u200D👩\u200D👧' })).json().apelido, 'Turma 👨\u200D👩\u200D👧', 'o emoji composto fica');
});

test('membro comum não troca o dos outros; quem administra troca', async () => {
  assert.equal((await membro('PUT', url(outroId), { apelido: 'Bobo' })).statusCode, 403);
  const r = await dona('PUT', url(outroId), { apelido: 'Capitão' });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().apelido, 'Capitão');
});

test('quem não é dono não troca o apelido de quem administra', async () => {
  await dona('PUT', `/api/communities/${comunidade.id}/members/${outroId}`, { role: 'admin' });
  const donaId = (await membros(comunidade.id)).find((m) => m.username === 'dona-apelido')!.id;
  assert.equal((await outro('PUT', url(donaId), { apelido: 'Chefa' })).statusCode, 403);
  assert.equal((await outro('PUT', url(membroId), { apelido: 'Novato' })).statusCode, 200);
});
