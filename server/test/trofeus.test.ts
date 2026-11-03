/**
 * A ESTANTE DE TROFÉUS e QUEM ENTRA NO QUARTO (03/11/2026, decisões dele; server/src/trofeus-routes.ts).
 *
 *   1. O quarto: amigos por padrão; público abre a todos; privado fecha até para amigos, menos os convidados.
 *   2. Antes dos 18, o público não existe, e o convite é só para amigos.
 *   3. O destaque: até 6, só do que é da pessoa; quem visita vê o destaque com contra quem.
 *   4. As conquistas da turma entram na estante de cada membro.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let ana: ReturnType<typeof comToken>;
let bia: ReturnType<typeof comToken>;
let caio: ReturnType<typeof comToken>;
let anaId: number;
let biaId: number;
let caioId: number;
let dbm: typeof import('../src/db.js');

const comAnos = (anos: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
};

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  dbm = await import('../src/db.js');
  const a = await criarConta(app, 'ana'), b = await criarConta(app, 'bia'), c = await criarConta(app, 'caio');
  ana = comToken(app, a.token); bia = comToken(app, b.token); caio = comToken(app, c.token);
  anaId = a.user.id; biaId = b.user.id; caioId = c.user.id;
  // a Ana e a Bia são amigas; o Caio não é amigo de ninguém
  assert.equal((await ana('POST', '/api/amigos', { username: 'bia' })).statusCode, 200);
  assert.equal((await bia('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 200);
});

after(async () => fechar());

const visita = async (quem: ReturnType<typeof comToken>, dono: number) => (await quem('GET', `/api/quarto/${dono}`)).statusCode;
const pode = async (quem: ReturnType<typeof comToken>, dono: number) => (await quem('GET', `/api/quarto/${dono}/acesso`)).json().podeVisitar;

describe('quem entra no quarto', () => {
  it('de fábrica, só os amigos (e o quarto que nunca foi arrumado também se visita)', async () => {
    assert.equal((await ana('GET', '/api/quarto-acesso')).json().modo, 'amigos');
    assert.equal(await visita(bia, anaId), 200);
    assert.equal((await bia('GET', `/api/quarto/${anaId}`)).json().arrumacao, null);
    assert.equal(await pode(bia, anaId), true);
    assert.equal(await visita(caio, anaId), 404);
    assert.equal(await pode(caio, anaId), false);
  });

  it('público: qualquer conta', async () => {
    assert.equal((await ana('PUT', '/api/quarto-acesso', { modo: 'publico' })).statusCode, 200);
    assert.equal(await visita(caio, anaId), 200);
  });

  it('privado: nem os amigos, só os convidados', async () => {
    assert.equal((await ana('PUT', '/api/quarto-acesso', { modo: 'privado' })).statusCode, 200);
    assert.equal(await visita(bia, anaId), 404);
    assert.equal(await visita(caio, anaId), 404);
    assert.equal((await ana('POST', `/api/quarto-acesso/convidados/${biaId}`)).statusCode, 200);
    assert.equal(await visita(bia, anaId), 200);
    assert.equal(await visita(caio, anaId), 404);
    assert.deepEqual((await ana('GET', '/api/quarto-acesso')).json().convidados.map((c: { id: number }) => c.id), [biaId]);
    assert.equal((await ana('DELETE', `/api/quarto-acesso/convidados/${biaId}`)).statusCode, 200);
    assert.equal(await visita(bia, anaId), 404);
  });

  it('modo que não existe é recusado', async () => {
    assert.equal((await ana('PUT', '/api/quarto-acesso', { modo: 'aberto' })).statusCode, 400);
  });

  it('o bloqueio fecha a porta até para convidado, com a mesma resposta', async () => {
    await ana('PUT', '/api/quarto-acesso', { modo: 'publico' });
    assert.equal((await caio('POST', '/api/me/bloqueios', { userId: anaId })).statusCode, 200);
    assert.equal(await visita(ana, caioId), 404);
    assert.equal(await visita(caio, anaId), 404);
    assert.equal(await pode(caio, anaId), false);
    // a mesma resposta de quem não é amigo: quem tentou convidar não descobre o bloqueio
    assert.equal((await ana('POST', `/api/quarto-acesso/convidados/${caioId}`)).statusCode, 400);
    await caio('DELETE', `/api/me/bloqueios/${anaId}`);
    await ana('PUT', '/api/quarto-acesso', { modo: 'amigos' });
  });

  it('antes dos 18: sem público, e o convite só para amigos', async () => {
    const d = await criarConta(app, 'duda');
    const duda = comToken(app, d.token);
    dbm.guardarNascimento(d.user.id, comAnos(16), 'declarada');
    assert.equal((await duda('GET', '/api/quarto-acesso')).json().menor, true);
    assert.equal((await duda('PUT', '/api/quarto-acesso', { modo: 'publico' })).statusCode, 403);
    assert.equal((await duda('POST', `/api/quarto-acesso/convidados/${caioId}`)).statusCode, 400);
    // e um "público" que já estava guardado (de antes de informar a idade) vale como amigos, e a tela diz isso
    dbm.mudarAcessoDoQuarto(d.user.id, 'publico');
    assert.equal(await visita(caio, d.user.id), 404);
    assert.equal((await duda('GET', '/api/quarto-acesso')).json().modo, 'amigos');
  });

  it('a tela de Amigos sabe em quais quartos dá para entrar, e quem convidou', async () => {
    const abertos = async () => (await bia('GET', '/api/quartos-abertos')).json().quartos;
    await ana('PUT', '/api/quarto-acesso', { modo: 'amigos' });
    assert.deepEqual(await abertos(), [{ id: anaId, convidou: false }]);
    await ana('PUT', '/api/quarto-acesso', { modo: 'privado' });
    assert.deepEqual(await abertos(), []);
    await ana('POST', `/api/quarto-acesso/convidados/${biaId}`);
    assert.deepEqual(await abertos(), [{ id: anaId, convidou: true }]);
    await ana('DELETE', `/api/quarto-acesso/convidados/${biaId}`);
    await ana('PUT', '/api/quarto-acesso', { modo: 'amigos' });
  });

  it('o convite acaba com a amizade (e com o bloqueio, que a desfaz)', async () => {
    await ana('PUT', '/api/quarto-acesso', { modo: 'privado' });
    assert.equal((await ana('POST', `/api/quarto-acesso/convidados/${biaId}`)).statusCode, 200);
    assert.equal(await visita(bia, anaId), 200);
    assert.equal((await ana('DELETE', `/api/amigos/${biaId}`)).statusCode, 200);
    assert.equal(await visita(bia, anaId), 404, 'quem deixou de ser amigo não entra mais');
    assert.deepEqual((await ana('GET', '/api/quarto-acesso')).json().convidados, [], 'e o convite sumiu');
    // amigas de novo: o convite não volta sozinho
    await ana('POST', '/api/amigos', { username: 'bia' });
    await bia('POST', `/api/amigos/${anaId}/aceitar`);
    assert.equal(await visita(bia, anaId), 404);
    await ana('PUT', '/api/quarto-acesso', { modo: 'amigos' });
  });
});

describe('o destaque', () => {
  let trofeu: number;
  before(() => {
    dbm.guardarTrofeu({ userId: anaId, evento: 'e1', communityId: 0, pista: 'festa', posicao: 1, tempoMs: null, pontos: 42, rivais: [biaId, caioId] });
    dbm.guardarTrofeu({ userId: biaId, evento: 'e1', communityId: 0, pista: 'festa', posicao: 2, tempoMs: null, pontos: 30, rivais: [anaId, caioId] });
    trofeu = dbm.trofeusDe(anaId)[0].id;
  });

  it('a estante traz os troféus, sem nada em destaque no começo', async () => {
    const r = (await ana('GET', '/api/trofeus')).json();
    assert.equal(r.trofeus.length, 1);
    assert.deepEqual(r.destaque, []);
    assert.equal(r.maximo, 6);
  });

  it('só se destaca o que é seu, até 6', async () => {
    const daBia = dbm.trofeusDe(biaId)[0].id;
    assert.equal((await ana('PUT', '/api/trofeus/destaque', { itens: [`t:${daBia}`] })).statusCode, 400);
    assert.equal((await ana('PUT', '/api/trofeus/destaque', { itens: Array.from({ length: 7 }, () => `t:${trofeu}`) })).statusCode, 400);
    assert.equal((await ana('PUT', '/api/trofeus/destaque', { itens: [`t:${trofeu}`] })).statusCode, 200);
    assert.deepEqual((await ana('GET', '/api/trofeus')).json().destaque, [`t:${trofeu}`]);
  });

  it('quem visita vê o destaque, com contra quem; quem não entra no quarto, não', async () => {
    const r = await bia('GET', `/api/quarto/${anaId}/trofeus`);
    assert.equal(r.statusCode, 200);
    const [item] = r.json().itens;
    assert.equal(item.tipo, 'trofeu');
    assert.equal(item.pontos, 42);
    assert.deepEqual(item.rivais.map((x: { username: string }) => x.username).sort(), ['bia', 'caio']);
    assert.equal((await caio('GET', `/api/quarto/${anaId}/trofeus`)).statusCode, 404);
  });

  it('o rival que tem bloqueio com quem visita não aparece para essa pessoa', async () => {
    await ana('PUT', '/api/quarto-acesso', { modo: 'publico' });
    const e = await criarConta(app, 'edu');
    const edu = comToken(app, e.token);
    assert.equal((await caio('POST', '/api/me/bloqueios', { userId: e.user.id })).statusCode, 200);
    const [item] = (await edu('GET', `/api/quarto/${anaId}/trofeus`)).json().itens;
    assert.deepEqual(item.rivais.map((x: { username: string }) => x.username), ['bia']);
    await ana('PUT', '/api/quarto-acesso', { modo: 'amigos' });
  });

  it('o rival menor de idade só aparece para quem é amigo dele', async () => {
    const f = await criarConta(app, 'fefe');
    dbm.guardarNascimento(f.user.id, comAnos(15), 'declarada');
    dbm.guardarTrofeu({ userId: anaId, evento: 'e2', communityId: 0, pista: 'golfe', posicao: 1, tempoMs: null, pontos: 14, rivais: [f.user.id] });
    const novo = dbm.trofeusDe(anaId).find((t) => t.pista === 'golfe')!.id;
    await ana('PUT', '/api/trofeus/destaque', { itens: [`t:${novo}`] });
    await ana('PUT', '/api/quarto-acesso', { modo: 'publico' });
    const [item] = (await caio('GET', `/api/quarto/${anaId}/trofeus`)).json().itens;
    assert.deepEqual(item.rivais, [], 'o desconhecido não vê o nome do adolescente');
    assert.equal((await ana('GET', '/api/trofeus')).json().trofeus.find((t: { id: number }) => t.id === novo).rivais.length, 1, 'a dona vê');
    await ana('PUT', '/api/trofeus/destaque', { itens: [`t:${trofeu}`] });
    await ana('PUT', '/api/quarto-acesso', { modo: 'amigos' });
  });

  it('as conquistas da turma entram na estante, e podem ir ao destaque', async () => {
    const comunidade = (await ana('POST', '/api/communities', { name: 'Turma da Ana' })).json();
    dbm.guardarConquistas(comunidade.id, [{ conquista: 'horas-juntos', degrau: 10 }, { conquista: 'horas-juntos', degrau: 50 }]);
    const r = (await ana('GET', '/api/trofeus')).json();
    const c = r.conquistas.find((x: { conquista: string }) => x.conquista === 'horas-juntos');
    assert.equal(c.degrau, 50, 'o degrau mais alto');
    assert.equal(c.comunidade, 'Turma da Ana');
    assert.equal((await ana('PUT', '/api/trofeus/destaque', { itens: [c.chave, `t:${trofeu}`] })).statusCode, 200);
    const itens = (await bia('GET', `/api/quarto/${anaId}/trofeus`)).json().itens;
    assert.deepEqual(itens.map((i: { tipo: string }) => i.tipo), ['conquista', 'trofeu'], 'na ordem escolhida');
    // a conquista de uma comunidade onde a Bia não está não se destaca
    assert.equal((await bia('PUT', '/api/trofeus/destaque', { itens: [c.chave] })).statusCode, 400);
  });
});
