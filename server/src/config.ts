import { readFileSync } from 'node:fs';

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
/**
 * Aceita as formas que alguém escreveria de verdade num arquivo de configuração: "sim", "SIM", " sim ",
 * "true", "1". Exigir exatamente `sim` fazia a variável parecer ignorada quando estava só com uma letra
 * maiúscula — e o sintoma disso (o cadastro continuar fechado sem nenhum aviso) é difícil de adivinhar.
 */
const ligado = (valor: string | undefined) => ['sim', 'true', '1', 'yes'].includes((valor ?? '').trim().toLowerCase());

const cadastroAberto = ligado(process.env.CADASTRO_ABERTO);
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
  // Historico de disponibilidade visto de fora (UptimeRobot). Chave só de leitura, criada em
  // uptimerobot.com -> My Settings -> API. Sem ela, a secao nao aparece no painel.
  uptimeRobotKey: process.env.UPTIMEROBOT_API_KEY ?? '',
  // Turnstile da Cloudflare: a unica defesa que funciona contra enxame de robos vindo de muitos
  // endereços diferentes. Sem chave, fica desligado e o cadastro funciona como sempre.
  turnstile: {
    siteKey: process.env.TURNSTILE_SITE_KEY ?? '',
    secretKey: process.env.TURNSTILE_SECRET_KEY ?? '',
  },
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
    // Contas criadas por dia a partir do mesmo endereco. O freio por minuto corta a rajada; este corta o
    // robo paciente, que cadastraria devagar durante horas. Conta so o que deu certo, para quem errou o
    // nome de usuario tres vezes nao gastar o dia. Amigos atras do mesmo Wi-Fi somam entre si: se alguem
    // reclamar de "muitas tentativas", e aqui que se afrouxa.
    cadastrosPorDia: Number(process.env.FREIO_CADASTROS_POR_DIA || 10),
  },
  // Teto de arquivos por pessoa. Os arquivos moram dentro do banco, que mora no disco da maquina: sem
  // teto, UMA conta consegue encher o disco e derrubar o Syden de todo mundo. Nao e defesa contra enxame
  // (para isso existe o Turnstile) — e o limite do estrago que uma conta sozinha faz.
  // Recado em video conta aqui, mas vence sozinho e libera o espaco de volta.
  cotaPorPessoaBytes: Number(process.env.COTA_POR_PESSOA_MB || 300) * 1024 * 1024,
  // Freios do multi-comunidade: o consumo do servidor cresce com quanta gente usa ao mesmo tempo, então
  // cada pessoa só cria algumas comunidades e cada comunidade tem um teto de membros.
  // Entrar com a conta do Google ou do Discord. Sem as duas chaves de um provedor, ele nem aparece
  // na tela de entrada — e a rota dele responde 404, para não anunciar o que não existe.
  social: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
    /**
     * A Steam não tem "cliente" nem "segredo": o login dela é OpenID 2.0, que não precisa de nenhum dos
     * dois. Esta chave serve só para buscar o NOME de quem entrou. Sem ela a entrada funcionaria, mas a
     * pessoa nasceria chamada "jogador" — então ela é o que decide se o botão aparece.
     * Sai de graça, em segundos, em steamcommunity.com/dev/apikey.
     */
    steamApiKey: process.env.STEAM_API_KEY ?? '',
    /**
     * O endereço PÚBLICO desta API. O provedor devolve o navegador para cá, e o endereço tem que
     * bater letra por letra com o que foi cadastrado lá — por isso é uma variável, e não um palpite
     * a partir do pedido que chegou: atrás do Caddy, o pedido chega como "localhost:3001".
     */
    apiUrl: (process.env.API_URL || 'http://localhost:3001').trim().replace(/\/$/, ''),
  },
  /**
   * Quando esta versão do servidor foi construída. O Dockerfile escreve o arquivo; fora do Docker ele
   * não existe, e aí fica vazio mesmo.
   *
   * Serve para responder, de fora e sem adivinhação, a pergunta "o servidor já foi atualizado?". O
   * site publica sozinho a cada push e o servidor não: os dois saem de sincronia com facilidade, e o
   * sintoma é uma tela nova conversando com uma rota velha — que dá erro em lugar nenhum, só uma
   * mensagem errada na cara de quem usa.
   */
  construidoEm: (() => {
    try {
      return readFileSync('construido-em.txt', 'utf8').trim();
    } catch {
      return '';
    }
  })(),
  maxCommunitiesPerUser: Number(process.env.MAX_COMMUNITIES_PER_USER || 3),
  maxMembersPerCommunity: Number(process.env.MAX_MEMBERS_PER_COMMUNITY || 100),
};
