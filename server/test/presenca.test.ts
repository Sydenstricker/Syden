import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// Quem vê quem online. A regra é: quem divide comunidade comigo, e quem conversa comigo em privado.
//
// Antes disto a presença era mandada para todo mundo — a lista inteira de quem estava online no Syden
// ia para o navegador de cada pessoa. A tela filtrava antes de desenhar, então nada PARECIA errado; mas
// o nome e o estado de todos estavam ali, ao alcance de quem abrisse as ferramentas do navegador. Entre
// amigos numa comunidade só isso não tinha consequência. Com o cadastro aberto, tem.
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');

const dona = comToken(app, (await criarConta(app, 'dona')).token);
await criarConta(app, 'amiga'); // entra na mesma comunidade, pelo mesmo convite
const inicial = (await dona('GET', '/api/communities')).json()[0].id;

const eu = db.findUserByName('dona')!;
const amiga = db.findUserByName('amiga')!;

test('vejo quem divide comunidade comigo, e a mim mesma', () => {
  const vejo = db.quemVejoOnline(eu.id);
  assert.ok(vejo.has(amiga.id), 'a amiga está na mesma comunidade');
  assert.ok(vejo.has(eu.id));
});

// O caso que motivou tudo: alguém se cadastra pelo cadastro aberto, sem convite, e fica sem comunidade
// nenhuma. Essa pessoa não pode ver a lista de quem está online na comunidade dos amigos.
test('estranho sem comunidade não vê ninguém, e ninguém vê ele', async () => {
  const estranho = db.createUserSemSenha('estranho', null);

  const oQueEleVe = db.quemVejoOnline(estranho.id);
  assert.equal(oQueEleVe.size, 0, 'ele não divide nada com ninguém: ' + [...oQueEleVe].join(', '));
  assert.ok(!db.quemVejoOnline(eu.id).has(estranho.id), 'e ele também não aparece para mim');
});

test('gente de OUTRA comunidade não se vê', async () => {
  const soMinha = (await dona('POST', '/api/communities', { name: 'Só minha' })).json();
  const devora = db.createUserSemSenha('devora', null);
  db.addMember(soMinha.id, devora.id);

  // A dona está nas duas, então vê os dois lados — é esperado.
  assert.ok(db.quemVejoOnline(eu.id).has(devora.id));
  // Mas a amiga, que só está na comunidade inicial, não tem nada a ver com a devora.
  assert.ok(!db.quemVejoOnline(amiga.id).has(devora.id), 'a amiga não divide comunidade com a devora');
  assert.ok(!db.quemVejoOnline(devora.id).has(amiga.id));
});

// Conversa privada só se abre com quem já divide comunidade — o servidor exige isso. Mas ela SOBREVIVE
// à saída da comunidade, e aí o vínculo continua existindo: quem conversa comigo precisa continuar
// vendo se eu estou online, senão a lista de conversas mostraria a pessoa sempre cinza, para sempre.
test('a conversa privada mantém o vínculo mesmo depois de a pessoa sair da comunidade', async () => {
  const solitario = db.createUserSemSenha('solitario', null);
  assert.ok(!db.quemVejoOnline(eu.id).has(solitario.id), 'antes de tudo, nada');

  db.addMember(inicial, solitario.id);
  const conversa = await dona('POST', '/api/direct', { userIds: [solitario.id] });
  assert.equal(conversa.statusCode, 200, conversa.body);

  db.removeMember(inicial, solitario.id);
  assert.ok(db.quemVejoOnline(eu.id).has(solitario.id), 'a conversa continua, e o vínculo com ela');
  assert.ok(db.quemVejoOnline(solitario.id).has(eu.id), 'dos dois lados');
});

test('quem só divide conversa privada não passa a ver a comunidade inteira', () => {
  // A amiga não tem nada com o solitário: nem comunidade (ele saiu), nem conversa.
  const solitario = db.findUserByName('solitario')!;
  assert.ok(!db.quemVejoOnline(amiga.id).has(solitario.id));
  assert.ok(!db.quemVejoOnline(solitario.id).has(amiga.id));
});
