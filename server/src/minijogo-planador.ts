/**
 * O PLANADOR DA TOCA (16/11/2026): desafios de voo com pouso no alvo (a asa-delta pelos anéis, a mochila a jato até a
 * plataforma, o salto de paraquedas na mosca). Só a mecânica do gênero dos jogos de voo de 16 bits. A regra inteira está em
 * planador-sim.ts (o MESMO arquivo do site, byte a byte).
 *
 * A CONFERÊNCIA É A DOS CARRINHOS: o site manda os COMANDOS de cada passo, e o servidor REFAZ o voo. Os pontos, os anéis e o
 * pouso são os dele; o que o site diz não conta. E o voo não dura mais do que passou de verdade desde a largada (+ a folga).
 *
 * NO SOLO (ctx.solo), escolhe-se o desafio; até 3 fantasmas (o meu e os dos AMIGOS ACEITOS, a regra do kart). O melhor voo
 * de cada desafio vira o recorde (planador_recordes).
 *
 * NA SALA (2 a 8), o MESMO desafio para a turma, cada um na própria tela: quem começou escolhe (ou já vem no convite), o
 * servidor dá o verde, repassa as posições (cada um vê os outros voando) e classifica pelos pontos refeitos; no empate,
 * quem pousou antes. Acaba quando todos pousaram, ou no tempo máximo do desafio. O voo da sala não vira recorde: o recorde é do
 * Solo, onde se escolhe a hora de voar. O pódio vai para a estante de troféus (pista 'planador', os pontos).
 */
import * as db from './db.js';
import { DESAFIOS, desafioPorId, entradasValidas, refazer, type Desafio, type Resultado } from './planador-sim.js';
import type { Definicao } from './minijogo-motor.js';

export const LARGADA_MS = 4000;
export const FOLGA_MS = 3000;
const ESCOLHA_MS = 60_000;
const SOLO_PARADO_MS = 30 * 60_000;
const PASSOS_DE_FOLGA = 180;
export const MAX_FANTASMAS = 3;
/** Nenhum voo anda mais que isto por passo (a asa no mergulho é a mais rápida: 22 m/s; a queda livre, 42 para baixo). */
const MAIS_RAPIDO = 50;

/** Refaz o voo pelos comandos; erro se não acabou. */
function conferirVoo(d: Desafio, corpo: Record<string, unknown>): { erro: string } | { r: Resultado; entradas: number[] } {
  if (!entradasValidas(corpo.entradas, d)) return { erro: 'Voo inválido.' };
  const v = refazer(d, corpo.entradas);
  if (!v.fim) return { erro: 'Voo inválido.' };
  return { r: v.fim, entradas: corpo.entradas };
}

const msDe = (passos: number) => Math.round((passos * 1000) / 60);

export const planador: Definicao = criarPlanador();

/** `agora` é trocável para o teste. */
export function criarPlanador(agora: () => number = Date.now): Definicao {
  return {
    minimo: 2,
    maximo: 8,
    comecar(ctx, { naSala, criadaPor, corpo }) {
      if (corpo.desafio !== undefined && !desafioPorId(corpo.desafio)) return 'Desafio desconhecido.';
      return ctx.solo ? solo(ctx, naSala[0], agora) : sala(ctx, naSala, criadaPor, desafioPorId(corpo.desafio), agora);
    },
  };
}

// =====================================================================================================================
// O SOLO
// =====================================================================================================================

function solo(ctx: Parameters<Definicao['comecar']>[0], eu: number, agora: () => number) {
  let fase: 'escolha' | 'voando' | 'resultado' = 'escolha';
  let desafio: Desafio = DESAFIOS[0];
  let rodada = 0;
  let voouEm = 0;
  let fantasmas: { userId: number; nome: string; avatar: number | string | null; pontos: number; entradas: number[] }[] = [];
  let resultado: (Resultado & { recorde: boolean; anterior: number | null }) | null = null;
  const evento = `planador-solo-${eu}-${agora()}`;
  const parado = () => ctx.agendar(SOLO_PARADO_MS, () => ctx.terminar(false));
  parado();

  return {
    publico: () => ({
      fase,
      solo: true,
      desafio: desafio.id,
      recordes: db
        .recordesDoPlanador(eu)
        .map(({ userId, username, nomeDeExibicao, avatarPronto, desafio: d, pontos }) => ({ userId, nome: nomeDeExibicao || username, avatar: avatarPronto, desafio: d, pontos })),
      meuAvatar: db.avatarDoJogo(eu),
      meuNome: ctx.nome(eu),
      fantasmas: fase === 'voando' ? fantasmas : [],
      rodada,
      resultado,
      partidaId: evento,
    }),
    acao(quem: number, c: Record<string, unknown>) {
      if (quem !== eu) return 'Você está assistindo esta partida.';
      parado();
      if (c.tipo === 'escolher') {
        if (fase === 'voando') return 'O voo está andando.';
        fase = 'escolha';
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'voar') {
        if (fase === 'voando') return 'O voo está andando.';
        const d = desafioPorId(c.desafio);
        if (!d) return 'Desafio desconhecido.';
        desafio = d;
        const pedidos = Array.isArray(c.fantasmas)
          ? [...new Set(c.fantasmas.filter((id): id is number => Number.isInteger(id) && (id as number) > 0))].slice(0, MAX_FANTASMAS)
          : [];
        fantasmas = [];
        for (const id of pedidos) {
          // o fantasma é o caminho que alguém fez: só o meu e o dos amigos aceitos; o que não pode some calado
          if (id !== eu && (db.amizadeEntre(eu, id)?.situacao !== 'aceita' || db.haBloqueio(eu, id))) continue;
          const r = db.recordeDoPlanador(id, d.id);
          if (!r) continue;
          const u = db.findUserById(id);
          fantasmas.push({ userId: id, nome: u?.nomeDeExibicao || u?.username || '?', avatar: u?.coelho ?? u?.avatarPronto ?? null, pontos: r.pontos, entradas: JSON.parse(r.entradas) as number[] });
        }
        fase = 'voando';
        rodada++;
        voouEm = agora();
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'pouso') {
        if (fase !== 'voando') return 'O voo não está andando.';
        const v = conferirVoo(desafio, c);
        if ('erro' in v) return v.erro;
        // o voo não dura mais do que de fato passou desde que começou (a contagem fica de folga)
        if (msDe(v.r.passos) > agora() - voouEm + FOLGA_MS) return 'Voo inválido.';
        // um voo de zero pontos (a batida sem anel) não vira recorde de ninguém
        const g =
          v.r.total > 0
            ? db.guardarPlanador(eu, desafio.id, v.r.total, v.r.passos, JSON.stringify(v.entradas))
            : { anterior: db.recordeDoPlanador(eu, desafio.id)?.pontos ?? null, recorde: false };
        fase = 'resultado';
        resultado = { ...v.r, recorde: g.recorde, anterior: g.anterior };
        ctx.avisar();
        return null;
      }
      return 'Ação desconhecida.';
    },
  };
}

// =====================================================================================================================
// NA SALA
// =====================================================================================================================

interface Piloto {
  resultado: Resultado | null;
  ultima: { n: number; x: number; y: number; h: number } | null;
}

function sala(ctx: Parameters<Definicao['comecar']>[0], naSala: number[], criadaPor: number, escolhido: Desafio | null, agora: () => number) {
  const evento = `planador-${ctx.comunidade ?? 0}-${agora()}`;
  let fase: 'escolha' | 'largada' | 'voando' | 'fim' = 'escolha';
  let desafio: Desafio = escolhido ?? DESAFIOS[0];
  let verdeEm = 0;
  const inscritos = naSala.slice(0, 8);
  const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
  const pilotos = new Map<number, Piloto>(inscritos.map((id) => [id, { resultado: null, ultima: null }]));
  let ficaram: Set<number> | null = null;

  /** `a` fica na frente de `b`: mais pontos; no empate, pousou antes; quem pousou fica na frente de quem não pousou. */
  const naFrente = (a: Piloto, b: Piloto) =>
    a.resultado && b.resultado
      ? a.resultado.total > b.resultado.total || (a.resultado.total === b.resultado.total && a.resultado.passos < b.resultado.passos)
      : !!a.resultado && !b.resultado;

  const classificacao = () => {
    const contam = ficaram ?? new Set(ctx.naSala());
    const linhas = [...pilotos.entries()].sort(([, a], [, b]) => (naFrente(a, b) ? -1 : naFrente(b, a) ? 1 : 0));
    const ficou = linhas.filter(([id]) => contam.has(id));
    return linhas.map(([userId, p]) => ({
      userId,
      username: ctx.nome(userId),
      avatar: avatares.get(userId) ?? null,
      resultado: p.resultado,
      posicao: contam.has(userId) ? 1 + ficou.filter(([, o]) => naFrente(o, p)).length : null,
    }));
  };

  const fechar = () => {
    if (fase === 'fim') return;
    const aqui = new Set(ctx.naSala());
    ficaram = new Set([...pilotos.keys()].filter((id) => aqui.has(id)));
    // O PÓDIO: com 2 ou mais que ficaram até o fim, os três primeiros que pousaram vão para a estante
    if (ficaram.size >= 2) {
      for (const l of classificacao()) {
        if (l.posicao === null || l.posicao > 3 || !l.resultado) continue;
        db.guardarTrofeu({
          userId: l.userId,
          evento,
          communityId: ctx.comunidade ?? 0,
          pista: 'planador',
          posicao: l.posicao,
          tempoMs: msDe(l.resultado.passos),
          pontos: l.resultado.total,
          rivais: [...ficaram].filter((id) => id !== l.userId),
        });
      }
    }
    fase = 'fim';
    ctx.terminar();
  };

  const conferir = () => {
    if (fase !== 'voando') return;
    const presentes = ctx.naSala();
    if (presentes.length === 0 || presentes.every((id) => !pilotos.has(id) || pilotos.get(id)!.resultado !== null)) fechar();
  };

  const largar = () => {
    fase = 'largada';
    ctx.agendar(LARGADA_MS, () => {
      fase = 'voando';
      verdeEm = agora();
      ctx.agendar(msDe(desafio.passosMaximos) + 10_000, fechar);
      ctx.avisar();
    });
  };
  if (escolhido) largar();
  // quem começou e não escolhe em um minuto: vai o primeiro
  else ctx.agendar(ESCOLHA_MS, () => {
    largar();
    ctx.avisar();
  });

  /** A posição só anda o que um voo anda: nenhum salto, e nenhum passo à frente do relógio do servidor. */
  const posicaoPossivel = (p: Piloto, n: number, x: number, y: number, h: number) => {
    if (!Number.isInteger(n) || n < 1) return false;
    if (n > ((agora() - verdeEm) * 60) / 1000 + PASSOS_DE_FOLGA) return false;
    if (h < -1 || h > 1000 || x < -2000 || y < -2000 || x > 3000 || y > 3000) return false;
    const u = p.ultima ?? { n: 0, x: desafio.x, y: desafio.y, h: desafio.h };
    if (n <= u.n) return false;
    const dx = x - u.x, dy = y - u.y, dz = h - u.h;
    const lim = ((n - u.n) * MAIS_RAPIDO) / 60 + 1;
    return dx * dx + dy * dy + dz * dz <= lim * lim;
  };

  return {
    publico: () => ({
      fase,
      solo: false,
      desafio: desafio.id,
      criadaPor,
      pilotos: classificacao(),
      partidaId: evento,
    }),
    acao(quem: number, c: Record<string, unknown>) {
      const p = pilotos.get(quem);
      if (!p) return 'Você não está neste voo.';
      if (c.tipo === 'escolher') {
        if (fase !== 'escolha') return null;
        if (quem !== criadaPor) return 'Quem começou escolhe o desafio.';
        const d = desafioPorId(c.desafio);
        if (!d) return 'Desafio desconhecido.';
        desafio = d;
        largar();
        ctx.avisar();
        return null;
      }
      if (c.tipo !== 'pouso') return 'Ação desconhecida.';
      if (fase !== 'voando') return 'O voo não está andando.';
      if (p.resultado) return null;
      const v = conferirVoo(desafio, c);
      if ('erro' in v) return v.erro;
      if (msDe(v.r.passos) > agora() - verdeEm + FOLGA_MS) return 'Voo inválido.';
      p.resultado = v.r;
      conferir();
      ctx.avisar();
      return null;
    },
    /** A posição de quem voa, conferida e carimbada com quem mandou (os outros a desenham). */
    tempoReal(quem: number, dados: unknown) {
      const p = pilotos.get(quem);
      if (!p || fase !== 'voando' || p.resultado || !dados || typeof dados !== 'object') return null;
      const { n, x, y, h, hx, hy, a, j } = dados as Record<string, unknown>;
      if (typeof n !== 'number' || typeof x !== 'number' || typeof y !== 'number' || typeof h !== 'number') return null;
      if (![x, y, h].every(Number.isFinite) || !posicaoPossivel(p, n, x, y, h)) return null;
      p.ultima = { n, x, y, h };
      // o rumo, o paraquedas aberto e o jato vão só para o desenho dos outros
      const rx = typeof hx === 'number' && Number.isFinite(hx) ? Math.max(-1, Math.min(1, hx)) : 0;
      const ry = typeof hy === 'number' && Number.isFinite(hy) ? Math.max(-1, Math.min(1, hy)) : -1;
      const r2 = (k: number) => Math.round(k * 100) / 100;
      return { userId: quem, n, x: r2(x), y: r2(y), h: r2(h), hx: r2(rx), hy: r2(ry), a: a === 1 ? 1 : 0, j: typeof j === 'number' && Number.isInteger(j) ? j & 7 : 0 };
    },
    conferir,
  };
}
