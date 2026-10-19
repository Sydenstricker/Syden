/**
 * Denúncias e os direitos da pessoa sobre os próprios dados.
 *
 * As duas coisas viram obrigatórias no dia em que entra gente que você não conhece: uma porque alguém
 * precisa poder dizer "isto aqui está errado" sem procurar o dono no particular, e a outra porque a LGPD
 * dá à pessoa o direito de levar os dados dela embora e de apagá-los.
 */
import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import { abrirArquivo, arquivoExiste, guardarArquivo } from './arquivos.js';
import * as db from './db.js';
import { entregarArquivo } from './entregar.js';
import { decodeDataUrl, sniffMime } from './media.js';
import { emitToUser } from './realtime.js';
import { requireUser } from './routes.js';

/** Quantas denúncias uma pessoa pode abrir por dia. Quem denuncia tudo o tempo todo também é um problema. */
const DENUNCIAS_POR_DIA = 20;
/** A imagem do momento da transmissão: um quadro da tela, em PNG ou JPEG. */
const MAX_IMAGEM_DA_DENUNCIA = 4 * 1024 * 1024;

export function registerModeracaoRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    // ---------- Denunciar ----------

    authed.post<{ Body: { tipo?: string; alvo?: number; motivo?: string; canal?: number; imagem?: string; grave?: boolean } }>(
      '/api/reports',
      { bodyLimit: Math.ceil(MAX_IMAGEM_DA_DENUNCIA * 1.4) + 64 * 1024 },
      async (request, reply) => {
      const tipo = request.body?.tipo;
      const motivo = String(request.body?.motivo ?? '').trim();
      // "Envolve risco a criança ou adolescente": quem denuncia marca, e a denúncia vai para o topo do painel, com o
      // lembrete de remover e comunicar às autoridades (ECA Digital, arts. 27 e 28).
      const grave = request.body?.grave === true;
      if (tipo !== 'mensagem' && tipo !== 'pessoa' && tipo !== 'transmissao' && tipo !== 'idade') {
        return reply.code(400).send({ error: 'Tipo de denúncia inválido.' });
      }
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
          grave,
        };
      } else if (tipo === 'transmissao') {
        // A TRANSMISSÃO (17/10/2026, o caso Discord): quem assiste denuncia quem transmite, com a imagem do momento.
        // Nada é gravado no Syden; a imagem é a prova, tirada por quem viu, e só quem cuida do Syden a abre.
        const pessoa = db.findUserById(alvo);
        const canal = db.findChannel(Number(request.body?.canal));
        if (!pessoa || !canal || canal.type !== 'voice' || !podeVer(request.user, canal)) {
          return reply.code(404).send({ error: 'Transmissão não encontrada.' });
        }
        let sha: string | null = null;
        let ehGrave = grave;
        if (request.body?.imagem) {
          const bytes = decodeDataUrl(request.body.imagem, MAX_IMAGEM_DA_DENUNCIA);
          if (typeof bytes === 'string') return reply.code(400).send({ error: bytes });
          const mime = sniffMime(bytes);
          if (mime !== 'image/png' && mime !== 'image/jpeg') return reply.code(400).send({ error: 'Imagem inválida.' });
          // A imagem passa pelo Shield como qualquer outra; aqui ela NÃO é recusada (é a prova), mas a correspondência
          // marca a denúncia como grave e fica anotada para quem cuida do Syden.
          const { conferir, anotarBloqueio } = await import('./shield.js');
          const veredito = await conferir(bytes, mime);
          if (veredito.veredito === 'bloqueado') {
            anotarBloqueio(veredito, 'denuncia-de-transmissao', pessoa.id);
            ehGrave = true;
          }
          sha = guardarArquivo(bytes).sha;
        }
        dados = {
          reporter: request.user,
          kind: 'transmissao',
          targetId: pessoa.id,
          targetName: pessoa.username,
          reason: motivo,
          communityId: canal.communityId,
          channelId: canal.id,
          sha,
          grave: ehGrave,
        };
      } else {
        // 'pessoa', e 'idade' (parece ter menos de 13 anos, ou mentiu a idade: art. 24 do ECA Digital)
        const pessoa = db.findUserById(alvo);
        if (!pessoa) return reply.code(404).send({ error: 'Pessoa não encontrada.' });
        dados = { reporter: request.user, kind: tipo, targetId: pessoa.id, targetName: pessoa.username, reason: motivo, grave };
      }

      const denuncia = db.criarDenuncia(dados);
      // Quem cuida do Syden vê o aviso na hora, sem precisar ficar conferindo o painel.
      for (const admin of db.listAdmins()) emitToUser(io, admin.id, 'report:new', { abertas: db.contarDenunciasAbertas() });
      return { ok: true, id: denuncia.id };
      },
    );

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

    /** A imagem do momento de uma denúncia de transmissão. Só para quem cuida do Syden, e nunca em cache. */
    authed.get<{ Params: { id: string } }>('/api/reports/:id/imagem', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores veem as denúncias.' });
      const sha = db.imagemDaDenuncia(Number(request.params.id));
      if (!sha || !arquivoExiste(sha)) return reply.code(404).send({ error: 'Esta denúncia não tem imagem.' });
      const cabeca = await new Promise<Buffer>((ok, falha) => {
        const partes: Buffer[] = [];
        abrirArquivo(sha, 0, 15)
          .on('data', (c) => partes.push(Buffer.from(c)))
          .on('end', () => ok(Buffer.concat(partes)))
          .on('error', falha);
      });
      return entregarArquivo(request, reply, { mime: sniffMime(cabeca) ?? 'application/octet-stream', sha }, { 'cache-control': 'no-store' });
    });

    /** Grave ou não: quem cuida do Syden corrige a marca de quem denunciou. */
    authed.post<{ Params: { id: string }; Body: { grave?: boolean } }>('/api/reports/:id/grave', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores mexem nas denúncias.' });
      const denuncia = db.marcarDenunciaGrave(Number(request.params.id), request.body?.grave === true);
      if (!denuncia) return reply.code(404).send({ error: 'Denúncia não encontrada.' });
      db.registrarAuditoria({ actor: request.user, action: 'denuncia.grave', target: `#${denuncia.id}`, detail: denuncia.grave ? 'grave' : 'não grave' });
      return denuncia;
    });

    /**
     * A COMUNICAÇÃO ÀS AUTORIDADES (ECA Digital, arts. 27 e 28; o passo a passo está em docs/autoridades.md): quem cuida
     * do Syden comunica fora do app (SaferNet, Polícia Federal) e registra aqui para quem e com que protocolo. O registro
     * fica para sempre: é o que mostra que a obrigação foi cumprida.
     */
    authed.post<{ Params: { id: string }; Body: { protocolo?: string } }>('/api/reports/:id/autoridade', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores mexem nas denúncias.' });
      const protocolo = String(request.body?.protocolo ?? '').trim().slice(0, 200);
      if (!protocolo) return reply.code(400).send({ error: 'Escreva para quem foi comunicado e o protocolo recebido.' });
      const denuncia = db.registrarComunicacaoAutoridade(Number(request.params.id), protocolo);
      if (!denuncia) return reply.code(404).send({ error: 'Denúncia não encontrada.' });
      db.registrarAuditoria({ actor: request.user, action: 'denuncia.autoridade', target: `#${denuncia.id}`, detail: protocolo });
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
          // Dia e mês, se informados (ver OS ANIVERSÁRIOS em db.ts).
          aniversario: db.aniversarioDe(eu.id),
          // Os idiomas do cartão de perfil, se informados (ver idiomas-routes.ts).
          idiomas: db.idiomasDe(eu.id),
        },
        // Os cargos personalizados e os pontos de nível também são dados sobre a pessoa, e vão junto.
        comunidades: db.listCommunitiesForUser(eu.id).map((c) => {
          const cargos = db.cargosDosMembros(c.id).get(eu.id) ?? [];
          return {
            nome: c.name,
            seuCargo: db.memberRole(c.id, eu.id),
            cargosPersonalizados: db.listarCargos(c.id).filter((cargo) => cargos.includes(cargo.id)).map((cargo) => cargo.nome),
            pontosDeNivel: db.pontosDe(c.id, eu.id),
            sorteiosGanhos: db.sorteiosGanhos(c.id, eu.id),
          };
        }),
        // A PROTEÇÃO (ECA Digital): a data de nascimento informada (só a própria pessoa a recebe), as regras e o
        // responsável de quem é menor, o tempo de uso medido, e de quem a pessoa é responsável.
        idade: (() => {
          const p = db.protecaoDe(eu.id);
          const sup = db.supervisaoSeHouver(eu.id);
          return {
            nascimento: p?.nascimento ?? null,
            informadaEm: p?.nascimentoEm ?? null,
            regras: sup && {
              conversaPrivadaSoComAmigos: sup.dmSoAmigos,
              transmitirSoParaAmigos: sup.transmitirSoAmigos,
              assistirSoDeAmigos: sup.assistirSoAmigos,
              limiteDiarioEmMinutos: sup.limiteMinutos,
            },
            responsavel: sup?.responsavelId ? (db.findUserById(sup.responsavelId)?.username ?? null) : null,
            tempoDeUsoPorDia: db.usoDosDias(eu.id, '0000-00-00'),
            responsavelPor: db.menoresDe(eu.id).map((m) => m.username),
          };
        })(),
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
