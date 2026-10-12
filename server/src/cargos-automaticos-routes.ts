import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { channelRoom, communityRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';
import { publicarComoSyden } from './syden-app.js';

/**
 * CARGOS AUTOMÁTICOS (pacote MEE6, 12/10/2026; as tabelas estão em db.ts):
 *
 * - CARGO POR REAÇÃO: quem administra escolhe o canal, escreve o texto e liga cada emoji a um cargo. O Syden publica
 *   o painel com a legenda ("🎨 — Artista") e já deixa cada emoji reagido, para escolher ser um clique. Reagir dá o
 *   cargo; tirar a reação tira. É o "escolha seus cargos" que as comunidades montam no MEE6.
 * - CARGO DE QUEM ENTRA: os cargos que toda pessoa nova recebe ao entrar pela porta (o convite).
 *
 * Um cargo aqui é IDENTIDADE, não poder (ver cargos-routes.ts): dar cargo sozinho não abre nenhuma porta, e por
 * isso pode ser automático.
 */
const NAO_ENCONTRADA = 'Comunidade não encontrada.';
const TEXTO_MAXIMO = 1500;

/** Avisa a comunidade de que os cargos de uma pessoa mudaram (o mesmo evento de sempre do membro). */
function avisarMembro(io: IOServer, communityId: number, userId: number) {
  const member = db.listCommunityMembers(communityId).find((m) => m.id === userId);
  if (member) io.to(communityRoom(communityId)).emit('member:updated', { communityId, member });
}

/** Depois de uma reação: se a mensagem é um painel de cargos, dá ou tira o cargo daquele emoji. */
export function aplicarCargoPorReacao(io: IOServer, messageId: number, emoji: string, userId: number, marcou: boolean) {
  const achado = db.cargoDaReacao(messageId, emoji);
  if (!achado || db.ehContaDoSistema(userId) || !db.memberRole(achado.communityId, userId)) return;
  if (marcou) db.darCargo(achado.communityId, userId, achado.cargoId);
  else db.tirarCargo(achado.communityId, userId, achado.cargoId);
  avisarMembro(io, achado.communityId, userId);
}

/** Emoji comum (até 8 pontos de código: cobre bandeira, tom de pele e ZWJ) ou um emoji da própria comunidade. */
function emojiValido(valor: unknown, communityId: number): string | null {
  const texto = String(valor ?? '').trim();
  const proprio = /^:([a-z0-9_]{2,32}):$/.exec(texto);
  if (proprio) return db.emojiNameTaken(communityId, proprio[1]) ? texto : null;
  return texto.length >= 1 && [...texto].length <= 8 && !/[\w\s]/.test(texto) ? texto : null;
}

export function registerCargosAutomaticosRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** Confere que quem pede administra a comunidade; senão a recusa já vai. */
    const administra = (id: string, userId: number, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
      const communityId = Number(id);
      const papel = db.memberRole(communityId, userId);
      if (!papel) {
        reply.code(404).send({ error: NAO_ENCONTRADA });
        return null;
      }
      if (!manages(papel)) {
        reply.code(403).send({ error: 'Só quem administra a comunidade mexe nos cargos automáticos.' });
        return null;
      }
      return communityId;
    };

    authed.get<{ Params: { id: string } }>('/api/communities/:id/cargos-automaticos', async (request, reply) => {
      const communityId = administra(request.params.id, request.user.id, reply);
      if (communityId === null) return reply;
      return { paineis: db.listarPaineisDeCargo(communityId), deEntrada: db.cargosDeEntrada(communityId) };
    });

    authed.put<{ Params: { id: string }; Body: { cargoIds?: unknown } }>('/api/communities/:id/cargos-de-entrada', async (request, reply) => {
      const communityId = administra(request.params.id, request.user.id, reply);
      if (communityId === null) return reply;
      const pedidos = Array.isArray(request.body?.cargoIds) ? request.body.cargoIds.map(Number) : [];
      const existentes = new Set(db.listarCargos(communityId).map((c) => c.id));
      db.definirCargosDeEntrada(communityId, [...new Set(pedidos)].filter((id) => existentes.has(id)));
      return { deEntrada: db.cargosDeEntrada(communityId) };
    });

    authed.post<{ Params: { id: string }; Body: { channelId?: number; texto?: string; opcoes?: unknown } }>(
      '/api/communities/:id/paineis-de-cargo',
      async (request, reply) => {
        const communityId = administra(request.params.id, request.user.id, reply);
        if (communityId === null) return reply;
        const canal = db.findChannel(Number(request.body?.channelId));
        if (!canal || canal.communityId !== communityId || canal.type !== 'text') return reply.code(400).send({ error: 'Escolha um canal de texto da comunidade.' });
        const texto = String(request.body?.texto ?? '').trim();
        if (!texto || texto.length > TEXTO_MAXIMO) return reply.code(400).send({ error: `O texto deve ter de 1 a ${TEXTO_MAXIMO} caracteres.` });
        if (db.listarPaineisDeCargo(communityId).length >= db.MAXIMO_DE_PAINEIS) {
          return reply.code(409).send({ error: `Esta comunidade já tem ${db.MAXIMO_DE_PAINEIS} painéis de cargo, o máximo.` });
        }
        const cargos = new Map(db.listarCargos(communityId).map((c) => [c.id, c]));
        const brutas = Array.isArray(request.body?.opcoes) ? (request.body.opcoes as { emoji?: unknown; cargoId?: unknown }[]) : [];
        const opcoes: { emoji: string; cargoId: number }[] = [];
        for (const bruta of brutas) {
          const emoji = emojiValido(bruta?.emoji, communityId);
          const cargoId = Number(bruta?.cargoId);
          if (!emoji) return reply.code(400).send({ error: 'Um dos emojis não vale.' });
          if (!cargos.has(cargoId)) return reply.code(400).send({ error: 'Um dos cargos não existe.' });
          if (opcoes.some((o) => o.emoji === emoji)) return reply.code(400).send({ error: 'Cada emoji só pode dar um cargo.' });
          opcoes.push({ emoji, cargoId });
        }
        if (opcoes.length === 0 || opcoes.length > db.MAXIMO_DE_OPCOES_NO_PAINEL) {
          return reply.code(400).send({ error: `Ligue de 1 a ${db.MAXIMO_DE_OPCOES_NO_PAINEL} emojis a cargos.` });
        }

        // A legenda vai junto: quem chega vê o que cada emoji dá sem perguntar a ninguém.
        const legenda = opcoes.map((o) => `${o.emoji} — ${cargos.get(o.cargoId)!.nome}`).join('\n');
        const mensagem = publicarComoSyden(io, canal, `${texto}\n\n${legenda}`);
        // O Syden deixa cada emoji reagido: escolher vira um clique, sem ninguém procurar o emoji.
        for (const o of opcoes) db.toggleReaction(mensagem.id, o.emoji, db.contaDoSyden());
        io.to(channelRoom(canal)).emit('reaction:updated', {
          messageId: mensagem.id,
          channelId: canal.id,
          threadId: null,
          reactions: db.reactionCounts(mensagem.id),
        });
        db.criarPainelDeCargo(communityId, canal.id, mensagem.id, opcoes);
        return { paineis: db.listarPaineisDeCargo(communityId) };
      },
    );

    /** Apagar o painel apaga a mensagem também: um painel que não dá mais cargo não pode continuar convidando. */
    authed.delete<{ Params: { id: string; painelId: string } }>('/api/communities/:id/paineis-de-cargo/:painelId', async (request, reply) => {
      const communityId = administra(request.params.id, request.user.id, reply);
      if (communityId === null) return reply;
      const painel = db.apagarPainelDeCargo(communityId, Number(request.params.painelId));
      if (!painel) return reply.code(404).send({ error: 'Painel não encontrado.' });
      db.deleteMessage(painel.messageId);
      const canal = db.findChannel(painel.channelId);
      if (canal) io.to(channelRoom(canal)).emit('message:deleted', { id: painel.messageId, channelId: painel.channelId, threadId: null });
      return { paineis: db.listarPaineisDeCargo(communityId) };
    });
  });
}
