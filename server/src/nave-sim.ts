/**
 * A ESQUADRILHA DA TOCA (05/11/2026): a regra da navinha. Este arquivo tem DUAS CÓPIAS IGUAIS BYTE A BYTE:
 * server/src/nave-sim.ts e web/src/nave/sim.ts (os dois testes da nave conferem). O roteiro das ondas, o trajeto de cada
 * inimigo, os tiros deles, as balas da nave e a FICHA de cada piloto (vidas, bomba, arma, escudo, pontos) saem daqui; o site
 * joga com esta conta, e o servidor confere com a mesma.
 *
 * Só a mecânica do gênero dos jogos de nave de rolagem vertical (ondas, power-ups, bomba que limpa a tela, um chefe no fim);
 * nada de nome, nave, inimigo, arte ou som de ninguém. Os pilotos são os nossos coelhos em aviõezinhos de cenoura, e os
 * inimigos são a praga da horta: corvos, vespas, besouros e o espantalho mecânico.
 *
 * DETERMINISMO: passos fixos de 1/60 s, e as contas que os dois lados fazem usam só + − × ÷, Math.floor, Math.abs e
 * Math.sqrt (que dão o mesmo número em qualquer navegador). O vaivém das curvas é uma parábola, não o seno. O sorteio é o
 * mulberry32 (inteiros de 32 bits).
 */

/** A tela, em unidades do jogo (o site a amplia em pixels inteiros). */
export const LARGURA = 180;
export const ALTURA = 240;
export const PASSOS_POR_S = 60;

export const ONDAS = 5;
/** Cada onda dura isto, em passos (25 s), e a primeira começa em INICIO_ONDAS. */
export const ONDA_PASSOS = 1500;
export const INICIO_ONDAS = 120;
/** O chefe entra aqui, e a partida acaba em FIM (quem não o derrubou até lá, não derrubou). */
export const CHEFE_T = INICIO_ONDAS + ONDAS * ONDA_PASSOS + 60;
export const FIM = CHEFE_T + 2700;

/**
 * AS FASES (19/11/2026): a HORTA é a de sempre (cinco ondas e o espantalho mecânico). O POMAR e o CELEIRO são curtas (duas
 * ondas, já mais cheias) e cada uma tem um chefe com um padrão novo: o VESPEIRO gira tiros em espiral, e o TRATOR solta
 * paredes de tiros com um vão (achar o vão é o jogo). Escolhidas na largada; o recorde do Solo é por fase.
 */
/** As três fases de verdade (o chão, os bichos e o chefe de cada uma). */
export type FaseBase = 'horta' | 'pomar' | 'celeiro';
/**
 * A CAMPANHA (21/11/2026, o lote D): as três fases seguidas, numa partida só, com o placar somado. O chefe de cada fase tem um
 * tempo mais curto (CAMPANHA_CHEFE) para a campanha não arrastar; quem não o derrubou segue, e a fase seguinte vem do mesmo jeito.
 * Só o último chefe (o trator) fecha a partida. O recorde do Solo é à parte (a variante 'campanha').
 */
export type FaseDaNave = FaseBase | 'campanha';
export const FASES_DA_NAVE: Record<FaseBase, { ondas: number; dificuldade: number; chefe: 0 | 1 | 2; vidaDoChefe: number }> = {
  horta: { ondas: 5, dificuldade: 0, chefe: 0, vidaDoChefe: 320 },
  pomar: { ondas: 2, dificuldade: 1, chefe: 1, vidaDoChefe: 260 },
  celeiro: { ondas: 2, dificuldade: 2, chefe: 2, vidaDoChefe: 280 },
};
export const CAMPANHA: readonly FaseBase[] = ['horta', 'pomar', 'celeiro'];
/** O tempo de cada chefe no meio da campanha (o último tem o de sempre). */
export const CAMPANHA_CHEFE = 1800;
const TEMPO_DO_CHEFE = 2700;
export const ehFaseDaNave = (v: unknown): v is FaseDaNave => v === 'horta' || v === 'pomar' || v === 'celeiro' || v === 'campanha';
/** Um trecho da partida: uma fase de verdade, do começo dela à entrada do chefe e ao fim. */
export interface Trecho {
  fase: FaseBase;
  inicio: number;
  chefeT: number;
  fim: number;
}
/** As ondas, a entrada do (último) chefe e o fim de cada fase, em passos; e os trechos e o fim de cada onda. */
export function temposDaFase(fase: FaseDaNave): {
  ondas: number;
  chefeT: number;
  fim: number;
  fimDasOndas: number[];
  trechos: Trecho[];
} {
  const bases: readonly FaseBase[] = fase === 'campanha' ? CAMPANHA : [fase];
  const trechos: Trecho[] = [];
  const fimDasOndas: number[] = [];
  let inicio = 0;
  bases.forEach((b, i) => {
    const n = FASES_DA_NAVE[b].ondas;
    for (let k = 1; k <= n; k++) fimDasOndas.push(inicio + INICIO_ONDAS + k * ONDA_PASSOS);
    const chefeT = inicio + INICIO_ONDAS + n * ONDA_PASSOS + 60;
    const fim = chefeT + (i === bases.length - 1 ? TEMPO_DO_CHEFE : CAMPANHA_CHEFE);
    trechos.push({ fase: b, inicio, chefeT, fim });
    inicio = fim;
  });
  const ultimo = trechos[trechos.length - 1];
  return { ondas: fimDasOndas.length, chefeT: ultimo.chefeT, fim: ultimo.fim, fimDasOndas, trechos };
}
/** A fase de verdade que está na tela no passo `n` (na campanha, a do trecho de agora). */
export function faseNoPasso(fase: FaseDaNave, n: number): FaseBase {
  if (fase !== 'campanha') return fase;
  for (const t of temposDaFase(fase).trechos) if (n < t.fim) return t.fase;
  return CAMPANHA[CAMPANHA.length - 1];
}

/** A nave: a velocidade (unidades por passo, já contando a diagonal), o raio que leva dano, e onde nasce. */
export const VEL_NAVE = 2;
export const RAIO_NAVE = 3;
export const NASCER = { x: LARGURA / 2, y: ALTURA - 30 };
export const VIDAS = 3;
/** A piscada depois de perder uma vida, e depois de o escudo segurar um golpe. */
export const INVUL_MORTE = 150;
export const INVUL_ESCUDO = 60;
export const INVUL_BOMBA = 60;

/** Um disparo a cada CADENCIA passos (8,6 por segundo), e só nos passos múltiplos dela. */
export const CADENCIA = 7;
/** A bala some depois disto (já saiu da tela). */
export const VIDA_BALA = 64;
export const RAIO_BALA = 2;
/** O raio dos tiros dos inimigos. */
export const RAIO_TIRO = 2.5;
export const RAIO_ITEM = 9;
/** A bomba tira isto do chefe (os outros, ela derruba). */
export const BOMBA_CHEFE = 40;

export type Arma = 0 | 1 | 2;
/**
 * O NÍVEL DA ARMA (19/11/2026): pegar de novo a arma que já se tem sobe o nível dela (até 3); pegar a outra volta ao 1.
 * Cada nível bate mais forte: o dano de cada bala.
 */
export type Nivel = 1 | 2 | 3;
export const DANO_DO_NIVEL: Record<Nivel, number> = { 1: 1, 2: 1.5, 3: 2 };
/**
 * O LOOP DE ESQUIVA (19/11/2026): a nave dá uma volta no ar por LOOP_DURA passos; no meio dela (LOOP_INVUL), nada a atinge, e
 * durante a volta inteira ela não atira. Depois, LOOP_RECARGA passos até o próximo.
 */
export const LOOP_DURA = 36;
export const LOOP_INVUL: [number, number] = [6, 30];
export const LOOP_RECARGA = 300;
/** A esquadrilha intacta: no fim, se ninguém da turma perdeu vida, cada um ganha isto (a medalha que vale mais). */
export const SEM_QUEDA = 1500;
/** As armas: 0 é o tiro simples, 1 o duplo, 2 o espalhado. */
export const ARMAS = ['simples', 'duplo', 'espalhado'] as const;
/** As balas de cada disparo: o deslocamento de onde sai, e a velocidade (unidades por passo). */
export const VOLEIAS: readonly (readonly {
  ox: number;
  vx: number;
  vy: number;
}[])[] = [
  [{ ox: 0, vx: 0, vy: -5 }],
  [
    { ox: -4, vx: 0, vy: -5 },
    { ox: 4, vx: 0, vy: -5 },
  ],
  [
    { ox: 0, vx: 0, vy: -5 },
    { ox: -2, vx: -1.3, vy: -4.8 },
    { ox: 2, vx: 1.3, vy: -4.8 },
  ],
];

export type Item = 'duplo' | 'espalhado' | 'escudo';
/**
 * O BICHO DE CADA FASE (21/11/2026, o lote D): a MARIPOSA só no pomar (desce em voltas, larga e devagar, soltando o pó em leque) e
 * o MORCEGO só no celeiro (mergulha em V do alto de um lado ao outro, em bando, e solta o leque no fundo do mergulho).
 */
export type TipoDeInimigo = 'corvo' | 'vespa' | 'besouro' | 'chefe' | 'mariposa' | 'morcego';
export type Padrao = 'reto' | 'leque3' | 'leque5' | 'roda8' | 'roda12' | 'chuva' | 'roda8b' | 'parede' | 'parede2';

export const RAIO: Record<TipoDeInimigo, number> = {
  corvo: 7,
  vespa: 6,
  besouro: 10,
  chefe: 20,
  mariposa: 7,
  morcego: 6,
};
export const PONTOS: Record<TipoDeInimigo, number> = {
  corvo: 100,
  vespa: 150,
  besouro: 400,
  chefe: 5000,
  mariposa: 250,
  morcego: 200,
};
/** Cada bala no chefe vale isto, além do abate. */
export const PONTOS_NO_CHEFE = 10;
/**
 * O RASPÃO (20/11/2026, a segunda auditoria): o tiro inimigo que passa a até RASPAO_RAIO do centro da nave SEM acertar (mais
 * longe que RAIO_NAVE + RAIO_TIRO) vale RASPAO_PONTOS, uma vez por tiro. Conta no passo em que o tiro já passou do ponto mais
 * perto (está se afastando da nave); piscando ou no meio do loop, não conta (ali não há risco).
 */
export const RASPAO_RAIO = 10;
export const RASPAO_PONTOS = 25;
/** O tiro (de lugar b no passo q) está de raspão na nave em (x, y): perto, sem acertar, e já se afastando? */
export function deRaspao(b: { x: number; y: number }, vx: number, vy: number, x: number, y: number): boolean {
  const dx = b.x - x;
  const dy = b.y - y;
  const d2 = dx * dx + dy * dy;
  const acerta = RAIO_NAVE + RAIO_TIRO;
  return d2 > acerta * acerta && d2 <= RASPAO_RAIO * RASPAO_RAIO && dx * vx + dy * vy > 0;
}

/** Por onda atravessada com vida, e por vida que sobra no fim. */
export const SOBREVIVER = 500;
export const POR_VIDA = 1000;

/** Um inimigo do roteiro: quando aparece, por quanto tempo (passos), o trajeto, a vida, o item que solta e os tiros. */
export interface Inimigo {
  tipo: TipoDeInimigo;
  t: number;
  dur: number;
  /** Os números do trajeto (o que cada um quer dizer depende do tipo: ver `posicaoInimigo`). */
  rota: number[];
  vida: number;
  item: Item | null;
  /** [passo desde que apareceu, padrão] de cada tiro. */
  tiros: [number, Padrao][];
  /** A velocidade dos tiros dele. */
  vt: number;
}

/** O sorteio: mulberry32, só com inteiros de 32 bits. */
export function sorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** O vaivém, sem seno: uma parábola de cada lado, que vai de −1 a 1 e volta em cada ciclo (f em ciclos). */
export function vaivem(f: number): number {
  const g = f - Math.floor(f);
  const x = 2 * g - 1;
  return -4 * x * (1 - Math.abs(x));
}

/** Onde o inimigo está no passo `n`, ou null se ainda não apareceu ou já foi embora. */
export function posicaoInimigo(e: Inimigo, n: number): { x: number; y: number } | null {
  const s = n - e.t;
  if (s < 0 || s > e.dur) return null;
  const r = e.rota;
  if (e.tipo === 'corvo') {
    // a curva de três pontos (entra por um lado, mergulha, sai pelo outro)
    const u = s / e.dur;
    const a = (1 - u) * (1 - u);
    const b = 2 * u * (1 - u);
    const c = u * u;
    return {
      x: a * r[0] + b * r[2] + c * r[4],
      y: a * r[1] + b * r[3] + c * r[5],
    };
  }
  if (e.tipo === 'vespa') {
    // desce em zigue-zague: [x0, y0, vy, amplitude, período]
    return { x: r[0] + r[3] * vaivem(s / r[4]), y: r[1] + r[2] * s };
  }
  if (e.tipo === 'besouro') {
    // [x0, yAlvo, entrada, pausa, vx]: desce freando, para atirando, e vai embora acelerando
    const [x0, alvo, entrada, pausa, vx] = r;
    if (s < entrada) {
      const u = s / entrada;
      return { x: x0, y: -16 + (alvo + 16) * (1 - (1 - u) * (1 - u)) };
    }
    if (s < entrada + pausa) return { x: x0 + 6 * vaivem((s - entrada) / 160), y: alvo };
    const k = s - entrada - pausa;
    return { x: x0 + vx * k, y: alvo + 0.012 * k * k };
  }
  if (e.tipo === 'mariposa') {
    // [centro x, y0, vy, raio, período]: desce dando voltas (o vaivém de um eixo um quarto de volta atrás do outro)
    const [cx, y0, vy, raio, periodo] = r;
    return { x: cx + raio * vaivem(s / periodo), y: y0 + vy * s + raio * 0.6 * vaivem(s / periodo + 0.25) };
  }
  if (e.tipo === 'morcego') {
    // [x0, y0, x do fundo, y do fundo, x2]: o mergulho em V (desce até o fundo e sobe para o outro lado)
    const [x0, y0, xm, ym, x2] = r;
    const u = s / e.dur;
    if (u < 0.5) {
      const v = u * 2;
      return { x: x0 + (xm - x0) * v, y: y0 + (ym - y0) * v };
    }
    const v = u * 2 - 1;
    return { x: xm + (x2 - xm) * v, y: ym + (y0 - ym) * v };
  }
  // o chefe: entra devagar e passeia de um lado para o outro (o vespeiro mais depressa; o trator mais baixo e devagar)
  const variante = r[0] ?? 0;
  const alto = variante === 2 ? 64 : 56;
  if (s < 180) {
    const u = s / 180;
    return { x: LARGURA / 2, y: -40 + (alto + 40) * (1 - (1 - u) * (1 - u)) };
  }
  const k = s - 180;
  if (variante === 1)
    return {
      x: LARGURA / 2 + 62 * vaivem(k / 360),
      y: 50 + 14 * vaivem(k / 180),
    };
  if (variante === 2)
    return {
      x: LARGURA / 2 + 48 * vaivem(k / 900),
      y: alto + 4 * vaivem(k / 450),
    };
  return { x: LARGURA / 2 + 55 * vaivem(k / 600), y: 56 + 8 * vaivem(k / 300) };
}

/** As direções de cada padrão de tiro (comprimento 1), sem seno: os vetores saem de raízes. */
const R2 = Math.sqrt(0.5);
const R3 = Math.sqrt(3) / 2;
/** O cosseno e o seno de 22,5°, por raízes. */
const C22 = Math.sqrt((1 + R2) / 2);
const S22 = Math.sqrt((1 - R2) / 2);
function normal(x: number, y: number): [number, number] {
  const d = Math.sqrt(x * x + y * y);
  return [x / d, y / d];
}
export const DIRECOES: Record<Padrao, [number, number][]> = {
  reto: [[0, 1]],
  leque3: [normal(-0.35, 1), [0, 1], normal(0.35, 1)],
  leque5: [normal(-0.7, 1), normal(-0.35, 1), [0, 1], normal(0.35, 1), normal(0.7, 1)],
  roda8: [
    [1, 0],
    [R2, R2],
    [0, 1],
    [-R2, R2],
    [-1, 0],
    [-R2, -R2],
    [0, -1],
    [R2, -R2],
  ],
  roda12: [
    [1, 0],
    [R3, 0.5],
    [0.5, R3],
    [0, 1],
    [-0.5, R3],
    [-R3, 0.5],
    [-1, 0],
    [-R3, -0.5],
    [-0.5, -R3],
    [0, -1],
    [0.5, -R3],
    [R3, -0.5],
  ],
  chuva: [
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
  ],
  // a roda girada de 22,5°: alternada com a roda8, vira a espiral do vespeiro
  roda8b: [
    [C22, S22],
    [S22, C22],
    [-S22, C22],
    [-C22, S22],
    [-C22, -S22],
    [-S22, -C22],
    [S22, -C22],
    [C22, -S22],
  ],
  // a parede do trator: tiros lado a lado com um vão (à esquerda, e na parede2 à direita)
  parede: [
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
  ],
  parede2: [
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
  ],
};
/** Na chuva, os tiros saem lado a lado; na parede, com um vão. */
const CHUVA_OX = [-24, -12, 0, 12, 24];
const PAREDE_OX = [-36, 0, 12, 24, 36, 48, 60];
const PAREDE2_OX = [-60, -48, -36, -24, -12, 0, 36];

/** Um tiro de inimigo: quando sai, de onde, a velocidade, e de quem é (morto antes disso, não atira). */
export interface TiroInimigo {
  t: number;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  dono: number;
}

/** Todos os tiros dos inimigos da partida, em ordem de saída. */
export function tirosDosInimigos(inimigos: Inimigo[]): TiroInimigo[] {
  const tiros: TiroInimigo[] = [];
  inimigos.forEach((e, dono) => {
    for (const [s, padrao] of e.tiros) {
      const p = posicaoInimigo(e, e.t + s);
      if (!p) continue;
      DIRECOES[padrao].forEach(([dx, dy], k) => {
        const ox = padrao === 'chuva' ? CHUVA_OX[k] : padrao === 'parede' ? PAREDE_OX[k] : padrao === 'parede2' ? PAREDE2_OX[k] : 0;
        tiros.push({
          t: e.t + s,
          x0: p.x + ox,
          y0: p.y + 4,
          vx: dx * e.vt,
          vy: dy * e.vt,
          dono,
        });
      });
    }
  });
  return tiros.sort((a, b) => a.t - b.t);
}

/** Onde o tiro do inimigo está no passo `n`, ou null fora da tela (ou antes de sair). */
export function posicaoTiro(b: TiroInimigo, n: number): { x: number; y: number } | null {
  const k = n - b.t;
  if (k < 0) return null;
  const x = b.x0 + b.vx * k;
  const y = b.y0 + b.vy * k;
  if (x < -8 || x > LARGURA + 8 || y < -8 || y > ALTURA + 8) return null;
  return { x, y };
}

/** Onde a bala `b` de um disparo no passo `p`, da nave em (x, y), com a arma `arma`, está no passo `n`. */
export function posicaoBala(p: number, x: number, y: number, arma: Arma, b: number, n: number): { x: number; y: number } | null {
  const v = VOLEIAS[arma]?.[b];
  const k = n - p;
  if (!v || k < 0 || k > VIDA_BALA) return null;
  const bx = x + v.ox + v.vx * k;
  const by = y - 6 + v.vy * k;
  if (bx < -6 || bx > LARGURA + 6 || by < -10) return null;
  return { x: bx, y: by };
}

/** Onde o item de quem caiu no passo `q` está no passo `n` (ele desce devagar), ou null se já saiu por baixo. */
export function posicaoItem(e: Inimigo, q: number, n: number): { x: number; y: number } | null {
  const p = posicaoInimigo(e, q);
  if (!p || n < q) return null;
  const y = p.y + 0.7 * (n - q);
  if (y > ALTURA + 10) return null;
  return { x: Math.max(8, Math.min(LARGURA - 8, p.x)), y };
}

/** O passo em que a onda `k` (de 1 a ONDAS) termina. */
export const fimDaOnda = (k: number) => INICIO_ONDAS + k * ONDA_PASSOS;

/**
 * O ROTEIRO DA PARTIDA, pela semente: cinco ondas, cada uma mais cheia e com mais tiros, e o chefe. Em cada onda, grupos
 * seguidos: uma fila de corvos que mergulha de um lado ao outro, vespas descendo em zigue-zague, ou besouros que param e
 * atiram em leque. Dois inimigos por onda soltam um item (o primeiro da partida é sempre o tiro duplo).
 */
export function roteiro(semente: number, faseDaNave: FaseDaNave = 'horta'): Inimigo[] {
  const r = sorteio(semente);
  const inimigos: Inimigo[] = [];
  const itens = { primeiro: true };
  // cada trecho (na campanha, as três fases seguidas) com o mesmo sorteio, na ordem
  for (const tr of temposDaFase(faseDaNave).trechos) roteiroDoTrecho(r, semente, inimigos, itens, tr);
  return inimigos;
}

function roteiroDoTrecho(r: () => number, semente: number, inimigos: Inimigo[], itens: { primeiro: boolean }, tr: Trecho) {
  const def = FASES_DA_NAVE[tr.fase];
  for (let onda = 1; onda <= def.ondas; onda++) {
    const base = tr.inicio + INICIO_ONDAS + (onda - 1) * ONDA_PASSOS;
    // nas fases curtas, as ondas já começam mais cheias
    const n = onda + def.dificuldade;
    const vt = 1 + 0.12 * n;
    const candidatos: number[] = [];
    let t = base + 30;
    while (t < base + ONDA_PASSOS - 220) {
      const g = r();
      if (g < 0.45) {
        const quantos = 4 + Math.floor(r() * 2) + (n >= 3 ? 1 : 0);
        const daEsquerda = r() < 0.5;
        const y0 = 16 + r() * 40;
        const x1 = LARGURA / 2 + (r() - 0.5) * 60;
        const y1 = 130 + r() * 70;
        const y2 = 20 + r() * 60;
        const dur = 230 - n * 12;
        const atira = r() < 0.2 + 0.12 * n;
        const quando = Math.round(dur * (0.3 + r() * 0.2));
        for (let k = 0; k < quantos; k++) {
          inimigos.push({
            tipo: 'corvo',
            t: t + k * 11,
            dur,
            rota: daEsquerda ? [-12, y0, x1, y1, LARGURA + 12, y2] : [LARGURA + 12, y0, x1, y1, -12, y2],
            vida: 1,
            item: null,
            tiros: atira && k % 2 === 0 ? [[quando, 'reto']] : [],
            vt,
          });
        }
        candidatos.push(inimigos.length - 1);
        t += 150 + Math.round(r() * 80) - n * 8 + quantos * 6;
      } else if (g < 0.75) {
        const quantas = 3 + (n >= 4 ? 1 : 0);
        const vy = 0.8 + 0.1 * n;
        for (let k = 0; k < quantas; k++) {
          const x0 = 24 + ((k + 0.5) * (LARGURA - 48)) / quantas + (r() - 0.5) * 16;
          const y0 = -10 - k * 22;
          const tiros: [number, Padrao][] = [];
          for (let s = 50 + Math.round(r() * 30); s < 220; s += 90 - n * 6) if (r() < 0.35 + 0.1 * n) tiros.push([s, 'reto']);
          inimigos.push({
            tipo: 'vespa',
            t,
            dur: Math.ceil((ALTURA + 20 - y0) / vy),
            rota: [x0, y0, vy, 16 + r() * 18, 90 + Math.round(r() * 50)],
            vida: 2,
            item: null,
            tiros,
            vt,
          });
        }
        t += 170 + Math.round(r() * 60) - n * 8;
      } else {
        const dois = n >= 3 && r() < 0.6;
        const xs = dois ? [48 + r() * 12, LARGURA - 48 - r() * 12] : [40 + r() * (LARGURA - 80)];
        const pausa = 180 + 20 * n;
        for (const x0 of xs) {
          const tiros: [number, Padrao][] = [];
          let k = 0;
          for (let s = 60 + 30; s < 60 + pausa; s += 70 - n * 4, k++) {
            const padrao: Padrao = n >= 5 && k % 2 === 1 ? 'roda8' : n >= 3 ? 'leque5' : 'leque3';
            tiros.push([s, padrao]);
          }
          inimigos.push({
            tipo: 'besouro',
            t,
            dur: 60 + pausa + 160,
            rota: [x0, 40 + r() * 30, 60, pausa, r() < 0.5 ? -0.8 : 0.8],
            vida: 7 + n,
            item: null,
            tiros,
            vt,
          });
          candidatos.push(inimigos.length - 1);
        }
        t += 230 + Math.round(r() * 40);
      }
    }
    // os itens da onda: dois dos candidatos (o último corvo de cada fila e os besouros)
    for (let k = 0; k < 2 && candidatos.length > 0; k++) {
      const i = candidatos.splice(Math.floor(r() * candidatos.length), 1)[0];
      const sorte = r();
      inimigos[i].item = itens.primeiro ? 'duplo' : sorte < 0.36 ? 'duplo' : sorte < 0.7 ? 'espalhado' : 'escudo';
      itens.primeiro = false;
    }
  }
  // O BICHO DA FASE (21/11/2026): por um sorteio À PARTE (o das ondas fica igual ao de antes), uns bandos por onda, entre os outros
  bichosDaFase(sorteio((semente ^ 0x5bd1e995) + tr.inicio), inimigos, tr);
  // o chefe: o espantalho mecânico alterna a roda, o leque e a chuva, cada vez mais depressa; o vespeiro gira a roda em
  // espiral (a roda e a roda girada, bem seguidas); o trator solta paredes com o vão de um lado e do outro
  const tiros: [number, Padrao][] = [];
  const ciclos: Padrao[][] = [
    ['roda12', 'leque5', 'chuva', 'leque5'],
    ['roda8', 'roda8b', 'roda8', 'roda8b', 'leque3'],
    ['parede', 'leque3', 'parede2', 'leque5'],
  ];
  const ciclo = ciclos[def.chefe];
  const ritmo = def.chefe === 1 ? 40 : def.chefe === 2 ? 95 : 80;
  const minimo = def.chefe === 1 ? 26 : 50;
  let k = 0;
  for (let s = 200; s < tr.fim - tr.chefeT - 30; s += Math.max(minimo, ritmo - Math.floor(s / 400) * 4), k++) tiros.push([s, ciclo[k % ciclo.length]]);
  inimigos.push({
    tipo: 'chefe',
    t: tr.chefeT,
    dur: tr.fim - tr.chefeT,
    rota: def.chefe === 0 ? [] : [def.chefe],
    vida: def.vidaDoChefe,
    item: null,
    tiros,
    vt: def.chefe === 1 ? 1.1 : 1.3,
  });
}

/**
 * Os bichos de cada fase (21/11/2026): no pomar, três pares de MARIPOSAS por onda; no celeiro, três bandos de MORCEGOS. A horta não
 * tem (o roteiro dela é o de sempre). Um bando por onda solta o escudo.
 */
function bichosDaFase(r: () => number, inimigos: Inimigo[], tr: Trecho) {
  if (tr.fase === 'horta') return;
  const def = FASES_DA_NAVE[tr.fase];
  for (let onda = 1; onda <= def.ondas; onda++) {
    const base = tr.inicio + INICIO_ONDAS + (onda - 1) * ONDA_PASSOS;
    const n = onda + def.dificuldade;
    const vt = 1 + 0.12 * n;
    let comItem = Math.floor(r() * 3);
    for (const atraso of [260, 680, 1100]) {
      const t = base + atraso + Math.round(r() * 60);
      if (tr.fase === 'pomar') {
        // as mariposas: duas lado a lado, descendo em voltas largas; o pó em leque duas vezes na descida
        const vy = 0.5 + 0.04 * n;
        const raio = 20 + r() * 8;
        const periodo = 140 + Math.round(r() * 40);
        for (const lado of [-1, 1]) {
          const cx = LARGURA / 2 + lado * (38 + r() * 14);
          inimigos.push({
            tipo: 'mariposa',
            t,
            dur: Math.ceil((ALTURA + 30 + raio) / vy),
            rota: [cx, -12 - raio, vy, raio, periodo],
            vida: 3,
            item: comItem === 0 && lado > 0 ? 'escudo' : null,
            tiros: [
              [90, 'leque3'],
              [200, 'leque3'],
            ],
            vt,
          });
        }
      } else {
        // os morcegos: um bando de três mergulhando em V de um lado ao outro, um atrás do outro; o leque no fundo do mergulho
        const daEsquerda = r() < 0.5;
        const xm = LARGURA / 2 + (r() - 0.5) * 70;
        const ym = 120 + r() * 50;
        const dur = 170 - n * 6;
        for (let j = 0; j < 3; j++) {
          inimigos.push({
            tipo: 'morcego',
            t: t + j * 16,
            dur,
            rota: daEsquerda ? [-12, 20 + j * 10, xm, ym, LARGURA + 12] : [LARGURA + 12, 20 + j * 10, xm, ym, -12],
            vida: 2,
            item: comItem === 0 && j === 2 ? 'escudo' : null,
            tiros: j === 1 ? [[Math.round(dur / 2), 'leque3']] : [],
            vt,
          });
        }
      }
      comItem--;
    }
  }
}

const perto = (a: { x: number; y: number }, x: number, y: number, raio: number) => (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) <= raio * raio;
const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A FICHA DE UM PILOTO: o que ele derrubou, a arma, as vidas, a bomba, o escudo e os pontos. O site a usa para jogar (o
 * placar da tela é a mesma conta) e o servidor para conferir: cada evento é recusado se não bate com o roteiro.
 *
 * O que ela confere, sem saber onde a nave estava de verdade: o disparo só nos passos da cadência e com a arma que a pessoa
 * tinha, a bala no lugar do inimigo no passo do acerto, cada bala uma vez, a nave sem andar mais rápido do que anda entre um
 * lugar dito e outro (fora a volta ao começo quando perde uma vida), o item no lugar de onde caiu. Quem leva dano é quem diz
 * (como o repolho do kart): o servidor não sabe onde estavam os tiros na tela de cada um.
 */
export class Ficha {
  vidas = VIDAS;
  bombas = 1;
  escudo = false;
  invulAte = -1;
  /** [passo, arma, nível] a cada troca, em ordem. */
  armas: [number, Arma, Nivel][] = [[0, 0, 1]];
  /** Os passos em que começou cada loop de esquiva. */
  loops: number[] = [];
  /** Quem caiu, e em que passo. */
  mortos = new Map<number, number>();
  /** O dano em quem ainda não caiu. */
  dano = new Map<number, number>();
  /** Os itens já pegos (pelo índice de quem os soltou). */
  pegos = new Set<number>();
  usados = new Set<string>();
  /** Os lugares ditos da nave, em ordem de passo. */
  posicoes: { p: number; x: number; y: number }[] = [];
  /** Os passos em que perdeu uma vida (a nave volta ao começo). */
  mortes: number[] = [];
  pontos = 0;
  morteFinal: number | null = null;
  chefeEm: number | null = null;
  ultimoQ = 0;
  /** Os que caíram desde a última vez que alguém leu (o servidor repassa à turma). */
  novos: number[] = [];
  /** Os passos das bombas (a bomba limpa os tiros que já tinham saído), e os tiros já contados de raspão. */
  bombasEm: number[] = [];
  raspados = new Set<number>();

  readonly tempos: ReturnType<typeof temposDaFase>;
  private _tiros: TiroInimigo[] | null = null;
  /** Os tiros dos inimigos, na mesma ordem do site (o índice vai no evento do raspão). */
  get tirosInimigos(): TiroInimigo[] {
    return (this._tiros ??= tirosDosInimigos(this.inimigos));
  }

  constructor(
    readonly inimigos: Inimigo[],
    readonly fase: FaseDaNave = 'horta',
  ) {
    this.tempos = temposDaFase(fase);
  }

  get acabou() {
    return this.morteFinal !== null || this.chefeEm !== null;
  }
  vivoEm(n: number) {
    return this.morteFinal === null || n < this.morteFinal;
  }
  armaEm(n: number): Arma {
    let a: Arma = 0;
    for (const [p, arma] of this.armas) if (p <= n) a = arma;
    return a;
  }
  nivelEm(n: number): Nivel {
    let v: Nivel = 1;
    for (const [p, , nivel] of this.armas) if (p <= n) v = nivel;
    return v;
  }
  /** O loop que está acontecendo no passo n (o passo em que começou), ou null. */
  loopEm(n: number): number | null {
    for (let i = this.loops.length - 1; i >= 0; i--) if (this.loops[i] <= n && n < this.loops[i] + LOOP_DURA) return this.loops[i];
    return null;
  }
  /** No meio do loop, nada atinge a nave. */
  invulNoLoop(n: number): boolean {
    const l = this.loopEm(n);
    return l !== null && n >= l + LOOP_INVUL[0] && n < l + LOOP_INVUL[1];
  }
  /** O próximo loop pode começar no passo n? */
  loopPronto(n: number): boolean {
    const ultimo = this.loops[this.loops.length - 1];
    return ultimo === undefined || n >= ultimo + LOOP_RECARGA;
  }

  /** O lugar dito bate com os outros (a nave não anda mais que VEL_NAVE por passo)? E o guarda, se bater. */
  lugar(p: number, x: number, y: number): boolean {
    if (!numero(x) || !numero(y) || x < -2 || x > LARGURA + 2 || y < -2 || y > ALTURA + 2) return false;
    const ps = this.posicoes;
    let lo = 0;
    let hi = ps.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (ps[m].p < p) lo = m + 1;
      else hi = m;
    }
    if (lo < ps.length && ps[lo].p === p) return Math.abs(ps[lo].x - x) <= 0.02 && Math.abs(ps[lo].y - y) <= 0.02;
    const cabe = (dx: number, dy: number, passos: number) => {
      const max = VEL_NAVE * passos + 2;
      return dx * dx + dy * dy <= max * max;
    };
    // de onde ela veio: o último lugar dito, ou o começo, se perdeu uma vida depois dele (a nave fica no lugar do golpe no
    // passo dele, e já está no começo no seguinte)
    const antes = lo > 0 ? ps[lo - 1] : null;
    let morte: number | null = null;
    for (const m of this.mortes) if (m < p) morte = m;
    if (morte !== null && (!antes || morte >= antes.p)) {
      if (!cabe(x - NASCER.x, y - NASCER.y, p - morte)) return false;
    } else if (antes && !cabe(x - antes.x, y - antes.y, p - antes.p)) return false;
    // para onde ela foi (se uma vida se perdeu no meio, a volta ao começo explica o salto)
    const depois = lo < ps.length ? ps[lo] : null;
    if (depois && !this.mortes.some((m) => m >= p && m < depois.p) && !cabe(depois.x - x, depois.y - y, depois.p - p)) return false;
    ps.splice(lo, 0, { p, x, y });
    return true;
  }

  private tempo(q: unknown): string | null {
    if (!inteiro(q) || q < 0 || q > this.tempos.fim) return 'Evento inválido.';
    if (q < this.ultimoQ) return 'Evento fora de ordem.';
    return null;
  }

  private derrubar(i: number, q: number) {
    const e = this.inimigos[i];
    this.mortos.set(i, q);
    this.dano.delete(i);
    this.pontos += PONTOS[e.tipo];
    this.novos.push(i);
    // só o último chefe fecha a partida (na campanha, os do meio caem e ela segue)
    if (e.tipo === 'chefe' && i === this.inimigos.length - 1) this.chefeEm = q;
  }

  /** A bala `b` do disparo em `p`, da nave em (x, y), acertou o inimigo `i` no passo `q`. */
  acerto(q: number, i: number, p: number, x: number, y: number, arma: number, b: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (this.chefeEm !== null) return 'Evento inválido.';
    if (!inteiro(i) || !inteiro(p) || !inteiro(b) || !inteiro(arma) || i < 0 || i >= this.inimigos.length) return 'Evento inválido.';
    if (p < 0 || p % CADENCIA !== 0 || q - p < 0 || q - p > VIDA_BALA || !this.vivoEm(p)) return 'Disparo inválido.';
    if (arma !== this.armaEm(p) || b < 0 || b >= VOLEIAS[arma].length) return 'Disparo inválido.';
    // no loop, a nave não atira
    if (this.loopEm(p) !== null) return 'Disparo inválido.';
    if (this.mortos.has(i)) return 'Este já caiu.';
    const chave = `${p}:${b}`;
    if (this.usados.has(chave)) return 'Disparo inválido.';
    const e = this.inimigos[i];
    const alvo = posicaoInimigo(e, q);
    const bala = posicaoBala(p, x, y, arma as Arma, b, q);
    if (!alvo || !bala || !perto(alvo, bala.x, bala.y, RAIO[e.tipo] + RAIO_BALA + 0.5)) return 'Acerto inválido.';
    if (!this.lugar(p, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.usados.add(chave);
    const dano = (this.dano.get(i) ?? 0) + DANO_DO_NIVEL[this.nivelEm(p)];
    if (dano >= e.vida) this.derrubar(i, q);
    else {
      this.dano.set(i, dano);
      if (e.tipo === 'chefe') this.pontos += PONTOS_NO_CHEFE;
    }
    return null;
  }

  /** A nave em (x, y) pegou, no passo `q`, o item que o inimigo `i` soltou. */
  pegar(q: number, i: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || !inteiro(i) || i < 0 || i >= this.inimigos.length) return 'Evento inválido.';
    const e = this.inimigos[i];
    const caiu = this.mortos.get(i);
    if (!e.item || caiu === undefined || q < caiu || this.pegos.has(i)) return 'Item inválido.';
    const item = posicaoItem(e, caiu, q);
    if (!item || !perto(item, x, y, RAIO_ITEM + RAIO_NAVE + 0.5)) return 'Item inválido.';
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.pegos.add(i);
    if (e.item === 'escudo') this.escudo = true;
    else {
      const arma: Arma = e.item === 'duplo' ? 1 : 2;
      const nivel = this.armaEm(q) === arma ? (Math.min(3, this.nivelEm(q) + 1) as Nivel) : 1;
      this.armas.push([q, arma, nivel]);
    }
    return null;
  }

  /** A nave em (x, y) foi atingida no passo `q` (quem leva é quem diz). Piscando, não conta. */
  atingida(q: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || this.chefeEm !== null) return 'Evento inválido.';
    if (q < this.invulAte || this.invulNoLoop(q)) return null;
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    if (this.escudo) {
      this.escudo = false;
      this.invulAte = q + INVUL_ESCUDO;
      return null;
    }
    this.vidas--;
    this.mortes.push(q);
    this.armas.push([q, 0, 1]);
    this.bombas = 1;
    this.invulAte = q + INVUL_MORTE;
    if (this.vidas <= 0) this.morteFinal = q;
    return null;
  }

  /** A bomba, no passo `q`: derruba todos os que estão na tela, e tira BOMBA_CHEFE do chefe. */
  bomba(q: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || this.chefeEm !== null || this.bombas <= 0) return 'Sem bomba.';
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.bombas--;
    this.bombasEm.push(q);
    this.invulAte = Math.max(this.invulAte, q + INVUL_BOMBA);
    this.inimigos.forEach((e, i) => {
      if (this.mortos.has(i)) return;
      const p = posicaoInimigo(e, q);
      if (!p || p.y < -4 || p.y > ALTURA + 4 || p.x < -4 || p.x > LARGURA + 4) return;
      if (e.tipo !== 'chefe') return this.derrubar(i, q);
      const dano = (this.dano.get(i) ?? 0) + BOMBA_CHEFE;
      if (dano >= e.vida) this.derrubar(i, q);
      else {
        this.dano.set(i, dano);
        this.pontos += PONTOS_NO_CHEFE * 4;
      }
    });
    return null;
  }

  /** O loop de esquiva no passo `q`, com a nave em (x, y): só depois da recarga. */
  loop(q: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || this.chefeEm !== null || !this.loopPronto(q)) return 'Loop inválido.';
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.loops.push(q);
    return null;
  }

  /**
   * O RASPÃO (20/11/2026): o tiro `j` (o índice em tirosInimigos) passou de raspão na nave em (x, y), no passo `q`. Confere que
   * o tiro saiu (o dono estava de pé e nenhuma bomba o limpou), que está ali, perto sem acertar e se afastando, e que a nave
   * não estava piscando nem no meio do loop. Cada tiro conta uma vez.
   */
  raspao(q: number, j: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || this.chefeEm !== null || !inteiro(j) || j < 0 || j >= this.tirosInimigos.length) return 'Evento inválido.';
    if (this.raspados.has(j) || q < this.invulAte || this.invulNoLoop(q)) return 'Raspão inválido.';
    const tiro = this.tirosInimigos[j];
    const morto = this.mortos.get(tiro.dono);
    if (morto !== undefined && morto <= tiro.t) return 'Raspão inválido.';
    if (this.bombasEm.some((b) => tiro.t <= b && b <= q)) return 'Raspão inválido.';
    const b = posicaoTiro(tiro, q);
    if (!b || !numero(x) || !numero(y) || !deRaspao(b, tiro.vx, tiro.vy, x, y)) return 'Raspão inválido.';
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.raspados.add(j);
    this.pontos += RASPAO_PONTOS;
    return null;
  }

  /** Um lugar da nave, mandado de tempos em tempos (só confere e guarda). */
  posicao(q: number, x: number, y: number): string | null {
    if (!inteiro(q) || q < 0 || q > this.tempos.fim) return 'Evento inválido.';
    if (!this.vivoEm(q)) return null;
    return this.lugar(q, x, y) ? null : 'Lugar inválido.';
  }

  /**
   * Um evento do jeito que vai pela rede: ['a', q, i, p, x, y, arma, b], ['g', q, i, x, y], ['d', q, x, y], ['b', q, x, y],
   * desde 19/11/2026, o loop ['l', q, x, y], e desde 20/11/2026 o raspão ['r', q, j, x, y].
   */
  aplicar(ev: unknown): string | null {
    if (!Array.isArray(ev)) return 'Evento inválido.';
    const [tipo, q] = ev;
    if (tipo === 'a') return this.acerto(q, ev[2], ev[3], ev[4], ev[5], ev[6], ev[7]);
    if (tipo === 'g') return this.pegar(q, ev[2], ev[3], ev[4]);
    if (tipo === 'd') return this.atingida(q, ev[2], ev[3]);
    if (tipo === 'b') return this.bomba(q, ev[2], ev[3]);
    if (tipo === 'l') return this.loop(q, ev[2], ev[3]);
    if (tipo === 'r') return this.raspao(q, ev[2], ev[3], ev[4]);
    return 'Evento inválido.';
  }

  /** As ondas atravessadas com vida até o passo `n`. */
  ondasVivas(n: number): number {
    const ate = this.morteFinal === null ? n : Math.min(n, this.morteFinal - 1);
    let k = 0;
    for (const fim of this.tempos.fimDasOndas) if (fim <= ate) k++;
    return k;
  }

  /** Os pontos no passo `n`: os abates, as ondas com vida e, no fim, as vidas que sobraram. */
  total(n: number, fim = false): number {
    return this.pontos + SOBREVIVER * this.ondasVivas(n) + (fim && this.morteFinal === null ? POR_VIDA * this.vidas : 0);
  }
}
