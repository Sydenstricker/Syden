/**
 * Modo apresentação: uma pessoa fala, as outras assistem.
 *
 * O QUE ESTES TESTES PROTEGEM é uma coisa só, e é a que não pode falhar em silêncio: **a trava fica no
 * servidor**. Um botão de microfone desabilitado na tela é uma sugestão — quem abrir o console do
 * navegador publica assim mesmo. Quem decide é o token que o servidor emite, e é isso que se mede aqui.
 *
 * O LiveKit não sobe nestes testes, e não precisa: o token é um JWT assinado, e dá para abrir e ler o
 * que ele autoriza sem servidor de mídia nenhum. É justamente a parte que decide.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

let dona: ReturnType<typeof comToken>;
let plateia: ReturnType<typeof comToken>;
let plateiaId: number;
let salaId: number;

/** Lê o miolo do JWT sem verificar assinatura: aqui interessa o que ele AUTORIZA, não se é válido. */
function permissoes(jwt: string) {
  const meio = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  return meio.video as { canPublish?: boolean; canSubscribe?: boolean; roomJoin?: boolean };
}

async function tokenDeVoz(quem: ReturnType<typeof comToken>) {
  const resposta = await quem('POST', `/api/channels/${salaId}/voice-token`);
  assert.equal(resposta.statusCode, 200, 'não consegui o token de voz');
  return permissoes(resposta.json().token);
}

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  const aDona = await criarConta(app, 'dona');
  const oZe = await criarConta(app, 'ze');
  dona = comToken(app, aDona.token);
  plateia = comToken(app, oZe.token);
  plateiaId = oZe.user.id;

  const comunidade = (await dona('POST', '/api/communities', { name: 'Palestras' })).json();
  await plateia('POST', '/api/communities/join', { code: comunidade.inviteCode });
  salaId = (await dona('POST', `/api/communities/${comunidade.id}/channels`, { name: 'auditório', type: 'voice' })).json()
    .id;
});

after(async () => fechar());

describe('sala normal', () => {
  it('todo mundo pode falar', async () => {
    assert.equal((await tokenDeVoz(dona)).canPublish, true);
    assert.equal((await tokenDeVoz(plateia)).canPublish, true);
  });

  it('não dá para levantar a mão onde não há apresentação', async () => {
    const r = await plateia('POST', `/api/channels/${salaId}/palco/mao`, { levantada: true });
    assert.equal(r.statusCode, 409, 'levantar a mão numa sala comum não significa nada');
  });
});

describe('com a apresentação ligada', () => {
  it('só quem administra liga', async () => {
    const r = await plateia('PUT', `/api/channels/${salaId}/palco`, { ligado: true });
    assert.equal(r.statusCode, 403);
    assert.equal((await dona('PUT', `/api/channels/${salaId}/palco`, { ligado: true })).statusCode, 200);
  });

  it('A PLATEIA NÃO PODE PUBLICAR — é o token que diz, não a tela', async () => {
    const dela = await tokenDeVoz(plateia);
    assert.equal(dela.canPublish, false, 'a plateia conseguiria abrir o microfone pelo console');
    assert.equal(dela.canSubscribe, true, 'a plateia precisa continuar ouvindo');
    assert.equal(dela.roomJoin, true, 'a plateia entra na sala: ela assiste, não fica de fora');
  });

  it('quem administra continua podendo falar sem precisar se dar palco', async () => {
    // Sem isto, ligar a apresentação calaria quem acabou de ligá-la.
    assert.equal((await tokenDeVoz(dona)).canPublish, true);
  });

  it('a mão levantada entra na fila', async () => {
    await plateia('POST', `/api/channels/${salaId}/palco/mao`, { levantada: true });
    const estado = (await dona('GET', `/api/channels/${salaId}/palco`)).json();
    assert.equal(estado.palco.length, 1);
    assert.equal(estado.palco[0].username, 'ze');
    assert.equal(estado.palco[0].situacao, 'mao');
  });

  it('quem recebe a palavra passa a poder publicar', async () => {
    await dona('POST', `/api/channels/${salaId}/palco/${plateiaId}`, { palco: true });
    assert.equal((await tokenDeVoz(plateia)).canPublish, true);
    const minha = (await plateia('GET', `/api/channels/${salaId}/palco`)).json().minhaSituacao;
    assert.equal(minha, 'palco');
  });

  it('e perde de novo ao ter a palavra tirada', async () => {
    await dona('POST', `/api/channels/${salaId}/palco/${plateiaId}`, { palco: false });
    assert.equal((await tokenDeVoz(plateia)).canPublish, false);
  });

  it('ninguém se dá palco sozinho', async () => {
    const r = await plateia('POST', `/api/channels/${salaId}/palco/${plateiaId}`, { palco: true });
    assert.equal(r.statusCode, 403, 'a plateia poderia subir ao palco sozinha');
    assert.equal((await tokenDeVoz(plateia)).canPublish, false);
  });
});

describe('ao desligar', () => {
  it('todo mundo volta a falar, e o palco é esquecido', async () => {
    await dona('POST', `/api/channels/${salaId}/palco/${plateiaId}`, { palco: true });
    await dona('PUT', `/api/channels/${salaId}/palco`, { ligado: false });

    assert.equal((await tokenDeVoz(plateia)).canPublish, true);
    const estado = (await dona('GET', `/api/channels/${salaId}/palco`)).json();
    assert.equal(estado.apresentacao, false);
    // Guardar o palco antigo faria uma sala reaberta em apresentação reaparecer com gente do mês
    // passado podendo falar, sem ninguém entender por quê.
    assert.deepEqual(estado.palco, []);
  });
});
