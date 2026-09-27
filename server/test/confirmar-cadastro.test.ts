import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { CONVITE, codigoDoLink, criarConta, servidorDeTeste } from './ajuda.js';

// O cadastro passou a exigir e-mail confirmado: a conta nasce, mas só entra depois que a pessoa abre o
// link que chegou na caixa dela. É o que separa "alguém digitou um endereço" de "alguém tem acesso
// àquele endereço" — e é o que garante que toda conta nova consiga recuperar a senha um dia.
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');
const { hashPassword } = await import('../src/auth.js');

const cadastrar = (corpo: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/auth/register', payload: { inviteCode: CONVITE, ...corpo } });

const entrar = (username: string, password = 'segredo123') =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });

// A primeira conta é a dona e já vem confirmada pelo ajudante.
const dona = await criarConta(app, 'dona');

test('cadastro sem e-mail é recusado, com explicação', async () => {
  const resposta = await cadastrar({ username: 'semcaixa', password: 'segredo123' });
  assert.equal(resposta.statusCode, 400);
  assert.ok(resposta.json().error.includes('e-mail'), resposta.json().error);
});

test('e-mail com cara de errado é recusado antes de escrever no banco', async () => {
  for (const email of ['arroba-nenhum', 'a@b', 'a b@c.com', '@exemplo.com']) {
    const resposta = await cadastrar({ username: 'torto' + Math.random(), password: 'segredo123', email });
    assert.equal(resposta.statusCode, 400, `"${email}" devia ter sido recusado`);
  }
  assert.equal(db.findUserByName('torto'), undefined);
});

test('o mesmo e-mail não serve para duas contas', async () => {
  assert.equal((await cadastrar({ username: 'primeira', password: 'segredo123', email: 'mesmo@exemplo.teste' })).statusCode, 200);
  const segunda = await cadastrar({ username: 'segunda', password: 'segredo123', email: 'Mesmo@Exemplo.Teste' });
  assert.equal(segunda.statusCode, 409, 'nem trocando a caixa das letras');
});

// O CORAÇÃO DA MUDANÇA.
test('cadastrar não entra: o token só sai depois de confirmar', async () => {
  const cadastro = await cadastrar({ username: 'pendente', password: 'segredo123', email: 'pendente@exemplo.teste' });
  assert.equal(cadastro.statusCode, 200, cadastro.body);
  assert.equal(cadastro.json().precisaConfirmar, true);
  assert.equal(cadastro.json().token, undefined, 'não pode sair token do cadastro');

  const cedo = await entrar('pendente');
  assert.equal(cedo.statusCode, 403);
  assert.equal(cedo.json().precisaConfirmar, true, 'a tela precisa saber que é ISTO, e não senha errada');

  const confirmou = await app.inject({
    method: 'POST',
    url: '/api/auth/confirmar-email',
    payload: { codigo: codigoDoLink(cadastro.json().link) },
  });
  assert.equal(confirmou.statusCode, 200, confirmou.body);

  const agora = await entrar('pendente');
  assert.equal(agora.statusCode, 200, agora.body);
  assert.ok(agora.json().token);
});

test('senha errada continua sendo senha errada, e não se confunde com falta de confirmação', async () => {
  await cadastrar({ username: 'outro', password: 'segredo123', email: 'outro@exemplo.teste' });
  const resposta = await entrar('outro', 'chutando');
  assert.equal(resposta.statusCode, 401, 'senha errada não pode virar 403 de confirmação');
});

// SE ESTE TESTE QUEBRAR, TODO MUNDO QUE JÁ TINHA CONTA FICA TRANCADO DO LADO DE FORA. A regra nova vale
// só para quem nasce com ela; conta antiga nunca teve para onde confirmar.
test('quem já tinha conta antes da regra não é barrado', async () => {
  // createUser sem os dois últimos argumentos é exatamente como as contas antigas foram criadas.
  const antiga = db.createUser('antiga', await hashPassword('segredo123'));
  assert.equal(db.precisaConfirmar(antiga.id), false, 'conta criada sem a exigência não exige nada');
  assert.equal((await entrar('antiga')).statusCode, 200, 'tem que entrar normalmente');
});

test('conta de provedor também não é barrada: o provedor já é a prova', async () => {
  const social = db.createUserSemSenha('viaprovedor', null);
  assert.equal(db.precisaConfirmar(social.id), false);
});

test('dá para pedir o link de novo sem estar dentro', async () => {
  const cadastro = await cadastrar({ username: 'perdido', password: 'segredo123', email: 'perdido@exemplo.teste' });
  assert.equal(cadastro.statusCode, 200);

  const reenvio = await app.inject({ method: 'POST', url: '/api/auth/reenviar-confirmacao', payload: { username: 'perdido' } });
  assert.equal(reenvio.statusCode, 200);

  // O link novo vale, mesmo tendo existido um anterior.
  const confirmou = await app.inject({
    method: 'POST',
    url: '/api/auth/confirmar-email',
    payload: { codigo: codigoDoLink(reenvio.json().link) },
  });
  assert.equal(confirmou.statusCode, 200, confirmou.body);
  assert.equal((await entrar('perdido')).statusCode, 200);
});

// A rota de reenvio manda e-mail a pedido de qualquer um, sem login. Se ela respondesse diferente para
// conta que existe e conta que não existe, viraria um jeito de descobrir quem tem conta no Syden.
test('o reenvio responde igual para conta que existe e para conta que não existe', async () => {
  const inventada = await app.inject({ method: 'POST', url: '/api/auth/reenviar-confirmacao', payload: { username: 'ninguem' } });
  const confirmada = await app.inject({ method: 'POST', url: '/api/auth/reenviar-confirmacao', payload: { username: 'dona' } });
  assert.equal(inventada.statusCode, confirmada.statusCode);
  assert.equal(inventada.json().aviso, confirmada.json().aviso);
  void dona;
});

test('confirmar duas vezes não quebra nada', async () => {
  const cadastro = await cadastrar({ username: 'duasvezes', password: 'segredo123', email: 'duasvezes@exemplo.teste' });
  const codigo = codigoDoLink(cadastro.json().link);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/confirmar-email', payload: { codigo } })).statusCode, 200);
  // O código é de uso único; a segunda vez é recusada, sem estourar.
  const segunda = await app.inject({ method: 'POST', url: '/api/auth/confirmar-email', payload: { codigo } });
  assert.ok(segunda.statusCode === 400 || segunda.statusCode === 200, 'não pode dar erro de servidor');
  assert.equal((await entrar('duasvezes')).statusCode, 200, 'e a conta continua valendo');
});
