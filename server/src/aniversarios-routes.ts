import type { FastifyInstance } from 'fastify';
import * as db from './db.js';
import { manages, requireUser } from './routes.js';

/**
 * OS ANIVERSÁRIOS (ver o bloco em db.ts): a pessoa informa o dela (dia e mês), e quem administra a
 * comunidade escolhe o canal e o texto dos parabéns. Quem publica no dia é o agendador.ts.
 */
const TEXTO_MAXIMO = 500;
const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const NAO_ENCONTRADA = 'Comunidade não encontrada.';

export function registerAniversariosRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get('/api/me/aniversario', async (request) => {
      const mesDia = db.aniversarioDe(request.user.id);
      return mesDia ? { mes: Number(mesDia.slice(0, 2)), dia: Number(mesDia.slice(3)) } : { mes: null, dia: null };
    });

    /** { dia, mes } guarda; { dia: null, mes: null } apaga. Sem ano, de propósito. */
    authed.put<{ Body: { dia?: number | null; mes?: number | null } }>('/api/me/aniversario', async (request, reply) => {
      const { dia, mes } = request.body ?? {};
      if (dia === null && mes === null) {
        db.definirAniversario(request.user.id, null);
        return { mes: null, dia: null };
      }
      if (!Number.isInteger(mes) || mes! < 1 || mes! > 12 || !Number.isInteger(dia) || dia! < 1 || dia! > DIAS_NO_MES[mes! - 1]) {
        return reply.code(400).send({ error: 'Data inválida.' });
      }
      db.definirAniversario(request.user.id, `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
      return { mes, dia };
    });

    authed.get<{ Params: { id: string } }>('/api/communities/:id/aniversarios', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade configura os parabéns.' });
      return db.parabensDaComunidade(communityId);
    });

    /** { canalId, texto } liga; { canalId: null } desliga. O texto precisa ter {pessoa}. */
    authed.put<{ Params: { id: string }; Body: { canalId?: number | null; texto?: string } }>(
      '/api/communities/:id/aniversarios',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        const papel = db.memberRole(communityId, request.user.id);
        if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
        if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade configura os parabéns.' });
        if (request.body?.canalId === null) {
          db.definirParabens(communityId, null, null);
          return db.parabensDaComunidade(communityId);
        }
        const canal = db.findChannel(Number(request.body?.canalId));
        if (!canal || canal.communityId !== communityId || canal.type !== 'text') return reply.code(400).send({ error: 'Escolha um canal de texto da comunidade.' });
        const texto = String(request.body?.texto ?? '').trim();
        if (!texto || texto.length > TEXTO_MAXIMO || !texto.includes('{pessoa}')) {
          return reply.code(400).send({ error: 'O texto dos parabéns precisa ter {pessoa}, no lugar do nome de quem faz aniversário.' });
        }
        db.definirParabens(communityId, canal.id, texto);
        return db.parabensDaComunidade(communityId);
      },
    );
  });
}
