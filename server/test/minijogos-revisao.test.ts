/**
 * A REVISÃO DE 16/10/2026 (os 125 commits que subiram juntos): o chute repetido da Palavra secreta, a rodada que
 * esperava quem saiu da sala, a largada recusada que deixava o convite sem prazo, e o convite de quem foi embora.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { io as conectar, type Socket } from 'socket.io-client';
import type { Contexto } from '../src/minijogo-motor.js';
import { _teste, palavra } from '../src/minijogo-palavra.js';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

test('Palavra secreta: o mesmo chute duas vezes não gasta outra tentativa', () => {
  _teste.palavras = ['termo', 'fazer', 'avião'];
  const ctx: Contexto = { agendar: () => {}, avisar: () => {}, terminar: () => {}, naSala: () => [1], nome: (id) => `p${id}` };
  const jogo = palavra.comecar(ctx, { naSala: [1], criadaPor: 1, corpo: {} });
  _teste.palavras = null;
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'fazer' }), null);
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'FAZER' }), 'Você já chutou essa palavra.');
  assert.equal((jogo.publico(1) as { meu: unknown[] }).meu.length, 1);
});

test('Palavra secreta: quem saiu da sala não segura a rodada de quem já acertou', () => {
  _teste.palavras = ['termo', 'fazer', 'avião'];
  let naSala = [1, 2];
  const ctx: Contexto = { agendar: () => {}, avisar: () => {}, terminar: () => {}, naSala: () => naSala, nome: (id) => `p${id}` };
  const jogo = palavra.comecar(ctx, { naSala, criadaPor: 1, corpo: {} });
  _teste.palavras = null;
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'termo' }), null); // acertou
  assert.equal(jogo.acao(2, { tipo: 'chute', texto: 'fazer' }), null); // ainda chutando
  assert.equal((jogo.publico(1) as { fase: string }).fase, 'chutando');
  naSala = [1]; // o 2 saiu da sala
  jogo.conferir?.();
  assert.equal((jogo.publico(1) as { fase: string }).fase, 'revelando');
});

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

await criarConta(app, 'primeira-revisao'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-revisao');
const contaBia = await criarConta(app, 'bia-revisao');
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma da revisão' })).json();
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
const entrarNaVoz = (s: Socket) => new Promise((ok) => s.emit('voice:join', { channelId: sala.id }, ok));
const socketAna = await ligar(contaAna.token);
await entrarNaVoz(socketAna);
await entrarNaVoz(await ligar(contaBia.token));

test('a largada recusada deixa o convite de pé, com prazo, e a sala não fica presa', async () => {
  // um Stop com letras de menos: o convite aceita, a largada recusa
  assert.equal((await ana('POST', rota, { jogo: 'stop', convidar: true, letras: 'ab' })).statusCode, 200);
  const largada = await ana('POST', `${rota}/largada`);
  assert.equal(largada.statusCode, 400);
  const { _partidas } = await import('../src/minijogos-routes.js');
  const p = _partidas.get(sala.id)!;
  assert.ok(p.convite && p.relogio, 'o convite segue, com o relógio dele');
  assert.ok((await ana('GET', rota)).json().partida.restanteMs > 0);
  assert.equal((await ana('DELETE', rota)).statusCode, 200);
});

test('o convite de quem saiu da sala: a turma pode encerrá-lo ou começar outro jogo', async () => {
  assert.equal((await ana('POST', rota, { jogo: 'tamanho', convidar: true })).statusCode, 200);
  assert.equal((await bia('POST', `${rota}/convite`, { resposta: 'jogar' })).statusCode, 200);
  const convite = (await bia('GET', rota)).json().partida.convite;
  assert.equal(convite.presentes, 2, 'quem aceitou e está na sala');
  socketAna.emit('voice:leave'); // (sem resposta: o servidor só tira da sala)
  await new Promise((ok) => setTimeout(ok, 200));
  assert.equal((await bia('GET', rota)).json().partida.convite.presentes, 1, 'quem saiu não conta para a largada');
  const novo = await bia('POST', rota, { jogo: 'tamanho' });
  assert.equal(novo.statusCode, 200, 'o convite de quem foi embora não segura a sala: ' + novo.body);
  assert.equal(novo.json().partida.criadaPor, contaBia.user.id);
});
