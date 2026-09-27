import assert from 'node:assert/strict';
import { after, test } from 'node:test';

process.env.GOOGLE_CLIENT_ID = 'teste-cliente';
process.env.GOOGLE_CLIENT_SECRET = 'teste-segredo';

// A ordem importa: o servidorDeTeste é quem troca o banco, e ele vem antes de tudo (ver ajuda.ts).
const { comToken, criarConta, servidorDeTeste } = await import('./ajuda.js');
const { app, fechar } = await servidorDeTeste();
after(fechar);

const { resumo, sortear } = await import('../src/social.js');
const db = await import('../src/db.js');

const donaToken = (await criarConta(app, 'dona')).token;
const dona = comToken(app, donaToken);
const amigaToken = (await criarConta(app, 'amiga')).token;
const amiga = comToken(app, amigaToken);

const eu = db.findUserByName('dona')!;
const outra = db.findUserByName('amiga')!;

/** Começa uma ligação como a tela começaria, e leva o passeio até o comprovante — sem ir ao Google. */
async function ateOComprovante(quem: ReturnType<typeof comToken>, sub: string) {
  const segredo = sortear();
  const inicio = await quem('POST', '/api/me/social/inicio', { provedor: 'google', desafio: resumo(segredo) });
  assert.equal(inicio.statusCode, 200, inicio.body);
  const estado = new URL(inicio.json().url).searchParams.get('state')!;

  // É o que a rota de volta escreveria depois de o Google confirmar quem é.
  const comprovante = sortear();
  db.guardarEntregaSocial(estado, comprovante, null, sub);
  return { segredo, comprovante };
}

test('quem não entrou não começa ligação nenhuma', async () => {
  const resposta = await app.inject({ method: 'POST', url: '/api/me/social/inicio', payload: { provedor: 'google', desafio: resumo(sortear()) } });
  assert.equal(resposta.statusCode, 401);
});

test('a tela sabe o que está ligado e se ainda existe senha', async () => {
  const antes = await dona('GET', '/api/me/social');
  assert.equal(antes.statusCode, 200);
  assert.deepEqual(antes.json().ligados, []);
  assert.equal(antes.json().temSenha, true, 'esta conta nasceu com senha');
  assert.deepEqual(antes.json().possiveis, ['google'], 'só o Google tem chave neste teste');
});

test('ligar põe o provedor na conta de quem começou', async () => {
  const { segredo, comprovante } = await ateOComprovante(dona, 'google-da-dona');
  const resposta = await app.inject({ method: 'POST', url: '/api/auth/social/concluir', payload: { comprovante, segredo } });
  assert.equal(resposta.statusCode, 200, resposta.body);
  assert.equal(resposta.json().ligado, 'google');
  assert.equal(resposta.json().token, undefined, 'ligação não devolve token: a pessoa já estava dentro');
  assert.deepEqual((await dona('GET', '/api/me/social')).json().ligados, ['google']);
});

test('depois de ligado, entrar por ele cai na conta certa', async () => {
  assert.equal(db.contaSocial('google', 'google-da-dona'), eu.id);
});

// ESTE É O ATAQUE QUE A ESPERA PELO SEGREDO EVITA: o atacante começa uma ligação, planta o link de
// volta, e a vítima clica. Sem a conferência do segredo, a conta do ATACANTE ficaria pendurada na conta
// da vítima — e ele entraria nela quando quisesse, para sempre, sem saber senha nenhuma.
test('sem o segredo, a ligação não acontece', async () => {
  const { comprovante } = await ateOComprovante(amiga, 'google-de-um-estranho');
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/social/concluir',
    payload: { comprovante, segredo: sortear() },
  });
  assert.equal(resposta.statusCode, 403);
  assert.deepEqual((await amiga('GET', '/api/me/social')).json().ligados, [], 'nada pode ter sido ligado');
});

test('uma conta de provedor não se liga em duas pessoas', async () => {
  const { segredo, comprovante } = await ateOComprovante(amiga, 'google-da-dona');
  const resposta = await app.inject({ method: 'POST', url: '/api/auth/social/concluir', payload: { comprovante, segredo } });
  assert.equal(resposta.statusCode, 409);
  assert.ok(resposta.json().error.includes('dona'), 'a recusa diz de quem é: ' + resposta.json().error);
  assert.equal(db.contaSocial('google', 'google-da-dona'), eu.id, 'continua com a dona');
});

test('desligar tira, e dá para ligar de novo depois', async () => {
  assert.equal((await dona('DELETE', '/api/me/social/google')).statusCode, 200);
  assert.deepEqual((await dona('GET', '/api/me/social')).json().ligados, []);
  assert.equal((await dona('DELETE', '/api/me/social/google')).statusCode, 404, 'desligar o que não está ligado');
});

test('provedor inventado não existe', async () => {
  assert.equal((await dona('DELETE', '/api/me/social/orkut')).statusCode, 404);
});

// Sem esta trava, quem criou a conta pelo Google e nunca pôs senha desligaria o Google e ficaria
// trancado do lado de fora da própria conta — nem a recuperação por e-mail resolveria, porque ela
// devolve uma senha para uma conta que não tem porta de senha.
test('não dá para desligar o ÚNICO jeito de entrar', async () => {
  const semSenha = db.createUserSemSenha('sosocial', null);
  db.ligarContaSocial('google', 'google-do-sosocial', semSenha.id);

  // Entra como essa pessoa pelo caminho social, para ter um token de verdade dela.
  const segredo = sortear();
  const estado = sortear();
  db.criarEstadoSocial(estado, 'google', resumo(segredo));
  const comprovante = sortear();
  db.guardarEntregaSocial(estado, comprovante, semSenha.id);
  const entrada = await app.inject({ method: 'POST', url: '/api/auth/social/concluir', payload: { comprovante, segredo } });
  assert.equal(entrada.statusCode, 200, entrada.body);
  const ela = comToken(app, entrada.json().token);

  const estado2 = await ela('GET', '/api/me/social');
  assert.equal(estado2.json().temSenha, false);
  assert.deepEqual(estado2.json().ligados, ['google']);

  const tentativa = await ela('DELETE', '/api/me/social/google');
  assert.equal(tentativa.statusCode, 409);
  assert.ok(tentativa.json().error.includes('único'), tentativa.json().error);
  assert.deepEqual((await ela('GET', '/api/me/social')).json().ligados, ['google'], 'continua ligado');
});

// ---------------------------------------------------------------------------------------------------
// Conta que nasceu sem senha: ela precisa conseguir DEFINIR uma e conseguir SER APAGADA. Sem as duas
// coisas, uma conta criada por engano no caminho social fica presa para sempre — foi o que aconteceu de
// verdade, e é por isso que estes testes existem.
// ---------------------------------------------------------------------------------------------------

/** Entra como uma conta sem senha e devolve o atalho autenticado dela. */
async function entrarSemSenha(nome: string) {
  const pessoa = db.createUserSemSenha(nome, null);
  const segredo = sortear();
  const estado = sortear();
  db.criarEstadoSocial(estado, 'google', resumo(segredo));
  const comprovante = sortear();
  db.guardarEntregaSocial(estado, comprovante, pessoa.id);
  const entrada = await app.inject({ method: 'POST', url: '/api/auth/social/concluir', payload: { comprovante, segredo } });
  assert.equal(entrada.statusCode, 200, entrada.body);
  return { pessoa, comoEla: comToken(app, entrada.json().token) };
}

test('conta sem senha consegue definir a primeira, sem ter que informar uma atual', async () => {
  const { pessoa, comoEla } = await entrarSemSenha('primeirasenha');
  assert.equal(db.temSenha(pessoa.id), false);

  const resposta = await comoEla('POST', '/api/me/password', { newPassword: 'senhanova123' });
  assert.equal(resposta.statusCode, 200, resposta.body);
  assert.equal(db.temSenha(pessoa.id), true);

  // E ela passa a valer de verdade na porta da frente.
  const entrada = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'primeirasenha', password: 'senhanova123' },
  });
  assert.equal(entrada.statusCode, 200, 'a senha recém-definida tem que servir para entrar');
});

test('quem JÁ tem senha continua tendo que informar a atual para trocar', async () => {
  const errada = await dona('POST', '/api/me/password', { currentPassword: 'chute', newPassword: 'outrasenha123' });
  assert.equal(errada.statusCode, 400);
  assert.ok(errada.json().error.includes('atual'), errada.json().error);
});

test('conta sem senha se apaga escrevendo o próprio nome', async () => {
  const { pessoa, comoEla } = await entrarSemSenha('vouembora');

  const semNada = await comoEla('POST', '/api/me/delete', {});
  assert.equal(semNada.statusCode, 400, 'confirmação em branco não apaga nada');
  assert.ok(db.findUserById(pessoa.id), 'a conta tem que continuar viva');

  const nomeErrado = await comoEla('POST', '/api/me/delete', { confirmacao: 'outrapessoa' });
  assert.equal(nomeErrado.statusCode, 400);
  assert.ok(db.findUserById(pessoa.id));

  const certo = await comoEla('POST', '/api/me/delete', { confirmacao: 'vouembora' });
  assert.equal(certo.statusCode, 200, certo.body);
  assert.equal(db.findUserById(pessoa.id), undefined, 'agora sim');
});

test('quem tem senha continua apagando com a senha, e não com o nome', async () => {
  const token = (await criarConta(app, 'comsenha')).token;
  const ela = comToken(app, token);
  assert.equal((await ela('POST', '/api/me/delete', { confirmacao: 'comsenha' })).statusCode, 400, 'o nome não basta aqui');
  assert.equal((await ela('POST', '/api/me/delete', { password: 'segredo123' })).statusCode, 200);
});
