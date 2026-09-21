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
  // Franquia mensal de tráfego de saída do provedor, em GB. Padrão: 10 TB do plano grátis da Oracle.
  trafficAllowanceGb: Number(process.env.TRAFFIC_ALLOWANCE_GB || 10_000),
  // Gráficos do provedor no painel de saúde (opcional). Token só de leitura, criado no painel da Hetzner.
  hetzner: {
    token: process.env.HETZNER_TOKEN ?? '',
    serverId: process.env.HETZNER_SERVER_ID ?? '',
  },
  // Freios do multi-comunidade: o consumo do servidor cresce com quanta gente usa ao mesmo tempo, então
  // cada pessoa só cria algumas comunidades e cada comunidade tem um teto de membros.
  maxCommunitiesPerUser: Number(process.env.MAX_COMMUNITIES_PER_USER || 3),
  maxMembersPerCommunity: Number(process.env.MAX_MEMBERS_PER_COMMUNITY || 100),
};
