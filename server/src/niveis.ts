import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { communityRoom, salaDaPessoa } from './realtime.js';

/**
 * OS NÍVEIS: quanto vale cada coisa, a conta do nível e o que acontece ao subir. O que se guarda está
 * no bloco "OS NÍVEIS" de db.ts.
 *
 * Os números são os do MEE6, que é o que as pessoas já conhecem: de 15 a 25 pontos por mensagem, no
 * máximo uma por minuto, e cada nível pedindo 5n² + 50n + 100 pontos a mais que o anterior.
 *
 * VOZ CONTA, mas só acompanhada. Um minuto numa sala com mais alguém vale 10 pontos; sozinho, nada —
 * senão bastaria deixar o computador numa sala vazia a noite inteira.
 */
export const PONTOS_POR_MENSAGEM = { minimo: 15, maximo: 25 };
export const INTERVALO_ENTRE_MENSAGENS_MS = 60_000;
export const PONTOS_POR_MINUTO_DE_VOZ = 10;

/** Quantos pontos a mais levam do nível n ao n+1. */
export function pontosParaSubir(nivel: number): number {
  return 5 * nivel * nivel + 50 * nivel + 100;
}

/** O nível de quem tem tantos pontos, e quanto falta para o próximo. */
export function nivelDe(pontos: number): { nivel: number; noNivel: number; paraOProximo: number } {
  let nivel = 0;
  let resto = pontos;
  while (resto >= pontosParaSubir(nivel)) {
    resto -= pontosParaSubir(nivel);
    nivel++;
  }
  return { nivel, noNivel: resto, paraOProximo: pontosParaSubir(nivel) };
}

/**
 * Depois de somar: se o nível subiu, avisa SÓ a própria pessoa (nada de anunciar na conversa dos
 * outros) e entrega os cargos das recompensas que ela acabou de alcançar.
 */
function aoSomar(io: IOServer, communityId: number, userId: number, antes: number, depois: number) {
  const nivelAntes = nivelDe(antes).nivel;
  const nivelAgora = nivelDe(depois).nivel;
  if (nivelAgora <= nivelAntes) return;
  const ganhos = db
    .recompensasDeNivel(communityId)
    .filter((r) => r.nivel > nivelAntes && r.nivel <= nivelAgora)
    .map((r) => r.cargoId);
  for (const cargoId of ganhos) db.darCargo(communityId, userId, cargoId);
  if (ganhos.length > 0) {
    const member = db.listCommunityMembers(communityId).find((m) => m.id === userId);
    if (member) io.to(communityRoom(communityId)).emit('member:updated', { communityId, member });
  }
  io.to(salaDaPessoa(userId)).emit('nivel:subiu', { communityId, nivel: nivelAgora, cargos: ganhos });
}

/** Uma mensagem num canal de comunidade. Não faz nada com os níveis desligados. */
export function pontuarMensagem(io: IOServer, communityId: number, userId: number, agora = Date.now()) {
  if (!db.niveisLigados(communityId)) return;
  const { minimo, maximo } = PONTOS_POR_MENSAGEM;
  const pontos = minimo + Math.floor(Math.random() * (maximo - minimo + 1));
  const soma = db.somarPontos(communityId, userId, pontos, agora, { intervaloMs: INTERVALO_ENTRE_MENSAGENS_MS });
  if (soma) aoSomar(io, communityId, userId, soma.antes, soma.depois);
}

/**
 * O minuto de voz: recebe quem está em cada sala agora e pontua quem não está sozinho. Chamado pelo
 * relógio de um minuto do realtime.ts.
 */
export function pontuarMinutoDeVoz(io: IOServer, emChamada: { userId: number; communityId: number; channelId: number }[]) {
  const porSala = new Map<number, typeof emChamada>();
  for (const pessoa of emChamada) porSala.set(pessoa.channelId, [...(porSala.get(pessoa.channelId) ?? []), pessoa]);
  for (const sala of porSala.values()) {
    if (sala.length < 2 || !db.niveisLigados(sala[0].communityId)) continue;
    for (const { userId, communityId } of sala) {
      const soma = db.somarPontos(communityId, userId, PONTOS_POR_MINUTO_DE_VOZ, Date.now());
      if (soma) aoSomar(io, communityId, userId, soma.antes, soma.depois);
    }
  }
}
