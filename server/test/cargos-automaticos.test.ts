/**
 * Cargos automáticos (pacote MEE6, 12/10/2026): o cargo de quem entra e o painel de cargo por reação.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

await criarConta(app, 'primeira-cauto'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-cauto');
const contaBia = await criarConta(app, 'bia-cauto');
const contaCaio = await criarConta(app, 'caio-cauto');
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const caio = comToken(app, contaCaio.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma dos cargos' })).json();
const artista = (await ana('POST', `/api/communities/${comunidade.id}/cargos`, { nome: 'Artista', cor: '#e5484d' })).json();
const jogador = (await ana('POST', `/api/communities/${comunidade.id}/cargos`, { nome: 'Jogador', cor: '#4f7df5' })).json();
const canais = (await ana('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string; name: string }[];
const geral = canais.find((c) => c.type === 'text')!;
const cargosDe = async (userId: number) =>
  ((await ana('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; cargos: number[] }[]).find((m) => m.id === userId)?.cargos ?? [];

test('cargo de quem entra: quem administra escolhe, e a pessoa nova já chega com ele', async () => {
  assert.equal((await caio('PUT', `/api/communities/${comunidade.id}/cargos-de-entrada`, { cargoIds: [artista.id] })).statusCode, 404, 'quem não é da comunidade não mexe');
  const r = (await ana('PUT', `/api/communities/${comunidade.id}/cargos-de-entrada`, { cargoIds: [artista.id, 9999] })).json();
  assert.deepEqual(r.deEntrada, [artista.id], 'cargo que não existe é ignorado');
  await bia('POST', '/api/communities/join', { code: comunidade.inviteCode });
  assert.deepEqual(await cargosDe(contaBia.user.id), [artista.id]);
  assert.equal((await bia('GET', `/api/communities/${comunidade.id}/cargos-automaticos`)).statusCode, 403, 'só quem administra vê a configuração');
});

test('cargo por reação: o Syden publica o painel com a legenda, reagir dá o cargo e tirar a reação tira', async () => {
  const errado = await ana('POST', `/api/communities/${comunidade.id}/paineis-de-cargo`, {
    channelId: geral.id,
    texto: 'Escolha',
    opcoes: [{ emoji: 'abc', cargoId: jogador.id }],
  });
  assert.equal(errado.statusCode, 400, 'texto não é emoji');

  const { paineis } = (
    await ana('POST', `/api/communities/${comunidade.id}/paineis-de-cargo`, {
      channelId: geral.id,
      texto: 'Escolha os seus cargos:',
      opcoes: [{ emoji: '🎮', cargoId: jogador.id }],
    })
  ).json();
  assert.equal(paineis.length, 1);
  const mensagens = (await bia('GET', `/api/channels/${geral.id}/messages`)).json() as { id: number; content: string; reactions?: { emoji: string }[] }[];
  const painel = mensagens.find((m) => m.id === paineis[0].messageId)!;
  assert.ok(painel.content.includes('🎮 — Jogador'), 'a legenda diz o que cada emoji dá');

  await bia('POST', `/api/messages/${painel.id}/reactions`, { emoji: '🎮' });
  assert.deepEqual((await cargosDe(contaBia.user.id)).sort(), [artista.id, jogador.id].sort());
  await bia('POST', `/api/messages/${painel.id}/reactions`, { emoji: '🎮' });
  assert.deepEqual(await cargosDe(contaBia.user.id), [artista.id], 'tirou a reação, perdeu o cargo');

  await bia('POST', `/api/messages/${painel.id}/reactions`, { emoji: '😀' });
  assert.deepEqual(await cargosDe(contaBia.user.id), [artista.id], 'emoji que não está no painel não dá nada');

  const depois = (await ana('DELETE', `/api/communities/${comunidade.id}/paineis-de-cargo/${paineis[0].id}`)).json();
  assert.equal(depois.paineis.length, 0);
  const restantes = (await bia('GET', `/api/channels/${geral.id}/messages`)).json() as { id: number }[];
  assert.ok(!restantes.some((m) => m.id === painel.id), 'apagar o painel apaga a mensagem');
});
