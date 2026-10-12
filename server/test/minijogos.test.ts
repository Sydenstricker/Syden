/**
 * Os mini-games da sala de voz (12/10/2026): o "Qual é maior?". Duas pessoas entram na sala pelo socket, uma
 * começa a partida, as duas votam, e o servidor revela na hora em que todo mundo votou.
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
  const { _partidas } = await import('../src/minijogos-routes.js');
  for (const p of _partidas.values()) if (p.relogio) clearTimeout(p.relogio);
  await fechar();
});

const { OBJETOS, maior, RODADAS } = await import('../src/minijogos.js');

await criarConta(app, 'primeira-minijogo'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-minijogo');
const contaBia = await criarConta(app, 'bia-minijogo');
const contaCaio = await criarConta(app, 'caio-minijogo');
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const caio = comToken(app, contaCaio.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma do jogo' })).json();
for (const pessoa of [bia, caio]) await pessoa('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = (await ana('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const sala = canais.find((c) => c.type === 'voice')!;

const ligar = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => ok(s));
  });
const entrarNaVoz = (s: Socket, channelId: number) => new Promise((ok) => s.emit('voice:join', { channelId }, ok));

test('quem não está na sala de voz não começa nem vota', async () => {
  const r = await caio('POST', `/api/channels/${sala.id}/minijogo`, { jogo: 'tamanho' });
  assert.equal(r.statusCode, 403);
});

test('a partida: começa, esconde os votos, revela quando todos votam, e conta os pontos', async () => {
  await entrarNaVoz(await ligar(contaAna.token), sala.id);
  await entrarNaVoz(await ligar(contaBia.token), sala.id);

  const inicio = await ana('POST', `/api/channels/${sala.id}/minijogo`, { jogo: 'tamanho' });
  assert.equal(inicio.statusCode, 200);
  const p0 = inicio.json().partida;
  assert.equal(p0.fase, 'votando');
  assert.equal(p0.rodada, 1);
  assert.equal(p0.rodadas, RODADAS);
  assert.equal(p0.par.length, 2);
  assert.equal(p0.par[0].cm, undefined, 'o tamanho só aparece na revelação');
  assert.equal(p0.placar.length, 2, 'quem está na sala começa no placar');

  assert.equal((await bia('POST', `/api/channels/${sala.id}/minijogo`, { jogo: 'tamanho' })).statusCode, 409, 'uma partida por sala');

  const par = p0.par.map((o: { id: string }) => o.id) as [string, string];
  const certo = maior(par);
  assert.ok(OBJETOS[par[0]].cm !== OBJETOS[par[1]].cm);

  const voto1 = (await ana('POST', `/api/channels/${sala.id}/minijogo/voto`, { escolha: certo })).json().partida;
  assert.equal(voto1.fase, 'votando', 'falta a Bia');
  assert.deepEqual(voto1.votaram, [contaAna.user.id]);
  assert.equal(voto1.votos, null, 'o voto da Ana fica escondido até a revelação');

  const revelado = (await bia('POST', `/api/channels/${sala.id}/minijogo/voto`, { escolha: certo === 0 ? 1 : 0 })).json().partida;
  assert.equal(revelado.fase, 'revelando', 'todo mundo votou: revela na hora');
  assert.equal(revelado.certo, certo);
  assert.ok(revelado.par[0].cm > 0, 'os tamanhos aparecem');
  const placar = Object.fromEntries(revelado.placar.map((l: { username: string; pontos: number }) => [l.username, l.pontos]));
  assert.deepEqual(placar, { 'ana-minijogo': 1, 'bia-minijogo': 0 });

  assert.equal((await ana('POST', `/api/channels/${sala.id}/minijogo/voto`, { escolha: 0 })).statusCode, 409, 'depois da revelação não se vota');
});

test('quem não começou não encerra no meio; quem começou, sim', async () => {
  assert.equal((await bia('DELETE', `/api/channels/${sala.id}/minijogo`)).statusCode, 403);
  assert.equal((await ana('DELETE', `/api/channels/${sala.id}/minijogo`)).statusCode, 200);
  assert.equal((await ana('GET', `/api/channels/${sala.id}/minijogo`)).json().partida, null);
});

test('o sorteio nunca dá empate nem diferença absurda', async () => {
  const { sortearPar } = await import('../src/minijogos.js');
  for (let i = 0; i < 200; i++) {
    const [a, b] = sortearPar(new Set());
    const razao = Math.max(OBJETOS[a].cm, OBJETOS[b].cm) / Math.min(OBJETOS[a].cm, OBJETOS[b].cm);
    assert.ok(razao >= 1.3 && razao <= 12, `${a} × ${b}: ${razao}`);
  }
});
