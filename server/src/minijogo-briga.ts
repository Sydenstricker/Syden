/**
 * A BRIGA NA HORTA (03/11/2026, o piloto): briga de rua de lado, em grupo, no espírito dos fliperamas de quatro jogadores do
 * começo dos anos 90 — SÓ A MECÂNICA (andar pela faixa da frente para o fundo, combo de três socos, pulo, voadora, o especial,
 * cair e levantar piscando; desde 09/11/2026, a arrancada de dois toques e o especial que gira andando, com a barra de recarga). Nenhum nome, personagem, fase, inimigo, som ou arte de ninguém: os coelhos
 * defendem a horta de raposas e corvos, e o chefe é um texugo. Tudo desenhado por código no site (web/src/JogoBriga.tsx),
 * menos o coelho, que é o mascote 3D renderizado de lado (e2e/pixel-art/personagem/blender/meshy/briga.py).
 *
 * É O ÚNICO JOGO EM QUE A TURMA DIVIDE OS MESMOS INIMIGOS, e a rede (servidor na Alemanha, turma no Brasil, ~200 ms) decide
 * o formato:
 * - OS INIMIGOS SÃO DO SERVIDOR. Um passo fixo de 20 por segundo (setInterval próprio, desligado no fim e no `parar` do
 *   motor) move as raposas, os corvos e o texugo, e manda o quadro deles a todos pelo `difundir` (tempo real).
 * - CADA COELHO É DE QUEM JOGA. Ele anda no computador da pessoa sem esperar ninguém e manda a posição ~15 vezes por
 *   segundo; o servidor confere a velocidade e os limites e põe essa posição no quadro dos outros (que a desenham ~100 ms
 *   atrás, interpolada, como os inimigos).
 * - QUEM BATE TEM RAZÃO ("favor the attacker"). Quando o golpe da pessoa encosta num inimigo COMO ELE APARECE NA TELA DELA,
 *   o site manda o acerto (o golpe, o inimigo, a posição de quem bateu). O servidor confere: o golpe foi começado de verdade
 *   (cada golpe é anunciado na posição, com número; o combo e o especial têm as regras deles), não é velho demais, o inimigo
 *   está vivo, quem bateu estava perto de onde o servidor o viu por último, e a distância bate com ALGUMA posição do inimigo
 *   no último 0,7 s (a tela de quem bateu mostra o inimigo ~200 ms atrás do servidor). Só aí o dano entra.
 * - QUEM APANHA TAMBÉM TEM UMA FOLGA. O golpe de um inimigo acontece no relógio do servidor, mas só é decidido GRACA_MS
 *   depois: a pessoa leva o golpe só se TODAS as posições que ela mandou nessa janela estavam dentro da área do golpe (e ela
 *   não estava no ar, nem piscando). Quem começou a fugir quando viu a preparação na própria tela escapa. A preparação de
 *   todo golpe inimigo é longa e visível de propósito (0,5 s a 1 s): é ela que paga os 200 ms.
 *
 * O que continua possível pelo console, entre amigos: mentir a própria posição dentro do limite de velocidade (fugir dos
 * golpes indo e voltando rápido), e mandar acertos que a tela não mostrou mas que a distância permite (bater um pouco mais
 * longe que o desenho, dentro da folga de 10 px). Não dá para bater em quem está do outro lado da tela, nem mais rápido que
 * o combo, nem num inimigo caído ou morto, nem girar antes de a barra do especial encher. A altura também é conferida (revisão de
 * 03/11/2026): o pulo tem teto e tempo de ar, o soco é de quem está no chão, e a voadora é uma por pulo de verdade, com um
 * balde por cima. Ainda possível: emendar pulos de 1 s com uma posição no chão entre eles (no ar ~95% do tempo, contra
 * ~90% de quem aperta o pulo sem parar no site), o que escapa de golpes inimigos como no site; e cada voadora custa um pulo.
 *
 * OS TROFÉUS: com a fase vencida e 2 pessoas ou mais que ficaram até o fim, o pódio (até o 3º, empatados dividem, só quem
 * fez ponto) vai para a estante do quarto (corrida_trofeus, "pista" 'briga', com os pontos). Perder a fase não dá troféu. No
 * Solo, nada.
 */
import * as db from './db.js';
import {
  BICHOS,
  CAMPANHA,
  COICE,
  CORPO,
  ELEMENTOS,
  ESPINHOS,
  ESPINHOS_NA_ARENA,
  ESPOROS,
  FASES_DA_BRIGA,
  ONDA_DE_CHOQUE,
  RODAMOINHO,
  TIPOS,
  TRONCO,
  bicho,
  distanciaDaOnda,
  estadoDaGrade,
  faseDaBriga,
  pistaDaBriga,
  raioDaOnda,
  type TipoDeInimigo,
} from './briga-fases.js';
import type { Contexto, Definicao } from './minijogo-motor.js';

// ---------------- AS MEDIDAS (as mesmas do site: web/src/briga/regras.ts; web/test/briga.test.ts confere) ----------------
/** A largura da tela, e de cada arena onde uma onda acontece. */
export const ARENA_L = 320;
/** A faixa do chão, do fundo (0) para a frente. */
export const PROF = 56;
/** Onde começa a arena de cada onda; a última é a do chefe. */
export const ONDAS_X = [0, 360, 720, 1080, 1440];
export const VEL_X = 72;
export const VEL_Y = 44;
export const VIDA = 100;
export const VIDAS = 3;
/**
 * O ESPECIAL É UM GIRO EM QUE SE ANDA (09/11/2026, pedido dele; o porquê está em web/src/briga/regras.ts): dura GIRO_MS, e
 * cada volta de GIRO_TICK_MS pega cada inimigo uma vez. Não custa mais vida: sai quando a recarga (RECARGA_ESPECIAL_MS desde
 * o último) acaba, e o servidor confere pelo relógio dele, com FOLGA_RECARGA_MS para a rede.
 */
export const GIRO_MS = 1600;
export const GIRO_TICK_MS = 320;
export const RECARGA_ESPECIAL_MS = 8000;
export const FOLGA_RECARGA_MS = 400;
/** Uma volta não pode chegar mais que isto antes da hora dela (a rede atrasa o começo do giro mais que a volta, às vezes). */
export const FOLGA_DA_VOLTA_MS = 250;
/**
 * A ARRANCADA (09/11/2026, pedido dele): dois toques para o mesmo lado, e o coelho dispara ARRANCADA_MS a ARRANCADA_VEL. O
 * servidor dá, na posição que a anuncia (a ação 'arrancada'), ARRANCADA_EXTRA px a mais de crédito de andar, que valem por
 * pouco tempo; uma por ARRANCADA_RECARGA_MS. Passar disso continua cortado como antes: não vira teleporte.
 */
export const ARRANCADA_MS = 200;
export const ARRANCADA_VEL = 220;
export const ARRANCADA_RECARGA_MS = 600;
export const ARRANCADA_EXTRA = Math.ceil(((ARRANCADA_VEL - VEL_X) * ARRANCADA_MS) / 1000) + 6;

export type Golpe = 'soco1' | 'soco2' | 'soco3' | 'voadora' | 'especial';
/** Cada golpe: quanto dura (ms), o alcance à frente [de, até] (px; o especial pega dos dois lados), a fundura e o dano. */
export const GOLPES: Record<Golpe, { dura: number; alcance: [number, number]; fundo: number; dano: number; derruba: boolean }> = {
  soco1: { dura: 260, alcance: [6, 30], fundo: 9, dano: 4, derruba: false },
  soco2: { dura: 280, alcance: [6, 32], fundo: 9, dano: 5, derruba: false },
  soco3: { dura: 420, alcance: [4, 34], fundo: 10, dano: 9, derruba: true },
  voadora: { dura: 900, alcance: [0, 30], fundo: 11, dano: 9, derruba: true },
  // o giro: pega dos dois lados, a cada volta (GIRO_TICK_MS), e não derruba (só empurra: quem gira vai atrás)
  especial: { dura: GIRO_MS, alcance: [-34, 34], fundo: 14, dano: 4, derruba: false },
};
/** Quantas voltas tem o giro. */
export const VOLTAS_DO_GIRO = Math.ceil(GIRO_MS / GIRO_TICK_MS);
// OS BICHOS E AS FASES moram em briga-fases.ts (a mesma cópia do site, web/src/briga/fases.ts)
export { BICHOS, CAMPANHA, CORPO, FASES_DA_BRIGA, TIPOS, type TipoDeInimigo };
export { COICE, ESPINHOS, ESPOROS, ONDA_DE_CHOQUE, RODAMOINHO, TRONCO } from './briga-fases.js';

/** Os estados dos inimigos, na ordem do código que vai no quadro (o site tem a mesma lista). */
export const ESTADOS = [
  'entrando', 'andando', 'esperando', 'preparando', 'atacando', 'recuperando', 'dor', 'caido', 'levantando', 'morto',
  'rondando', 'mirando', 'mergulhando', 'subindo', 'prep-investida', 'investida', 'cansado', 'prep-pancada', 'pancada',
  // as fases novas (06/11/2026): o pulo de quem cai em cima, e a rajada do chefe que atira
  'saltando', 'prep-sopro', 'sopro',
  // o golpe próprio de cada chefe (21/11/2026): os esporos, o coice e a onda de choque
  'prep-esporos', 'esporos', 'prep-coice', 'coice', 'prep-onda', 'onda',
] as const;
export type EstadoDoInimigo = (typeof ESTADOS)[number];
/** As ações do coelho (o que a pessoa diz que ele está fazendo, para os outros o desenharem). */
// a ordem é o código que vai na rede: ação nova entra no FIM ('arrancada', 09/11/2026)
export const ACOES = ['parado', 'andando', 'soco1', 'soco2', 'soco3', 'pulo', 'voadora', 'dor', 'caido', 'levantando', 'especial', 'arrancada'] as const;
const ACAO_ARRANCADA = ACOES.indexOf('arrancada');

// ---------------- O RELÓGIO E AS FOLGAS ----------------
export const PASSO_MS = 50;
/** Quanto o servidor espera para decidir um golpe inimigo (ver o topo). */
export const GRACA_MS = 200;
/** O quanto um acerto pode ficar fora da caixa do golpe, contando o desenho e o arredondamento. */
export const FOLGA_ACERTO = 10;
/** Quanto do passado do inimigo vale para um acerto (a tela de quem bate está ~200 ms atrás; folga para o dobro e mais). */
export const HISTORIA_MS = 700;
export const VOLTA_MS = 3000;
/** Quanto a fase pode durar: depois disso, acabou (a turma saiu andando, ou travou). */
export const FASE_MAX_MS = 8 * 60_000;
/** O tempo do "Vencemos!"/"Fim" antes do placar. */
export const FIM_MS = 3500;

/**
 * O PULO, conferido pelo servidor (revisão de 03/11/2026: o `z` não era conferido, e quem mandava `z: 59` para sempre não
 * apanhava nunca e ainda batia em quem estava no chão). O pulo do site sobe a 215 px/s com gravidade de 720: ~32 px de
 * altura e ~0,6 s no ar (apanhar no ar dá um pouco mais). O servidor aceita até Z_MAX, e por no máximo AR_MAX_MS contados
 * da primeira posição no ar que chegou (com folga para a rede); a altura permitida cai a zero entre AR_TETO_MS e AR_MAX_MS
 * (a gravidade). Passou disso, o coelho está no chão para o servidor até mandar uma posição no chão de verdade.
 */
export const Z_MAX = 38;
export const AR_TETO_MS = 550;
export const AR_MAX_MS = 1000;
/** O mínimo de ar de verdade para o pulo contar como pulo (e liberar a próxima voadora): o do site é ~600 ms. */
export const AR_MIN_MS = 350;
/** A altura até onde um golpe de chão (soco, especial) ainda vale. */
export const Z_DO_CHAO = 4;
/** A folga de velocidade: o coelho anda a VEL_X/VEL_Y; aceita-se FOLGA_VEL vezes isso, com um acúmulo pequeno para a rede. */
export const FOLGA_VEL = 1.3;
export const ACUMULO_X = 16;
export const ACUMULO_Y = 10;

/** Quanto cada bicho dá a quem o derruba de vez. */
export const PONTOS_NOCAUTE = Object.fromEntries(TIPOS.map((t) => [t, BICHOS[t].pontos])) as Record<TipoDeInimigo, number>;

interface Onda {
  bichos: Partial<Record<TipoDeInimigo, number>>;
  chefe?: TipoDeInimigo;
}
/** As ondas de uma fase: as quatro dela e a do chefe. */
export const ondasDa = (id: string): Onda[] => {
  const f = faseDaBriga(id) ?? FASES_DA_BRIGA[0];
  return [...f.ondas.map((bichos) => ({ bichos })), { bichos: {}, chefe: f.chefe }];
};
/** As ondas da horta (todas as fases têm cinco: ONDAS_X). */
export const ONDAS: Onda[] = ondasDa('horta');

/** O tiro (o do bicho que atira e a rajada do chefe): anda pela faixa; pular ou sair da faixa escapa. */
export const TIRO_VEL = 130;
export const SOPRO_VEL = 150;
/**
 * A CURA QUE CAI (19/11/2026, a auditoria dos mini-games): o bicho derrubado de vez às vezes deixa uma cenoura no chão, e quem
 * passa por cima com a vida faltando se cura. QUEM DECIDE É O SERVIDOR (os bichos são dele): a queda é sorteada aqui, e quem
 * pegou também, pela posição que ele já confere. A cenoura some em CURA_MS; o bicho de elite sempre deixa a grande.
 */
export const CHANCE_DA_CURA = 0.2;
export const CHANCE_DA_GRANDE = 0.25;
export const CURA_PEQUENA = 25;
export const CURA_GRANDE = 60;
export const CURA_MS = 15_000;
export const ALCANCE_DA_CURA: [number, number] = [14, 9];
/**
 * O BICHO DE ELITE (19/11/2026): um por fase, na terceira onda, o primeiro que entra. Mais vida (VIDA_DE_ELITE vezes), um
 * pouco mais de dano e o triplo de pontos; o site o desenha com a aura.
 */
export const ONDA_DA_ELITE = 2;
export const VIDA_DE_ELITE = 2.5;
export const DANO_DE_ELITE = 3;

/**
 * A DIFICULDADE DO SOLO (20/11/2026, a segunda auditoria dos mini-games): fácil, normal ou difícil, escolhida na largada. Mexe
 * só nos bichos, e tudo no servidor: a vida e o dano deles, quantos ficam na tela ao mesmo tempo e a JANELA DO AVISO (a
 * preparação de cada golpe, que paga a internet; no difícil ela encolhe, mas nunca abaixo de ~0,4 s, o dobro da GRACA_MS). Na
 * sala, sempre o normal. O recorde é por fase E dificuldade: o normal guarda a variante de sempre (a fase), para os recordes
 * antigos valerem; os outros, "<fase>@facil" e "<fase>@dificil".
 */
export const DIFICULDADES_DA_BRIGA = ['facil', 'normal', 'dificil'] as const;
export type DificuldadeDaBriga = (typeof DIFICULDADES_DA_BRIGA)[number];
export const AJUSTE_DA_DIFICULDADE: Record<DificuldadeDaBriga, { vida: number; dano: number; naTela: number; aviso: number }> = {
  facil: { vida: 0.7, dano: 0.65, naTela: -1, aviso: 1.3 },
  normal: { vida: 1, dano: 1, naTela: 0, aviso: 1 },
  dificil: { vida: 1.3, dano: 1.3, naTela: 1, aviso: 0.8 },
};
/** Os estados de AVISO (a preparação visível de um golpe): a dificuldade estica ou encurta só eles. */
const ESTADOS_DE_AVISO = new Set(['preparando', 'mirando', 'prep-investida', 'prep-pancada', 'prep-sopro', 'prep-esporos', 'prep-coice', 'prep-onda']);
/** A variante do recorde do Solo: a fase, e a dificuldade quando não é a normal. */
export const varianteDaBriga = (fase: string, dificuldade: DificuldadeDaBriga) => (dificuldade === 'normal' ? fase : `${fase}@${dificuldade}`);
/**
 * O ARREMESSO (19/11/2026): o 3º soco do combo num bicho ATORDOADO (na dor de um soco anterior) o joga longe, e no caminho ele
 * derruba os outros bichos (ARREMESSO_DANO, os pontos para quem arremessou). Contato coelho→bicho, então "quem bate tem razão"
 * vale como em todo acerto; o voo e quem ele derruba, quem decide é o servidor. O chefe e o que voa não são arremessados.
 */
export const ARREMESSO_VEL = 230;
export const ARREMESSO_MS = 650;
export const ARREMESSO_DANO = 10;
/**
 * OS CAIXOTES (19/11/2026): dois em cada arena de onda (menos a do chefe), parados no chão. Os socos os quebram, e de dentro
 * sai uma cenoura de cura (o servidor decide a grande, como a do bicho); o 3º soco ou a voadora num caixote inteiro o
 * ARREMESSA pela faixa, derrubando os bichos do caminho, e ele se quebra no fim. Contato coelho→caixote: o servidor confere a
 * caixa do golpe contra o lugar do caixote (que não anda); o voo e quem ele derruba são do servidor.
 */
export const CAIXOTE = { hp: 10, larg: 10, primeiroId: 1_000_000 };
export const CAIXOTES_NA_ARENA: readonly (readonly [number, number])[] = [
  [110, 16],
  [235, 42],
];
/** O pulo de quem cai em cima: a altura e o tempo no ar. */
export const SALTO_ALTO = 34;
export const SALTO_MS = 700;

interface Ponto {
  t: number;
  x: number;
  y: number;
  z: number;
}

interface Inimigo {
  id: number;
  tipo: TipoDeInimigo;
  x: number;
  y: number;
  z: number;
  lado: 1 | -1;
  vx: number;
  hp: number;
  hpMax: number;
  estado: EstadoDoInimigo;
  desde: number;
  ate: number;
  alvo: number | null;
  /** A faixa do mergulho do corvo, da investida do texugo e do tiro; no pulo, o y de onde vai cair. */
  faixa: number;
  /** No pulo: o x de onde vai cair, e de onde saiu. */
  alvoX: number;
  x0: number;
  y0: number;
  /** Cada golpe que já o acertou (userId:id do golpe): um golpe acerta cada inimigo uma vez. */
  acertos: Set<string>;
  historia: Ponto[];
  /** O número do ataque do inimigo (cada mergulho, cada investida): quem já levou não leva de novo no mesmo. */
  ataque: number;
  proximoAtaque: number;
  /** O bicho de elite da fase (ver ONDA_DA_ELITE). */
  elite: boolean;
  /** Arremessado (ver ARREMESSO_MS): por quem, e até quando derruba quem estiver no caminho. */
  arremessoDe: number | null;
  arremessoAte: number;
}

/** Uma cenoura no chão (ver CHANCE_DA_CURA). */
interface Cura {
  id: number;
  grande: boolean;
  x: number;
  y: number;
  ate: number;
}

/** Um elemento de cenário (21/11/2026): o tronco, o rodamoinho, o esporo do rei-cogumelo (as grades e o gelo não andam). */
interface Elemento {
  id: number;
  tipo: (typeof ELEMENTOS)[number];
  x: number;
  y: number;
  /** O tronco: 1 avisando, 2 rolando; o esporo: 1 o círculo, 2 a nuvem; o rodamoinho: o quadro do giro. */
  estado: number;
  lado: 1 | -1;
  desde: number;
  ate: number;
  /** O rodamoinho: para onde vai. */
  alvoX?: number;
  alvoY?: number;
  /** O esporo: o chefe que o marcou. */
  dono?: number;
  /** O tronco: os bichos que ele já derrubou. */
  ja: Set<number>;
}

/** Um tiro no ar: o servidor o leva pela faixa, e cada passo é uma pancada (a folga vale igual). */
interface Tiro {
  id: number;
  /** De quem (o código do tipo, para o site desenhar o tiro certo). */
  tipo: TipoDeInimigo;
  x: number;
  y: number;
  vx: number;
  dano: number;
  ate: number;
}

interface Ataque {
  id: number;
  golpe: Golpe;
  em: number;
  acertos: number;
}

interface Jogador {
  userId: number;
  avatar: number | string | null;
  x: number;
  y: number;
  z: number;
  lado: 1 | -1;
  acao: number;
  tAcao: number;
  hp: number;
  vidas: number;
  pontos: number;
  golpes: number;
  nocautes: number;
  estado: 'em-pe' | 'fora' | 'sem-vidas';
  voltaEm: number;
  invulAte: number;
  /** As posições mandadas (hora do servidor): a folga dos golpes inimigos. */
  historia: Ponto[];
  /** Até quando a posição pode andar mais que o normal (o empurrão de um golpe, a volta). */
  livreAte: number;
  ultimaEm: number;
  ataques: Ataque[];
  ultimoAtaque: number;
  ultimoEspecial: number;
  /** A última arrancada aceita, o crédito a mais dela (px) e até quando ele vale. */
  ultimaArrancada: number;
  extraX: number;
  arrancadaAte: number;
  /** Desde a última voadora, ele já pôs o pé no chão? */
  pisou: boolean;
  /** Desde quando ele está no ar (a primeira posição com z > 0), ou null no chão. */
  noArDesde: number | null;
  /** O pulo passou do tempo: até mandar uma posição no chão, o z é 0. */
  precisaPisar: boolean;
  /** O quanto ele ainda pode andar além do normal (px), que se acumula com o tempo até ACUMULO_X/ACUMULO_Y. */
  creditoX: number;
  creditoY: number;
  baldes: { pos: Balde; golpe: Balde; socos: Balde; voadora: Balde };
}

interface Balde {
  fichas: number;
  em: number;
  max: number;
  porSeg: number;
}

/** Um golpe inimigo que aconteceu e espera a folga para ser decidido. */
interface Pancada {
  em: number;
  /** De quem, e o número do ataque (no mergulho e na investida, cada passo cria uma; quem levou não leva de novo). */
  chave: string;
  dentro: (j: { x: number; y: number; z: number }) => boolean;
  dano: number;
  derruba: boolean;
  lado: 1 | -1;
}

export interface OpcoesDaBriga {
  agora?: () => number;
  aleatorio?: () => number;
  /** O relógio do passo (trocável no teste: o teste chama o passo à mão). */
  intervalo?: (passo: () => void, ms: number) => unknown;
  limpar?: (h: unknown) => void;
}

export const briga: Definicao = criarBriga();

export function criarBriga({
  agora = Date.now,
  aleatorio = Math.random,
  intervalo = (passo, ms) => {
    const h = setInterval(passo, ms);
    h.unref?.();
    return h;
  },
  limpar = (h) => clearInterval(h as ReturnType<typeof setInterval>),
}: OpcoesDaBriga = {}): Definicao {
  return {
    minimo: 2,
    // quatro coelhos: o quinto que aceitar assiste (e não conta como quem jogou)
    maximo: 4,
    comecar(ctx: Contexto, { naSala, corpo }) {
      const inscritos = [...naSala].slice(0, 4);
      if (inscritos.length === 0) return 'Ninguém para jogar.';
      // A FASE (06/11/2026): uma delas, ou a campanha (todas seguidas). Todas abertas de fábrica; sem nada, a horta. "categoria"
      // é o nome que o "Jogar de novo" do painel manda de volta.
      const pedida = typeof corpo?.fase === 'string' ? corpo.fase : typeof corpo?.categoria === 'string' ? corpo.categoria : 'horta';
      const escolha = pedida === CAMPANHA || faseDaBriga(pedida) ? pedida : 'horta';
      const etapas = escolha === CAMPANHA ? FASES_DA_BRIGA.map((f) => f.id) : [escolha];
      let etapa = 0;
      let ondas = ondasDa(etapas[0]);
      const solo = ctx.comunidade === 0 || ctx.comunidade === undefined;
      // a dificuldade (20/11/2026): só no Solo; na sala, o normal
      const dificuldade: DificuldadeDaBriga =
        solo && typeof corpo?.dificuldade === 'string' && (DIFICULDADES_DA_BRIGA as readonly string[]).includes(corpo.dificuldade)
          ? (corpo.dificuldade as DificuldadeDaBriga)
          : 'normal';
      const ajuste = AJUSTE_DA_DIFICULDADE[dificuldade];
      const variante = varianteDaBriga(escolha, dificuldade);
      const evento = `briga-${ctx.comunidade ?? 0}-${agora()}`;
      const n = inscritos.length;
      const inicio = agora();
      let fase: 'lutando' | 'avancando' | 'vitoria' | 'derrota' | 'fim' = 'lutando';
      let onda = 0;
      let arena: [number, number] = [ONDAS_X[0], ONDAS_X[0] + ARENA_L];
      let fila: TipoDeInimigo[] = [];
      const tiros: Tiro[] = [];
      let proximoTiro = 1;
      const curas: Cura[] = [];
      const elementos: Elemento[] = [];
      let proximoElemento = 1;
      let proximaCura = 1;
      /** Os caixotes da fase: os inteiros, e o que voa (arremessado). */
      const caixotes = new Map<number, { id: number; x: number; y: number; hp: number; voando: { vx: number; ate: number; de: number; acertou: Set<number> } | null }>();
      const acertosNoCaixote = new Map<number, Set<string>>();
      let proximoCaixote = CAIXOTE.primeiroId;
      const porCaixotes = () => {
        caixotes.clear();
        acertosNoCaixote.clear();
        for (let k = 0; k < ONDAS_X.length - 1; k++) {
          for (const [dx, y] of CAIXOTES_NA_ARENA) {
            const id = proximoCaixote++;
            caixotes.set(id, { id, x: ONDAS_X[k] + dx, y, hp: CAIXOTE.hp, voando: null });
          }
        }
      };
      /** A elite desta onda ainda não entrou. */
      let eliteNaOnda = false;
      /** Quando a fase foi vencida ou perdida: o recorde do Solo é o tempo até a vitória, contado pelo relógio daqui. */
      let acabouEm: number | null = null;
      let recorde: { ms: number; antes: number | null; novo: boolean } | null = null;
      const soloDe = solo ? inscritos[0] : null;
      const melhorDeAntes = soloDe !== null ? (db.recordeDoSolo(soloDe, 'briga', variante)?.valor ?? null) : null;
      /** A fase vencida na campanha: quando a próxima começa (null fora disso). */
      let trocaEm: number | null = null;
      let proximaEntrada = 0;
      let passo = 0;
      let proximoId = 1;
      let proximoEvento = 1;
      let relogio: unknown = null;
      let ficaram = new Set(inscritos);
      const inimigos = new Map<number, Inimigo>();
      const pancadas: Pancada[] = [];
      /** Quem já levou cada ataque inimigo (chave do ataque → pessoas). */
      const levaram = new Map<string, Set<number>>();
      let eventos: unknown[][] = [];
      /** Por que o último acerto não valeu (para o teste). */
      let ultimoMotivo: string | null = null;
      let venceuAFase = false;

      const balde = (max: number, porSeg: number): Balde => ({ fichas: max, em: agora(), max, porSeg });
      const gastar = (b: Balde) => {
        const t = agora();
        b.fichas = Math.min(b.max, b.fichas + ((t - b.em) / 1000) * b.porSeg);
        b.em = t;
        if (b.fichas < 1) return false;
        b.fichas -= 1;
        return true;
      };

      const jogadores = new Map<number, Jogador>(
        inscritos.map((userId, k) => [
          userId,
          {
            userId,
            avatar: db.avatarDoJogo(userId),
            x: 40 + k * 14,
            y: 14 + k * 11,
            z: 0,
            lado: 1,
            acao: 0,
            tAcao: 0,
            hp: VIDA,
            vidas: VIDAS,
            pontos: 0,
            golpes: 0,
            nocautes: 0,
            estado: 'em-pe',
            voltaEm: 0,
            invulAte: agora() + 1500,
            historia: [],
            livreAte: agora() + 1000,
            ultimaEm: agora(),
            ataques: [],
            ultimoAtaque: 0,
            ultimoEspecial: -Infinity,
            ultimaArrancada: -Infinity,
            extraX: 0,
            arrancadaAte: 0,
            pisou: true,
            noArDesde: null,
            precisaPisar: false,
            creditoX: ACUMULO_X,
            creditoY: ACUMULO_Y,
            // a posição vem ~15 por segundo, e o acerto, no máximo alguns por golpe; a voadora, uma por pulo de ~0,6 s
            baldes: { pos: balde(10, 24), golpe: balde(10, 14), socos: balde(3, 4.5), voadora: balde(2, 1.7) },
          },
        ]),
      );

      const evento_ = (...e: unknown[]) => eventos.push([proximoEvento++, ...e]);
      const presentes = () => new Set(ctx.naSala());
      /** Quem está na sala, lido UMA vez por passo (o naSala percorre a voz do servidor inteiro). */
      let naSalaAgora = presentes();
      /** Quem estava na sala no passo anterior: quem volta é posto na arena de agora (ver o passo). */
      let naSalaAntes = naSalaAgora;
      const emPe = () => [...jogadores.values()].filter((j) => j.estado === 'em-pe' && naSalaAgora.has(j.userId));

      // ---------------- AS ONDAS ----------------
      /** O x do coelho dentro da arena, como o site o prende (passoDoCoelho: a arena menos 8 de cada lado). */
      const prenderNaArena = (j: Jogador) => {
        j.x = Math.max(arena[0] + 8, Math.min(arena[1] - 8, j.x));
      };
      const comecarOnda = (k: number) => {
        onda = k;
        fase = 'lutando';
        arena = [ONDAS_X[k], ONDAS_X[k] + ARENA_L];
        const o = ondas[k];
        const extras = n - 1;
        fila = [];
        // o bicho de soco da fase (a raposa, na horta) vem primeiro, um a mais por pessoa além da primeira; os outros entram
        // intercalados (na horta, a mesma fila de antes)
        const daFase = faseDaBriga(etapas[etapa]) ?? FASES_DA_BRIGA[0];
        const deSoco = (Object.keys(daFase.ondas[0]) as TipoDeInimigo[]).find((t) => bicho(t).comp === 'soco') ?? 'raposa';
        if (o.chefe) fila.push(o.chefe);
        for (let i = 0; i < (o.bichos[deSoco] ?? 0) + extras; i++) fila.push(deSoco);
        const outros: TipoDeInimigo[] = [];
        for (const [t, q] of Object.entries(o.bichos) as [TipoDeInimigo, number][]) {
          if (t === deSoco) continue;
          for (let i = 0; i < q + (q && extras > 1 ? 1 : 0); i++) outros.push(t);
        }
        outros.forEach((t, i) => fila.splice(1 + i * 2, 0, t));
        if (o.chefe && extras > 0) for (let i = 0; i < extras; i++) fila.push(deSoco);
        proximaEntrada = agora() + 600;
        eliteNaOnda = k === ONDA_DA_ELITE && !o.chefe;
        // o rodamoinho nasce de novo no meio da arena nova
        for (let e = elementos.length - 1; e >= 0; e--) if (elementos[e].tipo === 'rodamoinho') elementos.splice(e, 1);
        // a turma desta onda: quem estava na sala quando ela começou
        const p = presentes();
        ficaram = new Set([...ficaram].filter((id) => p.has(id)));
        // TODO MUNDO PARA DENTRO DA ARENA NOVA (revisão independente, 03/11/2026): o site prende o coelho nela na hora, mas o
        // servidor o levava andando pelo crédito de velocidade, e por alguns segundos todo acerto dava "longe de si" e os
        // inimigos corriam atrás de um lugar onde ele já não estava. Aqui ele vai para o mesmo lugar em que a tela o põe.
        for (const j of jogadores.values()) prenderNaArena(j);
        ctx.avisar();
      };

      const naTela = () => [...inimigos.values()].filter((i) => i.estado !== 'morto').length;
      const maxNaTela = () => Math.max(1, (ondas[onda].chefe ? 1 + n : 2 + n) + ajuste.naTela);

      const entrar = (tipo: TipoDeInimigo) => {
        const doLado: 1 | -1 = aleatorio() < 0.5 ? -1 : 1;
        const x = doLado === 1 ? arena[1] + 24 : arena[0] - 24;
        const def = bicho(tipo);
        const voa = def.comp === 'mergulho';
        const elite = eliteNaOnda && def.comp !== 'chefe';
        if (elite) eliteNaOnda = false;
        const hpBase = def.comp === 'chefe' ? def.hp + 90 * (n - 1) : elite ? Math.round(def.hp * VIDA_DE_ELITE) : def.hp;
        const hpMax = Math.max(1, Math.round(hpBase * ajuste.vida));
        const t = agora();
        const ini: Inimigo = {
          id: proximoId++,
          tipo,
          x,
          y: voa ? 10 + aleatorio() * (PROF - 20) : 8 + aleatorio() * (PROF - 16),
          z: voa ? 34 : 0,
          lado: doLado === 1 ? -1 : 1,
          vx: 0,
          hp: hpMax,
          hpMax,
          estado: voa ? 'rondando' : 'entrando',
          desde: t,
          ate: t + (voa ? 1200 + aleatorio() * 800 : 900),
          alvo: null,
          faixa: 0,
          alvoX: 0,
          x0: 0,
          y0: 0,
          acertos: new Set(),
          historia: [],
          ataque: 0,
          proximoAtaque: t + 800 + aleatorio() * 800,
          elite,
          arremessoDe: null,
          arremessoAte: 0,
        };
        inimigos.set(ini.id, ini);
      };

      // ---------------- A IA DOS INIMIGOS (cada passo) ----------------
      const mudar = (i: Inimigo, estado: EstadoDoInimigo, ms: number) => {
        i.estado = estado;
        i.desde = agora();
        // a janela do aviso, pela dificuldade (só os estados de preparação)
        i.ate = agora() + (ajuste.aviso !== 1 && ESTADOS_DE_AVISO.has(estado) ? Math.round(ms * ajuste.aviso) : ms);
      };
      const maisPerto = (i: Inimigo) => {
        let melhor: Jogador | null = null;
        let d = Infinity;
        for (const j of emPe()) {
          const dd = Math.abs(j.x - i.x) + 2 * Math.abs(j.y - i.y);
          if (dd < d) {
            d = dd;
            melhor = j;
          }
        }
        return melhor;
      };
      const ir = (i: Inimigo, x: number, y: number, vx: number, vy: number, dt: number) => {
        const dx = x - i.x;
        const dy = y - i.y;
        i.x += Math.sign(dx) * Math.min(Math.abs(dx), vx * dt);
        i.y += Math.sign(dy) * Math.min(Math.abs(dy), vy * dt);
      };
      const pancada = (i: Inimigo, chave: string, dano: number, derruba: boolean, dentro: Pancada['dentro']) => {
        pancadas.push({ em: agora(), chave, dano, derruba, lado: i.lado, dentro });
      };

      const voador = (i: Inimigo) => bicho(i.tipo).comp === 'mergulho';
      /** O dano do golpe do bicho (a elite bate um pouco mais). */
      const danoDe = (i: Inimigo) => Math.max(1, Math.round((bicho(i.tipo).dano + (i.elite ? DANO_DE_ELITE : 0)) * ajuste.dano));

      /** Quem passa por cima de uma cenoura com a vida faltando se cura (a posição é a que o servidor já conferiu). */
      const passoDasCuras = (t: number) => {
        for (let k = curas.length - 1; k >= 0; k--) {
          const c = curas[k];
          if (t >= c.ate) {
            curas.splice(k, 1);
            continue;
          }
          const quem = emPe().find(
            (j) => j.hp < VIDA && j.z < 8 && Math.abs(j.x - c.x) <= ALCANCE_DA_CURA[0] && Math.abs(j.y - c.y) <= ALCANCE_DA_CURA[1],
          );
          if (!quem) continue;
          const cura = c.grande ? CURA_GRANDE : CURA_PEQUENA;
          quem.hp = Math.min(VIDA, quem.hp + cura);
          curas.splice(k, 1);
          evento_('c', c.id, quem.userId, cura);
        }
      };
      /** O bicho arremessado derruba os outros que encontra (cada um, uma vez por arremesso). */
      const arremessoNoCaminho = (a: Inimigo, t: number) => {
        const quem = a.arremessoDe === null ? undefined : jogadores.get(a.arremessoDe);
        for (const o of inimigos.values()) {
          if (o === a || o.hp <= 0 || voador(o) || bicho(o.tipo).comp === 'chefe') continue;
          if (o.estado === 'caido' || o.estado === 'levantando' || o.estado === 'morto') continue;
          if (Math.abs(o.x - a.x) > CORPO[o.tipo] + CORPO[a.tipo] || Math.abs(o.y - a.y) > 10) continue;
          o.hp = Math.max(0, o.hp - ARREMESSO_DANO);
          o.vx = Math.sign(a.vx || 1) * 120;
          mudar(o, 'caido', 1000);
          evento_('h', o.id, a.arremessoDe ?? 0, 'arremesso', Math.round(o.x), Math.round(o.y), Math.round(o.z));
          if (quem) {
            quem.pontos += ARREMESSO_DANO;
            quem.golpes++;
          }
          if (o.hp <= 0) {
            if (quem) {
              quem.pontos += PONTOS_NOCAUTE[o.tipo] * (o.elite ? 3 : 1);
              quem.nocautes++;
            }
            evento_('x', o.id, a.arremessoDe ?? 0);
            talvezCura(o, t);
          }
        }
      };
      /** O bicho derrubado de vez: às vezes, a cenoura (a elite sempre deixa a grande). */
      const talvezCura = (i: Inimigo, t: number) => {
        if (bicho(i.tipo).comp === 'chefe') return;
        if (!i.elite && aleatorio() >= CHANCE_DA_CURA) return;
        const grande = i.elite || aleatorio() < CHANCE_DA_GRANDE;
        const x = Math.max(arena[0] + 12, Math.min(arena[1] - 12, i.x));
        curas.push({ id: proximaCura++, grande, x, y: Math.max(0, Math.min(PROF, i.y)), ate: t + CURA_MS });
      };

      // ---------------- OS ELEMENTOS DE CENÁRIO (21/11/2026; as medidas em briga-fases.ts) ----------------
      /** O que o elemento pega no chão: o bicho de pé, que não voa e não é o chefe. */
      const bichoDoChao = (o: Inimigo) =>
        o.hp > 0 && !voador(o) && bicho(o.tipo).comp !== 'chefe' && o.z < 4 && o.estado !== 'caido' && o.estado !== 'levantando' && o.estado !== 'morto' && o.estado !== 'saltando';
      /** O cenário machuca um bicho: sem pontos para ninguém (quem derruba de vez é o cenário). */
      const machucarBicho = (o: Inimigo, dano: number, vx: number, derruba: boolean, t: number) => {
        o.hp = Math.max(0, o.hp - dano);
        evento_('h', o.id, 0, 'cenario', Math.round(o.x), Math.round(o.y), 0);
        if (o.hp <= 0 || derruba) {
          o.vx = vx;
          mudar(o, 'caido', 1000);
          if (o.hp <= 0) {
            evento_('x', o.id, 0);
            talvezCura(o, t);
          }
        } else {
          o.vx = vx / 2;
          mudar(o, 'dor', 380);
        }
      };
      /** O elemento da fase que está na tela. */
      const elementoDaFase = () => (faseDaBriga(etapas[etapa]) ?? FASES_DA_BRIGA[0]).elemento;
      /** O começo da fase que está na tela (o ciclo das grades de espinhos conta daqui). */
      let inicioDaEtapa = inicio;
      let proximoTronco = inicio + TRONCO.intervalo[0];
      /** Os esporos que o rei-cogumelo marcou: o círculo (estado 1) e a nuvem (estado 2). */
      const passoDosElementos = (dt: number, t: number) => {
        const el = elementoDaFase();
        // O TRONCO: só com a onda lutando, um de cada vez
        if (el === 'tronco' && fase === 'lutando' && t >= proximoTronco && !elementos.some((e) => e.tipo === 'tronco')) {
          const quem = emPe();
          if (quem.length) {
            const alvo = quem[Math.floor(aleatorio() * quem.length) % quem.length];
            const lado: 1 | -1 = aleatorio() < 0.5 ? 1 : -1;
            elementos.push({
              id: proximoElemento++,
              tipo: 'tronco',
              x: lado === 1 ? arena[0] + 6 : arena[1] - 6,
              y: Math.max(6, Math.min(PROF - 6, alvo.y)),
              estado: 1,
              lado,
              desde: t,
              ate: t + TRONCO.aviso,
              ja: new Set(),
            });
          }
          proximoTronco = t + TRONCO.intervalo[0] + aleatorio() * (TRONCO.intervalo[1] - TRONCO.intervalo[0]);
        }
        // O RODAMOINHO: um por arena, que anda até um ponto sorteado e sorteia outro
        if (el === 'rodamoinho' && (fase === 'lutando' || fase === 'avancando') && !elementos.some((e) => e.tipo === 'rodamoinho')) {
          elementos.push({ id: proximoElemento++, tipo: 'rodamoinho', x: arena[0] + ARENA_L / 2, y: PROF / 2, estado: 0, lado: 1, desde: t, ate: t, ja: new Set(), alvoX: arena[0] + 60, alvoY: 10 });
        }
        for (let k = elementos.length - 1; k >= 0; k--) {
          const e = elementos[k];
          if (e.tipo === 'tronco') {
            if (e.estado === 1) {
              if (t >= e.ate) {
                e.estado = 2;
                e.desde = t;
              }
              continue;
            }
            const x0 = e.x;
            e.x += e.lado * TRONCO.vel * dt;
            const x1 = e.x, y = e.y;
            pancadas.push({
              em: t,
              chave: `tronco-${e.id}`,
              dano: TRONCO.dano,
              derruba: true,
              lado: e.lado,
              dentro: (j) => j.x >= Math.min(x0, x1) - TRONCO.raio && j.x <= Math.max(x0, x1) + TRONCO.raio && Math.abs(j.y - y) <= TRONCO.fundo && j.z < 10,
            });
            for (const o of inimigos.values()) {
              if (e.ja.has(o.id) || !bichoDoChao(o)) continue;
              if (Math.abs(o.x - x1) > CORPO[o.tipo] + TRONCO.raio || Math.abs(o.y - y) > TRONCO.fundo) continue;
              e.ja.add(o.id);
              machucarBicho(o, TRONCO.danoNoBicho, e.lado * 120, true, t);
            }
            if ((e.lado > 0 && e.x > arena[1] + 20) || (e.lado < 0 && e.x < arena[0] - 20)) elementos.splice(k, 1);
          } else if (e.tipo === 'rodamoinho') {
            if (el !== 'rodamoinho') {
              elementos.splice(k, 1);
              continue;
            }
            // o ponto de chegada fica sempre dentro da arena de agora
            const ax = Math.max(arena[0] + 20, Math.min(arena[1] - 20, e.alvoX ?? e.x));
            const ay = e.alvoY ?? e.y;
            const dx = ax - e.x, dy = ay - e.y;
            const d = Math.hypot(dx, dy);
            if (d < 4) {
              e.alvoX = arena[0] + 30 + aleatorio() * (ARENA_L - 60);
              e.alvoY = 6 + aleatorio() * (PROF - 12);
            } else {
              e.x += (dx / d) * RODAMOINHO.vel * dt;
              e.y += (dy / d) * RODAMOINHO.vel * dt;
            }
            e.estado = Math.floor((t - e.desde) / 100) % 8;
            // empurra quem encosta (um golpe a cada RODAMOINHO.cada; o empurrão vai para longe do centro)
            const vez = Math.floor((t - e.desde) / RODAMOINHO.cada);
            const ex = e.x, ey = e.y;
            for (const j of emPe()) {
              if (Math.abs(j.x - ex) > RODAMOINHO.raioX + 14 || Math.abs(j.y - ey) > RODAMOINHO.raioY + 10) continue;
              pancadas.push({
                em: t,
                chave: `rm-${e.id}-${vez}`,
                dano: RODAMOINHO.dano,
                derruba: false,
                lado: j.x >= ex ? 1 : -1,
                dentro: (p) => Math.abs(p.x - ex) <= RODAMOINHO.raioX && Math.abs(p.y - ey) <= RODAMOINHO.raioY && p.z < 8,
              });
            }
          } else if (e.tipo === 'esporo') {
            // o chefe que marcou caiu: os círculos somem; a nuvem some sozinha
            const dono = inimigos.get(e.dono ?? -1);
            if ((e.estado === 1 && (!dono || dono.hp <= 0)) || (e.estado === 2 && t >= e.ate)) elementos.splice(k, 1);
          }
        }
        // AS GRADES DE ESPINHOS: o ciclo é do relógio daqui, e a grade em pé pega coelho e bicho
        if (el === 'espinhos') {
          for (const [k, x, y] of gradesNaArena()) {
            const { estado, ciclo } = estadoDaGrade(t - inicioDaEtapa, k);
            if (estado !== 2) continue;
            pancadas.push({
              em: t,
              chave: `grade-${k}-${ciclo}`,
              dano: ESPINHOS.dano,
              derruba: false,
              lado: 1,
              dentro: (p) => Math.abs(p.x - x) <= ESPINHOS.meiaL && Math.abs(p.y - y) <= ESPINHOS.meiaP && p.z < 6,
            });
            for (const o of inimigos.values()) {
              const chave = `grade-${k}-${ciclo}-${o.id}`;
              if (gradesQuePegaram.has(chave) || !bichoDoChao(o)) continue;
              if (Math.abs(o.x - x) > ESPINHOS.meiaL || Math.abs(o.y - y) > ESPINHOS.meiaP) continue;
              gradesQuePegaram.add(chave);
              machucarBicho(o, ESPINHOS.danoNoBicho, o.lado * -40, false, t);
            }
          }
          if (gradesQuePegaram.size > 300) for (const c of [...gradesQuePegaram].slice(0, 150)) gradesQuePegaram.delete(c);
        }
      };
      /** Os bichos que já levaram cada subida de grade (uma vez por ciclo). */
      const gradesQuePegaram = new Set<string>();
      /** As grades da fase perto da arena de agora: [índice, x, y]. */
      const gradesNaArena = (): [number, number, number][] => {
        const r: [number, number, number][] = [];
        ONDAS_X.forEach((a, ka) => {
          if (a + ARENA_L < arena[0] - 20 || a > arena[1] + 20) return;
          ESPINHOS_NA_ARENA.forEach(([dx, y], kg) => r.push([ka * ESPINHOS_NA_ARENA.length + kg, a + dx, y]));
        });
        return r;
      };
      /** O rei-cogumelo marca um círculo debaixo de cada coelho (e onde a turma não está, se for um só). */
      const prepararEsporos = (i: Inimigo, t: number) => {
        i.ataque++;
        mudar(i, 'prep-esporos', ESPOROS.aviso);
        const quem = emPe();
        const lugares = quem.map((j) => [j.x, j.y] as [number, number]);
        if (lugares.length < 2) lugares.push([arena[0] + 30 + aleatorio() * (ARENA_L - 60), 8 + aleatorio() * (PROF - 16)]);
        for (const [x, y] of lugares) {
          elementos.push({
            id: proximoElemento++,
            tipo: 'esporo',
            x: Math.max(arena[0] + 12, Math.min(arena[1] - 12, x)),
            y: Math.max(0, Math.min(PROF, y)),
            estado: 1,
            lado: 1,
            desde: t,
            ate: i.ate,
            dono: i.id,
            ja: new Set(),
          });
        }
      };
      /** Os círculos do rei-cogumelo estouram: cada um é uma pancada, e a nuvem fica um pouco à vista. */
      const estourarEsporos = (i: Inimigo, t: number) => {
        for (const e of elementos) {
          if (e.tipo !== 'esporo' || e.dono !== i.id || e.estado !== 1) continue;
          e.estado = 2;
          e.ate = t + ESPOROS.nuvem;
          const ex = e.x, ey = e.y;
          pancada(i, `${i.id}-${i.ataque}`, danoDe(i) - 4, false, (j) => ((j.x - ex) / ESPOROS.raioX) ** 2 + ((j.y - ey) / ESPOROS.raioY) ** 2 <= 1 && j.z < 8);
        }
      };

      const passoDaRaposa = (i: Inimigo, dt: number, t: number) => {
        const alvo = maisPerto(i);
        switch (i.estado) {
          case 'entrando':
          case 'andando': {
            if (!alvo) return;
            const lado = i.x < alvo.x ? -1 : 1;
            // as raposas se dividem dos dois lados de quem atacam, e não empilham no mesmo lugar
            const outras = [...inimigos.values()].filter((o) => o !== i && bicho(o.tipo).comp === 'soco' && o.alvo === alvo.userId && o.estado !== 'morto');
            const mesmoLado = outras.filter((o) => Math.sign(o.x - alvo.x) === lado).length;
            const ladoFinal = mesmoLado > 0 && outras.length < 2 ? -lado : lado;
            // o lado que cai fora da arena não serve (a raposa ficaria presa na borda, sem chegar nunca)
            const fora = (x: number) => x < arena[0] + 12 || x > arena[1] - 12;
            const destinoX = fora(alvo.x + ladoFinal * 26) ? alvo.x - ladoFinal * 26 : alvo.x + ladoFinal * 26;
            const destinoY = alvo.y;
            i.alvo = alvo.userId;
            ir(i, destinoX, destinoY, i.estado === 'entrando' ? 55 : 46, 30, dt);
            i.lado = alvo.x > i.x ? 1 : -1;
            if (i.estado === 'entrando' && t >= i.ate) mudar(i, 'andando', 0);
            if (Math.abs(i.x - destinoX) < 3 && Math.abs(i.y - destinoY) < 3 && t >= i.proximoAtaque) {
              // a PREPARAÇÃO, longa e visível: é ela que paga a internet
              mudar(i, 'preparando', 520);
            }
            return;
          }
          case 'preparando':
            if (t >= i.ate) {
              mudar(i, 'atacando', 200);
              const x0 = i.x, y0 = i.y, lado = i.lado;
              pancada(i, `${i.id}-${++i.ataque}`, danoDe(i), false, (j) => {
                const dx = (j.x - x0) * lado;
                return dx >= 4 && dx <= 32 && Math.abs(j.y - y0) <= 8 && j.z < 10;
              });
            }
            return;
          case 'atacando':
            if (t >= i.ate) mudar(i, 'recuperando', 520);
            return;
          case 'recuperando':
          case 'esperando':
            if (t >= i.ate) {
              i.proximoAtaque = t + 500 + aleatorio() * 1000;
              mudar(i, 'andando', 0);
            }
            return;
        }
      };

      const passoDoCorvo = (i: Inimigo, dt: number, t: number) => {
        switch (i.estado) {
          case 'rondando': {
            // voa alto (só a voadora alcança), perto de uma borda da arena
            const borda = i.x < (arena[0] + arena[1]) / 2 ? arena[0] + 24 : arena[1] - 24;
            ir(i, borda, i.y, 60, 20, dt);
            i.z += (34 - i.z) * Math.min(1, dt * 3);
            i.lado = borda < (arena[0] + arena[1]) / 2 ? 1 : -1;
            const alvo = maisPerto(i);
            if (t >= i.ate && alvo) {
              i.alvo = alvo.userId;
              i.faixa = alvo.y;
              mudar(i, 'mirando', 750);
            }
            return;
          }
          case 'mirando':
            // o aviso: desce até a faixa de quem mira e fica batendo as asas (o site risca a linha do mergulho)
            ir(i, i.x, i.faixa, 0, 60, dt);
            i.z += (16 - i.z) * Math.min(1, dt * 5);
            if (t >= i.ate) {
              i.ataque++;
              i.vx = i.lado * 210;
              mudar(i, 'mergulhando', 2200);
            }
            return;
          case 'mergulhando': {
            const x0 = i.x;
            i.x += i.vx * dt;
            i.z += (6 - i.z) * Math.min(1, dt * 8);
            const x1 = i.x, y = i.y;
            pancada(i, `${i.id}-${i.ataque}`, danoDe(i), false, (j) => {
              const de = Math.min(x0, x1) - CORPO[i.tipo], ate = Math.max(x0, x1) + CORPO[i.tipo];
              return j.x >= de && j.x <= ate && Math.abs(j.y - y) <= 8 && j.z < 14;
            });
            if (t >= i.ate || (i.vx > 0 && i.x > arena[1] + 10) || (i.vx < 0 && i.x < arena[0] - 10)) {
              i.vx = 0;
              mudar(i, 'subindo', 700);
            }
            return;
          }
          case 'subindo':
            i.z += (34 - i.z) * Math.min(1, dt * 2.5);
            if (t >= i.ate) mudar(i, 'rondando', 1200 + aleatorio() * 1200);
            return;
        }
      };

      const passoDoTexugo = (i: Inimigo, dt: number, t: number) => {
        const alvo = maisPerto(i);
        switch (i.estado) {
          case 'entrando':
          case 'andando': {
            if (!alvo) return;
            i.alvo = alvo.userId;
            i.lado = alvo.x > i.x ? 1 : -1;
            const dx = Math.abs(alvo.x - i.x);
            if (i.estado === 'entrando') {
              ir(i, alvo.x - i.lado * 60, alvo.y, 40, 20, dt);
              if (t >= i.ate) mudar(i, 'andando', 0);
              return;
            }
            const golpe = bicho(i.tipo).golpe;
            // O GOLPE PRÓPRIO (21/11/2026): os esporos e a onda de choque, um ataque sim, um não (de qualquer distância); o
            // coice no lugar da pancada, para quem está perto (atrás ou na frente: ela se vira de costas)
            const especial = t >= i.proximoAtaque && (golpe === 'esporos' || golpe === 'onda') && i.ataque % 2 === 1;
            if (especial && golpe === 'esporos') {
              prepararEsporos(i, t);
            } else if (especial && golpe === 'onda') {
              i.alvoX = i.x;
              i.faixa = i.y;
              mudar(i, 'prep-onda', 1000);
            } else if (t >= i.proximoAtaque && golpe === 'coice' && dx < 60 && Math.abs(alvo.y - i.y) < 16) {
              // de costas para quem vai levar
              i.lado = alvo.x > i.x ? -1 : 1;
              mudar(i, 'prep-coice', 900);
            } else if (t >= i.proximoAtaque && dx > 80 && golpe === 'sopro' && aleatorio() < 0.45) {
              // o chefe que atira (o dragão), de longe, às vezes solta a rajada em vez da investida
              i.faixa = alvo.y;
              mudar(i, 'prep-sopro', 950);
            } else if (t >= i.proximoAtaque && dx > 80) {
              i.faixa = alvo.y;
              mudar(i, 'prep-investida', 950);
            } else if (t >= i.proximoAtaque && dx < 56 && Math.abs(alvo.y - i.y) < 14) {
              mudar(i, 'prep-pancada', 1000);
            } else {
              ir(i, alvo.x - i.lado * 40, alvo.y, 30, 22, dt);
            }
            return;
          }
          case 'prep-investida':
            // cava o chão olhando para a faixa (o site risca a linha da investida)
            ir(i, i.x, i.faixa, 0, 40, dt);
            if (t >= i.ate) {
              i.ataque++;
              i.vx = i.lado * 235;
              mudar(i, 'investida', 1300);
            }
            return;
          case 'investida': {
            const x0 = i.x;
            i.x += i.vx * dt;
            const x1 = i.x, y = i.y;
            pancada(i, `${i.id}-${i.ataque}`, danoDe(i), true, (j) => {
              const de = Math.min(x0, x1) - CORPO[i.tipo], ate = Math.max(x0, x1) + CORPO[i.tipo];
              return j.x >= de && j.x <= ate && Math.abs(j.y - y) <= 11 && j.z < 10;
            });
            if (t >= i.ate || (i.vx > 0 && i.x > arena[1] - 20) || (i.vx < 0 && i.x < arena[0] + 20)) {
              i.vx = 0;
              mudar(i, 'cansado', 1500);
            }
            return;
          }
          case 'prep-pancada':
            if (t >= i.ate) {
              mudar(i, 'pancada', 300);
              const x0 = i.x, y0 = i.y;
              // a pancada no chão: pega em volta, e quem está no ar escapa
              pancada(i, `${i.id}-${++i.ataque}`, danoDe(i) + 2, true, (j) => Math.abs(j.x - x0) <= 54 && Math.abs(j.y - y0) <= 18 && j.z < 6);
            }
            return;
          case 'pancada':
          case 'esporos':
          case 'coice':
            if (t >= i.ate) mudar(i, 'recuperando', 900);
            return;
          case 'prep-sopro':
            // enche o peito virado para a faixa (o site risca as três linhas)
            ir(i, i.x, i.faixa, 0, 30, dt);
            if (t >= i.ate) {
              for (const dy of [-14, 0, 14]) atirar(i, Math.max(0, Math.min(PROF, i.faixa + dy)), SOPRO_VEL, danoDe(i) - 6);
              mudar(i, 'sopro', 400);
            }
            return;
          case 'sopro':
            if (t >= i.ate) mudar(i, 'recuperando', 800);
            return;
          case 'prep-esporos':
            if (t >= i.ate) {
              estourarEsporos(i, t);
              mudar(i, 'esporos', 450);
            }
            return;
          case 'prep-coice':
            if (t >= i.ate) {
              mudar(i, 'coice', 300);
              const x0 = i.x, y0 = i.y, costas = -i.lado;
              // o chute para trás: quem está nas costas dela, até COICE.alcance
              pancada(i, `${i.id}-${++i.ataque}`, danoDe(i) + 4, true, (j) => {
                const dx = (j.x - x0) * costas;
                return dx >= 0 && dx <= COICE.alcance && Math.abs(j.y - y0) <= COICE.fundo && j.z < 8;
              });
              // a pancada empurra para longe dela
              pancadas[pancadas.length - 1].lado = costas > 0 ? 1 : -1;
            }
            return;
          case 'prep-onda':
            if (t >= i.ate) {
              i.ataque++;
              mudar(i, 'onda', Math.round(((ONDA_DE_CHOQUE.alcance - ONDA_DE_CHOQUE.inicio) / ONDA_DE_CHOQUE.vel) * 1000));
            }
            return;
          case 'onda': {
            // o anel corre do pé dele: cada passo é uma pancada da faixa do anel (pular por cima escapa)
            const r = raioDaOnda(t - i.desde);
            const x0 = i.alvoX, y0 = i.faixa;
            for (const j of emPe()) {
              const d = distanciaDaOnda(j.x - x0, j.y - y0);
              if (Math.abs(d - r) > ONDA_DE_CHOQUE.largura + 12) continue;
              pancadas.push({
                em: t,
                chave: `${i.id}-${i.ataque}`,
                dano: danoDe(i) - 4,
                derruba: true,
                lado: j.x >= x0 ? 1 : -1,
                dentro: (p) => Math.abs(distanciaDaOnda(p.x - x0, p.y - y0) - r) <= ONDA_DE_CHOQUE.largura / 2 && p.z < 6,
              });
            }
            if (t >= i.ate) mudar(i, 'recuperando', 900);
            return;
          }
          case 'cansado':
          case 'recuperando':
            if (t >= i.ate) {
              i.proximoAtaque = t + 700 + aleatorio() * 900;
              mudar(i, 'andando', 0);
            }
            return;
        }
      };

      /** Um tiro sai do bicho pela faixa `y`, para o lado em que ele olha. */
      const atirar = (i: Inimigo, y: number, vel: number, dano: number) => {
        tiros.push({ id: proximoTiro++, tipo: i.tipo, x: i.x + i.lado * (CORPO[i.tipo] + 4), y, vx: i.lado * vel, dano, ate: agora() + 3500 });
      };

      /** O que PULA: chega perto, se agacha mirando um ponto do chão (o site pisca o círculo ali) e cai em cima dele. */
      const passoDoPulo = (i: Inimigo, dt: number, t: number) => {
        const alvo = maisPerto(i);
        switch (i.estado) {
          case 'entrando':
          case 'andando': {
            if (!alvo) return;
            i.alvo = alvo.userId;
            i.lado = alvo.x > i.x ? 1 : -1;
            const lado = i.x < alvo.x ? -1 : 1;
            const fora = (x: number) => x < arena[0] + 12 || x > arena[1] - 12;
            const destinoX = fora(alvo.x + lado * 56) ? alvo.x - lado * 56 : alvo.x + lado * 56;
            ir(i, destinoX, alvo.y, i.estado === 'entrando' ? 55 : 40, 26, dt);
            if (i.estado === 'entrando' && t >= i.ate) mudar(i, 'andando', 0);
            if (i.estado === 'andando' && t >= i.proximoAtaque && Math.abs(i.x - alvo.x) < 80 && Math.abs(i.y - alvo.y) < 12) {
              // o ponto da queda é onde a pessoa está AGORA: quem se mexe durante o aviso escapa
              i.alvoX = Math.max(arena[0] + 12, Math.min(arena[1] - 12, alvo.x));
              i.faixa = alvo.y;
              i.lado = i.alvoX >= i.x ? 1 : -1;
              mudar(i, 'preparando', 650);
            }
            return;
          }
          case 'preparando':
            if (t >= i.ate) {
              i.x0 = i.x;
              i.y0 = i.y;
              mudar(i, 'saltando', SALTO_MS);
            }
            return;
          case 'saltando': {
            const p = Math.min(1, (t - i.desde) / SALTO_MS);
            i.x = i.x0 + (i.alvoX - i.x0) * p;
            i.y = i.y0 + (i.faixa - i.y0) * p;
            i.z = 4 * SALTO_ALTO * p * (1 - p);
            if (p >= 1) {
              i.z = 0;
              const x0 = i.x, y0 = i.y;
              pancada(i, `${i.id}-${++i.ataque}`, danoDe(i), true, (j) => Math.abs(j.x - x0) <= 22 && Math.abs(j.y - y0) <= 10 && j.z < 8);
              mudar(i, 'recuperando', 800);
            }
            return;
          }
          case 'recuperando':
          case 'esperando':
            if (t >= i.ate) {
              i.proximoAtaque = t + 700 + aleatorio() * 1000;
              mudar(i, 'andando', 0);
            }
            return;
        }
      };

      /** O que ATIRA: fica longe, na faixa de quem está mais perto, mira (a linha pisca) e atira. */
      const passoDoTiro = (i: Inimigo, dt: number, t: number) => {
        const alvo = maisPerto(i);
        switch (i.estado) {
          case 'entrando':
          case 'andando': {
            if (!alvo) return;
            i.alvo = alvo.userId;
            const lado = i.x < alvo.x ? -1 : 1;
            const fora = (x: number) => x < arena[0] + 14 || x > arena[1] - 14;
            const destinoX = fora(alvo.x + lado * 105) ? alvo.x - lado * 105 : alvo.x + lado * 105;
            ir(i, destinoX, alvo.y, i.estado === 'entrando' ? 55 : 38, 26, dt);
            i.lado = alvo.x > i.x ? 1 : -1;
            if (i.estado === 'entrando' && t >= i.ate) mudar(i, 'andando', 0);
            if (i.estado === 'andando' && t >= i.proximoAtaque && Math.abs(i.y - alvo.y) < 4 && Math.abs(i.x - alvo.x) > 50) {
              i.faixa = i.y;
              mudar(i, 'mirando', 800);
            }
            return;
          }
          case 'mirando':
            if (t >= i.ate) {
              atirar(i, i.faixa, TIRO_VEL, danoDe(i));
              mudar(i, 'atacando', 300);
            }
            return;
          case 'atacando':
            if (t >= i.ate) mudar(i, 'recuperando', 900);
            return;
          case 'recuperando':
          case 'esperando':
            if (t >= i.ate) {
              i.proximoAtaque = t + 1200 + aleatorio() * 1200;
              mudar(i, 'andando', 0);
            }
            return;
        }
      };

      /** Os tiros andam; cada passo é uma pancada do trecho percorrido (decidida com a folga, como as outras). */
      const passoDosTiros = (dt: number, t: number) => {
        for (let k = tiros.length - 1; k >= 0; k--) {
          const tr = tiros[k];
          const x0 = tr.x;
          tr.x += tr.vx * dt;
          const x1 = tr.x, y = tr.y;
          pancadas.push({
            em: t,
            chave: `tiro-${tr.id}`,
            dano: tr.dano,
            derruba: false,
            lado: tr.vx > 0 ? 1 : -1,
            dentro: (j) => j.x >= Math.min(x0, x1) - 6 && j.x <= Math.max(x0, x1) + 6 && Math.abs(j.y - y) <= 7 && j.z < 10,
          });
          if (t >= tr.ate || tr.x < arena[0] - 30 || tr.x > arena[1] + 30) tiros.splice(k, 1);
        }
      };

      const passoComum = (i: Inimigo, dt: number, t: number) => {
        // o que todos têm: apanhar, cair, levantar, sumir
        switch (i.estado) {
          case 'dor':
            i.x += i.vx * dt;
            i.vx *= 0.8;
            if (t >= i.ate) {
              i.proximoAtaque = Math.max(i.proximoAtaque, t + 400);
              mudar(i, voador(i) ? 'subindo' : 'andando', voador(i) ? 700 : 0);
            }
            return true;
          case 'caido':
            i.x += i.vx * dt;
            // o arremessado voa mais reto, e derruba quem encontra no caminho
            if (i.arremessoDe !== null && t < i.arremessoAte) {
              i.vx *= 0.93;
              arremessoNoCaminho(i, t);
            } else i.vx *= 0.85;
            i.z = Math.max(0, i.z - 120 * dt);
            if (t >= i.ate) {
              if (i.hp <= 0) mudar(i, 'morto', 900);
              else mudar(i, 'levantando', 450);
            }
            return true;
          case 'levantando':
            if (t >= i.ate) mudar(i, voador(i) ? 'subindo' : 'andando', voador(i) ? 900 : 0);
            return true;
          case 'morto':
            if (t >= i.ate) inimigos.delete(i.id);
            return true;
        }
        return false;
      };

      // ---------------- OS GOLPES INIMIGOS, DECIDIDOS COM A FOLGA ----------------
      const decidirPancadas = (t: number) => {
        for (let k = pancadas.length - 1; k >= 0; k--) {
          const p = pancadas[k];
          if (t < p.em + GRACA_MS) continue;
          pancadas.splice(k, 1);
          const ja = levaram.get(p.chave) ?? new Set<number>();
          for (const j of emPe()) {
            if (ja.has(j.userId) || j.invulAte > p.em) continue;
            // as posições que chegaram na janela da folga; sem nenhuma, a última de antes
            let janela = j.historia.filter((h) => h.t > p.em - PASSO_MS && h.t <= p.em + GRACA_MS);
            if (janela.length === 0) {
              const antes = j.historia.filter((h) => h.t <= p.em);
              janela = antes.length ? [antes[antes.length - 1]] : [{ t: p.em, x: j.x, y: j.y, z: j.z }];
            }
            if (!janela.every((h) => p.dentro(h))) continue;
            ja.add(j.userId);
            apanhar(j, p, t);
          }
          levaram.set(p.chave, ja);
        }
        if (levaram.size > 200) for (const k of [...levaram.keys()].slice(0, 100)) levaram.delete(k);
      };

      const apanhar = (j: Jogador, p: Pancada, t: number) => {
        j.hp = Math.max(0, j.hp - p.dano);
        // piscando depois do golpe: dois golpes juntos não somam (a queda inteira, quando derruba)
        j.invulAte = t + (p.derruba ? 2000 : 400);
        j.livreAte = t + 1500;
        evento_('p', j.userId, p.dano, p.derruba ? 1 : 0, p.lado);
        if (j.hp <= 0) nocautear(j, t);
      };

      const nocautear = (j: Jogador, t: number) => {
        j.estado = 'fora';
        j.vidas = Math.max(0, j.vidas - 1);
        j.voltaEm = t + VOLTA_MS;
        if (j.vidas === 0) j.estado = 'sem-vidas';
        evento_('k', j.userId, j.vidas);
        ctx.avisar();
      };

      // ---------------- O PASSO ----------------
      const tick = () => {
        if (fase === 'fim') return;
        const t = agora();
        const dt = PASSO_MS / 1000;
        passo++;
        naSalaAntes = naSalaAgora;
        naSalaAgora = presentes();
        // QUEM VOLTA À SALA (revisão independente, 03/11/2026): a posição dele no servidor é a de quando saiu, talvez numa
        // arena que já ficou para trás; vai para dentro da de agora, com o tempo livre da volta (o site o põe onde o
        // servidor disser, e anda dali)
        for (const j of jogadores.values()) {
          if (naSalaAgora.has(j.userId) && !naSalaAntes.has(j.userId)) {
            prenderNaArena(j);
            j.livreAte = t + 1500;
          }
        }
        if (fase === 'lutando' || fase === 'avancando') {
          // NINGUÉM DA TURMA NA SALA (nem que fique alguém assistindo): a fase acaba, perdida e sem troféu. Sem isso o passo
          // seguia 20 vezes por segundo por até 8 minutos, e a sala ficava presa em "já tem uma partida acontecendo".
          if (![...jogadores.keys()].some((id) => naSalaAgora.has(id))) return acabar(false, true);
          for (const j of jogadores.values()) {
            // o pulo que passou do tempo acaba, mesmo calado
            if (j.noArDesde !== null && t - j.noArDesde > AR_MAX_MS) pousar(j, t, true);
          }
          // os inimigos entram aos poucos
          if (fase === 'lutando' && fila.length && t >= proximaEntrada && naTela() < maxNaTela()) {
            entrar(fila.shift()!);
            proximaEntrada = t + 700 + aleatorio() * 900;
          }
          for (const i of [...inimigos.values()]) {
            if (!passoComum(i, dt, t)) {
              const comp = bicho(i.tipo).comp;
              if (comp === 'soco') passoDaRaposa(i, dt, t);
              else if (comp === 'mergulho') passoDoCorvo(i, dt, t);
              else if (comp === 'pulo') passoDoPulo(i, dt, t);
              else if (comp === 'tiro') passoDoTiro(i, dt, t);
              else passoDoTexugo(i, dt, t);
            }
            if (!voador(i) && i.estado !== 'caido' && i.estado !== 'saltando') i.z = 0;
            // quem anda pelo chão, depois de entrar, fica dentro da arena (senão o texugo esperava do lado de fora, onde
            // ninguém o alcança); o corvo passa da borda no mergulho e volta sozinho
            if (!voador(i) && i.estado !== 'entrando') i.x = Math.max(arena[0] + 12, Math.min(arena[1] - 12, i.x));
            i.y = Math.max(0, Math.min(PROF, i.y));
            i.historia.push({ t, x: i.x, y: i.y, z: i.z });
            while (i.historia.length && i.historia[0].t < t - 1000) i.historia.shift();
          }
          passoDosTiros(dt, t);
          passoDosElementos(dt, t);
          decidirPancadas(t);
          passoDasCuras(t);
          passoDosCaixotes(dt, t);
          // a volta de quem caiu
          for (const j of jogadores.values()) {
            if (j.estado === 'fora' && t >= j.voltaEm) {
              j.estado = 'em-pe';
              j.hp = VIDA;
              j.x = arena[0] + 30;
              j.y = PROF / 2;
              j.z = 0;
              j.noArDesde = null;
              j.precisaPisar = false;
              j.invulAte = t + 2000;
              j.livreAte = t + 1500;
              j.historia = [];
              evento_('r', j.userId, Math.round(j.x), Math.round(j.y));
              ctx.avisar();
            }
          }
          // a onda acabou: a seta, e a câmera anda quando alguém chega à frente
          if (trocaEm !== null) {
            if (t >= trocaEm) proximaEtapa(t);
          } else if (fase === 'lutando' && fila.length === 0 && inimigos.size === 0) {
            // A CAMPANHA: vencido o chefe, a fase seguinte começa logo (o site mostra o nome dela)
            if (onda === ondas.length - 1 && etapa < etapas.length - 1) trocaEm = t + 2500;
            else if (onda === ondas.length - 1) return acabar(true);
            else {
              fase = 'avancando';
              arena = [arena[0], ONDAS_X[onda + 1] + ARENA_L];
              ctx.avisar();
            }
          } else if (fase === 'avancando' && emPe().some((j) => j.x >= ONDAS_X[onda + 1] + 90)) {
            comecarOnda(onda + 1);
          }
          // todo mundo fora, sem vidas: acabou
          const daTurma = [...jogadores.values()].filter((j) => naSalaAgora.has(j.userId));
          if (daTurma.length && daTurma.every((j) => j.estado === 'sem-vidas')) return acabar(false);
          if (t - inicio > FASE_MAX_MS * etapas.length) return acabar(false);
        }
        difundir();
      };

      /** A próxima fase da campanha: a arena volta ao começo, todo mundo em pé ao lado do outro, e os tiros somem. */
      const proximaEtapa = (t: number) => {
        trocaEm = null;
        etapa++;
        ondas = ondasDa(etapas[etapa]);
        tiros.length = 0;
        curas.length = 0;
        elementos.length = 0;
        inicioDaEtapa = t;
        proximoTronco = t + TRONCO.intervalo[0];
        porCaixotes();
        pancadas.length = 0;
        inimigos.clear();
        arena = [ONDAS_X[0], ONDAS_X[0] + ARENA_L];
        let k = 0;
        for (const j of jogadores.values()) {
          if (j.estado === 'sem-vidas') continue;
          j.x = 40 + k * 14;
          j.y = 14 + k * 11;
          k++;
          j.z = 0;
          j.noArDesde = null;
          j.precisaPisar = false;
          j.invulAte = t + 2000;
          j.livreAte = t + 1500;
          j.historia = [];
          if (j.estado === 'em-pe') {
            j.hp = VIDA;
            evento_('r', j.userId, Math.round(j.x), Math.round(j.y));
          }
        }
        comecarOnda(0);
      };

      const difundir = () => {
        ctx.difundir?.({
          tipo: 'q',
          n: passo,
          f: fase,
          o: onda,
          a: arena,
          // a fase que está na tela (o índice em FASES_DA_BRIGA), e os tiros no ar: [id, tipo, x, y, lado]
          fs: Math.max(0, FASES_DA_BRIGA.findIndex((f) => f.id === etapas[etapa])),
          t: tiros.map((tr) => [tr.id, TIPOS.indexOf(tr.tipo), Math.round(tr.x), Math.round(tr.y), tr.vx > 0 ? 1 : -1]),
          i: [...inimigos.values()].map((i) => [
            i.id,
            TIPOS.indexOf(i.tipo),
            Math.round(i.x),
            Math.round(i.y),
            Math.round(i.z),
            ESTADOS.indexOf(i.estado),
            i.lado,
            Math.max(0, Math.round((i.hp / i.hpMax) * 100)),
            Math.min(255, Math.round((agora() - i.desde) / PASSO_MS)),
            Math.round(i.faixa),
            // no pulo, o x de onde vai cair (o site pisca o círculo ali)
            Math.round(i.alvoX),
            // 1 se é o bicho de elite da fase (o site desenha a aura)
            i.elite ? 1 : 0,
          ]),
          // as cenouras no chão: [id, grande, x, y]
          c: curas.map((c) => [c.id, c.grande ? 1 : 0, Math.round(c.x), Math.round(c.y)]),
          // os elementos de cenário (21/11/2026): [id, código em ELEMENTOS, x, y, estado, lado]; as grades com o estado do ciclo
          el: [
            ...elementos.map((e) => [e.id, ELEMENTOS.indexOf(e.tipo), Math.round(e.x), Math.round(e.y), e.estado, e.lado]),
            ...(elementoDaFase() === 'espinhos'
              ? gradesNaArena().map(([k, x, y]) => [100_000 + k, ELEMENTOS.indexOf('espinhos'), x, y, estadoDaGrade(agora() - inicioDaEtapa, k).estado, 1])
              : []),
          ],
          // os caixotes: [id, x, y, vida %, voando (1/0)]
          cx: [...caixotes.values()].map((c) => [c.id, Math.round(c.x), Math.round(c.y), Math.round((c.hp / CAIXOTE.hp) * 100), c.voando ? 1 : 0]),
          j: [...jogadores.values()].map((j) => [
            j.userId,
            Math.round(j.x),
            Math.round(j.y),
            Math.round(j.z),
            j.lado,
            j.acao,
            j.tAcao,
            j.hp,
            j.vidas,
            j.pontos,
            j.estado === 'em-pe' ? 0 : j.estado === 'fora' ? 1 : 2,
            j.avatar ?? 0,
            // o último golpe que o servidor aceitou: a página recarregada continua a contar dali (revisão independente,
            // 03/11/2026: ela recomeçava do 1, e nenhum golpe valia até passar da conta de antes)
            j.ultimoAtaque,
          ]),
          e: eventos,
        });
        eventos = [];
      };

      /** `vazia`: a turma inteira saiu (a partida conta como interrompida; o relógio do motor a encerra se a sala esvaziou). */
      const acabar = (venceu: boolean, vazia = false) => {
        if (fase === 'vitoria' || fase === 'derrota' || fase === 'fim') return;
        fase = venceu ? 'vitoria' : 'derrota';
        acabouEm = agora();
        difundir();
        ctx.avisar();
        if (vazia) parar();
        ctx.agendar(FIM_MS, () => terminar(venceu, !vazia));
      };

      const parar = () => {
        if (relogio !== null) limpar(relogio);
        relogio = null;
      };

      let resultado: { userId: number; username: string; pontos: number; golpes: number; nocautes: number; posicao: number | null }[] | null = null;
      const terminar = (venceu: boolean, completa = true) => {
        parar();
        fase = 'fim';
        const p = presentes();
        const turma = new Set([...ficaram].filter((id) => p.has(id)));
        const linhas = [...jogadores.values()]
          .map((j) => ({ userId: j.userId, username: ctx.nome(j.userId), pontos: j.pontos, golpes: j.golpes, nocautes: j.nocautes }))
          .sort((a, b) => b.pontos - a.pontos || a.username.localeCompare(b.username));
        // A POSIÇÃO vai daqui, só entre a turma (quem estava no começo de toda onda e no fim; empatados dividem), e null para
        // quem saiu, que vem depois (revisão independente, 03/11/2026: a tela dava medalha a todas as linhas, inclusive
        // depois de perder e no Solo, e o troféu não). A medalha, a tela só põe com a fase vencida, fora do Solo e com 2 ou
        // mais que ficaram: a mesma regra do pódio, logo abaixo.
        const daTurma = linhas.filter((l) => turma.has(l.userId));
        resultado = [
          ...daTurma.map((l) => ({ ...l, posicao: 1 + daTurma.filter((o) => o.pontos > l.pontos).length })),
          ...linhas.filter((l) => !turma.has(l.userId)).map((l) => ({ ...l, posicao: null })),
        ];
        // O PÓDIO: fase vencida, 2 pessoas ou mais que ficaram até o fim, até o 3º (empatados dividem), só quem fez ponto
        if (venceu && !solo && turma.size >= 2) {
          for (const l of resultado) {
            const posicao = l.posicao;
            if (posicao === null || posicao > 3 || l.pontos <= 0) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: pistaDaBriga(escolha),
              posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        venceuAFase = venceu;
        // O RECORDE DO SOLO (19/11/2026): o tempo da fase vencida (ou da campanha inteira), pelo relógio do servidor, na tabela
        // comum; a variante é a fase escolhida. Perder não grava nada.
        if (venceu && soloDe !== null && acabouEm !== null) {
          const ms = acabouEm - inicio;
          const j = jogadores.get(soloDe);
          try {
            recorde = { ms, ...db.guardarRecordeDoSolo(soloDe, 'briga', variante, ms, true, { pontos: j?.pontos ?? 0 }) };
          } catch {
            // a conta sumiu no meio (ou o teste sem conta): a partida acaba igual, sem o recorde
          }
        }
        ctx.terminar(completa);
      };

      // ---------------- O QUE A PESSOA MANDA (tempo real) ----------------
      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      /**
       * O pé no chão. `forcado`: o pulo passou de AR_MAX_MS (o servidor o põe no chão, e ele só pula de novo depois de mandar
       * uma posição no chão). A voadora só se libera depois de um pulo com AR_MIN_MS de ar de verdade.
       */
      const pousar = (j: Jogador, t: number, forcado: boolean) => {
        if (j.noArDesde !== null && t - j.noArDesde >= AR_MIN_MS) j.pisou = true;
        j.noArDesde = null;
        j.z = 0;
        if (forcado) j.precisaPisar = true;
      };

      /** A altura que o servidor aceita: a de um pulo (até Z_MAX, caindo a zero entre AR_TETO_MS e AR_MAX_MS). */
      const alturaDoPulo = (j: Jogador, z: number, t: number): number => {
        if (z <= 0) {
          pousar(j, t, false);
          j.precisaPisar = false;
          return 0;
        }
        if (j.precisaPisar) return 0;
        if (j.noArDesde === null) j.noArDesde = t;
        const ar = t - j.noArDesde;
        if (ar > AR_MAX_MS) {
          pousar(j, t, true);
          return 0;
        }
        const teto = ar <= AR_TETO_MS ? Z_MAX : (Z_MAX * (AR_MAX_MS - ar)) / (AR_MAX_MS - AR_TETO_MS);
        return Math.min(z, teto);
      };

      const registrarAtaque = (j: Jogador, id: unknown, g: unknown, z: number): void => {
        if (!numero(id) || !Number.isInteger(id) || id <= j.ultimoAtaque || id > j.ultimoAtaque + 1000) return;
        if (typeof g !== 'string' || !(g in GOLPES)) return;
        const golpe = g as Golpe;
        const t = agora();
        const ultimos = j.ataques;
        const anterior = ultimos.find((a) => a.id === id - 1);
        const antes = ultimos.find((a) => a.id === id - 2);
        // o soco e o especial são de quem está no chão; a voadora, de quem está num pulo de verdade
        if (golpe !== 'voadora' && (z > Z_DO_CHAO || j.noArDesde !== null)) return;
        if (golpe === 'soco1' || golpe === 'soco2' || golpe === 'soco3') {
          // o combo na ordem e no ritmo: o 2º logo depois do 1º, o 3º fecha os dois
          if (golpe === 'soco2' && (!anterior || anterior.golpe !== 'soco1' || t - anterior.em > 1000)) return;
          if (golpe === 'soco3' && (!anterior || anterior.golpe !== 'soco2' || !antes || antes.golpe !== 'soco1' || t - antes.em > 1800)) return;
          if (!gastar(j.baldes.socos)) return;
        } else if (golpe === 'voadora') {
          // no ar, uma por pulo (e o pulo só conta com AR_MIN_MS de ar: ver `pousar`), e com um balde por cima: alternar
          // z=0/z=5 dava ~12 voadoras por segundo
          if (z <= 0 || j.noArDesde === null || !j.pisou) return;
          if (!gastar(j.baldes.voadora)) return;
          j.pisou = false;
        } else {
          // o giro: só com a barra cheia (a recarga pelo relógio daqui, com a folga da rede)
          if (t - j.ultimoEspecial < RECARGA_ESPECIAL_MS - FOLGA_RECARGA_MS) return;
          j.ultimoEspecial = t;
        }
        j.ultimoAtaque = id;
        ultimos.push({ id, golpe, em: t, acertos: 0 });
        while (ultimos.length > 6) ultimos.shift();
      };

      const posicao = (j: Jogador, d: Record<string, unknown>) => {
        const { x, y, z, lado, acao, ta } = d;
        if (![x, y, z].every(numero)) return;
        const t = agora();
        let nx = Math.max(arena[0] - 8, Math.min(arena[1] + 8, x as number));
        let ny = Math.max(0, Math.min(PROF, y as number));
        const nz = alturaDoPulo(j, z as number, t);
        // não mais rápido que o coelho anda: o que se pode andar se acumula com o tempo (FOLGA_VEL × a velocidade), até um
        // teto pequeno para a rede (duas posições que chegam juntas); o empurrão e a volta dão um tempo livre
        const dt = Math.max(0, (t - j.ultimaEm) / 1000);
        // a arrancada anunciada (no chão, uma por ARRANCADA_RECARGA_MS, com folga da rede) dá um crédito a mais, à parte, que
        // vale pouco tempo e é gasto PRIMEIRO: o que sobra depois dela é só o andar de sempre (duas arrancadas emendadas não
        // dobram a distância), e passado o prazo o que sobrou se perde
        if (acao === ACAO_ARRANCADA && nz <= 0 && t - j.ultimaArrancada >= ARRANCADA_RECARGA_MS - 150) {
          j.ultimaArrancada = t;
          j.arrancadaAte = t + ARRANCADA_MS + 300;
          j.extraX = ARRANCADA_EXTRA;
        }
        if (t > j.arrancadaAte) j.extraX = 0;
        j.creditoX = Math.min(ACUMULO_X, j.creditoX + VEL_X * FOLGA_VEL * dt);
        j.creditoY = Math.min(ACUMULO_Y, j.creditoY + VEL_Y * FOLGA_VEL * dt);
        if (t > j.livreAte) {
          const podeX = j.creditoX + j.extraX;
          nx = j.x + Math.max(-podeX, Math.min(podeX, nx - j.x));
          ny = j.y + Math.max(-j.creditoY, Math.min(j.creditoY, ny - j.y));
          const gastoDoExtra = Math.min(j.extraX, Math.abs(nx - j.x));
          j.extraX -= gastoDoExtra;
          j.creditoX -= Math.abs(nx - j.x) - gastoDoExtra;
          j.creditoY -= Math.abs(ny - j.y);
        }
        j.x = nx;
        j.y = ny;
        j.z = nz;
        j.lado = lado === -1 ? -1 : 1;
        j.acao = numero(acao) && acao >= 0 && acao < ACOES.length ? Math.floor(acao) : 0;
        j.tAcao = numero(ta) ? Math.max(0, Math.min(5000, Math.round(ta))) : 0;
        j.ultimaEm = t;
        j.historia.push({ t, x: nx, y: ny, z: nz });
        while (j.historia.length && j.historia[0].t < t - 1500) j.historia.shift();
        if (d.ataque && typeof d.ataque === 'object') {
          const a = d.ataque as Record<string, unknown>;
          registrarAtaque(j, a.id, a.g, nz);
        }
      };

      /** O caixote se quebra: a cenoura sai de dentro (a grande às vezes). */
      const quebrarCaixote = (c: { id: number; x: number; y: number }, t: number) => {
        caixotes.delete(c.id);
        acertosNoCaixote.delete(c.id);
        const x = Math.max(arena[0] + 12, Math.min(arena[1] - 12, c.x));
        curas.push({ id: proximaCura++, grande: aleatorio() < CHANCE_DA_GRANDE, x, y: c.y, ate: t + CURA_MS });
        evento_('cq', c.id, Math.round(x), Math.round(c.y));
      };
      /** O caixote voando: anda pela faixa, derruba os bichos que encontra (cada um uma vez) e se quebra no fim. */
      const passoDosCaixotes = (dt: number, t: number) => {
        for (const c of [...caixotes.values()]) {
          if (!c.voando) continue;
          c.x += c.voando.vx * dt;
          const quem = jogadores.get(c.voando.de);
          for (const o of inimigos.values()) {
            if (c.voando.acertou.has(o.id) || o.hp <= 0 || voador(o)) continue;
            if (o.estado === 'caido' || o.estado === 'levantando' || o.estado === 'morto') continue;
            if (Math.abs(o.x - c.x) > CORPO[o.tipo] + CAIXOTE.larg || Math.abs(o.y - c.y) > 10) continue;
            c.voando.acertou.add(o.id);
            o.hp = Math.max(0, o.hp - ARREMESSO_DANO);
            evento_('h', o.id, c.voando.de, 'arremesso', Math.round(o.x), Math.round(o.y), Math.round(o.z));
            if (quem) {
              quem.pontos += ARREMESSO_DANO;
              quem.golpes++;
            }
            if (o.hp <= 0) {
              if (quem) {
                quem.pontos += PONTOS_NOCAUTE[o.tipo] * (o.elite ? 3 : 1);
                quem.nocautes++;
              }
              o.vx = Math.sign(c.voando.vx) * 110;
              mudar(o, 'caido', 1000);
              evento_('x', o.id, c.voando.de);
              talvezCura(o, t);
            } else if (bicho(o.tipo).comp !== 'chefe') {
              o.vx = Math.sign(c.voando.vx) * 120;
              mudar(o, 'caido', 1000);
            }
          }
          if (t >= c.voando.ate || c.x < arena[0] + 6 || c.x > arena[1] - 6) quebrarCaixote(c, t);
        }
      };
      /** Um golpe num caixote: a caixa do golpe contra o lugar dele (ele não anda), com as regras do golpe de sempre. */
      const acertoNoCaixote = (j: Jogador, d: Record<string, unknown>): string | null => {
        const t = agora();
        const ataque = j.ataques.find((a) => a.id === d.a);
        if (!ataque) return 'golpe que não começou';
        const g = GOLPES[ataque.golpe];
        if (t - ataque.em > g.dura + 500) return 'golpe velho';
        if (ataque.acertos >= (ataque.golpe === 'especial' ? 6 * VOLTAS_DO_GIRO : 6)) return 'acertos demais';
        const c = caixotes.get(d.caixote as number);
        if (!c || c.voando) return 'caixote fora';
        const volta = ataque.golpe === 'especial' && numero(d.v) ? d.v : 0;
        const chave = `${j.userId}:${ataque.id}:${volta}`;
        const ja = acertosNoCaixote.get(c.id) ?? new Set<string>();
        if (ja.has(chave)) return 'já acertou';
        const { x, y, z } = d;
        if (![x, y, z].every(numero)) return 'números';
        if (Math.abs((x as number) - j.x) > 30 || Math.abs((y as number) - j.y) > 16 || Math.abs((z as number) - j.z) > 20) return 'longe de si';
        const [a0, a1] = g.alcance;
        const dx = (c.x - (x as number)) * (ataque.golpe === 'especial' ? 1 : j.lado);
        if (!(dx + CAIXOTE.larg >= a0 - FOLGA_ACERTO && dx - CAIXOTE.larg <= a1 + FOLGA_ACERTO && Math.abs(c.y - (y as number)) <= g.fundo + 4)) return 'longe do caixote';
        if ((z as number) > 26) return 'alto demais';
        ja.add(chave);
        acertosNoCaixote.set(c.id, ja);
        ataque.acertos++;
        j.golpes++;
        if ((ataque.golpe === 'soco3' || ataque.golpe === 'voadora') && c.hp === CAIXOTE.hp) {
          // inteiro, o golpe forte o arremessa
          c.voando = { vx: j.lado * ARREMESSO_VEL, ate: t + ARREMESSO_MS, de: j.userId, acertou: new Set() };
          evento_('ca', c.id, j.userId);
          return null;
        }
        c.hp = Math.max(0, c.hp - g.dano);
        evento_('ch', c.id, j.userId);
        if (c.hp <= 0) quebrarCaixote(c, t);
        return null;
      };

      /** Um acerto: devolve por que não valeu, ou null (para o teste; o site não recebe resposta). */
      const acerto = (j: Jogador, d: Record<string, unknown>): string | null => {
        const t = agora();
        const ataque = j.ataques.find((a) => a.id === d.a);
        if (!ataque) return 'golpe que não começou';
        const g = GOLPES[ataque.golpe];
        if (t - ataque.em > g.dura + 500) return 'golpe velho';
        if (ataque.acertos >= (ataque.golpe === 'especial' ? 6 * VOLTAS_DO_GIRO : 6)) return 'acertos demais';
        const i = inimigos.get(d.inimigo as number);
        if (!i || i.hp <= 0 || i.estado === 'morto' || i.estado === 'caido' || i.estado === 'levantando') return 'inimigo fora';
        // o que voa alto (o corvo, o sapo no meio do pulo) só a voadora alcança
        if (i.z > 18 && ataque.golpe !== 'voadora') return 'alto demais';
        // o giro pega cada inimigo uma vez POR VOLTA: a volta vem no acerto, e não pode chegar antes da hora dela
        let volta = 0;
        if (ataque.golpe === 'especial') {
          volta = d.v as number;
          if (!numero(volta) || !Number.isInteger(volta) || volta < 0 || volta >= VOLTAS_DO_GIRO) return 'volta';
          if (t < ataque.em + volta * GIRO_TICK_MS - FOLGA_DA_VOLTA_MS) return 'volta adiantada';
        }
        const chave = ataque.golpe === 'especial' ? `${j.userId}:${ataque.id}:${volta}` : `${j.userId}:${ataque.id}`;
        if (i.acertos.has(chave)) return 'já acertou';
        const { x, y, z } = d;
        if (![x, y, z].every(numero)) return 'números';
        // quem bateu estava perto de onde o servidor o viu
        if (Math.abs((x as number) - j.x) > 30 || Math.abs((y as number) - j.y) > 16 || Math.abs((z as number) - j.z) > 20) return 'longe de si';
        // A ALTURA: o golpe de chão é de quem está no chão (e o servidor o viu no chão); a voadora pega o que está na altura
        // dela (a mesma conta do site, `encosta`, com folga), e no chão só enquanto o pulo dura
        const zz = Math.max(0, Math.min(Z_MAX, z as number));
        if (ataque.golpe !== 'voadora' && (zz > Z_DO_CHAO || j.z > Z_DO_CHAO)) return 'alto demais';
        const lado = j.lado;
        const [a0, a1] = g.alcance;
        const perto = i.historia.some((h) => {
          if (h.t < t - HISTORIA_MS) return false;
          if (ataque.golpe === 'voadora' ? Math.abs(h.z - zz) >= 26 + 6 : h.z >= 24) return false;
          const dx = (h.x - (x as number)) * (ataque.golpe === 'especial' ? 1 : lado);
          const w = CORPO[i.tipo];
          return dx + w >= a0 - FOLGA_ACERTO && dx - w <= a1 + FOLGA_ACERTO && Math.abs(h.y - (y as number)) <= g.fundo + 4;
        });
        if (!perto) return 'longe do inimigo';
        // valeu
        i.acertos.add(chave);
        if (i.acertos.size > 60) i.acertos = new Set([...i.acertos].slice(-30));
        ataque.acertos++;
        const chefe = bicho(i.tipo).comp === 'chefe';
        // atordoado: o bicho ainda está na dor de um soco anterior (o 1º e o 2º do combo o deixam assim)
        const atordoado = i.estado === 'dor';
        const dano = chefe && i.estado === 'cansado' ? Math.round(g.dano * 1.5) : g.dano;
        i.hp = Math.max(0, i.hp - dano);
        j.pontos += dano;
        j.golpes++;
        const empurra: 1 | -1 = ataque.golpe === 'especial' ? (i.x >= j.x ? 1 : -1) : lado;
        evento_('h', i.id, j.userId, ataque.golpe, Math.round(i.x), Math.round(i.y), Math.round(i.z));
        if (i.hp <= 0) {
          j.pontos += PONTOS_NOCAUTE[i.tipo] * (i.elite ? 3 : 1);
          j.nocautes++;
          i.vx = empurra * 110;
          mudar(i, 'caido', 1000);
          evento_('x', i.id, j.userId);
          talvezCura(i, t);
        } else if (chefe) {
          // o chefe aguenta firme: não cai nem para de atacar (ele pisca no site)
        } else if (ataque.golpe === 'soco3' && atordoado && !voador(i)) {
          // O ARREMESSO (19/11/2026): o soco final num bicho atordoado o joga longe, e ele derruba quem estiver no caminho
          i.vx = empurra * ARREMESSO_VEL;
          i.arremessoDe = j.userId;
          i.arremessoAte = t + ARREMESSO_MS;
          mudar(i, 'caido', 1100);
          evento_('a', i.id, j.userId);
        } else if (g.derruba || voador(i) || i.estado === 'saltando') {
          i.vx = empurra * 120;
          mudar(i, 'caido', 1000);
        } else {
          i.vx = empurra * 50;
          mudar(i, 'dor', 380);
        }
        return null;
      };

      porCaixotes();
      comecarOnda(0);
      relogio = intervalo(tick, PASSO_MS);

      return {
        publico() {
          return {
            fase,
            onda: onda + 1,
            ondas: ondas.length,
            // a fase escolhida (ou a campanha) e a que está na tela; "categoria" volta no "Jogar de novo"
            categoria: escolha,
            // a dificuldade do Solo (20/11/2026; na sala, sempre 'normal'): também volta no "Jogar de novo"
            dificuldade,
            cenario: etapas[etapa],
            etapa: etapa + 1,
            etapas: etapas.length,
            venceu: fase === 'vitoria' || (fase === 'fim' && venceuAFase),
            jogadores: [...jogadores.values()].map((j) => ({
              userId: j.userId,
              username: ctx.nome(j.userId),
              avatar: j.avatar,
              pontos: j.pontos,
              vidas: j.vidas,
            })),
            resultado: fase === 'fim' ? resultado : null,
            partidaId: evento,
            // no Solo: o melhor tempo de antes desta fase, e no fim o tempo feito e se virou recorde
            ...(solo ? { melhorAntes: melhorDeAntes, recorde } : {}),
          };
        },
        acao(quem, corpo) {
          // tudo da briga vem pelo tempo real; a ação HTTP é só para o caso de o socket cair (nada a fazer)
          if (!jogadores.has(quem)) return 'Você está assistindo esta partida.';
          return corpo.tipo === 'nada' ? null : 'Ação desconhecida.';
        },
        tempoReal(quem, dados) {
          const j = jogadores.get(quem);
          if (!j || !dados || typeof dados !== 'object' || (fase !== 'lutando' && fase !== 'avancando')) return null;
          const d = dados as Record<string, unknown>;
          if (j.estado !== 'em-pe') return null;
          if (d.tipo === 'pos') {
            if (gastar(j.baldes.pos)) posicao(j, d);
          } else if (d.tipo === 'golpe') {
            if (gastar(j.baldes.golpe)) ultimoMotivo = d.caixote !== undefined ? acertoNoCaixote(j, d) : acerto(j, d);
          }
          // nada se repassa direto: o quadro de 20 por segundo leva tudo a todos
          return null;
        },
        conferir() {
          if (fase === 'fim') parar();
        },
        parar,
        // para o teste
        ...({ _passo: tick, _inimigos: inimigos, _jogadores: jogadores, _caixotes: caixotes, _curas: curas, _elementos: elementos, _motivo: () => ultimoMotivo, _arena: () => arena } as object),
      };
    },
  };
}
