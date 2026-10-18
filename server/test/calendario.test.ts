/**
 * O calendário da comunidade (calendario-routes.ts):
 *   1. Todo membro lê; quem não participa não descobre nem que a comunidade existe.
 *   2. Só quem administra marca e apaga eventos; o nome é limpo e a data tem limites.
 *   3. Os aniversários aparecem só com os parabéns ligados (lá a data já seria anunciada).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

const dona = comToken(app, (await criarConta(app, 'dona-calendario')).token);
const membro = comToken(app, (await criarConta(app, 'membro-calendario')).token);
const fora = comToken(app, (await criarConta(app, 'fora-calendario')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã do calendário' })).json();
await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
const cal = `/api/communities/${comunidade.id}/calendario`, ev = `/api/communities/${comunidade.id}/eventos`;
const daqui = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString();

test('quem administra marca um evento, e todo membro vê', async () => {
  const r = await dona('POST', ev, { titulo: '  Campeonato   de sexta ', quando: daqui(3) });
  assert.equal(r.statusCode, 201);
  assert.equal(r.json().titulo, 'Campeonato de sexta');
  const visto = (await membro('GET', cal)).json();
  assert.deepEqual(visto.eventos.map((e: { titulo: string }) => e.titulo), ['Campeonato de sexta']);
  assert.equal(visto.podeEditar, false);
  assert.equal((await dona('GET', cal)).json().podeEditar, true);
});

test('membro comum não marca nem apaga; quem não participa recebe 404', async () => {
  assert.equal((await membro('POST', ev, { titulo: 'Festa', quando: daqui(2) })).statusCode, 403);
  const id = (await dona('GET', cal)).json().eventos[0].id;
  assert.equal((await membro('DELETE', `${ev}/${id}`)).statusCode, 403);
  assert.equal((await fora('GET', cal)).statusCode, 404);
  assert.equal((await fora('POST', ev, { titulo: 'x', quando: daqui(1) })).statusCode, 404);
});

test('o nome e a data são conferidos', async () => {
  assert.equal((await dona('POST', ev, { titulo: '​‮', quando: daqui(1) })).statusCode, 400);
  assert.equal((await dona('POST', ev, { titulo: 'x'.repeat(81), quando: daqui(1) })).statusCode, 400);
  assert.equal((await dona('POST', ev, { titulo: 'Ontem', quando: daqui(-2) })).statusCode, 400);
  assert.equal((await dona('POST', ev, { titulo: 'Longe', quando: daqui(800) })).statusCode, 400);
  assert.equal((await dona('POST', ev, { titulo: 'Sem data', quando: 'amanhã' })).statusCode, 400);
});

test('o intervalo pedido filtra, e quem administra apaga', async () => {
  await dona('POST', ev, { titulo: 'Daqui a um mês', quando: daqui(30) });
  const semana = (await membro('GET', `${cal}?de=${daqui(0)}&ate=${daqui(7)}`)).json();
  assert.deepEqual(semana.eventos.map((e: { titulo: string }) => e.titulo), ['Campeonato de sexta']);
  assert.equal((await membro('GET', `${cal}?de=${daqui(0)}&ate=${daqui(500)}`)).statusCode, 400);
  const id = semana.eventos[0].id;
  assert.equal((await dona('DELETE', `${ev}/${id}`)).statusCode, 200);
  assert.equal((await dona('DELETE', `${ev}/${id}`)).statusCode, 404);
});

test('os aniversários só aparecem com os parabéns ligados', async () => {
  await membro('PUT', '/api/me/aniversario', { dia: 14, mes: 3 });
  assert.deepEqual((await dona('GET', cal)).json().aniversarios, []);
  const canais = (await dona('GET', `/api/communities/${comunidade.id}/channels`)).json();
  const texto = (Array.isArray(canais) ? canais : canais.channels).find((c: { type: string }) => c.type === 'text');
  await dona('PUT', `/api/communities/${comunidade.id}/aniversarios`, { canalId: texto.id, texto: 'Parabéns, {pessoa}!' });
  const ani = (await membro('GET', cal)).json().aniversarios;
  assert.deepEqual(ani.map((a: { nome: string; dia: number; mes: number }) => [a.nome, a.dia, a.mes]), [['membro-calendario', 14, 3]]);
});
