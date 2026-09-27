/**
 * A audiência do site, medida pelo Web Analytics da Cloudflare.
 *
 * Por que isto vale a pena: é o único número do projeto que vem de quem está do LADO DE FORA abrindo o
 * Syden. Nenhum teste daqui produz isso, porque aqui a rede é sempre boa e a máquina é sempre a mesma.
 * "A tela demora 4 segundos para abrir na casa de alguém" é um defeito que só existe se for medido.
 *
 * Isto NÃO é a contagem de contas — essa é nossa, está no painel de crescimento e não depende de
 * ninguém de fora. Aqui é quanta gente ABRE a página, tenha conta ou não.
 *
 * Condição para existir: a medição está DECLARADA na política de privacidade, na seção "Medição do
 * site". Se um dia ela for desligada no painel da Cloudflare, o texto de lá sai junto — e este arquivo
 * também. Manter uma e não a outra é prometer uma coisa por escrito e fazer outra.
 *
 * As três chaves saem de `node server/scripts/audiencia.mjs`. Sem elas, a seção some da tela.
 *
 * ---------------------------------------------------------------------------------------------------
 * A CHAVE VENCE, E ISSO PRECISA GRITAR.
 *
 * O token foi criado com validade de um ano. Um ano é tempo suficiente para esquecer completamente que
 * ele existe, e o jeito natural de descobrir seria o pior possível: a seção sumiria da tela sem dizer
 * nada, e pareceria que ninguém mais está entrando no site.
 *
 * Por isso há DOIS estados diferentes, e eles não se confundem:
 *
 *   sem chave configurada  -> devolve nulo, a seção não existe. É o estado normal de quem nunca ligou.
 *   chave configurada e falhando -> devolve `situacao: 'falhou'`, e a tela mostra um alerta vermelho
 *                             dizendo o que aconteceu e onde clicar. Sumir em silêncio, aqui, é erro.
 *
 * E, melhor do que os dois, o aviso que chega ANTES: a validade da chave é perguntada à Cloudflare
 * junto com os dados, e a partir de 30 dias do vencimento a tela avisa enquanto tudo ainda funciona.
 */
import { config } from './config.js';

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
const VERIFICAR = 'https://api.cloudflare.com/client/v4/user/tokens/verify';
const CACHE_MS = 5 * 60_000;
/** Quantos dias o painel mostra. A Cloudflare guarda bem mais, mas o gráfico fica ilegível. */
const DIAS = 7;
/** A partir de quantos dias do vencimento a tela começa a avisar, com tudo ainda funcionando. */
export const AVISAR_A_PARTIR_DE = 30;

export interface Dados {
  /** Quantas vezes uma página foi aberta na janela toda. */
  pageviews: number;
  /** Visitas: chegadas ao site vindas de fora. Menor que pageviews, e é o número de "quanta gente". */
  visitas: number;
  /** Tempo de carregamento em milissegundos. A mediana é a experiência típica... */
  medianaMs: number | null;
  /** ...e o P75 é a experiência de quem está na pior quarta parte, que é quem desiste. */
  p75Ms: number | null;
  /** Um ponto por dia, do mais antigo para o mais recente. */
  porDia: { dia: string; visitas: number; pageviews: number }[];
}

/** Só existe quando o vencimento está perto. Nulo o resto do tempo, para não virar barulho de fundo. */
export interface AvisoDaChave {
  venceEm: string;
  diasAteVencer: number;
}

export type Audiencia =
  | ({ situacao: 'ok'; aviso: AvisoDaChave | null } & Dados)
  | { situacao: 'falhou'; motivo: string; chaveVencida: boolean };

export const audienciaConfigurada = Boolean(
  config.cloudflare.apiToken && config.cloudflare.accountId && config.cloudflare.siteTag,
);

let cache: { at: number; data: Audiencia | null } | null = null;

/**
 * A consulta.
 *
 * AINDA NÃO PROVADA contra a API de verdade — falta o token. Os nomes dos campos abaixo são a melhor
 * leitura da documentação, e leitura de documentação erra. Antes de confiar nesta tela, rode
 * `node server/scripts/audiencia.mjs`: ele pergunta o esquema à própria Cloudflare e diz quais campos
 * existem com que nome. Enquanto isso não for feito, um nome errado aqui cai no estado 'falhou', que
 * aparece na tela com o motivo escrito — e não em silêncio.
 *
 * Duas consultas no mesmo pedido: o total da janela e a série por dia. Uma viagem só à rede.
 */
const CONSULTA = `
  query Audiencia($conta: string!, $site: string!, $desde: Time!, $ate: Time!) {
    viewer {
      accounts(filter: { accountTag: $conta }) {
        total: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $site, datetime_geq: $desde, datetime_leq: $ate }
          limit: 1
        ) {
          count
          sum { visits }
          quantiles { pageLoadTimeP50 pageLoadTimeP75 }
        }
        porDia: rumPageloadEventsAdaptiveGroups(
          filter: { siteTag: $site, datetime_geq: $desde, datetime_leq: $ate }
          limit: 100
          orderBy: [date_ASC]
        ) {
          count
          sum { visits }
          dimensions { date }
        }
      }
    }
  }
`;

/** O formato cru que a Cloudflare devolve, só com o que a gente usa. */
interface Grupo {
  count?: number;
  sum?: { visits?: number };
  quantiles?: { pageLoadTimeP50?: number; pageLoadTimeP75?: number };
  dimensions?: { date?: string };
}

const inteiro = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0);
const talvez = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null);

/**
 * Separado da rede de propósito: é aqui que mora a chance de errar, e é o que os testes conseguem
 * alcançar sem inventar um servidor da Cloudflare.
 */
export function lerResposta(dados: unknown): Dados | null {
  const conta = (dados as { viewer?: { accounts?: { total?: Grupo[]; porDia?: Grupo[] }[] } })?.viewer?.accounts?.[0];
  if (!conta) return null;

  const total = conta.total?.[0];
  const porDia = (conta.porDia ?? [])
    .filter((g) => typeof g.dimensions?.date === 'string')
    .map((g) => ({ dia: g.dimensions!.date!, visitas: inteiro(g.sum?.visits), pageviews: inteiro(g.count) }));

  // Sem total mas com dias é possível quando a janela é curta: soma os dias em vez de devolver zero.
  const pageviews = total ? inteiro(total.count) : porDia.reduce((s, d) => s + d.pageviews, 0);
  const visitas = total ? inteiro(total.sum?.visits) : porDia.reduce((s, d) => s + d.visitas, 0);

  // Nenhuma visita na janela inteira não é erro — é um site parado. Mas também não é dado.
  if (pageviews === 0 && porDia.length === 0) return null;

  return {
    pageviews,
    visitas,
    medianaMs: talvez(total?.quantiles?.pageLoadTimeP50),
    p75Ms: talvez(total?.quantiles?.pageLoadTimeP75),
    porDia,
  };
}

/**
 * Quantos dias faltam para a chave vencer, ou nulo se ela não vence nunca (ou se a data não veio).
 *
 * Arredonda para cima: com 12 horas restantes, "falta 1 dia" é uma frase mais útil do que "faltam 0".
 */
export function diasAteVencer(expiraEm: unknown, agora: Date): number | null {
  if (typeof expiraEm !== 'string' || !expiraEm) return null;
  const quando = new Date(expiraEm);
  if (Number.isNaN(quando.getTime())) return null;
  return Math.ceil((quando.getTime() - agora.getTime()) / (24 * 60 * 60_000));
}

/** O aviso só nasce quando o vencimento entra na janela. Fora dela, silêncio. */
export function avisoDaChave(expiraEm: unknown, agora: Date): AvisoDaChave | null {
  const dias = diasAteVencer(expiraEm, agora);
  if (dias === null || dias > AVISAR_A_PARTIR_DE) return null;
  return { venceEm: new Date(expiraEm as string).toISOString(), diasAteVencer: dias };
}

/**
 * Pergunta à Cloudflare o estado do próprio token: se está ativo e quando vence.
 *
 * Serve para duas coisas. Na falha, transforma um "não deu" genérico na frase certa — "a chave venceu"
 * é uma instrução, "erro ao consultar" não é. No sucesso, é de onde sai o aviso antecipado.
 */
async function estadoDaChave(): Promise<{ status: string; expiraEm: unknown } | null> {
  try {
    const r = await fetch(VERIFICAR, {
      headers: { authorization: `Bearer ${config.cloudflare.apiToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const corpo = (await r.json()) as { result?: { status?: string; expires_on?: unknown }; errors?: { code?: number }[] };
    // 1000 é "token inválido"; um token vencido também cai aqui, e a Cloudflare não distingue os dois.
    if (!corpo.result?.status) return { status: r.status === 401 || r.status === 403 ? 'expired' : 'desconhecido', expiraEm: null };
    return { status: corpo.result.status, expiraEm: corpo.result.expires_on };
  } catch {
    return null;
  }
}

export async function audiencia(): Promise<Audiencia | null> {
  if (!audienciaConfigurada) return null;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const guardar = (data: Audiencia) => {
    cache = { at: Date.now(), data };
    return data;
  };

  const agora = new Date();
  const desde = new Date(agora.getTime() - DIAS * 24 * 60 * 60_000);

  /** Uma falha que a tela mostra, em vez de uma seção que some. */
  const falhou = async (motivo: string) => {
    const chave = await estadoDaChave();
    const vencida = chave?.status === 'expired';
    console.error('[audiencia]', motivo, chave ? `(token: ${chave.status})` : '');
    return guardar({
      situacao: 'falhou',
      motivo: vencida ? 'A chave da Cloudflare venceu.' : motivo,
      chaveVencida: vencida,
    });
  };

  try {
    const [resposta, chave] = await Promise.all([
      fetch(GRAPHQL, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.cloudflare.apiToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          query: CONSULTA,
          variables: {
            conta: config.cloudflare.accountId,
            site: config.cloudflare.siteTag,
            desde: desde.toISOString(),
            ate: agora.toISOString(),
          },
        }),
        signal: AbortSignal.timeout(15_000),
      }),
      estadoDaChave(),
    ]);

    const corpo = (await resposta.json().catch(() => null)) as { data?: unknown; errors?: { message?: string }[] } | null;

    // O GraphQL responde 200 com a lista de erros DENTRO do corpo. Sem ler isto, uma consulta errada
    // viraria "seção some da tela" e ninguém saberia por quê — o defeito que o login do GitHub já
    // cobrou caro neste projeto.
    if (corpo?.errors?.length) {
      return await falhou('A Cloudflare recusou a consulta: ' + corpo.errors.map((e) => e.message).join('; '));
    }
    if (!resposta.ok) return await falhou(`A Cloudflare respondeu ${resposta.status}.`);
    if (chave?.status === 'expired') return await falhou('A chave da Cloudflare venceu.');

    const dados = lerResposta(corpo?.data);
    // Consulta boa e nenhuma visita é um site parado, não um defeito: mostra zeros de verdade em vez
    // de alarme falso.
    const vazio: Dados = { pageviews: 0, visitas: 0, medianaMs: null, p75Ms: null, porDia: [] };
    return guardar({ situacao: 'ok', aviso: avisoDaChave(chave?.expiraEm, agora), ...(dados ?? vazio) });
  } catch (erro) {
    return await falhou(erro instanceof Error ? erro.message : 'Não deu para falar com a Cloudflare.');
  }
}
