/**
 * Os mini-games da sala de voz (12/10/2026): o "Qual é o tamanho?". Duas pessoas entram na sala pelo socket,
 * uma começa a partida, as duas estimam, e o servidor revela na hora em que todo mundo confirmou.
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

const { OBJETOS, razaoReal, pontosDoPalpite, RODADAS } = await import('../src/minijogos.js');

const contaAdmin = await criarConta(app, 'primeira-minijogo'); // a primeira conta administra o Syden: fica de fora
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

test('a partida: começa, esconde o tamanho e os palpites, revela quando todos confirmam, e conta os pontos', async () => {
  await entrarNaVoz(await ligar(contaAna.token), sala.id);
  await entrarNaVoz(await ligar(contaBia.token), sala.id);

  const inicio = await ana('POST', `/api/channels/${sala.id}/minijogo`, { jogo: 'tamanho' });
  assert.equal(inicio.statusCode, 200);
  const p0 = inicio.json().partida;
  assert.equal(p0.fase, 'estimando');
  assert.equal(p0.rodada, 1);
  assert.equal(p0.rodadas, RODADAS);
  assert.ok(p0.referencia.cm > 0, 'a referência vem com o tamanho');
  assert.equal(p0.objeto.cm, undefined, 'o tamanho do objeto só aparece na revelação');
  assert.ok(p0.objeto.medida, 'o que se mede no objeto se sabe desde o começo');
  assert.equal(p0.placar.length, 2, 'quem está na sala começa no placar');

  assert.equal((await bia('POST', `/api/channels/${sala.id}/minijogo`, { jogo: 'tamanho' })).statusCode, 409, 'uma partida por sala');

  const real = razaoReal([p0.referencia.id, p0.objeto.id]);
  assert.equal(real, OBJETOS[p0.objeto.id].cm / OBJETOS[p0.referencia.id].cm);
  const acao = `/api/channels/${sala.id}/minijogo/acao`;

  // A Ana mexe sem confirmar: o palpite fica guardado, e ninguém fica sabendo.
  const mexendo = (await ana('POST', acao, { tipo: 'palpite', razao: 1 })).json().partida;
  assert.equal(mexendo.meuPalpite, 1);
  assert.deepEqual(mexendo.confirmaram, []);
  assert.equal((await bia('GET', `/api/channels/${sala.id}/minijogo`)).json().partida.meuPalpite, null, 'o palpite da Ana não aparece para a Bia');
  assert.equal((await ana('POST', acao, { tipo: 'palpite', razao: 'muito' })).statusCode, 409);

  const conf = (await ana('POST', acao, { tipo: 'palpite', razao: real, confirmar: true })).json().partida;
  assert.equal(conf.fase, 'estimando', 'falta a Bia');
  assert.deepEqual(conf.confirmaram, [contaAna.user.id]);
  assert.equal(conf.palpites, null, 'os palpites ficam escondidos até a revelação');

  const revelado = (await bia('POST', acao, { tipo: 'palpite', razao: real * 2, confirmar: true })).json().partida;
  assert.equal(revelado.fase, 'revelando', 'todo mundo confirmou: revela na hora');
  assert.equal(revelado.real, real);
  assert.ok(revelado.objeto.cm > 0, 'o tamanho aparece');
  assert.equal(revelado.palpites.length, 2);
  const placar = Object.fromEntries(revelado.placar.map((l: { username: string; pontos: number }) => [l.username, l.pontos]));
  assert.deepEqual(placar, { 'ana-minijogo': 100, 'bia-minijogo': 50 }, 'na mosca vale 100; errar pelo dobro, 50');

  assert.equal((await ana('POST', acao, { tipo: 'palpite', razao: 1, confirmar: true })).statusCode, 409, 'depois da revelação não se mexe');
});

test('os pontos: o erro é em proporção, para cima e para baixo', async () => {
  assert.equal(pontosDoPalpite(3, 3), 100);
  assert.equal(pontosDoPalpite(6, 3), 50);
  assert.equal(pontosDoPalpite(1.5, 3), 50, 'metade erra tanto quanto o dobro');
  assert.equal(pontosDoPalpite(12, 3), 0);
  assert.equal(pontosDoPalpite(100, 3), 0, 'nunca negativo');
});

test('quem não começou não encerra no meio; quem começou, sim', async () => {
  assert.equal((await bia('DELETE', `/api/channels/${sala.id}/minijogo`)).statusCode, 403);
  assert.equal((await ana('DELETE', `/api/channels/${sala.id}/minijogo`)).statusCode, 200);
  assert.equal((await ana('GET', `/api/channels/${sala.id}/minijogo`)).json().partida, null);
});

test('o painel de uso conta a partida: o jogo, com quantos, e que foi encerrada no meio', async () => {
  assert.equal((await ana('GET', '/api/status/jogos')).statusCode, 403, 'só quem administra o Syden vê');
  const admin = comToken(app, contaAdmin.token);
  const { jogos } = (await admin('GET', '/api/status/jogos?dias=7')).json();
  const tamanho = jogos.find((j: { jogo: string }) => j.jogo === 'tamanho');
  assert.equal(tamanho.partidas, 1);
  assert.equal(tamanho.completas, 0, 'a Ana encerrou antes do placar');
  assert.equal(tamanho.pessoas, 2);
  assert.equal(tamanho.mediaDeJogadores, 2);
  assert.equal(tamanho.comunidades, 1);
});

test('o sorteio nunca dá empate nem diferença absurda', async () => {
  const { sortearPar } = await import('../src/minijogos.js');
  for (let i = 0; i < 200; i++) {
    const [a, b] = sortearPar(new Set());
    const razao = Math.max(OBJETOS[a].cm, OBJETOS[b].cm) / Math.min(OBJETOS[a].cm, OBJETOS[b].cm);
    assert.ok(razao >= 1.5 && razao <= 20, `${a} × ${b}: ${razao}`);
  }
});
