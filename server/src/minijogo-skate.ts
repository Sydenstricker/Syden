/**
 * O ROLÊ DO COELHO (05/11/2026, pedido dele: "um mini Tony Hawk"): um minuto (eram dois até 06/11/2026) numa pista de skate, com pontos por manobra
 * e combos. SÓ A MECÂNICA dos jogos de skate de pontos; a pista, o coelho e tudo o que aparece são nossos ou da Kenney (CC0).
 *
 * A SESSÃO É DE QUEM JOGA, no computador dele (passos fixos de 1/60 s, como o contra o relógio do kart), e O SERVIDOR A REFAZ
 * (06/11/2026, a conferência da Gincana e dos Carrinhos): a física e a pista moram em duas cópias iguais byte a byte
 * (server/src/skate/ e web/src/skate/), o site manda os COMANDOS de cada passo em trechos, e o servidor refaz a sessão inteira.
 * Os pontos e o melhor combo são os dele; o que o site diz não conta. E a sessão não anda mais passos do que o relógio do
 * servidor viu passar desde a largada (a janela sem foco PAUSA a sessão, então pode passar mais tempo, nunca menos). O que
 * sobra possível: um programa que ache os comandos de uma sessão melhor (o piloto automático dos testes é um, e fraco).
 *
 * NO SOLO, o RECORDE da pessoa (skate_recordes_1min), sem troféu; ESC pausa.
 *
 * NA SALA (06/11/2026, pedido dele: "um modo com mais pessoas no skate, com fantasmas como fizemos no jogo de corrida"), de 2 a
 * 8: o servidor dá o verde (o mesmo para todos), cada um anda na SUA cópia da pista (sem batida entre skatistas, como na caça e
 * no golfe) e manda a posição 15 vezes por segundo, que o servidor confere por alto e REPASSA carimbada com quem mandou: os
 * outros aparecem como fantasmas, com o nome em cima. No fim, mais pontos ganha; os três primeiros vão à estante de troféus
 * (pista 'skate'). Sem itens, a sessão da sala que bate o recorde da pessoa vira o recorde dela (como no Pulo e na Gincana).
 * Não há pausa: quem tira o foco da janela pausa a própria sessão e só perde o prazo.
 */
import * as db from './db.js';
import type { Contexto, Definicao } from './minijogo-motor.js';
import { entradasValidas, PASSOS_DA_SESSAO, PASSOS_DE_FOLGA, refazer } from './skate/fisica.js';
import { LARGURA, PROFUNDIDADE } from './skate/pista.js';

export { PASSOS_DA_SESSAO, PASSOS_DE_FOLGA };
export const DURACAO_MS = (PASSOS_DA_SESSAO / 60) * 1000;
/** A contagem da largada na tela (3 s) e a rede: os passos podem chegar um tico à frente do relógio do servidor. */
export const FOLGA_DO_RELOGIO_MS = 3000;
/** Ninguém volta: a partida do Solo fecha sozinha depois disto (a sessão pausada pela janela sem foco tem esse tanto para acabar). */
export const PRAZO_MS = DURACAO_MS + 10 * 60_000;
/** Na sala: a contagem antes do verde, e quanto a turma espera quem pausou (o minuto, a folga do combo e mais um tanto). */
export const LARGADA_MS = 4000;
export const PRAZO_DA_SALA_MS = DURACAO_MS + 60_000;
export const MAXIMO = 8;
/** As posições ao vivo: à frente do relógio do servidor, no máximo isto de passos (a rede e a contagem). */
export const PASSOS_A_FRENTE = 180;

interface Skatista {
  pontos: number | null;
  melhorCombo: number | null;
  /** A última posição repassada (só o desenho dos outros). */
  ultima: { n: number; x: number; z: number } | null;
}

export const skate: Definicao = criarSkate();

/** Refaz a sessão pelas entradas; o erro, ou os pontos, o melhor combo e os passos que ela andou. */
function conferirSessao(corpo: Record<string, unknown>): { erro: string } | { pontos: number; melhorCombo: number; passos: number } {
  if (!entradasValidas(corpo.entradas)) return { erro: 'Sessão inválida.' };
  const { k, passos } = refazer(corpo.entradas);
  // a sessão inteira, e nem um passo além do fim dela
  if (!k.terminou || passos !== k.passo) return { erro: 'Sessão inválida.' };
  return { pontos: k.pontos, melhorCombo: k.melhorCombo, passos: k.passo };
}

export function criarSkate({ agora = Date.now }: { agora?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    maximo: MAXIMO,
    comecar(ctx, { naSala }) {
      const inscritos = naSala.slice(0, MAXIMO);
      const solo = ctx.solo ?? inscritos.length === 1;
      return solo ? sessaoSolo(ctx, inscritos[0], agora) : sessaoNaSala(ctx, inscritos, agora);
    },
  };
}

// =====================================================================================================================
// O SOLO
// =====================================================================================================================

function sessaoSolo(ctx: Contexto, eu: number, agora: () => number) {
  const evento = `skate-solo-${eu}-${agora()}`;
  const inicio = agora();
  let fase: 'jogando' | 'fim' = 'jogando';
  const s: Skatista = { pontos: null, melhorCombo: null, ultima: null };
  const recordeAntes = db.recordeDoSkate(eu);
  let recordeNovo = false;

  const terminar = () => {
    if (fase === 'fim') return;
    fase = 'fim';
    if (s.pontos !== null && s.pontos > 0) recordeNovo = db.guardarRecordeDoSkate(eu, s.pontos);
    ctx.terminar(s.pontos !== null);
  };
  ctx.agendar(PRAZO_MS, terminar);

  return {
    publico() {
      return {
        fase,
        solo: true,
        duracaoMs: DURACAO_MS,
        meu: { pontos: s.pontos, melhorCombo: s.melhorCombo },
        placar: [{ userId: eu, username: ctx.nome(eu), avatar: null, pontos: s.pontos, melhorCombo: s.melhorCombo, posicao: s.pontos === null ? null : 1 }],
        recorde: { antes: recordeAntes, novo: recordeNovo },
        partidaId: evento,
      };
    },
    acao(quem: number, corpo: Record<string, unknown>) {
      if (corpo.tipo !== 'fim') return 'Ação desconhecida.';
      if (quem !== eu) return 'Você está assistindo esta partida.';
      if (fase !== 'jogando' || s.pontos !== null) return 'Esta rodada já acabou.';
      const v = conferirSessao(corpo);
      if ('erro' in v) return v.erro;
      // a janela sem foco pausa a sessão (mais tempo), mas ninguém anda mais passos do que o relógio deixou
      if ((v.passos / 60) * 1000 > agora() - inicio + FOLGA_DO_RELOGIO_MS) return 'Sessão inválida.';
      s.pontos = v.pontos;
      s.melhorCombo = v.melhorCombo;
      terminar();
      ctx.avisar();
      return null;
    },
  };
}

// =====================================================================================================================
// NA SALA: a mesma pista, o mesmo verde, cada um no próprio computador, os outros como fantasmas
// =====================================================================================================================

function sessaoNaSala(ctx: Contexto, inscritos: number[], agora: () => number) {
  const evento = `skate-${ctx.comunidade ?? 0}-${agora()}`;
  let fase: 'largada' | 'jogando' | 'fim' = 'largada';
  let verdeEm = 0;
  const skatistas = new Map<number, Skatista>(inscritos.map((id) => [id, { pontos: null, melhorCombo: null, ultima: null }]));
  const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
  const recordes = new Map<number, { antes: number | null; novo: boolean }>(inscritos.map((id) => [id, { antes: db.recordeDoSkate(id), novo: false }]));
  /** Quem ficou na sala até o fim (fixado ao fechar): só esses têm posição. */
  let ficaram: Set<number> | null = null;

  /** Mais pontos primeiro; a posição só de quem mandou e ficou (empatados dividem). */
  const placar = () => {
    const contam = ficaram ?? new Set(ctx.naSala());
    const linhas = inscritos
      .map((userId) => {
        const s = skatistas.get(userId)!;
        return { userId, username: ctx.nome(userId), avatar: avatares.get(userId) ?? null, pontos: s.pontos, melhorCombo: s.melhorCombo, posicao: null as number | null };
      })
      .sort((a, b) => Number(b.pontos !== null) - Number(a.pontos !== null) || (b.pontos ?? 0) - (a.pontos ?? 0) || a.username.localeCompare(b.username));
    const valem = linhas.filter((l) => l.pontos !== null && contam.has(l.userId));
    for (const l of valem) l.posicao = 1 + valem.filter((o) => o.pontos! > l.pontos!).length;
    return linhas;
  };

  const terminar = () => {
    if (fase === 'fim') return;
    const aqui = new Set(ctx.naSala());
    ficaram = new Set(inscritos.filter((id) => aqui.has(id)));
    fase = 'fim';
    const terminaram = inscritos.filter((id) => skatistas.get(id)!.pontos !== null && ficaram!.has(id));
    // O PÓDIO: com 2 ou mais que andaram a sessão inteira e ficaram até o fim
    if (terminaram.length >= 2) {
      for (const l of placar()) {
        if (l.posicao === null || l.posicao > 3 || !l.pontos) continue;
        db.guardarTrofeu({
          userId: l.userId,
          evento,
          communityId: ctx.comunidade ?? 0,
          pista: 'skate',
          posicao: l.posicao,
          tempoMs: null,
          pontos: l.pontos,
          rivais: terminaram.filter((id) => id !== l.userId),
        });
      }
    }
    // ninguém mandou (saíram todos antes do fim): a partida conta como interrompida
    ctx.terminar(inscritos.some((id) => skatistas.get(id)!.pontos !== null));
  };

  /** Quem ainda está na sala já mandou (ou saiu todo mundo): a partida fecha sem esperar o prazo. */
  const conferir = () => {
    if (fase !== 'jogando') return;
    const aqui = ctx.naSala().filter((id) => skatistas.has(id));
    if (aqui.every((id) => skatistas.get(id)!.pontos !== null)) terminar();
  };

  ctx.agendar(LARGADA_MS, () => {
    fase = 'jogando';
    verdeEm = agora();
    ctx.agendar(PRAZO_DA_SALA_MS, terminar);
    ctx.avisar();
  });

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

  return {
    publico(quem: number) {
      const meu = skatistas.get(quem);
      return {
        fase,
        solo: false,
        duracaoMs: DURACAO_MS,
        meu: meu ? { pontos: meu.pontos, melhorCombo: meu.melhorCombo } : null,
        placar: placar(),
        recorde: recordes.get(quem) ?? null,
        partidaId: evento,
      };
    },
    acao(quem: number, corpo: Record<string, unknown>) {
      if (corpo.tipo !== 'fim') return 'Ação desconhecida.';
      const s = skatistas.get(quem);
      if (!s) return 'Você está assistindo esta partida.';
      if (fase !== 'jogando' || s.pontos !== null) return 'Esta rodada já acabou.';
      const v = conferirSessao(corpo);
      if ('erro' in v) return v.erro;
      if ((v.passos / 60) * 1000 > agora() - verdeEm + FOLGA_DO_RELOGIO_MS) return 'Sessão inválida.';
      s.pontos = v.pontos;
      s.melhorCombo = v.melhorCombo;
      // sem itens, a sessão da sala vale como a do Solo: se for a melhor da pessoa, vira o recorde
      if (v.pontos > 0 && db.guardarRecordeDoSkate(quem, v.pontos)) recordes.get(quem)!.novo = true;
      conferir();
      ctx.avisar();
      return null;
    },
    /**
     * A posição de quem anda, conferida por alto e carimbada com quem mandou: é só o desenho dos outros (os pontos saem da
     * sessão refeita). Dentro da pista, sem passo à frente do relógio do servidor, e sem salto maior do que um skatista anda.
     */
    tempoReal(quem: number, dados: unknown) {
      const s = skatistas.get(quem);
      if (!s || fase !== 'jogando' || s.pontos !== null || !dados || typeof dados !== 'object') return null;
      const { n, x, y, z, cx, cz, e, b, f, p } = dados as Record<string, unknown>;
      if (!numero(n) || !Number.isInteger(n) || n < 1 || !numero(x) || !numero(y) || !numero(z) || !numero(cx) || !numero(cz)) return null;
      if (n > ((agora() - verdeEm) * 60) / 1000 + PASSOS_A_FRENTE) return null;
      if (x < -0.5 || x > LARGURA + 0.5 || z < -0.5 || z > PROFUNDIDADE + 0.5 || y < -0.5 || y > 6) return null;
      const u = s.ultima;
      if (u) {
        if (n <= u.n) return null;
        // 10 casas por segundo é bem mais que o skate anda (a velocidade máxima é 6,5), mais a folga do arredondamento
        const d = Math.sqrt((x - u.x) * (x - u.x) + (z - u.z) * (z - u.z));
        if (d > ((n - u.n) / 60) * 10 + 0.5) return null;
      }
      s.ultima = { n, x, z };
      const inteiro = (v: unknown, min: number, max: number) => (numero(v) && Number.isInteger(v) && v >= min && v <= max ? v : min);
      return {
        userId: quem,
        n,
        x: r2(x),
        y: r2(y),
        z: r2(z),
        cx: r2(Math.max(-1, Math.min(1, cx))),
        cz: r2(Math.max(-1, Math.min(1, cz))),
        // o jeito (0 no chão, 1 no ar, 2 no grind, 3 no manual, 4 caído), a base e o flip vão só para o desenho
        e: inteiro(e, 0, 4),
        b: b === -1 ? -1 : 1,
        f: inteiro(f, 0, 20),
        // os pontos que o site diz ter: só a ordem ao vivo na tela (o placar do fim é o refeito)
        p: inteiro(p, 0, 50_000_000),
      };
    },
    conferir,
  };
}
