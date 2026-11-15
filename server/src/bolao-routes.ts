import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';

/**
 * O BOLÃO DA COMUNIDADE (pedido dele, 14/11/2026: "quero fazer bolão no Syden"). As escolhas dele:
 *
 * - SÓ PONTOS. O Syden não anota nem move dinheiro; se a turma combinar algum, é por fora.
 * - QUEM CRIA LANÇA: quem cria o bolão cadastra os jogos e digita o placar final (qualquer esporte, sem API de fora).
 * - NA COMUNIDADE: qualquer membro cria um bolão; quem o criou e quem administra cuidam dos jogos e dos placares.
 * - A PONTUAÇÃO CLÁSSICA: placar exato 10; o vencedor (ou o empate) com o mesmo saldo 5; só o vencedor (ou o empate) 3.
 *
 * O palpite fecha na hora do jogo (o relógio é o do servidor), e o dos outros só aparece depois dela: antes, dava para
 * copiar. Quem não participa da comunidade recebe 404, como no calendário. Mudou um jogo ou um placar, a turma relê
 * (bolao:mudou); o palpite de cada um não avisa ninguém.
 */
const TITULO_MAXIMO = 60;
const TIME_MAXIMO = 40;
const BOLOES_MAXIMOS = 30;
const JOGOS_MAXIMOS = 200;
const GOLS_MAXIMOS = 99;
const DIA = 24 * 60 * 60 * 1000;
const NAO_ENCONTRADA = 'Comunidade não encontrada.';
const BOLAO_NAO_ENCONTRADO = 'Bolão não encontrado.';
const JOGO_NAO_ENCONTRADO = 'Jogo não encontrado.';

const limpar = (valor: unknown, maximo: number) => {
  const limpo = String(valor ?? '').replace(/(?!\u{200D})[\p{Cc}\p{Cf}]/gu, '').trim().replace(/\s+/g, ' ');
  return /[^\s\u{200D}]/u.test(limpo) && limpo.length <= maximo ? limpo : null;
};

const gols = (valor: unknown) => (Number.isInteger(valor) && (valor as number) >= 0 && (valor as number) <= GOLS_MAXIMOS ? (valor as number) : null);

/** Os pontos de um palpite contra o placar final. */
export function pontosDoPalpite(palpite: { golsCasa: number; golsFora: number }, placar: { golsCasa: number; golsFora: number }): number {
  if (palpite.golsCasa === placar.golsCasa && palpite.golsFora === placar.golsFora) return 10;
  const lado = (c: number, f: number) => Math.sign(c - f);
  if (lado(palpite.golsCasa, palpite.golsFora) !== lado(placar.golsCasa, placar.golsFora)) return 0;
  return palpite.golsCasa - palpite.golsFora === placar.golsCasa - placar.golsFora ? 5 : 3;
}

export function registerBolaoRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);
    const avisar = (communityId: number, bolaoId: number | null) => io.to(communityRoom(communityId)).emit('bolao:mudou', { communityId, bolaoId });

    /** O papel na comunidade, ou a resposta 404 já dada. */
    const papelDe = (communityIdBruto: string, userId: number) => {
      const communityId = Number(communityIdBruto);
      const papel = Number.isInteger(communityId) ? db.memberRole(communityId, userId) : undefined;
      return papel ? { communityId, papel } : null;
    };
    /** Quem cuida do bolão: quem o criou e quem administra a comunidade. */
    const cuida = (bolao: db.Bolao, papel: db.Role, userId: number) => manages(papel) || bolao.criadoPor === userId;

    authed.get<{ Params: { id: string } }>('/api/communities/:id/boloes', async (request, reply) => {
      const c = papelDe(request.params.id, request.user.id);
      if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
      return { boloes: db.boloesDaComunidade(c.communityId) };
    });

    authed.post<{ Params: { id: string }; Body: { titulo?: unknown } }>('/api/communities/:id/boloes', async (request, reply) => {
      const c = papelDe(request.params.id, request.user.id);
      if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const titulo = limpar(request.body?.titulo, TITULO_MAXIMO);
      if (!titulo) return reply.code(400).send({ error: `O nome do bolão deve ter de 1 a ${TITULO_MAXIMO} caracteres.` });
      if (db.boloesDaComunidade(c.communityId).length >= BOLOES_MAXIMOS) {
        return reply.code(409).send({ error: `Esta comunidade já tem ${BOLOES_MAXIMOS} bolões, o máximo.` });
      }
      const bolao = db.criarBolao(c.communityId, titulo, request.user.id);
      avisar(c.communityId, null);
      return reply.code(201).send(bolao);
    });

    authed.get<{ Params: { id: string; bolaoId: string } }>('/api/communities/:id/boloes/:bolaoId', async (request, reply) => {
      const c = papelDe(request.params.id, request.user.id);
      if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
      if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
      const agora = new Date().toISOString();
      const palpites = db.palpitesDoBolao(c.communityId, bolao.id);
      const ranking = new Map<number, { userId: number; nome: string; pontos: number; exatos: number; palpites: number }>();
      const jogos = db.jogosDoBolao(bolao.id).map((jogo) => {
        const comecou = jogo.quando <= agora;
        const placar = jogo.golsCasa !== null && jogo.golsFora !== null ? { golsCasa: jogo.golsCasa, golsFora: jogo.golsFora } : null;
        const doJogo = palpites
          .filter((p) => p.jogoId === jogo.id)
          .map((p) => ({ userId: p.userId, nome: p.nome, golsCasa: p.golsCasa, golsFora: p.golsFora, pontos: placar ? pontosDoPalpite(p, placar) : null }));
        if (placar) {
          for (const p of doJogo) {
            const linha = ranking.get(p.userId) ?? { userId: p.userId, nome: p.nome, pontos: 0, exatos: 0, palpites: 0 };
            linha.pontos += p.pontos!;
            linha.exatos += p.pontos === 10 ? 1 : 0;
            linha.palpites += 1;
            ranking.set(p.userId, linha);
          }
        }
        const meu = doJogo.find((p) => p.userId === request.user.id) ?? null;
        return {
          ...jogo,
          comecou,
          meu: meu && { golsCasa: meu.golsCasa, golsFora: meu.golsFora, pontos: meu.pontos },
          // os dos outros só depois da hora do jogo (antes, dava para copiar); antes, só quantos já palpitaram
          palpites: comecou ? doJogo : null,
          quantosPalpitaram: doJogo.length,
        };
      });
      return {
        bolao,
        jogos,
        ranking: [...ranking.values()].sort((a, b) => b.pontos - a.pontos || b.exatos - a.exatos || a.nome.localeCompare(b.nome)),
        podeEditar: cuida(bolao, c.papel, request.user.id),
      };
    });

    authed.delete<{ Params: { id: string; bolaoId: string } }>('/api/communities/:id/boloes/:bolaoId', async (request, reply) => {
      const c = papelDe(request.params.id, request.user.id);
      if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
      if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
      if (!cuida(bolao, c.papel, request.user.id)) return reply.code(403).send({ error: 'Só quem criou o bolão ou quem administra a comunidade o apaga.' });
      db.apagarBolao(c.communityId, bolao.id);
      avisar(c.communityId, bolao.id);
      return { ok: true };
    });

    authed.post<{ Params: { id: string; bolaoId: string }; Body: { casa?: unknown; fora?: unknown; quando?: unknown } }>(
      '/api/communities/:id/boloes/:bolaoId/jogos',
      async (request, reply) => {
        const c = papelDe(request.params.id, request.user.id);
        if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
        const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
        if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
        if (!cuida(bolao, c.papel, request.user.id)) return reply.code(403).send({ error: 'Só quem criou o bolão ou quem administra a comunidade cadastra jogos.' });
        const casa = limpar(request.body?.casa, TIME_MAXIMO), fora = limpar(request.body?.fora, TIME_MAXIMO);
        if (!casa || !fora) return reply.code(400).send({ error: `O nome de cada lado deve ter de 1 a ${TIME_MAXIMO} caracteres.` });
        const quando = typeof request.body?.quando === 'string' ? Date.parse(request.body.quando) : NaN;
        const agora = Date.now();
        if (!Number.isFinite(quando) || quando < agora - 60 * 60 * 1000 || quando > agora + 730 * DIA) return reply.code(400).send({ error: 'Data inválida.' });
        if (bolao.jogos >= JOGOS_MAXIMOS) return reply.code(409).send({ error: `Este bolão já tem ${JOGOS_MAXIMOS} jogos, o máximo.` });
        const jogo = db.criarJogoDoBolao(bolao.id, casa, fora, new Date(quando).toISOString());
        avisar(c.communityId, bolao.id);
        return reply.code(201).send(jogo);
      },
    );

    authed.delete<{ Params: { id: string; bolaoId: string; jogoId: string } }>('/api/communities/:id/boloes/:bolaoId/jogos/:jogoId', async (request, reply) => {
      const c = papelDe(request.params.id, request.user.id);
      if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
      if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
      if (!cuida(bolao, c.papel, request.user.id)) return reply.code(403).send({ error: 'Só quem criou o bolão ou quem administra a comunidade apaga jogos.' });
      if (!db.apagarJogoDoBolao(bolao.id, Number(request.params.jogoId))) return reply.code(404).send({ error: JOGO_NAO_ENCONTRADO });
      avisar(c.communityId, bolao.id);
      return { ok: true };
    });

    /** O placar final; com os dois nulos, volta a "sem resultado" (para corrigir um placar digitado errado). */
    authed.put<{ Params: { id: string; bolaoId: string; jogoId: string }; Body: { golsCasa?: unknown; golsFora?: unknown } }>(
      '/api/communities/:id/boloes/:bolaoId/jogos/:jogoId/resultado',
      async (request, reply) => {
        const c = papelDe(request.params.id, request.user.id);
        if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
        const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
        if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
        if (!cuida(bolao, c.papel, request.user.id)) return reply.code(403).send({ error: 'Só quem criou o bolão ou quem administra a comunidade lança o placar.' });
        const jogo = db.jogoDoBolao(bolao.id, Number(request.params.jogoId));
        if (!jogo) return reply.code(404).send({ error: JOGO_NAO_ENCONTRADO });
        const limpo = request.body?.golsCasa === null && request.body?.golsFora === null;
        const casa = gols(request.body?.golsCasa), fora = gols(request.body?.golsFora);
        if (!limpo && (casa === null || fora === null)) return reply.code(400).send({ error: `O placar vai de 0 a ${GOLS_MAXIMOS}.` });
        if (!limpo && Date.parse(jogo.quando) > Date.now()) return reply.code(409).send({ error: 'O jogo ainda não começou.' });
        db.resultadoDoJogo(bolao.id, jogo.id, limpo ? null : casa, limpo ? null : fora);
        avisar(c.communityId, bolao.id);
        return { ok: true };
      },
    );

    authed.put<{ Params: { id: string; bolaoId: string; jogoId: string }; Body: { golsCasa?: unknown; golsFora?: unknown } }>(
      '/api/communities/:id/boloes/:bolaoId/jogos/:jogoId/palpite',
      async (request, reply) => {
        const c = papelDe(request.params.id, request.user.id);
        if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
        const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
        if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
        const jogo = db.jogoDoBolao(bolao.id, Number(request.params.jogoId));
        if (!jogo) return reply.code(404).send({ error: JOGO_NAO_ENCONTRADO });
        if (Date.parse(jogo.quando) <= Date.now()) return reply.code(409).send({ error: 'Os palpites deste jogo já fecharam.' });
        const casa = gols(request.body?.golsCasa), fora = gols(request.body?.golsFora);
        if (casa === null || fora === null) return reply.code(400).send({ error: `O placar vai de 0 a ${GOLS_MAXIMOS}.` });
        db.palpitar(jogo.id, request.user.id, casa, fora);
        return { ok: true };
      },
    );
  });
}
