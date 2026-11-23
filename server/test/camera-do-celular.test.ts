/**
 * O CELULAR COMO CÂMERA (camera-do-celular.ts): o servidor emite o par e só repassa o aperto de mão entre o computador
 * que o abriu e UM celular. Aqui se confere que o token vale uma vez, que ninguém entra sem ele, que as mensagens vão só
 * entre os dois, e que fechar de um lado solta o outro.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { io as conectar, type Socket } from 'socket.io-client';
import { criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
// Só depois do servidor de teste: importar o módulo antes abriria o banco de desenvolvimento (ver ajuda.ts).
const { paresAbertos } = await import('../src/camera-do-celular.js');
await app.listen({ port: 0, host: '127.0.0.1' });
const endereco = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
const sockets: Socket[] = [];
after(async () => {
  for (const s of sockets) s.disconnect();
  await fechar();
});

await criarConta(app, 'primeira-cel');
const contaAna = await criarConta(app, 'ana-cel');
const contaBia = await criarConta(app, 'bia-cel');

const ligar = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => ok(s));
  });
/** O celular: conecta no /celular com o par; resolve com o socket ou com o erro da recusa. */
const celular = (auth: { id: string; token: string }) =>
  new Promise<Socket | Error>((ok) => {
    const s = conectar(`${endereco}/celular`, { auth, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.on('connect', () => ok(s));
    s.on('connect_error', (e) => ok(e));
  });
const abrir = (s: Socket) => new Promise<{ id: string; token: string }>((ok) => s.emit('celular:abrir', null, ok));
const esperar = (ms = 150) => new Promise((ok) => setTimeout(ok, ms));

const daAna = await ligar(contaAna.token);
const daBia = await ligar(contaBia.token);

test('sem o par certo, o celular não entra', async () => {
  const par = await abrir(daAna);
  assert.ok(par.id && par.token);
  assert.ok((await celular({ id: par.id, token: 'errado' })) instanceof Error);
  assert.ok((await celular({ id: 'inventado', token: par.token })) instanceof Error);
});

test('o celular entra uma vez, e o aperto de mão vai só entre ele e o computador que abriu', async () => {
  const par = await abrir(daAna);
  const chegou: unknown[] = [];
  const naAna: string[] = [];
  const naBia: string[] = [];
  daAna.on('celular:chegou', (x) => chegou.push(x));
  daAna.on('celular:sinal', ({ dados }) => naAna.push(dados));
  daBia.on('celular:sinal', ({ dados }) => naBia.push(dados));

  const cel = await celular(par);
  assert.ok(!(cel instanceof Error));
  // O mesmo token de novo: recusado (outro celular não toma o lugar).
  assert.ok((await celular(par)) instanceof Error);
  await esperar();
  assert.equal(chegou.length, 1);

  const noCelular: string[] = [];
  (cel as Socket).on('sinal', (d) => noCelular.push(d));
  (cel as Socket).emit('sinal', 'oferta');
  daAna.emit('celular:sinal', { id: par.id, dados: 'resposta' });
  // A Bia tenta falar com o celular da Ana: não chega.
  daBia.emit('celular:sinal', { id: par.id, dados: 'intrusa' });
  await esperar();
  assert.deepEqual(naAna, ['oferta']);
  assert.deepEqual(naBia, []);
  assert.deepEqual(noCelular, ['resposta']);

  // Mensagem grande demais não passa.
  (cel as Socket).emit('sinal', 'x'.repeat(20_000));
  await esperar();
  assert.deepEqual(naAna, ['oferta']);
});

test('o computador fecha: o celular cai e o par some', async () => {
  const par = await abrir(daAna);
  const cel = (await celular(par)) as Socket;
  const caiu = new Promise((ok) => cel.on('disconnect', ok));
  daAna.emit('celular:fechar', { id: par.id });
  await caiu;
  await esperar();
  assert.ok((await celular(par)) instanceof Error);
});

test('o celular sai: o computador fica sabendo', async () => {
  const par = await abrir(daAna);
  const saiu = new Promise<{ id: string }>((ok) => daAna.once('celular:saiu', ok));
  const cel = (await celular(par)) as Socket;
  await esperar();
  cel.disconnect();
  assert.equal((await saiu).id, par.id);
});

test('abrir outro código fecha o anterior: um par por pessoa', async () => {
  await abrir(daAna);
  await abrir(daAna);
  await esperar();
  assert.equal(paresAbertos(), 1);
});
