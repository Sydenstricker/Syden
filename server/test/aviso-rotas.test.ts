import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// A primeira conta do Syden nasce administradora; a segunda, não. É nisso que este arquivo se apoia
// para separar quem pode escrever o recado de quem não pode.
const { app, fechar } = await servidorDeTeste();
after(fechar);

const dona = comToken(app, (await criarConta(app, 'dona')).token);
const amiga = comToken(app, (await criarConta(app, 'amiga')).token);

const RECADO = { texto: 'Manutenção hoje às 22h, umas duas horas fora do ar.', tom: 'manutencao' };

test('só quem administra escreve o recado', async () => {
  assert.equal((await amiga('PUT', '/api/aviso', RECADO)).statusCode, 403);
  assert.equal((await amiga('GET', '/api/aviso')).statusCode, 403, 'nem ler o rascunho: é texto que ainda não foi publicado');
});

test('sem entrar, ninguém escreve', async () => {
  assert.equal((await app.inject({ method: 'PUT', url: '/api/aviso', payload: RECADO })).statusCode, 401);
});

// É o ponto todo do recado: ele precisa chegar em quem NÃO CONSEGUE ENTRAR.
test('o recado aparece para quem nem conta tem', async () => {
  assert.equal((await app.inject({ method: 'GET', url: '/api/inicio' })).json().aviso, null, 'sem recado, não vem nada');

  assert.equal((await dona('PUT', '/api/aviso', RECADO)).statusCode, 200);

  const inicio = await app.inject({ method: 'GET', url: '/api/inicio' });
  assert.equal(inicio.statusCode, 200);
  assert.equal(inicio.json().aviso.texto, RECADO.texto);
  assert.equal(inicio.json().aviso.tom, 'manutencao');
});

test('recado torto é recusado com uma explicação, e não com erro do servidor', async () => {
  const resposta = await dona('PUT', '/api/aviso', { texto: 'oi', tom: 'manutencao' });
  assert.equal(resposta.statusCode, 400);
  assert.ok(resposta.json().error.length > 0);
});

test('quem administra vê o rascunho para poder editar', async () => {
  const leitura = await dona('GET', '/api/aviso');
  assert.equal(leitura.statusCode, 200);
  assert.equal(leitura.json().aviso.texto, RECADO.texto);
  assert.equal(leitura.json().valendo, true);
});

test('apagar tira o recado da tela de quem nem entrou', async () => {
  assert.equal((await dona('DELETE', '/api/aviso')).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/api/inicio' })).json().aviso, null);
});

test('escrever e apagar ficam registrados na auditoria', async () => {
  await dona('PUT', '/api/aviso', RECADO);
  await dona('DELETE', '/api/aviso');

  const registro = await dona('GET', '/api/audit');
  assert.equal(registro.statusCode, 200);
  const acoes = JSON.stringify(registro.json());
  assert.ok(acoes.includes('aviso.escrito'), 'escrever o recado é uso de poder e tem que ficar registrado');
  assert.ok(acoes.includes('aviso.apagado'));
});
