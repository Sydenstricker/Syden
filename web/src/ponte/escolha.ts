/**
 * A ESCOLHA DA FASE DA PONTE (20/11/2026, a segunda auditoria dos mini-games): a marca de dificuldade de cada fase e a última
 * ponte de cada fase, lembrada NO APARELHO (o "Jogar de novo" do Solo começa dela). A regra (ponte/sim.ts) não muda: ela mora em
 * duas cópias iguais, e a dificuldade é só para a tela.
 */
import { conferir, faseDe, FASES } from './sim';

/**
 * De 1 a 3, pelo vão, o peso do tráfego, os apoios e o barco (medido a olho contra as pontes de referência: as fáceis passam com
 * pouca peça, as difíceis pedem aço ou levadiça). Fase nova precisa da linha dela (web/test/ponte.test.ts cobra).
 */
export const DIFICULDADE_DAS_FASES: Readonly<Record<string, 1 | 2 | 3>> = {
  riacho: 1,
  rio: 1,
  arroio: 1,
  ravina: 2,
  pilares: 2,
  lagoa: 2,
  cascata: 2,
  brejo: 2,
  ilhas: 2,
  enchente: 2,
  canal: 2,
  pedra: 3,
  garganta: 3,
  torres: 3,
  vale: 3,
  grande: 3,
  porto: 3,
};

export const dificuldadeDaFase = (id: string): 1 | 2 | 3 => DIFICULDADE_DAS_FASES[id] ?? 2;

const CHAVE = (fase: string) => `syden:ponte:${fase}`;

/** A última ponte desta fase neste aparelho, só se ainda vale pela regra de hoje (senão, nada). */
export function lerPonteGuardada(fase: string): number[] | null {
  const f = faseDe(fase);
  if (!f) return null;
  try {
    const bruto = localStorage.getItem(CHAVE(fase));
    if (!bruto) return null;
    const lista: unknown = JSON.parse(bruto);
    if (conferir(f, lista) !== null) return null;
    return (lista as number[]).length ? (lista as number[]) : null;
  } catch {
    return null;
  }
}

/** Guarda a ponte mandada (sem armazenamento, só não lembra). */
export function guardarPonte(fase: string, pecas: readonly number[]) {
  if (!pecas.length) return;
  try {
    localStorage.setItem(CHAVE(fase), JSON.stringify(pecas));
  } catch {
    // sem armazenamento: só não lembra
  }
}

/** Para o teste: todas as fases têm a marca. */
export const fasesSemDificuldade = () => FASES.filter((f) => !(f.id in DIFICULDADE_DAS_FASES)).map((f) => f.id);
