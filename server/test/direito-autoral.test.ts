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

  it('retirar leva as cópias do mesmo arquivo, inclusive emoji de pacote copiado para comunidades', async () => {
    const dono = comToken(app, (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'donodosyden', password: 'segredo123' } })).json().token);
    const a = await criarConta(app, 'copiaa');
    const b = await criarConta(app, 'copiab');
    const comA = (await comToken(app, a.token)('POST', '/api/communities', { name: 'Comunidade A' })).json();
    const comB = (await comToken(app, b.token)('POST', '/api/communities', { name: 'Comunidade B' })).json();

    // O mesmo áudio subido em duas comunidades, por duas pessoas.
    const somA = (await comToken(app, a.token)('POST', `/api/communities/${comA.id}/sounds`, { name: 'Hit copiado', icon: '🎵', audio: ogg(40) })).json();
    const somB = (await comToken(app, b.token)('POST', `/api/communities/${comB.id}/sounds`, { name: 'Outro nome', icon: '🎵', audio: ogg(40) })).json();
    const r = (await dono('POST', '/api/direito-autoral/retirar', { tipo: 'som', id: somA.id, reclamante: 'Selo Y' })).json();
    assert.equal(r.copias, 1, 'a cópia da outra comunidade saiu junto');
    assert.equal(db.findSound(somA.id), undefined);
    assert.equal(db.findSound(somB.id), undefined);

    // Emoji de pacote: instalar copia para a comunidade; retirar o do pacote leva a cópia.
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('desenho-unico')]);
    const pacote = db.createEmojiPack('Figurinhas', 'x', '😀', a.user.id);
    const item = db.addEmojiToPack(pacote, 'personagem', 'image/png', png);
    const copia = db.createEmoji(comB.id, 'personagem', 'image/png', png, b.user.id);
    const achado = (await dono('GET', '/api/direito-autoral/procurar?q=personagem')).json() as { tipo: string; id: number }[];
    assert.ok(achado.some((c) => c.tipo === 'emoji-pacote' && c.id === item), 'o emoji do pacote aparece na busca');
    const re = (await dono('POST', '/api/direito-autoral/retirar', { tipo: 'emoji-pacote', id: item, reclamante: 'Estúdio Z' })).json();
    assert.equal(re.copias, 1);
    assert.equal(db.findEmojiPackItem(item), undefined);
    assert.equal(db.findEmoji(copia.id), undefined, 'a cópia na comunidade saiu junto');
  });

  it('anexo: sai da mensagem e o texto fica; conversa privada nunca aparece na busca', async () => {
    const dono = comToken(app, (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'donodosyden', password: 'segredo123' } })).json().token);
    const pessoa = await criarConta(app, 'quemanexa');
    const outra = await criarConta(app, 'quemconversa');
    const comunidade = (await comToken(app, pessoa.token)('POST', '/api/communities', { name: 'Anexos' })).json();
    const canal = db.listChannels(comunidade.id).find((c) => c.type === 'text')!;
    const imagem = Buffer.from('imagem-do-filme');
    const mensagem = db.createMessage(canal.id, pessoa.user.id, 'olha o pôster');
    const anexo = db.addAttachment(mensagem.id, { name: 'poster-do-filme.png', mime: 'image/png', data: imagem, width: null, height: null });

    // O mesmo nome de arquivo numa conversa privada: não pode aparecer.
    const privada = db.createDirectChannel('', pessoa.user.id, [outra.user.id]);
    const noPrivado = db.createMessage(privada.id, pessoa.user.id, '');
    db.addAttachment(noPrivado.id, { name: 'poster-do-filme-privado.png', mime: 'image/png', data: Buffer.from('outro'), width: null, height: null });

    const achados = (await dono('GET', '/api/direito-autoral/procurar?q=poster-do-filme')).json() as { tipo: string; nome: string; onde: string }[];
    assert.deepEqual(
      achados.filter((c) => c.tipo === 'anexo').map((c) => c.nome),
      ['poster-do-filme.png'],
      'só o do canal; o da conversa privada não aparece',
    );
    assert.match(achados.find((c) => c.tipo === 'anexo')!.onde, /em Anexos$/);

    const r = await dono('POST', '/api/direito-autoral/retirar', { tipo: 'anexo', id: anexo.id, reclamante: 'Distribuidora W' });
    assert.equal(r.statusCode, 200);
    const depois = db.findMessageFull(mensagem.id, pessoa.user.id)!;
    assert.equal(depois.content, 'olha o pôster', 'o texto da mensagem fica');
    assert.equal(depois.attachments.length, 0, 'o anexo saiu');
  });

  it('o que já saiu responde 404, e não apaga outra coisa', async () => {
    const dono = comToken(app, (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'donodosyden', password: 'segredo123' } })).json().token);
    assert.equal((await dono('POST', '/api/direito-autoral/retirar', { tipo: 'som', id: 999999, reclamante: 'Alguém' })).statusCode, 404);
    assert.equal((await dono('POST', '/api/direito-autoral/retirar', { tipo: 'arquivo', id: 1, reclamante: 'Alguém' })).statusCode, 400);
  });
});
