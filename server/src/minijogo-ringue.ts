/**
 * O RINGUE DA TOCA (16/11/2026): boxe de reflexo visto de trás de quem joga, contra um circuito de três adversários do
 * computador. SÓ A MECÂNICA do gênero (o aviso de cada golpe, esquivar e bater na brecha, o soco forte ganho no contra-ataque);
 * os bichos são os Ultimate Monsters da Quaternius (CC0) já usados na Briga, e o resto é desenhado por código.
 *
 * A LUTA É DE QUEM JOGA, no computador dele (passos fixos de 1/60 s), e O SERVIDOR A REFAZ, como no Rolê do coelho: a regra mora
 * em duas cópias iguais byte a byte (server/src/ringue-sim.ts e web/src/ringue/sim.ts), com o "acaso" dos adversários vindo de
 * uma semente que o SERVIDOR sorteia; o site manda os COMANDOS de cada passo em trechos, e o servidor refaz o circuito inteiro. O
 * resultado (quantas lutas venceu, o tempo, o que bateu na luta em que parou) é o dele. E o circuito não anda mais passos do que
 * o relógio do servidor viu passar (a janela sem foco pausa a luta, então pode passar mais tempo, nunca menos). O que sobra
 * possível: um programa que jogue perfeito, como o piloto automático dos testes. É jogo entre amigos.
 *
 * NO SOLO, o RECORDE da pessoa (ringue_recordes), sem troféu; ESC pausa.
 *
 * NA SALA, de 2 a 8: a mesma semente para todos e o mesmo verde, cada um no próprio ringue. O progresso de cada um (em que luta
 * está, quantas quedas deu) vai pelo tempo real, só para a lista ao vivo. No fim, quem foi mais longe ganha (mais lutas
 * vencidas; o circuito inteiro, no menor tempo); os três primeiros vão à estante de troféus (pista 'ringue'). Sem itens, o
 * circuito da sala que bate o recorde da pessoa vira o recorde dela (como no Rolê).
 */
import * as db from './db.js';
import type { Contexto, Definicao } from './minijogo-motor.js';
import { ADVERSARIOS, comparar, entradasValidas, PASSOS_MAXIMOS, refazer, resultadoDe, type Resultado } from './ringue-sim.js';

/** A contagem da largada na tela (3 s) e a rede: os passos podem chegar um tico à frente do relógio do servidor. */
export const FOLGA_DO_RELOGIO_MS = 3000;
/** O Solo fecha sozinho depois disto (o circuito mais longo possível, e a luta pausada pela janela sem foco). */
export const PRAZO_MS = (PASSOS_MAXIMOS / 60) * 1000 + 10 * 60_000;
/** Na sala: a contagem antes do verde, e quanto a turma espera quem ainda luta. */
export const LARGADA_MS = 4000;
export const PRAZO_DA_SALA_MS = 15 * 60_000;
export const MAXIMO = 8;

interface Lutador {
  resultado: Resultado | null;
  /** O último progresso repassado (só a lista ao vivo). */
  ultimo: number;
}

export const ringue: Definicao = criarRingue();

/** Refaz o circuito pelos comandos; o erro, ou o resultado. */
export function conferirCircuito(semente: number, entradas: unknown): { erro: string } | Resultado {
  if (!entradasValidas(entradas)) return { erro: 'Sessão inválida.' };
  const { l, passos } = refazer(semente, entradas);
  // o circuito inteiro, e nem um passo além do fim dele
  if (!l.terminou || passos !== l.passo) return { erro: 'Sessão inválida.' };
  return resultadoDe(l);
}

/** Guarda se for o melhor da pessoa. Devolve true se virou recorde. */
function guardarSeMelhor(userId: number, r: Resultado): boolean {
  if (r.vencidas === 0 && r.dano === 0) return false;
  const antes = db.recordeDoRingue(userId);
  if (antes && comparar(r, antes) >= 0) return false;
  db.guardarRecordeDoRingue(userId, r);
  return true;
}

export function criarRingue({ agora = Date.now, aleatorio = Math.random }: { agora?: () => number; aleatorio?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    maximo: MAXIMO,
    comecar(ctx, { naSala }) {
      const inscritos = naSala.slice(0, MAXIMO);
      const solo = ctx.solo ?? inscritos.length === 1;
      const semente = 1 + Math.floor(aleatorio() * 2_000_000_000);
      return solo ? lutaSolo(ctx, inscritos[0], semente, agora) : lutaNaSala(ctx, inscritos, semente, agora);
    },
  };
}

// =====================================================================================================================
// O SOLO
// =====================================================================================================================

function lutaSolo(ctx: Contexto, eu: number, semente: number, agora: () => number) {
  const evento = `ringue-solo-${eu}-${agora()}`;
  const inicio = agora();
  let fase: 'jogando' | 'fim' = 'jogando';
  let meu: Resultado | null = null;
  const recordeAntes = db.recordeDoRingue(eu);
  let recordeNovo = false;
  const avatar = db.avatarDoJogo(eu);

  const terminar = () => {
    if (fase === 'fim') return;
    fase = 'fim';
    if (meu) recordeNovo = guardarSeMelhor(eu, meu);
    ctx.terminar(meu !== null);
  };
  ctx.agendar(PRAZO_MS, terminar);

  return {
    publico() {
      return {
        fase,
        solo: true,
        semente,
        adversarios: ADVERSARIOS.length,
        meu,
        avatar,
        placar: [{ userId: eu, username: ctx.nome(eu), avatar, resultado: meu, posicao: meu === null ? null : 1 }],
        recorde: { antes: recordeAntes, novo: recordeNovo },
        partidaId: evento,
      };
    },
    acao(quem: number, corpo: Record<string, unknown>) {
      if (corpo.tipo !== 'fim') return 'Ação desconhecida.';
      if (quem !== eu) return 'Você está assistindo esta partida.';
      if (fase !== 'jogando' || meu !== null) return 'Esta rodada já acabou.';
      const v = conferirCircuito(semente, corpo.entradas);
      if ('erro' in v) return v.erro;
      // a janela sem foco pausa a luta (mais tempo), mas ninguém anda mais passos do que o relógio deixou
      if ((v.passos / 60) * 1000 > agora() - inicio + FOLGA_DO_RELOGIO_MS) return 'Sessão inválida.';
      meu = v;
      terminar();
      ctx.avisar();
      return null;
    },
  };
}

// =====================================================================================================================
// NA SALA: a mesma semente, o mesmo verde, cada um no próprio ringue
// =====================================================================================================================

function lutaNaSala(ctx: Contexto, inscritos: number[], semente: number, agora: () => number) {
  const evento = `ringue-${ctx.comunidade ?? 0}-${agora()}`;
  let fase: 'largada' | 'jogando' | 'fim' = 'largada';
  let verdeEm = 0;
  const lutadores = new Map<number, Lutador>(inscritos.map((id) => [id, { resultado: null, ultimo: 0 }]));
  const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
  const recordes = new Map<number, { antes: db.RecordeDoRingue | null; novo: boolean }>(inscritos.map((id) => [id, { antes: db.recordeDoRingue(id), novo: false }]));
  /** Quem ficou na sala até o fim (fixado ao fechar): só esses têm posição. */
  let ficaram: Set<number> | null = null;

  /** Quem foi mais longe primeiro; a posição só de quem mandou e ficou (empatados dividem). */
  const placar = () => {
    const contam = ficaram ?? new Set(ctx.naSala());
    const linhas = inscritos
      .map((userId) => ({ userId, username: ctx.nome(userId), avatar: avatares.get(userId) ?? null, resultado: lutadores.get(userId)!.resultado, posicao: null as number | null }))
      .sort((a, b) => {
        if (!a.resultado || !b.resultado) return Number(!!b.resultado) - Number(!!a.resultado) || a.username.localeCompare(b.username);
        return comparar(a.resultado, b.resultado) || a.username.localeCompare(b.username);
      });
    const valem = linhas.filter((l) => l.resultado !== null && contam.has(l.userId));
    for (const l of valem) l.posicao = 1 + valem.filter((o) => comparar(o.resultado!, l.resultado!) < 0).length;
    return linhas;
  };

  const terminar = () => {
    if (fase === 'fim') return;
    const aqui = new Set(ctx.naSala());
    ficaram = new Set(inscritos.filter((id) => aqui.has(id)));
    fase = 'fim';
    const terminaram = inscritos.filter((id) => lutadores.get(id)!.resultado !== null && ficaram!.has(id));
    // O PÓDIO: com 2 ou mais que lutaram o circuito até o fim (ganhando ou perdendo) e ficaram até o fim
    if (terminaram.length >= 2) {
      for (const l of placar()) {
        const r = l.resultado;
        if (l.posicao === null || l.posicao > 3 || !r || r.vencidas === 0) continue;
        db.guardarTrofeu({
          userId: l.userId,
          evento,
          communityId: ctx.comunidade ?? 0,
          pista: 'ringue',
          posicao: l.posicao,
          // o tempo só vale para quem venceu o circuito inteiro; os pontos são as lutas vencidas
          tempoMs: r.vencidas >= ADVERSARIOS.length ? Math.round((r.passos / 60) * 1000) : null,
          pontos: r.vencidas,
          rivais: terminaram.filter((id) => id !== l.userId),
        });
      }
    }
    // ninguém mandou (saíram todos antes do fim): a partida conta como interrompida
    ctx.terminar(inscritos.some((id) => lutadores.get(id)!.resultado !== null));
  };

  /** Quem ainda está na sala já mandou (ou saiu todo mundo): a partida fecha sem esperar o prazo. */
  const conferir = () => {
    if (fase !== 'jogando') return;
    const aqui = ctx.naSala().filter((id) => lutadores.has(id));
    if (aqui.every((id) => lutadores.get(id)!.resultado !== null)) terminar();
  };

  ctx.agendar(LARGADA_MS, () => {
    fase = 'jogando';
    verdeEm = agora();
    ctx.agendar(PRAZO_DA_SALA_MS, terminar);
    ctx.avisar();
  });

  return {
    publico(quem: number) {
      const meu = lutadores.get(quem);
      return {
        fase,
        solo: false,
        semente,
        adversarios: ADVERSARIOS.length,
        meu: meu ? meu.resultado : null,
        avatar: avatares.get(quem) ?? null,
        placar: placar(),
        recorde: recordes.get(quem) ?? null,
        partidaId: evento,
      };
    },
    acao(quem: number, corpo: Record<string, unknown>) {
      if (corpo.tipo !== 'fim') return 'Ação desconhecida.';
      const s = lutadores.get(quem);
      if (!s) return 'Você está assistindo esta partida.';
      if (fase !== 'jogando' || s.resultado !== null) return 'Esta rodada já acabou.';
      const v = conferirCircuito(semente, corpo.entradas);
      if ('erro' in v) return v.erro;
      if ((v.passos / 60) * 1000 > agora() - verdeEm + FOLGA_DO_RELOGIO_MS) return 'Sessão inválida.';
      s.resultado = v;
      // sem itens, o circuito da sala vale como o do Solo: se for o melhor da pessoa, vira o recorde
      if (guardarSeMelhor(quem, v)) recordes.get(quem)!.novo = true;
      conferir();
      ctx.avisar();
      return null;
    },
    /**
     * O progresso de quem luta (a luta, as quedas que deu nela, se está no chão), carimbado com quem mandou: é só a lista ao vivo
     * dos outros. O resultado que vale sai do circuito refeito. No máximo um por meio segundo.
     */
    tempoReal(quem: number, dados: unknown) {
      const s = lutadores.get(quem);
      if (!s || fase !== 'jogando' || s.resultado !== null || !dados || typeof dados !== 'object') return null;
      const t = agora();
      if (t - s.ultimo < 400) return null;
      s.ultimo = t;
      const { adv, quedas, caido } = dados as Record<string, unknown>;
      const inteiro = (v: unknown, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
      return { userId: quem, adv: inteiro(adv, ADVERSARIOS.length - 1), quedas: inteiro(quedas, 3), caido: caido === true };
    },
    conferir,
  };
}
