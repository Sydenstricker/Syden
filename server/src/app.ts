import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server as IOServer } from 'socket.io';
import { config } from './config.js';
import * as db from './db.js';
import { setupRealtime } from './realtime.js';
import { seedFirstCommunity } from './expressions.js';
import { registerChatRoutes } from './chat-routes.js';
import { registerDirectRoutes } from './direct-routes.js';
import { ondeAnotar } from './email.js';
import { registerEmailRoutes } from './email-routes.js';
import { registerEmojiPackRoutes } from './emoji-pack-routes.js';
import { comecarLimpezaDeRecados } from './expiry.js';
import { registerKaraokeRoutes } from './karaoke-routes.js';
import { registerMediaRoutes } from './media-routes.js';
import { registerModeracaoRoutes } from './moderacao-routes.js';
import { registerPackRoutes } from './pack-routes.js';
import { registerRoutes } from './routes.js';
import { registerSocialRoutes } from './social-routes.js';
import { registerAmigosRoutes } from './amigos-routes.js';
import { registerAulaRoutes } from './aula-routes.js';
import { registerCargosRoutes } from './cargos-routes.js';
import { startTrafficSampling } from './traffic.js';
import { countServerError, startHealthSampling } from './health.js';

/**
 * Monta o servidor inteiro sem ligar nada: nenhuma porta é aberta e nenhuma medição de fundo começa.
 * Está separado de index.ts para que os testes consigam bater nas rotas de verdade (com app.inject)
 * sem precisar de porta livre, de LiveKit no ar nem de esperar o servidor subir.
 */
export async function buildApp({ background = true } = {}): Promise<{ app: FastifyInstance; io: IOServer }> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: true });

  // Recado em vídeo sobe como arquivo cru: dezenas de megabytes viram texto gigante se forem de JSON.
  for (const tipo of ['application/octet-stream', 'video/webm', 'video/mp4']) {
    app.addContentTypeParser(tipo, { parseAs: 'buffer' }, (_request, corpo, pronto) => pronto(null, corpo));
  }
  // O padrão do @fastify/cors libera só GET/HEAD/POST; a API também usa PUT (avatar), PATCH e DELETE.
  await app.register(cors, { origin: config.corsOrigins, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] });

  // Erros do próprio servidor (5xx) alimentam o painel de saúde; erros de quem usa (4xx) não são problema nosso.
  app.addHook('onResponse', async (_request, reply) => {
    if (reply.statusCode >= 500) countServerError();
  });

  const io = new IOServer(app.server, { cors: { origin: config.corsOrigins } });
  seedFirstCommunity();
  setupRealtime(io);
  registerRoutes(app, io);
  registerMediaRoutes(app, io);
  registerPackRoutes(app);
  registerEmojiPackRoutes(app, io);
  registerKaraokeRoutes(app, io);
  registerChatRoutes(app, io);
  registerDirectRoutes(app, io);
  registerEmailRoutes(app);
  registerModeracaoRoutes(app, io);
  registerSocialRoutes(app);
  registerAmigosRoutes(app, io);
  registerAulaRoutes(app, io);
  registerCargosRoutes(app, io);
  // No modo rascunho, o e-mail inteiro (com o link) vai para o registro do servidor.
  ondeAnotar((linha) => app.log.info(linha));

  // As tarefas de fundo (limpeza de recados, medição de tráfego e de saúde) ficam de fora nos testes:
  // elas usam relógio e placa de rede, e deixariam o processo de teste vivo para sempre.
  if (background) {
    comecarLimpezaDeRecados(io, app.log);
    startTrafficSampling();
    startHealthSampling();

    // A CAIXA-PRETA SE ESVAZIA SOZINHA. Retenção de 90 dias que depende de alguém lembrar de limpar
    // não é retenção de 90 dias: é retenção para sempre com uma boa intenção escrita ao lado.
    //
    // Roda na subida e uma vez por dia. Na subida porque o servidor pode ter ficado fora do ar além
    // do prazo, e aí o primeiro dia já passou; de 24 em 24 porque é o grão do prazo.
    const limpar = () => {
      const quantas = db.limparCaixaPreta();
      if (quantas > 0) app.log.info({ quantas }, 'caixa-preta: contas que passaram dos 90 dias foram apagadas');
    };
    limpar();
    setInterval(limpar, 24 * 60 * 60 * 1000).unref();

    // AS CONTAS DE AULA VENCIDAS saem de hora em hora: o link vale no máximo um dia, e a conta não
    // pode ficar além do prazo prometido a quem entrou. Saem pelo caminho normal de exclusão.
    const limparAulas = () => {
      const quantas = db.limparTemporariosVencidos();
      if (quantas > 0) app.log.info({ quantas }, 'aula: contas temporárias vencidas foram apagadas');
    };
    limparAulas();
    setInterval(limparAulas, 60 * 60 * 1000).unref();
  }

  return { app, io };
}
