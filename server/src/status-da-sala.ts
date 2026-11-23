import { contemPalavra, temLink } from './automod.js';
import * as db from './db.js';

/**
 * O STATUS DA SALA DE VOZ (23/11/2026, como o "status do canal de voz" do Discord): um texto curto embaixo do nome da
 * sala, na lista de canais ("ranqueada, não chamar"). Muda quem está NA sala, ou quem administra a comunidade.
 *
 * O risco é o mesmo do "Jogando agora" (jogando-agora.ts): status que ninguém atualiza vira enfeite morto. Por isso ele
 * SOME SOZINHO quando a última pessoa sai da sala, e só existe com alguém lá dentro.
 *
 * Mora só na memória, como quem está em chamada: é o que está acontecendo agora, e o servidor reiniciar esquece.
 */

export const MAXIMO_DO_STATUS = 60;
/** Uma mudança a cada 3 s por pessoa: o status vai para a comunidade inteira, e não vira enxurrada. */
export const INTERVALO_DO_STATUS_MS = 3000;

/** channelId → o status e a comunidade dele (para mandar só o de cada comunidade). */
const statusDasSalas = new Map<number, { communityId: number; texto: string }>();
/** Quando cada pessoa mudou um status por último. */
const ultimaMudanca = new Map<number, number>();

/** Os status das salas de uma comunidade: { [channelId]: texto }. Vai junto do voice:state. */
export function statusDaComunidade(communityId: number): Record<number, string> {
  const saida: Record<number, string> = {};
  for (const [channelId, s] of statusDasSalas) if (s.communityId === communityId) saida[channelId] = s.texto;
  return saida;
}

/** A sala esvaziou (ou foi excluída): o status vai junto. Devolve se havia um. */
export function esquecerStatusDaSala(channelId: number): boolean {
  return statusDasSalas.delete(channelId);
}

/** Espaços e quebras de linha viram um espaço só: é uma linha embaixo do nome da sala. */
export function limparStatus(texto: unknown): string {
  return typeof texto === 'string' ? texto.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Muda (ou, com o texto vazio, tira) o status de uma sala. Quem chama diz se a pessoa está na sala e quantas pessoas há
 * nela (o estado da voz mora em realtime.ts). Devolve o erro para quem pediu, ou se o status mudou de fato.
 */
export function definirStatusDaSala(pedido: {
  channelId: number;
  userId: number;
  texto: unknown;
  naSala: boolean;
  pessoasNaSala: number;
  agora?: number;
}): { ok: true; mudou: boolean; communityId: number } | { ok: false; error: string } {
  const agora = pedido.agora ?? Date.now();
  const channel = db.findChannel(pedido.channelId);
  if (!channel || channel.type !== 'voice' || channel.communityId === null) return { ok: false, error: 'Sala inválida.' };
  const communityId = channel.communityId;
  const papel = db.memberRole(communityId, pedido.userId);
  if (!papel) return { ok: false, error: 'Você não participa desta comunidade.' };
  const administra = papel === 'owner' || papel === 'admin';
  if (!pedido.naSala && !administra) return { ok: false, error: 'Só quem está na sala muda o status dela.' };

  const texto = limparStatus(pedido.texto);
  if ([...texto].length > MAXIMO_DO_STATUS) {
    return { ok: false, error: 'O status da sala tem no máximo 60 caracteres.' };
  }
  if (texto && pedido.pessoasNaSala === 0) return { ok: false, error: 'A sala está vazia: o status só aparece com alguém nela.' };

  // A moderação da comunidade vale aqui como nas mensagens (automod.ts), e quem administra não passa por ela: é quem
  // escreve as regras.
  if (!administra && texto) {
    const silencio = db.silenciadoAte(communityId, pedido.userId, agora);
    if (silencio) {
      const minutos = Math.ceil((Date.parse(silencio) - agora) / 60_000);
      return { ok: false, error: `Você está em silêncio nesta comunidade por mais ${minutos} min.` };
    }
    const regras = db.regrasDeModeracao(communityId);
    if (regras.palavras.some((palavra) => contemPalavra(texto, palavra))) {
      return { ok: false, error: 'Esta comunidade não permite uma das palavras deste status.' };
    }
    if (regras.links && temLink(texto)) return { ok: false, error: 'Esta comunidade não permite links no status da sala.' };
  }

  if (agora - (ultimaMudanca.get(pedido.userId) ?? -Infinity) < INTERVALO_DO_STATUS_MS) {
    return { ok: false, error: 'Espere alguns segundos para mudar o status da sala de novo.' };
  }
  ultimaMudanca.set(pedido.userId, agora);
  if (ultimaMudanca.size > 5000) {
    for (const [id, quando] of ultimaMudanca) if (agora - quando > INTERVALO_DO_STATUS_MS) ultimaMudanca.delete(id);
  }

  const antes = statusDasSalas.get(channel.id)?.texto ?? '';
  if (texto) statusDasSalas.set(channel.id, { communityId, texto });
  else statusDasSalas.delete(channel.id);
  return { ok: true, mudou: antes !== texto, communityId };
}

/** Só para os testes: começar do zero. */
export function esquecerTodosOsStatus() {
  statusDasSalas.clear();
  ultimaMudanca.clear();
}
