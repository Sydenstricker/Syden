/**
 * O REGISTRO DE MODERAÇÃO DA COMUNIDADE (23/11/2026; registro-routes.ts e registroDaComunidade em db.ts). Confere que só
 * quem administra o lê, que cada ação de moderação entra com quem fez e sobre quem, que o texto da mensagem apagada nunca
 * aparece, que apagar a própria mensagem não entra, a paginação, e que a conta excluída vira null (a tela diz "Conta
 * excluída").
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
// Só depois do servidor de teste: importar antes abriria o banco de desenvolvimento (ver ajuda.ts).
const db = await import('../src/db.js');

await criarConta(app, 'primeira-reg');
const dona = await criarConta(app, 'dona-reg');
const adm = await criarConta(app, 'adm-reg');
const ana = await criarConta(app, 'ana-reg');
const bia = await criarConta(app, 'bia-reg');
const caio = await criarConta(app, 'caio-reg');
const deDona = comToken(app, dona.token);
const deAdm = comToken(app, adm.token);
const deAna = comToken(app, ana.token);
const deCaio = comToken(app, caio.token);

const comunidade = (await deDona('POST', '/api/communities', { name: 'Turma do registro' })).json();
for (const quem of [deAdm, deAna, comToken(app, bia.token), deCaio]) await quem('POST', '/api/communities/join', { code: comunidade.inviteCode });
await deDona('PUT', `/api/communities/${comunidade.id}/members/${adm.user.id}`, { role: 'admin' });
const canais = (await deDona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const texto = canais.find((c) => c.type === 'text')!;

interface Entrada {
  id: number;
  acao: string;
  quem: { id: number; nome: string } | null;
  peloSyden: boolean;
  alvo: { id: number; nome: string } | null;
  canal: string | null;
  detalhe: string | null;
}
const ler = async (antes?: number) =>
  (await deDona('GET', `/api/communities/${comunidade.id}/registro${antes ? `?antes=${antes}` : ''}`)).json() as Entrada[];

test('só quem administra lê o registro; quem não é membro nem sabe que a comunidade existe', async () => {
  assert.equal((await deAna('GET', `/api/communities/${comunidade.id}/registro`)).statusCode, 403);
  const fora = await criarConta(app, 'fora-reg');
  assert.equal((await comToken(app, fora.token)('GET', `/api/communities/${comunidade.id}/registro`)).statusCode, 404);
  assert.equal((await deAdm('GET', `/api/communities/${comunidade.id}/registro`)).statusCode, 200);
  // o cargo de administrador dado na largada já está lá
  const [ultima] = await ler();
  assert.equal(ultima.acao, 'membro.admin-dado');
  assert.equal(ultima.quem?.id, dona.user.id);
  assert.equal(ultima.alvo?.id, adm.user.id);
});

test('as ações de moderação entram, da mais nova para a mais antiga, com quem fez e sobre quem', async () => {
  const c = `/api/communities/${comunidade.id}`;
  assert.equal((await deAdm('POST', `${c}/members/${bia.user.id}/advertencias`, { motivo: 'calma lá' })).statusCode, 200);
  assert.equal((await deAdm('PUT', `${c}/members/${bia.user.id}/silencio`, { minutos: 60 })).statusCode, 200);
  const cargo = (await deDona('POST', `${c}/cargos`, { nome: 'Veteranos', cor: '#aa3300' })).json();
  assert.equal((await deAdm('PUT', `${c}/members/${ana.user.id}/cargos/${cargo.id}`)).statusCode, 200);
  await deAdm('PUT', `${c}/members/${ana.user.id}/cargos/${cargo.id}`); // repetir não entra de novo
  const novo = (await deAna('POST', `${c}/channels`, { name: 'avisos', type: 'text' })).json();
  assert.equal((await deAdm('PATCH', `/api/channels/${novo.id}`, { name: 'recados' })).statusCode, 200);
  assert.equal((await deAdm('PUT', `/api/channels/${texto.id}/modo-lento`, { segundos: 30 })).statusCode, 200);
  assert.equal((await deDona('DELETE', `/api/channels/${novo.id}`)).statusCode, 200);
  assert.equal((await deDona('POST', `${c}/lixeira/${novo.id}`)).statusCode, 200);
  assert.equal((await deDona('PUT', `${c}/moderacao`, { palavras: ['feio'], links: false, flood: false })).statusCode, 200);
  assert.equal((await deDona('POST', `${c}/invite`)).statusCode, 200);
  assert.equal((await deAdm('DELETE', `${c}/members/${caio.user.id}`)).statusCode, 200);
  assert.equal((await deAdm('POST', `${c}/members/${bia.user.id}/banir`)).statusCode, 200);
  assert.equal((await deDona('DELETE', `${c}/banidos/${bia.user.id}`)).statusCode, 200);

  const r = await ler();
  const acoes = r.map((e) => e.acao);
  assert.deepEqual(acoes.slice(0, 14), [
    'membro.desbanido',
    'membro.banido',
    'membro.removido',
    'convite.trocado',
    'automod.regras',
    'canal.restaurado',
    'canal.apagado',
    'canal.modo-lento',
    'canal.renomeado',
    'canal.criado',
    'cargo.dado',
    'membro.silenciado',
    'membro.advertido',
    'membro.admin-dado',
  ]);
  const de = (acao: string) => r.find((e) => e.acao === acao)!;
  assert.equal(de('membro.banido').quem?.id, adm.user.id);
  assert.equal(de('membro.banido').alvo?.id, bia.user.id);
  assert.equal(de('membro.silenciado').detalhe, '60');
  assert.equal(de('cargo.dado').detalhe, 'Veteranos');
  assert.equal(de('cargo.dado').alvo?.id, ana.user.id);
  assert.equal(de('canal.renomeado').canal, 'avisos');
  assert.equal(de('canal.renomeado').detalhe, 'recados');
  assert.equal(de('canal.criado').quem?.id, ana.user.id);
  assert.equal(de('canal.modo-lento').detalhe, '30');
  assert.equal(de('automod.regras').detalhe, null);
  // o motivo da advertência não vai ao registro
  assert.equal(de('membro.advertido').detalhe, null);
});

test('mensagem apagada por outra pessoa entra sem o texto; a própria, não', async () => {
  const minha = db.createMessage(texto.id, adm.user.id, 'escrevi errado');
  assert.equal((await deAdm('DELETE', `/api/messages/${minha.id}`)).statusCode, 200);
  const dela = db.createMessage(texto.id, ana.user.id, 'segredo que não pode vazar');
  assert.equal((await deAdm('POST', `/api/messages/${dela.id}/fixar`, { fixar: true })).statusCode, 200);
  assert.equal((await deAdm('POST', `/api/messages/${dela.id}/fixar`, { fixar: false })).statusCode, 200);
  assert.equal((await deAdm('DELETE', `/api/messages/${dela.id}`)).statusCode, 200);
  const r = await ler();
  assert.deepEqual(r.slice(0, 3).map((e) => e.acao), ['mensagem.apagada', 'mensagem.desafixada', 'mensagem.fixada']);
  assert.equal(r[0].alvo?.id, ana.user.id);
  assert.equal(r[0].quem?.id, adm.user.id);
  assert.ok(r[0].canal);
  assert.ok(!r.some((e) => e.acao === 'mensagem.apagada' && e.alvo?.id === adm.user.id));
  const corpo = (await deDona('GET', `/api/communities/${comunidade.id}/registro`)).body;
  assert.ok(!corpo.includes('segredo que não pode vazar'));
});

test('a conta excluída vira null, e o nome dela não sai pelo registro', async () => {
  const efemera = await criarConta(app, 'efemera-reg');
  const deEfemera = comToken(app, efemera.token);
  const codigo = (await deDona('POST', `/api/communities/${comunidade.id}/invite`)).json().inviteCode;
  assert.equal((await deEfemera('POST', '/api/communities/join', { code: codigo })).statusCode, 200);
  await deAdm('POST', `/api/communities/${comunidade.id}/members/${efemera.user.id}/advertencias`, { motivo: 'aviso' });
  assert.equal((await deEfemera('POST', '/api/me/delete', { password: efemera.password })).statusCode, 200);
  const r = await ler();
  const advertencia = r.find((e) => e.acao === 'membro.advertido')!;
  assert.equal(advertencia.alvo, null);
  assert.ok(!JSON.stringify(r).includes('efemera-reg'));
});

test('paginação: ?antes= traz as mais antigas, de 50 em 50', async () => {
  for (let i = 0; i < 55; i++) {
    db.registrarAuditoria({ actor: dona.user, action: 'convite.trocado', communityId: comunidade.id });
  }
  const primeira = await ler();
  assert.equal(primeira.length, 50);
  const segunda = await ler(primeira[49].id);
  assert.ok(segunda.length > 0);
  assert.ok(segunda[0].id < primeira[49].id);
  // ações de outra comunidade não aparecem
  db.registrarAuditoria({ actor: dona.user, action: 'convite.trocado', communityId: comunidade.id + 999 });
  assert.equal((await ler())[0].id, primeira[0].id);
});
