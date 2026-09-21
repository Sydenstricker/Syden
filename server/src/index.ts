import cors from '@fastify/cors';
import Fastify from 'fastify';
import { Server as IOServer } from 'socket.io';
import { config } from './config.js';
import { setupRealtime } from './realtime.js';
import { seedFirstCommunity } from './expressions.js';
import { registerMediaRoutes } from './media-routes.js';
import { registerRoutes } from './routes.js';
import { startTrafficSampling } from './traffic.js';

const app = Fastify({ logger: { level: 'info' }, trustProxy: true });
// O padrão do @fastify/cors libera só GET/HEAD/POST; a API também usa PUT (avatar), PATCH e DELETE.
await app.register(cors, { origin: config.corsOrigins, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] });

const io = new IOServer(app.server, { cors: { origin: config.corsOrigins } });
seedFirstCommunity();
setupRealtime(io);
registerRoutes(app, io);
registerMediaRoutes(app, io);
startTrafficSampling();

await app.listen({ port: config.port, host: '0.0.0.0' });
