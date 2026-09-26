import assert from 'node:assert/strict';
import { after, test } from 'node:test';

// As chaves precisam existir ANTES do config ser lido, e o config é lido no primeiro import do servidor.
// Não são chaves de verdade: nenhum teste daqui fala com o Google — o que se testa é o caminho de casa.
process.env.GOOGLE_CLIENT_ID = 'teste-cliente';
process.env.GOOGLE_CLIENT_SECRET = 'teste-segredo';

// A ORDEM DESTAS LINHAS IMPORTA, e errar nela não dá erro nenhum: dá um teste que passa escrevendo no
// banco de desenvolvimento de verdade. O config.ts congela o caminho do banco no PRIMEIRO import de
// qualquer módulo do servidor, e quem troca esse caminho é o servidorDeTeste. Então ele vem antes de
// tudo — inclusive antes do social.js, que parece inofensivo mas arrasta o config junto.
const { servidorDeTeste } = await import('./ajuda.js');
const { app, fechar } = await servidorDeTeste();
after(fechar);

const { resumo, sortear } = await import('../src/social.js');
const db = await import('../src/db.js');

/** Começa uma entrada como o navegador começaria, e devolve o segredo e o estado sorteado pelo servidor. */
async function comecar() {
  const segredo = sortear();
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/social/inicio',
    payload: { provedor: 'google', desafio: resumo(segredo) },
  });
  assert.equal(resposta.statusCode, 200, resposta.body);
  const url = new URL(resposta.json().url);
  return { segredo, estado: url.searchParams.get('state')!, url };
}

test('a tela de entrada fica sabendo quais provedores existem', async () => {
  const inicio = await app.inject({ method: 'GET', url: '/api/inicio' });
  assert.deepEqual(inicio.json().social, ['google'], 'o Discord não tem chave neste teste');
});

test('o começo manda para o Google com tudo o que ele espera', async () => {
  const { url } = await comecar();
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), 'teste-cliente');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.ok(url.searchParams.get('state'));
  assert.ok(url.searchParams.get('redirect_uri')?.endsWith('/api/auth/social/google/volta'));
});

test('provedor sem chave configurada não existe', async () => {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/social/inicio',
    payload: { provedor: 'discord', desafio: resumo(sortear()) },
  });
  assert.equal(resposta.statusCode, 404, 'sem chave, o botão nem aparece — e a rota não anuncia nada');
});

test('desafio curto é recusado: um segredo adivinhável não protege ninguém', async () => {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/social/inicio',
    payload: { provedor: 'google', desafio: 'abc' },
  });
  assert.equal(resposta.statusCode, 400);
});

test('voltar sem estado, ou com estado inventado, manda para o site com recado e sem token', async () => {
  const semNada = await app.inject({ method: 'GET', url: '/api/auth/social/google/volta' });
  assert.equal(semNada.statusCode, 302);
  assert.ok(semNada.headers.location?.includes('entrada=incompleto'));
  assert.ok(!semNada.headers.location?.includes('comprovante'), 'nunca sai token daí');

  const inventado = await app.inject({ method: 'GET', url: '/api/auth/social/google/volta?code=x&state=nao-existe' });
  assert.ok(inventado.headers.location?.includes('entrada=expirado'));
});

test('cancelar na tela do Google não é erro, é desistência', async () => {
  const resposta = await app.inject({ method: 'GET', url: '/api/auth/social/google/volta?error=access_denied' });
  assert.ok(resposta.headers.location?.includes('entrada=cancelado'));
});

// ---------------------------------------------------------------------------------------------------
// Daqui para baixo o provedor é PULADO: o teste escreve direto o comprovante que a volta escreveria.
// O que se está testando é a segunda metade — a que protege contra login CSRF —, e ela não depende de
// o Google ter respondido: depende de quem apresenta o segredo.
// ---------------------------------------------------------------------------------------------------

async function ateOComprovante(nome: string) {
  const { segredo, estado } = await comecar();
  const user = db.createUserSemSenha(nome, null);
  const comprovante = sortear();
  db.guardarEntregaSocial(estado, comprovante, user.id);
  return { segredo, comprovante, user };
}

test('com o comprovante E o segredo, sai o token', async () => {
  const { segredo, comprovante, user } = await ateOComprovante('viacomgoogle');
  const resposta = await app.inject({ method: 'POST', url: '/api/auth/social/concluir', payload: { comprovante, segredo } });
  assert.equal(resposta.statusCode, 200, resposta.body);
  assert.equal(resposta.json().user.username, user.username);

  // E o token vale mesmo: é uma sessão de verdade, igual à de quem entrou com senha.
  const me = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${resposta.json().token}` } });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().id, user.id);
});

// ESTE É O TESTE QUE JUSTIFICA O FLUXO TODO. Sem ele, um atacante começa a entrada com a conta dele,
// planta o link de volta, e a vítima acaba dentro da conta do atacante sem perceber.
test('o comprovante sozinho não serve: sem o segredo, não entra', async () => {
  const { comprovante } = await ateOComprovante('vitima');
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/social/concluir',
    payload: { comprovante, segredo: sortear() },
  });
  assert.equal(resposta.statusCode, 403);
  assert.equal(resposta.json().token, undefined);
});

test('errar o segredo queima o comprovante: não dá para ficar tentando', async () => {
  const { segredo, comprovante } = await ateOComprovante('quemtenta');
  await app.inject({ method: 'POST', url: '/api/auth/social/concluir', payload: { comprovante, segredo: sortear() } });

  const agoraComOCerto = await app.inject({ method: 'POST', url: '/api/auth/social/concluir', payload: { comprovante, segredo } });
  assert.equal(agoraComOCerto.statusCode, 400, 'o comprovante morreu na tentativa errada');
});

test('comprovante é de uso único', async () => {
  const { segredo, comprovante } = await ateOComprovante('umsovez');
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/social/concluir', payload: { comprovante, segredo } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/social/concluir', payload: { comprovante, segredo } })).statusCode, 400);
});

// Conta criada pelo Google não tem senha. Antes, o hash guardado sem ":" estourava e a tentativa de
// entrar virava erro 500 — que, além de feio, contaria a quem tentou que aquela conta é diferente.
test('tentar entrar com senha numa conta de Google dá senha errada, e não erro do servidor', async () => {
  db.createUserSemSenha('sosocial', null);
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'sosocial', password: 'chutando123' },
  });
  assert.equal(resposta.statusCode, 401, 'tem que ser recusa comum, não 500');
});
