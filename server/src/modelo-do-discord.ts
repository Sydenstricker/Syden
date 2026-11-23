import type { FastifyInstance } from 'fastify';
import { muitosLinks } from './media-routes.js';
import { requireUser } from './routes.js';
import type { ChannelType } from './db.js';

// ===================================================================================================
// TRAZER A ESTRUTURA DE UM SERVIDOR DO DISCORD (23/11/2026, pedido dele: "copiam a estrutura de uma comunidade
// do Discord e transferem para o novo app, para facilitar a transição").
//
// Quem cuida de um servidor no Discord gera um MODELO DE SERVIDOR (Configurações do servidor → Modelo de servidor),
// um link discord.new/CODIGO. Ao criar uma comunidade, quem cria cola esse link, vê a prévia e a comunidade nasce
// com os canais e os cargos de lá. Mensagens não vêm: o modelo nem as tem.
//
// QUEM FALA COM O DISCORD É O SERVIDOR, nunca o navegador, e só com o CÓDIGO do modelo (a rota pública
// /guilds/templates/{code}, que responde sem conta). Com prazo, tamanho máximo e o mesmo teto de links por pessoa da
// imagem por link (`muitosLinks`). A resposta fica 10 minutos na memória, para a prévia e o "Criar" não pedirem duas vezes.
//
// O QUE VEM, E COMO:
//   - texto (0), anúncios (5), fórum (15) e mídia (16) → canal de texto; voz (2) e palco (13) → canal de voz; o resto
//     (categorias, diretório…) não vira canal.
//   - O Syden não tem categoria: elas são ACHATADAS na ordem em que o Discord mostra — primeiro os canais sem categoria,
//     depois cada categoria pela posição; dentro de cada grupo, os de texto antes dos de voz, cada um pela posição.
//   - Os nomes passam pela regra de qualquer canal (texto em minúsculas e hífens, até 50), e no máximo MAXIMO_DE_CANAIS.
//   - Cargos: só o NOME e a COR. Permissões NÃO vêm: no Syden cargo é identidade, não poder (ver "OS CARGOS" em db.ts).
//     O @everyone fica de fora (é todo mundo), e também os cargos de robô, quando o modelo os marca.
// ===================================================================================================

/** Um teto de canais, porque o modelo do Discord aceita até 500 e uma lista de 500 canais ninguém lê. */
export const MAXIMO_DE_CANAIS = 100;
/** O mesmo teto e o mesmo tamanho de nome de cargos-routes.ts / db.MAXIMO_DE_CARGOS. */
const MAXIMO_DE_CARGOS = 50;
const NOME_DO_CARGO = 32;
const NOME_DO_CANAL = 50;
/** A cor de quem não tem cor no Discord (o `color` 0): o cinza da última cor da tela de cargos. */
const COR_SEM_COR = '#9aa1b1';

const PRAZO_MS = 8000;
/** Um modelo de 500 canais com tudo vem em ~600 KB. Passou de 2 MB, não é um modelo. */
const MAXIMO_DE_BYTES = 2 * 1024 * 1024;
const GUARDA_MS = 10 * 60_000;

export const LINK_INVALIDO = 'Esse link não é de um modelo de servidor do Discord.';
export const MODELO_INEXISTENTE = 'Esse modelo não existe no Discord. Peça um link novo a quem cuida do servidor.';
export const DISCORD_FORA = 'O Discord não respondeu. Tente de novo daqui a pouco.';

export interface ModeloConvertido {
  /** O nome do servidor de origem, para sugerir o nome da comunidade. */
  nome: string;
  canais: { name: string; type: ChannelType }[];
  cargos: { nome: string; cor: string }[];
  /** Canais ou cargos que ficaram de fora por passar do teto. */
  cortados: number;
}

/** "discord.new/abc", "https://discord.com/template/abc", "discordapp.com/template/abc" ou só "abc" → "abc". */
export function codigoDoModelo(cru: unknown): string | null {
  const texto = String(cru ?? '').trim();
  if (!texto || texto.length > 300) return null;
  let codigo = texto;
  const comEndereco = /^(?:https?:\/\/)?(?:www\.|ptb\.|canary\.)?(discord\.new|discord(?:app)?\.com\/template)\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(texto);
  if (comEndereco) codigo = comEndereco[2];
  else if (/[/.:\s]/.test(texto)) return null;
  return /^[A-Za-z0-9_-]{2,64}$/.test(codigo) ? codigo : null;
}

function letras(texto: string, maximo: number): string {
  return Array.from(texto).slice(0, maximo).join('').trim();
}

function nomeDoCanal(cru: unknown, type: ChannelType): string | null {
  // Como channelName (routes.ts): texto em minúsculas e hífens; cortado em vez de recusado, porque o Discord aceita 100.
  let nome = letras(String(cru ?? '').trim(), NOME_DO_CANAL);
  if (type === 'text') nome = nome.toLowerCase().replace(/\s+/g, '-');
  while (nome.length > NOME_DO_CANAL) nome = Array.from(nome).slice(0, -1).join('');
  return nome.length >= 1 ? nome : null;
}

const TIPO: Record<number, ChannelType> = { 0: 'text', 5: 'text', 15: 'text', 16: 'text', 2: 'voice', 13: 'voice' };

interface CanalDoDiscord {
  id?: unknown;
  type?: unknown;
  name?: unknown;
  position?: unknown;
  parent_id?: unknown;
}
interface CargoDoDiscord {
  id?: unknown;
  name?: unknown;
  color?: unknown;
  managed?: unknown;
  tags?: unknown;
}

const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** A parte pura: o JSON do Discord → o que a comunidade ganha. Exportada para o teste. */
export function converterModelo(json: unknown): ModeloConvertido | null {
  const origem = (json as { serialized_source_guild?: unknown })?.serialized_source_guild as
    | { name?: unknown; channels?: unknown; roles?: unknown }
    | undefined;
  if (!origem || typeof origem !== 'object') return null;
  const canais = (Array.isArray(origem.channels) ? origem.channels : []) as CanalDoDiscord[];
  const cargos = (Array.isArray(origem.roles) ? origem.roles : []) as CargoDoDiscord[];

  const porPosicao = (a: CanalDoDiscord, b: CanalDoDiscord) => numero(a.position) - numero(b.position) || numero(a.id) - numero(b.id);
  const categorias = canais.filter((c) => c.type === 4).sort(porPosicao);
  const idsDasCategorias = new Set(categorias.map((c) => String(c.id)));
  const doGrupo = (pai: string | null) =>
    canais
      .filter((c) => typeof c.type === 'number' && TIPO[c.type])
      .filter((c) => {
        const p = c.parent_id === null || c.parent_id === undefined ? null : String(c.parent_id);
        // Canal que aponta para uma categoria que não veio conta como sem categoria.
        return pai === null ? p === null || !idsDasCategorias.has(p) : p === pai;
      })
      // Como o Discord mostra: os de texto antes dos de voz, cada um pela posição.
      .sort((a, b) => (TIPO[a.type as number] === TIPO[b.type as number] ? porPosicao(a, b) : TIPO[a.type as number] === 'text' ? -1 : 1));
  const ordem = [...doGrupo(null), ...categorias.flatMap((cat) => doGrupo(String(cat.id)))];

  const convertidos: ModeloConvertido['canais'] = [];
  for (const canal of ordem) {
    const type = TIPO[canal.type as number];
    const name = nomeDoCanal(canal.name, type);
    if (name) convertidos.push({ name, type });
  }

  const cargosConvertidos: ModeloConvertido['cargos'] = [];
  // O modelo traz os cargos de baixo para cima (o @everyone primeiro); a lista do Syden é de cima para baixo.
  for (const cargo of [...cargos].reverse()) {
    const nomeCru = String(cargo.name ?? '').trim();
    if (cargo.id === 0 || cargo.id === '0' || nomeCru === '@everyone') continue;
    const tags = cargo.tags as { bot_id?: unknown; integration_id?: unknown } | undefined;
    if (cargo.managed === true || tags?.bot_id || tags?.integration_id) continue;
    const nome = letras(nomeCru.replace(/\s+/g, ' '), NOME_DO_CARGO);
    if (!nome) continue;
    const cor = numero(cargo.color);
    cargosConvertidos.push({
      nome,
      cor: cor > 0 && cor <= 0xffffff ? `#${cor.toString(16).padStart(6, '0')}` : COR_SEM_COR,
    });
  }

  const cortados = Math.max(0, convertidos.length - MAXIMO_DE_CANAIS) + Math.max(0, cargosConvertidos.length - MAXIMO_DE_CARGOS);
  return {
    nome: letras(String(origem.name ?? '').trim(), 40),
    canais: convertidos.slice(0, MAXIMO_DE_CANAIS),
    cargos: cargosConvertidos.slice(0, MAXIMO_DE_CARGOS),
    cortados,
  };
}

/** Quem busca: o fetch de verdade, trocado só pelo teste (sem rede). */
let buscar: typeof fetch = (...args) => fetch(...args);
export function definirBuscaDoDiscord(f: typeof fetch) {
  buscar = f;
  guardados.clear();
}

const guardados = new Map<string, { em: number; modelo: ModeloConvertido }>();

export class ErroDoModelo extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function lerComTeto(resposta: Response): Promise<string> {
  const declarado = Number(resposta.headers.get('content-length') ?? 0);
  if (declarado > MAXIMO_DE_BYTES) throw new ErroDoModelo(DISCORD_FORA, 502);
  if (!resposta.body) return '';
  const leitor = resposta.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAXIMO_DE_BYTES) {
      await leitor.cancel().catch(() => {});
      throw new ErroDoModelo(DISCORD_FORA, 502);
    }
    pedacos.push(value);
  }
  return Buffer.concat(pedacos).toString('utf8');
}

/** O modelo pelo código, da memória se foi pedido há pouco. Lança ErroDoModelo com a mensagem da tela. */
export async function buscarModelo(codigo: string, agora = Date.now()): Promise<ModeloConvertido> {
  for (const [chave, guardado] of guardados) if (agora - guardado.em > GUARDA_MS) guardados.delete(chave);
  const guardado = guardados.get(codigo);
  if (guardado) return guardado.modelo;

  let resposta: Response;
  try {
    resposta = await buscar(`https://discord.com/api/v10/guilds/templates/${encodeURIComponent(codigo)}`, {
      headers: { accept: 'application/json', 'user-agent': 'Syden (modelo de servidor)' },
      signal: AbortSignal.timeout(PRAZO_MS),
      redirect: 'error',
    });
  } catch {
    throw new ErroDoModelo(DISCORD_FORA, 502);
  }
  // O Discord responde 404 (código 10057, "Unknown server template") para modelo que não existe ou foi apagado.
  if (resposta.status === 404) throw new ErroDoModelo(MODELO_INEXISTENTE, 404);
  if (!resposta.ok) throw new ErroDoModelo(DISCORD_FORA, 502);
  let json: unknown;
  try {
    json = JSON.parse(await lerComTeto(resposta));
  } catch (erro) {
    if (erro instanceof ErroDoModelo) throw erro;
    throw new ErroDoModelo(DISCORD_FORA, 502);
  }
  const modelo = converterModelo(json);
  if (!modelo) throw new ErroDoModelo(DISCORD_FORA, 502);
  guardados.set(codigo, { em: agora, modelo });
  return modelo;
}

/**
 * Para a rota de criar comunidade: o link → o modelo, ou a resposta de erro já dada. A prévia normalmente deixou o modelo
 * na memória, e então criar não conta no teto de links.
 */
export async function modeloParaCriar(userId: number, cru: unknown): Promise<ModeloConvertido | { erro: string; status: number }> {
  const codigo = codigoDoModelo(cru);
  if (!codigo) return { erro: LINK_INVALIDO, status: 400 };
  if (!guardados.has(codigo) && muitosLinks(userId)) return { erro: 'Muitos links seguidos. Tente de novo daqui a pouco.', status: 429 };
  try {
    return await buscarModelo(codigo);
  } catch (erro) {
    if (erro instanceof ErroDoModelo) return { erro: erro.message, status: erro.status };
    throw erro;
  }
}

export function registerModeloDoDiscordRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** A PRÉVIA: o que a comunidade vai ganhar com esse modelo, antes de criar. */
    authed.post<{ Body: { link?: string } }>('/api/modelo-do-discord', async (request, reply) => {
      const resultado = await modeloParaCriar(request.user.id, request.body?.link);
      if ('erro' in resultado) return reply.code(resultado.status).send({ error: resultado.erro });
      return resultado;
    });
  });
}
