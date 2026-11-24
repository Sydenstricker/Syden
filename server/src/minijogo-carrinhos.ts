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
 * AS PISTAS (19/11/2026): cinco traçados prontos (TRACADOS em carrinhos-sim.ts) e os do EDITOR, que chegam como o código de
 * texto ("SYDP1-…") e são conferidos aqui com a mesma função do site (`pistaPedida` → `validarTracado`): o que não fecha, se
 * cruza, é curto ou tem cruzamentos ímpares, não corre. Cinco voltas ou a RESISTÊNCIA (vinte).
 *
 * NO SOLO (ctx.solo), contra o relógio, sempre na faixa do recorde (FAIXA_DO_RECORDE: os tempos se comparam), com até 3
 * fantasmas (o meu e os dos AMIGOS ACEITOS, a regra do kart) e de 0 a 3 robôs nas outras faixas (os robôs são do site: o
 * resultado deles não vem ao servidor nem conta em nada). O melhor tempo vira o recorde (carrinhos_recordes), um por pista e
 * número de voltas (`chaveDoRecorde`).
 *
 * NA SALA (2 a 4), cada um na sua faixa, pela ordem de quem aceitou, na pista e no número de voltas de quem convidou: o
 * servidor dá o verde, repassa as posições (a distância na faixa e se o carro está fora) e classifica pelo tempo de cada um,
 * refeito. A primeira chegada abre 30 s para os outros. A corrida da sala NÃO vira recorde: a faixa é outra. O pódio vai
 * para a estante de troféus (pista 'carrinhos').
 */
import * as db from './db.js';
import {
  codigoDaPista,
  entradasValidas,
  FAIXA_DO_RECORDE,
  FAIXAS,
  IDS_DAS_PISTAS,
  parceiraDa,
  PISTA_PADRAO,
  PISTAS,
  pistaPedida,
  refazer,
  VMAX,
  VOLTAS,
  VOLTAS_DA_RESISTENCIA,
  sufixoDasVoltas,
  type Pista,
} from './carrinhos-sim.js';
import type { Definicao } from './minijogo-motor.js';

export const PISTA_DOS_CARRINHOS = 'toca-1';
export const LARGADA_MS = 4000;
export const PRAZO_MS = 30_000;
/** A corrida da sala: 4 minutos em cinco voltas, 16 na resistência. */
const corridaMs = (voltas: number) => (voltas === VOLTAS ? 4 : 16) * 60_000;
const SOLO_PARADO_MS = 30 * 60_000;
export const FOLGA_MS = 3000;
const PASSOS_DE_FOLGA = 180;
export const MAX_FANTASMAS = 3;
export const MAX_ROBOS = FAIXAS - 1;

const tempoDe = (passos: number) => Math.round((passos * 1000) / 60);

/** A RESISTÊNCIA (19/11/2026): vinte voltas em vez de cinco; o recorde é outro. */
export const voltasPedidas = (v: unknown) => (v === VOLTAS_DA_RESISTENCIA ? VOLTAS_DA_RESISTENCIA : VOLTAS);

/**
 * A chave do recorde em carrinhos_recordes: o id da pista pronta, ou o CÓDIGO da pista do editor (o texto inteiro: quem tem o
 * código corre a mesma pista, e o recorde de um amigo nela aparece como nas prontas); com '@20c' na resistência (com o combustível, 21/11/2026; o '@20' de antes fica guardado, sem ser oferecido). A Toca em
 * cinco voltas é 'toca-1', a chave de antes: os recordes de antes continuam valendo.
 */
export const chaveDoRecorde = (pista: Pista, voltas: number) =>
  (PISTAS[pista.id] === pista ? pista.id : codigoDaPista(pista.tracado)) + sufixoDasVoltas(voltas);

/** Refaz a corrida pelas entradas; erro se não chegou. */
function conferirCorrida(pista: Pista, voltas: number, faixa: number, corpo: Record<string, unknown>): { erro: string } | { passos: number; voltas: number[]; entradas: number[]; saidas: number } {
  if (!entradasValidas(corpo.entradas)) return { erro: 'Corrida inválida.' };
  const c = refazer(faixa, corpo.entradas, pista, voltas);
  if (!c.chegou) return { erro: 'Corrida inválida.' };
  return { passos: c.voltas[voltas - 1], voltas: c.voltas, entradas: corpo.entradas, saidas: c.saidas };
}

export const carrinhos: Definicao = criarCarrinhos();

/** `agora` é trocável para o teste. */
export function criarCarrinhos(agora: () => number = Date.now): Definicao {
  return {
    minimo: 2,
    maximo: FAIXAS,
    comecar(ctx, { naSala, corpo }) {
      if (ctx.solo) return solo(ctx, naSala[0], agora);
      const pista = pistaPedida(corpo.pista, corpo.codigo);
      if (!pista) return 'Pista inválida.';
      return sala(ctx, naSala, pista, voltasPedidas(corpo.voltas), agora);
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
  let pista: Pista = PISTA_PADRAO;
  let voltas = VOLTAS;
  let fantasmas: { userId: number; nome: string; avatar: number | string | null; tempoMs: number; entradas: number[] }[] = [];
  let resultado: { tempoMs: number; voltas: number[]; saidas: number; recorde: boolean; anterior: number | null } | null = null;
  const evento = `carrinhos-solo-${eu}-${agora()}`;
  const parado = () => ctx.agendar(SOLO_PARADO_MS, () => ctx.terminar(false));
  parado();

  /** Troca a pista e as voltas pelo pedido; erro se a pista não vale (o que não veio, fica). */
  const escolher = (c: Record<string, unknown>): string | null => {
    if (c.pista !== undefined || c.codigo !== undefined) {
      const p = pistaPedida(c.pista, c.codigo);
      if (!p) return 'Pista inválida.';
      pista = p;
    }
    if (c.voltas !== undefined) voltas = voltasPedidas(c.voltas);
    return null;
  };

  return {
    publico: () => {
      // os meus tempos em cada pista pronta (nas cinco e nas vinte voltas), para a escolha mostrar
      const meus: Record<string, number> = {};
      for (const id of IDS_DAS_PISTAS) {
        for (const n of [VOLTAS, VOLTAS_DA_RESISTENCIA]) {
          const chave = chaveDoRecorde(PISTAS[id], n);
          const r = db.recordeDosCarrinhos(eu, chave);
          if (r) meus[chave] = r.tempoMs;
        }
      }
      return {
        fase,
        solo: true,
        voltasDaCorrida: voltas,
        pista: pista.id,
        tracado: pista.tracado,
        recordes: db
          .recordesDosCarrinhos(eu, chaveDoRecorde(pista, voltas))
          .map(({ userId, username, nomeDeExibicao, avatarPronto, tempoMs }) => ({ userId, nome: nomeDeExibicao || username, avatar: avatarPronto, tempoMs })),
        meusTempos: meus,
        meuAvatar: db.avatarDoJogo(eu),
        meuNome: ctx.nome(eu),
        fantasmas: fase === 'correndo' ? fantasmas : [],
        robos,
        rodada,
        resultado,
        partidaId: evento,
      };
    },
    acao(quem: number, c: Record<string, unknown>) {
      if (quem !== eu) return 'Você está assistindo esta partida.';
      parado();
      if (c.tipo === 'escolher') {
        if (fase === 'correndo') return 'A corrida está andando.';
        const erro = escolher(c);
        if (erro) return erro;
        fase = 'escolha';
        resultado = null;
        ctx.avisar();
        return null;
      }
      if (c.tipo === 'correr') {
        if (fase === 'correndo') return 'A corrida está andando.';
        const erro = escolher(c);
        if (erro) return erro;
        robos = Number.isInteger(c.robos) ? Math.max(0, Math.min(MAX_ROBOS, c.robos as number)) : 0;
        // os fantasmas: o meu e os dos amigos aceitos (sem bloqueio), no máximo três; o que não pode, some calado
        const pedidos = Array.isArray(c.fantasmas)
          ? [...new Set(c.fantasmas.filter((id): id is number => Number.isInteger(id) && (id as number) > 0))].slice(0, MAX_FANTASMAS)
          : [];
        const chave = chaveDoRecorde(pista, voltas);
        fantasmas = [];
        for (const id of pedidos) {
          if (id !== eu && (db.amizadeEntre(eu, id)?.situacao !== 'aceita' || db.haBloqueio(eu, id))) continue;
          const r = db.recordeDosCarrinhos(id, chave);
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
        const v = conferirCorrida(pista, voltas, FAIXA_DO_RECORDE, c);
        if ('erro' in v) return v.erro;
        const tempoMs = tempoDe(v.passos);
        // o tempo não passa do que de fato passou desde que a corrida começou (a contagem fica de folga)
        if (tempoMs > agora() - correuEm + FOLGA_MS) return 'Corrida inválida.';
        const r = db.guardarCarrinhos(eu, chaveDoRecorde(pista, voltas), tempoMs, v.voltas, JSON.stringify(v.entradas));
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
  /** A faixa da largada (a corrida é refeita a partir dela). */
  faixa: number;
  /** A faixa de agora, pelas posições (a troca de faixa, 24/11/2026, muda na agulha): só para conferir e repassar. */
  agora: number;
  tempoMs: number | null;
  voltas: number[];
  andou: number;
  ultima: { n: number; s: number; em: number } | null;
}

function sala(ctx: Parameters<Definicao['comecar']>[0], naSala: number[], pista: Pista, voltas: number, agora: () => number) {
  const evento = `carrinhos-${ctx.comunidade ?? 0}-${agora()}`;
  let fase: 'largada' | 'correndo' | 'fim' = 'largada';
  let verdeEm = 0;
  let prazoAberto = false;
  const inscritos = naSala.slice(0, FAIXAS);
  const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
  const pilotos = new Map<number, Piloto>(inscritos.map((id, i) => [id, { faixa: i, agora: i, tempoMs: null, voltas: [], andou: 0, ultima: null }]));
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
    ctx.agendar(corridaMs(voltas), fechar);
    ctx.avisar();
  });

  /**
   * O carro só anda o que a reta deixa: nenhum salto, e nenhum passo à frente do relógio do servidor. Na troca de faixa (só na
   * outra faixa da fileira e só numa pista com agulha), a distância passa a ser a da faixa nova: o salto não é conferido ali.
   */
  const temAgulha = pista.trechos[0].some((t) => t.troca);
  const posicaoPossivel = (p: Piloto, n: number, s: number, faixa: number) => {
    if (!Number.isInteger(n) || n < 1) return false;
    if (n > ((agora() - verdeEm) * 60) / 1000 + PASSOS_DE_FOLGA) return false;
    if (faixa !== p.agora && (!temAgulha || faixa !== parceiraDa(p.agora))) return false;
    if (s < 0 || s > voltas * pista.volta[faixa] + 12) return false;
    const u = p.ultima ?? { n: 0, s: 0 };
    if (n <= u.n) return false;
    if (faixa !== p.agora) return true;
    return s >= u.s - 0.01 && s - u.s <= ((n - u.n) * VMAX) / 60 + 0.5;
  };

  return {
    publico: () => ({
      fase,
      solo: false,
      voltasDaCorrida: voltas,
      pista: pista.id,
      tracado: pista.tracado,
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
      const v = conferirCorrida(pista, voltas, p.faixa, c);
      if ('erro' in v) return v.erro;
      const tempoMs = tempoDe(v.passos);
      if (tempoMs > agora() - verdeEm + FOLGA_MS) return 'Corrida inválida.';
      p.tempoMs = tempoMs;
      p.voltas = v.voltas.map(tempoDe);
      p.andou = voltas * pista.volta[p.faixa];
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
      const { n, s, f, d, x, e } = dados as Record<string, unknown>;
      if (typeof n !== 'number' || typeof s !== 'number' || !Number.isFinite(s)) return null;
      const faixa = x === undefined ? p.agora : x;
      if (typeof faixa !== 'number' || !Number.isInteger(faixa)) return null;
      if (!posicaoPossivel(p, n, s, faixa)) return null;
      p.agora = faixa;
      // `andou` em voltas da faixa da largada, para comparar quem trocou com quem não trocou
      if (p.tempoMs === null) p.andou = (s / pista.volta[faixa]) * pista.volta[p.faixa];
      p.ultima = { n, s, em: agora() };
      // fora da pista e a derrapagem vão só para o desenho dos outros
      const fora = f === 1 ? 1 : 0;
      const derrapa = typeof d === 'number' && Number.isFinite(d) ? Math.max(0, Math.min(1, Math.round(d * 10) / 10)) : 0;
      const de = e === parceiraDa(faixa) ? e : -1;
      return { userId: quem, n, s: Math.round(s * 1000) / 1000, f: fora, d: derrapa, x: faixa, e: temAgulha ? de : -1 };
    },
    conferir,
  };
}

export { FAIXA_DO_RECORDE };
