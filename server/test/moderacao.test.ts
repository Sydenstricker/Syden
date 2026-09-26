import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

let dono: ReturnType<typeof comToken>;
let bia: ReturnType<typeof comToken>;
let estranho: ReturnType<typeof comToken>;
let mensagemId: number;
let biaId: number;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  const ana = await criarConta(app, 'ana'); // primeira conta: cuida do Syden
  const b = await criarConta(app, 'bia');
  const zeca = await criarConta(app, 'zeca');
  dono = comToken(app, ana.token);
  bia = comToken(app, b.token);
  estranho = comToken(app, zeca.token);
  biaId = b.user.id;

  const comunidade = (await dono('POST', '/api/communities', { name: 'Praça' })).json();
  await bia('POST', '/api/communities/join', { code: comunidade.inviteCode });
  const canal = (await dono('POST', `/api/communities/${comunidade.id}/channels`, { name: 'geral', type: 'text' })).json();

  const db = await import('../src/db.js');
  mensagemId = db.createMessage(canal.id, biaId, 'mensagem que vai ser denunciada', null).id;
});
after(() => fechar());

describe('denunciar', () => {
  it('guarda uma cópia do que foi denunciado', async () => {
    // A cópia é o ponto: a mensagem pode ser apagada antes de alguém olhar a denúncia.
    const aberta = await dono('POST', '/api/reports', { tipo: 'mensagem', alvo: mensagemId, motivo: 'conteúdo impróprio' });
    assert.equal(aberta.statusCode, 200);

    const lista = (await dono('GET', '/api/reports')).json();
    const denuncia = lista.denuncias[0];
    assert.equal(denuncia.snapshot, 'mensagem que vai ser denunciada');
    assert.equal(denuncia.targetName, (await bia('GET', '/api/me')).json().username);
    assert.equal(denuncia.status, 'aberta');
  });

  it('não deixa denunciar o que a pessoa não enxerga', async () => {
    // Senão o número da mensagem viraria uma janela para ler conversa alheia pela resposta da denúncia.
    const resposta = await estranho('POST', '/api/reports', { tipo: 'mensagem', alvo: mensagemId, motivo: 'chute' });
    assert.equal(resposta.statusCode, 404);
  });

  it('exige um motivo escrito', async () => {
    assert.equal((await bia('POST', '/api/reports', { tipo: 'pessoa', alvo: biaId, motivo: 'x' })).statusCode, 400);
  });

  it('a lista é só de quem cuida do Syden', async () => {
    assert.equal((await bia('GET', '/api/reports')).statusCode, 403);
    assert.equal((await bia('POST', '/api/reports/1/resolver', { resolucao: 'nada' })).statusCode, 403);
  });

  it('resolver exige dizer o que foi feito, e isso vai para a auditoria', async () => {
    const lista = (await dono('GET', '/api/reports', undefined)).json();
    const id = lista.denuncias[0].id;

    assert.equal((await dono('POST', `/api/reports/${id}/resolver`, { resolucao: '' })).statusCode, 400);

    const resolvida = await dono('POST', `/api/reports/${id}/resolver`, { resolucao: 'conversei com a pessoa' });
    assert.equal(resolvida.statusCode, 200);
    assert.equal(resolvida.json().status, 'resolvida');

    const auditoria = (await dono('GET', '/api/audit')).json();
    assert.ok(auditoria.some((l: { action: string }) => l.action === 'denuncia.resolvida'));
  });

  it('a contagem de abertas acompanha', async () => {
    assert.equal((await dono('GET', '/api/reports?status=aberta')).json().abertas, 0);
    await bia('POST', '/api/reports', { tipo: 'pessoa', alvo: biaId, motivo: 'só para contar' });
    assert.equal((await dono('GET', '/api/reports')).json().abertas, 1);
  });
});

describe('levar os meus dados embora (LGPD)', () => {
  it('entrega um arquivo com o que o Syden guarda sobre a pessoa', async () => {
    const resposta = await bia('GET', '/api/me/dados');
    assert.equal(resposta.statusCode, 200);
    assert.match(resposta.headers['content-disposition'] as string, /attachment/, 'vem como arquivo para baixar');

    const pacote = JSON.parse(resposta.body);
    assert.ok(pacote.conta.username.startsWith('bia'));
    assert.ok(Array.isArray(pacote.mensagens), 'as mensagens dela entram no pacote');
    assert.ok(pacote.mensagens.some((m: { texto: string }) => m.texto === 'mensagem que vai ser denunciada'));
    assert.ok(pacote.comunidades.length >= 1);
  });

  it('cada um só leva os próprios dados', async () => {
    const meus = JSON.parse((await estranho('GET', '/api/me/dados')).body);
    assert.ok(meus.conta.username.startsWith('zeca'));
    assert.equal(meus.mensagens.length, 0, 'não pode vir mensagem de outra pessoa');
  });

  it('apagar a conta leva as mensagens junto', async () => {
    const passageiro = await criarConta(app, 'passageiro');
    const como = comToken(app, passageiro.token);
    const db = await import('../src/db.js');
    const comunidade = (await como('POST', '/api/communities', { name: 'Efêmera' })).json();
    const canal = (await como('POST', `/api/communities/${comunidade.id}/channels`, { name: 'geral', type: 'text' })).json();
    db.createMessage(canal.id, passageiro.user.id, 'isto tem que sumir', null);

    assert.equal((await como('POST', '/api/me/delete', { password: passageiro.password })).statusCode, 200);
    assert.equal(db.mensagensDaPessoa(passageiro.user.id).length, 0);
    assert.equal(db.findUserById(passageiro.user.id), undefined);
  });
});
