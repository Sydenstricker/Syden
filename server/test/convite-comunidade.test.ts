/**
 * O LINK DE CONVITE (09/11/2026, dois relatos): (1) abrir o link mostra a comunidade e PERGUNTA antes de entrar — a
 * prévia não põe ninguém nela; (2) entrar por uma aba (o navegador) avisa as outras sessões da mesma pessoa (o app
 * aberto) para relerem a lista de comunidades, que antes só aparecia fechando e abrindo o app.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { io as conectar, type Socket } from 'socket.io-client';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
await app.listen({ port: 0, host: '127.0.0.1' });
const endereco = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
const sockets: Socket[] = [];
after(async () => {
  for (const s of sockets) s.disconnect();
  await fechar();
});

await criarConta(app, 'primeira-convite'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-convite');
const contaBia = await criarConta(app, 'bia-convite');
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma do convite' })).json();

const ligar = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => ok(s));
  });
const esperar = () => new Promise((ok) => setTimeout(ok, 150));

test('a prévia mostra a comunidade sem pôr ninguém nela', async () => {
  const resposta = await bia('GET', `/api/convite/${comunidade.inviteCode}`);
  assert.equal(resposta.statusCode, 200);
  const previa = resposta.json();
  assert.equal(previa.id, comunidade.id);
  assert.equal(previa.name, 'Turma do convite');
  assert.equal(previa.membros, 1);
  assert.equal(previa.jaParticipa, false);
  const minhas = (await bia('GET', '/api/communities')).json() as { id: number }[];
  assert.ok(!minhas.some((c) => c.id === comunidade.id), 'ver o convite não é entrar');
});

test('código que não existe dá 404', async () => {
  assert.equal((await bia('GET', '/api/convite/nao-existe-mesmo')).statusCode, 404);
});

test('entrar por uma sessão avisa as outras da mesma pessoa, e só elas', async () => {
  const doApp = await ligar(contaBia.token);
  const daAna = await ligar(contaAna.token);
  const avisosDaBia: { id: number }[] = [];
  const avisosDaAna: { id: number }[] = [];
  doApp.on('comunidades:mudou', (d) => avisosDaBia.push(d));
  daAna.on('comunidades:mudou', (d) => avisosDaAna.push(d));

  assert.equal((await bia('POST', '/api/communities/join', { code: comunidade.inviteCode })).statusCode, 200);
  await esperar();
  assert.deepEqual(avisosDaBia, [{ id: comunidade.id }]);
  assert.equal(avisosDaAna.length, 0, 'a dona já participava: a lista dela não muda');

  const previa = (await bia('GET', `/api/convite/${comunidade.inviteCode}`)).json();
  assert.equal(previa.jaParticipa, true);
  assert.equal(previa.membros, 2);
});
