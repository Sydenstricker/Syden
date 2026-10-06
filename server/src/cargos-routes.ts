import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';

/**
 * OS CARGOS PERSONALIZADOS (ver o bloco "OS CARGOS" em db.ts): quem administra a comunidade cria, edita
 * e apaga, e dá ou tira de quem quiser. Todo membro vê a lista, porque ela aparece no perfil e na lista
 * de membros.
 *
 * Cargo é identidade, não poder — nada aqui muda o que alguém pode fazer na comunidade.
 */
const NOME_MAXIMO = 32;
const COR_RE = /^#[0-9a-f]{6}$/i;
/** O que não é membro recebe 404, como nas outras rotas de comunidade: ela simplesmente não existe. */
const NAO_ENCONTRADA = 'Comunidade não encontrada.';

function lerNome(valor: unknown): string | null {
  const nome = String(valor ?? '').trim().replace(/\s+/g, ' ');
  return nome.length >= 1 && nome.length <= NOME_MAXIMO ? nome : null;
}

export function registerCargosRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** Avisa a comunidade inteira: a lista de cargos mudou. */
    const avisarCargos = (communityId: number) =>
      io.to(communityRoom(communityId)).emit('cargos:updated', { communityId, cargos: db.listarCargos(communityId) });
    /** Avisa que os cargos de uma pessoa mudaram, pelo mesmo evento de sempre do membro. */
    const avisarMembro = (communityId: number, userId: number) => {
      const member = db.listCommunityMembers(communityId).find((m) => m.id === userId);
      if (member) io.to(communityRoom(communityId)).emit('member:updated', { communityId, member });
      return member;
    };

    authed.get<{ Params: { id: string } }>('/api/communities/:id/cargos', async (request, reply) => {
      const communityId = Number(request.params.id);
      if (!db.memberRole(communityId, request.user.id)) return reply.code(404).send({ error: NAO_ENCONTRADA });
      return db.listarCargos(communityId);
    });

    authed.post<{ Params: { id: string }; Body: { nome?: string; cor?: string; separado?: boolean } }>(
      '/api/communities/:id/cargos',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        const papel = db.memberRole(communityId, request.user.id);
        if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
        if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade cria cargos.' });
        const nome = lerNome(request.body?.nome);
        if (!nome) return reply.code(400).send({ error: `O nome do cargo deve ter de 1 a ${NOME_MAXIMO} caracteres.` });
        const cor = String(request.body?.cor ?? '');
        if (!COR_RE.test(cor)) return reply.code(400).send({ error: 'Cor inválida.' });
        if (db.listarCargos(communityId).length >= db.MAXIMO_DE_CARGOS) {
          return reply.code(409).send({ error: `Esta comunidade já tem ${db.MAXIMO_DE_CARGOS} cargos, o máximo.` });
        }
        const cargo = db.criarCargo(communityId, nome, cor.toLowerCase(), request.body?.separado === true);
        avisarCargos(communityId);
        return cargo;
      },
    );

    authed.patch<{
      Params: { id: string; cargoId: string };
      Body: { nome?: string; cor?: string; separado?: boolean; posicao?: number };
    }>('/api/communities/:id/cargos/:cargoId', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade edita cargos.' });
      const corpo = request.body ?? {};
      const mudanca: { nome?: string; cor?: string; separado?: boolean; posicao?: number } = {};
      if (corpo.nome !== undefined) {
        const nome = lerNome(corpo.nome);
        if (!nome) return reply.code(400).send({ error: `O nome do cargo deve ter de 1 a ${NOME_MAXIMO} caracteres.` });
        mudanca.nome = nome;
      }
      if (corpo.cor !== undefined) {
        if (!COR_RE.test(String(corpo.cor))) return reply.code(400).send({ error: 'Cor inválida.' });
        mudanca.cor = String(corpo.cor).toLowerCase();
      }
      if (corpo.separado !== undefined) mudanca.separado = corpo.separado === true;
      if (corpo.posicao !== undefined) {
        if (!Number.isInteger(corpo.posicao) || corpo.posicao < 0 || corpo.posicao > 10_000) {
          return reply.code(400).send({ error: 'Posição inválida.' });
        }
        mudanca.posicao = corpo.posicao;
      }
      const cargo = db.editarCargo(communityId, Number(request.params.cargoId), mudanca);
      if (!cargo) return reply.code(404).send({ error: 'Cargo não encontrado.' });
      avisarCargos(communityId);
      return cargo;
    });

    authed.delete<{ Params: { id: string; cargoId: string } }>('/api/communities/:id/cargos/:cargoId', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade apaga cargos.' });
      const cargoId = Number(request.params.cargoId);
      // Quem tinha o cargo precisa ser avisado também: a lista dele muda junto.
      const quemTinha = [...db.cargosDosMembros(communityId)].filter(([, ids]) => ids.includes(cargoId)).map(([userId]) => userId);
      if (!db.apagarCargo(communityId, cargoId)) return reply.code(404).send({ error: 'Cargo não encontrado.' });
      avisarCargos(communityId);
      for (const userId of quemTinha) avisarMembro(communityId, userId);
      return { ok: true };
    });

    // Dar e tirar um cargo de alguém. PUT e DELETE no mesmo endereço: os dois podem repetir sem estragar.
    type PedidoDeCargo = FastifyRequest<{ Params: { id: string; userId: string; cargoId: string } }>;
    const darOuTirar = (dar: boolean) =>
      async (request: PedidoDeCargo, reply: FastifyReply) => {
        const communityId = Number(request.params.id);
        const papel = db.memberRole(communityId, request.user.id);
        if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
        if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade dá e tira cargos.' });
        const userId = Number(request.params.userId);
        if (!db.memberRole(communityId, userId)) return reply.code(404).send({ error: 'Essa pessoa não participa da comunidade.' });
        const cargoId = Number(request.params.cargoId);
        if (!db.acharCargo(communityId, cargoId)) return reply.code(404).send({ error: 'Cargo não encontrado.' });
        if (dar) db.darCargo(communityId, userId, cargoId);
        else db.tirarCargo(communityId, userId, cargoId);
        return avisarMembro(communityId, userId);
      };
    authed.put<{ Params: { id: string; userId: string; cargoId: string } }>(
      '/api/communities/:id/members/:userId/cargos/:cargoId',
      darOuTirar(true),
    );
    authed.delete<{ Params: { id: string; userId: string; cargoId: string } }>(
      '/api/communities/:id/members/:userId/cargos/:cargoId',
      darOuTirar(false),
    );
  });
}
