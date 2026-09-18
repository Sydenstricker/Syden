const isProd = process.env.NODE_ENV === 'production';

/** Lê uma variável de ambiente. O fallback só vale fora de produção, para não subir com segredos de dev. */
function env(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Variável de ambiente ausente: ${name}`);
  return devFallback;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: new TextEncoder().encode(env('JWT_SECRET', 'dev-secret')),
  inviteCode: process.env.INVITE_CODE ?? '',
  corsOrigins: env('CORS_ORIGIN', 'http://localhost:5173').split(',').map((o) => o.trim()),
  databasePath: process.env.DATABASE_PATH || './janja.db',
  livekit: {
    url: env('LIVEKIT_URL', 'ws://localhost:7880'),
    apiKey: env('LIVEKIT_API_KEY', 'devkey'),
    apiSecret: env('LIVEKIT_API_SECRET', 'secret'),
  },
  // Opcional: sem token, o painel de uso mostra só as horas de chamada.
  hetzner: {
    token: process.env.HETZNER_API_TOKEN ?? '',
    // Vazio = descobre sozinho pelo serviço de metadados da própria VPS.
    serverId: process.env.HETZNER_SERVER_ID ?? '',
    apiUrl: process.env.HETZNER_API_URL || 'https://api.hetzner.cloud/v1',
  },
};
