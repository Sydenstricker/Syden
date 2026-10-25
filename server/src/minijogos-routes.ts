import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Server as IOServer, Socket } from 'socket.io';
import * as db from './db.js';
import { desenho } from './minijogo-desenho.js';
import type { Contexto, Definicao, Jogo } from './minijogo-motor.js';
import { lobisomem } from './minijogo-lobisomem.js';
import { palavra } from './minijogo-palavra.js';
import { catalogo, criarQuiz, TEMAS } from './minijogo-quiz.js';
import { stop } from './minijogo-stop.js';
import { sudoku } from './minijogo-sudoku.js';
import { gomoku, mancala } from './minijogo-tabuleiro.js';
import { xadrez } from './minijogo-xadrez.js';
import { PLACAR_MS, tamanho } from './minijogos.js';
import { communityRoom, emitToUser, quemEstaNaSala, salaDeVozDe } from './realtime.js';
import { manages, requireUser } from './routes.js';

/**
 * As rotas dos mini-games (ver minijogo-motor.ts). Como o palco: as ações vão por HTTP, e a cada mudança a
 * comunidade recebe 'minijogo:mudou' e quem está na sala busca o estado de novo — cada um o SEU estado,
 * porque o que se vê depende de quem pede (as próprias respostas, o próprio tabuleiro).
 *
 * Jogar exige ESTAR NA SALA DE VOZ: o jogo é da turma que está conversando. Ver o estado basta participar
 * da comunidade, para quem entra no meio já cair na rodada certa.
 *
 * O CONVITE (13/10/2026). O painel abria sozinho para a sala inteira, e todo mundo virava jogador: com três pessoas
 * transmitindo outro jogo, o Stop ficava preso esperando o "pronto" delas. Agora quem começa CONVIDA (`convidar`):
 * a partida nasce como convite, cada um da sala responde "Jogar" ou "Agora não", e quem começou dá a largada com
 * quem aceitou. Só eles jogam (ctx.naSala); os outros podem abrir e assistir. Os jogos de mesa começam na hora,
 * porque a mesa já é o convite, e quem senta vira jogador. Sem `convidar` (um site anterior), tudo como antes.
 *
 * A PARTIDA MORA SÓ NA MEMÓRIA. Ela dura minutos e não vale nada depois; reiniciar o servidor acaba com
 * ela, como acaba com a chamada. Sem tabela, sem limpeza.
 */
export const JOGOS: Record<string, Definicao> = {
  tamanho,
  stop,
  sudoku,
  gomoku,
  mancala,
  xadrez,
  lobisomem,
  desenho,
  palavra,
  // Os quizzes de adivinhar (minijogo-quiz.ts): um jogo por tema, todos no mesmo motor.
  ...Object.fromEntries(Object.entries(TEMAS).map(([id, tema]) => [id, criarQuiz(tema)])),
};

/**
 * OS JOGOS QUE SE JOGAM SOZINHO (pedido dele, 24/10/2026: "na aba solo joga sozinho, na coletiva manda convite"). Os
 * mesmos seis aparecem nas duas abas da estante; no Solo, a partida é da PESSOA, e não da sala: começa sem convite, não
 * ocupa a sala (a turma continua podendo começar o jogo dela), não pede chamada (dá para jogar pelo computador do
 * quarto) e não conta nas conquistas da turma, que medem gente junta.
 */
export const JOGOS_SOLO = new Set(['tamanho', 'xadrez', 'sudoku', ...Object.keys(TEMAS)]);

interface Partida {
  channelId: number;
  communityId: number;
  /** A partida solo: de quem a começou (`criadaPor`), sem sala; channelId e communityId valem 0. */
  solo: boolean;
  jogo: string;
  criadaPor: number;
  terminada: boolean;
  /** Quando o relógio da partida dispara (hora do servidor). */
  ate: number;
  relogio: ReturnType<typeof setTimeout> | null;
  instancia: Jogo | null;
  /** A linha da partida na estatística do painel de uso (ver db.registrarPartida). */
  registro: number | null;
  /** Quem joga. null = a sala inteira (a partida começada por um site anterior ao convite). */
  jogadores: Set<number> | null;
  /** Quem respondeu "Agora não": o convite não volta para essa pessoa nesta partida. */
  recusaram: Set<number>;
  /** Enquanto é convite: o que veio no pedido de começar, guardado para a largada. */
  convite: { corpo: Record<string, unknown> } | null;
}

/** Quanto o convite espera a largada antes de se desfazer sozinho. */
export const CONVITE_MS = 3 * 60_000;

const partidas = new Map<number, Partida>();
/** As partidas solo, por pessoa. */
const solos = new Map<number, Partida>();

/** Para os testes: as partidas de agora. */
export const _partidas = partidas;
export const _solos = solos;

export function registerMinijogosRoutes(app: FastifyInstance, io: IOServer) {
  const nome = (userId: number) => db.findUserById(userId)?.username ?? '?';
  /** Quem joga e está na sala agora (com o convite, só quem aceitou). */
  const presentes = (p: Partida) => {
    if (p.solo) return [p.criadaPor];
    const naSala = quemEstaNaSala(p.channelId);
    return p.jogadores ? naSala.filter((id) => p.jogadores!.has(id)) : naSala;
  };
  const avisar = (p: Partida) =>
    p.solo ? emitToUser(io, p.criadaPor, 'minijogo-solo:mudou', {}) : io.to(communityRoom(p.communityId)).emit('minijogo:mudou', { channelId: p.channelId });

  function agendar(p: Partida, ms: number, depois: () => void) {
    if (p.relogio) clearTimeout(p.relogio);
    p.ate = Date.now() + ms;
    p.relogio = setTimeout(() => {
      // Os jogadores saíram da sala: a partida acaba junto, sem esperar ninguém.
      if (presentes(p).length === 0) return encerrar(p);
      depois();
    }, ms);
    p.relogio.unref?.();
  }

  function encerrar(p: Partida) {
    if (p.relogio) clearTimeout(p.relogio);
    // Encerrada antes do placar final (se já tinha terminado, a linha já está fechada e nada muda).
    if (p.registro !== null) db.fecharPartida(p.registro, false);
    if (p.solo) {
      if (solos.get(p.criadaPor) === p) solos.delete(p.criadaPor);
    } else if (partidas.get(p.channelId) === p) partidas.delete(p.channelId);
    avisar(p);
  }

  const pessoas = (ids: Iterable<number>) => [...ids].map((userId) => ({ userId, username: nome(userId) }));
  const estado = (p: Partida, quem: number) => ({
    jogo: p.jogo,
    criadaPor: p.criadaPor,
    solo: p.solo,
    terminada: p.terminada,
    restanteMs: Math.max(0, p.ate - Date.now()),
    // O convite: quem vai jogar, quem disse "agora não", e o mínimo para dar a largada.
    // ("presentes": dos que aceitaram, quantos estão na sala agora: é o que a largada conta)
    convite: p.convite ? { minimo: JOGOS[p.jogo].minimo ?? 1, presentes: presentes(p).length } : null,
    jogadores: p.jogadores ? pessoas(p.jogadores) : null,
    recusaram: pessoas(p.recusaram),
    souJogador: p.jogadores ? p.jogadores.has(quem) : true,
    recusei: p.recusaram.has(quem),
    ...p.instancia?.publico(quem),
  });

  /** Dá a largada: o jogo começa com quem aceitou e está na sala. Devolve o erro, ou null. */
  function largar(p: Partida, corpo: Record<string, unknown>): string | null {
    const ctx: Contexto = {
      agendar: (ms, depois) => agendar(p, ms, depois),
      avisar: () => avisar(p),
      terminar: () => {
        p.terminada = true;
        if (p.registro !== null) db.fecharPartida(p.registro, true);
        agendar(p, PLACAR_MS, () => encerrar(p));
        avisar(p);
      },
      naSala: () => presentes(p),
      nome,
    };
    // O relógio do convite sai antes: um jogo que não marca relógio ao começar herdaria o fim do convite.
    if (p.relogio) clearTimeout(p.relogio);
    p.relogio = null;
    p.ate = 0;
    const naSala = presentes(p);
    const instancia = JOGOS[p.jogo].comecar(ctx, { naSala, criadaPor: p.criadaPor, corpo });
    if (typeof instancia === 'string') {
      if (p.relogio) clearTimeout(p.relogio);
      // A largada recusada (revisão de 16/10/2026): o convite segue de pé, e com o relógio dele de volta. Sem isso ele
      // ficava sem prazo, e a sala inteira presa em "já tem uma partida acontecendo".
      if (p.convite) agendar(p, CONVITE_MS, () => encerrar(p));
      return instancia;
    }
    p.instancia = instancia;
    p.convite = null;
    // A partida solo não entra na estatística: ela é da turma (conquistas, painel de uso), e conta gente junta.
    if (!p.solo) p.registro = db.registrarPartida(p.jogo, p.communityId, p.channelId, p.criadaPor, naSala);
    return null;
  }

  // QUEM SAIU DA SALA (revisão de 16/10/2026): a rodada que só esperava essa pessoa segue sem ela, sem esperar o relógio.
  const conferencia = setInterval(() => {
    for (const p of [...partidas.values(), ...solos.values()]) if (p.instancia && !p.terminada && !p.convite) p.instancia.conferir?.();
  }, 4000);
  conferencia.unref?.();
  app.addHook('onClose', async () => clearInterval(conferencia));

  // O que precisa chegar NA HORA (o traço do desenho) vem pelo socket e vai direto a quem está na sala,
  // sem o "mudou, busque de novo" das rotas. O jogo decide o que aceita (ver `tempoReal` no motor).
  io.on('connection', (socket: Socket) => {
    socket.on('minijogo:tempo-real', (dados: { channelId?: unknown; dados?: unknown }) => {
      const userId = (socket.data.user as { id: number } | undefined)?.id;
      const channelId = Number(dados?.channelId);
      const p = partidas.get(channelId);
      if (!userId || !p?.instancia?.tempoReal || p.terminada || salaDeVozDe(userId)?.channelId !== channelId) return;
      const repassar = p.instancia.tempoReal(userId, dados.dados);
      if (repassar === null || repassar === undefined) return;
      for (const id of quemEstaNaSala(channelId)) {
        if (id !== userId) emitToUser(io, id, 'minijogo:tempo-real', { channelId, dados: repassar });
      }
    });
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** A sala de voz e se quem pede participa da comunidade; senão a resposta de recusa já vai. */
    function sala(id: string, userId: number, reply: FastifyReply) {
      const canal = db.findChannel(Number(id));
      if (!canal || canal.type !== 'voice' || canal.communityId === null || !db.memberRole(canal.communityId, userId)) {
        void reply.code(404).send({ error: 'Sala de voz não encontrada.' });
        return undefined;
      }
      return { ...canal, communityId: canal.communityId };
    }

    const estaNaSala = (userId: number, channelId: number) => salaDeVozDe(userId)?.channelId === channelId;

    // A lista de um quiz para chutar: id e nome no idioma de quem pede. Não diz qual é o secreto, e por isso não pede sala.
    authed.get<{ Params: { tema: string }; Querystring: { idioma?: string } }>('/api/minijogos/quiz/:tema', async (request, reply) => {
      const tema = TEMAS[request.params.tema];
      if (!tema) return reply.code(404).send({ error: 'Quiz desconhecido.' });
      return { itens: catalogo(tema, String(request.query.idioma ?? 'pt-BR').slice(0, 20)) };
    });

    // ---- A PARTIDA SOLO (ver JOGOS_SOLO): da pessoa, sem sala. ----
    authed.get('/api/minijogo-solo', async (request) => {
      const p = solos.get(request.user.id);
      return { partida: p ? estado(p, request.user.id) : null };
    });

    authed.post<{ Body: Record<string, unknown> & { jogo?: string } }>('/api/minijogo-solo', async (request, reply) => {
      const jogo = request.body?.jogo ?? '';
      if (!JOGOS_SOLO.has(jogo) || !JOGOS[jogo]) return reply.code(400).send({ error: 'Este jogo não se joga sozinho.' });
      // Começar outra troca a de antes: a partida solo é uma só por pessoa.
      const antes = solos.get(request.user.id);
      if (antes) encerrar(antes);
      const { jogo: _, convidar: __, ...corpo } = request.body ?? {};
      const p: Partida = {
        channelId: 0,
        communityId: 0,
        solo: true,
        jogo,
        criadaPor: request.user.id,
        terminada: false,
        ate: 0,
        relogio: null,
        instancia: null,
        registro: null,
        jogadores: null,
        recusaram: new Set(),
        convite: null,
      };
      const erro = largar(p, corpo);
      if (erro) return reply.code(400).send({ error: erro });
      solos.set(request.user.id, p);
      return { partida: estado(p, request.user.id) };
    });

    authed.post<{ Body: Record<string, unknown> }>('/api/minijogo-solo/acao', async (request, reply) => {
      const p = solos.get(request.user.id);
      if (!p?.instancia || p.terminada) return reply.code(409).send({ error: 'A partida acabou.' });
      const erro = p.instancia.acao(request.user.id, request.body ?? {});
      if (erro) return reply.code(409).send({ error: erro });
      return { partida: estado(p, request.user.id) };
    });

    authed.delete('/api/minijogo-solo', async (request) => {
      const p = solos.get(request.user.id);
      if (p) encerrar(p);
      return { ok: true };
    });

    authed.get<{ Params: { id: string } }>('/api/channels/:id/minijogo', async (request, reply) => {
      const canal = sala(request.params.id, request.user.id, reply);
      if (!canal) return reply;
      const p = partidas.get(canal.id);
      return { partida: p ? estado(p, request.user.id) : null };
    });

    authed.post<{ Params: { id: string }; Body: Record<string, unknown> & { jogo?: string } }>(
      '/api/channels/:id/minijogo',
      async (request, reply) => {
        const canal = sala(request.params.id, request.user.id, reply);
        if (!canal) return reply;
        const definicao = JOGOS[request.body?.jogo ?? ''];
        if (!definicao) return reply.code(400).send({ error: 'Jogo desconhecido.' });
        if (!estaNaSala(request.user.id, canal.id)) return reply.code(403).send({ error: 'Entre na sala de voz para jogar com a turma.' });
        const atual = partidas.get(canal.id);
        // O convite de quem já saiu da sala não segura a sala: um jogo novo o substitui.
        if (atual && !atual.terminada && atual.convite && !estaNaSala(atual.criadaPor, canal.id)) encerrar(atual);
        else if (atual && !atual.terminada) return reply.code(409).send({ error: 'Já tem uma partida acontecendo nesta sala.' });
        if (atual?.relogio) clearTimeout(atual.relogio);

        const convidar = request.body?.convidar === true;
        const { convidar: _, ...corpo } = request.body ?? {};
        const p: Partida = {
          channelId: canal.id,
          communityId: canal.communityId,
          solo: false,
          jogo: request.body!.jogo!,
          criadaPor: request.user.id,
          terminada: false,
          ate: 0,
          relogio: null,
          instancia: null,
          registro: null,
          jogadores: convidar ? new Set([request.user.id]) : null,
          recusaram: new Set(),
          convite: convidar && !definicao.mesa ? { corpo } : null,
        };
        if (p.convite) {
          // Só o convite: ninguém joga ainda, e ele se desfaz sozinho se a largada não vier.
          agendar(p, CONVITE_MS, () => encerrar(p));
        } else {
          const erro = largar(p, corpo);
          if (erro) return reply.code(400).send({ error: erro });
        }
        partidas.set(canal.id, p);
        avisar(p);
        return { partida: estado(p, request.user.id) };
      },
    );

    authed.post<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/channels/:id/minijogo/acao', async (request, reply) => {
      const canal = sala(request.params.id, request.user.id, reply);
      if (!canal) return reply;
      const p = partidas.get(canal.id);
      if (p?.convite) return reply.code(409).send({ error: 'A partida ainda não começou.' });
      if (!p?.instancia || p.terminada) return reply.code(409).send({ error: 'A partida acabou.' });
      if (!estaNaSala(request.user.id, canal.id)) return reply.code(403).send({ error: 'Entre na sala de voz para jogar com a turma.' });
      // Quem não aceitou o convite assiste. Na mesa, sentar é o jeito de aceitar, e o jogo decide quem pode.
      const mesa = JOGOS[p.jogo].mesa === true;
      if (p.jogadores && !mesa && !p.jogadores.has(request.user.id)) {
        return reply.code(403).send({ error: 'Você está assistindo esta partida.' });
      }
      const erro = p.instancia.acao(request.user.id, request.body ?? {});
      if (erro) return reply.code(409).send({ error: erro });
      if (mesa && p.jogadores && request.body?.tipo === 'sentar') {
        p.jogadores.add(request.user.id);
        p.recusaram.delete(request.user.id);
      }
      return { partida: estado(p, request.user.id) };
    });

    /**
     * A resposta ao convite: 'jogar' entra, 'sair' desiste antes da largada, 'agora-nao' recusa (e o convite não
     * volta para essa pessoa nesta partida). Quem começou não sai do próprio convite: ele o cancela (DELETE).
     */
    authed.post<{ Params: { id: string }; Body: { resposta?: string } }>('/api/channels/:id/minijogo/convite', async (request, reply) => {
      const canal = sala(request.params.id, request.user.id, reply);
      if (!canal) return reply;
      const p = partidas.get(canal.id);
      if (!p || p.terminada) return reply.code(409).send({ error: 'A partida acabou.' });
      const quem = request.user.id;
      const resposta = request.body?.resposta;
      if (resposta === 'agora-nao') {
        // Recusar vale também depois da largada (e na mesa): o aviso some e não volta.
        if (quem !== p.criadaPor) {
          p.recusaram.add(quem);
          if (p.convite) p.jogadores?.delete(quem);
        }
      } else if (resposta === 'jogar' || resposta === 'sair') {
        if (!p.convite || !p.jogadores) return reply.code(409).send({ error: 'A partida já começou.' });
        if (resposta === 'jogar') {
          if (!estaNaSala(quem, canal.id)) return reply.code(403).send({ error: 'Entre na sala de voz para jogar com a turma.' });
          p.jogadores.add(quem);
          p.recusaram.delete(quem);
        } else if (quem !== p.criadaPor) {
          p.jogadores.delete(quem);
        }
      } else {
        return reply.code(400).send({ error: 'Resposta desconhecida.' });
      }
      avisar(p);
      return { partida: estado(p, quem) };
    });

    /** A largada: quem começou o convite começa a partida com quem aceitou. */
    authed.post<{ Params: { id: string } }>('/api/channels/:id/minijogo/largada', async (request, reply) => {
      const canal = sala(request.params.id, request.user.id, reply);
      if (!canal) return reply;
      const p = partidas.get(canal.id);
      if (!p?.convite) return reply.code(409).send({ error: 'A partida já começou.' });
      if (p.criadaPor !== request.user.id) return reply.code(403).send({ error: 'Só quem começou dá a largada.' });
      if (!estaNaSala(request.user.id, canal.id)) return reply.code(403).send({ error: 'Entre na sala de voz para jogar com a turma.' });
      const minimo = JOGOS[p.jogo].minimo ?? 1;
      if (presentes(p).length < minimo) return reply.code(409).send({ error: 'Ainda falta gente para começar.' });
      const erro = largar(p, p.convite.corpo);
      if (erro) return reply.code(400).send({ error: erro });
      avisar(p);
      return { partida: estado(p, request.user.id) };
    });

    authed.delete<{ Params: { id: string } }>('/api/channels/:id/minijogo', async (request, reply) => {
      const canal = sala(request.params.id, request.user.id, reply);
      if (!canal) return reply;
      const p = partidas.get(canal.id);
      if (!p) return { ok: true };
      // Fecha quem começou, quem administra, ou qualquer um da sala depois do placar final.
      const pode =
        p.criadaPor === request.user.id ||
        manages(db.memberRole(canal.communityId, request.user.id)) ||
        (p.terminada && estaNaSala(request.user.id, canal.id)) ||
        // o convite de quem saiu da sala: qualquer um que está nela o desfaz
        (p.convite !== null && !estaNaSala(p.criadaPor, canal.id) && estaNaSala(request.user.id, canal.id));
      if (!pode) return reply.code(403).send({ error: 'Só quem começou a partida pode encerrá-la antes do fim.' });
      encerrar(p);
      return { ok: true };
    });
  });
}
