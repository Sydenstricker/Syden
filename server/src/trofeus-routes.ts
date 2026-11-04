/**
 * A ESTANTE DE TROFÉUS e QUEM ENTRA NO QUARTO (03/11/2026, decisões dele).
 *
 * A estante do quarto é o lugar de TODOS os troféus dos mini-games (os pódios na sala, corrida_trofeus) e das conquistas
 * da turma de cada comunidade da pessoa (os degraus alcançados, conquistas.ts). A pessoa escolhe até DESTAQUES_MAX para
 * deixar em destaque, e é o destaque que quem visita o quarto vê, com tudo: o jogo, a posição, o tempo, a data e contra
 * quem ("se ele permitiu a visita, presumo que não seja um problema contra quem ele ganhou").
 *
 * Porque a visita mostra isso, o quarto deixou de ser aberto a qualquer conta (era a decisão de 15/10/2026): cada pessoa
 * escolhe, como o perfil da Steam,
 * - 'publico': qualquer conta visita;
 * - 'amigos' (o de fábrica): os amigos aceitos visitam;
 * - 'privado': nem os amigos, só quem ela convidar.
 * Convida-se da lista de AMIGOS, e o convite só vale enquanto a amizade dura (desfazer a amizade ou bloquear apaga o
 * convite; revisão de 03/11/2026: sem isso, quem deixou de ser amigo continuava entrando, e o dono nem via o convite na
 * tela). Menor de idade (protecao.ts) não abre o quarto a todo mundo: o "público" dele vale como "amigos" — é a regra do
 * fechado por padrão do ECA Digital (arts. 7 e 17).
 *
 * O bloqueio fecha a porta em qualquer modo, e a resposta é a mesma de "não está aberto": quem foi bloqueado não descobre.
 * Rival que tem bloqueio com quem visita não aparece no troféu para essa pessoa, e rival MENOR DE IDADE só aparece para
 * quem é amigo dele (o nome de um adolescente não vai a desconhecidos pelo quarto de outra pessoa).
 */
import type { FastifyInstance } from 'fastify';
import type { Server } from 'socket.io';
import { CONQUISTAS, conquistasDaComunidade } from './conquistas.js';
import * as db from './db.js';
import { Freio } from './freio.js';
import { ehMenor, faixaDaConta } from './protecao.js';
import { salaDaPessoa } from './realtime.js';
import { requireUser } from './routes.js';

export const DESTAQUES_MAX = 6;
export const MODOS_DO_QUARTO = ['publico', 'amigos', 'privado'] as const;
export type ModoDoQuarto = (typeof MODOS_DO_QUARTO)[number];
/** Quantas pessoas cabem na lista de convidados: folgado para uma turma, e um teto para a tabela. */
export const CONVIDADOS_MAX = 100;

const menor = (userId: number) => ehMenor(faixaDaConta(db.protecaoDe(userId)));
const saoAmigos = (a: number, b: number) => db.amizadeEntre(a, b)?.situacao === 'aceita';

/** O modo que vale: o escolhido, com o "público" de um menor valendo como "amigos". */
export function modoDoQuarto(dono: number): ModoDoQuarto {
  const modo = db.acessoDoQuarto(dono);
  return modo === 'publico' && menor(dono) ? 'amigos' : modo;
}

/** Quem pode entrar no quarto de quem. */
export function podeVisitarQuarto(visitante: number, dono: number): boolean {
  if (visitante === dono) return true;
  if (!db.findUserById(dono) || db.ehContaDoSistema(dono) || db.haBloqueio(visitante, dono)) return false;
  const modo = modoDoQuarto(dono);
  if (modo === 'publico') return true;
  if (!saoAmigos(visitante, dono)) return false;
  return modo === 'amigos' || db.foiConvidadoAoQuarto(dono, visitante);
}

const JOGO_DA_CONQUISTA = new Map(CONQUISTAS.map((c) => [c.id, c.jogo]));

/**
 * As conquistas da turma alcançadas nas comunidades da pessoa: o degrau mais alto de cada uma. `medir` refaz as contas
 * (só na estante do próprio dono, como o painel do salão faz); senão, lê o que está gravado — o degrau alcançado nunca se
 * perde, e medir varre as sessões e as mensagens da comunidade inteira (revisão de 03/11/2026: quem visita não paga isso).
 * `so`: só estas comunidades.
 */
export function conquistasDe(userId: number, { medir = false, so }: { medir?: boolean; so?: Set<number> } = {}) {
  const saida: { chave: string; communityId: number; comunidade: string; conquista: string; jogo?: string; degrau: number; em: string }[] = [];
  for (const c of db.listCommunitiesForUser(userId)) {
    if (so && !so.has(c.id)) continue;
    if (medir) conquistasDaComunidade(c.id);
    const topo = new Map<string, { degrau: number; em: string }>();
    for (const a of db.conquistasAlcancadas(c.id)) {
      if (!JOGO_DA_CONQUISTA.has(a.conquista)) continue;
      const antes = topo.get(a.conquista);
      if (!antes || a.degrau > antes.degrau) topo.set(a.conquista, a);
    }
    for (const [id, a] of topo) {
      saida.push({ chave: `c:${c.id}:${id}`, communityId: c.id, comunidade: c.name, conquista: id, jogo: JOGO_DA_CONQUISTA.get(id), degrau: a.degrau, em: a.em });
    }
  }
  return saida;
}

/** As comunidades citadas nas chaves de conquista ("c:<comunidade>:<conquista>"). */
const comunidadesDas = (chaves: string[]) => new Set(chaves.filter((k) => k.startsWith('c:')).map((k) => Number(k.split(':')[1])));

/** O que está em destaque, já resolvido: só o que ainda existe (o troféu, e a conquista de uma comunidade onde a pessoa está). */
function destaqueResolvido(userId: number, visitante: number) {
  const chaves = db.destaqueDe(userId);
  if (!chaves.length) return [];
  const trofeus = new Map(db.trofeusDe(userId).map((t) => [`t:${t.id}`, t]));
  const so = comunidadesDas(chaves);
  const conquistas = so.size ? new Map(conquistasDe(userId, { so }).map((c) => [c.chave, c])) : new Map();
  const itens = [];
  for (const chave of chaves) {
    const t = trofeus.get(chave);
    if (t) {
      const rivais =
        visitante === userId
          ? t.rivais
          : t.rivais.filter((r) => r.userId === visitante || (!db.haBloqueio(visitante, r.userId) && (!menor(r.userId) || saoAmigos(visitante, r.userId))));
      itens.push({ tipo: 'trofeu' as const, chave, ...t, rivais });
      continue;
    }
    const c = conquistas.get(chave);
    if (c) itens.push({ tipo: 'conquista' as const, ...c });
  }
  return itens;
}

/** Visitas e o que se pergunta sobre um quarto: o mesmo freio das visitas (ids sequenciais diriam quem tem quarto). */
const freioDeConsultas = new Freio(120, 60 * 60_000);

export function registerTrofeusRoutes(app: FastifyInstance, io: Server) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** A minha estante: os troféus, as conquistas das minhas turmas e o que está em destaque. */
    authed.get('/api/trofeus', async (request) => {
      const eu = request.user.id;
      return { trofeus: db.trofeusDe(eu), conquistas: conquistasDe(eu, { medir: true }), destaque: destaqueResolvido(eu, eu).map((i) => i.chave), maximo: DESTAQUES_MAX };
    });

    authed.put<{ Body: { itens?: unknown } }>('/api/trofeus/destaque', async (request, reply) => {
      const eu = request.user.id;
      const itens = request.body?.itens;
      if (!Array.isArray(itens) || itens.length > DESTAQUES_MAX || !itens.every((i) => typeof i === 'string' && i.length <= 40)) {
        return reply.code(400).send({ error: 'Escolha até 6 para o destaque.' }); // (o texto inteiro, para a tradução achar; DESTAQUES_MAX)
      }
      const unicos = [...new Set(itens as string[])];
      const trofeus = new Set(db.trofeusDe(eu).map((t) => `t:${t.id}`));
      const so = comunidadesDas(unicos);
      const conquistas = so.size ? new Set(conquistasDe(eu, { so }).map((c) => c.chave)) : new Set<string>();
      if (!unicos.every((k) => trofeus.has(k) || conquistas.has(k))) return reply.code(400).send({ error: 'Esse troféu não é seu.' });
      db.guardarDestaque(eu, unicos);
      return { destaque: unicos };
    });

    /**
     * Os quartos dos meus amigos em que eu posso entrar, e quem me convidou (a tela de Amigos: é o lugar onde quem estava
     * fora quando foi convidado acha o convite, já que o aviso na hora só chega a quem está com o Syden aberto).
     */
    authed.get('/api/quartos-abertos', async (request) => {
      const eu = request.user.id;
      const quartos = db
        .listarAmizades(eu)
        .filter((a) => a.situacao === 'aceita' && podeVisitarQuarto(eu, a.userId))
        .map((a) => ({ id: a.userId, convidou: db.foiConvidadoAoQuarto(a.userId, eu) && modoDoQuarto(a.userId) === 'privado' }));
      return { quartos };
    });

    /** Se dá para visitar o quarto de alguém (o cartão de perfil só mostra "Visitar o quarto" quando dá). */
    authed.get<{ Params: { id: string } }>('/api/quarto/:id/acesso', async (request, reply) => {
      const dono = Number(request.params.id);
      if (!Number.isInteger(dono) || dono <= 0) return reply.code(400).send({ error: 'Pedido inválido.' });
      if (dono !== request.user.id && freioDeConsultas.tentar(String(request.user.id))) {
        return reply.code(429).send({ error: 'Muitas visitas seguidas. Tente de novo daqui a pouco.' });
      }
      return { podeVisitar: dono !== request.user.id && podeVisitarQuarto(request.user.id, dono) };
    });

    /** O destaque da estante de quem mora no quarto, para quem está visitando. */
    authed.get<{ Params: { id: string } }>('/api/quarto/:id/trofeus', async (request, reply) => {
      const dono = Number(request.params.id);
      if (!Number.isInteger(dono) || dono <= 0) return reply.code(400).send({ error: 'Pedido inválido.' });
      if (dono !== request.user.id && freioDeConsultas.tentar(String(request.user.id))) {
        return reply.code(429).send({ error: 'Muitas visitas seguidas. Tente de novo daqui a pouco.' });
      }
      if (!podeVisitarQuarto(request.user.id, dono)) return reply.code(404).send({ error: 'Este quarto não está aberto para visita.' });
      const pessoa = db.findUserById(dono)!;
      return { dono: { id: pessoa.id, username: pessoa.username, nomeDeExibicao: pessoa.nomeDeExibicao }, itens: destaqueResolvido(dono, request.user.id) };
    });

    /** Quem entra no meu quarto: o modo e os convidados. */
    authed.get('/api/quarto-acesso', async (request) => {
      const eu = request.user.id;
      return {
        modo: modoDoQuarto(eu),
        menor: menor(eu),
        convidados: db.convidadosDoQuarto(eu).flatMap((id) => {
          const u = db.findUserById(id);
          return u ? [{ id: u.id, username: u.username, nomeDeExibicao: u.nomeDeExibicao }] : [];
        }),
      };
    });

    authed.put<{ Body: { modo?: unknown } }>('/api/quarto-acesso', async (request, reply) => {
      const modo = request.body?.modo;
      if (!MODOS_DO_QUARTO.includes(modo as ModoDoQuarto)) return reply.code(400).send({ error: 'Pedido inválido.' });
      if (modo === 'publico' && menor(request.user.id)) {
        return reply.code(403).send({ error: 'Antes dos 18, o quarto abre só para amigos e convidados.' });
      }
      db.mudarAcessoDoQuarto(request.user.id, modo as ModoDoQuarto);
      return { modo };
    });

    authed.post<{ Params: { id: string } }>('/api/quarto-acesso/convidados/:id', async (request, reply) => {
      const eu = request.user.id;
      const quem = Number(request.params.id);
      if (!Number.isInteger(quem) || quem <= 0 || quem === eu) return reply.code(400).send({ error: 'Pedido inválido.' });
      // Só amigos (a tela só mostra os amigos). O bloqueio desfaz a amizade, então quem bloqueou recebe a mesma resposta de
      // quem não é amigo, e não descobre nada.
      if (!saoAmigos(eu, quem)) return reply.code(400).send({ error: 'Convide alguém da sua lista de amigos.' });
      if (db.convidadosDoQuarto(eu).length >= CONVIDADOS_MAX) return reply.code(400).send({ error: 'Cabem até 100 convidados.' }); // (o texto inteiro, para a tradução achar; CONVIDADOS_MAX)
      // O AVISO: só no convite novo, e só se o quarto está mesmo fechado (no modo amigos, o convite não muda nada para
      // quem recebe). Vai como o convite para a voz: um cartão no canto, sem som e sem roubar o foco (Shell.tsx).
      if (db.convidarAoQuarto(eu, quem) && modoDoQuarto(eu) === 'privado') {
        const u = db.findUserById(eu)!;
        io.to(salaDaPessoa(quem)).emit('quarto:convite', { de: { id: u.id, username: u.username, nomeDeExibicao: u.nomeDeExibicao } });
      }
      return { ok: true };
    });

    authed.delete<{ Params: { id: string } }>('/api/quarto-acesso/convidados/:id', async (request, reply) => {
      const quem = Number(request.params.id);
      if (!Number.isInteger(quem) || quem <= 0) return reply.code(400).send({ error: 'Pedido inválido.' });
      db.desconvidarDoQuarto(request.user.id, quem);
      return { ok: true };
    });
  });
}
