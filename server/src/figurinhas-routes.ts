/**
 * AS FIGURINHAS (04/11/2026, pedido dele: "as figurinhas criadas pelos usuários, como no WhatsApp"). A coleção é de cada
 * pessoa (db.ts, "AS FIGURINHAS"): criar, salvar uma que recebeu, tirar. Mandar numa conversa é a rota
 * /api/channels/:id/figurinha, em chat-routes.ts, porque é lá que mora quem pode escrever onde.
 *
 * TODA FIGURINHA NOVA PASSA PELO FUNIL DAS IMAGENS (parseMediaConferida: tipo pelos bytes, tamanho, pixels e o Shield),
 * porque ela vai para conversa privada também. Salvar a de outra pessoa não passa de novo: é o mesmo arquivo, já
 * conferido quando foi criado, e a chave do anexo prova que quem salva o recebeu.
 *
 * QUEM SOBE RESPONDE, como nos emojis e nos sons (termos, seção 4): a figurinha retirada por direito autoral sai também de
 * todas as coleções (retirarComCopias).
 */
import type { FastifyInstance } from 'fastify';
import * as db from './db.js';
import { entregarArquivo } from './entregar.js';
import { parseMediaConferida } from './media.js';
import { cotaEsgotada, requireUser } from './routes.js';

/** Quantas cabem na coleção de uma pessoa. */
export const MAXIMO_DE_FIGURINHAS = 200;
/** O arquivo de uma figurinha (o site reduz a 512 px e manda em WEBP; GIF animado passa como veio). */
export const LIMITE_DA_FIGURINHA = 1024 * 1024;

function dimensao(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 && n <= 4096 ? Math.round(n) : null;
}

export function registerFigurinhasRoutes(app: FastifyInstance) {
  // <img> não manda o login: o endereço é o segredo, como nos anexos (a chave só chega a quem tem a coleção).
  app.get<{ Params: { id: string; key: string } }>('/api/figurinhas/:id/:key', async (request, reply) => {
    const arquivo = db.arquivoDaFigurinha(Number(request.params.id), String(request.params.key));
    if (!arquivo) return reply.code(404).send({ error: 'Figurinha não encontrada.' });
    return entregarArquivo(request, reply, arquivo, { 'content-disposition': 'inline' });
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get('/api/figurinhas', async (request) => ({ figurinhas: db.listarFigurinhas(request.user.id), maximo: MAXIMO_DE_FIGURINHAS }));

    authed.post<{ Body: { image?: string; width?: number; height?: number } }>(
      '/api/figurinhas',
      { bodyLimit: Math.ceil(LIMITE_DA_FIGURINHA * 1.4) + 4096 },
      async (request, reply) => {
        if (cotaEsgotada(request, reply)) return reply;
        if (db.contarFigurinhas(request.user.id) >= MAXIMO_DE_FIGURINHAS) {
          return reply.code(400).send({ error: 'A sua coleção de figurinhas está cheia. Tire alguma para pôr outra.' });
        }
        const media = await parseMediaConferida(request.body?.image, 'image', LIMITE_DA_FIGURINHA, 'figurinha', request.user.id);
        if (typeof media === 'string') return reply.code(400).send({ error: media });
        return db.guardarFigurinha(request.user.id, media.data, media.mime, dimensao(request.body?.width), dimensao(request.body?.height));
      },
    );

    authed.post<{ Body: { anexoId?: number; key?: string } }>('/api/figurinhas/salvar', async (request, reply) => {
      const anexo = db.figurinhaDoAnexo(Number(request.body?.anexoId), String(request.body?.key ?? ''));
      if (!anexo) return reply.code(404).send({ error: 'Figurinha não encontrada.' });
      if (db.contarFigurinhas(request.user.id) >= MAXIMO_DE_FIGURINHAS) {
        return reply.code(400).send({ error: 'A sua coleção de figurinhas está cheia. Tire alguma para pôr outra.' });
      }
      return db.guardarFigurinha(request.user.id, { sha: anexo.sha, bytes: anexo.bytes }, anexo.mime, anexo.width, anexo.height);
    });

    authed.delete<{ Params: { id: string } }>('/api/figurinhas/:id', async (request, reply) => {
      if (!db.tirarFigurinha(request.user.id, Number(request.params.id))) return reply.code(404).send({ error: 'Figurinha não encontrada.' });
      return { ok: true };
    });
  });
}
