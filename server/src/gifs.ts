/**
 * GIFs pelo GIPHY.
 *
 * POR QUE O GIPHY, e não o que era mais fácil. O Tenor morreu para quem não é do Google: a API pública
 * foi desligada em 30/06/2026. A alternativa mais usada do mercado é gratuita porque INSERE ANÚNCIOS
 * entre os GIFs, e a listagem do Syden na Microsoft Store promete "sem anúncios e sem assinatura" em
 * letras grandes. Promessa em letra grande decide escolha técnica (ver CLAUDE.md).
 *
 * POR QUE A CHAVE FICA AQUI, e não no navegador. O GIPHY entrega chaves pensadas para uso no cliente,
 * e é assim que a maioria dos apps faz. Só que a chave é a COTA: no plano grátis são 100 buscas por
 * hora e 1000 por dia, para o Syden inteiro. Chave no navegador é chave pública — qualquer pessoa
 * abre as ferramentas do desenvolvedor, copia e gasta a cota de todo mundo, e o sintoma seria "os GIFs
 * pararam de funcionar" sem causa visível. Aqui ela fica no ambiente do servidor, e o navegador só
 * conhece /api/gifs.
 *
 * TRÊS MODOS, como o Shield e o envio de e-mail:
 *
 *   1. **Desligado** (sem GIPHY_API_KEY): a rota diz que está desligada e o botão de GIF nem aparece
 *      na tela. Botão que não pode funcionar é pior do que botão nenhum.
 *   2. **Ligado**: busca, guarda o resultado por alguns minutos e serve.
 *   3. **Sem cota**: a busca nova é recusada, mas o que está guardado continua servindo. A pessoa vê
 *      uma frase dizendo o que houve, e não uma grade vazia.
 */
import { config } from './config.js';

/**
 * O GIPHY. A variável existe para DESENVOLVIMENTO, e vale saber por quê.
 *
 * Sem chave não dá para ver esta tela funcionando, e "não vi rodar" é como se escreve defeito. Com
 * GIFS_ENDERECO apontando para um arquivo de exemplo servido na própria máquina, dá para abrir o
 * seletor, medir a grade e conferir a tradução antes de existir conta no GIPHY.
 *
 * Ela é de ambiente do SERVIDOR, o mesmo lugar da chave: quem pode escrevê-la já podia trocar a chave.
 * Em produção, não escreva.
 */
const ENDERECO = (process.env.GIFS_ENDERECO || 'https://api.giphy.com/v1/gifs').replace(/\/$/, '');
const TEMPO_LIMITE_MS = 6_000;

/** Quantos vêm por página. Vinte enche a grade sem pesar a primeira tela. */
export const POR_PAGINA = 20;

/**
 * A cota do plano grátis, e um pouco de folga.
 *
 * O GIPHY diz 100 buscas por hora e 1000 por dia. Passar disso não devolve erro bonito: a chave é
 * bloqueada, e voltar depende deles. Então o freio é NOSSO, e fica abaixo do deles de propósito — o
 * cache é que faz a conta fechar, porque busca repetida não gasta nada.
 */
const POR_HORA = 90;
const POR_DIA = 900;

/**
 * Quanto tempo um resultado serve antes de ser buscado de novo.
 *
 * GIF não estraga. Dez minutos é o suficiente para uma conversa inteira em que meia dúzia de pessoas
 * procura "gato" gastar UMA busca da cota em vez de seis.
 */
const CACHE_MS = 10 * 60_000;
const CACHE_MAXIMO = 300;

/**
 * A classificação máxima que entra.
 *
 * `pg-13` é o mesmo teto que redes sociais usam para conteúdo aberto: corta o explícito e mantém o
 * acervo utilizável. `g` sozinho deixa a busca quase vazia, e o efeito colateral disso é conhecido —
 * quem não acha o que quer no seletor vai colar link de fora, que é justamente o que não passa por
 * filtro nenhum. Dá para apertar por variável de ambiente sem mexer no código.
 */
const CLASSIFICACAO = (process.env.GIPHY_CLASSIFICACAO || 'pg-13').trim();

export interface Gif {
  id: string;
  /** O que vai para a conversa quando alguém escolhe. */
  url: string;
  largura: number;
  altura: number;
  /** A versão leve, que aparece na grade do seletor. */
  previa: string;
  previaLargura: number;
  previaAltura: number;
  /** Para quem usa leitor de tela, e para o `alt` da imagem. */
  descricao: string;
}

export type Resposta =
  | { estado: 'ok'; itens: Gif[]; proxima: number | null }
  | { estado: 'desligado' }
  | { estado: 'sem-cota' }
  | { estado: 'indisponivel' };

/** Está configurado? A tela pergunta isto antes de mostrar o botão. */
export function ligado() {
  return Boolean(config.giphyKey);
}

/**
 * Traduz um item do GIPHY para o que o Syden precisa.
 *
 * Separado e exportado para ser testável sem rede, e porque o formato deles tem armadilha: as medidas
 * vêm como TEXTO ("480"), não como número, e `images.original` pode faltar num item ou outro. Um NaN
 * aqui viraria um buraco no meio da grade, e um `undefined` na url viraria uma imagem quebrada na
 * conversa de todo mundo — por isso quem não tem o essencial é descartado, e não remendado.
 */
export function paraOSyden(bruto: unknown): Gif | null {
  const item = bruto as {
    id?: unknown;
    title?: unknown;
    alt_text?: unknown;
    images?: Record<string, { url?: unknown; width?: unknown; height?: unknown } | undefined>;
  };
  if (typeof item?.id !== 'string' || !item.images) return null;

  // `downsized_medium` tem teto de 5 MB; `original` pode ter dezenas. Quem assiste paga essa conta na
  // internet dele, e um GIF de 30 MB numa conversa trava o celular de quem abriu.
  const cheio = item.images.downsized_medium ?? item.images.original;
  const previa = item.images.fixed_width ?? cheio;
  const numero = (valor: unknown) => {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const url = typeof cheio?.url === 'string' ? cheio.url : '';
  const urlPrevia = typeof previa?.url === 'string' ? previa.url : '';
  if (!url || !urlPrevia) return null;

  const titulo = typeof item.alt_text === 'string' && item.alt_text ? item.alt_text : typeof item.title === 'string' ? item.title : '';
  return {
    id: item.id,
    url,
    largura: numero(cheio?.width),
    altura: numero(cheio?.height),
    previa: urlPrevia,
    previaLargura: numero(previa?.width),
    previaAltura: numero(previa?.height),
    descricao: titulo.trim(),
  };
}

/** A chave do cache. Busca vazia é a lista do momento, e ela também se guarda. */
export function chaveDoCache(termo: string, de: number, idioma: string) {
  return `${idioma}|${de}|${termo.trim().toLowerCase()}`;
}

const cache = new Map<string, { em: number; resposta: Resposta }>();
const gastos: number[] = [];

/** Quantas buscas de verdade saíram daqui na última hora e no último dia. Serve ao painel e ao teste. */
export function consumo(agora = Date.now()) {
  const hora = gastos.filter((t) => agora - t < 3600_000).length;
  const dia = gastos.filter((t) => agora - t < 86_400_000).length;
  return { hora, dia, porHora: POR_HORA, porDia: POR_DIA };
}

function temCota(agora: number) {
  while (gastos.length && agora - gastos[0] > 86_400_000) gastos.shift();
  const { hora, dia } = consumo(agora);
  return hora < POR_HORA && dia < POR_DIA;
}

/**
 * Busca no GIPHY, com cache e freio.
 *
 * Termo vazio devolve a lista do momento (`/trending`), que é o que o seletor mostra antes de alguém
 * digitar qualquer coisa — e é de longe a busca mais repetida do Syden, então guardá-la é o que mais
 * economiza cota.
 */
export async function buscar({ termo = '', de = 0, idioma = 'pt' }: { termo?: string; de?: number; idioma?: string }): Promise<Resposta> {
  if (!ligado()) return { estado: 'desligado' };

  const chave = chaveDoCache(termo, de, idioma);
  const agora = Date.now();
  const guardado = cache.get(chave);
  if (guardado && agora - guardado.em < CACHE_MS) return guardado.resposta;

  if (!temCota(agora)) {
    // Guardado vencido ainda é melhor do que nada: GIF não estraga, e uma grade vazia com uma
    // desculpa seria pior do que gatos de dez minutos atrás.
    return guardado ? guardado.resposta : { estado: 'sem-cota' };
  }

  const endereco = new URL(termo.trim() ? `${ENDERECO}/search` : `${ENDERECO}/trending`);
  endereco.searchParams.set('api_key', config.giphyKey);
  endereco.searchParams.set('limit', String(POR_PAGINA));
  endereco.searchParams.set('offset', String(Math.max(0, de)));
  endereco.searchParams.set('rating', CLASSIFICACAO);
  // O GIPHY entende o idioma da BUSCA, não da interface: procurar "abraço" em português acha coisa
  // diferente de "hug". Dois caracteres é o que ele aceita.
  endereco.searchParams.set('lang', idioma.slice(0, 2));
  if (termo.trim()) endereco.searchParams.set('q', termo.trim().slice(0, 100));

  gastos.push(agora);
  try {
    const resposta = await fetch(endereco, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (!resposta.ok) return { estado: 'indisponivel' };
    const corpo = (await resposta.json()) as { data?: unknown[]; pagination?: { total_count?: number; offset?: number } };
    const itens = (corpo.data ?? []).map(paraOSyden).filter((g): g is Gif => g !== null);
    const total = corpo.pagination?.total_count ?? 0;
    const proxima = de + POR_PAGINA < total ? de + POR_PAGINA : null;

    const pronta: Resposta = { estado: 'ok', itens, proxima };
    if (cache.size >= CACHE_MAXIMO) cache.delete(cache.keys().next().value!);
    cache.set(chave, { em: agora, resposta: pronta });
    return pronta;
  } catch {
    // Tempo esgotado ou rede fora: não é erro nosso e não vale poluir o registro a cada busca.
    return { estado: 'indisponivel' };
  }
}

/** Só para os testes: zera cache e consumo entre um caso e outro. */
export function esquecerTudo() {
  cache.clear();
  gastos.length = 0;
}
