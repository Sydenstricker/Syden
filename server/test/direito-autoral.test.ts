/**
 * RETIRADA POR DIREITO AUTORAL. Os termos (seção 4) prometem a quem reclama: o conteúdo é retirado, quem o
 * publicou é avisado e pode contestar, e a reincidência custa a conta. O que este arquivo segura:
 *
 *   1. só quem cuida do Syden procura e retira;
 *   2. retirar apaga o conteúdo e registra quem reclamou;
 *   3. quem subiu recebe o aviso numa conversa privada com quem retirou — onde pode responder;
 *   4. a contagem de retiradas por pessoa sobe, que é o número que decide a reincidência.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let db: typeof import('../src/db.js');

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  db = await import('../src/db.js');
});

after(async () => {
  await fechar();
});

const ogg = (n: number) => 'data:audio/ogg;base64,' + Buffer.concat([Buffer.from('OggS'), Buffer.from([n, 7, 7, 7])]).toString('base64');

describe('retirada por direito autoral', () => {
  it('retira, registra, avisa quem subiu e conta a reincidência', async () => {
    const dono = await criarConta(app, 'donodosyden'); // a primeira conta cuida do Syden
    const quemSobe = await criarConta(app, 'quemsobe');
    const comoDono = comToken(app, dono.token);
    const comoQuemSobe = comToken(app, quemSobe.token);

    const comunidade = (await comoQuemSobe('POST', '/api/communities', { name: 'Os do meme' })).json();
    const som = (await comoQuemSobe('POST', `/api/communities/${comunidade.id}/sounds`, { name: 'Música famosa', icon: '🎵', audio: ogg(1) })).json();
    await comoQuemSobe('POST', `/api/communities/${comunidade.id}/sounds`, { name: 'Outra famosa', icon: '🎵', audio: ogg(2) });

    // 1. Quem não cuida do Syden não procura nem retira.
    assert.equal((await comoQuemSobe('GET', '/api/direito-autoral/procurar?q=famosa')).statusCode, 403);
    assert.equal((await comoQuemSobe('POST', '/api/direito-autoral/retirar', { tipo: 'som', id: som.id, reclamante: 'x' })).statusCode, 403);

    // A busca acha pelo nome, dizendo onde está e de quem é.
    const achados = (await comoDono('GET', '/api/direito-autoral/procurar?q=famosa')).json() as db.ConteudoRetiravel[];
    const alvo = achados.find((c) => c.id === som.id)!;
    assert.equal(alvo.tipo, 'som');
    assert.equal(alvo.onde, 'Comunidade Os do meme');
    assert.equal(alvo.autorNome, 'quemsobe');
    assert.equal(alvo.retiradasAntes, 0);

    // Sem dizer quem reclamou, não retira: o registro é a razão de existir disto.
    assert.equal((await comoDono('POST', '/api/direito-autoral/retirar', { tipo: 'som', id: som.id, reclamante: '' })).statusCode, 400);

    // 2 e 3. Retira e avisa.
    const aviso = 'Seu som «Música famosa» foi retirado a pedido da gravadora X. Se você tinha o direito, responda aqui.';
    const retirada = await comoDono('POST', '/api/direito-autoral/retirar', {
      tipo: 'som',
      id: som.id,
      reclamante: 'Gravadora X (juridico@x.com)',
      aviso,
    });
    assert.equal(retirada.statusCode, 200);
    assert.equal(retirada.json().avisado, true);
    assert.equal(retirada.json().retiradasDoAutor, 1);
    assert.equal(db.findSound(som.id), undefined, 'o som saiu do banco');

    const conversa = db.findDirectBetween(dono.user.id, quemSobe.user.id);
    assert.ok(conversa, 'quem subiu e quem retirou ganharam uma conversa privada');
    const mensagens = (await comoQuemSobe('GET', `/api/channels/${conversa!.id}/messages`)).json() as { content: string }[];
    assert.ok(
      mensagens.some((m) => m.content === aviso),
      'o aviso chegou na conversa de quem subiu',
    );

    // O histórico guarda quem reclamou, o que saiu e quem retirou.
    const historico = (await comoDono('GET', '/api/direito-autoral')).json() as db.RetiradaAutoral[];
    assert.equal(historico[0].nome, 'Música famosa');
    assert.equal(historico[0].reclamante, 'Gravadora X (juridico@x.com)');
    assert.equal(historico[0].por, 'donodosyden');

    // 4. A reincidência aparece já na busca seguinte.
    const depois = (await comoDono('GET', '/api/direito-autoral/procurar?q=Outra')).json() as db.ConteudoRetiravel[];
    assert.equal(depois[0].retiradasAntes, 1);
  });

  it('o que já saiu responde 404, e não apaga outra coisa', async () => {
    const dono = comToken(app, (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'donodosyden', password: 'segredo123' } })).json().token);
    assert.equal((await dono('POST', '/api/direito-autoral/retirar', { tipo: 'som', id: 999999, reclamante: 'Alguém' })).statusCode, 404);
    assert.equal((await dono('POST', '/api/direito-autoral/retirar', { tipo: 'arquivo', id: 1, reclamante: 'Alguém' })).statusCode, 400);
  });
});
