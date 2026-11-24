/**
 * O PINBALL DA HORTA (16/11/2026): uma mesa de pinball de 16 bits na horta, com palhetas, mola, repolhos que rebatem,
 * estilingues, cenouras que caem, a órbita, a toca do coelho (que solta o multibola), a bola salva e a mesa que trava quando se
 * sacode demais. SÓ A MECÂNICA dos pinballs; a mesa, os nomes e o desenho são nossos (pinball-sim.ts, JogoPinball.tsx).
 *
 * A PARTIDA É DE QUEM JOGA, no computador dele (passos fixos de 1/60 s), e O SERVIDOR A REFAZ, como o Minigolfe e o Rolê do
 * coelho: a regra mora em duas cópias iguais byte a byte (server/src/pinball-sim.ts e web/src/pinball/sim.ts), e o site manda
 * os COMANDOS de cada passo (as palhetas, a mola, o tranco) em TRECHOS, durante a partida. O servidor anda a mesa dele com
 * eles: os pontos que valem, a bola da vez e o fim são os dele. Um trecho que repete passos já lidos é aproveitado a partir do
 * que falta (o site manda de novo do último passo que o servidor confirmou), e nenhum passo anda à frente do relógio do
 * servidor (com a folga da rede): o que passa do relógio fica para o trecho seguinte. O que sobra possível: um programa que
 * jogue melhor que gente (o piloto automático dos testes é um, e fraco).
 *
 * NO SOLO: o RECORDE da pessoa (pinball_recordes), que os AMIGOS ACEITOS também veem (a lista ao lado da mesa); ESC pausa (a
 * janela sem foco também: o relógio do servidor só limita para a frente). Sem troféu.
 *
 * NA SALA, de 2 a 8: o mesmo verde para todos, cada um na sua mesa, durante 3 minutos de mesa (ou até as três bolas acabarem).
 * A ordem ao vivo é a dos pontos que o servidor já refez. Mais pontos ganha; os três primeiros vão à estante de troféus
 * (pista 'pinball'). Sem itens, a partida da sala que bate o recorde da pessoa vira o recorde dela (como no skate).
 *
 * A SEGUNDA MESA (19/11/2026): no Solo, a pessoa escolhe a mesa ao jogar (o POMAR, MESAS[1] em pinball-sim.ts). O recorde do
 * pomar é só dela, na tabela comum dos recordes do Solo (jogo 'pinball', variante 'pomar'); o da horta continua em
 * pinball_recordes, com a lista dos amigos. Na sala, a horta.
 *
 * A TERCEIRA MESA (24/11/2026): o LAGO (MESAS[2]: as duas rampas, o sapo da raia de saída e as missões dele), também só no Solo,
 * com o recorde na tabela comum (variante 'lago').
 */
import * as db from './db.js';
import type { Contexto, Definicao } from './minijogo-motor.js';
import { aplicar, entradasValidas, mesaValida, novaMesa, PASSOS_MAXIMOS, type Mesa } from './pinball-sim.js';

const recordeDoPomar = (userId: number) => db.recordeDoSolo(userId, 'pinball', 'pomar')?.valor ?? null;
/** A terceira mesa (24/11/2026), o LAGO: o recorde também na tabela comum, variante 'lago'. */
const recordeDoLago = (userId: number) => db.recordeDoSolo(userId, 'pinball', 'lago')?.valor ?? null;
/** A variante da tabela comum de cada mesa (a horta fica em pinball_recordes). */
const VARIANTE_DA_MESA = ['', 'pomar', 'lago'];

export const LARGADA_MS = 4000;
/** Na sala: 3 minutos de mesa, e a turma espera quem pausou mais 1 minuto. */
export const PASSOS_DA_SALA = 3 * 60 * 60;
export const PRAZO_DA_SALA_MS = (PASSOS_DA_SALA / 60) * 1000 + 60_000;
/** No Solo, a partida (com várias rodadas) fecha sozinha depois disto parada. */
const SOLO_PARADO_MS = 40 * 60_000;
/** Os passos podem chegar este tanto à frente do relógio do servidor (a rede e a contagem da largada). */
export const PASSOS_A_FRENTE = 180;
export const MAXIMO = 8;
/** Na sala, o "mudou, busque de novo" vai no máximo uma vez por segundo (o fim de alguém vai na hora). */
const AVISO_MS = 1000;

export const pinball: Definicao = criarPinball();

interface Jogador {
  mesa: Mesa;
  /** Quando a mesa começou a andar no relógio do servidor. */
  inicio: number;
}

const inteiro = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

/**
 * O trecho: os comandos a partir do passo `de`. Repete passos já lidos (pula) e não anda à frente do relógio. Devolve o erro,
 * ou null (aceito, mesmo que nada tenha andado).
 */
function lerTrecho(j: Jogador, corpo: Record<string, unknown>, agora: number): string | null {
  const { de, entradas } = corpo;
  if (!inteiro(de) || !entradasValidas(entradas)) return 'Partida inválida.';
  // um trecho que chega depois de um que se perdeu: o site manda de novo a partir do passo confirmado
  if (de > j.mesa.passo || j.mesa.terminou) return null;
  const teto = Math.floor(((agora - j.inicio) * 60) / 1000) + PASSOS_A_FRENTE;
  aplicar(j.mesa, entradas, j.mesa.passo - de, teto);
  j.mesa.eventos = [];
  return null;
}

const resumo = (m: Mesa) => ({ passo: m.passo, pontos: m.pontos, bola: m.bola, terminou: m.terminou });

export function criarPinball({ agora = Date.now }: { agora?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    maximo: MAXIMO,
    comecar(ctx, { naSala }) {
      const inscritos = naSala.slice(0, MAXIMO);
      const solo = ctx.solo ?? inscritos.length === 1;
      return solo ? partidaSolo(ctx, inscritos[0], agora) : partidaNaSala(ctx, inscritos, agora);
    },
  };
}

// =====================================================================================================================
// O SOLO
// =====================================================================================================================

function partidaSolo(ctx: Contexto, eu: number, agora: () => number) {
  const evento = `pinball-solo-${eu}-${agora()}`;
  let fase: 'escolha' | 'jogando' | 'resultado' = 'escolha';
  let rodada = 0;
  let j: Jogador | null = null;
  let resultado: { pontos: number; recorde: boolean; anterior: number | null } | null = null;
  let mesa = 0;
  const parado = () => ctx.agendar(SOLO_PARADO_MS, () => ctx.terminar(rodada > 0));
  parado();

  const recordes = () =>
    db.recordesDoPinball(eu).map(({ userId, username, nomeDeExibicao, pontos }) => ({ userId, nome: nomeDeExibicao || username, pontos }));

  return {
    publico: () => ({
      fase,
      solo: true,
      rodada,
      limite: PASSOS_MAXIMOS,
      mesa,
      meu: j ? resumo(j.mesa) : null,
      recordes: recordes(),
      recordeDoPomar: recordeDoPomar(eu),
      recordeDoLago: recordeDoLago(eu),
      resultado,
      partidaId: evento,
    }),
    acao(quem: number, corpo: Record<string, unknown>) {
      if (quem !== eu) return 'Você está assistindo esta partida.';
      parado();
      if (corpo.tipo === 'jogar') {
        if (fase === 'jogando' && j && !j.mesa.terminou && j.mesa.passo > 0) return 'A partida está andando.';
        mesa = mesaValida(corpo.mesa);
        j = { mesa: novaMesa(PASSOS_MAXIMOS, mesa), inicio: agora() };
        fase = 'jogando';
        rodada++;
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (corpo.tipo === 'trecho') {
        if (fase !== 'jogando' || !j) return null;
        const erro = lerTrecho(j, corpo, agora());
        if (erro) return erro;
        if (j.mesa.terminou) {
          const variante = VARIANTE_DA_MESA[j.mesa.mesa] ?? '';
          const anterior = variante ? (db.recordeDoSolo(eu, 'pinball', variante)?.valor ?? null) : db.recordeDoPinball(eu);
          const recorde =
            j.mesa.pontos > 0 && (variante ? db.guardarRecordeDoSolo(eu, 'pinball', variante, j.mesa.pontos, false).novo : db.guardarRecordeDoPinball(eu, j.mesa.pontos));
          resultado = { pontos: j.mesa.pontos, recorde, anterior };
          fase = 'resultado';
          ctx.avisar();
        }
        return null;
      }
      return 'Ação desconhecida.';
    },
  };
}

// =====================================================================================================================
// NA SALA: o mesmo verde, cada um na sua mesa, a ordem ao vivo pelos pontos refeitos
// =====================================================================================================================

function partidaNaSala(ctx: Contexto, inscritos: number[], agora: () => number) {
  const evento = `pinball-${ctx.comunidade ?? 0}-${agora()}`;
  let fase: 'largada' | 'jogando' | 'fim' = 'largada';
  const jogadores = new Map<number, Jogador>(inscritos.map((id) => [id, { mesa: novaMesa(PASSOS_DA_SALA), inicio: 0 }]));
  const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
  const recordes = new Map<number, { antes: number | null; novo: boolean }>(inscritos.map((id) => [id, { antes: db.recordeDoPinball(id), novo: false }]));
  /** Quem ficou na sala até o fim (fixado ao fechar): só esses têm posição. */
  let ficaram: Set<number> | null = null;
  let ultimoAviso = 0;

  /** Mais pontos primeiro; a posição só de quem jogou e ficou (empatados dividem). */
  const placar = () => {
    const contam = ficaram ?? new Set(ctx.naSala());
    const linhas = inscritos
      .map((userId) => {
        const m = jogadores.get(userId)!.mesa;
        return { userId, username: ctx.nome(userId), avatar: avatares.get(userId) ?? null, pontos: m.pontos, bola: m.bola, terminou: m.terminou, posicao: null as number | null };
      })
      .sort((a, b) => b.pontos - a.pontos || a.username.localeCompare(b.username));
    const valem = linhas.filter((l) => contam.has(l.userId) && (fase !== 'fim' || l.pontos > 0));
    for (const l of valem) l.posicao = 1 + valem.filter((o) => o.pontos > l.pontos).length;
    return linhas;
  };

  const terminar = () => {
    if (fase === 'fim') return;
    const aqui = new Set(ctx.naSala());
    ficaram = new Set(inscritos.filter((id) => aqui.has(id)));
    fase = 'fim';
    const jogaram = inscritos.filter((id) => jogadores.get(id)!.mesa.pontos > 0 && ficaram!.has(id));
    // O PÓDIO: com 2 ou mais que pontuaram e ficaram até o fim
    if (jogaram.length >= 2) {
      for (const l of placar()) {
        if (l.posicao === null || l.posicao > 3 || !l.pontos) continue;
        db.guardarTrofeu({
          userId: l.userId,
          evento,
          communityId: ctx.comunidade ?? 0,
          pista: 'pinball',
          posicao: l.posicao,
          tempoMs: null,
          pontos: l.pontos,
          rivais: jogaram.filter((id) => id !== l.userId),
        });
      }
    }
    ctx.terminar(inscritos.some((id) => jogadores.get(id)!.mesa.passo > 0));
  };

  /** Todos os que estão na sala acabaram as bolas (ou saíram): fecha sem esperar o prazo. */
  const conferir = () => {
    if (fase !== 'jogando') return;
    const aqui = ctx.naSala().filter((id) => jogadores.has(id));
    if (aqui.every((id) => jogadores.get(id)!.mesa.terminou)) terminar();
  };

  ctx.agendar(LARGADA_MS, () => {
    fase = 'jogando';
    const verde = agora();
    for (const j of jogadores.values()) j.inicio = verde;
    ctx.agendar(PRAZO_DA_SALA_MS, terminar);
    ctx.avisar();
  });

  return {
    publico(quem: number) {
      const j = jogadores.get(quem);
      return {
        fase,
        solo: false,
        limite: PASSOS_DA_SALA,
        meu: j ? resumo(j.mesa) : null,
        placar: placar(),
        recorde: recordes.get(quem) ?? null,
        partidaId: evento,
      };
    },
    acao(quem: number, corpo: Record<string, unknown>) {
      if (corpo.tipo !== 'trecho') return 'Ação desconhecida.';
      const j = jogadores.get(quem);
      if (!j) return 'Você está assistindo esta partida.';
      if (fase !== 'jogando') return null;
      const antes = j.mesa.pontos;
      const acabou = j.mesa.terminou;
      const erro = lerTrecho(j, corpo, agora());
      if (erro) return erro;
      if (j.mesa.terminou && !acabou) {
        // sem itens, a partida da sala vale como a do Solo: se for a melhor da pessoa, vira o recorde
        if (j.mesa.pontos > 0 && db.guardarRecordeDoPinball(quem, j.mesa.pontos)) recordes.get(quem)!.novo = true;
        conferir();
        if ((fase as string) !== 'fim') ctx.avisar();
        ultimoAviso = agora();
        return null;
      }
      if (j.mesa.pontos !== antes && agora() - ultimoAviso >= AVISO_MS) {
        ultimoAviso = agora();
        ctx.avisar();
      }
      return null;
    },
    conferir,
  };
}
