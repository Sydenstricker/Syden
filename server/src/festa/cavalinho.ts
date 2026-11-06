/**
 * CORRIDA DE CAVALINHO DE PAU (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica): cada coelho corre na
 * própria pista, montado num cavalinho de pau, alternando as duas teclas (← e →, ou os dois botões no toque). Cada passo gasta
 * FÔLEGO, que volta sozinho devagar: quem aperta rápido demais esgota e fica parado, ofegante, até recuperar. As cenouras da
 * pista devolvem um pouco de fôlego. Ganha quem chega primeiro; quem não chega, pelo quanto andou.
 *
 * O SERVIDOR REFAZ A CORRIDA: os passos vão em lotes (a ação 'acerto' com `p`, uma lista de [t, lado]), e cada um só vale se
 * o instante dele couber no que o servidor viu (o lote espera no máximo LOTE_MS na tela) e se vier depois do anterior com o
 * intervalo de um dedo de gente. A conta do fôlego (`correr`) é só + − × ÷ e comparação, e a tela roda a mesma.
 */
import { FOLGA_ACIMA, inteiro, microjogo, numero, type Resultado } from './comum.js';

export const CAVALINHO_MS = 20000;
/** Quantos passos até a chegada. */
export const META = 60;
/** As cenouras: em que passo da pista estão. */
export const CENOURAS = [16, 32, 46];
export const FOLEGO = 100;
/**
 * O que cada passo gasta: um tanto fixo, mais um tanto que cresce quanto mais apressado ele vem (o ritmo cansa menos que a
 * afobação). E o que volta por ms.
 */
export const CUSTO_DO_PASSO = 3;
export const CUSTO_DA_PRESSA = 700;
export const VOLTA_POR_MS = 0.02;
/** O que uma cenoura devolve. */
export const FOLEGO_DA_CENOURA = 35;
/** Esgotado, o cavalinho só anda de novo quando o fôlego voltar a isto. */
export const FOLEGO_PARA_VOLTAR = 70;
/** Menos que isto entre dois passos não é dedo de gente. */
export const INTERVALO_MINIMO = 55;
/** Quanto a tela segura os passos antes de mandar o lote (o servidor aceita um passo até este tanto, mais a rede, atrás). */
export const LOTE_MS = 500;

export interface Corrida {
  /** Os passos que contaram. */
  andou: number;
  /** O instante do passo que cruzou a chegada, ou null. */
  chegada: number | null;
  folego: number;
  cansado: boolean;
  /** O instante do último passo considerado (para o fôlego seguir voltando). */
  ultimo: number;
  /** O lado do último passo que contou (0 ←, 1 →), ou −1. */
  lado: number;
  /** O instante do último passo que contou (a pressa conta dele), ou null. */
  passouEm: number | null;
}

export const corridaNova = (): Corrida => ({ andou: 0, chegada: null, folego: FOLEGO, cansado: false, ultimo: 0, lado: -1, passouEm: null });

/** O que custa um passo no instante t, depois do anterior. */
export const custoDoPasso = (c: Corrida, t: number) =>
  CUSTO_DO_PASSO + CUSTO_DA_PRESSA / Math.max(INTERVALO_MINIMO, c.passouEm === null ? 1000 : t - c.passouEm);

/** O fôlego no instante t, sem passo nenhum depois do último (o que volta sozinho). */
export const folegoEm = (c: Corrida, t: number) => Math.min(FOLEGO, c.folego + (t - c.ultimo) * VOLTA_POR_MS);

/**
 * UM PASSO no instante t, do lado dado (0 ←, 1 →): a mesma conta na tela e no servidor. O passo do mesmo lado de novo não
 * conta (o cavalinho só anda alternando), nem o passo cansado. Muda a corrida no lugar.
 */
export function passo(c: Corrida, t: number, lado: number) {
  if (c.chegada !== null) return;
  c.folego = folegoEm(c, t);
  c.ultimo = t;
  if (c.cansado) {
    if (c.folego < FOLEGO_PARA_VOLTAR) return;
    c.cansado = false;
  }
  if (lado === c.lado) return;
  c.lado = lado;
  c.folego -= custoDoPasso(c, t);
  c.passouEm = t;
  if (c.folego <= 0) {
    c.folego = 0;
    c.cansado = true;
    return;
  }
  c.andou++;
  if (CENOURAS.includes(c.andou)) c.folego = Math.min(FOLEGO, c.folego + FOLEGO_DA_CENOURA);
  if (c.andou >= META) c.chegada = t;
}

/** A corrida inteira, de uma lista de passos [t, lado] em ordem. */
export function correr(passos: [number, number][]): Corrida {
  const c = corridaNova();
  for (const [t, lado] of passos) passo(c, t, lado);
  return c;
}

/** Chegou: o tempo (menos é melhor). Não chegou: quanto andou. Os dois cabem no `valor`: o tempo é sempre de 1 s para cima. */
const pelaCorrida = (c: Corrida): Resultado => {
  if (c.chegada !== null) return { motivo: null, valor: Math.max(1000, Math.round(c.chegada)), chave: [0, c.chegada] };
  if (c.andou === 0) return { motivo: 'errou', valor: 0, chave: [] };
  return { motivo: null, valor: c.andou, chave: [1, -c.andou] };
};

type Mem = Map<number, [number, number][]>;

export default microjogo<Record<string, never>, Mem>({
  id: 'cavalinho',
  gerar: () => ({}),
  duracao: () => CAVALINHO_MS + 1500,
  memoria: () => new Map(),
  acerto({ mem, quem, corpo, passou, abaixo }) {
    const lote = corpo.p;
    if (!Array.isArray(lote) || lote.length > 40) return;
    const meus = mem.get(quem) ?? [];
    for (const item of lote) {
      if (!Array.isArray(item) || item.length !== 2) return;
      const [t, lado] = item;
      if (!numero(t) || !inteiro(lado) || (lado !== 0 && lado !== 1)) return;
      // o passo é de agora (o lote espera no máximo LOTE_MS na tela), e vem depois do anterior
      if (t < 0 || t > CAVALINHO_MS || t > passou + FOLGA_ACIMA || t < passou - abaixo - LOTE_MS) continue;
      const antes = meus[meus.length - 1];
      if (antes && t < antes[0] + INTERVALO_MINIMO) continue;
      meus.push([Math.round(t), lado]);
    }
    mem.set(quem, meus);
  },
  avaliar: ({ mem, quem }) => pelaCorrida(correr(mem.get(quem) ?? [])),
  *noFim({ mem }) {
    for (const [quem, passos] of mem) yield [quem, pelaCorrida(correr(passos))] as [number, Resultado];
  },
  robo(_d, aleatorio, passouMs) {
    // um ritmo de quem joga bem: perto do que o fôlego aguenta, com uma ou outra afobação
    const ms = 11500 + Math.round(aleatorio() * 5000);
    if (ms <= passouMs) return pelaCorrida({ ...corridaNova(), andou: META, chegada: ms });
    const andou = Math.max(1, Math.min(META - 1, Math.floor((META * passouMs) / ms)));
    return pelaCorrida({ ...corridaNova(), andou });
  },
});
