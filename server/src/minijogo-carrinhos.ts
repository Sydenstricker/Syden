/**
 * OS CARRINHOS DA TOCA (06/11/2026, pedido dele: "um jogo de autorama: o jogador controla a aceleração do seu kart, e se
 * acelerar demais ele sai da pista"). Só a mecânica das pistas de carrinhos de brinquedo com faixas: cada carro segue a sua
 * faixa sozinho, e quem joga só tem o acelerador. A pista e os carros são do Toy Car Kit da Kenney (CC0); quem pilota é o
 * nosso coelho. A regra inteira está em carrinhos-sim.ts (o MESMO arquivo do site, byte a byte).
 *
 * A CONFERÊNCIA É A MAIS FORTE DOS JOGOS DE CORRIDA: o site manda o acelerador de cada passo, e o servidor REFAZ a corrida. O
 * tempo, as voltas e as saídas da pista são os dele; o que o site diz não conta. E o tempo não passa do que passou de verdade
 * desde a largada (com a contagem de folga).
 *
 * NO SOLO (ctx.solo), contra o relógio, sempre na faixa do recorde (FAIXA_DO_RECORDE: os tempos se comparam), com até 3
 * fantasmas (o meu e os dos AMIGOS ACEITOS, a regra do kart) e de 0 a 3 robôs nas outras faixas (os robôs são do site: o
 * resultado deles não vem ao servidor nem conta em nada). O melhor tempo vira o recorde (carrinhos_recordes).
 *
 * NA SALA (2 a 4), cada um na sua faixa, pela ordem de quem aceitou: o servidor dá o verde, repassa as posições (a distância na
 * faixa e se o carro está fora) e classifica pelo tempo de cada um, refeito. A primeira chegada abre 30 s para os outros. A
 * corrida da sala NÃO vira recorde: a faixa é outra. O pódio vai para a estante de troféus (pista 'carrinhos').
 */
import * as db from './db.js';
import { entradasValidas, FAIXA_DO_RECORDE, FAIXAS, refazer, VMAX, VOLTA, VOLTAS } from './carrinhos-sim.js';
import type { Definicao } from './minijogo-motor.js';

export const PISTA_DOS_CARRINHOS = 'toca-1';
export const LARGADA_MS = 4000;
export const PRAZO_MS = 30_000;
const CORRIDA_MS = 4 * 60_000;
const SOLO_PARADO_MS = 30 * 60_000;
export const FOLGA_MS = 3000;
const PASSOS_DE_FOLGA = 180;
export const MAX_FANTASMAS = 3;
export const MAX_ROBOS = FAIXAS - 1;

const tempoDe = (passos: number) => Math.round((passos * 1000) / 60);

/** Refaz a corrida pelas entradas; erro se não chegou. */
function conferirCorrida(faixa: number, corpo: Record<string, unknown>): { erro: string } | { passos: number; voltas: number[]; entradas: number[]; saidas: number } {
  if (!entradasValidas(corpo.entradas)) return { erro: 'Corrida inválida.' };
  const c = refazer(faixa, corpo.entradas);
  if (!c.chegou) return { erro: 'Corrida inválida.' };
  return { passos: c.voltas[VOLTAS - 1], voltas: c.voltas, entradas: corpo.entradas, saidas: c.saidas };
}

export const carrinhos: Definicao = criarCarrinhos();

/** `agora` é trocável para o teste. */
export function criarCarrinhos(agora: () => number = Date.now): Definicao {
  return {
    minimo: 2,
    maximo: FAIXAS,
    comecar(ctx, { naSala }) {
      return ctx.solo ? solo(ctx, naSala[0], agora) : sala(ctx, naSala, agora);
    },
  };
}

// =====================================================================================================================
// O SOLO: contra o relógio, os fantasmas dos amigos e os robôs
// =====================================================================================================================

function solo(ctx: Parameters<Definicao['comecar']>[0], eu: number, agora: () => number) {
  let fase: 'escolha' | 'correndo' | 'resultado' = 'escolha';
  let rodada = 0;
  let robos = 0;
  let correuEm = 0;
  let fantasmas: { userId: number; nome: string; avatar: number | string | null; tempoMs: number; entradas: number[] }[] = [];
  let resultado: { tempoMs: number; voltas: number[]; saidas: number; recorde: boolean; anterior: number | null } | null = null;
  const evento = `carrinhos-solo-${eu}-${agora()}`;
  const parado = () => ctx.agendar(SOLO_PARADO_MS, () => ctx.terminar(false));
  parado();

  return {
    publico: () => ({
      fase,
      solo: true,
      voltasDaCorrida: VOLTAS,
      recordes: db
        .recordesDosCarrinhos(eu, PISTA_DOS_CARRINHOS)
        .map(({ userId, username, nomeDeExibicao, avatarPronto, tempoMs }) => ({ userId, nome: nomeDeExibicao || username, avatar: avatarPronto, tempoMs })),
      meuAvatar: db.avatarDoJogo(eu),
      meuNome: ctx.nome(eu),
      fantasmas: fase === 'correndo' ? fantasmas : [],
      robos,
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
        robos = Number.isInteger(c.robos) ? Math.max(0, Math.min(MAX_ROBOS, c.robos as number)) : 0;
        // os fantasmas: o meu e os dos amigos aceitos (sem bloqueio), no máximo três; o que não pode, some calado
        const pedidos = Array.isArray(c.fantasmas)
          ? [...new Set(c.fantasmas.filter((id): id is number => Number.isInteger(id) && (id as number) > 0))].slice(0, MAX_FANTASMAS)
          : [];
        fantasmas = [];
        for (const id of pedidos) {
          if (id !== eu && (db.amizadeEntre(eu, id)?.situacao !== 'aceita' || db.haBloqueio(eu, id))) continue;
          const r = db.recordeDosCarrinhos(id, PISTA_DOS_CARRINHOS);
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
        const v = conferirCorrida(FAIXA_DO_RECORDE, c);
        if ('erro' in v) return v.erro;
        const tempoMs = tempoDe(v.passos);
        // o tempo não passa do que de fato passou desde que a corrida começou (a contagem fica de folga)
        if (tempoMs > agora() - correuEm + FOLGA_MS) return 'Corrida inválida.';
        const r = db.guardarCarrinhos(eu, PISTA_DOS_CARRINHOS, tempoMs, v.voltas, JSON.stringify(v.entradas));
        fase = 'resultado';
        resultado = { tempoMs, voltas: v.voltas.map(tempoDe), saidas: v.saidas, recorde: r.recorde, anterior: r.anterior };
        ctx.avisar();
        return null;
      }
      return 'Ação desconhecida.';
    },
  };
}

// =====================================================================================================================
// NA SALA: a turma corre junto, cada um na sua faixa
// =====================================================================================================================

interface Piloto {
  faixa: number;
  tempoMs: number | null;
  voltas: number[];
  andou: number;
  ultima: { n: number; s: number; em: number } | null;
}

function sala(ctx: Parameters<Definicao['comecar']>[0], naSala: number[], agora: () => number) {
  const evento = `carrinhos-${ctx.comunidade ?? 0}-${agora()}`;
  let fase: 'largada' | 'correndo' | 'fim' = 'largada';
  let verdeEm = 0;
  let prazoAberto = false;
  const inscritos = naSala.slice(0, FAIXAS);
  const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
  const pilotos = new Map<number, Piloto>(inscritos.map((id, i) => [id, { faixa: i, tempoMs: null, voltas: [], andou: 0, ultima: null }]));
  let ficaram: Set<number> | null = null;

  /** `o` ficou na frente de `l`: chegou com menos tempo; quem chegou fica na frente de quem não chegou; senão, andou mais. */
  const naFrente = (o: { tempoMs: number | null; andou: number }, l: { tempoMs: number | null; andou: number }) =>
    o.tempoMs !== null && l.tempoMs !== null ? o.tempoMs < l.tempoMs : o.tempoMs !== null ? true : l.tempoMs === null && o.andou > l.andou;

  const classificacao = () => {
    const contam = ficaram ?? new Set(ctx.naSala());
    const linhas = [...pilotos.entries()]
      .map(([userId, p]) => ({ userId, username: ctx.nome(userId), faixa: p.faixa, tempoMs: p.tempoMs, voltas: p.voltas, andou: p.andou }))
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
    ficaram = new Set([...pilotos.keys()].filter((id) => aqui.has(id)));
    // O PÓDIO: com 2 ou mais que ficaram até o fim, os três primeiros que chegaram de verdade vão para a estante
    if (ficaram.size >= 2) {
      for (const l of classificacao()) {
        if (l.posicao === null || l.posicao > 3 || l.tempoMs === null) continue;
        db.guardarTrofeu({
          userId: l.userId,
          evento,
          communityId: ctx.comunidade ?? 0,
          pista: 'carrinhos',
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
    if (presentes.length === 0 || presentes.every((id) => !pilotos.has(id) || pilotos.get(id)!.tempoMs !== null)) fechar();
  };

  ctx.agendar(LARGADA_MS, () => {
    fase = 'correndo';
    verdeEm = agora();
    ctx.agendar(CORRIDA_MS, fechar);
    ctx.avisar();
  });

  /** O carro só anda o que a reta deixa: nenhum salto, e nenhum passo à frente do relógio do servidor. */
  const posicaoPossivel = (p: Piloto, n: number, s: number) => {
    if (!Number.isInteger(n) || n < 1) return false;
    if (n > ((agora() - verdeEm) * 60) / 1000 + PASSOS_DE_FOLGA) return false;
    if (s < 0 || s > VOLTAS * VOLTA[p.faixa] + 12) return false;
    const u = p.ultima ?? { n: 0, s: 0 };
    if (n <= u.n) return false;
    return s >= u.s - 0.01 && s - u.s <= ((n - u.n) * VMAX) / 60 + 0.5;
  };

  return {
    publico: () => ({
      fase,
      solo: false,
      voltasDaCorrida: VOLTAS,
      pilotos: classificacao().map(({ userId, username, faixa, tempoMs, voltas, posicao }) => ({ userId, username, faixa, tempoMs, voltas, posicao, avatar: avatares.get(userId) ?? null })),
      prazo: prazoAberto,
      partidaId: evento,
    }),
    acao(quem: number, c: Record<string, unknown>) {
      const p = pilotos.get(quem);
      if (!p) return 'Você não está nesta corrida.';
      if (c.tipo !== 'chegada') return 'Ação desconhecida.';
      if (fase !== 'correndo') return 'A corrida não está andando.';
      if (p.tempoMs !== null) return null;
      const v = conferirCorrida(p.faixa, c);
      if ('erro' in v) return v.erro;
      const tempoMs = tempoDe(v.passos);
      if (tempoMs > agora() - verdeEm + FOLGA_MS) return 'Corrida inválida.';
      p.tempoMs = tempoMs;
      p.voltas = v.voltas.map(tempoDe);
      p.andou = VOLTAS * VOLTA[p.faixa];
      if (!prazoAberto) {
        prazoAberto = true;
        ctx.agendar(PRAZO_MS, fechar);
      }
      conferir();
      ctx.avisar();
      return null;
    },
    /** A posição de quem pilota (a distância na faixa e se está fora), conferida e carimbada com quem mandou. */
    tempoReal(quem: number, dados: unknown) {
      const p = pilotos.get(quem);
      if (!p || fase !== 'correndo' || !dados || typeof dados !== 'object') return null;
      const { n, s, f, d } = dados as Record<string, unknown>;
      if (typeof n !== 'number' || typeof s !== 'number' || !Number.isFinite(s)) return null;
      if (!posicaoPossivel(p, n, s)) return null;
      if (p.tempoMs === null) p.andou = s;
      p.ultima = { n, s, em: agora() };
      // fora da pista e a derrapagem vão só para o desenho dos outros
      const fora = f === 1 ? 1 : 0;
      const derrapa = typeof d === 'number' && Number.isFinite(d) ? Math.max(0, Math.min(1, Math.round(d * 10) / 10)) : 0;
      return { userId: quem, n, s: Math.round(s * 1000) / 1000, f: fora, d: derrapa };
    },
    conferir,
  };
}

export { FAIXA_DO_RECORDE };
