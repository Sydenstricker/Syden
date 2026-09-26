import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

let dono: ReturnType<typeof comToken>;
let visitante: ReturnType<typeof comToken>;
let comunidadeId: number;
let convite: string;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  // A primeira conta vira dona do Syden; a segunda é gente comum.
  const ana = await criarConta(app, 'ana');
  const zeca = await criarConta(app, 'zeca');
  dono = comToken(app, ana.token);
  visitante = comToken(app, zeca.token);

  const comunidade = (await visitante('POST', '/api/communities', { name: 'Clube do Zeca' })).json();
  comunidadeId = comunidade.id;
  convite = comunidade.inviteCode;
});
after(() => fechar());

describe('o operador do Syden dentro da comunidade dos outros', () => {
  it('participa como membro comum, e não como administrador por tabela', async () => {
    // Esta é a mudança: antes, quem administra o Syden virava admin de QUALQUER comunidade de que
    // participasse. Num produto com gente de fora, isso é o operador do serviço mandando na casa alheia.
    assert.equal((await dono('POST', '/api/communities/join', { code: convite })).statusCode, 200);

    const membros = (await dono('GET', `/api/communities/${comunidadeId}/members`)).json();
    const eu = membros.find((m: { username: string }) => m.username.startsWith('ana'));
    assert.equal(eu.role, 'member', 'entrou como membro, mesmo administrando o Syden');

    const renomear = await dono('PATCH', `/api/communities/${comunidadeId}`, { name: 'Tomada' });
    assert.equal(renomear.statusCode, 403, 'não renomeia a comunidade de outra pessoa');
  });

  it('mas continua alcançando o que é obrigação de quem opera o serviço', async () => {
    const canal = (await visitante('POST', `/api/communities/${comunidadeId}/channels`, { name: 'geral', type: 'text' })).json();
    // Mensagem só de texto entra pelo socket, não por HTTP: aqui ela é posta direto no banco, que é
    // montagem de cenário, não o que está sendo testado.
    const db = await import('../src/db.js');
    const zeca = (await visitante('GET', '/api/me')).json();
    const mensagem = db.createMessage(canal.id, zeca.id, 'conteúdo qualquer', null);

    // Tirar do ar conteúdo ilegal não pode depender de o dono da comunidade estar acordado.
    assert.equal((await dono('DELETE', `/api/messages/${mensagem.id}`)).statusCode, 200);
  });

  it('e cada uso desse poder fica registrado, com nome e hora', async () => {
    const registro = (await dono('GET', '/api/audit')).json();
    const linha = registro.find((l: { action: string }) => l.action === 'moderacao.mensagem');
    assert.ok(linha, 'a mensagem apagada pelo operador tinha que estar no registro');
    assert.match(linha.actorName, /^ana/);
    assert.ok(linha.at, 'sem hora, o registro não serve para responder a uma reclamação');
    assert.match(linha.detail, /geral/, 'diz em qual canal foi');
  });
});

describe('o registro de auditoria', () => {
  it('guarda quem deu e quem tirou o cargo de administrador', async () => {
    const zeca = (await visitante('GET', '/api/me')).json();
    await dono('PUT', `/api/users/${zeca.id}/admin`, { isAdmin: true });
    await dono('PUT', `/api/users/${zeca.id}/admin`, { isAdmin: false });

    const acoes = (await dono('GET', '/api/audit')).json().map((l: { action: string }) => l.action);
    assert.ok(acoes.includes('admin.dado'));
    assert.ok(acoes.includes('admin.tirado'));
  });

  it('não abre para quem não administra o Syden', async () => {
    assert.equal((await visitante('GET', '/api/audit')).statusCode, 403);
  });

  it('guarda o nome por extenso, para continuar legível depois de a conta sumir', async () => {
    const alvo = await criarConta(app, 'passageiro');
    await dono('DELETE', `/api/users/${alvo.user.id}`);

    const linha = (await dono('GET', '/api/audit')).json().find((l: { action: string }) => l.action === 'conta.excluida');
    assert.ok(linha, 'a exclusão tinha que estar no registro');
    assert.match(linha.target, /^passageiro/, 'o nome fica escrito, não só o número da conta');
  });
});
