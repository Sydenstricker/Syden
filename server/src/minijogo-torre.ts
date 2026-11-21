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
 *
 * A COPA DO CELEIRO (20/11/2026, o lote C da segunda auditoria), só na sala: as cinco torres seguidas, como a Copa do Pulo,
 * com 10 s de placar entre uma e outra. A ordem da copa é a de quem subiu MAIS torres, e entre esses a SOMA DOS TEMPOS menor;
 * o pódio dela (pista 'copa-do-celeiro', o tempo é a soma) é só de quem subiu as cinco e ficou até o fim.
 */
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';
import { comPosicoes, RECOMECO_PASSOS } from './minijogo-plataforma.js';
import { COPA_DO_CELEIRO, TORRE_PADRAO, TORRES_DA_COPA, TORRES_DO_CELEIRO, validarTorre } from './torre.js';

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

/** A Copa do Celeiro mora em torre.ts (o site a confere sem abrir o banco); aqui, os nomes de sempre. */
export { COPA_DO_CELEIRO, TORRES_DA_COPA };
/** O placar entre uma torre e outra da copa. */
export const INTERVALO_MS = 10_000;

export const torre: Definicao = criarTorre();

/** `agora` é trocável para o teste. */
export function criarTorre(agora: () => number = Date.now): Definicao {
  return {
    minimo: 2,
    maximo: MAXIMO,
    comecar(ctx, { naSala, corpo }) {
      const pedida = typeof corpo.pista === 'string' ? corpo.pista : typeof corpo.categoria === 'string' ? corpo.categoria : TORRE_PADRAO;
      if (!ctx.solo && pedida === COPA_DO_CELEIRO) return sala(ctx, naSala, TORRES_DA_COPA, agora, true);
      const id = TORRES_DO_CELEIRO[pedida] ? pedida : TORRE_PADRAO;
      return ctx.solo ? solo(ctx, naSala[0], id, agora) : sala(ctx, naSala, [id], agora, false);
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
        // no meio da subida também (20/11/2026: o "Sair" da pausa): a subida que estava andando só não conta
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


/**
 * A sala: uma torre (`torres` com uma só) ou a Copa do Celeiro (as cinco, `copa`). Cada torre é uma subida com a largada,
 * o prazo depois da primeira chegada e a classificação de sempre; na copa, entre uma e outra, o placar fica 10 s.
 */
function sala(ctx: Ctx, naSala: number[], torres: string[], agora: () => number, copa: boolean) {
  const evento = `torre-${ctx.comunidade ?? 0}-${agora()}`;
  let indice = 0;
  let fase: 'largada' | 'correndo' | 'intervalo' | 'fim' = 'largada';
  let verdeEm = 0;
  let prazoAberto = false;
  const inscritos = [...naSala];
  const avatares = new Map(inscritos.map((u) => [u, db.avatarDoJogo(u)]));
  const def = () => TORRES_DO_CELEIRO[torres[indice]];
  let subindo = new Map<number, Subindo>();
  /** Quem estava na sala ao fechar a torre de agora (null enquanto ela corre: aí contam os presentes). */
  let ficaram: Set<number> | null = null;
  /** Na copa: quem subiu todas as torres até aqui, presente; quantas torres cada um subiu, e a soma dos tempos. */
  let correramTodas: Set<number> | null = null;
  const feitas = new Map<number, number>(inscritos.map((u) => [u, 0]));
  const somas = new Map<number, number>(inscritos.map((u) => [u, 0]));
  let ultima: { userId: number; username: string; tempoMs: number | null; posicao: number | null }[] | null = null;

  const naFrente = (o: { tempoMs: number | null; andou: number }, l: { tempoMs: number | null; andou: number }) =>
    o.tempoMs !== null && l.tempoMs !== null ? o.tempoMs < l.tempoMs : o.tempoMs !== null ? true : l.tempoMs === null && o.andou > l.andou;

  const classificacao = () => {
    const linhas = [...subindo.entries()]
      .map(([userId, s]) => ({ userId, username: ctx.nome(userId), tempoMs: s.tempoMs, andou: s.andou }))
      .sort((a, b) => (naFrente(a, b) ? -1 : naFrente(b, a) ? 1 : 0));
    return comPosicoes(linhas, ficaram ?? new Set(ctx.naSala()), naFrente);
  };

  /** Na copa: quem subiu mais torres fica na frente; empatados, a soma menor dos tempos. */
  const naFrenteNaCopa = (o: { feitas: number; soma: number }, l: { feitas: number; soma: number }) =>
    o.feitas > l.feitas || (o.feitas === l.feitas && o.soma < l.soma);
  const placarDaCopa = () => {
    const linhas = inscritos
      .map((userId) => ({ userId, username: ctx.nome(userId), feitas: feitas.get(userId) ?? 0, soma: somas.get(userId) ?? 0 }))
      .sort((a, b) => (naFrenteNaCopa(a, b) ? -1 : naFrenteNaCopa(b, a) ? 1 : a.username.localeCompare(b.username)));
    return comPosicoes(linhas, correramTodas ?? new Set(ctx.naSala()), naFrenteNaCopa);
  };

  const trofeu = (userId: number, posicao: number, tempoMs: number, pista: string, rivais: number[]) =>
    db.guardarTrofeu({ userId, evento, communityId: ctx.comunidade ?? 0, pista, posicao, tempoMs, pontos: null, rivais: rivais.filter((u) => u !== userId) });

  const largar = () => {
    const presentes = ctx.naSala().filter((u) => inscritos.includes(u));
    subindo = new Map(presentes.map((u) => [u, { tempoMs: null, andou: 0, maiorN: 0, refY: def().largada[1], refN: 0, recomecou: false }]));
    ficaram = null;
    fase = 'largada';
    prazoAberto = false;
    ctx.agendar(LARGADA_MS, () => {
      fase = 'correndo';
      verdeEm = agora();
      ctx.agendar(SUBIDA_MS, fechar);
      ctx.avisar();
    });
  };

  const fechar = () => {
    if (fase !== 'correndo' && fase !== 'largada') return;
    const aqui = new Set(ctx.naSala());
    ficaram = new Set([...subindo.keys()].filter((u) => aqui.has(u)));
    const ordem = classificacao();
    ultima = ordem.map(({ userId, username, tempoMs, posicao }) => ({ userId, username, tempoMs, posicao }));
    if (!copa) {
      // O PÓDIO: com 2 ou mais que ficaram até o fim, os três primeiros que chegaram de verdade vão para a estante
      if (ficaram.size >= 2) {
        for (const l of ordem) {
          if (l.posicao === null || l.posicao > 3 || l.tempoMs === null) continue;
          trofeu(l.userId, l.posicao, l.tempoMs, 'torre', [...ficaram]);
        }
      }
      fase = 'fim';
      ctx.terminar();
      return;
    }
    const nesta = ficaram;
    correramTodas = correramTodas === null ? nesta : new Set([...correramTodas].filter((u) => nesta.has(u)));
    for (const l of ordem) {
      if (l.tempoMs === null) continue;
      feitas.set(l.userId, (feitas.get(l.userId) ?? 0) + 1);
      somas.set(l.userId, (somas.get(l.userId) ?? 0) + l.tempoMs);
    }
    if (indice < torres.length - 1) {
      fase = 'intervalo';
      ctx.agendar(INTERVALO_MS, () => {
        indice++;
        largar();
        ctx.avisar();
      });
      ctx.avisar();
      return;
    }
    // O PÓDIO DA COPA: com 2 ou mais que subiram tudo até o fim, os três primeiros que subiram as cinco torres
    const placar = placarDaCopa();
    const ficou = placar.filter((l) => l.posicao !== null);
    if (ficou.length >= 2) {
      for (const l of ficou) {
        if (l.posicao === null || l.posicao > 3 || l.feitas < torres.length) continue;
        trofeu(l.userId, l.posicao, l.soma, COPA_DO_CELEIRO, ficou.map((x) => x.userId));
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

  largar();

  const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const progresso = (y: number) => {
    const d = def();
    return Math.round(Math.max(0, Math.min(1, (d.largada[1] - y) / (d.largada[1] - d.chegada))) * 1000) / 1000;
  };

  return {
    publico: () => ({
      fase,
      solo: false,
      pista: torres[indice],
      // o "Jogar de novo" do painel manda a categoria de volta: a mesma torre, ou a copa
      categoria: copa ? COPA_DO_CELEIRO : torres[0],
      copa,
      corrida: indice + 1,
      corridas: torres.length,
      pilotos: classificacao().map(({ userId, username, tempoMs, posicao }) => ({ userId, username, tempoMs, posicao, avatar: avatares.get(userId) ?? null })),
      placarDaCopa: copa ? placarDaCopa().map(({ userId, username, feitas: f, soma, posicao }) => ({ userId, username, feitas: f, soma, posicao })) : null,
      ultima,
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
      const v = validarTorre(torres[indice], c);
      if ('erro' in v) return v.erro;
      if (v.ok.tempoMs > agora() - verdeEm + FOLGA_MS) return 'Subida inválida.';
      s.tempoMs = v.ok.tempoMs;
      s.andou = 1;
      // sem itens, a subida da sala vale como a do Solo: o melhor tempo vira o recorde
      db.guardarTorre(quem, torres[indice], v.ok.tempoMs, JSON.stringify(v.ok.amostras));
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
      const d = def();
      const passoMaximo = ((agora() - verdeEm) * 60) / 1000 + PASSOS_DE_FOLGA;
      if (x < 0 || x > d.largura || y < -64 || y > d.altura || n < 0 || n > passoMaximo || ![-2, -1, 1, 2].includes(j)) return null;
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
