/**
 * O desenha e adivinha (12/10/2026): quem desenha escolhe a palavra e risca; o traço chega aos outros pelo
 * socket, NA HORA; os chutes são conferidos sem acento nem maiúscula; o "quase!" só aparece para quem chutou.
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

await criarConta(app, 'primeira-desenho'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-desenho');
const contaBia = await criarConta(app, 'bia-desenho');
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma do desenho' })).json();
await bia('POST', '/api/communities/join', { code: comunidade.inviteCode });
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

test('desenho: sozinho não dá; a dois, quem desenha escolhe, risca, e os chutes são conferidos', async () => {
  const socketAna = await ligar(contaAna.token);
  await entrarNaVoz(socketAna, sala.id);
  assert.equal((await ana('POST', rota, { jogo: 'desenho' })).statusCode, 400, 'sozinho não tem para quem desenhar');
  const socketBia = await ligar(contaBia.token);
  await entrarNaVoz(socketBia, sala.id);

  const p0 = (await ana('POST', rota, { jogo: 'desenho' })).json().partida;
  assert.equal(p0.fase, 'escolhendo');
  const [desenha, chuta] = p0.quemDesenha === contaAna.user.id ? [ana, bia] : [bia, ana];
  const [socketDesenha, socketChuta] = p0.quemDesenha === contaAna.user.id ? [socketAna, socketBia] : [socketBia, socketAna];
  const daVez = (await desenha('GET', rota)).json().partida;
  assert.equal(daVez.opcoes.length, 3);
  assert.equal((await chuta('GET', rota)).json().partida.opcoes, null, 'as opções são só de quem desenha');

  const escolhida = (await desenha('POST', `${rota}/acao`, { tipo: 'escolher', id: daVez.opcoes[0], texto: 'Água-viva' })).json().partida;
  assert.equal(escolhida.fase, 'desenhando');
  const paraQuemChuta = (await chuta('GET', rota)).json().partida;
  assert.equal(paraQuemChuta.palavra, null, 'quem chuta não vê a palavra');
  assert.deepEqual(paraQuemChuta.mascara, ['_', '_', '_', '_', '_', '_', '_', '_', '_'], 'só o tamanho (o hífen também esconde)');

  // O traço chega a quem chuta pelo socket, na hora.
  const chegou = new Promise((ok) => socketChuta.once('minijogo:tempo-real', ok));
  socketDesenha.emit('minijogo:tempo-real', { channelId: sala.id, dados: { t: 1, i: 0, c: 0, e: 1, p: [10, 20, 30, 40] } });
  const recebido = (await chegou) as { dados: { p: number[] } };
  assert.deepEqual(recebido.dados.p, [10, 20, 30, 40]);
  // Quem chuta não desenha: o traço dela é descartado.
  socketChuta.emit('minijogo:tempo-real', { channelId: sala.id, dados: { t: 2, i: 0, c: 0, e: 1, p: [1, 1] } });
  await new Promise((ok) => setTimeout(ok, 100));
  const comTraco = (await chuta('GET', rota)).json().partida;
  assert.equal(comTraco.tracos.length, 1, 'o servidor guarda o traço de quem desenha, e só ele');

  await chuta('POST', `${rota}/acao`, { tipo: 'chute', texto: 'polvo' });
  await chuta('POST', `${rota}/acao`, { tipo: 'chute', texto: 'agua vivo' });
  const vistoPorQuemDesenha = (await desenha('GET', rota)).json().partida;
  assert.deepEqual(vistoPorQuemDesenha.chutes.map((c: { texto: string }) => c.texto), ['polvo'], 'o "quase" não aparece para os outros');
  const vistoPorQuemChuta = (await chuta('GET', rota)).json().partida;
  assert.equal(vistoPorQuemChuta.chutes[1].perto, true);

  const certo = (await chuta('POST', `${rota}/acao`, { tipo: 'chute', texto: 'AGUA-VIVA' })).json().partida;
  assert.equal(certo.fase, 'revelando', 'todo mundo acertou: revela na hora');
  assert.equal(certo.palavra.texto, 'Água-viva');
  const pontos = Object.fromEntries(certo.placar.map((l: { userId: number; pontos: number }) => [l.userId, l.pontos]));
  assert.equal(pontos[p0.quemDesenha], 25, 'quem desenha ganha pelo acerto');
  const quemChuta = p0.quemDesenha === contaAna.user.id ? contaBia.user.id : contaAna.user.id;
  assert.ok(pontos[quemChuta] >= 90, 'acertou logo: quase os 100');
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});

test('desenho: a tradução com "|" traz formas que também valem ("Computadora|Ordenador")', async () => {
  const p0 = (await ana('POST', rota, { jogo: 'desenho' })).json().partida;
  const [desenha, chuta] = p0.quemDesenha === contaAna.user.id ? [ana, bia] : [bia, ana];
  const opcoes = (await desenha('GET', rota)).json().partida.opcoes;
  await desenha('POST', `${rota}/acao`, { tipo: 'escolher', id: opcoes[0], texto: 'Computadora|Ordenador' });
  const visto = (await chuta('GET', rota)).json().partida;
  assert.equal(visto.mascara.length, 'Computadora'.length, 'a máscara é da primeira forma');
  const certo = (await chuta('POST', `${rota}/acao`, { tipo: 'chute', texto: 'ORDENADOR' })).json().partida;
  assert.equal(certo.fase, 'revelando', 'a segunda forma também vale');
  assert.equal(certo.palavra.texto, 'Computadora');
  assert.deepEqual(certo.palavra.outras, ['Ordenador']);
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});
