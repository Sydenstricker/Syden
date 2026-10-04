import type { FastifyInstance } from 'fastify';
import { arquivoDaCultura, culturaDe } from './cultura.js';
import { requireUser } from './routes.js';

// A faixa de cultura da home (ver cultura.ts). O país e a língua vêm da tela, que os tira da
// preferência de idioma do sistema da pessoa — nunca do endereço de rede.

export function registerCulturaRoutes(app: FastifyInstance) {
  // SEM LOGIN, como os avatares: uma <img> não manda o cabeçalho de quem está logado. E não há nada
  // a proteger — só sai daqui arquivo público, e só os que a lista do dia já selecionou.
  app.get<{ Params: { id: string } }>('/api/cultura/arquivo/:id', async (request, reply) => {
    const arquivo = await arquivoDaCultura(request.params.id);
    if (!arquivo) return reply.code(404).send({ error: 'Arquivo não encontrado.' });
    return reply
      .header('content-type', arquivo.tipo)
      .header('x-content-type-options', 'nosniff')
      .header('cache-control', 'public, max-age=86400')
      .send(arquivo.bytes);
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get<{ Querystring: { pais?: string; lingua?: string } }>('/api/cultura', async (request, reply) => {
      const pais = String(request.query.pais ?? '').toUpperCase();
      const lingua = String(request.query.lingua ?? '').toLowerCase();
      if (!/^[A-Z]{2}$/.test(pais) || !/^[a-z]{2,3}$/.test(lingua)) {
        return reply.code(400).send({ error: 'País ou língua inválidos.' });
      }
      return culturaDe(pais, lingua);
    });
  });
}
