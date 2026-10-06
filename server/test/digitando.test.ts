import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// "Fulano está digitando": quando o servidor repassa o aviso, e quando não. O evento em si só chama
// avisoDeDigitacao() e repassa; a decisão inteira mora nela, e é ela que se testa aqui.
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');
const { avisoDeDigitacao } = await import('../src/realtime.js');

const dona = comToken(app, (await criarConta(app, 'dona')).token);
await criarConta(app, 'amiga');
const inicial = (await dona('GET', '/api/communities')).json()[0].id;
const canais = (await dona('GET', `/api/communities/${inicial}/channels`)).json();
const texto = canais.find((c: { type: string }) => c.type === 'text');
const voz = canais.find((c: { type: string }) => c.type === 'voice');

const eu = db.findUserByName('dona')!;
const amiga = db.findUserByName('amiga')!;

test('quem participa da comunidade avisa que está digitando, para a comunidade', () => {
  const aviso = avisoDeDigitacao(eu.id, texto.id, 'online', 1_000_000);
  assert.ok(aviso, 'devia sair o aviso');
  assert.equal(aviso.channelId, texto.id);
  assert.equal(aviso.communityId, inicial);
  assert.equal(aviso.room, `community:${inicial}`);
});

test('um aviso por pessoa e canal a cada 2,5 s: o resto é engolido', () => {
  assert.ok(avisoDeDigitacao(amiga.id, texto.id, 'online', 2_000_000));
  assert.equal(avisoDeDigitacao(amiga.id, texto.id, 'online', 2_001_000), null, 'um segundo depois, nada');
  assert.ok(avisoDeDigitacao(amiga.id, texto.id, 'online', 2_003_000), 'passados 2,5 s, sai de novo');
});

// O caso que justifica a regra: o aviso diria "ela está aqui" de quem escolheu não aparecer.
test('quem está invisível não denuncia que está digitando', () => {
  assert.equal(avisoDeDigitacao(eu.id, texto.id, 'invisivel', 3_000_000), null);
});

test('quem não participa da comunidade não avisa nada', () => {
  const estranho = db.createUserSemSenha('estranho', null);
  assert.equal(avisoDeDigitacao(estranho.id, texto.id, 'online', 4_000_000), null);
});

test('sala de voz e canal que não existe não têm "digitando"', () => {
  assert.equal(avisoDeDigitacao(eu.id, voz.id, 'online', 5_000_000), null);
  assert.equal(avisoDeDigitacao(eu.id, 999_999, 'online', 5_000_000), null);
});

test('na conversa privada, o aviso vai só para a conversa', async () => {
  const conversa = (await dona('POST', '/api/direct', { userIds: [amiga.id] })).json();
  const aviso = avisoDeDigitacao(eu.id, conversa.id, 'online', 6_000_000);
  assert.ok(aviso);
  assert.equal(aviso.communityId, null);
  assert.equal(aviso.room, `dm:${conversa.id}`);
});
