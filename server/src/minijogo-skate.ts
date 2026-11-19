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
 *
 * 19/11/2026: OS OBJETIVOS (as letras de "TOCA" no ar, a meta de pontos, a de combo, a fita escondida e os saltos com nome)
 * contam pela sessão que o servidor refez, e a SEGUNDA PISTA (a Praça, 'praca-1'): o recorde dela mora na tabela comum
 * (solo_recordes, jogo 'skate', variante = a pista), e o do parque continua em skate_recordes_1min. O mais de objetivos que a
 * pessoa já cumpriu numa sessão, por pista, também vai à tabela comum ('objetivos-<pista>').
 */
import * as db from './db.js';
import type { Contexto, Definicao } from './minijogo-motor.js';
import { entradasValidas, objetivos, PASSOS_DA_SESSAO, PASSOS_DE_FOLGA, refazer, type Objetivo } from './skate/fisica.js';
import { IDS_DAS_PISTAS, indiceDaPista, LARGURA, PROFUNDIDADE } from './skate/pista.js';

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
  /** Os objetivos da sessão refeita (null: ainda andando). */
  objetivos: Objetivo[] | null;
  /** A última posição repassada (só o desenho dos outros). */
  ultima: { n: number; x: number; z: number } | null;
}

export const skate: Definicao = criarSkate();

/** Refaz a sessão pelas entradas, na pista `pista`; o erro, ou os pontos, o melhor combo, os objetivos e os passos que ela andou. */
function conferirSessao(corpo: Record<string, unknown>, pista: number): { erro: string } | { pontos: number; melhorCombo: number; passos: number; objetivos: Objetivo[] } {
  if (!entradasValidas(corpo.entradas)) return { erro: 'Sessão inválida.' };
  const { k, passos } = refazer(corpo.entradas, pista);
  // a sessão inteira, e nem um passo além do fim dela
  if (!k.terminou || passos !== k.passo) return { erro: 'Sessão inválida.' };
  return { pontos: k.pontos, melhorCombo: k.melhorCombo, passos: k.passo, objetivos: objetivos(k) };
}

/** O recorde de pontos da pessoa na pista (o parque na tabela dele; as outras na tabela comum). */
const recordeNaPista = (userId: number, pista: number): number | null =>
  pista === 0 ? db.recordeDoSkate(userId) : (db.recordeDoSolo(userId, 'skate', IDS_DAS_PISTAS[pista])?.valor ?? null);

/** Guarda a sessão (se for a melhor) e o mais de objetivos; devolve se virou o recorde de pontos. */
function guardarSessao(userId: number, pista: number, pontos: number, melhorCombo: number, objs: Objetivo[]): boolean {
  const feitos = objs.filter((o) => o.feito).map((o) => o.id);
  if (feitos.length) db.guardarRecordeDoSolo(userId, 'skate', `objetivos-${IDS_DAS_PISTAS[pista]}`, feitos.length, false, { feitos });
  if (pontos <= 0) return false;
  return pista === 0 ? db.guardarRecordeDoSkate(userId, pontos) : db.guardarRecordeDoSolo(userId, 'skate', IDS_DAS_PISTAS[pista], pontos, false, { melhorCombo }).novo;
}

/** O mais de objetivos que a pessoa já cumpriu numa sessão, em cada pista. */
const objetivosAntes = (userId: number) =>
  Object.fromEntries(IDS_DAS_PISTAS.map((id) => [id, db.recordeDoSolo(userId, 'skate', `objetivos-${id}`)?.valor ?? 0]));

export function criarSkate({ agora = Date.now }: { agora?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    maximo: MAXIMO,
    comecar(ctx, { naSala, corpo }) {
      const inscritos = naSala.slice(0, MAXIMO);
      const solo = ctx.solo ?? inscritos.length === 1;
      const pista = Math.max(0, indiceDaPista(corpo?.pista ?? corpo?.categoria));
      return solo ? sessaoSolo(ctx, inscritos[0], agora, pista) : sessaoNaSala(ctx, inscritos, agora, pista);
    },
  };
}

// =====================================================================================================================
// O SOLO
// =====================================================================================================================

function sessaoSolo(ctx: Contexto, eu: number, agora: () => number, pistaPedida: number) {
  const evento = `skate-solo-${eu}-${agora()}`;
  let inicio = agora();
  let pista = pistaPedida;
  let fase: 'jogando' | 'fim' = 'jogando';
  const s: Skatista = { pontos: null, melhorCombo: null, objetivos: null, ultima: null };
  const recordesAntes = IDS_DAS_PISTAS.map((_, i) => recordeNaPista(eu, i));
  const objsAntes = objetivosAntes(eu);
  let recordeNovo = false;

  const terminar = () => {
    if (fase === 'fim') return;
    fase = 'fim';
    if (s.pontos !== null && s.objetivos) recordeNovo = guardarSessao(eu, pista, s.pontos, s.melhorCombo ?? 0, s.objetivos);
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
        recorde: { antes: recordesAntes[pista], novo: recordeNovo },
        recordes: Object.fromEntries(IDS_DAS_PISTAS.map((id, i) => [id, recordesAntes[i]])),
        pista: IDS_DAS_PISTAS[pista],
        objetivos: s.objetivos,
        objetivosAntes: objsAntes,
        partidaId: evento,
      };
    },
    acao(quem: number, corpo: Record<string, unknown>) {
      if (quem !== eu) return 'Você está assistindo esta partida.';
      if (fase !== 'jogando' || s.pontos !== null) return 'Esta rodada já acabou.';
      if (corpo.tipo === 'pista') {
        // a escolha da pista, na tela antes do minuto: o relógio do servidor recomeça daqui (só fica mais estrito)
        const i = indiceDaPista(corpo.pista);
        if (i < 0) return 'Ação desconhecida.';
        pista = i;
        inicio = agora();
        ctx.avisar();
        return null;
      }
      if (corpo.tipo !== 'fim') return 'Ação desconhecida.';
      const v = conferirSessao(corpo, pista);
      if ('erro' in v) return v.erro;
      // a janela sem foco pausa a sessão (mais tempo), mas ninguém anda mais passos do que o relógio deixou
      if ((v.passos / 60) * 1000 > agora() - inicio + FOLGA_DO_RELOGIO_MS) return 'Sessão inválida.';
      s.pontos = v.pontos;
      s.melhorCombo = v.melhorCombo;
      s.objetivos = v.objetivos;
      terminar();
      ctx.avisar();
      return null;
    },
  };
}

// =====================================================================================================================
// NA SALA: a mesma pista, o mesmo verde, cada um no próprio computador, os outros como fantasmas
// =====================================================================================================================

function sessaoNaSala(ctx: Contexto, inscritos: number[], agora: () => number, pista: number) {
  const evento = `skate-${ctx.comunidade ?? 0}-${agora()}`;
  let fase: 'largada' | 'jogando' | 'fim' = 'largada';
  let verdeEm = 0;
  const skatistas = new Map<number, Skatista>(inscritos.map((id) => [id, { pontos: null, melhorCombo: null, objetivos: null, ultima: null }]));
  const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
  const recordes = new Map<number, { antes: number | null; novo: boolean }>(inscritos.map((id) => [id, { antes: recordeNaPista(id, pista), novo: false }]));
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
        pista: IDS_DAS_PISTAS[pista],
        categoria: IDS_DAS_PISTAS[pista],
        objetivos: meu?.objetivos ?? null,
        partidaId: evento,
      };
    },
    acao(quem: number, corpo: Record<string, unknown>) {
      if (corpo.tipo !== 'fim') return 'Ação desconhecida.';
      const s = skatistas.get(quem);
      if (!s) return 'Você está assistindo esta partida.';
      if (fase !== 'jogando' || s.pontos !== null) return 'Esta rodada já acabou.';
      const v = conferirSessao(corpo, pista);
      if ('erro' in v) return v.erro;
      if ((v.passos / 60) * 1000 > agora() - verdeEm + FOLGA_DO_RELOGIO_MS) return 'Sessão inválida.';
      s.pontos = v.pontos;
      s.melhorCombo = v.melhorCombo;
      s.objetivos = v.objetivos;
      // sem itens, a sessão da sala vale como a do Solo: se for a melhor da pessoa, vira o recorde
      if (guardarSessao(quem, pista, v.pontos, v.melhorCombo, v.objetivos)) recordes.get(quem)!.novo = true;

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
