/**
 * O VOO DAS PRAGAS DA CAÇA ÀS PRAGAS DA HORTA (04/11/2026). Este arquivo tem DUAS CÓPIAS IGUAIS BYTE A BYTE:
 * server/src/caca-voo.ts e web/src/caca/voo.ts (web/test/caca.test.ts confere). O servidor sorteia as pragas de cada onda e
 * confere cada tiro com esta conta; o site desenha com a mesma conta, e por isso a praga está no mesmo lugar nas duas pontas.
 *
 * Só a mecânica do gênero dos jogos de mira de fliperama (os alvos atravessam a tela, poucos tiros, mais rápido a cada onda);
 * nada de nome, personagem, arte ou som de ninguém. As pragas são nossas: corvos e gafanhotos, inimigos naturais de horta.
 */

/** A tela, em unidades do jogo (o site a amplia em pixels inteiros). O chão da horta começa em CHAO. */
export const LARGURA = 320;
export const ALTURA = 180;
export const CHAO = 138;

/**
 * O que voa na tela. As PRAGAS são o corvo e o gafanhoto. A JOANINHA (20/11/2026) é o BICHO AMIGO da horta: NÃO se atira
 * nela, e acertá-la tira AMIGO_PENA pontos e zera o combo. A CENOURA é o alvo da RODADA BÔNUS (20/11/2026), lançada do chão
 * para cima, entre a 3ª e a 4ª onda, sem limite de munição.
 */
export type TipoDePraga = 'corvo' | 'gafanhoto' | 'joaninha' | 'cenoura' | 'mosca' | 'toupeira';

/** Uma praga: quando aparece (ms desde o começo da onda), de onde sai, a velocidade e a ondulação, e quanto fica na tela. */
export interface Praga {
  tipo: TipoDePraga;
  t: number;
  x0: number;
  y0: number;
  /** Unidades por segundo. */
  vx: number;
  vy: number;
  /** O sobe e desce do voo (o corvo) ou o pulo (o gafanhoto). */
  amp: number;
  /** Ciclos por segundo. */
  freq: number;
  /** Quanto tempo ela fica na tela antes de fugir (ms). */
  vida: number;
  /** A PRAGA DOURADA (19/11/2026): rara, mais rápida, e vale DOURADA_VEZES os pontos. */
  dourada?: boolean;
}

/** O raio de acerto, em unidades: o gafanhoto é menor e vale mais. */
export const RAIO: Record<TipoDePraga, number> = { corvo: 12, gafanhoto: 9, joaninha: 8, cenoura: 9, mosca: 7, toupeira: 10 };
export const PONTOS: Record<TipoDePraga, number> = { corvo: 100, gafanhoto: 150, joaninha: 0, cenoura: 50, mosca: 200, toupeira: 175 };
/** Acertar a joaninha custa isto (e zera o combo). */
export const AMIGO_PENA = 200;
/** O bicho amigo: não se atira nele. */
export const ehAmigo = (p: Praga) => p.tipo === 'joaninha';
/** As pragas de verdade da onda (sem o amigo): é delas que se conta a onda perfeita. */
export const ehPraga = (p: Praga) => p.tipo === 'corvo' || p.tipo === 'gafanhoto' || p.tipo === 'mosca' || p.tipo === 'toupeira';
/**
 * AS PRAGAS NOVAS (21/11/2026, o lote D): a MOSCA (pequena, rápida, em zigue-zague apertado; da 3ª onda em diante) e a TOUPEIRA
 * (sai da terra, olha em volta um instante e se esconde de novo, no mesmo lugar; da 2ª onda em diante). Elas entram no FIM da
 * lista do sorteio, depois da joaninha: as pragas e as joaninhas de cada onda são as mesmas de antes.
 */
export const toupeirasDaOnda = (n: number) => (n >= 2 ? (n >= 5 ? 2 : 1) : 0);
export const moscasDaOnda = (n: number) => (n >= 3 ? (n >= 5 ? 2 : 1) : 0);
/** Quanto tempo a toupeira leva para subir e para descer (ms). */
export const TOUPEIRA_SOBE = 250;
/** Depois desta onda vem a RODADA BÔNUS. */
export const BONUS_DEPOIS_DA_ONDA = 3;
/** Quantas cenouras sobem na rodada bônus. */
export const CENOURAS_DO_BONUS = 14;
/** O bônus pela rapidez: até isto a mais, para o tiro logo que ela aparece, caindo até zero no fim da vida dela. */
export const BONUS_RAPIDEZ = 50;

export const ONDAS = 5;

/** A dourada vale isto vezes os pontos, voa nesta fração da vida de uma comum, e aparece (no máximo uma por onda, da 2ª em diante) com esta chance. */
export const DOURADA_VEZES = 3;
export const DOURADA_VIDA = 0.65;
export const DOURADA_CHANCE = 0.6;
/** A onda em que as pragas vêm DUAS DE CADA VEZ, de lados opostos. */
export const ONDA_DE_PARES = 4;
/** A ONDA PERFEITA (todas abatidas) dá este bônus. */
export const BONUS_PERFEITA = 500;
/** O COMBO: acertos seguidos (sem errar tiro) multiplicam os pontos do acerto; `combo` conta este acerto. */
export const multiplicador = (combo: number) => (combo >= 8 ? 3 : combo >= 4 ? 2 : 1);

/** Onde a praga está em `ms` (desde o começo da onda), ou null se ainda não apareceu ou já fugiu. */
export function posicao(p: Praga, ms: number): { x: number; y: number } | null {
  if (ms < p.t || ms > p.t + p.vida) return null;
  const s = (ms - p.t) / 1000;
  // a cenoura do bônus: lançada para cima, e a gravidade (amp é a metade dela) a traz de volta
  if (p.tipo === 'cenoura') return { x: p.x0 + p.vx * s, y: p.y0 + p.vy * s + p.amp * s * s };
  // a toupeira: sobe da terra (amp é a altura), fica, e desce de volta, sempre no mesmo lugar
  if (p.tipo === 'toupeira') {
    const ms2 = ms - p.t;
    const fora = Math.max(0, Math.min(1, ms2 / TOUPEIRA_SOBE, (p.vida - ms2) / TOUPEIRA_SOBE));
    return { x: p.x0, y: p.y0 - p.amp * fora };
  }
  const onda = p.tipo === 'corvo' || p.tipo === 'joaninha' || p.tipo === 'mosca' ? Math.sin(s * p.freq * 2 * Math.PI) : -Math.abs(Math.sin(s * p.freq * Math.PI));
  return { x: p.x0 + p.vx * s, y: p.y0 + p.vy * s + p.amp * onda };
}

/** Os pontos de um acerto em `ms`: o do bicho, mais a rapidez. No amigo, a pena (negativa). */
export function pontosDoAcerto(p: Praga, ms: number): number {
  if (ehAmigo(p)) return -AMIGO_PENA;
  const fracao = Math.max(0, Math.min(1, 1 - (ms - p.t) / p.vida));
  return (PONTOS[p.tipo] + Math.round(BONUS_RAPIDEZ * fracao)) * (p.dourada ? DOURADA_VEZES : 1);
}

/**
 * Qual praga um tiro em (x, y), no instante `ms`, acerta: a mais perto do tiro, entre as que estão na tela e ainda não foram
 * abatidas por quem atirou. -1 se nenhuma.
 */
export function pragaAtingida(pragas: Praga[], abatidas: ReadonlySet<number>, x: number, y: number, ms: number): number {
  let melhor = -1;
  let menor = Infinity;
  for (let i = 0; i < pragas.length; i++) {
    if (abatidas.has(i)) continue;
    const p = posicao(pragas[i], ms);
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= RAIO[pragas[i].tipo] && d < menor) {
      menor = d;
      melhor = i;
    }
  }
  return melhor;
}

/** Quantas pragas tem a onda `n` (de 1 a ONDAS; no "até errar três", sem fim), e a munição dela. */
export const pragasDaOnda = (n: number) => 4 + n * 2;
/** As pragas de verdade da onda, contando as novas (21/11/2026): é delas que sai a munição. */
export const todasAsPragasDaOnda = (n: number) => pragasDaOnda(n) + toupeirasDaOnda(n) + moscasDaOnda(n);
export const municaoDaOnda = (n: number) => Math.ceil(todasAsPragasDaOnda(n) * 1.5);

/**
 * As pragas da onda `n`, sorteadas: cada onda mais rápida e mais cheia. Os corvos cruzam o céu de um lado ao outro, com
 * o sobe e desce do voo; os gafanhotos saem da horta e atravessam pulando, mais baixos e mais depressa. Uma praga sai a
 * cada intervalo, às vezes duas juntas.
 */
export function sortearOnda(n: number, aleatorio: () => number = Math.random): Praga[] {
  const quantas = pragasDaOnda(n);
  const ritmo = 1 + (n - 1) * 0.22;
  const pragas: Praga[] = [];
  const pares = n === ONDA_DE_PARES;
  let t = 600;
  let ladoDoPar = true;
  for (let i = 0; i < quantas; i++) {
    const gafanhoto = aleatorio() < Math.min(0.5, 0.15 + n * 0.07);
    const sorteado = aleatorio() < 0.5;
    // na onda de pares, a segunda do par sai do lado oposto ao da primeira
    const daEsquerda: boolean = pares && i % 2 === 1 ? !ladoDoPar : sorteado;
    ladoDoPar = daEsquerda;
    const vida = Math.round((gafanhoto ? 2600 : 3400) / ritmo);
    // a distância que ela anda na vida: a tela inteira, e um pouco mais (para sair por fora)
    const distancia = LARGURA + 40;
    const vx = ((daEsquerda ? 1 : -1) * distancia) / (vida / 1000);
    const x0 = daEsquerda ? -20 : LARGURA + 20;
    if (gafanhoto) {
      const y0 = CHAO - 6 - aleatorio() * 14;
      pragas.push({ tipo: 'gafanhoto', t, x0, y0, vx, vy: 0, amp: 26 + aleatorio() * 22, freq: 1.4 + aleatorio() * 0.8, vida });
    } else {
      const y0 = 26 + aleatorio() * 70;
      const subida = (aleatorio() - 0.5) * 40;
      pragas.push({ tipo: 'corvo', t, x0, y0, vx, vy: subida / (vida / 1000), amp: 6 + aleatorio() * 14, freq: 0.5 + aleatorio() * 0.9, vida });
    }
    // às vezes a próxima sai junto (até duas na tela ao mesmo tempo, como nos fliperamas); na onda de pares, sempre juntas
    const junto = aleatorio() < 0.3;
    const intervalo = Math.round((900 + aleatorio() * 900) / ritmo);
    t += pares ? (i % 2 === 0 ? 0 : intervalo + 300) : junto ? 250 : intervalo;
  }
  // a dourada: uma praga da onda, sorteada, voa mais depressa
  if (n >= 2 && quantas > 0 && aleatorio() < DOURADA_CHANCE) {
    const p = pragas[Math.min(quantas - 1, Math.floor(aleatorio() * quantas))];
    const vida = Math.round(p.vida * DOURADA_VIDA);
    p.vx = (p.vx * p.vida) / vida;
    p.vy = (p.vy * p.vida) / vida;
    p.vida = vida;
    p.dourada = true;
  }
  // O BICHO AMIGO (20/11/2026): da 2ª onda em diante, uma joaninha (duas a partir da 4ª) cruza devagar no meio das pragas.
  // Ela entra no FIM da lista, depois de tudo sorteado: as pragas da onda são as mesmas de antes dela.
  if (n >= 2 && pragas.length > 0) {
    const amigos = n >= ONDA_DE_PARES ? 2 : 1;
    const fimDasPragas = Math.max(...pragas.map((p) => p.t + p.vida));
    for (let k = 0; k < amigos; k++) {
      const daEsquerda = aleatorio() < 0.5;
      const vida = Math.round(4200 / ritmo);
      const t0 = 600 + aleatorio() * Math.max(0, fimDasPragas - vida - 600);
      const distancia = LARGURA + 40;
      pragas.push({
        tipo: 'joaninha',
        t: Math.round(t0),
        x0: daEsquerda ? -20 : LARGURA + 20,
        y0: 40 + aleatorio() * 60,
        vx: ((daEsquerda ? 1 : -1) * distancia) / (vida / 1000),
        vy: 0,
        amp: 5 + aleatorio() * 8,
        freq: 0.8 + aleatorio() * 0.6,
        vida,
      });
    }
  }
  // AS PRAGAS NOVAS (21/11/2026): depois de tudo (as de antes ficam iguais), as toupeiras e as moscas da onda
  if (pragas.length > 0) {
    const fimDasPragas = Math.max(...pragas.map((p) => p.t + p.vida));
    for (let k = 0; k < toupeirasDaOnda(n); k++) {
      const vida = Math.max(900, Math.round(2400 / ritmo));
      const t0 = 800 + aleatorio() * Math.max(0, fimDasPragas - vida - 800);
      pragas.push({
        tipo: 'toupeira',
        t: Math.round(t0),
        x0: 40 + aleatorio() * (LARGURA - 80),
        y0: CHAO + 12,
        vx: 0,
        vy: 0,
        amp: 18 + aleatorio() * 6,
        freq: 0,
        vida,
      });
    }
    for (let k = 0; k < moscasDaOnda(n); k++) {
      const daEsquerda = aleatorio() < 0.5;
      const vida = Math.round(2200 / ritmo);
      const t0 = 600 + aleatorio() * Math.max(0, fimDasPragas - vida - 600);
      const distancia = LARGURA + 40;
      pragas.push({
        tipo: 'mosca',
        t: Math.round(t0),
        x0: daEsquerda ? -20 : LARGURA + 20,
        y0: 30 + aleatorio() * 60,
        vx: ((daEsquerda ? 1 : -1) * distancia) / (vida / 1000),
        vy: 0,
        amp: 12 + aleatorio() * 10,
        freq: 2.2 + aleatorio() * 0.8,
        vida,
      });
    }
  }
  return pragas;
}

/**
 * A RODADA BÔNUS (20/11/2026): CENOURAS_DO_BONUS cenouras lançadas do chão para cima, uma depois da outra, cada uma subindo e
 * caindo de volta. Sem limite de munição e sem combo; é curta.
 */
export function sortearBonus(aleatorio: () => number = Math.random): Praga[] {
  const cenouras: Praga[] = [];
  let t = 500;
  for (let k = 0; k < CENOURAS_DO_BONUS; k++) {
    const vida = Math.round(1800 + aleatorio() * 600);
    const T = vida / 2000;
    const altura = CHAO - (24 + aleatorio() * 50);
    const sobe = CHAO + 4 - altura;
    cenouras.push({
      tipo: 'cenoura',
      t,
      x0: 30 + aleatorio() * (LARGURA - 60),
      y0: CHAO + 4,
      vx: (aleatorio() - 0.5) * 60,
      vy: (-2 * sobe) / T,
      amp: sobe / (T * T),
      freq: 0,
      vida,
    });
    t += Math.round(280 + aleatorio() * 220);
  }
  return cenouras;
}

/** Quando a onda acaba: a última praga fugiu, e mais um respiro. */
export const fimDaOnda = (pragas: Praga[]) => Math.max(0, ...pragas.map((p) => p.t + p.vida)) + 600;
