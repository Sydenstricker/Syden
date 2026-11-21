import { largada, novoKart, passo, progresso, type Comandos, type Kart } from './fisica';
import { desvioDaPorteira, pontoMaisPerto, sorteio, type Pista } from './pista';

/**
 * OS ROBÔS DA CORRIDA (19/11/2026, a auditoria: "a Copa no Solo contra robôs"). Sete karts do computador na pista do
 * Solo, cada um com a física de verdade (fisica.ts, o mesmo passo de quem joga): o robô só decide os comandos. Rodam só no
 * computador de quem joga, nunca vão ao servidor, e a corrida contra eles NÃO vira recorde (o recorde é do contra o
 * relógio, a pilotagem sozinha). Não há batida entre karts, como na sala.
 *
 * O jeito de cada um sai de um sorteio com a semente da pista e do número do robô: o mesmo robô dirige igual numa
 * pista, e a dificuldade escolhe o quanto ele aperta (o teto, a derrapagem que carrega turbo, e quanto erra).
 */

export type Dificuldade = 'facil' | 'medio' | 'dificil';
export const DIFICULDADES: Dificuldade[] = ['facil', 'medio', 'dificil'];
/**
 * O MESTRE (20/11/2026, a segunda auditoria), só na Corrida: o Jato e a Regata usam `Dificuldade` com as três de sempre. O
 * mestre tem o teto ACIMA do kart de quem joga (a classe ×1,04) e o EMPURRÃO de quem está atrás: o robô que vem atrás de
 * quem joga ganha até +5% no teto, cheio a partir de um quarto de volta de distância (andarRobo).
 */
export type DificuldadeDaCorrida = Dificuldade | 'mestre';
export const DIFICULDADES_DA_CORRIDA: DificuldadeDaCorrida[] = [...DIFICULDADES, 'mestre'];

/** Os nomes dos pilotos do computador: inventados, iguais em todo idioma (como os dos Bichos da Toca). */
export const NOMES_DOS_PILOTOS = ['Tico', 'Lola', 'Bento', 'Nina', 'Juca', 'Dora', 'Pipo', 'Zeca', 'Lia', 'Teco', 'Mia'];
export const nomeDoPiloto = (i: number) => `🤖 ${NOMES_DOS_PILOTOS[i % NOMES_DOS_PILOTOS.length]}`;

/** Os pontos por posição na copa (de 8 karts), os mesmos da copa na sala. */
export const PONTOS_DA_COPA = [10, 8, 6, 5, 4, 3, 2, 1];

/** O teto do mestre (vezes a classe de quem joga) e o empurrão máximo de quem vem atrás. */
export const MESTRE_CLASSE = 1.04;
export const MESTRE_EMPURRAO = 0.05;

/** O quanto o robô aperta, por dificuldade: o teto (fração da velocidade máxima), se derrapa, e quanto erra (por segundo). */
const JEITO: Record<DificuldadeDaCorrida, { teto: [number, number]; derrapa: number; erra: number; largada: number; classe: number; empurrao: number }> = {
  facil: { teto: [0.84, 0.9], derrapa: 0, erra: 0.08, largada: 0, classe: 1, empurrao: 0 },
  medio: { teto: [0.93, 0.98], derrapa: 0.5, erra: 0.03, largada: 0.3, classe: 1, empurrao: 0 },
  dificil: { teto: [1, 1], derrapa: 1, erra: 0, largada: 0.8, classe: 1, empurrao: 0 },
  mestre: { teto: [1, 1], derrapa: 1, erra: 0, largada: 1, classe: MESTRE_CLASSE, empurrao: MESTRE_EMPURRAO },
};

export interface RoboDoKart {
  /** O id na corrida: negativo (−1, −2…), como os robôs dos outros jogos. */
  id: number;
  nome: string;
  /** As cores do kart: um avatar pronto. */
  avatar: number;
  kart: Kart;
  /** Fração da velocidade máxima que ele busca, e se derrapa nas curvas. */
  teto: number;
  derrapa: boolean;
  /** Para que lado da pista ele prefere andar (unidades), que muda devagar. */
  faixa: number;
  /** Errando até este passo (o volante vai para `erroLado`). */
  erroAte: number;
  erroLado: number;
  /** Quanto ele erra por passo. */
  erra: number;
  sorte: () => number;
  /** O passo em que ele cruzou a chegada (0 = ainda correndo). */
  chegada: number;
  /** A classe dele sem o empurrão, e o empurrão máximo (0 fora do mestre). */
  classeBase: number;
  empurrao: number;
}

/**
 * A GRADE: quatro filas de dois, de 16 em 16 unidades atrás da linha. Quem joga larga na última fila (como na copa dos
 * jogos da época), à esquerda; os robôs ocupam as outras sete casas.
 */
export function casaNaGrade(p: Pista, casa: number): { x: number; y: number; angulo: number } {
  const { x, y, angulo } = p.largada;
  const fila = Math.floor(casa / 2);
  const lado = casa % 2 ? 12 : -12;
  const recuo = 6 + fila * 16;
  return {
    x: x - Math.cos(angulo) * recuo - Math.sin(angulo) * lado,
    y: y - Math.sin(angulo) * recuo + Math.cos(angulo) * lado,
    angulo,
  };
}

/** Põe um kart numa casa da grade (o índice da linha do meio procurado numa janela larga, porque a casa fica atrás). */
export function porNaGrade(k: Kart, p: Pista, casa: number) {
  const g = casaNaGrade(p, casa);
  k.x = g.x;
  k.y = g.y;
  k.angulo = k.rumo = g.angulo;
  k.indice = pontoMaisPerto(p, g.x, g.y, p.lx.length - 3, 40);
}

/** A casa da grade de quem joga (a última fila, à esquerda). */
export const CASA_DE_QUEM_JOGA = 6;

export function criarRobos(p: Pista, quantos: number, dificuldade: DificuldadeDaCorrida, classe = 1): RoboDoKart[] {
  const jeito = JEITO[dificuldade];
  const casas = [0, 1, 2, 3, 4, 5, 7].slice(0, quantos);
  return casas.map((casa, i) => {
    const sorte = sorteio(p.def.semente * 131 + i * 17 + DIFICULDADES_DA_CORRIDA.indexOf(dificuldade) * 7 + 3);
    const kart = novoKart(p);
    kart.classe = classe * jeito.classe;
    porNaGrade(kart, p, casa);
    // os da frente da grade são um tico mais rápidos (como numa copa de verdade)
    const teto = jeito.teto[0] + (jeito.teto[1] - jeito.teto[0]) * (1 - i / Math.max(1, quantos - 1)) * (0.6 + 0.4 * sorte());
    return {
      id: -(i + 1),
      nome: nomeDoPiloto(i),
      avatar: ((i * 5 + 2) % 16) + 1,
      kart,
      teto,
      derrapa: sorte() < jeito.derrapa,
      faixa: (sorte() - 0.5) * p.def.meiaLargura * 0.6,
      erroAte: 0,
      erroLado: 0,
      erra: jeito.erra / 60,
      sorte,
      chegada: 0,
      classeBase: kart.classe,
      empurrao: jeito.empurrao,
    };
  });
}

/** O verde para o robô: alguns acertam o turbo da largada (mais na dificuldade alta), nunca patinam. */
export function largadaDoRobo(r: RoboDoKart, dificuldade: DificuldadeDaCorrida, contagem: number) {
  if (r.sorte() < JEITO[dificuldade].largada) largada(r.kart, 20, contagem);
}

/** O que o robô aperta neste passo: mira um ponto da linha do meio à frente, na faixa dele, e segura o teto. */
export function comandosDoRobo(r: RoboDoKart, p: Pista): Comandos {
  const k = r.kart;
  const n = p.lx.length;
  // a faixa muda devagar, para eles não andarem em fila
  if (r.sorte() < 0.004) r.faixa = (r.sorte() - 0.5) * p.def.meiaLargura * 0.6;
  const alvo = (k.indice + 10) % n;
  const proximo = (alvo + 1) % n;
  const dx = p.lx[proximo] - p.lx[alvo], dy = p.ly[proximo] - p.ly[alvo];
  const l = Math.hypot(dx, dy) || 1;
  // a porteira à frente (a Fazenda): a faixa vira a metade que estará aberta
  const faixa = (p.porteiras?.length ? desvioDaPorteira(p, k.indice, k.passos, k.v) : null) ?? r.faixa;
  const mx = p.lx[alvo] - (dy / l) * faixa, my = p.ly[alvo] + (dx / l) * faixa;
  let dif = Math.atan2(my - k.y, mx - k.x) - k.angulo;
  while (dif > Math.PI) dif -= 2 * Math.PI;
  while (dif < -Math.PI) dif += 2 * Math.PI;
  let vira = Math.abs(dif) < 0.04 ? 0 : Math.sign(dif);
  // o ERRO: de vez em quando o volante escapa para um lado por um instante
  if (k.passos >= r.erroAte && r.sorte() < r.erra) {
    r.erroAte = k.passos + 10 + Math.floor(r.sorte() * 14);
    r.erroLado = r.sorte() < 0.5 ? -1 : 1;
  }
  if (k.passos < r.erroAte) vira = r.erroLado;
  const teto = 140 * (k.classe || 1) * r.teto;
  return { acelera: k.v < teto, freia: false, vira, derrapa: r.derrapa && Math.abs(dif) > 0.25 && k.passos >= r.erroAte };
}

/**
 * Um passo do robô (depois do verde). Devolve true no passo em que ele cruza a chegada. `quemJoga` é o progresso de quem joga
 * (voltas e fração), para o empurrão do mestre.
 */
export function andarRobo(r: RoboDoKart, p: Pista, quemJoga?: number): boolean {
  const antes = r.kart.terminou;
  if (r.empurrao > 0 && quemJoga !== undefined && !antes) {
    const atras = quemJoga - progresso(r.kart, p);
    r.kart.classe = r.classeBase * (1 + r.empurrao * Math.max(0, Math.min(1, atras / 0.25)));
  }
  passo(r.kart, comandosDoRobo(r, p), p);
  if (!antes && r.kart.terminou) {
    r.chegada = r.kart.voltas[r.kart.voltas.length - 1];
    return true;
  }
  return false;
}

/**
 * A ORDEM da corrida para a classificação: quem chegou, pelo passo da chegada; depois quem ainda corre, pelo quanto andou.
 * `quem` traz a chegada (0 = correndo) e o progresso (voltas e fração).
 */
export function ordemDaCorrida<T extends { chegada: number; andou: number }>(quem: T[]): T[] {
  return [...quem].sort((a, b) => {
    if (a.chegada && b.chegada) return a.chegada - b.chegada;
    if (a.chegada) return -1;
    if (b.chegada) return 1;
    return b.andou - a.andou;
  });
}

export const progressoDoRobo = (r: RoboDoKart, p: Pista) => (r.kart.terminou ? p.def.voltas : progresso(r.kart, p));

export interface PontosNaCopa {
  id: number;
  nome: string;
  eu: boolean;
  pontos: number;
}

/** Soma os pontos de uma corrida (pela posição) aos da copa, e ordena: no empate, fica na frente quem já estava. */
export function somarPontos(antes: PontosNaCopa[], lista: { id: number; nome: string; eu: boolean }[], tabela: number[] = PONTOS_DA_COPA): PontosNaCopa[] {
  const somados = new Map(antes.map((l) => [l.id, { ...l }]));
  lista.forEach((l, i) => {
    const a = somados.get(l.id) ?? { id: l.id, nome: l.nome, eu: l.eu, pontos: 0 };
    a.pontos += tabela[i] ?? 0;
    somados.set(l.id, a);
  });
  return [...somados.values()].sort((a, b) => b.pontos - a.pontos);
}
