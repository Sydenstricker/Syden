import { duelo, JOGADA_MS, type Lado, type Nivel } from './minijogo-tabuleiro.js';
import type { Definicao, Jogo } from './minijogo-motor.js';

/**
 * BATALHA NAVAL (04/11/2026), o jogo de papel quadriculado: cada um tem um mar de 10 × 10 com cinco navios (5, 4, 3, 3 e
 * 2 casas, retos, e nenhum encostado em outro, nem na diagonal), e atira no mar do outro. Acertou, atira de novo; errou,
 * passa a vez. Vence quem afundar a frota inteira.
 *
 * Roda na mesa de duas pessoas (`duelo`, minijogo-tabuleiro.ts), com a sala assistindo. É o único jogo da mesa com
 * informação ESCONDIDA: cada um vê os próprios navios e, do outro, só o que os tiros revelaram (o navio inteiro só quando
 * afunda). Quem assiste vê os dois mares do mesmo jeito, sem navio escondido nenhum — senão bastava assistir para soprar
 * pela voz. No fim, tudo aparece para todos.
 *
 * CADA UM PÕE OS PRÓPRIOS NAVIOS ANTES DO PRIMEIRO TIRO (pedido dele, 05/11/2026: "eu quero primeiro colocar os navios antes
 * de jogar"). Com a mesa cheia, a partida passa pela MONTAGEM (`montagem` do `duelo`): cada lado põe, muda de lugar, gira ou
 * sorteia a frota (`{ tipo: 'montar', acao: 'por' | 'tirar' | 'sortear' | 'pronto' }`), vendo só o próprio mar, e os tiros
 * começam quando os dois apertam "Pronto". O computador fica pronto na hora, com a frota sorteada; quem não ficar pronto em
 * MONTAGEM_MS tem o que falta sorteado pelo servidor. Depois de começar, ainda dá para sortear de novo enquanto ninguém atirou
 * no seu mar (`{ tipo: 'livre', acao: 'sortear' }`, de antes da montagem; a tela não oferece mais).
 */

export const LADO_DO_MAR = 10;
export const CASAS_DO_MAR = LADO_DO_MAR * LADO_DO_MAR;
export const FROTA = [5, 4, 3, 3, 2] as const;

/**
 * OS MARES (20/11/2026, o lote C da segunda auditoria), escolhidos na largada: o de 10 × 10 é o de fábrica; o de 8 × 8 tem a
 * frota menor (partida rápida) e o de 12 × 12 a maior. Cada frota cabe no mar dela sem encostar com folga (o teste sorteia
 * muitas). O lado do mar e a frota vão no estado: todas as contas abaixo recebem os dois.
 */
export const MARES: Record<number, readonly number[]> = {
  8: [4, 3, 2, 2],
  10: FROTA,
  12: [5, 4, 4, 3, 3, 2, 2],
};
export const ladoDoMar = (v: unknown): number => (typeof v === 'number' && MARES[v] ? v : LADO_DO_MAR);

/** Um mar: os navios (as casas de cada um) e os tiros que ele levou. */
interface Mar {
  navios: number[][];
  /** Por casa: se já levou tiro. */
  tiros: boolean[];
}

export type Resultado = 'agua' | 'acertou' | 'afundou';

export interface EstadoNaval {
  mares: [Mar, Mar];
  ultimo: { lado: Lado; casa: number; resultado: Resultado } | null;
  /** A partida acabou: os navios aparecem para todos. */
  revelado: boolean;
  /** A montagem: os navios de cada lado na ordem da FROTA (null: ainda não posto), e quem já apertou "Pronto". */
  frotas: [(number[] | null)[], (number[] | null)[]];
  prontos: [boolean, boolean];
  /** A variante SALVO (19/11/2026): cada vez é uma rajada, com tantos tiros quantos navios a pessoa ainda tem. */
  salvo: boolean;
  /** A última rajada do salvo (ou do tiro em cruz, `arma`): as casas e o que cada tiro achou. */
  rajada: { lado: Lado; tiros: { casa: number; resultado: Resultado }[]; arma?: 'cruz' } | null;
  /** O lado do mar (8, 10 ou 12) e a frota dele (MARES). */
  n: number;
  frota: readonly number[];
  /** A variante das ARMAS ESPECIAIS (21/11/2026): o tiro em cruz e o sonar, uma vez por partida cada, por lado. */
  armas?: boolean;
  usadas?: [{ cruz: boolean; sonar: boolean }, { cruz: boolean; sonar: boolean }];
  /** Os sonares já usados: quem usou, o centro da área de 3 × 3 e quantos navios do outro passam por ela. */
  sonares?: { lado: Lado; centro: number; navios: number }[];
}

/**
 * AS ARMAS ESPECIAIS (21/11/2026, o lote D da segunda auditoria), escolhidas na largada; só sem o salvo (lá cada vez já é uma
 * rajada). Cada lado tem, UMA VEZ POR PARTIDA, as duas, no lugar do tiro da vez:
 * - o TIRO EM CRUZ: a casa escolhida e as quatro vizinhas (em cima, embaixo e dos lados), as que ainda não levaram tiro. Caem
 *   todas juntas, e a vez passa sempre (acertar não dá outro tiro);
 * - o SONAR: diz quantos navios do outro passam pela área de 3 × 3 em volta da casa escolhida, sem dizer onde. Gasta a vez.
 * O servidor confere e calcula tudo; o que o sonar diz aparece para todos (a mesa inteira vê a área e o número, como no papel
 * em que se fala em voz alta): quem é dono do mar já sabe onde estão os navios, e quem usou já tem o número, então nenhum
 * navio escondido aparece para ninguém que não o tivesse.
 */
export type Arma = 'cruz' | 'sonar';
/** As casas da cruz em volta de `casa` (só as do mar). */
export function casasDaCruz(casa: number, n = LADO_DO_MAR): number[] {
  const l = Math.floor(casa / n);
  const c = casa % n;
  return [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
    .filter(([dl, dc]) => l + dl >= 0 && l + dl < n && c + dc >= 0 && c + dc < n)
    .map(([dl, dc]) => (l + dl) * n + c + dc);
}
/** As casas da área de 3 × 3 do sonar em volta de `casa` (só as do mar). */
export function casasDoSonar(casa: number, n = LADO_DO_MAR): number[] {
  const l = Math.floor(casa / n);
  const c = casa % n;
  const casas: number[] = [];
  for (let dl = -1; dl <= 1; dl++) for (let dc = -1; dc <= 1; dc++) if (l + dl >= 0 && l + dl < n && c + dc >= 0 && c + dc < n) casas.push((l + dl) * n + c + dc);
  return casas;
}

/** O que se vê de um mar: os tiros (0 nada, 1 água, 2 fogo) e os navios que quem pede pode ver. */
export interface MarPublico {
  tiros: number[];
  navios: { casas: number[]; afundado: boolean }[];
}

/**
 * Uma frota válida, sorteada: cada navio num lugar livre, e as casas em volta dele (as oito vizinhas) fechadas para os
 * próximos. Começa pelo maior, que é o mais difícil de encaixar; se um não couber (raro), recomeça.
 */
export function sortearFrota(
  aleatorio: () => number = Math.random,
  fixos: (number[] | null)[] = [],
  n = LADO_DO_MAR,
  frota: readonly number[] = MARES[n] ?? FROTA,
): number[][] {
  const casasDoMar = n * n;
  const fechar = (fechada: boolean[], posto: number[]) => {
    for (const c of posto) {
      const l = Math.floor(c / n);
      const col = c % n;
      for (let dl = -1; dl <= 1; dl++) {
        for (let dc = -1; dc <= 1; dc++) {
          const ll = l + dl;
          const cc = col + dc;
          if (ll >= 0 && ll < n && cc >= 0 && cc < n) fechada[ll * n + cc] = true;
        }
      }
    }
  };
  // Com navios já postos (a montagem que acabou no tempo), os outros se encaixam em volta deles; se não couberem de jeito
  // nenhum (raro: os postos podem fechar o mar), a frota inteira é sorteada.
  for (let rodada = 0; ; rodada++) {
    const usarFixos = rodada < 300 && fixos.some(Boolean);
    const fechada = new Array<boolean>(casasDoMar).fill(false);
    if (usarFixos) for (const posto of fixos) if (posto) fechar(fechada, posto);
    const navios: number[][] = [];
    let coube = true;
    for (const [i, tamanho] of frota.entries()) {
      if (usarFixos && fixos[i]) {
        navios.push(fixos[i]!.slice());
        continue;
      }
      let posto: number[] | null = null;
      for (let tentativa = 0; tentativa < 200 && !posto; tentativa++) {
        const deitado = aleatorio() < 0.5;
        const linhas = deitado ? n : n - tamanho + 1;
        const colunas = deitado ? n - tamanho + 1 : n;
        const l0 = Math.min(linhas - 1, Math.floor(aleatorio() * linhas));
        const c0 = Math.min(colunas - 1, Math.floor(aleatorio() * colunas));
        const casas = Array.from({ length: tamanho }, (_, k) => (deitado ? l0 * n + c0 + k : (l0 + k) * n + c0));
        if (casas.every((c) => !fechada[c])) posto = casas;
      }
      if (!posto) {
        coube = false;
        break;
      }
      navios.push(posto);
      fechar(fechada, posto);
    }
    if (coube) return navios;
  }
}

/** As casas de um navio de `tamanho` que começa em `casa` (a de cima, ou a da esquerda), ou null se ele sai do mar. */
export function casasDoNavio(casa: number, tamanho: number, deitado: boolean, n = LADO_DO_MAR): number[] | null {
  if (!Number.isInteger(casa) || casa < 0 || casa >= n * n) return null;
  const l = Math.floor(casa / n);
  const c = casa % n;
  if (deitado ? c + tamanho > n : l + tamanho > n) return null;
  return Array.from({ length: tamanho }, (_, k) => (deitado ? casa + k : casa + k * n));
}

/** Se as casas encostam (ou caem em cima) de algum dos outros navios, também na diagonal. */
export function encosta(casas: number[], outros: (number[] | null)[], n = LADO_DO_MAR): boolean {
  const ocupadas = new Set(outros.flatMap((x) => x ?? []));
  return casas.some((c) => {
    const l = Math.floor(c / n);
    const col = c % n;
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) {
        const ll = l + dl;
        const cc = col + dc;
        if (ll >= 0 && ll < n && cc >= 0 && cc < n && ocupadas.has(ll * n + cc)) return true;
      }
    }
    return false;
  });
}

/** A casa como no papel: a coluna em letra e a linha em número ("B7"). */
export const nomeDaCasaDoMar = (i: number, n = LADO_DO_MAR) => `${'ABCDEFGHIJKL'[i % n]}${Math.floor(i / n) + 1}`;
const SINAL: Record<Resultado, string> = { agua: '·', acertou: '✕', afundou: '✕✕' };

/**
 * Uma RAJADA do salvo: `corpo.casas`, tantas casas distintas e sem tiro quantos navios `lado` ainda tem. Os tiros caem todos
 * juntos, a vez passa sempre (acertar não dá outra rajada), e vence quem afunda a frota toda.
 */
function rajada(e: EstadoNaval, lado: Lado, corpo: Record<string, unknown>): string | { proximo: Lado; vencedor?: Lado } {
  const outro: Lado = lado === 0 ? 1 : 0;
  const alvo = e.mares[outro];
  const casas = Array.isArray(corpo.casas) ? corpo.casas.map(Number) : [];
  if (casas.length !== tirosDaRajada(e, lado)) return 'Escolha todas as casas da rajada.';
  if (new Set(casas).size !== casas.length || casas.some((c) => !Number.isInteger(c) || c < 0 || c >= e.n * e.n)) return 'Escolha uma casa do mar.';
  if (casas.some((c) => alvo.tiros[c])) return 'Você já atirou nessa casa.';
  for (const c of casas) alvo.tiros[c] = true;
  const tiros = casas.map((casa) => {
    const navio = alvo.navios.find((x) => x.includes(casa));
    return { casa, resultado: (!navio ? 'agua' : afundado(alvo, navio) ? 'afundou' : 'acertou') as Resultado };
  });
  e.rajada = { lado, tiros };
  const ultimo = tiros[tiros.length - 1];
  e.ultimo = { lado, casa: ultimo.casa, resultado: ultimo.resultado };
  if (alvo.navios.every((x) => afundado(alvo, x))) {
    e.revelado = true;
    return { proximo: lado, vencedor: lado };
  }
  return { proximo: outro };
}

/** Uma ARMA ESPECIAL de `lado` (a cruz ou o sonar), conferida aqui: a variante ligada, a arma ainda não usada, a casa no mar. */
function usarArma(e: EstadoNaval, lado: Lado, corpo: Record<string, unknown>): string | { proximo: Lado; vencedor?: Lado } {
  if (!e.armas || e.salvo || !e.usadas) return 'Esta partida não tem armas especiais.';
  const arma = corpo.arma;
  if (arma !== 'cruz' && arma !== 'sonar') return 'Arma desconhecida.';
  if (e.usadas[lado][arma]) return 'Você já usou essa arma.';
  const casa = Number(corpo.casa);
  if (!Number.isInteger(casa) || casa < 0 || casa >= e.n * e.n) return 'Escolha uma casa do mar.';
  const outro: Lado = lado === 0 ? 1 : 0;
  const alvo = e.mares[outro];
  if (arma === 'sonar') {
    const area = new Set(casasDoSonar(casa, e.n));
    const navios = alvo.navios.filter((navio) => navio.some((c) => area.has(c))).length;
    e.usadas[lado].sonar = true;
    (e.sonares ??= []).push({ lado, centro: casa, navios });
    return { proximo: outro };
  }
  if (alvo.tiros[casa]) return 'Você já atirou nessa casa.';
  const casas = casasDaCruz(casa, e.n).filter((c) => !alvo.tiros[c]);
  for (const c of casas) alvo.tiros[c] = true;
  const tiros = casas.map((c) => {
    const navio = alvo.navios.find((x) => x.includes(c));
    return { casa: c, resultado: (!navio ? 'agua' : afundado(alvo, navio) ? 'afundou' : 'acertou') as Resultado };
  });
  e.usadas[lado].cruz = true;
  e.rajada = { lado, tiros, arma: 'cruz' };
  // o "último" é o do meio da cruz (a coluna d'água cai nele)
  const meio = tiros.find((x) => x.casa === casa)!;
  e.ultimo = { lado, casa, resultado: tiros.some((x) => x.resultado === 'afundou') ? 'afundou' : tiros.some((x) => x.resultado === 'acertou') ? 'acertou' : meio.resultado };
  if (alvo.navios.every((x) => afundado(alvo, x))) {
    e.revelado = true;
    return { proximo: lado, vencedor: lado };
  }
  return { proximo: outro };
}

/**
 * O que o robô de `lado` tira dos SONARES que usou: as casas que um sonar de zero navios garante vazias viram água (ele nunca
 * atira nelas), e as casas sem tiro das áreas em que o sonar achou navio, e onde ainda não há fogo, são as que ele quer.
 */
export function leituraDosSonares(e: EstadoNaval, lado: Lado, visto: MarPublico): { visto: MarPublico; promissoras: number[] } {
  const meus = (e.sonares ?? []).filter((s) => s.lado === lado);
  if (!meus.length) return { visto, promissoras: [] };
  const tiros = visto.tiros.slice();
  const promissoras = new Set<number>();
  const afundadas = new Set(visto.navios.filter((x) => x.afundado).flatMap((x) => x.casas));
  for (const s of meus) {
    const area = casasDoSonar(s.centro, e.n);
    // os navios já afundados que passam pela área contam como achados
    const achados = visto.navios.filter((x) => x.afundado && x.casas.some((c) => area.includes(c))).length;
    if (s.navios - achados <= 0) {
      for (const c of area) if (tiros[c] === 0) tiros[c] = 1;
    } else if (!area.some((c) => visto.tiros[c] === 2 && !afundadas.has(c))) {
      for (const c of area) if (tiros[c] === 0) promissoras.add(c);
    }
  }
  return { visto: { ...visto, tiros }, promissoras: [...promissoras].filter((c) => tiros[c] === 0) };
}

/**
 * A jogada do ROBÔ COM AS ARMAS ESPECIAIS (21/11/2026): sem fogo de navio vivo à vista, usa o SONAR na área de 3 × 3 com mais
 * casas sem tiro (depois de uns tiros, para não gastá-lo no escuro), e depois procura nas áreas em que o sonar achou navio; o
 * TIRO EM CRUZ vai na casa que ele escolheria, quando ela abre quatro casas novas ou mais. O fácil usa as duas ao acaso. Ele só
 * olha o que a pessoa no lugar dele veria (e o número do próprio sonar).
 */
export function jogadaDoRoboComArmas(e: EstadoNaval, lado: Lado, nivel: Nivel, sorte: () => number): Record<string, unknown> {
  const alvo = e.mares[lado === 0 ? 1 : 0];
  const { visto, promissoras } = leituraDosSonares(e, lado, marPublico(alvo, false));
  const tamanhos = restam(alvo);
  const usadas = e.usadas?.[lado] ?? { cruz: true, sonar: true };
  const afundadas = new Set(visto.navios.filter((x) => x.afundado).flatMap((x) => x.casas));
  const fogoVivo = visto.tiros.some((t, i) => t === 2 && !afundadas.has(i));
  const meusTiros = alvo.tiros.filter(Boolean).length;
  const livres = [...visto.tiros.keys()].filter((i) => visto.tiros[i] === 0);
  const facil = nivel === 'facil';
  if (!fogoVivo && !usadas.sonar && !promissoras.length && meusTiros >= 4 && (!facil || sorte() < 0.3)) {
    let melhor = -1;
    let melhorConta = -1;
    for (const c of livres) {
      const conta = casasDoSonar(c, e.n).filter((x) => visto.tiros[x] === 0).length + sorte() * 0.5;
      if (conta > melhorConta) {
        melhorConta = conta;
        melhor = c;
      }
    }
    if (melhor >= 0) return { arma: 'sonar', casa: melhor };
  }
  // procurar nas áreas promissoras do sonar: as outras casas livres contam como evitadas
  const fora = !fogoVivo && promissoras.length ? livres.filter((c) => !promissoras.includes(c)) : [];
  const casa = tiroNoNivel(visto, tamanhos, nivel, sorte, fora);
  if (!fogoVivo && !usadas.cruz && casa >= 0 && (!facil || sorte() < 0.4)) {
    const novas = casasDaCruz(casa, e.n).filter((c) => !alvo.tiros[c]).length;
    if (novas >= 4) return { arma: 'cruz', casa };
  }
  return { casa };
}

/** Quanto tempo a montagem espera: o mesmo da jogada na mesa. */
export const MONTAGEM_MS = JOGADA_MS;

const afundado = (mar: Mar, navio: number[]) => navio.every((c) => mar.tiros[c]);

function marPublico(mar: Mar, verTudo: boolean): MarPublico {
  const fogo = new Set(mar.navios.flat());
  return {
    tiros: mar.tiros.map((t, c) => (!t ? 0 : fogo.has(c) ? 2 : 1)),
    navios: mar.navios
      .map((casas) => ({ casas, afundado: afundado(mar, casas) }))
      .filter((navio) => verTudo || navio.afundado),
  };
}

/** Os tamanhos dos navios que ainda boiam (é o que o jogo de papel conta em voz alta). */
const restam = (mar: Mar) => mar.navios.filter((navio) => !afundado(mar, navio)).map((navio) => navio.length);

/**
 * O ROBÔ DA BATALHA NAVAL (o Solo, 05/11/2026): mira só com o que a pessoa no lugar dele veria do mar do outro (`marPublico`
 * sem os navios escondidos). Com fogo num navio que ainda não afundou, ele CAÇA: segue a linha dos acertos, ou tenta as
 * quatro vizinhas. Sem fogo, PROCURA em xadrez (todo navio tem 2 casas ou mais, então metade das casas basta), longe dos navios
 * afundados: pela regra, nenhum navio encosta em outro, nem na diagonal, e a diagonal de um acerto também fica de fora.
 */
export function tiroDoRobo(mar: MarPublico, aleatorio: () => number = Math.random): number {
  const n = Math.round(Math.sqrt(mar.tiros.length));
  const dentro = (l: number, c: number) => l >= 0 && l < n && c >= 0 && c < n;
  const afundadas = new Set(mar.navios.filter((x) => x.afundado).flatMap((x) => x.casas));
  // as casas onde não pode haver navio: em volta dos afundados, e na diagonal de qualquer fogo
  const vedada = new Array<boolean>(n * n).fill(false);
  for (let i = 0; i < n * n; i++) {
    if (mar.tiros[i] !== 2) continue;
    const l = Math.floor(i / n);
    const c = i % n;
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dentro(l + dl, c + dc)) continue;
        if (afundadas.has(i) || (dl !== 0 && dc !== 0)) vedada[(l + dl) * n + c + dc] = true;
      }
    }
  }
  const livre = (l: number, c: number) => dentro(l, c) && mar.tiros[l * n + c] === 0 && !vedada[l * n + c];
  const sortear = (lista: number[]) => lista[Math.min(lista.length - 1, Math.floor(aleatorio() * lista.length))];

  // CAÇAR: o fogo num navio que ainda boia
  const fogo = [...mar.tiros.keys()].filter((i) => mar.tiros[i] === 2 && !afundadas.has(i));
  if (fogo.length) {
    const alvos: number[] = [];
    if (fogo.length >= 2) {
      // a linha já se sabe: as duas pontas dela
      const deitado = Math.floor(fogo[0] / n) === Math.floor(fogo[1] / n);
      const [dl, dc] = deitado ? [0, 1] : [1, 0];
      const primeiro = fogo[0];
      const ultimo = fogo[fogo.length - 1];
      const antes = [Math.floor(primeiro / n) - dl, (primeiro % n) - dc];
      const depois = [Math.floor(ultimo / n) + dl, (ultimo % n) + dc];
      for (const [l, c] of [antes, depois]) if (livre(l, c)) alvos.push(l * n + c);
    }
    if (!alvos.length) {
      for (const i of fogo) {
        const l = Math.floor(i / n);
        const c = i % n;
        for (const [dl, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (livre(l + dl, c + dc)) alvos.push((l + dl) * n + c + dc);
      }
    }
    if (alvos.length) return sortear(alvos);
  }
  // PROCURAR: em xadrez; sem casa assim, qualquer livre; e, por garantia, qualquer uma sem tiro
  const livres = [...mar.tiros.keys()].filter((i) => livre(Math.floor(i / n), i % n));
  const xadrez = livres.filter((i) => (Math.floor(i / n) + (i % n)) % 2 === 0);
  if (xadrez.length) return sortear(xadrez);
  if (livres.length) return sortear(livres);
  return mar.tiros.findIndex((t) => t === 0);
}

/**
 * O ROBÔ DIFÍCIL (19/11/2026): CONTA AS POSIÇÕES POSSÍVEIS de cada navio que ainda boia (os tamanhos que restam são públicos)
 * e atira na casa por onde passam mais delas. Uma posição não pode cobrir água, navio afundado nem a volta dele, nem encostar
 * num fogo que ela não cobre (seria outro navio encostado); a que cobre fogo de navio ainda vivo vale muito mais, e é assim que
 * ele caça depois de acertar. Só olha o que a pessoa no lugar dele veria.
 */
export function tiroDoRoboDificil(mar: MarPublico, tamanhos: number[], aleatorio: () => number = Math.random, evitar: number[] = []): number {
  const n = Math.round(Math.sqrt(mar.tiros.length));
  const afundadas = new Set(mar.navios.filter((x) => x.afundado).flatMap((x) => x.casas));
  const fogo = new Set([...mar.tiros.keys()].filter((i) => mar.tiros[i] === 2 && !afundadas.has(i)));
  const proibida = new Array<boolean>(n * n).fill(false);
  for (let i = 0; i < n * n; i++) {
    if (mar.tiros[i] === 1 || evitar.includes(i)) proibida[i] = true;
    if (!afundadas.has(i)) continue;
    const l = Math.floor(i / n);
    const c = i % n;
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) if (l + dl >= 0 && l + dl < n && c + dc >= 0 && c + dc < n) proibida[(l + dl) * n + c + dc] = true;
    }
  }
  const encostaNoFogo = (casas: number[]) => {
    const dentro = new Set(casas);
    return casas.some((c) => {
      const l = Math.floor(c / n);
      const col = c % n;
      for (let dl = -1; dl <= 1; dl++) {
        for (let dc = -1; dc <= 1; dc++) {
          const ll = l + dl;
          const cc = col + dc;
          if (ll >= 0 && ll < n && cc >= 0 && cc < n && fogo.has(ll * n + cc) && !dentro.has(ll * n + cc)) return true;
        }
      }
      return false;
    });
  };
  const peso = new Array<number>(n * n).fill(0);
  for (const tamanho of tamanhos) {
    for (const deitado of [true, false]) {
      for (let casa = 0; casa < n * n; casa++) {
        const casas = casasDoNavio(casa, tamanho, deitado, n);
        if (!casas || casas.some((c) => proibida[c]) || encostaNoFogo(casas)) continue;
        const cobre = casas.filter((c) => fogo.has(c)).length;
        const w = cobre ? 40 ** cobre : 1;
        for (const c of casas) if (mar.tiros[c] === 0) peso[c] += w;
      }
    }
  }
  let melhor = -1;
  let melhorPeso = -1;
  for (let i = 0; i < n * n; i++) {
    if (mar.tiros[i] !== 0 || evitar.includes(i)) continue;
    const p = peso[i] + aleatorio() * 0.5;
    if (p > melhorPeso) {
      melhorPeso = p;
      melhor = i;
    }
  }
  return melhor >= 0 ? melhor : mar.tiros.findIndex((t, i) => t === 0 && !evitar.includes(i));
}

/** O robô FÁCIL: tiros ao acaso, e só às vezes vai atrás do fogo. */
export function tiroDoRoboFacil(mar: MarPublico, aleatorio: () => number = Math.random, evitar: number[] = []): number {
  if (aleatorio() < 0.4) {
    const t = tiroDoRobo(mar, aleatorio);
    if (!evitar.includes(t)) return t;
  }
  const livres = [...mar.tiros.keys()].filter((i) => mar.tiros[i] === 0 && !evitar.includes(i));
  return livres[Math.min(livres.length - 1, Math.floor(aleatorio() * livres.length))] ?? mar.tiros.findIndex((t) => t === 0);
}

/** O tiro do robô no nível escolhido. evitar: as casas já escolhidas na mesma rajada do salvo. */
export function tiroNoNivel(mar: MarPublico, tamanhos: number[], nivel: Nivel, aleatorio: () => number, evitar: number[] = []): number {
  if (nivel === 'dificil') return tiroDoRoboDificil(mar, tamanhos, aleatorio, evitar);
  if (nivel === 'facil') return tiroDoRoboFacil(mar, aleatorio, evitar);
  // o normal não sabe da rajada: as casas já escolhidas contam como água para ele
  const visto: MarPublico = evitar.length ? { ...mar, tiros: mar.tiros.map((t, i) => (evitar.includes(i) ? 1 : t)) } : mar;
  return tiroDoRobo(visto, aleatorio);
}

/** Quantos tiros tem a rajada de lado no salvo: um por navio dele que ainda boia (e não mais que as casas livres). */
const tirosDaRajada = (e: EstadoNaval, lado: Lado) => {
  const livres = e.mares[lado === 0 ? 1 : 0].tiros.filter((t) => !t).length;
  return Math.min(livres, e.mares[lado].navios.filter((navio) => !afundado(e.mares[lado], navio)).length);
};

export function criarNaval(aleatorio: () => number = Math.random): Definicao {
  return {
    mesa: true,
    comecar(ctx, opcoes) {
      let estado: EstadoNaval | null = null;
      const novoMar = (n: number): Mar => ({ navios: [], tiros: new Array<boolean>(n * n).fill(false) });
      const vazia = (frota: readonly number[]) => frota.map(() => null as number[] | null);
      /** O mar de `lado` passa a ter os navios postos da frota dele. */
      const acertar = (e: EstadoNaval, lado: Lado) => {
        e.mares[lado].navios = e.frotas[lado].filter((x): x is number[] => x !== null).map((x) => x.slice());
      };
      const mesa = duelo<EstadoNaval>(
        {
          // as armas especiais não se somam ao salvo (lá cada vez já é uma rajada)
          escolhas: (corpo) => ({ salvo: corpo.salvo === true, mar: ladoDoMar(corpo.mar), armas: corpo.armas === true && corpo.salvo !== true }),
          inicio: (escolhas) =>
            (estado = {
              mares: [novoMar(ladoDoMar(escolhas.mar)), novoMar(ladoDoMar(escolhas.mar))],
              ultimo: null,
              revelado: false,
              frotas: [vazia(MARES[ladoDoMar(escolhas.mar)]), vazia(MARES[ladoDoMar(escolhas.mar)])],
              prontos: [false, false],
              salvo: escolhas.salvo === true,
              rajada: null,
              n: ladoDoMar(escolhas.mar),
              frota: MARES[ladoDoMar(escolhas.mar)],
              armas: escolhas.armas === true,
              usadas: [
                { cruz: false, sonar: false },
                { cruz: false, sonar: false },
              ],
              sonares: [],
            }),
          // o tiro já revelou o mar: voltar seria espiar
          semVoltar: true,
          montagem: {
            ms: MONTAGEM_MS,
            montar(e, lado, corpo) {
              if (e.prontos[lado]) return 'Sua frota já está pronta.';
              const frota = e.frotas[lado];
              const acao = corpo.acao;
              if (acao === 'sortear') {
                e.frotas[lado] = sortearFrota(aleatorio, [], e.n, e.frota);
              } else if (acao === 'pronto') {
                if (frota.some((x) => x === null)) return 'Ponha todos os navios antes.';
                e.prontos[lado] = true;
              } else if (acao === 'por' || acao === 'tirar') {
                const i = Number(corpo.navio);
                if (!Number.isInteger(i) || i < 0 || i >= e.frota.length) return 'Escolha um navio.';
                if (acao === 'tirar') frota[i] = null;
                else {
                  const casas = casasDoNavio(Number(corpo.casa), e.frota[i], corpo.deitado === true, e.n);
                  if (!casas) return 'O navio não cabe aí.';
                  if (encosta(casas, frota.filter((_, k) => k !== i), e.n)) return 'Os navios não podem encostar um no outro.';
                  frota[i] = casas;
                }
              } else return 'Ação desconhecida.';
              acertar(e, lado);
              return null;
            },
            pronto: (e, lado) => e.prontos[lado],
            completar(e, lado) {
              e.frotas[lado] = sortearFrota(aleatorio, e.frotas[lado], e.n, e.frota);
              acertar(e, lado);
              e.prontos[lado] = true;
            },
          },
          jogar(e, lado, corpo) {
            if (e.salvo) return rajada(e, lado, corpo);
            if (corpo.arma !== undefined) return usarArma(e, lado, corpo);
            const casa = Number(corpo.casa);
            if (!Number.isInteger(casa) || casa < 0 || casa >= e.n * e.n) return 'Escolha uma casa do mar.';
            const outro: Lado = lado === 0 ? 1 : 0;
            const alvo = e.mares[outro];
            if (alvo.tiros[casa]) return 'Você já atirou nessa casa.';
            alvo.tiros[casa] = true;
            const navio = alvo.navios.find((casas) => casas.includes(casa));
            if (!navio) {
              e.ultimo = { lado, casa, resultado: 'agua' };
              return { proximo: outro };
            }
            e.ultimo = { lado, casa, resultado: afundado(alvo, navio) ? 'afundou' : 'acertou' };
            if (alvo.navios.every((casas) => afundado(alvo, casas))) {
              e.revelado = true;
              return { proximo: lado, vencedor: lado };
            }
            // Acertou: atira de novo.
            return { proximo: lado };
          },
          livre(e, lado, corpo) {
            if (corpo.acao !== 'sortear') return 'Ação desconhecida.';
            const meu = e.mares[lado];
            if (meu.tiros.some(Boolean)) return 'Já atiraram no seu mar: a frota não muda mais.';
            meu.navios = sortearFrota(aleatorio, [], e.n, e.frota);
            return null;
          },
          // o robô mira só pelo que se vê do mar do outro: os tiros, o fogo, os navios já afundados e os tamanhos que restam
          robo: (e, lado, sorte, nivel) => {
            const alvo = e.mares[lado === 0 ? 1 : 0];
            const visto = marPublico(alvo, false);
            if (e.armas && !e.salvo) return jogadaDoRoboComArmas(e, lado, nivel, sorte);
            if (!e.salvo) return { casa: tiroNoNivel(visto, restam(alvo), nivel, sorte) };
            const casas: number[] = [];
            for (let k = tirosDaRajada(e, lado); k > 0; k--) casas.push(tiroNoNivel(visto, restam(alvo), nivel, sorte, casas));
            return { casas };
          },
          descrever: (e, _lado, corpo) =>
            corpo.arma === 'sonar' && e.sonares?.length
              ? `◎${nomeDaCasaDoMar(e.sonares[e.sonares.length - 1].centro, e.n)}:${e.sonares[e.sonares.length - 1].navios}`
              : e.rajada && (e.salvo || (corpo.arma === 'cruz' && e.rajada.arma === 'cruz'))
              ? e.rajada.tiros.map((t) => nomeDaCasaDoMar(t.casa, e.n) + SINAL[t.resultado]).join(' ')
              : e.ultimo
                ? nomeDaCasaDoMar(e.ultimo.casa, e.n) + SINAL[e.ultimo.resultado]
                : '',
          publico(e, lado) {
            const mares = [0, 1].map((l) => marPublico(e.mares[l], e.revelado || l === lado));
            return {
              mares,
              restam: [restam(e.mares[0]), restam(e.mares[1])],
              ultimo: e.ultimo,
              salvo: e.salvo,
              mar: e.n,
              frota: e.frota,
              rajada: e.rajada,
              // as armas especiais (21/11/2026): quais cada lado já usou, e os sonares (a área e o número, para todos)
              armas: e.armas === true,
              usadas: e.usadas ?? null,
              sonares: e.sonares ?? [],
              // quantos tiros cada lado tem na próxima rajada do salvo
              tirosDaRajada: e.salvo ? [tirosDaRajada(e, 0), tirosDaRajada(e, 1)] : null,
              // a precisão de cada lado: os tiros que deu e os que acertaram (no mar do outro)
              pontaria: [0, 1].map((l) => {
                const alvo = e.mares[l === 0 ? 1 : 0];
                const fogo = new Set(alvo.navios.flat());
                return { tiros: alvo.tiros.filter(Boolean).length, acertos: alvo.tiros.filter((t, c) => t && fogo.has(c)).length };
              }),
              // na montagem: a frota de quem pede (com o lugar de cada navio, na ordem da FROTA), e quem já está pronto
              montagem: { navios: lado === null ? null : e.frotas[lado], prontos: e.prontos },
            };
          },
        },
        aleatorio,
      );
      const jogo = mesa.comecar(ctx, opcoes);
      if (typeof jogo === 'string') return jogo;
      // A mesa acaba também pelo prazo e por desistência, que as regras não veem: no fim, qualquer que seja o motivo,
      // os navios aparecem para todos.
      const comFim: Jogo = {
        ...jogo,
        publico(quem) {
          const vista = jogo.publico(quem);
          if (vista.fase === 'fim' && estado && !estado.revelado) {
            estado.revelado = true;
            return jogo.publico(quem);
          }
          return vista;
        },
      };
      return comFim;
    },
  };
}

export const naval = criarNaval();
