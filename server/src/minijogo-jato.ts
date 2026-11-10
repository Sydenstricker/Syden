/**
 * OS COELHOS A JATO (05/11/2026): a corrida futurista em perspectiva, na mesma técnica da Corrida dos coelhos (Mode 7 numa
 * tela pequena, passos fixos de 1/60 s, o tempo é o número de passos, os fantasmas). Só a mecânica do gênero das corridas
 * antigravidade de 16 bits: as naves são cenouras, os pilotos são os nossos coelhos.
 *
 * NO SOLO (ctx.solo), contra o relógio: a pessoa escolhe a pista e até 3 fantasmas (o dela e os dos AMIGOS ACEITOS, a mesma
 * regra do kart: o fantasma é o caminho que alguém fez), corre com as naves do computador na pista, e o melhor tempo vira o
 * recorde (jato_recordes), conferido por validarJato (jato.ts). A partida solo não acaba sozinha: depois do resultado, corre
 * de novo ou escolhe outra pista; parada 30 minutos, ela se desfaz.
 *
 * NA SALA, a turma corre junto, como o kart na sala (minijogo-corrida.ts, de onde a forma foi copiada): o servidor dá o
 * verde (o mesmo semáforo para todos) e só REPASSA as posições, conferidas (a nave não aparece onde não poderia ter chegado);
 * cada um pilota no próprio computador; a classificação é pelo TEMPO DE CADA UM, em passos desde o próprio verde, e a
 * chegada não pode declarar mais tempo do que passou desde o verde do servidor. Quem explode fica fora, atrás de quem
 * chegou, pelo quanto andou. As naves do computador completam a pista (12 ao todo) e são iguais em todo computador
 * (web/src/jato/robos.ts), mas não entram na classificação nem no troféu. Sem itens, a corrida da sala que bate o recorde da
 * pessoa vira o recorde dela. O pódio vai para a estante de troféus (pista 'jato').
 */
import * as db from './db.js';
import { PISTAS_DO_JATO, validarJato } from './jato.js';
import type { Definicao } from './minijogo-motor.js';

export const LARGADA_MS = 4000;
export const PRAZO_MS = 30_000;
const CORRIDA_MS = 4 * 60_000;
/** A partida solo parada (sem ação nenhuma) se desfaz depois disto. */
const SOLO_PARADO_MS = 30 * 60_000;
export const FOLGA_MS = 3000;
export const PASSOS_DE_FOLGA = 180;
/** Quantas naves ao todo na pista da sala: a turma, e o computador completa. */
export const NAVES_NA_PISTA = 12;
export const MAX_FANTASMAS = 3;
/** O quanto a nave anda por passo, no máximo: o turbo (430 por segundo), com folga. */
const ANDA_POR_PASSO = (430 / 60) * 1.1;
const FOLGA_DA_POSICAO = 10;
/** A primeira posição sai da largada (o site manda a cada 4 passos). */
const PERTO_DA_LARGADA = 20;

const PISTA_PADRAO = 'cidade-1';

/** A distância entre dois pontos da linha do meio, dando a volta. */
function distanciaNaVolta(a: number, b: number, comprimento: number) {
  const d = (((a - b) % comprimento) + comprimento) % comprimento;
  return Math.min(d, comprimento - d);
}
const fracao = (andou: number) => ((andou % 1) + 1) % 1;

interface Piloto {
  tempoMs: number | null;
  voltas: number[];
  andou: number;
  explodiu: boolean;
  ultima: { x: number; y: number; n: number; andou: number; em: number } | null;
  meio: boolean;
}

export const jato: Definicao = criarJato();

/** `agora` é trocável para o teste. */
export function criarJato(agora: () => number = Date.now): Definicao {
  return {
    minimo: 2,
    maximo: NAVES_NA_PISTA,
    comecar(ctx, { naSala, corpo }) {
      const pedida = typeof corpo.pista === 'string' ? corpo.pista : typeof corpo.categoria === 'string' ? corpo.categoria : PISTA_PADRAO;
      const pista = PISTAS_DO_JATO[pedida] ? pedida : PISTA_PADRAO;
      return ctx.solo ? solo(ctx, naSala[0], pista, agora) : sala(ctx, naSala, pista, agora);
    },
  };
}

// =====================================================================================================================
// O SOLO: contra o relógio, com os fantasmas dos amigos
// =====================================================================================================================

function solo(ctx: Parameters<Definicao['comecar']>[0], eu: number, pistaInicial: string, agora: () => number) {
  let fase: 'escolha' | 'correndo' | 'resultado' = 'escolha';
  let pista = pistaInicial;
  let rodada = 0;
  let correuEm = 0;
  let fantasmas: { userId: number; nome: string; avatar: number | string | null; tempoMs: number; amostras: number[] }[] = [];
  let resultado: { tempoMs: number | null; voltas: number[]; recorde: boolean; anterior: number | null; explodiu: boolean } | null = null;
  const evento = `jato-solo-${eu}-${agora()}`;
  const parado = () => ctx.agendar(SOLO_PARADO_MS, () => ctx.terminar(false));
  parado();

  return {
    publico: () => ({
      fase,
      solo: true,
      pista,
      voltasDaCorrida: PISTAS_DO_JATO[pista].voltas,
      robos: NAVES_NA_PISTA - 1,
      recordes: db.recordesDoJato(eu, pista).map(({ userId, username, nomeDeExibicao, avatarPronto, tempoMs }) => ({ userId, nome: nomeDeExibicao || username, avatar: avatarPronto, tempoMs })),
      meuAvatar: db.avatarDoJogo(eu),
      fantasmas: fase === 'correndo' ? fantasmas : [],
      rodada,
      resultado,
      partidaId: evento,
    }),
    acao(quem: number, c: Record<string, unknown>) {
      if (quem !== eu) return 'Você está assistindo esta partida.';
      parado();
      if (c.tipo === 'pista') {
        if (fase === 'correndo') return 'A corrida está andando.';
        if (typeof c.pista !== 'string' || !PISTAS_DO_JATO[c.pista]) return 'Pista desconhecida.';
        pista = c.pista;
        fase = 'escolha';
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'escolher') {
        if (fase === 'correndo') return 'A corrida está andando.';
        fase = 'escolha';
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'correr') {
        if (fase === 'correndo') return 'A corrida está andando.';
        // os fantasmas: o meu e os dos amigos aceitos (sem bloqueio), no máximo três; o que não pode, some calado
        const pedidos = Array.isArray(c.fantasmas) ? [...new Set(c.fantasmas.filter((id): id is number => Number.isInteger(id) && (id as number) > 0))].slice(0, MAX_FANTASMAS) : [];
        fantasmas = [];
        for (const id of pedidos) {
          if (id !== eu && (db.amizadeEntre(eu, id)?.situacao !== 'aceita' || db.haBloqueio(eu, id))) continue;
          const r = db.recordeDoJato(id, pista);
          if (!r) continue;
          const u = db.findUserById(id);
          fantasmas.push({ userId: id, nome: u?.nomeDeExibicao || u?.username || '?', avatar: (u?.coelho ?? u?.avatarPronto ?? null), tempoMs: r.tempoMs, amostras: JSON.parse(r.amostras) as number[] });
        }
        fase = 'correndo';
        rodada++;
        correuEm = agora();
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'explodiu') {
        if (fase !== 'correndo') return 'A corrida não está andando.';
        fase = 'resultado';
        resultado = { tempoMs: null, voltas: [], recorde: false, anterior: db.recordeDoJato(eu, pista)?.tempoMs ?? null, explodiu: true };
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'chegada') {
        if (fase !== 'correndo') return 'A corrida não está andando.';
        const v = validarJato(pista, c);
        if ('erro' in v) return v.erro;
        // o tempo não passa do que de fato passou desde que a corrida começou (a contagem de 3 s fica de folga)
        if (v.ok.tempoMs > agora() - correuEm + FOLGA_MS) return 'Corrida inválida.';
        const r = db.guardarJato(eu, pista, v.ok.tempoMs, v.ok.voltas, JSON.stringify(v.ok.amostras));
        fase = 'resultado';
        resultado = { tempoMs: v.ok.tempoMs, voltas: v.ok.voltas.map((p) => Math.round((p * 1000) / 60)), recorde: r.recorde, anterior: r.anterior, explodiu: false };
        ctx.avisar();
        return null;
      }
      return 'Ação desconhecida.';
    },
  };
}

// =====================================================================================================================
// NA SALA: a turma corre junto
// =====================================================================================================================

function sala(ctx: Parameters<Definicao['comecar']>[0], naSala: number[], pista: string, agora: () => number) {
  const def = PISTAS_DO_JATO[pista];
  const evento = `jato-${ctx.comunidade ?? 0}-${agora()}`;
  let fase: 'largada' | 'correndo' | 'fim' = 'largada';
  let verdeEm = 0;
  let prazoAberto = false;
  const inscritos = [...naSala];
  const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
  const pilotos = new Map<number, Piloto>(inscritos.map((id) => [id, { tempoMs: null, voltas: [], andou: -0.04, explodiu: false, ultima: null, meio: false }]));
  /** Quem estava na sala ao fechar (null enquanto corre: aí contam os presentes). */
  let ficaram: Set<number> | null = null;

  /** `o` ficou na frente de `l`: chegou com menos tempo; quem chegou fica na frente de quem não chegou; senão, andou mais. */
  const naFrente = (o: { tempoMs: number | null; andou: number }, l: { tempoMs: number | null; andou: number }) =>
    o.tempoMs !== null && l.tempoMs !== null ? o.tempoMs < l.tempoMs : o.tempoMs !== null ? true : l.tempoMs === null && o.andou > l.andou;

  const classificacao = () => {
    const contam = ficaram ?? new Set(ctx.naSala());
    const linhas = [...pilotos.entries()]
      .map(([userId, p]) => ({ userId, username: ctx.nome(userId), tempoMs: p.tempoMs, voltas: p.voltas, andou: p.andou, explodiu: p.explodiu }))
      .sort((a, b) => (naFrente(a, b) ? -1 : naFrente(b, a) ? 1 : 0));
    const ficou = linhas.filter((l) => contam.has(l.userId));
    return [
      ...ficou.map((l) => ({ ...l, posicao: 1 + ficou.filter((o) => naFrente(o, l)).length as number | null })),
      ...linhas.filter((l) => !contam.has(l.userId)).map((l) => ({ ...l, posicao: null as number | null })),
    ];
  };

  const fechar = () => {
    if (fase === 'fim') return;
    const aqui = new Set(ctx.naSala());
    ficaram = new Set([...pilotos.keys()].filter((id) => aqui.has(id)));
    const ordem = classificacao();
    // O PÓDIO: com 2 ou mais que ficaram até o fim, os três primeiros que chegaram de verdade vão para a estante
    if (ficaram.size >= 2) {
      for (const l of ordem) {
        if (l.posicao === null || l.posicao > 3 || l.tempoMs === null) continue;
        db.guardarTrofeu({
          userId: l.userId,
          evento,
          communityId: ctx.comunidade ?? 0,
          pista: 'jato',
          posicao: l.posicao,
          tempoMs: l.tempoMs,
          pontos: null,
          rivais: [...ficaram].filter((id) => id !== l.userId),
        });
      }
    }
    fase = 'fim';
    ctx.terminar();
  };

  const conferir = () => {
    if (fase !== 'correndo') return;
    const presentes = ctx.naSala();
    if (presentes.length === 0 || presentes.every((id) => !pilotos.has(id) || pilotos.get(id)!.tempoMs !== null || pilotos.get(id)!.explodiu)) fechar();
  };

  ctx.agendar(LARGADA_MS, () => {
    fase = 'correndo';
    verdeEm = agora();
    ctx.agendar(CORRIDA_MS, fechar);
    ctx.avisar();
  });

  const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

  /** A posição ao vivo tem de ser uma que a nave alcança (a mesma regra do kart na sala, com a velocidade da nave). */
  const posicaoPossivel = (p: Piloto, x: number, y: number, n: number, andou: number) => {
    if (!Number.isInteger(n) || n < 1) return false;
    if (n > ((agora() - verdeEm) * 60) / 1000 + PASSOS_DE_FOLGA) return false;
    const u = p.ultima;
    if (!u) {
      if (andou >= 0.5) return false;
      return Math.hypot(x - def.largada[0], y - def.largada[1]) <= PERTO_DA_LARGADA + n * ANDA_POR_PASSO;
    }
    if (n <= u.n) return false;
    const passos = Math.min(n - u.n, ((agora() - u.em) * 60) / 1000 + 60);
    const alcance = passos * ANDA_POR_PASSO + FOLGA_DA_POSICAO;
    if (Math.hypot(x - u.x, y - u.y) > alcance) return false;
    if (distanciaNaVolta(fracao(andou) * def.comprimento, fracao(u.andou) * def.comprimento, def.comprimento) > 2 * alcance + 40) return false;
    const volta = Math.floor(andou) - Math.floor(u.andou);
    if (volta !== 0) {
      if (volta !== 1 || fracao(andou) >= 0.5 || fracao(u.andou) < 0.5) return false;
      // a primeira passagem pela linha (a largada fica antes dela) não pede a metade da pista
      if (u.andou >= 0 && !p.meio) return false;
      p.meio = false;
    }
    if (fracao(andou) >= 0.3 && fracao(andou) <= 0.7 && andou >= 0) p.meio = true;
    return true;
  };

  return {
    publico: () => ({
      fase,
      solo: false,
      pista,
      voltasDaCorrida: def.voltas,
      robos: Math.max(0, NAVES_NA_PISTA - inscritos.length),
      pilotos: classificacao().map(({ userId, username, tempoMs, voltas, posicao, explodiu }) => ({ userId, username, tempoMs, voltas, posicao, explodiu, avatar: avatares.get(userId) ?? null })),
      prazo: prazoAberto,
      partidaId: evento,
    }),
    acao(quem: number, c: Record<string, unknown>) {
      const p = pilotos.get(quem);
      if (!p) return 'Você não está nesta corrida.';
      if (c.tipo !== 'chegada' && c.tipo !== 'explodiu') return 'Ação desconhecida.';
      if (fase !== 'correndo') return 'A corrida não está andando.';
      if (p.tempoMs !== null || p.explodiu) return null;
      if (c.tipo === 'explodiu') {
        p.explodiu = true;
        conferir();
        ctx.avisar();
        return null;
      }
      const v = validarJato(pista, c);
      if ('erro' in v) return v.erro;
      if (v.ok.tempoMs > agora() - verdeEm + FOLGA_MS) return 'Corrida inválida.';
      p.tempoMs = v.ok.tempoMs;
      p.voltas = v.ok.voltas.map((passos) => Math.round((passos * 1000) / 60));
      p.andou = def.voltas;
      // sem itens na pista, a corrida da sala vale como a do Solo: o melhor tempo vira o recorde
      db.guardarJato(quem, pista, v.ok.tempoMs, v.ok.voltas, JSON.stringify(v.ok.amostras));
      if (!prazoAberto) {
        prazoAberto = true;
        ctx.agendar(PRAZO_MS, fechar);
      }
      conferir();
      ctx.avisar();
      return null;
    },
    /** A posição de quem pilota, conferida e carimbada com quem mandou. */
    tempoReal(quem: number, dados: unknown) {
      const p = pilotos.get(quem);
      if (!p || fase !== 'correndo' || p.explodiu || !dados || typeof dados !== 'object') return null;
      const { x, y, a, n, andou, b, t } = dados as Record<string, unknown>;
      if (![x, y, a, n, andou].every(numero)) return null;
      if ((x as number) < 0 || (y as number) < 0 || (x as number) > 1024 || (y as number) > 1024) return null;
      if ((andou as number) < -0.2 || (andou as number) > def.voltas) return null;
      if (!posicaoPossivel(p, x as number, y as number, n as number, andou as number)) return null;
      if (p.tempoMs === null) p.andou = andou as number;
      p.ultima = { x: x as number, y: y as number, n: n as number, andou: andou as number, em: agora() };
      // a inclinação e o turbo vão só para o desenho dos outros
      const banco = numero(b) ? Math.max(-1, Math.min(1, b)) : 0;
      return { userId: quem, x, y, a, n, andou, b: +banco.toFixed(2), t: t === true };
    },
    conferir,
  };
}
