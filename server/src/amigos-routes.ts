/**
 * Amizades: pedir, aceitar, recusar, desfazer — e a lista de quem talvez você conheça.
 *
 * Por que existe, além do óbvio: o Syden já tinha conversa privada, mas só se você soubesse o nome
 * exato de quem procurava e a pessoa estivesse numa lista de membros à sua frente. Não havia relação
 * nenhuma guardada entre duas pessoas, então nada sobrevivia a sair de uma comunidade.
 *
 * TRÊS CUIDADOS que não são óbvios e que estão nos testes:
 *
 *   1. Pedir amizade é a única rota do Syden onde alguém procura OUTRA CONTA PELO NOME. Errar aqui
 *      transforma o Syden num consultor de "essa pessoa existe?" para qualquer um. A resposta é a
 *      mesma quando o nome não existe e quando a pessoa já bloqueou o pedido — e há um freio, porque
 *      sem ele dá para varrer o alfabeto inteiro e levantar a lista de contas.
 *   2. Quem pediu não pode aceitar o próprio pedido. A trava está no SQL, não numa checagem aqui.
 *   3. O aviso em tempo real vai para as DUAS pessoas, mas cada uma recebe a sua lista — mandar a
 *      lista de uma para a outra vazaria com quem a pessoa é amiga.
 */
import type { FastifyInstance } from 'fastify';
import type { Server } from 'socket.io';
import * as db from './db.js';
import { Freio } from './freio.js';
import { barrarTemporario, requireUser } from './routes.js';
import { salaDaPessoa } from './realtime.js';

/**
 * Freio dos pedidos de amizade, por conta.
 *
 * Trinta por hora é folgado para gente e apertado para quem tenta descobrir nomes de conta um a um.
 * Conta por CONTA e não por endereço de rede de propósito: o custo tem de cair em quem faz a varredura,
 * e não em quem divide a internet com ela.
 */
const freioDePedidos = new Freio(30, 60 * 60_000);

export function registerAmigosRoutes(app: FastifyInstance, io: Server) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** Avisa as duas pessoas, cada uma com a SUA lista. */
    const avisar = (a: number, b: number) => {
      for (const id of [a, b]) io.to(salaDaPessoa(id)).emit('amigos:mudou', db.listarAmizades(id));
    };

    authed.get('/api/amigos', async (request) => ({
      amigos: db.listarAmizades(request.user.id),
      sugestoes: db.sugestoesDeAmizade(request.user.id),
    }));

    authed.post<{ Body: { username?: string } }>('/api/amigos', async (request, reply) => {
      if (barrarTemporario(request, reply)) return reply;
      const nome = (request.body?.username ?? '').trim();
      if (!nome) return reply.code(400).send({ error: 'Escreva o nome de quem você quer adicionar.' });

      if (freioDePedidos.tentar(String(request.user.id))) {
        return reply.code(429).send({ error: 'Muitos pedidos seguidos. Tente de novo daqui a pouco.' });
      }

      // A conta do Syden não é gente: para quem procura, é como se não existisse.
      const achado = db.findUserByName(nome);
      const alvo = achado && !db.ehContaDoSistema(achado.id) ? achado : undefined;

      // MESMA RESPOSTA para "não existe" e para "já há um pedido": quem procura não descobre se a
      // conta existe. Sem isso, esta rota vira uma forma de varrer nomes e montar a lista de contas
      // do Syden — e o texto é o único lugar onde esse vazamento apareceria.
      const recusa = { error: 'Não deu para enviar o pedido. Confira o nome e tente de novo.' };

      // A MESMA recusa de "não existe": quem foi bloqueado não descobre que foi. Uma mensagem
      // diferente aqui contaria a ele exatamente o que o bloqueio existe para não contar.
      if (!alvo || alvo.id === request.user.id || db.haBloqueio(request.user.id, alvo.id)) {
        return reply.code(404).send(recusa);
      }
      if (db.amizadeEntre(request.user.id, alvo.id)) return reply.code(409).send(recusa);
      if (!db.pedirAmizade(request.user.id, alvo.id)) return reply.code(409).send(recusa);

      avisar(request.user.id, alvo.id);
      return { ok: true, amigos: db.listarAmizades(request.user.id) };
    });

    authed.post<{ Params: { id: string } }>('/api/amigos/:id/aceitar', async (request, reply) => {
      const outro = Number(request.params.id);
      if (!Number.isInteger(outro)) return reply.code(400).send({ error: 'Pedido inválido.' });

      // Quem pediu não aceita o próprio pedido: a condição está no UPDATE, então este erro cobre
      // tanto "não existe pedido" quanto "o pedido é seu". São a mesma coisa do ponto de vista de
      // quem chama, e separá-los só contaria a um estranho que o pedido dele chegou.
      if (!db.aceitarAmizade(request.user.id, outro)) {
        return reply.code(404).send({ error: 'Não há um pedido de amizade para aceitar.' });
      }

      avisar(request.user.id, outro);
      return { ok: true, amigos: db.listarAmizades(request.user.id) };
    });

    /** Recusar um pedido e desfazer uma amizade são a mesma operação: a linha some. */
    authed.delete<{ Params: { id: string } }>('/api/amigos/:id', async (request, reply) => {
      const outro = Number(request.params.id);
      if (!Number.isInteger(outro)) return reply.code(400).send({ error: 'Pedido inválido.' });
      if (!db.desfazerAmizade(request.user.id, outro)) {
        return reply.code(404).send({ error: 'Vocês não têm nenhuma relação para desfazer.' });
      }
      avisar(request.user.id, outro);
      return { ok: true, amigos: db.listarAmizades(request.user.id) };
    });
  });
}
