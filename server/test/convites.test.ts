/**
 * CONVITES COM PRAZO E LIMITE DE USOS (23/11/2026; convites-routes.ts). Confere que o código de sempre continua valendo,
 * que o convite a mais expira e se esgota (com a frase de cada caso), que o uso só conta para quem entrou, quem vê a lista
 * e quem revoga, e que banido continua barrado por qualquer convite.
 */
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
// Só depois do servidor de teste: importar antes abriria o banco de desenvolvimento (ver ajuda.ts).
const db = await import('../src/db.js');
const banco = new DatabaseSync(process.env.DATABASE_PATH!);
after(() => banco.close());

await criarConta(app, 'primeira-conv');
const dona = await criarConta(app, 'dona-conv');
const ana = await criarConta(app, 'ana-conv');
const bia = await criarConta(app, 'bia-conv');
const caio = await criarConta(app, 'caio-conv');
const davi = await criarConta(app, 'davi-conv');
const deDona = comToken(app, dona.token);
const deAna = comToken(app, ana.token);
const deBia = comToken(app, bia.token);
const deCaio = comToken(app, caio.token);
const deDavi = comToken(app, davi.token);

const comunidade = (await deDona('POST', '/api/communities', { name: 'Turma dos convites' })).json();
await deAna('POST', '/api/communities/join', { code: comunidade.inviteCode });
const base = `/api/communities/${comunidade.id}/convites`;

test('membro cria convite; validade ou limite fora da lista é recusado', async () => {
  assert.equal((await deAna('POST', base, { validade: '3h', usos: null })).statusCode, 400);
  assert.equal((await deAna('POST', base, { validade: '1h', usos: 7 })).statusCode, 400);
  // quem não participa não cria
  assert.equal((await deBia('POST', base, { validade: '1h', usos: 1 })).statusCode, 404);
  const r = await deAna('POST', base, { validade: 'nunca', usos: null });
  assert.equal(r.statusCode, 200, r.body);
  const c = r.json() as { code: string; expiraEm: string | null };
  assert.equal(c.expiraEm, null);
  assert.match(c.code, /^[a-z2-9]{10}$/);
  assert.notEqual(c.code, comunidade.inviteCode);
});

test('limite de usos: conta só quem entrou, e depois diz que acabou', async () => {
  const { code } = (await deAna('POST', base, { validade: '1d', usos: 1 })).json() as { code: string };
  // a prévia do link funciona com o convite a mais
  assert.equal((await deBia('GET', `/api/convite/${code}`)).json().id, comunidade.id);
  // quem já participa não gasta o uso
  assert.equal((await deDona('POST', '/api/communities/join', { code })).statusCode, 409);
  assert.equal(db.acharConvite(code)!.usos, 0);
  assert.equal((await deBia('POST', '/api/communities/join', { code })).statusCode, 200);
  assert.equal(db.acharConvite(code)!.usos, 1);
  const gasto = await deCaio('POST', '/api/communities/join', { code });
  assert.equal(gasto.statusCode, 410);
  assert.equal(gasto.json().error, 'Este convite já foi usado o máximo de vezes.');
  // o código de sempre continua valendo
  assert.equal((await deCaio('POST', '/api/communities/join', { code: comunidade.inviteCode })).statusCode, 200);
});

test('convite vencido diz que expirou e some da lista', async () => {
  const { code } = (await deAna('POST', base, { validade: '30m', usos: null })).json() as { code: string };
  banco.prepare('UPDATE convites SET expira_em = ? WHERE code = ?').run(new Date(Date.now() - 60_000).toISOString(), code);
  const r = await deDavi('POST', '/api/communities/join', { code });
  assert.equal(r.statusCode, 410);
  assert.equal(r.json().error, 'Este convite expirou.');
  assert.equal((await deDavi('GET', `/api/convite/${code}`)).statusCode, 410);
  const lista = (await deDona('GET', base)).json() as { code: string }[];
  assert.ok(!lista.some((c) => c.code === code));
  // vencido há mais de uma semana, a limpeza o tira da tabela
  banco.prepare('UPDATE convites SET expira_em = ? WHERE code = ?').run(new Date(Date.now() - 8 * 86_400_000).toISOString(), code);
  db.limparConvitesVencidos();
  assert.equal(db.acharConvite(code), undefined);
  assert.equal((await deDavi('POST', '/api/communities/join', { code })).statusCode, 404);
});

test('lista: quem administra vê todos, com quem criou; o membro só os seus', async () => {
  const daDona = (await deDona('POST', base, { validade: '7d', usos: 5 })).json() as { code: string };
  const todos = (await deDona('GET', base)).json() as { code: string; criadoPorNome: string }[];
  assert.ok(todos.some((c) => c.code === daDona.code && c.criadoPorNome === 'dona-conv'));
  assert.ok(todos.some((c) => c.criadoPorNome === 'ana-conv'));
  const daAna = (await deAna('GET', base)).json() as { criadoPorNome: string }[];
  assert.ok(daAna.length > 0 && daAna.every((c) => c.criadoPorNome === 'ana-conv'));
});

test('revogar: quem criou revoga o seu; outro membro não; quem administra revoga qualquer um', async () => {
  const um = (await deAna('POST', base, { validade: '1h', usos: null })).json() as { code: string };
  const dois = (await deAna('POST', base, { validade: '1h', usos: null })).json() as { code: string };
  assert.equal((await deBia('DELETE', `${base}/${um.code}`)).statusCode, 403);
  assert.equal((await deAna('DELETE', `${base}/${um.code}`)).statusCode, 200);
  assert.equal((await deDona('DELETE', `${base}/${dois.code}`)).statusCode, 200);
  assert.equal((await deDavi('POST', '/api/communities/join', { code: dois.code })).statusCode, 404);
  // o convite de outra comunidade não se revoga por esta
  const outra = (await deBia('POST', '/api/communities', { name: 'Outra turma' })).json();
  const daOutra = (await deBia('POST', `/api/communities/${outra.id}/convites`, { validade: '1h', usos: null })).json() as { code: string };
  assert.equal((await deDona('DELETE', `${base}/${daOutra.code}`)).statusCode, 404);
});

test('banido continua barrado pelo convite a mais, sem gastar o uso', async () => {
  const { code } = (await deAna('POST', base, { validade: '1d', usos: 10 })).json() as { code: string };
  assert.equal((await deDona('POST', `/api/communities/${comunidade.id}/members/${caio.user.id}/banir`)).statusCode, 200);
  const r = await deCaio('POST', '/api/communities/join', { code });
  assert.equal(r.statusCode, 403);
  assert.match(r.json().error, /baniu a sua conta/);
  assert.equal(db.acharConvite(code)!.usos, 0);
});
