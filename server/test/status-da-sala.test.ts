/**
 * O STATUS DA SALA DE VOZ (23/11/2026): quem está na sala, ou quem administra, escreve uma linha embaixo do nome dela; a
 * moderação da comunidade vale; e ele some sozinho quando a última pessoa sai. Pelo socket de verdade.
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

const db = await import('../src/db.js');

await criarConta(app, 'primeira-status'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-status'); // dona da comunidade
const contaBia = await criarConta(app, 'bia-status');
const contaCaio = await criarConta(app, 'caio-status');
const ana = comToken(app, contaAna.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma do status' })).json();
for (const conta of [contaBia, contaCaio]) {
  await comToken(app, conta.token)('POST', '/api/communities/join', { code: comunidade.inviteCode });
}
const canais = (await ana('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const sala = canais.find((c) => c.type === 'voice')!;

/** O último status que cada socket viu, pelo voice:state da comunidade (ouvido antes de conectar: o primeiro vem na hora). */
const vistos = new Map<Socket, Record<number, string>>();
const online = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('voice:state', (e: { communityId: number; statusDasSalas?: Record<number, string> }) => {
      if (e.communityId === comunidade.id) vistos.set(s, e.statusDasSalas ?? {});
    });
    s.on('connect', () => ok(s));
  });
type Resposta = { ok: boolean; error?: string };
const definir = (s: Socket, texto: string, channelId = sala.id) =>
  new Promise<Resposta>((ok) => s.emit('voice:status', { channelId, texto }, ok));
const entrar = (s: Socket) => new Promise((ok) => s.emit('voice:join', { channelId: sala.id }, ok));
const esperar = (ms = 150) => new Promise((ok) => setTimeout(ok, ms));


const daAna = await online(contaAna.token);
const daBia = await online(contaBia.token);
const doCaio = await online(contaCaio.token);

test('com a sala vazia, ninguém põe status (nem quem administra)', async () => {
  assert.equal((await definir(daBia, 'ranqueada')).ok, false);
  const r = await definir(daAna, 'ranqueada');
  assert.equal(r.ok, false);
  assert.match(r.error!, /vazia/);
});

test('quem está na sala põe o status, e a comunidade inteira vê', async () => {
  await entrar(daBia);
  const r = await definir(daBia, '  ranqueada,\n não chamar 🎮 ');
  assert.equal(r.ok, true);
  await esperar();
  assert.equal(vistos.get(doCaio)?.[sala.id], 'ranqueada, não chamar 🎮');
  assert.equal(vistos.get(daAna)?.[sala.id], 'ranqueada, não chamar 🎮');
});

test('quem chega depois recebe o status junto com quem está na sala', async () => {
  const outro = await online(contaCaio.token);
  await esperar();
  assert.equal(vistos.get(outro)?.[sala.id], 'ranqueada, não chamar 🎮');
  outro.disconnect();
});

test('quem não está na sala e não administra não muda', async () => {
  const r = await definir(doCaio, 'invadindo');
  assert.equal(r.ok, false);
  assert.match(r.error!, /Só quem está na sala/);
});

test('uma mudança a cada 3 s por pessoa', async () => {
  const r = await definir(daBia, 'outra coisa');
  assert.equal(r.ok, false);
  assert.match(r.error!, /Espere/);
});

test('mais de 60 caracteres não entra', async () => {
  const r = await definir(doCaio, 'x'.repeat(61));
  assert.equal(r.ok, false);
});

test('a moderação da comunidade vale: palavra proibida e link', async () => {
  db.definirRegrasDeModeracao(comunidade.id, { palavras: ['proibida'], links: true, flood: false });
  await entrar(doCaio);
  const palavra = await definir(doCaio, 'uma Proibída aqui');
  assert.equal(palavra.ok, false);
  assert.match(palavra.error!, /palavras/);
  const link = await definir(doCaio, 'vem: www.exemplo.com');
  assert.equal(link.ok, false);
  assert.match(link.error!, /links/);
  db.definirRegrasDeModeracao(comunidade.id, { palavras: [], links: false, flood: false });
});

test('quem administra muda o status mesmo fora da sala, e o texto vazio tira', async () => {
  assert.equal((await definir(daAna, 'aula às 20h')).ok, true);
  await esperar();
  assert.equal(vistos.get(doCaio)?.[sala.id], 'aula às 20h');
  await esperar(3100);
  assert.equal((await definir(daAna, '')).ok, true);
  await esperar();
  assert.equal(vistos.get(doCaio)?.[sala.id], undefined);
});

test('o status some sozinho quando a última pessoa sai', async () => {
  assert.equal((await definir(daBia, 'jogando')).ok, true);
  daBia.emit('voice:leave');
  await esperar();
  assert.equal(vistos.get(daAna)?.[sala.id], 'jogando', 'ainda tem gente na sala');
  doCaio.emit('voice:leave');
  await esperar();
  assert.equal(vistos.get(daAna)?.[sala.id], undefined, 'a sala esvaziou');
});

test('sala de texto não tem status', async () => {
  const texto = canais.find((c) => c.type === 'text')!;
  assert.equal((await definir(daAna, 'oi', texto.id)).ok, false);
});
