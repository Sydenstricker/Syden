import cors from '@fastify/cors';
import Fastify from 'fastify';
import { Server as IOServer } from 'socket.io';
import { config } from './config.js';
import { setupRealtime } from './realtime.js';
import { registerRoutes } from './routes.js';
import { startTrafficSampling } from './traffic.js';

const app = Fastify({ logger: { level: 'info' }, trustProxy: true });
await app.register(cors, { origin: config.corsOrigins });

const io = new IOServer(app.server, { cors: { origin: config.corsOrigins } });
setupRealtime(io);
registerRoutes(app, io);
startTrafficSampling();

await app.listen({ port: config.port, host: '0.0.0.0' });
