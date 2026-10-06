import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// A AULA: o link direto para a sala e a conta temporária de quem entra só com o nome
// (ver aula-routes.ts e o bloco "A AULA" de db.ts).
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');

const professora = comToken(app, (await criarConta(app, 'professora')).token);
const colega = comToken(app, (await criarConta(app, 'colega')).token);
const turma = (await professora('POST', '/api/communities', { name: 'Japonês 1' })).json();
const canais = (await professora('GET', `/api/communities/${turma.id}/channels`)).json();
const sala = canais.find((c: { type: string }) => c.type === 'voice');
const geral = canais.find((c: { type: string }) => c.type === 'text');

/** Pedido sem login nenhum — como chega quem abriu o link no celular. */
const semConta = (method: 'GET' | 'POST', url: string, payload?: unknown) => app.inject({ method, url, payload: payload as object });

let token = '';
let aulaId = 0;

test('quem administra cria o link de uma sala de voz, com prazo', async () => {
  const r = await professora('POST', `/api/channels/${sala.id}/aulas`, { horas: 3 });
  assert.equal(r.statusCode, 200, r.body);
  const aula = r.json();
  assert.ok(aula.token.length >= 20, 'o token não pode ser adivinhável');
  const horas = (Date.parse(aula.expiraEm) - Date.now()) / 3_600_000;
  assert.ok(horas > 2.9 && horas <= 3, `vale 3 horas (veio ${horas.toFixed(2)})`);
  token = aula.token;
  aulaId = aula.id;
});

test('quem não administra não cria link; sala de texto não tem link; prazo fora da lista é recusado', async () => {
  assert.equal((await colega('POST', `/api/channels/${sala.id}/aulas`, { horas: 3 })).statusCode, 404, 'a colega nem participa da turma');
  const r1 = await professora('POST', `/api/channels/${geral.id}/aulas`, { horas: 3 });
  assert.equal(r1.statusCode, 404);
  const r2 = await professora('POST', `/api/channels/${sala.id}/aulas`, { horas: 48 });
  assert.equal(r2.statusCode, 400, 'no máximo um dia');
});

test('o link mostra a sala e a turma a quem ainda não tem conta', async () => {
  const r = await semConta('GET', `/api/aula/${token}`);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().comunidade, 'Japonês 1');
  assert.equal(r.json().sala, sala.name);
});

let aluna: ReturnType<typeof comToken>;
let alunaId = 0;

test('entrar só com o nome: conta temporária, que vence junto com o link, já dentro da turma', async () => {
  const r = await semConta('POST', `/api/aula/${token}/entrar`, { nome: 'Maria Clara' });
  assert.equal(r.statusCode, 200, r.body);
  const corpo = r.json();
  assert.match(corpo.user.username, /^Maria\.Clara-\d{3}$/);
  assert.ok(corpo.user.temporarioAte, 'a conta devolvida já vem marcada como temporária: é por ela que o app liga o modo sala');
  assert.equal(corpo.channelId, sala.id);
  assert.equal(corpo.communityId, turma.id);
  alunaId = corpo.user.id;
  assert.ok(db.ehTemporario(alunaId));
  assert.equal(db.findUserById(alunaId)!.temporarioAte, (await semConta('GET', `/api/aula/${token}`)).json().expiraEm);
  assert.equal(db.memberRole(turma.id, alunaId), 'member');
  aluna = comToken(app, corpo.token);
});

test('nome vazio ou só de símbolos é recusado', async () => {
  assert.equal((await semConta('POST', `/api/aula/${token}/entrar`, { nome: '' })).statusCode, 400);
  assert.equal((await semConta('POST', `/api/aula/${token}/entrar`, { nome: '!!!' })).statusCode, 400);
});

test('a conta temporária faz a aula, e só a aula', async () => {
  assert.equal((await aluna('GET', `/api/communities/${turma.id}/channels`)).statusCode, 200, 'vê os canais da turma');
  assert.equal((await aluna('POST', '/api/communities', { name: 'Outra' })).statusCode, 403, 'não cria comunidade');
  assert.equal((await aluna('POST', '/api/communities/join', { code: 'qualquer' })).statusCode, 403, 'não entra em outra');
  assert.equal((await aluna('POST', '/api/amigos', { username: 'colega' })).statusCode, 403, 'não pede amizade');
  const professoraId = db.findUserByName('professora')!.id;
  assert.equal((await aluna('POST', '/api/direct', { userIds: [professoraId] })).statusCode, 403, 'não abre conversa privada');
});

test('quem já tem conta entra na turma pelo mesmo link', async () => {
  const r = await colega('POST', `/api/aula/${token}/entrar-com-conta`);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().channelId, sala.id);
  assert.equal(db.memberRole(turma.id, db.findUserByName('colega')!.id), 'member');
});

test('quem administra desliga o link, e ninguém mais entra por ele', async () => {
  const r = await professora('DELETE', `/api/communities/${turma.id}/aulas/${aulaId}`);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await semConta('GET', `/api/aula/${token}`)).statusCode, 404);
  assert.equal((await semConta('POST', `/api/aula/${token}/entrar`, { nome: 'Atrasado' })).statusCode, 404);
});

test('a conta temporária vencida é apagada — e só ela', () => {
  const vencida = db.criarUsuarioTemporario('Joana', new Date(Date.now() - 60_000).toISOString());
  const valendo = db.criarUsuarioTemporario('Pedro', new Date(Date.now() + 3_600_000).toISOString());
  assert.ok(db.limparTemporariosVencidos() >= 1);
  assert.equal(db.findUserById(vencida.id), undefined, 'a vencida saiu');
  assert.ok(db.findUserById(valendo.id), 'a que ainda vale ficou');
  assert.ok(db.findUserByName('professora'), 'conta comum não é tocada');
});

test('a cultura da turma: quem administra escolhe país e língua juntos', async () => {
  const r = await professora('PATCH', `/api/communities/${turma.id}/cultura`, { pais: 'jp', lingua: 'JA' });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().culturaPais, 'JP');
  assert.equal(r.json().culturaLingua, 'ja');
  assert.equal((await professora('PATCH', `/api/communities/${turma.id}/cultura`, { pais: 'JP' })).statusCode, 400, 'sem a língua não');
  assert.equal((await aluna('PATCH', `/api/communities/${turma.id}/cultura`, { pais: 'BR', lingua: 'pt' })).statusCode, 403);
  const limpa = await professora('PATCH', `/api/communities/${turma.id}/cultura`, { pais: null, lingua: null });
  assert.equal(limpa.json().culturaPais, null);
});
