const isProd = process.env.NODE_ENV === 'production';

/** Lê uma variável de ambiente. O fallback só vale fora de produção, para não subir com segredos de dev. */
function env(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Variável de ambiente ausente: ${name}`);
  return devFallback;
}

/**
 * O cadastro é fechado por padrão: sem código de convite, ninguém cria conta. Se um dia a variável
 * INVITE_CODE sumir do .env por acidente, o Syden abriria para a internet inteira sem avisar nada —
 * então, em produção, o servidor prefere não subir. Para abrir o cadastro de propósito, é preciso
 * escrever CADASTRO_ABERTO=sim, que é uma decisão consciente e fica registrada no arquivo.
 */
const inviteCode = (process.env.INVITE_CODE ?? '').trim();
const cadastroAberto = process.env.CADASTRO_ABERTO === 'sim';
if (isProd && !inviteCode && !cadastroAberto) {
  throw new Error(
    'INVITE_CODE está vazio: o cadastro ficaria aberto para qualquer pessoa. ' +
      'Defina um código de convite, ou escreva CADASTRO_ABERTO=sim se for mesmo essa a intenção.',
  );
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: new TextEncoder().encode(env('JWT_SECRET', 'dev-secret')),
  inviteCode,
  cadastroAberto,
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
  // Envio de e-mail (confirmar endereço, recuperar senha). Sem a chave, o Syden funciona igual: as
  // mensagens vão para o registro do servidor em vez de saírem — dá para desenvolver e testar o fluxo
  // inteiro antes de existir domínio e conta no provedor.
  email: {
    resendKey: process.env.RESEND_API_KEY ?? '',
    // Enquanto não houver domínio próprio, o endereço de teste do Resend só entrega para o dono da conta.
    remetente: process.env.EMAIL_FROM || 'Syden <onboarding@resend.dev>',
  },
  /** Endereço do site, para montar os links que vão dentro do e-mail. */
  siteUrl: (process.env.SITE_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173').trim().replace(/\/$/, ''),
  // Freios das portas de autenticação. O de endereço conta TODA tentativa vinda do mesmo IP em 1 minuto
  // (protege o processador do servidor); o de conta conta só os ERROS de senha de uma conta em 15 minutos
  // (protege a pessoa). Dá para afrouxar por variável de ambiente se muita gente sair pelo mesmo IP.
  freio: {
    tentativasPorEndereco: Number(process.env.FREIO_TENTATIVAS_POR_ENDERECO || 20),
    errosPorConta: Number(process.env.FREIO_ERROS_POR_CONTA || 10),
    // Mandar e-mail custa dinheiro e incomoda quem recebe: por endereço de rede em 15 min, e por caixa
    // de destino em 1 hora (para ninguém usar o Syden para encher a caixa de outra pessoa).
    emailsPorEndereco: Number(process.env.FREIO_EMAILS_POR_ENDERECO || 6),
    emailsPorCaixa: Number(process.env.FREIO_EMAILS_POR_CAIXA || 4),
  },
  // Freios do multi-comunidade: o consumo do servidor cresce com quanta gente usa ao mesmo tempo, então
  // cada pessoa só cria algumas comunidades e cada comunidade tem um teto de membros.
  maxCommunitiesPerUser: Number(process.env.MAX_COMMUNITIES_PER_USER || 3),
  maxMembersPerCommunity: Number(process.env.MAX_MEMBERS_PER_COMMUNITY || 100),
};
