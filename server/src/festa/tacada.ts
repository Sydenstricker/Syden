/**
 * UMA TACADA SÓ (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica): uma mesa de minigolfe vista de cima, e
 * cada um dá UMA tacada, em DOIS apertos: a seta da mira vai e volta (o primeiro aperto a prende), depois a barra de força sobe
 * e desce (o segundo aperto dá a tacada). Ganha quem parar mais perto da toca; entrar é zero, e a água devolve a bola ao
 * começo (longe de tudo).
 *
 * A FÍSICA É A DO MINIGOLFE DA TOCA (../golfe-fisica.ts, só importada): o servidor refaz a tacada inteira, e a distância é a
 * dele. NADA do vetor vem do site: a mira sai do instante do primeiro aperto (a ação 'acerto', conferida na hora pelo `cabe`)
 * e a força do instante do segundo (o 'resultado'), pelas mesmas ondas triangulares que a tela desenha. A direção é girada
 * sem seno nem cosseno (a parametrização racional do círculo), e as contas são só + − × ÷, Math.sqrt e Math.round.
 */
import { bater, novaBola, rolarAteParar, type Buraco } from '../golfe-fisica.js';
import { invalido, microjogo, numero, type Resultado } from './comum.js';

/** Quanto a tacada pode esperar: depois disso, ela não sai mais. */
export const TACADA_MS = 12000;
/** A força mais fraca e a mais forte da barra (abaixo do FORCA_MAX da física, para o arredondamento nunca passar dele). */
export const TACADA_FORCA_MIN = 60;
export const TACADA_FORCA_MAX = 990;
/** Até onde a seta da mira vai para cada lado (o parâmetro da parametrização racional: 0,22 são uns 25°). */
export const TACADA_MIRA = 0.22;
/** O segundo aperto precisa deste tempo depois do primeiro (menos que isto é a mesma batida do dedo). */
export const TACADA_ENTRE_MS = 150;

/** AS TRÊS MESAS, no formato da física do Minigolfe (192 × 128). O começo é sempre à esquerda. */
export const MESAS_DA_TACADA: Buraco[] = [
  {
    // a reta: dois canteiros de areia dos lados, e o lago logo depois da toca (passar da conta é voltar ao começo)
    tema: 'jardim',
    par: 1,
    inicio: [30, 64],
    buraco: [112, 64],
    contorno: [12, 26, 180, 26, 180, 102, 12, 102],
    blocos: [],
    pinos: [],
    areia: [[78, 30, 16, 18], [78, 82, 16, 18]],
    agua: [[128, 26, 52, 76]],
    movel: null,
  },
  {
    // a passagem: o lago corta a mesa, com um vão estreito no meio, e a toca do outro lado
    tema: 'lago',
    par: 1,
    inicio: [30, 66],
    buraco: [118, 66],
    contorno: [12, 20, 180, 20, 180, 108, 12, 108],
    blocos: [],
    pinos: [],
    areia: [],
    agua: [
      [70, 20, 22, 39],
      [70, 73, 22, 35],
      [140, 20, 40, 88],
    ],
    movel: null,
  },
  {
    // o cogumelo: ele está bem no caminho, e a toca fica atrás dele, no alto
    tema: 'horta',
    par: 1,
    inicio: [28, 90],
    buraco: [156, 42],
    contorno: [12, 22, 180, 22, 180, 108, 12, 108],
    blocos: [],
    pinos: [[96, 66, 7]],
    areia: [[132, 86, 22, 18]],
    agua: [],
    movel: null,
  },
];

export interface DadosTacada {
  /** A mesa (uma das MESAS_DA_TACADA), inteira: ela vai pronta ao site, que a desenha e refaz a tacada. */
  mesa: Buraco;
  /** Uma ida e volta da seta da mira, em ms. */
  periodoMiraMs: number;
  /** Uma ida e volta da barra de força (fraca → forte → fraca), em ms. */
  periodoMs: number;
}

/** Uma onda triangular no instante t: 0 → 1 → 0 num período. */
export function onda(periodoMs: number, t: number): number {
  const fase = (((t % periodoMs) + periodoMs) % periodoMs) / periodoMs;
  return 1 - Math.abs(fase * 2 - 1);
}

/** A seta da mira no instante t: o parâmetro de −TACADA_MIRA a +TACADA_MIRA (começa no meio, indo para um lado). */
export const miraDaTacada = (periodoMs: number, t: number) => TACADA_MIRA * (2 * onda(periodoMs, t + periodoMs / 4) - 1);

/** A direção (unitária) da mira u: a direção do começo à toca, girada pela parametrização racional do círculo. */
export function direcaoDaTacada(b: Buraco, u: number): { x: number; y: number } {
  const bx = b.buraco[0] - b.inicio[0];
  const by = b.buraco[1] - b.inicio[1];
  const l = Math.sqrt(bx * bx + by * by);
  const c = (1 - u * u) / (1 + u * u);
  const s = (2 * u) / (1 + u * u);
  return { x: (bx / l) * c - (by / l) * s, y: (bx / l) * s + (by / l) * c };
}

/** O vetor da tacada (inteiros, como a física pede): a mira do primeiro aperto e a força do segundo. */
export function vetorDaTacada(d: DadosTacada, tMira: number, tForca: number): { dx: number; dy: number } {
  const dir = direcaoDaTacada(d.mesa, miraDaTacada(d.periodoMiraMs, tMira));
  const forca = TACADA_FORCA_MIN + (TACADA_FORCA_MAX - TACADA_FORCA_MIN) * onda(d.periodoMs, tForca - tMira);
  return { dx: Math.round(dir.x * forca), dy: Math.round(dir.y * forca) };
}

/** Onde a bola para (a simulação inteira) e a distância até a toca: 0 se entrou. */
export function tacadaDa(d: DadosTacada, tMira: number, tForca: number) {
  const b = d.mesa;
  const bola = novaBola(b);
  bater(bola, { passo: 0, ...vetorDaTacada(d, tMira, tForca) });
  rolarAteParar(b, bola);
  const dx = bola.x - b.buraco[0];
  const dy = bola.y - b.buraco[1];
  return { x: bola.x, y: bola.y, dentro: bola.dentro, molhou: bola.tacadas > 1, distancia: bola.dentro ? 0 : Math.sqrt(dx * dx + dy * dy) };
}

const pelaDistancia = (d: number, t: number): Resultado => {
  const v = Math.round(d);
  return { motivo: null, valor: v, chave: [v, t] };
};

/** A mira de cada um (o instante do primeiro aperto). */
type Mem = Map<number, number>;

export default microjogo<DadosTacada, Mem>({
  id: 'tacada',
  gerar: (aleatorio) => ({
    mesa: MESAS_DA_TACADA[Math.floor(aleatorio() * MESAS_DA_TACADA.length)],
    periodoMiraMs: 2200 + Math.floor(aleatorio() * 600),
    periodoMs: 1300 + Math.floor(aleatorio() * 500),
  }),
  duracao: () => TACADA_MS + 1500,
  memoria: () => new Map(),
  acerto({ mem, quem, corpo, cabe }) {
    // o primeiro aperto: a mira presa. Uma vez só, e no instante de agora (com a folga da rede)
    const t = corpo.t;
    if (mem.has(quem) || !numero(t) || t < 0 || t > TACADA_MS || !cabe(t)) return;
    mem.set(quem, Math.round(t));
  },
  avaliar({ dados, mem, quem, corpo, cabe }) {
    const tMira = mem.get(quem);
    const t = corpo.t;
    // o segundo aperto: a força. Também no instante de agora, e depois da mira
    if (tMira === undefined || !numero(t) || t > TACADA_MS || t < tMira + TACADA_ENTRE_MS || !cabe(t)) return invalido();
    const tForca = Math.round(t);
    return pelaDistancia(tacadaDa(dados, tMira, tForca).distancia, tForca);
  },
  robo(_d, aleatorio, passouMs) {
    // quem joga bem para perto, às vezes muito perto, e de vez em quando entra
    const a = aleatorio();
    const d = a < 0.08 ? 0 : 3 + Math.round(40 * a * a);
    return pelaDistancia(d, Math.min(Math.round(passouMs), 2000 + Math.round(a * 5000)));
  },
});
