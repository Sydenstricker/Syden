import type { FastifyInstance } from 'fastify';
import { Freio } from './freio.js';
import { requireUser } from './routes.js';

/**
 * QUANTO A INTERNET DE QUEM TRANSMITE ENVIA ATÉ O SERVIDOR (12/11/2026, pedido dele: "o Syden recomenda Padrão ou Fluido
 * por um botão"). O Fluido pede uns 10 Mbps de envio, e o único jeito de saber se a internet de alguém dá é mandar dados
 * pelo mesmo caminho que a transmissão vai fazer: do computador dela até a Alemanha. A conta é feita no site (bytes ÷
 * tempo); aqui o pedaço só chega e é jogado fora. Nada é guardado, nem o número.
 *
 * Um pedaço é de até 1 MB, e a medida manda uns 16. O freio deixa umas duas medidas por minuto por pessoa: sem ele, a
 * rota seria um jeito de gastar a internet do servidor.
 */
export const PEDACO_MAXIMO = 1024 * 1024;
const PEDACOS_POR_MINUTO = 40;

export function registerMedirEnvioRoutes(app: FastifyInstance) {
  const freio = new Freio(PEDACOS_POR_MINUTO, 60_000);
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);
    authed.post('/api/medir-envio', { bodyLimit: PEDACO_MAXIMO }, async (request, reply) => {
      const espera = freio.tentar(String(request.user.id));
      if (espera > 0) return reply.code(429).send({ error: 'Muitas medidas seguidas. Tente de novo daqui a pouco.' });
      const corpo = request.body;
      return { bytes: Buffer.isBuffer(corpo) ? corpo.length : 0 };
    });
  });
}
