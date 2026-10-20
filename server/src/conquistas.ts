import type { FastifyInstance } from 'fastify';
import * as db from './db.js';
import type { DadosDasConquistas, SessaoDeVoz } from './db.js';
import { requireUser } from './routes.js';

/**
 * AS CONQUISTAS DA TURMA (20/10/2026, as 19 da pesquisa e "A turma do jogo", aprovadas por ele; ver
 * docs/conquistas-coletivas.md). O que vale, da pesquisa:
 *
 * - CONTA GENTE JUNTA, não volume: horas de call só valem com 2 ou mais NA MESMA SALA, partidas só com 2 ou mais.
 * - O DEGRAU ALCANÇADO NUNCA SE PERDE: fica em conquistas_alcancadas, e quem sai ou apaga a conta não o desfaz.
 * - SEM PRAZO, SEM SEQUÊNCIA: tudo é acumulado desde sempre; nada vence nem pede volta diária.
 * - OS BONS EXEMPLOS (o placar que ele pediu: "não é para estimular a competição, e sim dar ênfase aos bons
 *   exemplos"): quem mais contribuiu nos últimos 30 dias, até 3 nomes, sem posição. Só onde a contribuição é de uma
 *   pessoa (quem cantou, quem transmitiu, quem jogou, quem acolheu); "Roda cheia" ou "A turma cresce" não têm.
 *
 * As contas são feitas na hora, a cada pedido, sobre o que o servidor já guarda; o que passa de um degrau é gravado.
 */

const HORA = 3600_000;
const DIA = 24 * HORA;
/** Membro novo: nos primeiros 30 dias depois de entrar. */
const NOVATO = 30 * DIA;
/** A janela dos bons exemplos. */
const JANELA = 30 * DIA;
/** Um encontro marcado "aconteceu" se houve call de 3 ou mais entre 15 min antes e 1 h depois da hora marcada. */
const ENCONTRO_ANTES = 15 * 60_000;
const ENCONTRO_DEPOIS = HORA;

/** Os jogos que existem (server/src/minijogos-routes.ts, JOGOS): "Repertório" completo é jogar todos. */
export const JOGOS_DAS_CONQUISTAS = ['tamanho', 'stop', 'sudoku', 'gomoku', 'mancala', 'xadrez', 'lobisomem', 'desenho', 'palavra'] as const;

export interface Conquista {
  id: string;
  /** O grupo, na ordem da tela. */
  grupo: 'voz' | 'jogos' | 'karaoke' | 'acolhimento' | 'marcos';
  degraus: number[];
  /** Para "A turma do jogo": qual jogo. */
  jogo?: string;
}

export const CONQUISTAS: Conquista[] = [
  { id: 'horas-juntos', grupo: 'voz', degraus: [10, 50, 200, 1000] },
  { id: 'roda-cheia', grupo: 'voz', degraus: [4, 6, 10] },
  { id: 'cinema', grupo: 'voz', degraus: [5, 25, 100] },
  { id: 'muitas-vozes', grupo: 'voz', degraus: [5, 15, 40] },
  { id: 'mesa-de-jogo', grupo: 'jogos', degraus: [10, 50, 200, 500] },
  { id: 'repertorio', grupo: 'jogos', degraus: [3, 6, JOGOS_DAS_CONQUISTAS.length] },
  { id: 'vila-completa', grupo: 'jogos', degraus: [6, 8, 10] },
  { id: 'todo-mundo-joga', grupo: 'jogos', degraus: [5, 15, 30] },
  ...JOGOS_DAS_CONQUISTAS.map((jogo): Conquista => ({ id: 'turma-' + jogo, grupo: 'jogos', degraus: [10, 50, 200], jogo })),
  { id: 'palco-aberto', grupo: 'karaoke', degraus: [10, 50, 200] },
  { id: 'coral', grupo: 'karaoke', degraus: [3, 8, 20] },
  { id: 'setlist', grupo: 'karaoke', degraus: [10, 30, 100] },
  { id: 'boas-vindas', grupo: 'acolhimento', degraus: [3, 10, 25] },
  { id: 'primeira-partida', grupo: 'acolhimento', degraus: [3, 10, 25] },
  { id: 'primeira-cancao', grupo: 'acolhimento', degraus: [1, 5, 15] },
  { id: 'turma-cresce', grupo: 'acolhimento', degraus: [5, 15, 50, 100] },
  { id: 'aniversario', grupo: 'marcos', degraus: [1, 2, 5] },
  { id: 'parabens', grupo: 'marcos', degraus: [5, 20, 50] },
  { id: 'encontro-marcado', grupo: 'marcos', degraus: [3, 10, 30] },
  { id: 'conversa-viva', grupo: 'marcos', degraus: [1000, 10000, 50000] },
];

export interface Medida {
  valor: number;
  /** Os bons exemplos: ids de quem mais contribuiu nos últimos 30 dias (até 3), ou ausente onde não se aplica. */
  exemplos?: number[];
}

/** Os trechos de uma sala em que a mesma turma esteve junta: de `inicio` a `fim`, com `presentes`. */
interface Trecho {
  sala: string;
  inicio: number;
  fim: number;
  presentes: number[];
}

/**
 * A VARREDURA: junta as sessões de voz por sala e devolve os trechos em que o grupo presente não mudou. As sessões
 * de antes de 20/10/2026 não sabem a sala: para elas, a comunidade inteira conta como uma sala (a aproximação fica do
 * lado de mais gente junta, e só no passado).
 */
export function trechos(sessoes: SessaoDeVoz[]): Trecho[] {
  const porSala = new Map<string, { t: number; d: 1 | -1; u: number }[]>();
  for (const s of sessoes) {
    if (!(s.fim > s.inicio)) continue;
    const sala = s.channelId === null ? 'comunidade' : String(s.channelId);
    const ev = porSala.get(sala) ?? [];
    ev.push({ t: s.inicio, d: 1, u: s.userId }, { t: s.fim, d: -1, u: s.userId });
    porSala.set(sala, ev);
  }
  const saida: Trecho[] = [];
  for (const [sala, ev] of porSala) {
    // saídas antes das entradas no mesmo instante: quem sai às 10h e quem entra às 10h não estiveram juntos
    ev.sort((a, b) => a.t - b.t || a.d - b.d);
    const conta = new Map<number, number>();
    let desde = ev[0]?.t ?? 0;
    for (const e of ev) {
      if (e.t > desde && conta.size) saida.push({ sala, inicio: desde, fim: e.t, presentes: [...conta.keys()] });
      desde = e.t;
      const n = (conta.get(e.u) ?? 0) + e.d;
      if (n > 0) conta.set(e.u, n);
      else conta.delete(e.u);
    }
  }
  return saida;
}

/** Os 3 que mais somaram e ainda são membros; quem tem 0 não entra. O empate vai pelo id, só para a ordem ser estável. */
function maiores(soma: Map<number, number>, membros: Set<number>): number[] {
  return [...soma]
    .filter(([id, v]) => v > 0 && membros.has(id))
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 3)
    .map(([id]) => id);
}

const somar = (m: Map<number, number>, id: number, v: number) => m.set(id, (m.get(id) ?? 0) + v);

/** As medidas de todas as conquistas, sobre os dados de uma comunidade, no instante `agora`. */
export function medir(d: DadosDasConquistas, agora = Date.now()): Record<string, Medida> {
  const membros = new Set(d.membros.map((m) => m.userId));
  const entrou = new Map(d.membros.map((m) => [m.userId, m.entrou]));
  const recente = (t: number) => t >= agora - JANELA;
  const novatoEm = (id: number, t: number) => {
    const e = entrou.get(id);
    return e !== undefined && t >= e && t - e <= NOVATO;
  };
  const m: Record<string, Medida> = {};

  // ---- voz
  const tr = trechos(d.sessoes);
  let juntos = 0;
  let roda = 0;
  const comAlguem = new Map<number, number>(); // segundos de cada um junto de alguém, desde sempre
  const juntosRecente = new Map<number, number>();
  const novatosQueConversaram = new Set<number>();
  const acolheu = new Map<number, number>();
  for (const x of tr) {
    if (x.presentes.length > roda) roda = x.presentes.length;
    if (x.presentes.length < 2) continue;
    const dur = x.fim - x.inicio;
    juntos += dur;
    const ini = Math.max(x.inicio, agora - JANELA);
    const durRecente = Math.max(0, x.fim - ini);
    const novatos = x.presentes.filter((id) => novatoEm(id, x.inicio));
    for (const id of x.presentes) {
      somar(comAlguem, id, dur);
      if (durRecente) somar(juntosRecente, id, durRecente);
      // quem acolheu: um veterano junto de um novato (nos últimos 30 dias)
      if (durRecente && novatos.length && !novatos.includes(id)) somar(acolheu, id, durRecente);
    }
    // o novato conta por ter estado junto de alguém (qualquer um) nos primeiros 30 dias: não ficou sozinho
    for (const id of novatos) novatosQueConversaram.add(id);
  }
  m['horas-juntos'] = { valor: Math.floor(juntos / HORA), exemplos: maiores(juntosRecente, membros) };
  m['roda-cheia'] = { valor: roda };
  // "Muitas vozes": quem passou pelo menos 1 minuto junto de alguém
  m['muitas-vozes'] = { valor: [...comAlguem.values()].filter((v) => v >= 60_000).length };

  const cinemaRecente = new Map<number, number>();
  let cinema = 0;
  for (const c of d.cinema) {
    cinema += c.segundos;
    if (c.dia >= agora - JANELA - DIA) somar(cinemaRecente, c.userId, c.segundos);
  }
  m.cinema = { valor: Math.floor(cinema / 3600), exemplos: maiores(cinemaRecente, membros) };

  // ---- jogos (só partidas com 2 ou mais; o banco já filtra)
  const jogaram = new Set<number>();
  const jogouRecente = new Map<number, number>();
  const porJogo = new Map<string, number>();
  const porJogoRecente = new Map<string, Map<number, number>>();
  const novatosQueJogaram = new Set<number>();
  let vila = 0;
  for (const p of d.partidas) {
    porJogo.set(p.jogo, (porJogo.get(p.jogo) ?? 0) + 1);
    if (p.jogo === 'lobisomem' && p.jogadores > vila) vila = p.jogadores;
    const veteranos = p.quem.filter((id) => !novatoEm(id, p.em));
    for (const id of p.quem) {
      jogaram.add(id);
      // primeira partida: um novato jogando com pelo menos um veterano
      if (novatoEm(id, p.em) && veteranos.length) novatosQueJogaram.add(id);
      if (recente(p.em)) {
        somar(jogouRecente, id, 1);
        const doJogo = porJogoRecente.get(p.jogo) ?? new Map<number, number>();
        somar(doJogo, id, 1);
        porJogoRecente.set(p.jogo, doJogo);
      }
    }
  }
  m['mesa-de-jogo'] = { valor: d.partidas.length, exemplos: maiores(jogouRecente, membros) };
  m.repertorio = { valor: [...porJogo.keys()].filter((j) => (JOGOS_DAS_CONQUISTAS as readonly string[]).includes(j)).length };
  m['vila-completa'] = { valor: vila };
  m['todo-mundo-joga'] = { valor: jogaram.size };
  for (const jogo of JOGOS_DAS_CONQUISTAS) {
    m['turma-' + jogo] = { valor: porJogo.get(jogo) ?? 0, exemplos: maiores(porJogoRecente.get(jogo) ?? new Map(), membros) };
  }

  // ---- karaokê
  const cantouRecente = new Map<number, number>();
  const novatosQueCantaram = new Set<number>();
  for (const c of d.cantadas) {
    if (recente(c.em)) somar(cantouRecente, c.userId, 1);
    if (novatoEm(c.userId, c.em)) novatosQueCantaram.add(c.userId);
  }
  m['palco-aberto'] = { valor: d.cantadas.length + d.cantadasDeQuemSaiu, exemplos: maiores(cantouRecente, membros) };
  m.coral = { valor: new Set(d.cantadas.map((c) => c.userId)).size };
  m.setlist = { valor: new Set(d.cantadas.map((c) => c.songId)).size };

  // ---- acolhimento
  m['boas-vindas'] = { valor: novatosQueConversaram.size, exemplos: maiores(acolheu, membros) };
  m['primeira-partida'] = { valor: novatosQueJogaram.size };
  m['primeira-cancao'] = { valor: novatosQueCantaram.size };
  m['turma-cresce'] = { valor: d.membros.length };

  // ---- marcos
  m.aniversario = { valor: anosCompletos(d.criadaEm, agora) };
  m.parabens = { valor: d.parabens };
  m['encontro-marcado'] = {
    valor: d.eventos.filter((q) => tr.some((x) => x.presentes.length >= 3 && x.fim > q - ENCONTRO_ANTES && x.inicio < q + ENCONTRO_DEPOIS)).length,
  };
  m['conversa-viva'] = { valor: d.mensagens };
  return m;
}

function anosCompletos(desde: number, agora: number) {
  const a = new Date(desde), b = new Date(agora);
  let anos = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) anos--;
  return Math.max(0, anos);
}

/** Mede, grava o que passou de degrau e devolve a lista para a tela. */
export function conquistasDaComunidade(communityId: number, agora = Date.now()) {
  const medidas = medir(db.dadosDasConquistas(communityId), agora);
  const novos = CONQUISTAS.flatMap((c) => c.degraus.filter((g) => (medidas[c.id]?.valor ?? 0) >= g).map((degrau) => ({ conquista: c.id, degrau })));
  db.guardarConquistas(communityId, novos);
  const alcancadas = db.conquistasAlcancadas(communityId);
  return CONQUISTAS.map((c) => ({
    id: c.id,
    grupo: c.grupo,
    jogo: c.jogo,
    degraus: c.degraus,
    valor: medidas[c.id]?.valor ?? 0,
    alcancados: alcancadas.filter((a) => a.conquista === c.id).map((a) => ({ degrau: a.degrau, em: a.em })),
    exemplos: medidas[c.id]?.exemplos,
  }));
}

export function registerConquistasRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);
    // Todo membro vê; quem não participa recebe 404, como no calendário.
    authed.get<{ Params: { id: string } }>('/api/communities/:id/conquistas', async (request, reply) => {
      const communityId = Number(request.params.id);
      if (!Number.isInteger(communityId) || !db.memberRole(communityId, request.user.id)) {
        return reply.code(404).send({ error: 'Comunidade não encontrada.' });
      }
      return { conquistas: conquistasDaComunidade(communityId) };
    });
  });
}
