/**
 * Denúncias e os direitos da pessoa sobre os próprios dados.
 *
 * As duas coisas viram obrigatórias no dia em que entra gente que você não conhece: uma porque alguém
 * precisa poder dizer "isto aqui está errado" sem procurar o dono no particular, e a outra porque a LGPD
 * dá à pessoa o direito de levar os dados dela embora e de apagá-los.
 */
import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { emitToUser } from './realtime.js';
import { requireUser } from './routes.js';

/** Quantas denúncias uma pessoa pode abrir por dia. Quem denuncia tudo o tempo todo também é um problema. */
const DENUNCIAS_POR_DIA = 20;

export function registerModeracaoRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    // ---------- Denunciar ----------

    authed.post<{ Body: { tipo?: string; alvo?: number; motivo?: string } }>('/api/reports', async (request, reply) => {
      const tipo = request.body?.tipo;
      const motivo = String(request.body?.motivo ?? '').trim();
      if (tipo !== 'mensagem' && tipo !== 'pessoa') return reply.code(400).send({ error: 'Tipo de denúncia inválido.' });
      if (motivo.length < 3 || motivo.length > 1000) {
        return reply.code(400).send({ error: 'Conte em poucas palavras o que houve (de 3 a 1000 caracteres).' });
      }
      if (db.denunciasDeHoje(request.user.id) >= DENUNCIAS_POR_DIA) {
        return reply.code(429).send({ error: 'Você já abriu muitas denúncias hoje. Fale direto com quem cuida do Syden.' });
      }

      const alvo = Number(request.body?.alvo);
      let dados: Parameters<typeof db.criarDenuncia>[0];

      if (tipo === 'mensagem') {
        const mensagem = db.findMessage(alvo);
        const canal = mensagem && db.findChannel(mensagem.channelId);
        // Só dá para denunciar o que a pessoa enxerga: senão, o número da mensagem viraria uma janela
        // para ler conversa alheia pela resposta da denúncia.
        if (!mensagem || !canal || !podeVer(request.user, canal)) {
          return reply.code(404).send({ error: 'Mensagem não encontrada.' });
        }
        const autor = db.findUserById(mensagem.userId);
        dados = {
          reporter: request.user,
          kind: 'mensagem',
          targetId: mensagem.id,
          targetName: autor?.username ?? null,
          // A cópia é o ponto: a mensagem pode ser apagada antes de alguém olhar a denúncia.
          snapshot: (db.findMessageContent(mensagem.id) ?? '').slice(0, 2000),
          reason: motivo,
          communityId: canal.communityId,
        };
      } else {
        const pessoa = db.findUserById(alvo);
        if (!pessoa) return reply.code(404).send({ error: 'Pessoa não encontrada.' });
        dados = { reporter: request.user, kind: 'pessoa', targetId: pessoa.id, targetName: pessoa.username, reason: motivo };
      }

      const denuncia = db.criarDenuncia(dados);
      // Quem cuida do Syden vê o aviso na hora, sem precisar ficar conferindo o painel.
      for (const admin of db.listAdmins()) emitToUser(io, admin.id, 'report:new', { abertas: db.contarDenunciasAbertas() });
      return { ok: true, id: denuncia.id };
    });

    // ---------- Ver e resolver (só quem cuida do Syden) ----------

    authed.get<{ Querystring: { status?: string } }>('/api/reports', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores veem as denúncias.' });
      const status = request.query?.status === 'resolvida' ? 'resolvida' : request.query?.status === 'aberta' ? 'aberta' : undefined;
      return { denuncias: db.listarDenuncias(status), abertas: db.contarDenunciasAbertas() };
    });

    authed.post<{ Params: { id: string }; Body: { resolucao?: string } }>('/api/reports/:id/resolver', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores resolvem denúncias.' });
      const resolucao = String(request.body?.resolucao ?? '').trim().slice(0, 1000);
      if (!resolucao) return reply.code(400).send({ error: 'Escreva o que foi feito: é isso que fica registrado.' });

      const denuncia = db.resolverDenuncia(Number(request.params.id), request.user.username, resolucao);
      if (!denuncia) return reply.code(404).send({ error: 'Denúncia não encontrada.' });
      db.registrarAuditoria({
        actor: request.user,
        action: 'denuncia.resolvida',
        target: `#${denuncia.id} sobre ${denuncia.targetName ?? 'alguém'}`,
        detail: resolucao,
      });
      return denuncia;
    });

    // ---------- Os dados da pessoa (LGPD) ----------

    /**
     * "Levar os meus dados embora": um arquivo com tudo o que o Syden guarda sobre quem pediu. Vai em JSON
     * porque é o formato que qualquer outro programa consegue ler — que é o ponto do direito à portabilidade.
     */
    authed.get('/api/me/dados', async (request, reply) => {
      const eu = request.user;
      const pacote = {
        geradoEm: new Date().toISOString(),
        sobre: 'Tudo o que o Syden guarda sobre você. Guarde este arquivo: ele contém dados pessoais seus.',
        conta: {
          ...eu,
          ...db.emailDe(eu.id),
          criadaEm: db.criadaEm(eu.id),
        },
        comunidades: db.listCommunitiesForUser(eu.id).map((c) => ({ nome: c.name, seuCargo: db.memberRole(c.id, eu.id) })),
        insignias: db.itensDaPessoa(eu.id),
        mensagens: db.mensagensDaPessoa(eu.id),
        tempoEmChamada: db.usoDaPessoa(eu.id),
        denunciasQueVoceAbriu: db.listarDenuncias()
          .filter((d) => d.reporterName === eu.username)
          .map((d) => ({ quando: d.at, sobre: d.targetName, motivo: d.reason, situacao: d.status })),
      };
      return reply
        .header('content-disposition', `attachment; filename="meus-dados-no-syden.json"`)
        .header('content-type', 'application/json; charset=utf-8')
        .send(JSON.stringify(pacote, null, 2));
    });
  });
}

/** A mesma regra do resto do app: comunidade exige ser membro; conversa privada exige estar nela. */
function podeVer(user: db.User, canal: db.Channel) {
  return canal.communityId === null ? db.isChannelMember(canal.id, user.id) : db.memberRole(canal.communityId, user.id) !== undefined;
}
