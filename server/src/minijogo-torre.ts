/**
 * A TORRE DO CELEIRO (05/11/2026): a subida vertical, no motor do Pulo do coelho. Os coelhos sobem o celeiro por tábuas,
 * fardos de feno, vigas que sobem e descem e prateleiras que andam, desviando das ferramentas e dos sacos que caem e dos
 * corvos (encostar volta ao último andar), até o cata-vento lá em cima. Só a mecânica do gênero das subidas de festa.
 * O que cai segue um ROTEIRO fixo da torre, pelo passo: todo mundo vê igual, sem sorteio ao vivo e sem a rede.
 *
 * NO SOLO (ctx.solo), contra o relógio, como os Coelhos a jato (minijogo-jato.ts, de onde a forma foi copiada): a pessoa
 * escolhe a torre e até 3 fantasmas (o dela e os dos AMIGOS ACEITOS: o fantasma é o caminho que alguém fez), e o melhor
 * tempo vira o recorde (torre_recordes), conferido por validarTorre (torre.ts). A partida solo não acaba sozinha; parada 30
 * minutos, ela se desfaz.
 *
 * NA SALA, a turma sobe junto, como o Pulo na sala (minijogo-plataforma.ts): o servidor dá o verde (o mesmo semáforo para
 * todos) e só REPASSA as posições, conferidas e carimbadas (os outros aparecem meio transparentes, subindo ao lado, sem
 * batida); cada um sobe no próprio computador; a classificação é pelo TEMPO DE CADA UM, em passos desde o próprio verde, e
 * a chegada não pode declarar mais tempo do que passou desde o verde do servidor. A primeira chegada abre 30 s para os
 * outros; quem não chega fica atrás, pelo quanto subiu. Sem itens, a subida da sala que bate o recorde da pessoa vira o
 * recorde dela. O pódio, com 2 ou mais que ficaram até o fim, vai para a estante de troféus (pista 'torre').
 */
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';
import { comPosicoes, RECOMECO_PASSOS } from './minijogo-plataforma.js';
import { TORRE_PADRAO, TORRES_DO_CELEIRO, validarTorre } from './torre.js';

export const LARGADA_MS = 4000;
export const PRAZO_MS = 30_000;
/** Uma subida não passa disto (a boa leva ~45 s). */
const SUBIDA_MS = 4 * 60_000;
const SOLO_PARADO_MS = 30 * 60_000;
export const FOLGA_MS = 3000;
export const PASSOS_DE_FOLGA = 180;
export const MAX_FANTASMAS = 3;
export const MAXIMO = 8;
/**
 * O quanto se sobe por passo, na média que conta para a ordem de quem não chegou: o piloto automático não passa de ~2 px
 * por passo num segundo inteiro; 3 por passo (o pulo que passa disso só atrasa a conta um pouco, e ela alcança no pouso).
 */
const SOBE_POR_PASSO = 3;

type Ctx = Parameters<Definicao['comecar']>[0];

export const torre: Definicao = criarTorre();

/** `agora` é trocável para o teste. */
export function criarTorre(agora: () => number = Date.now): Definicao {
  return {
    minimo: 2,
    maximo: MAXIMO,
    comecar(ctx, { naSala, corpo }) {
      const pedida = typeof corpo.pista === 'string' ? corpo.pista : typeof corpo.categoria === 'string' ? corpo.categoria : TORRE_PADRAO;
      const id = TORRES_DO_CELEIRO[pedida] ? pedida : TORRE_PADRAO;
      return ctx.solo ? solo(ctx, naSala[0], id, agora) : sala(ctx, naSala, id, agora);
    },
  };
}

// =====================================================================================================================
// O SOLO: contra o relógio, com os fantasmas dos amigos
// =====================================================================================================================

function solo(ctx: Ctx, eu: number, torreInicial: string, agora: () => number) {
  let fase: 'escolha' | 'correndo' | 'resultado' = 'escolha';
  let id = torreInicial;
  let rodada = 0;
  let subiuEm = 0;
  let fantasmas: { userId: number; nome: string; avatar: number | string | null; tempoMs: number; amostras: number[] }[] = [];
  let resultado: { tempoMs: number; recorde: boolean; anterior: number | null } | null = null;
  const evento = `torre-solo-${eu}-${agora()}`;
  const parado = () => ctx.agendar(SOLO_PARADO_MS, () => ctx.terminar(false));
  parado();

  return {
    publico: () => ({
      fase,
      solo: true,
      pista: id,
      recordes: db.recordesDaTorre(eu, id).map(({ userId, username, nomeDeExibicao, avatarPronto, tempoMs }) => ({ userId, nome: nomeDeExibicao || username, avatar: avatarPronto, tempoMs })),
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
        if (fase === 'correndo') return 'A subida está andando.';
        if (typeof c.pista !== 'string' || !TORRES_DO_CELEIRO[c.pista]) return 'Torre desconhecida.';
        id = c.pista;
        fase = 'escolha';
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'escolher') {
        if (fase === 'correndo') return 'A subida está andando.';
        fase = 'escolha';
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'correr') {
        // correr de novo no meio da subida (a pessoa desistiu e recomeçou) vale: a subida anterior só não conta
        const pedidos = Array.isArray(c.fantasmas) ? [...new Set(c.fantasmas.filter((v): v is number => Number.isInteger(v) && (v as number) > 0))].slice(0, MAX_FANTASMAS) : [];
        fantasmas = [];
        for (const outro of pedidos) {
          if (outro !== eu && (db.amizadeEntre(eu, outro)?.situacao !== 'aceita' || db.haBloqueio(eu, outro))) continue;
          const r = db.recordeDaTorre(outro, id);
          if (!r) continue;
          const u = db.findUserById(outro);
          fantasmas.push({ userId: outro, nome: u?.nomeDeExibicao || u?.username || '?', avatar: (u?.coelho ?? u?.avatarPronto ?? null), tempoMs: r.tempoMs, amostras: JSON.parse(r.amostras) as number[] });
        }
        fase = 'correndo';
        rodada++;
        subiuEm = agora();
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'chegada') {
        if (fase !== 'correndo') return 'A subida não está andando.';
        const v = validarTorre(id, c);
        if ('erro' in v) return v.erro;
        // o tempo não passa do que de fato passou desde que a subida começou (a contagem de 3 s fica de folga)
        if (v.ok.tempoMs > agora() - subiuEm + FOLGA_MS) return 'Subida inválida.';
        const r = db.guardarTorre(eu, id, v.ok.tempoMs, JSON.stringify(v.ok.amostras));
        fase = 'resultado';
        resultado = { tempoMs: v.ok.tempoMs, recorde: r.recorde, anterior: r.anterior };
        ctx.avisar();
        return null;
      }
      return 'Ação desconhecida.';
    },
  };
}

// =====================================================================================================================
// NA SALA: a turma sobe junto
// =====================================================================================================================

interface Subindo {
  tempoMs: number | null;
  /** O quanto subiu (0 a 1), pelo y limitado (ver o tempo real): ordena quem não chegou. */
  andou: number;
  maiorN: number;
  refY: number;
  refN: number;
  recomecou: boolean;
}

function sala(ctx: Ctx, naSala: number[], id: string, agora: () => number) {
  const def = TORRES_DO_CELEIRO[id];
  const evento = `torre-${ctx.comunidade ?? 0}-${agora()}`;
  let fase: 'largada' | 'correndo' | 'fim' = 'largada';
  let verdeEm = 0;
  let prazoAberto = false;
  const inscritos = [...naSala];
  const avatares = new Map(inscritos.map((u) => [u, db.avatarDoJogo(u)]));
  const subindo = new Map<number, Subindo>(
    inscritos.map((u) => [u, { tempoMs: null, andou: 0, maiorN: 0, refY: def.largada[1], refN: 0, recomecou: false }]),
  );
  let ficaram: Set<number> | null = null;

  const naFrente = (o: { tempoMs: number | null; andou: number }, l: { tempoMs: number | null; andou: number }) =>
    o.tempoMs !== null && l.tempoMs !== null ? o.tempoMs < l.tempoMs : o.tempoMs !== null ? true : l.tempoMs === null && o.andou > l.andou;

  const classificacao = () => {
    const linhas = [...subindo.entries()]
      .map(([userId, s]) => ({ userId, username: ctx.nome(userId), tempoMs: s.tempoMs, andou: s.andou }))
      .sort((a, b) => (naFrente(a, b) ? -1 : naFrente(b, a) ? 1 : 0));
    return comPosicoes(linhas, ficaram ?? new Set(ctx.naSala()), naFrente);
  };

  const fechar = () => {
    if (fase === 'fim') return;
    const aqui = new Set(ctx.naSala());
    ficaram = new Set([...subindo.keys()].filter((u) => aqui.has(u)));
    const ordem = classificacao();
    // O PÓDIO: com 2 ou mais que ficaram até o fim, os três primeiros que chegaram de verdade vão para a estante
    if (ficaram.size >= 2) {
      for (const l of ordem) {
        if (l.posicao === null || l.posicao > 3 || l.tempoMs === null) continue;
        db.guardarTrofeu({
          userId: l.userId,
          evento,
          communityId: ctx.comunidade ?? 0,
          pista: 'torre',
          posicao: l.posicao,
          tempoMs: l.tempoMs,
          pontos: null,
          rivais: [...ficaram].filter((u) => u !== l.userId),
        });
      }
    }
    fase = 'fim';
    ctx.terminar();
  };

  const conferir = () => {
    if (fase !== 'correndo') return;
    const presentes = ctx.naSala();
    if (presentes.length === 0 || presentes.every((u) => !subindo.has(u) || subindo.get(u)!.tempoMs !== null)) fechar();
  };

  ctx.agendar(LARGADA_MS, () => {
    fase = 'correndo';
    verdeEm = agora();
    ctx.agendar(SUBIDA_MS, fechar);
    ctx.avisar();
  });

  const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const progresso = (y: number) => Math.round(Math.max(0, Math.min(1, (def.largada[1] - y) / (def.largada[1] - def.chegada))) * 1000) / 1000;

  return {
    publico: () => ({
      fase,
      solo: false,
      pista: id,
      pilotos: classificacao().map(({ userId, username, tempoMs, posicao }) => ({ userId, username, tempoMs, posicao, avatar: avatares.get(userId) ?? null })),
      prazo: prazoAberto,
      partidaId: evento,
    }),
    acao(quem: number, c: Record<string, unknown>) {
      const s = subindo.get(quem);
      if (!s) return 'Você não está nesta subida.';
      if (c.tipo !== 'chegada') return 'Ação desconhecida.';
      if (fase !== 'correndo') return 'A subida não está andando.';
      if (s.tempoMs !== null) return null;
      // quem recomeçou no meio (a página recarregada) não chega por esta subida: a mesma regra do Pulo na sala
      if (s.recomecou) return 'Subida inválida.';
      const v = validarTorre(id, c);
      if ('erro' in v) return v.erro;
      if (v.ok.tempoMs > agora() - verdeEm + FOLGA_MS) return 'Subida inválida.';
      s.tempoMs = v.ok.tempoMs;
      s.andou = 1;
      // sem itens, a subida da sala vale como a do Solo: o melhor tempo vira o recorde
      db.guardarTorre(quem, id, v.ok.tempoMs, JSON.stringify(v.ok.amostras));
      if (!prazoAberto) {
        prazoAberto = true;
        ctx.agendar(PRAZO_MS, fechar);
      }
      conferir();
      ctx.avisar();
      return null;
    },
    /**
     * A posição de quem sobe, conferida e carimbada: x e y dentro da torre, o passo (que não passa do relógio do servidor
     * desde o verde, mais 3 s) e o jeito. O quanto subiu sai do y, aqui, e não pula mais do que se sobe desde a posição
     * anterior: o console não manda o y do topo para ficar na frente de quem não chegou.
     */
    tempoReal(quem: number, dados: unknown) {
      const s = subindo.get(quem);
      if (!s || fase !== 'correndo' || !dados || typeof dados !== 'object') return null;
      const { x, y, n, j } = dados as Record<string, unknown>;
      if (!numero(x) || !numero(y) || !numero(n) || !numero(j)) return null;
      const passoMaximo = ((agora() - verdeEm) * 60) / 1000 + PASSOS_DE_FOLGA;
      if (x < 0 || x > def.largura || y < -64 || y > def.altura || n < 0 || n > passoMaximo || ![-2, -1, 1, 2].includes(j)) return null;
      if (n < s.maiorN - RECOMECO_PASSOS) s.recomecou = true;
      s.maiorN = Math.max(s.maiorN, n);
      if (s.tempoMs === null && !s.recomecou) {
        s.refY = Math.max(y, s.refY - Math.max(0, n - s.refN) * SOBE_POR_PASSO);
        s.refN = Math.max(s.refN, n);
        s.andou = progresso(s.refY);
      }
      return { userId: quem, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, n: Math.round(n), j, andou: progresso(y) };
    },
    conferir,
  };
}
