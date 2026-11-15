import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import { guardarArquivo } from './arquivos.js';
import * as db from './db.js';
import { entregarArquivo } from './entregar.js';
import { parseMediaConferida } from './media.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';

/**
 * O BOLÃO DA COMUNIDADE (pedido dele, 14/11/2026: "quero fazer bolão no Syden"; refeito em 15/11 no formato que ele
 * queria: "adicionar uma imagem, adicionar a pergunta e cada pessoa colocar a sua resposta; como no caso é o dia e o
 * horário, cada um dá palpite com um calendário"). As regras:
 *
 * - SÓ PONTOS. O Syden não anota nem move dinheiro; se a turma combinar algum, é por fora.
 * - UMA PERGUNTA, com uma foto se quiser, e cada membro dá UM palpite de dia e hora (pode mudar enquanto está aberto).
 * - FECHA na hora marcada por quem criou, quando quem cuida fecha na mão, ou quando a resposta sai. Os palpites dos outros
 *   só aparecem depois de fechar: antes, dava para palpitar um minuto depois de alguém.
 * - GANHA QUEM CHEGOU MAIS PERTO da resposta, que quem cuida lança (quem criou e quem administra). Quem empata na menor
 *   distância (uma hora antes e uma hora depois) também ganha: são os ganhadores; na lista, quem palpitou antes vem primeiro.
 *
 * Quem não participa da comunidade recebe 404, como no calendário. Mudou um bolão, a turma relê (bolao:mudou); o palpite
 * de cada um não avisa ninguém. A foto passa pelo funil das imagens (tipo, tamanho, pixels, Shield) e é servida pela chave
 * do endereço, que só quem é da comunidade recebe: <img> não manda o token de login.
 */
const PERGUNTA_MAXIMA = 200;
const BOLOES_MAXIMOS = 30;
const FOTO_MAXIMA = 4 * 1024 * 1024;
const ANO = 365 * 24 * 60 * 60 * 1000;
const NAO_ENCONTRADA = 'Comunidade não encontrada.';
const BOLAO_NAO_ENCONTRADO = 'Bolão não encontrado.';
const SO_QUEM_CUIDA = 'Só quem criou o bolão ou quem administra a comunidade pode fazer isso.';

const limpar = (valor: unknown, maximo: number) => {
  const limpo = String(valor ?? '').replace(/(?!\u{200D})[\p{Cc}\p{Cf}]/gu, '').trim().replace(/\s+/g, ' ');
  return /[^\s\u{200D}]/u.test(limpo) && limpo.length <= maximo ? limpo : null;
};

/** Uma data ISO dentro de uma janela razoável (de 10 anos atrás a 10 anos à frente), ou null. */
const dataValida = (valor: unknown): string | null => {
  const ms = typeof valor === 'string' ? Date.parse(valor) : NaN;
  if (!Number.isFinite(ms) || Math.abs(ms - Date.now()) > 10 * ANO) return null;
  return new Date(ms).toISOString();
};

/** Ainda se palpita? Não depois de fechado na mão, da hora marcada ou da resposta. */
export function aberto(bolao: Pick<db.Bolao, 'fechado' | 'fechaEm' | 'resposta'>, agora = Date.now()): boolean {
  return !bolao.fechado && bolao.resposta === null && (bolao.fechaEm === null || Date.parse(bolao.fechaEm) > agora);
}

/** A classificação: quem chegou mais perto primeiro (no empate, quem palpitou antes), e quem ganhou: todos na menor distância. */
export function classificar<P extends { quando: string; em: string }>(palpites: P[], resposta: string): (P & { diferencaMs: number; ganhou: boolean })[] {
  const alvo = Date.parse(resposta);
  const ordem = palpites
    .map((p) => ({ ...p, diferencaMs: Date.parse(p.quando) - alvo }))
    .sort((a, b) => Math.abs(a.diferencaMs) - Math.abs(b.diferencaMs) || a.em.localeCompare(b.em));
  const menor = ordem.length ? Math.abs(ordem[0].diferencaMs) : 0;
  return ordem.map((p) => ({ ...p, ganhou: Math.abs(p.diferencaMs) === menor }));
}

export function registerBolaoRoutes(app: FastifyInstance, io: IOServer) {
  // A foto da pergunta, pela chave que só quem é da comunidade recebe (ver acima).
  app.get<{ Params: { id: string; chave: string } }>('/api/boloes/:id/foto/:chave', async (request, reply) =>
    entregarArquivo(request, reply, db.fotoDoBolao(Number(request.params.id), String(request.params.chave))),
  );

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);
    const avisar = (communityId: number, bolaoId: number | null) => io.to(communityRoom(communityId)).emit('bolao:mudou', { communityId, bolaoId });

    /** O papel na comunidade, ou null (a rota responde 404). */
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
      return { boloes: db.boloesDaComunidade(c.communityId).map((b) => ({ ...b, aberto: aberto(b) })) };
    });

    authed.post<{ Params: { id: string }; Body: { pergunta?: unknown; fechaEm?: unknown; imagem?: unknown } }>(
      '/api/communities/:id/boloes',
      { bodyLimit: 6 * 1024 * 1024 },
      async (request, reply) => {
        const c = papelDe(request.params.id, request.user.id);
        if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
        const pergunta = limpar(request.body?.pergunta, PERGUNTA_MAXIMA);
        if (!pergunta) return reply.code(400).send({ error: `A pergunta deve ter de 1 a ${PERGUNTA_MAXIMA} caracteres.` });
        let fechaEm: string | null = null;
        if (request.body?.fechaEm !== undefined && request.body?.fechaEm !== null && request.body?.fechaEm !== '') {
          fechaEm = dataValida(request.body.fechaEm);
          if (!fechaEm || Date.parse(fechaEm) <= Date.now()) return reply.code(400).send({ error: 'A hora de fechar os palpites tem que ser no futuro.' });
        }
        if (db.boloesDaComunidade(c.communityId).length >= BOLOES_MAXIMOS) {
          return reply.code(409).send({ error: `Esta comunidade já tem ${BOLOES_MAXIMOS} bolões, o máximo.` });
        }
        let foto: { sha: string; mime: string } | null = null;
        if (request.body?.imagem) {
          const media = await parseMediaConferida(request.body.imagem, 'image', FOTO_MAXIMA, 'bolao', c.communityId);
          if (typeof media === 'string') return reply.code(400).send({ error: media });
          foto = { sha: guardarArquivo(media.data).sha, mime: media.mime };
        }
        const bolao = db.criarBolao(c.communityId, request.user.id, pergunta, fechaEm, foto);
        avisar(c.communityId, null);
        return reply.code(201).send({ ...bolao, aberto: aberto(bolao) });
      },
    );

    authed.get<{ Params: { id: string; bolaoId: string } }>('/api/communities/:id/boloes/:bolaoId', async (request, reply) => {
      const c = papelDe(request.params.id, request.user.id);
      if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
      if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
      const palpites = db.palpitesDoBolao(c.communityId, bolao.id);
      const estaAberto = aberto(bolao);
      const meu = palpites.find((p) => p.userId === request.user.id);
      return {
        bolao: { ...bolao, aberto: estaAberto },
        meu: meu ? meu.quando : null,
        // os dos outros só depois de fechar (antes, dava para palpitar colado em alguém); antes, só quantos
        palpites: estaAberto ? null : bolao.resposta ? classificar(palpites, bolao.resposta) : palpites,
        podeEditar: cuida(bolao, c.papel, request.user.id),
      };
    });

    authed.delete<{ Params: { id: string; bolaoId: string } }>('/api/communities/:id/boloes/:bolaoId', async (request, reply) => {
      const c = papelDe(request.params.id, request.user.id);
      if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
      if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
      if (!cuida(bolao, c.papel, request.user.id)) return reply.code(403).send({ error: SO_QUEM_CUIDA });
      db.apagarBolao(c.communityId, bolao.id);
      avisar(c.communityId, bolao.id);
      return { ok: true };
    });

    /** Fechar os palpites na mão, ou reabrir (a hora marcada, se passou, continua fechando). */
    authed.put<{ Params: { id: string; bolaoId: string }; Body: { fechado?: unknown } }>('/api/communities/:id/boloes/:bolaoId/fechado', async (request, reply) => {
      const c = papelDe(request.params.id, request.user.id);
      if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
      if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
      if (!cuida(bolao, c.papel, request.user.id)) return reply.code(403).send({ error: SO_QUEM_CUIDA });
      if (typeof request.body?.fechado !== 'boolean') return reply.code(400).send({ error: 'Diga se fecha ou reabre.' });
      db.fecharBolao(bolao.id, request.body.fechado);
      avisar(c.communityId, bolao.id);
      return { ok: true };
    });

    /** A resposta certa (fecha os palpites); null volta a "sem resposta", para corrigir uma digitada errado. */
    authed.put<{ Params: { id: string; bolaoId: string }; Body: { resposta?: unknown } }>('/api/communities/:id/boloes/:bolaoId/resposta', async (request, reply) => {
      const c = papelDe(request.params.id, request.user.id);
      if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
      if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
      if (!cuida(bolao, c.papel, request.user.id)) return reply.code(403).send({ error: SO_QUEM_CUIDA });
      const resposta = request.body?.resposta === null ? null : dataValida(request.body?.resposta);
      if (request.body?.resposta !== null && !resposta) return reply.code(400).send({ error: 'Data inválida.' });
      db.responderBolao(bolao.id, resposta);
      avisar(c.communityId, bolao.id);
      return { ok: true };
    });

    authed.put<{ Params: { id: string; bolaoId: string }; Body: { quando?: unknown } }>('/api/communities/:id/boloes/:bolaoId/palpite', async (request, reply) => {
      const c = papelDe(request.params.id, request.user.id);
      if (!c) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const bolao = db.bolaoDaComunidade(c.communityId, Number(request.params.bolaoId));
      if (!bolao) return reply.code(404).send({ error: BOLAO_NAO_ENCONTRADO });
      if (!aberto(bolao)) return reply.code(409).send({ error: 'Os palpites deste bolão já fecharam.' });
      const quando = dataValida(request.body?.quando);
      if (!quando) return reply.code(400).send({ error: 'Data inválida.' });
      const primeiro = !db.palpitesDoBolao(c.communityId, bolao.id).some((p) => p.userId === request.user.id);
      db.palpitar(bolao.id, request.user.id, quando);
      // só o número de palpites muda para os outros: avisa no primeiro, e não a cada troca
      if (primeiro) avisar(c.communityId, bolao.id);
      return { ok: true };
    });
  });
}
