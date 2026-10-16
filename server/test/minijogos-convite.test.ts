/**
 * O CONVITE DOS MINI-GAMES (13/10/2026). Com três pessoas transmitindo outro jogo na sala, começar o Stop fazia
 * todas virarem jogadoras e a rodada esperar o "pronto" delas para sempre. Agora quem começa convida, cada um responde,
 * e só quem aceitou joga: o Caio fica na sala, sem jogar, e a rodada não espera por ele.
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

const { OBJETOS, razaoReal } = await import('../src/minijogos.js');

await criarConta(app, 'primeira-convite'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-convite');
const contaBia = await criarConta(app, 'bia-convite');
const contaCaio = await criarConta(app, 'caio-convite');
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const caio = comToken(app, contaCaio.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma do convite' })).json();
for (const pessoa of [bia, caio]) await pessoa('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = (await ana('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const sala = canais.find((c) => c.type === 'voice')!;
const rota = `/api/channels/${sala.id}/minijogo`;

const ligar = (token: string) =>
  new Promise<Socket>((ok) => {
    const s = conectar(endereco, { auth: { token }, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => ok(s));
  });
const entrarNaVoz = (s: Socket, channelId: number) => new Promise((ok) => s.emit('voice:join', { channelId }, ok));
for (const conta of [contaAna, contaBia, contaCaio]) await entrarNaVoz(await ligar(conta.token), sala.id);

const nomes = (lista: { username: string }[]) => lista.map((p) => p.username).sort();

test('o convite: ninguém joga antes da largada, e cada um responde', async () => {
  const p0 = (await ana('POST', rota, { jogo: 'tamanho', convidar: true })).json().partida;
  assert.deepEqual(p0.convite, { minimo: 1, presentes: 1 });
  assert.deepEqual(nomes(p0.jogadores), ['ana-convite'], 'quem convida já está dentro');
  assert.equal(p0.souJogador, true);
  assert.equal(p0.rodada, undefined, 'o jogo ainda não começou');

  const daBia = (await bia('GET', rota)).json().partida;
  assert.equal(daBia.souJogador, false, 'a Bia ainda não respondeu');
  assert.equal(daBia.recusei, false);
  assert.equal((await bia('POST', `${rota}/acao`, { tipo: 'palpite', razao: 1 })).statusCode, 409, 'antes da largada não se joga');
  assert.equal((await bia('POST', `${rota}/largada`)).statusCode, 403, 'só quem começou dá a largada');

  const jogando = (await bia('POST', `${rota}/convite`, { resposta: 'jogar' })).json().partida;
  assert.equal(jogando.souJogador, true);
  const recusou = (await caio('POST', `${rota}/convite`, { resposta: 'agora-nao' })).json().partida;
  assert.equal(recusou.recusei, true);
  assert.equal(recusou.souJogador, false);
  assert.deepEqual(nomes(recusou.recusaram), ['caio-convite'], 'quem começou vê quem não vai jogar');
  assert.equal((await caio('POST', `${rota}/convite`, { resposta: 'talvez' })).statusCode, 400);
});

test('a largada: só quem aceitou joga, e a rodada não espera quem está na sala sem jogar', async () => {
  const p = (await ana('POST', `${rota}/largada`)).json().partida;
  assert.equal(p.convite, null);
  assert.equal(p.fase, 'estimando');
  assert.equal(p.placar.length, 2, 'o Caio, que disse "agora não", não entra no placar');
  assert.equal((await ana('POST', `${rota}/largada`)).statusCode, 409, 'não se dá a largada duas vezes');
  assert.equal((await caio('POST', `${rota}/acao`, { tipo: 'palpite', razao: 1 })).statusCode, 403, 'o Caio assiste');
  assert.equal((await caio('POST', `${rota}/convite`, { resposta: 'jogar' })).statusCode, 409, 'depois da largada não se entra');

  const real = razaoReal([p.referencia.id, p.objeto.id]);
  assert.equal(real, OBJETOS[p.objeto.id].cm / OBJETOS[p.referencia.id].cm);
  await ana('POST', `${rota}/acao`, { tipo: 'palpite', razao: real, confirmar: true });
  const revelado = (await bia('POST', `${rota}/acao`, { tipo: 'palpite', razao: real, confirmar: true })).json().partida;
  assert.equal(revelado.fase, 'revelando', 'os dois jogadores confirmaram: revela sem esperar o Caio');

  assert.equal((await caio('GET', rota)).json().partida.fase, 'revelando', 'quem assiste vê a partida');
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});

test('o mínimo: o Lobisomem não larga com menos de 4 jogadores', async () => {
  const p = (await ana('POST', rota, { jogo: 'lobisomem', convidar: true })).json().partida;
  assert.deepEqual(p.convite, { minimo: 4, presentes: 1 });
  await bia('POST', `${rota}/convite`, { resposta: 'jogar' });
  await caio('POST', `${rota}/convite`, { resposta: 'jogar' });
  assert.equal((await ana('POST', `${rota}/largada`)).statusCode, 409, 'três não bastam');
  assert.ok((await ana('GET', rota)).json().partida.convite, 'o convite continua de pé');
  // Sair antes da largada tira da lista; quem começou não sai do próprio convite.
  const saiu = (await caio('POST', `${rota}/convite`, { resposta: 'sair' })).json().partida;
  assert.deepEqual(nomes(saiu.jogadores), ['ana-convite', 'bia-convite']);
  await ana('POST', `${rota}/convite`, { resposta: 'sair' });
  assert.ok(nomes((await ana('GET', rota)).json().partida.jogadores).includes('ana-convite'));
  assert.equal((await ana('DELETE', rota)).statusCode, 200, 'quem começou cancela o convite');
});

test('a mesa: começa na hora, e sentar é aceitar', async () => {
  const p = (await ana('POST', rota, { jogo: 'gomoku', convidar: true })).json().partida;
  assert.equal(p.convite, null, 'a mesa já é o convite');
  assert.equal(p.fase, 'esperando');
  assert.equal((await bia('GET', rota)).json().partida.souJogador, false);
  const sentou = (await bia('POST', `${rota}/acao`, { tipo: 'sentar' })).json().partida;
  assert.equal(sentou.souJogador, true);
  assert.equal(sentou.fase, 'jogando');
  const caioAgoraNao = (await caio('POST', `${rota}/convite`, { resposta: 'agora-nao' })).json().partida;
  assert.equal(caioAgoraNao.recusei, true, 'recusar vale também na mesa');
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});

test('sem convidar (o site de antes do convite), a sala inteira joga, como sempre foi', async () => {
  const p = (await ana('POST', rota, { jogo: 'tamanho' })).json().partida;
  assert.equal(p.convite, null);
  assert.equal(p.jogadores, null);
  assert.equal(p.placar.length, 3);
  assert.equal((await caio('GET', rota)).json().partida.souJogador, true);
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});
