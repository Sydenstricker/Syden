/**
 * A GINCANA DA TOCA (06/11/2026, pedido dele: "um minigame para chegar ao final do mapa, com esses assets que já temos"): a
 * corrida de obstáculos em 3D com as peças do Platformer Pack da KayKit (CC0). Só a mecânica do gênero. A regra inteira está em
 * gincana-sim.ts (o MESMO arquivo do site, byte a byte).
 *
 * A CONFERÊNCIA É A DOS CARRINHOS, a mais forte: o site manda os COMANDOS de cada passo (em trechos), e o servidor REFAZ o
 * percurso inteiro. O tempo, as bandeiras e as quedas são os dele; o que o site diz não conta. E o tempo não passa do que passou
 * de verdade desde a largada (com a contagem de folga). O que sobra possível: um programa que ache os comandos perfeitos (o
 * piloto automático dos testes faz isso), e, na sala, mandar posições ao vivo inventadas (dentro do que um coelho anda): elas são
 * só o desenho que a turma vê, e a classificação sai da chegada refeita.
 *
 * NO SOLO (ctx.solo), contra o relógio em um dos três percursos, com até 3 fantasmas (o meu e os dos AMIGOS ACEITOS, a regra do
 * kart). O melhor tempo de cada percurso vira o recorde (gincana_recordes).
 *
 * NA SALA (2 a 8), o mesmo percurso para a turma: o servidor dá o verde, repassa as posições (conferidas: nenhum salto além do
 * que um coelho anda, a não ser de volta a uma bandeira já alcançada, e nenhum passo à frente do relógio) e classifica pelo
 * tempo de cada um, refeito. A primeira chegada abre 30 s para os outros. Sem itens, a corrida da sala que bate o recorde da
 * pessoa vira o recorde dela (como no Pulo). O pódio vai para a estante de troféus (pista 'gincana').
 */
import * as db from './db.js';
import { entradasValidas, IDS_DOS_PERCURSOS, PERCURSOS, posicaoPossivel, refazer } from './gincana-sim.js';
import type { Definicao } from './minijogo-motor.js';

export const LARGADA_MS = 4000;
export const PRAZO_MS = 30_000;
const CORRIDA_MS = 5 * 60_000;
const SOLO_PARADO_MS = 30 * 60_000;
export const FOLGA_MS = 3000;
export const PASSOS_DE_FOLGA = 180;
export const MAX_FANTASMAS = 3;
export const MAXIMO = 8;
/** O passo que cai mais que isto (1 s) de uma posição para a outra é um percurso novo: a página recarregada. */
export const RECOMECO_PASSOS = 60;
export const PERCURSO_PADRAO = IDS_DOS_PERCURSOS[0];

const tempoDe = (passos: number) => Math.round((passos * 1000) / 60);
const percursoPedido = (corpo: Record<string, unknown>) => {
  const v = typeof corpo.percurso === 'string' ? corpo.percurso : typeof corpo.categoria === 'string' ? corpo.categoria : '';
  return PERCURSOS[v] ? v : PERCURSO_PADRAO;
};

/** Refaz o percurso pelas entradas; erro se não chegou. */
function conferirPercurso(percurso: string, corpo: Record<string, unknown>): { erro: string } | { passos: number; quedas: number; entradas: number[] } {
  if (!entradasValidas(corpo.entradas)) return { erro: 'Corrida inválida.' };
  const c = refazer(PERCURSOS[percurso], corpo.entradas);
  if (!c.chegou) return { erro: 'Corrida inválida.' };
  return { passos: c.chegouEm, quedas: c.quedas, entradas: corpo.entradas };
}

export const gincana: Definicao = criarGincana();

/** `agora` é trocável para o teste. */
export function criarGincana(agora: () => number = Date.now): Definicao {
  return {
    minimo: 2,
    maximo: MAXIMO,
    comecar(ctx, { naSala, corpo }) {
      return ctx.solo ? solo(ctx, naSala[0], agora) : sala(ctx, naSala, percursoPedido(corpo), agora);
    },
  };
}

// =====================================================================================================================
// O SOLO: contra o relógio e os fantasmas dos amigos
// =====================================================================================================================

function solo(ctx: Parameters<Definicao['comecar']>[0], eu: number, agora: () => number) {
  let fase: 'escolha' | 'correndo' | 'resultado' = 'escolha';
  let percurso = PERCURSO_PADRAO;
  let rodada = 0;
  let correuEm = 0;
  let fantasmas: { userId: number; nome: string; avatar: number | string | null; tempoMs: number; entradas: number[] }[] = [];
  let resultado: { tempoMs: number; quedas: number; recorde: boolean; anterior: number | null } | null = null;
  const evento = `gincana-solo-${eu}-${agora()}`;
  const parado = () => ctx.agendar(SOLO_PARADO_MS, () => ctx.terminar(false));
  parado();

  return {
    publico: () => ({
      fase,
      solo: true,
      percurso,
      recordes: db
        .recordesDaGincana(eu)
        .map(({ userId, username, nomeDeExibicao, avatarPronto, percurso: p, tempoMs }) => ({ userId, nome: nomeDeExibicao || username, avatar: avatarPronto, percurso: p, tempoMs })),
      meuAvatar: db.avatarDoJogo(eu),
      meuNome: ctx.nome(eu),
      fantasmas: fase === 'correndo' ? fantasmas : [],
      rodada,
      resultado,
      partidaId: evento,
    }),
    acao(quem: number, c: Record<string, unknown>) {
      if (quem !== eu) return 'Você está assistindo esta partida.';
      parado();
      if (c.tipo === 'escolher') {
        if (fase === 'correndo') return 'A corrida está andando.';
        fase = 'escolha';
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'correr') {
        if (fase === 'correndo') return 'A corrida está andando.';
        percurso = percursoPedido(c);
        // os fantasmas: o meu e os dos amigos aceitos (sem bloqueio), no máximo três; o que não pode, some calado
        const pedidos = Array.isArray(c.fantasmas)
          ? [...new Set(c.fantasmas.filter((id): id is number => Number.isInteger(id) && (id as number) > 0))].slice(0, MAX_FANTASMAS)
          : [];
        fantasmas = [];
        for (const id of pedidos) {
          if (id !== eu && (db.amizadeEntre(eu, id)?.situacao !== 'aceita' || db.haBloqueio(eu, id))) continue;
          const r = db.recordeDaGincana(id, percurso);
          if (!r) continue;
          const u = db.findUserById(id);
          fantasmas.push({ userId: id, nome: u?.nomeDeExibicao || u?.username || '?', avatar: (u?.coelho ?? u?.avatarPronto ?? null), tempoMs: r.tempoMs, entradas: JSON.parse(r.entradas) as number[] });
        }
        fase = 'correndo';
        rodada++;
        correuEm = agora();
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'chegada') {
        if (fase !== 'correndo') return 'A corrida não está andando.';
        const v = conferirPercurso(percurso, c);
        if ('erro' in v) return v.erro;
        const tempoMs = tempoDe(v.passos);
        // o tempo não passa do que de fato passou desde que a corrida começou (a contagem fica de folga)
        if (tempoMs > agora() - correuEm + FOLGA_MS) return 'Corrida inválida.';
        const r = db.guardarGincana(eu, percurso, tempoMs, v.quedas, JSON.stringify(v.entradas));
        fase = 'resultado';
        resultado = { tempoMs, quedas: v.quedas, recorde: r.recorde, anterior: r.anterior };
        ctx.avisar();
        return null;
      }
      return 'Ação desconhecida.';
    },
  };
}

// =====================================================================================================================
// NA SALA: a turma corre o mesmo percurso, cada um no próprio computador
// =====================================================================================================================

interface Corredor {
  tempoMs: number | null;
  quedas: number;
  /** O quanto andou (0 a 1), pela última posição que valeu: ordena quem não chegou. */
  andou: number;
  ultima: { n: number; x: number; y: number; z: number; posto: number } | null;
  maiorN: number;
  /** Recomeçou no meio (o passo voltou muito): a chegada dela não vale. */
  recomecou: boolean;
}

function sala(ctx: Parameters<Definicao['comecar']>[0], naSala: number[], percurso: string, agora: () => number) {
  const p = PERCURSOS[percurso];
  const evento = `gincana-${ctx.comunidade ?? 0}-${agora()}`;
  let fase: 'largada' | 'correndo' | 'fim' = 'largada';
  let verdeEm = 0;
  let prazoAberto = false;
  const inscritos = naSala.slice(0, MAXIMO);
  const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
  const corredores = new Map<number, Corredor>(inscritos.map((id) => [id, { tempoMs: null, quedas: 0, andou: 0, ultima: null, maiorN: 0, recomecou: false }]));
  let ficaram: Set<number> | null = null;

  /** `o` ficou na frente de `l`: chegou com menos tempo; quem chegou fica na frente de quem não chegou; senão, andou mais. */
  const naFrente = (o: { tempoMs: number | null; andou: number }, l: { tempoMs: number | null; andou: number }) =>
    o.tempoMs !== null && l.tempoMs !== null ? o.tempoMs < l.tempoMs : o.tempoMs !== null ? true : l.tempoMs === null && o.andou > l.andou;

  const classificacao = () => {
    const contam = ficaram ?? new Set(ctx.naSala());
    const linhas = [...corredores.entries()]
      .map(([userId, c]) => ({ userId, username: ctx.nome(userId), tempoMs: c.tempoMs, quedas: c.quedas, andou: c.andou }))
      .sort((a, b) => (naFrente(a, b) ? -1 : naFrente(b, a) ? 1 : 0));
    const ficou = linhas.filter((l) => contam.has(l.userId));
    return [
      ...ficou.map((l) => ({ ...l, posicao: (1 + ficou.filter((o) => naFrente(o, l)).length) as number | null })),
      ...linhas.filter((l) => !contam.has(l.userId)).map((l) => ({ ...l, posicao: null as number | null })),
    ];
  };

  const fechar = () => {
    if (fase === 'fim') return;
    const aqui = new Set(ctx.naSala());
    ficaram = new Set([...corredores.keys()].filter((id) => aqui.has(id)));
    // O PÓDIO: com 2 ou mais que ficaram até o fim, os três primeiros que chegaram de verdade vão para a estante
    if (ficaram.size >= 2) {
      for (const l of classificacao()) {
        if (l.posicao === null || l.posicao > 3 || l.tempoMs === null) continue;
        db.guardarTrofeu({
          userId: l.userId,
          evento,
          communityId: ctx.comunidade ?? 0,
          pista: 'gincana',
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
    if (presentes.length === 0 || presentes.every((id) => !corredores.has(id) || corredores.get(id)!.tempoMs !== null)) fechar();
  };

  ctx.agendar(LARGADA_MS, () => {
    fase = 'correndo';
    verdeEm = agora();
    ctx.agendar(CORRIDA_MS, fechar);
    ctx.avisar();
  });

  return {
    publico: () => ({
      fase,
      solo: false,
      percurso,
      // o 'Jogar de novo' do painel manda de volta a categoria: o mesmo percurso
      categoria: percurso,
      corredores: classificacao().map(({ userId, username, tempoMs, quedas, posicao }) => ({ userId, username, tempoMs, quedas, posicao, avatar: avatares.get(userId) ?? null })),
      prazo: prazoAberto,
      partidaId: evento,
    }),
    acao(quem: number, c: Record<string, unknown>) {
      const k = corredores.get(quem);
      if (!k) return 'Você não está nesta corrida.';
      if (c.tipo !== 'chegada') return 'Ação desconhecida.';
      if (fase !== 'correndo') return 'A corrida não está andando.';
      if (k.tempoMs !== null) return null;
      if (k.recomecou) return 'Corrida inválida.';
      const v = conferirPercurso(percurso, c);
      if ('erro' in v) return v.erro;
      const tempoMs = tempoDe(v.passos);
      if (tempoMs > agora() - verdeEm + FOLGA_MS) return 'Corrida inválida.';
      k.tempoMs = tempoMs;
      k.quedas = v.quedas;
      k.andou = 1;
      // sem itens, a corrida da sala vale como a do contra o relógio: se for o melhor da pessoa, vira o recorde
      db.guardarGincana(quem, percurso, tempoMs, v.quedas, JSON.stringify(v.entradas));
      if (!prazoAberto) {
        prazoAberto = true;
        ctx.agendar(PRAZO_MS, fechar);
      }
      conferir();
      ctx.avisar();
      return null;
    },
    /** A posição de quem corre, conferida e carimbada com quem mandou. */
    tempoReal(quem: number, dados: unknown) {
      const k = corredores.get(quem);
      if (!k || fase !== 'correndo' || k.tempoMs !== null || !dados || typeof dados !== 'object') return null;
      const { n, x, y, z, e } = dados as Record<string, unknown>;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return null;
      if (n > ((agora() - verdeEm) * 60) / 1000 + PASSOS_DE_FOLGA) return null;
      if (n < k.maiorN - RECOMECO_PASSOS) {
        // a página foi recarregada no meio: este percurso não vale mais (a chegada vai ser recusada)
        k.recomecou = true;
        return null;
      }
      const antes = k.ultima ?? { n: 0, x: p.postos[0].x, y: p.postos[0].y, z: p.postos[0].zVolta, posto: 0 };
      const posto = posicaoPossivel(p, antes, { n, x, y, z });
      if (posto < 0) return null;
      k.ultima = { n, x, y, z, posto };
      if (n > k.maiorN) k.maiorN = n;
      // o quanto andou: pela última bandeira e um tanto além dela, nunca a chegada (só a chegada refeita dá 1)
      const andou = Math.max(0, Math.min(0.99, z / p.comprimento));
      k.andou = andou;
      // o jeito (no chão, no ar, piscando) vai só para o desenho dos outros
      const jeito = e === 1 || e === 2 ? e : 0;
      const r = (v: number) => Math.round(v * 100) / 100;
      return { userId: quem, n, x: r(x), y: r(y), z: r(z), e: jeito };
    },
    conferir,
  };
}
