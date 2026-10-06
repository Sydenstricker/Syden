import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { Server as IOServer } from 'socket.io';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// MENSAGENS AGENDADAS E LEMBRETES (ver agendador.ts e agendadas-routes.ts).
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');
const { rodarAgendador, proximaRepeticao, entregarPendentes } = await import('../src/agendador.js');

const publicadas: { evento: string; dados: { content?: string; author?: { app?: boolean } } }[] = [];
const io = { to: () => ({ emit: (evento: string, dados: never) => publicadas.push({ evento, dados }) }), sockets: { sockets: new Map() } } as unknown as IOServer;

const dona = comToken(app, (await criarConta(app, 'dona-agenda')).token);
const membro = comToken(app, (await criarConta(app, 'membro-agenda')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã da agenda' })).json();
await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = (await dona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const geral = canais.find((c) => c.type === 'text')!;
const sala = canais.find((c) => c.type === 'voice')!;
const daqui = (minutos: number) => new Date(Date.now() + minutos * 60_000).toISOString();

test('a repetição pula para a próxima hora no futuro, sem sair várias vezes', () => {
  const venceu = '2026-10-01T09:00:00.000Z';
  const umaSemanaDepois = Date.parse('2026-10-08T10:00:00.000Z');
  assert.equal(proximaRepeticao(venceu, 'diario', umaSemanaDepois), '2026-10-09T09:00:00.000Z');
  assert.equal(proximaRepeticao(venceu, 'semanal', umaSemanaDepois), '2026-10-15T09:00:00.000Z');
});

test('agendar: só quem administra, em canal de texto, no futuro e em até um ano', async () => {
  const url = `/api/communities/${comunidade.id}/agendadas`;
  assert.equal((await membro('POST', url, { channelId: geral.id, texto: 'oi', quando: daqui(10) })).statusCode, 403);
  assert.equal((await dona('POST', url, { channelId: sala.id, texto: 'oi', quando: daqui(10) })).statusCode, 400, 'sala de voz não');
  assert.equal((await dona('POST', url, { channelId: geral.id, texto: 'oi', quando: daqui(-10) })).statusCode, 400, 'passado não');
  assert.equal((await dona('POST', url, { channelId: geral.id, texto: 'oi', quando: daqui(60 * 24 * 400) })).statusCode, 400, 'mais de um ano não');
  assert.equal((await dona('POST', url, { channelId: geral.id, texto: 'oi', quando: daqui(10), repetir: 'mensal' })).statusCode, 400);
  const r = await dona('POST', url, { channelId: geral.id, texto: 'Bom dia, turma!', quando: daqui(10), repetir: 'diario' });
  assert.equal(r.statusCode, 200, r.body);
  await dona('POST', url, { channelId: geral.id, texto: 'Aviso único', quando: daqui(10) });
  assert.equal((await dona('GET', url)).json().length, 2);
});

test('na hora, o Syden publica; a de uma vez some, a diária vai para amanhã', async () => {
  publicadas.length = 0;
  rodarAgendador(io, Date.now() + 11 * 60_000);
  const textos = publicadas.filter((p) => p.evento === 'message:new').map((p) => p.dados.content);
  assert.deepEqual(textos.sort(), ['Aviso único', 'Bom dia, turma!']);
  assert.ok(publicadas.every((p) => p.dados.author?.app === true), 'saem pelo Syden');
  const restantes = (await dona('GET', `/api/communities/${comunidade.id}/agendadas`)).json() as { texto: string; proximaEm: string }[];
  assert.deepEqual(
    restantes.map((a) => a.texto),
    ['Bom dia, turma!'],
  );
  assert.ok(Date.parse(restantes[0].proximaEm) > Date.now() + 23 * 60 * 60_000, 'a próxima é amanhã');
});

test('lembrete: só sobre mensagem que a pessoa vê, nos tempos da lista; quem está fora recebe ao voltar', async () => {
  const mensagem = db.mensagemDoSyden(geral.id, 'Reunião às 20h');
  assert.equal((await membro('POST', '/api/lembretes', { messageId: mensagem.id, minutos: 7 })).statusCode, 400);
  const estranho = comToken(app, (await criarConta(app, 'estranho-agenda')).token);
  assert.equal((await estranho('POST', '/api/lembretes', { messageId: mensagem.id, minutos: 20 })).statusCode, 404, 'quem não vê não lembra');
  assert.equal((await membro('POST', '/api/lembretes', { messageId: mensagem.id, minutos: 20 })).statusCode, 200);
  const membroId = db.findUserByName('membro-agenda')!.id;
  const depois = Date.now() + 21 * 60_000;
  rodarAgendador(io, depois);
  assert.equal(db.lembretesVencidos(new Date(depois).toISOString(), membroId).length, 1, 'fora do ar, o lembrete espera');
  // Na volta (o realtime chama isto ao conectar), sai — mesmo que a hora já tenha passado faz tempo.
  const antes = db.lembretesVencidos(new Date(depois).toISOString(), membroId)[0];
  assert.equal(antes.trecho, 'Reunião às 20h');
  assert.equal(antes.autor, 'Syden', 'o nome do app, e não o guardado');
  // entregarPendentes usa a hora de agora: para o teste, o lembrete é posto como vencido já.
  db.apagarLembrete(antes.id);
  db.criarLembrete(membroId, mensagem.id, new Date(Date.now() - 1000).toISOString());
  entregarPendentes(io, membroId);
  assert.equal(db.lembretesVencidos(new Date().toISOString(), membroId).length, 0, 'entregue e apagado');
});
