/**
 * O TAMBOR DA TURMA (05/11/2026; do The Beat Goes On do levantamento em docs/mario-party-3.md, só a mecânica): três tambores e
 * uma batida que cresce. Na sua vez, você ouve a batida inteira, repete na mesma ordem e no mesmo ritmo, e acrescenta UMA no
 * fim; aí é a vez do próximo, que repete tudo e acrescenta a dele. Errou o tambor, perdeu o ritmo ou demorou: está fora. Fica
 * quem sobrar. Sozinho, é você contra a sua própria batida.
 *
 * O RITMO É MEDIDO NA TELA DE QUEM TOCA, não pela internet: a tela manda a vez inteira de uma vez (`{ n, batidas: [{ tambor,
 * ms }] }`, ms desde a primeira batida), e o servidor confere a ordem, cada intervalo contra o da batida guardada (com
 * tolerância) e que a vez não durou mais do que ele viu passar. Só efeitos de tambor (os `tocar` do site), música nunca.
 *
 * A turma e as vezes: ver ./lote4-turma.ts.
 */
import { FOLGA_ACIMA, inteiro, microjogo, numero, type Largada, type Resultado } from './comum.js';
import { embaralhar, entrar, JUNTAR_MS } from './lote4-turma.js';

export const TAMBORES = 3;
/** O teto do jogo. */
export const TAMBOR_MS = 45000;
/** Antes da primeira batida, ao ouvir; e depois da última. */
export const OUVIR_ANTES_MS = 500;
export const OUVIR_DEPOIS_MS = 400;
/** O tempo da vez: a base, mais a batida tocada com folga. */
export const TOCAR_BASE_MS = 3500;
/** O intervalo de uma batida nova: nem colado na anterior, nem uma pausa sem fim. */
export const INTERVALO_MINIMO = 150;
export const INTERVALO_MAXIMO = 1500;
/** A tolerância do ritmo: o intervalo tocado pode errar por isto, ou pela fração do intervalo, o que for maior. */
export const TOLERANCIA_MS = 170;
export const TOLERANCIA_FRACAO = 0.3;

export interface Batida {
  tambor: number;
  /** O intervalo desde a anterior (ms); 0 na primeira. */
  gap: number;
}

export interface VistaTambor {
  etapa: 'juntando' | 'ouvir' | 'tocar' | 'fim';
  /** A batida guardada até agora. */
  batida: Batida[];
  /** A turma na ordem das vezes: as voltas que cada um fechou, e se saiu. */
  turma: { voltas: number; fora: boolean }[];
  /** De quem é a vez (posição na turma), ou -1. */
  vez: number;
  n: number;
  eu: number;
  /** Quanto falta da etapa, quando vista. */
  restaMs: number;
  /** Quanto dura a etapa inteira (para o site alinhar o "ouvir"). */
  etapaMs: number;
}

interface Pessoa {
  voltas: number;
  fora: boolean;
  saiuEm: number;
}
interface Mem {
  l: Largada<DadosTambor, Mem> | null;
  membros: number[];
  ordem: number[] | null;
  batida: Batida[];
  etapa: VistaTambor['etapa'];
  etapaDesde: number;
  etapaMs: number;
  vez: number;
  n: number;
  pessoas: Map<number, Pessoa>;
  comeco: number;
}
export interface DadosTambor {
  sorteios: number[];
}

export const duracaoDaBatida = (b: Batida[]) => b.reduce((a, x) => a + x.gap, 0);
export const ouvirMs = (b: Batida[]) => (b.length === 0 ? 0 : OUVIR_ANTES_MS + duracaoDaBatida(b) + OUVIR_DEPOIS_MS);
export const tocarMs = (b: Batida[]) => TOCAR_BASE_MS + Math.round(duracaoDaBatida(b) * 1.5) + 300 * b.length;
export const cabeNoRitmo = (tocado: number, guardado: number) => Math.abs(tocado - guardado) <= Math.max(TOLERANCIA_MS, guardado * TOLERANCIA_FRACAO);

/** A etapa, com o teto do jogo: se ela passaria do teto, o teto revela. */
function etapa(mem: Mem, e: VistaTambor['etapa'], ms: number, depois: () => void) {
  const l = mem.l!;
  mem.etapa = e;
  mem.etapaDesde = l.agora();
  mem.etapaMs = ms;
  mem.n++;
  const resta = TAMBOR_MS - (l.agora() - mem.comeco);
  if (resta <= ms) l.agendar(Math.max(0, resta), () => fim(mem));
  else l.agendar(ms, depois);
  l.avisar();
}

function fim(mem: Mem) {
  mem.etapa = 'fim';
  mem.vez = -1;
  mem.l!.revelar();
}

const ativos = (mem: Mem) => (mem.ordem ?? []).filter((id) => !mem.pessoas.get(id)!.fora);

/** A próxima vez: o seguinte que ainda toca. Com um só sobrando (havendo turma), ou ninguém, acaba. */
function proximaVez(mem: Mem) {
  const ordem = mem.ordem!;
  const vivos = ativos(mem);
  if (vivos.length === 0 || (ordem.length >= 2 && vivos.length <= 1)) return fim(mem);
  for (let k = 1; k <= ordem.length; k++) {
    const pos = (mem.vez + k) % ordem.length;
    if (!mem.pessoas.get(ordem[pos])!.fora) {
      mem.vez = pos;
      break;
    }
  }
  // primeiro todos ouvem a batida inteira; depois quem está na vez toca
  const tocar = () => {
    const pos = mem.vez;
    etapa(mem, 'tocar', tocarMs(mem.batida), () => sair(mem, pos));
  };
  if (mem.batida.length === 0) tocar();
  else etapa(mem, 'ouvir', ouvirMs(mem.batida), tocar);
}

function sair(mem: Mem, pos: number) {
  if (mem.vez !== pos || mem.etapa !== 'tocar') return;
  const p = mem.pessoas.get(mem.ordem![pos])!;
  p.fora = true;
  p.saiuEm = mem.l!.agora() - mem.comeco;
  proximaVez(mem);
}

/** A vez tocada: a ordem dos tambores, o ritmo de cada intervalo, e a batida nova no fim. */
export function conferirVez(guardada: Batida[], tocadas: unknown): Batida | null {
  if (!Array.isArray(tocadas) || tocadas.length !== guardada.length + 1) return null;
  const b: { tambor: number; ms: number }[] = [];
  for (const x of tocadas) {
    const { tambor, ms } = (x ?? {}) as Record<string, unknown>;
    if (!inteiro(tambor) || tambor < 0 || tambor >= TAMBORES || !numero(ms)) return null;
    b.push({ tambor, ms });
  }
  if (b[0].ms !== 0) return null;
  for (let k = 0; k < guardada.length; k++) {
    if (b[k].tambor !== guardada[k].tambor) return null;
    if (k > 0 && !cabeNoRitmo(b[k].ms - b[k - 1].ms, guardada[k].gap)) return null;
  }
  const L = guardada.length;
  const gap = L === 0 ? 0 : Math.round(b[L].ms - b[L - 1].ms);
  if (L > 0 && (gap < INTERVALO_MINIMO || gap > INTERVALO_MAXIMO)) return null;
  return { tambor: b[L].tambor, gap };
}

function resultadoDe(mem: Mem, id: number): Resultado {
  const p = mem.pessoas.get(id)!;
  if (p.voltas === 0) return { motivo: 'errou', valor: 0, chave: [] };
  // quem ficou até o fim na frente; depois quem saiu mais tarde
  return { motivo: null, valor: p.voltas, chave: p.fora ? [1, -p.saiuEm] : [0, -p.voltas] };
}

export default microjogo<DadosTambor, Mem>({
  id: 'tambor',
  gerar: (aleatorio) => ({ sorteios: Array.from({ length: 8 }, () => aleatorio()) }),
  duracao: () => TAMBOR_MS,
  memoria: () => ({
    l: null,
    membros: [],
    ordem: null,
    batida: [],
    etapa: 'juntando',
    etapaDesde: 0,
    etapaMs: JUNTAR_MS,
    vez: -1,
    n: 0,
    pessoas: new Map(),
    comeco: 0,
  }),
  iniciar(l) {
    const { dados, mem } = l;
    mem.l = l;
    mem.comeco = l.agora();
    etapa(mem, 'juntando', JUNTAR_MS, () => {
      mem.ordem = embaralhar(mem.membros, dados.sorteios);
      if (mem.ordem.length === 0) return l.agendar(TAMBOR_MS - JUNTAR_MS, l.revelar);
      proximaVez(mem);
    });
  },
  vista({ mem, quem }) {
    const ordem = mem.ordem ?? [];
    const v: VistaTambor = {
      etapa: mem.etapa,
      batida: mem.batida,
      turma: ordem.map((id) => ({ voltas: mem.pessoas.get(id)!.voltas, fora: mem.pessoas.get(id)!.fora })),
      vez: mem.etapa === 'ouvir' || mem.etapa === 'tocar' ? mem.vez : -1,
      n: mem.n,
      eu: ordem.indexOf(quem),
      restaMs: mem.l ? Math.max(0, mem.etapaMs - (mem.l.agora() - mem.etapaDesde)) : 0,
      etapaMs: mem.etapaMs,
    };
    return { dados: v };
  },
  acerto({ mem, quem, corpo, agora }) {
    if (corpo.entrar === 1) {
      if (mem.pessoas.has(quem)) return;
      entrar(mem.membros, quem);
      mem.pessoas.set(quem, { voltas: 0, fora: false, saiuEm: 0 });
      if (mem.ordem) mem.ordem.push(quem);
      return;
    }
    if (!mem.ordem || mem.etapa !== 'tocar' || mem.ordem[mem.vez] !== quem || corpo.n !== mem.n) return;
    const tocadas = corpo.batidas as { ms?: unknown }[] | undefined;
    const nova = conferirVez(mem.batida, tocadas);
    // a vez não pode ter durado mais do que o servidor viu passar desde que ela começou
    const ultima = Array.isArray(tocadas) ? (tocadas[tocadas.length - 1]?.ms as number) : 0;
    if (!nova || !numero(ultima) || ultima > agora - mem.etapaDesde + FOLGA_ACIMA) return sair(mem, mem.vez);
    mem.batida.push(nova);
    mem.pessoas.get(quem)!.voltas++;
    proximaVez(mem);
  },
  avaliar: ({ mem, quem }) => (mem.pessoas.has(quem) ? resultadoDe(mem, quem) : { motivo: 'invalido', valor: null, chave: [] }),
  *noFim({ mem }) {
    for (const id of mem.pessoas.keys()) yield [id, resultadoDe(mem, id)] as [number, Resultado];
  },
  robo(_dados, aleatorio, passouMs) {
    // umas voltas, de quem toca bem, no tempo que houve (com quatro na roda, uma volta a cada ~12 s)
    const voltas = Math.max(0, Math.min(Math.floor(passouMs / 9000), 1 + Math.floor(aleatorio() * 4)));
    if (voltas === 0) return { motivo: 'errou', valor: 0, chave: [] };
    return { motivo: null, valor: voltas, chave: [1, -Math.min(passouMs, voltas * 9000)] };
  },
});
