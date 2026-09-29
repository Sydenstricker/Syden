// A espera do app: entrar com Google SEM o navegador ter de abrir o aplicativo.
//
// POR QUE ESTE CAMINHO EXISTE. Antes, a volta do Google era entregue por `syden://`, e o Windows
// perguntava se o site podia abrir o programa. Essa pergunta é do sistema e não tem como ser removida —
// mas ela só acontece porque alguém de fora precisa abrir o app. Aqui é o app quem pergunta ao
// servidor, de tempos em tempos, se a entrada já terminou; ninguém abre nada, e depois do "ok" no
// Google não sobra pergunta nenhuma.
//
// O QUE PRECISA SER PROVADO AQUI é que a porta nova não é mais frouxa do que a antiga. Ela entrega uma
// sessão, então vale a mesma régua do /concluir: sem o segredo, nada sai. E vale uma régua a mais, que
// é própria da espera — enquanto não terminou, a resposta não pode contar nada sobre o que está do
// outro lado, senão perguntar vira um jeito de descobrir.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';

process.env.GOOGLE_CLIENT_ID = 'teste-cliente';
process.env.GOOGLE_CLIENT_SECRET = 'teste-segredo';

// A ordem importa: o servidorDeTeste é quem troca o banco, e ele vem antes de tudo (ver ajuda.ts).
const { criarConta, servidorDeTeste } = await import('./ajuda.js');
const { app, fechar } = await servidorDeTeste();
after(fechar);

const { resumo, sortear } = await import('../src/social.js');
const db = await import('../src/db.js');

const esperar = (estado: string, segredo: string) =>
  app.inject({ method: 'POST', url: '/api/auth/social/esperar', payload: { estado, segredo } });

/** Começa uma entrada como o app começaria: pelo app, e guardando o segredo só deste lado. */
async function comecarPeloApp() {
  const segredo = sortear();
  const inicio = await app.inject({
    method: 'POST',
    url: '/api/auth/social/inicio',
    payload: { provedor: 'google', desafio: resumo(segredo), doApp: true },
  });
  assert.equal(inicio.statusCode, 200, inicio.body);
  const { url, estado } = inicio.json();
  assert.ok(estado, 'o começo precisa devolver o estado: é por ele que o app pergunta depois');
  assert.equal(estado, new URL(url).searchParams.get('state'), 'o estado devolvido é o mesmo que vai ao provedor');
  return { segredo, estado };
}

/** O que a rota de volta escreveria depois de o Google confirmar quem é. Sem ir ao Google. */
function oGoogleRespondeu(estado: string, userId: number) {
  db.guardarEntregaSocial(estado, sortear(), userId);
}

test('enquanto o provedor não respondeu, a espera não conta nada', async () => {
  const { segredo, estado } = await comecarPeloApp();
  const resposta = await esperar(estado, segredo);
  assert.equal(resposta.statusCode, 200, resposta.body);
  assert.deepEqual(resposta.json(), { situacao: 'esperando' }, 'nem quem é, nem em que passo está');
});

test('quando o provedor responde, a espera entrega a sessão e o app entra sozinho', async () => {
  const pessoa = await criarConta(app, 'quem-esperou');
  const { segredo, estado } = await comecarPeloApp();
  oGoogleRespondeu(estado, db.findUserByName('quem-esperou')!.id);

  const resposta = await esperar(estado, segredo);
  assert.equal(resposta.statusCode, 200, resposta.body);
  assert.equal(resposta.json().situacao, 'ok');
  assert.ok(resposta.json().token, 'é daqui que sai a sessão');
  assert.equal(resposta.json().user.username, 'quem-esperou');
  assert.ok(pessoa.token, 'a conta existia antes: a entrada social achou a mesma');

  // Uso único, como o comprovante: perguntar de novo não pode devolver outra sessão.
  const denovo = await esperar(estado, segredo);
  assert.equal(denovo.json().situacao, 'expirado', 'o estado morre no instante em que vira sessão');
});

test('sem o segredo certo não sai sessão nenhuma, e o estado queima', async () => {
  await criarConta(app, 'alvo-da-espera');
  const { estado } = await comecarPeloApp();
  oGoogleRespondeu(estado, db.findUserByName('alvo-da-espera')!.id);

  // Quem soubesse o estado — ele viaja no endereço do provedor — ainda não tem o segredo, que nunca
  // saiu de quem começou. É a mesma trava do /concluir, e é a razão de a troca ser a MESMA função.
  const chute = await esperar(estado, sortear());
  assert.equal(chute.statusCode, 403, chute.body);
  assert.equal(chute.json().token, undefined);

  const depois = await esperar(estado, 'tanto-faz');
  assert.equal(depois.json().situacao, 'expirado', 'errar o segredo queima a entrada, não deixa tentar de novo');
});

test('estado que não existe responde igual a estado vencido', async () => {
  const inventado = await esperar(sortear(), sortear());
  assert.equal(inventado.statusCode, 200);
  assert.deepEqual(inventado.json(), { situacao: 'expirado' }, 'dizer "não existe" confirmaria o chute de quem está tentando');
});

test('desistir no Google termina a espera com o motivo, em vez de deixar o app esperando', async () => {
  const { segredo, estado } = await comecarPeloApp();

  // É o que o Google manda quando a pessoa clica em "cancelar".
  const volta = await app.inject({ method: 'GET', url: `/api/auth/social/google/volta?state=${estado}&error=access_denied` });
  assert.ok(volta.headers.location?.includes('entrada=cancelado'), volta.headers.location);

  const resposta = await esperar(estado, segredo);
  assert.equal(resposta.json().situacao, 'cancelado', 'o app precisa saber a diferença entre desistência e demora');

  const denovo = await esperar(estado, segredo);
  assert.equal(denovo.json().situacao, 'expirado', 'lido o motivo, o estado some');
});

test('a mesma volta não vale duas vezes depois de anotada a falha', async () => {
  const { estado } = await comecarPeloApp();
  await app.inject({ method: 'GET', url: `/api/auth/social/google/volta?state=${estado}&error=access_denied` });

  // Sem a conferência da falha, esta segunda volta seguiria em frente como se nada tivesse acontecido.
  const segunda = await app.inject({ method: 'GET', url: `/api/auth/social/google/volta?state=${estado}&code=qualquer` });
  assert.ok(segunda.headers.location?.includes('entrada=expirado'), segunda.headers.location);
});

test('pedido malformado não passa', async () => {
  const semNada = await app.inject({ method: 'POST', url: '/api/auth/social/esperar', payload: {} });
  assert.equal(semNada.statusCode, 400);
  const gigante = await esperar('x'.repeat(500), 'y'.repeat(500));
  assert.equal(gigante.statusCode, 400, 'nem chega a consultar o banco');
});
