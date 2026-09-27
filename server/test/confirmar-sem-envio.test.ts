import assert from 'node:assert/strict';
import { after, test } from 'node:test';

// A TRAVA DE SEGURANÇA DA CONFIRMAÇÃO, num arquivo próprio porque precisa de outra configuração.
//
// Sem envio de e-mail, exigir confirmação trancaria a conta e jogaria fora a chave: a pessoa se
// cadastraria, a conta nasceria bloqueada, e o link para desbloqueá-la nunca sairia do servidor. Ninguém
// veria erro nenhum — as pessoas simplesmente sumiriam na porta de entrada. Por isso a exigência segue o
// envio, e este arquivo prova o lado "sem envio".
process.env.EXIGIR_CONFIRMACAO_EMAIL = 'nao';

const { CONVITE, servidorDeTeste } = await import('./ajuda.js');
const { app, fechar } = await servidorDeTeste();
after(fechar);

test('sem envio de e-mail, o cadastro entra na hora em vez de trancar a conta', async () => {
  const cadastro = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username: 'semenvio', password: 'segredo123', email: 'semenvio@exemplo.teste', inviteCode: CONVITE },
  });
  assert.equal(cadastro.statusCode, 200, cadastro.body);
  assert.ok(cadastro.json().token, 'tem que vir token: não há como confirmar nada neste servidor');
  assert.equal(cadastro.json().precisaConfirmar, undefined);
});

test('e a entrada não barra ninguém', async () => {
  const entrada = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'semenvio', password: 'segredo123' },
  });
  assert.equal(entrada.statusCode, 200, entrada.body);
});

// Mesmo sem exigir, o e-mail é guardado e o link é mandado: é o que faz a recuperação de senha
// funcionar no dia em que ela for precisa. O que muda é só se a porta fica trancada até lá.
test('o e-mail continua sendo guardado na conta', async () => {
  const db = await import('../src/db.js');
  const pessoa = db.findUserByName('semenvio')!;
  assert.equal(db.emailDe(pessoa.id).email, 'semenvio@exemplo.teste');
});
