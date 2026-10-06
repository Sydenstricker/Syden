import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import { signSession } from './auth.js';
import { config } from './config.js';
import * as db from './db.js';
import { Freio } from './freio.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';
import { pessoaDeVerdade, turnstileLigado } from './turnstile.js';

/**
 * A AULA: o link que leva direto para uma sala de voz (ver o bloco "A AULA" no fim de db.ts).
 *
 * Quem administra a comunidade cria o link de uma sala, com prazo. Quem abre o link:
 *   - tendo conta, entra na comunidade (se ainda não estava) e cai na sala;
 *   - não tendo, escreve só o nome e ganha uma conta TEMPORÁRIA, que vale até o link vencer e então é
 *     apagada — pelo caminho normal de exclusão, com a caixa-preta (ver CLAUDE.md).
 *
 * O link é a chave da turma, e por isso tem as travas de qualquer porta de entrada: prazo (no máximo
 * um dia), desligar a qualquer momento, freio por endereço e a verificação de pessoa quando ela está
 * ligada. E a conta temporária só faz o que a aula precisa — falar, ouvir e escrever na comunidade
 * dela. Criar comunidade, conversa privada e pedido de amizade ficam de fora (ver routes.ts).
 */
const HORAS_POSSIVEIS = [1, 2, 3, 6, 12, 24];
const NOME_RE = /^[\p{L}\p{N}][\p{L}\p{N} '.-]{0,38}[\p{L}\p{N}.]$/u;

export function registerAulaRoutes(app: FastifyInstance, io: IOServer) {
  // As mesmas medidas do cadastro: algumas tentativas por minuto, e um teto de contas por dia por endereço.
  const freioPorEndereco = new Freio(config.freio.tentativasPorEndereco, 60_000);
  const freioDeContas = new Freio(config.freio.cadastrosPorDia, 24 * 60 * 60_000);

  /** O que a tela de entrada mostra antes de a pessoa escrever o nome. Sem login: ela ainda não tem conta. */
  app.get<{ Params: { token: string } }>('/api/aula/:token', async (request, reply) => {
    const aula = db.aulaPeloToken(request.params.token);
    if (!aula) return reply.code(404).send({ error: 'Este link de aula não vale mais. Peça um novo a quem dá a aula.' });
    return { sala: aula.sala, comunidade: aula.comunidade, expiraEm: aula.expiraEm };
  });

  /** Entrar SEM conta: só o nome. Devolve o token de uma conta que vale até o link vencer. */
  app.post<{ Params: { token: string }; Body: { nome?: string; turnstile?: string } }>(
    '/api/aula/:token/entrar',
    async (request, reply) => {
      const espera = freioPorEndereco.tentar(request.ip);
      if (espera) return reply.header('retry-after', String(espera)).code(429).send({ error: `Muitas tentativas seguidas. Espere ${espera} s.` });

      const aula = db.aulaPeloToken(request.params.token);
      if (!aula) return reply.code(404).send({ error: 'Este link de aula não vale mais. Peça um novo a quem dá a aula.' });

      const nome = String(request.body?.nome ?? '').trim().replace(/\s+/g, ' ');
      if (!NOME_RE.test(nome)) return reply.code(400).send({ error: 'Escreva o seu nome, com 2 a 40 letras.' });

      if (turnstileLigado()) {
        const veredito = await pessoaDeVerdade(request.body?.turnstile, request.ip);
        if (veredito === 'indisponivel') return reply.code(503).send({ error: 'A verificação de segurança está fora do ar. Tente de novo daqui a pouco.' });
        if (veredito === 'recusado') return reply.code(403).send({ error: 'Não deu para confirmar que você é uma pessoa. Recarregue a página e tente de novo.' });
      }
      if (freioDeContas.bloqueado(request.ip)) return reply.code(429).send({ error: 'Muitas entradas deste lugar hoje. Tente amanhã.' });
      if (db.countMembers(aula.communityId) >= config.maxMembersPerCommunity) {
        return reply.code(409).send({ error: 'A turma está cheia.' });
      }

      const user = db.criarUsuarioTemporario(nome, aula.expiraEm);
      db.addMember(aula.communityId, user.id);
      freioDeContas.tentar(request.ip);
      io.to(communityRoom(aula.communityId)).emit('member:updated', { communityId: aula.communityId, member: { ...user, role: 'member' } });
      return { token: await signSession(user, 1), user, communityId: aula.communityId, channelId: aula.channelId };
    },
  );

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** Entrar COM conta: vira membro da comunidade, se ainda não era, e recebe para onde ir. */
    authed.post<{ Params: { token: string } }>('/api/aula/:token/entrar-com-conta', async (request, reply) => {
      const aula = db.aulaPeloToken(request.params.token);
      if (!aula) return reply.code(404).send({ error: 'Este link de aula não vale mais. Peça um novo a quem dá a aula.' });
      if (!db.memberRole(aula.communityId, request.user.id)) {
        if (db.countMembers(aula.communityId) >= config.maxMembersPerCommunity) return reply.code(409).send({ error: 'A turma está cheia.' });
        db.addMember(aula.communityId, request.user.id);
        const user = db.findUserById(request.user.id);
        io.to(communityRoom(aula.communityId)).emit('member:updated', { communityId: aula.communityId, member: { ...user, role: 'member' } });
      }
      return { communityId: aula.communityId, channelId: aula.channelId };
    });

    /** Os links valendo de uma sala. Só quem administra a comunidade. */
    authed.get<{ Params: { id: string } }>('/api/channels/:id/aulas', async (request, reply) => {
      const canal = db.findChannel(Number(request.params.id));
      // Quem não participa recebe 404, como no resto do Syden: um 403 contaria que a sala existe.
      const papel = canal && canal.communityId !== null ? db.memberRole(canal.communityId, request.user.id) : undefined;
      if (!canal || canal.type !== 'voice' || canal.communityId === null || !papel) return reply.code(404).send({ error: 'Sala não encontrada.' });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade cria links de aula.' });
      return db.aulasDaSala(canal.id);
    });

    authed.post<{ Params: { id: string }; Body: { horas?: number } }>('/api/channels/:id/aulas', async (request, reply) => {
      const canal = db.findChannel(Number(request.params.id));
      // Quem não participa recebe 404, como no resto do Syden: um 403 contaria que a sala existe.
      const papel = canal && canal.communityId !== null ? db.memberRole(canal.communityId, request.user.id) : undefined;
      if (!canal || canal.type !== 'voice' || canal.communityId === null || !papel) return reply.code(404).send({ error: 'Sala não encontrada.' });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade cria links de aula.' });
      const horas = Number(request.body?.horas ?? 3);
      if (!HORAS_POSSIVEIS.includes(horas)) return reply.code(400).send({ error: 'O link vale de 1 a 24 horas.' });
      return db.criarAula(canal.id, canal.communityId, request.user.id, horas);
    });

    authed.delete<{ Params: { cid: string; id: string } }>('/api/communities/:cid/aulas/:id', async (request, reply) => {
      const communityId = Number(request.params.cid);
      if (!manages(db.memberRole(communityId, request.user.id))) return reply.code(403).send({ error: 'Só quem administra a comunidade desliga links de aula.' });
      if (!db.revogarAula(Number(request.params.id), communityId)) return reply.code(404).send({ error: 'Link não encontrado.' });
      return { ok: true };
    });

    /**
     * A cultura que a comunidade estuda, para a faixa de cultura dela. Uma turma de japonês escolhe
     * Japão e japonês, e todo mundo nela vê livros e fotos do Japão — e não a cultura do idioma do
     * sistema de cada aluno, que é o que a faixa da tela inicial mostra.
     */
    authed.patch<{ Params: { id: string }; Body: { pais?: string | null; lingua?: string | null } }>(
      '/api/communities/:id/cultura',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        if (!manages(db.memberRole(communityId, request.user.id))) return reply.code(403).send({ error: 'Só quem administra a comunidade escolhe a cultura dela.' });
        const pais = request.body?.pais ? String(request.body.pais).toUpperCase() : null;
        const lingua = request.body?.lingua ? String(request.body.lingua).toLowerCase() : null;
        if ((pais === null) !== (lingua === null)) return reply.code(400).send({ error: 'País e língua vão juntos.' });
        if (pais !== null && (!/^[A-Z]{2}$/.test(pais) || !/^[a-z]{2,3}$/.test(lingua!))) return reply.code(400).send({ error: 'País ou língua inválidos.' });
        db.definirCulturaDaComunidade(communityId, pais, lingua);
        const community = db.findCommunity(communityId)!;
        io.to(communityRoom(communityId)).emit('community:updated', community);
        return community;
      },
    );
  });
}
