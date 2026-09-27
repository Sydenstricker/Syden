/**
 * O selo pela porta da rota.
 *
 * A regra dos marcos já é provada em selos.test.ts. O que se prova aqui é que ela está LIGADA no
 * servidor, e não só no botão da tela: um selo que se consegue com um pedido feito à mão não é
 * conquista nenhuma, e a tela é a parte do Syden que qualquer pessoa consegue contornar.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

let dona: ReturnType<typeof comToken>;
let membro: ReturnType<typeof comToken>;
let deFora: ReturnType<typeof comToken>;
let comunidadeId: number;
let convite: string;

const SELO = { texto: 'ZECA', icone: 'estrela', cor: '#5865f2' };

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  const ana = await criarConta(app, 'ana');
  const zeca = await criarConta(app, 'zeca');
  const bia = await criarConta(app, 'bia');
  dona = comToken(app, ana.token);
  membro = comToken(app, zeca.token);
  deFora = comToken(app, bia.token);

  const comunidade = (await dona('POST', '/api/communities', { name: 'Clube da Ana' })).json();
  comunidadeId = comunidade.id;
  convite = comunidade.inviteCode;
  await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
});

after(async () => fechar());

describe('antes do primeiro marco', () => {
  it('a comunidade nova não tem o selo destravado', async () => {
    const { destravado, selo } = (await dona('GET', `/api/communities/${comunidadeId}/selo`)).json();
    assert.equal(destravado, false);
    assert.equal(selo, null);
  });

  it('A TRAVA É DO SERVIDOR: mesmo quem administra não consegue pôr o selo', async () => {
    const resposta = await dona('PUT', `/api/communities/${comunidadeId}/selo`, SELO);
    assert.equal(resposta.statusCode, 403, 'o selo entrou sem a comunidade ter conquistado nada');
    assert.equal((await dona('GET', `/api/communities/${comunidadeId}/selo`)).json().selo, null);
  });

  it('qualquer membro vê o progresso, não só quem administra', async () => {
    // O selo é mérito do grupo: esconder de quem o está construindo tira metade da graça.
    const resposta = await membro('GET', `/api/communities/${comunidadeId}/selo`);
    assert.equal(resposta.statusCode, 200);
    assert.equal(resposta.json().podeEditar, false, 'membro comum não deveria poder editar');
    assert.ok(resposta.json().marcos.length > 0);
  });

  it('quem não é da comunidade não vê nada dela', async () => {
    // 404 e não 403: os números são sequenciais, e "403 você não participa" contaria a um estranho
    // quais comunidades existem.
    assert.equal((await deFora('GET', `/api/communities/${comunidadeId}/selo`)).statusCode, 404);
  });
});

describe('depois de conquistar', () => {
  before(async () => {
    const db = await import('../src/db.js');
    // Traz a comunidade até o primeiro marco: 5 membros e 3 pessoas diferentes tendo escrito.
    const canal = (await dona('POST', `/api/communities/${comunidadeId}/channels`, { name: 'geral', type: 'text' })).json();
    for (const nome of ['caio', 'duda', 'edu']) {
      const conta = await criarConta(app, nome);
      const entrou = await comToken(app, conta.token)('POST', '/api/communities/join', { code: convite });
      assert.equal(entrou.statusCode, 200, nome + ' não entrou: ' + entrou.body);
      db.createMessage(canal.id, conta.user.id, 'oi');
    }
  });

  it('o primeiro marco cai e o selo destrava', async () => {
    const dados = (await dona('GET', `/api/communities/${comunidadeId}/selo`)).json();
    assert.equal(dados.destravado, true);
    assert.equal(dados.marcos.find((m: { codigo: string }) => m.codigo === 'turma').alcancado, true);
  });

  it('quem administra põe o selo', async () => {
    const resposta = await dona('PUT', `/api/communities/${comunidadeId}/selo`, SELO);
    assert.equal(resposta.statusCode, 200, resposta.body);
    assert.deepEqual((await dona('GET', `/api/communities/${comunidadeId}/selo`)).json().selo, SELO);
  });

  it('membro comum NÃO põe, mesmo com a comunidade tendo conquistado', async () => {
    const resposta = await membro('PUT', `/api/communities/${comunidadeId}/selo`, { ...SELO, texto: 'XX' });
    assert.equal(resposta.statusCode, 403);
    assert.equal((await dona('GET', `/api/communities/${comunidadeId}/selo`)).json().selo.texto, 'ZECA');
  });

  it('texto, ícone e cor inválidos são recusados pelo servidor', async () => {
    for (const corpo of [
      { ...SELO, texto: 'GRANDE' },
      { ...SELO, texto: '🐰' },
      { ...SELO, icone: 'dragao' },
      { ...SELO, cor: 'javascript:alert(1)' },
    ]) {
      const resposta = await dona('PUT', `/api/communities/${comunidadeId}/selo`, corpo);
      assert.equal(resposta.statusCode, 400, `aceitou ${JSON.stringify(corpo)}`);
    }
    // E o selo bom continua lá: recusa não pode apagar o que já existia.
    assert.equal((await dona('GET', `/api/communities/${comunidadeId}/selo`)).json().selo.texto, 'ZECA');
  });

  it('dá para tirar o selo depois de tê-lo', async () => {
    assert.equal((await dona('DELETE', `/api/communities/${comunidadeId}/selo`)).statusCode, 200);
    assert.equal((await dona('GET', `/api/communities/${comunidadeId}/selo`)).json().selo, null);
  });
});

describe('vestir o selo é escolha de cada pessoa', () => {
  before(async () => {
    // Recoloca o selo, que o teste anterior tirou.
    await dona('PUT', `/api/communities/${comunidadeId}/selo`, SELO);
  });

  it('quem é da comunidade pode vestir o selo dela', async () => {
    const { podeVestir } = (await membro('GET', '/api/me/selo')).json();
    assert.equal(podeVestir.length, 1);
    assert.equal(podeVestir[0].texto, 'ZECA');

    assert.equal((await membro('PUT', '/api/me/selo', { communityId: comunidadeId })).statusCode, 200);
    assert.equal((await membro('GET', '/api/me/selo')).json().vestindo.texto, 'ZECA');
  });

  it('A CONFERÊNCIA É DO SERVIDOR: não dá para vestir o selo de um time do qual você não é', async () => {
    const resposta = await deFora('PUT', '/api/me/selo', { communityId: comunidadeId });
    assert.equal(resposta.statusCode, 403, 'vestiu o selo de uma comunidade de que não participa');
    assert.equal((await deFora('GET', '/api/me/selo')).json().vestindo, null);
  });

  it('dá para tirar a camiseta a qualquer momento', async () => {
    assert.equal((await membro('PUT', '/api/me/selo', { communityId: null })).statusCode, 200);
    assert.equal((await membro('GET', '/api/me/selo')).json().vestindo, null);
  });

  it('SAIR DA COMUNIDADE DEVOLVE A CAMISETA', async () => {
    const db = await import('../src/db.js');
    await membro('PUT', '/api/me/selo', { communityId: comunidadeId });
    assert.ok((await membro('GET', '/api/me/selo')).json().vestindo, 'não vestiu antes de sair');

    await membro('POST', `/api/communities/${comunidadeId}/leave`);

    // O sintoma de esquecer isto seria mudo: a pessoa continuaria exibindo o selo de um lugar de
    // que não faz mais parte, e nada daria erro em canto nenhum.
    assert.equal((await membro('GET', '/api/me/selo')).json().vestindo, null);
    assert.equal(db.findUserById(1)?.selo !== undefined, true);
  });

  it('a comunidade perder o selo tira do corpo de quem vestia', async () => {
    const db = await import('../src/db.js');
    const caio = db.findUserByName('caio')!;
    db.vestirSelo(caio.id, comunidadeId);
    assert.ok(db.findUserById(caio.id)?.selo, 'não vestiu');

    await dona('DELETE', `/api/communities/${comunidadeId}/selo`);
    assert.equal(db.findUserById(caio.id)?.selo, null, 'a camiseta ficou no corpo de um time sem camiseta');
  });
});
