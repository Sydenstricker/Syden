import {
  AMOSTRA,
  amostrar,
  atingir,
  fantasmaEm,
  largada,
  nivelDaCarga,
  novoKart,
  PASSO,
  passo,
  passosEmMs,
  pilotoAutomatico,
  progresso,
  TEMPO_DA_CHUVA,
  TEMPO_DA_TOCA,
  type Comandos,
  type Kart,
  VTURBO,
} from './fisica';
import { criarMotor, tocar } from '../somDosJogos';
import { comandosComControle } from './controle';
import { andarRobo, CASA_DE_QUEM_JOGA, criarRobos, largadaDoRobo, ordemDaCorrida, porNaGrade, progressoDoRobo, type DificuldadeDaCorrida, type RoboDoKart } from './robos';
import { HORTA, ladoFechado, montarPista, passosAteFechar, type DefinicaoDaPista, type Pista } from './pista';
import { caixaNoChao } from './caixaEmFatias';
import {
  cameraAtras,
  desenharChao,
  faiscas,
  figuraNoChao,
  TELA_H as H,
  kartNaTela,
  mapaDaPista,
  pontoNoMapa,
  prepararDesenho,
  projetar,
  TELA_W as W,
  ESCALA_DA_TELA,
  type Desenho,
  type Figura,
} from './render';

/**
 * O LAÇO DA CORRIDA (03/11/2026): o que o contra o relógio (degrau 1) e a corrida na sala (degraus 2 e 3) têm em comum — a
 * física em passos fixos, a câmera, o desenho e o mapa pequeno. Quem chama diz o que muda: a pista, os fantasmas, os RIVAIS
 * ao vivo (que chegam pelo socket), os ITENS, a contagem da largada e o que fazer na chegada.
 *
 * Com a janela sem foco, o kart PARA (a física e o relógio também). Na sala isso não tira vantagem de ninguém: o tempo de
 * cada um é contado nos passos dele, desde o sinal verde dele.
 *
 * OS ITENS (degrau 3, só na sala): as caixas ficam em fileiras na pista, e cada um pega as suas no próprio computador (a
 * caixa que um pegou continua para os outros). O item sai conforme a posição: quem está atrás ganha mais cenoura e
 * repolho; quem está na frente, mais lama. Tudo o que um item faz é um EVENTO com o passo da corrida de quem o usou, e todo
 * computador simula o mesmo trajeto a partir dele (o repolho anda pela linha do meio, a lama fica onde caiu). Quem decide
 * se foi atingido é o computador de quem leva — que vê o item chegando, e avisa os outros para ele sumir.
 */

let pistaGuardada: Pista | null = null;
let coelhoPronto: HTMLImageElement | null = null;

/**
 * A pista da corrida que vai rodar (uns 300 ms de conta e ~24 MB). Fica guardada SÓ A ÚLTIMA: "Jogar de novo" e o
 * StrictMode, que monta duas vezes, não a refazem, e a da corrida anterior da copa é solta quando a próxima chega. Antes
 * ficavam todas, para sempre, e a escolha da pista montava as seis só para os mapas pequenos (revisão independente,
 * 03/11/2026: ~2 s travando a tela e ~143 MB presos); o mapa da escolha sai agora só da linha do meio (MapaDaPista).
 */
export function pistaDaCorrida(def: DefinicaoDaPista = HORTA): Pista {
  if (pistaGuardada?.def.id !== def.id) pistaGuardada = montarPista(def);
  return pistaGuardada;
}

async function coelho(): Promise<HTMLImageElement> {
  if (!coelhoPronto) {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}corrida/coelho-kart.png`;
    await img.decode().catch(() => undefined);
    coelhoPronto = img;
  }
  return coelhoPronto;
}

/** Uma posição de um rival, como chegou pelo socket: o passo da corrida DELE em que ele estava ali. */
export interface PosicaoDoRival {
  n: number;
  x: number;
  y: number;
  a: number;
  andou: number;
}

export interface Rival {
  nome: string;
  /** O avatar pronto (as cores do kart), ou null. */
  avatar?: number | string | null;
  /** Em ordem de passo; o laço lê, quem recebe do socket acrescenta. */
  posicoes: PosicaoDoRival[];
}

export interface LinhaDaOrdem {
  id: number;
  nome: string;
  eu: boolean;
}

/**
 * OS ITENS (03/11/2026 os três primeiros; 05/11/2026, pedido dele, mais cinco). Só a mecânica, no tema do coelho:
 * - cenoura: um turbo; cenouras: três turbos, um por aperto;
 * - repolho: rola pela linha do meio por 4 s e derruba quem pega;
 * - repolho-roxo: mais rápido, e SEGUE até o kart que estava logo à frente de quem o soltou (só ele pode ser derrubado);
 * - lama: fica 30 s onde caiu;
 * - alface: um escudo de folhas por 12 s, que segura o próximo repolho ou lama;
 * - toca: o coelho cava e anda 3 s por baixo da terra (nada o pega, a grama não segura, as árvores não batem);
 * - regador: chove 3 s em quem está na frente de quem o usou (o kart escorrega como no gelo). Só cai para os de trás.
 */
export type Item = 'cenoura' | 'cenouras' | 'repolho' | 'repolho-roxo' | 'lama' | 'alface' | 'toca' | 'regador';

/** O que um item fez, no passo `n` da corrida de quem o usou. O servidor carimba o `dono`. */
export type EventoDeItem =
  | { tipo: 'repolho'; id: string; dono: number; n: number; s: number; lado: number }
  | { tipo: 'repolho-roxo'; id: string; dono: number; n: number; s: number; lado: number; alvo: number | null }
  | { tipo: 'lama'; id: string; dono: number; n: number; x: number; y: number }
  | { tipo: 'alface' | 'toca' | 'regador'; id: string; dono: number; n: number }
  /** O item pegou alguém (ou bateu num escudo) e sumiu para todos. */
  | { tipo: 'acertou'; id: string }
  /** O escudo de alface `id` segurou um item e acabou. */
  | { tipo: 'gastou'; id: string };

export interface Itens {
  /** Todos os eventos da corrida, os meus e os que chegaram: o laço lê, quem recebe do socket acrescenta. */
  eventos: EventoDeItem[];
  /** Um evento meu, para mandar aos outros (o laço já o pôs em `eventos`). */
  aoEvento: (e: EventoDeItem) => void;
  /** O item na mão mudou (para o botão de toque), e quantos usos ele ainda tem (as três cenouras). */
  aoItem?: (item: Item | null, usos: number) => void;
}

/** Os tipos de evento que o servidor repassa (o site confere o que chega pelo socket contra esta lista). */
export const TIPOS_DE_EVENTO = ['repolho', 'repolho-roxo', 'lama', 'alface', 'toca', 'regador', 'acertou', 'gastou'] as const;

export interface OpcoesDoLaco {
  canvas: HTMLCanvasElement;
  /** O que o teclado e o toque estão apertando (quem chama escreve aqui). */
  comandos: Comandos;
  pista: DefinicaoDaPista;
  /** Sem kart (quem assiste): a câmera vai atrás de quem está na frente. */
  piloto: boolean;
  eu: number;
  /** O meu avatar pronto (as cores do meu kart), ou null. */
  meuAvatar?: number | string | null;
  /** Os fantasmas (amostras do servidor) do contra o relógio, com o avatar de quem é. */
  fantasmas?: { amostras: number[]; avatar: number | string | null }[];
  /** Os rivais da sala, por id. */
  rivais?: Map<number, Rival>;
  /** Os itens (só na sala). */
  itens?: Itens;
  /** Passos de semáforo antes do verde (3 s = 180). */
  contagem: number;
  /** A pausa do ESC (pausaDosJogos.tsx), só no Solo: lida a cada quadro, como a janela sem foco. */
  pausa?: { readonly ativa: boolean };
  aoPlacar: (p: { volta: number; ms: number; pausado: boolean }) => void;
  /** A ordem de quem está na frente (só com rivais): muda pouco, e só é avisada quando muda. */
  aoOrdem?: (ordem: LinhaDaOrdem[]) => void;
  /** A cada AMOSTRA passos, onde o kart está (para mandar aos rivais). */
  aoPosicao?: (p: PosicaoDoRival) => void;
  /** 1,6 s depois da linha de chegada: as voltas (em passos) e o caminho inteiro. */
  aoChegar?: (voltas: number[], caminho: number[]) => void;
  /**
   * OS ROBÔS (19/11/2026, só no Solo contra o computador): quantos e o quanto apertam. Com eles, quem joga larga na última
   * fila da grade, e a chegada avisa a classificação (aoClassificacao) antes do aoChegar.
   */
  robos?: { quantos: number; dificuldade: DificuldadeDaCorrida };
  /**
   * OS ROBÔS NA SALA (24/11/2026): os mesmos robôs andam em todo computador da sala, pela mesma conta, passo a passo desde o
   * verde de cada um. Para não se separarem de um computador para o outro, eles só usam o que todos sabem igual: o item sai da
   * posição entre os robôs (e o roxo mira o robô da frente), os eventos deles ficam aqui (não vão ao servidor), e um robô só é
   * derrubado por item de robô. Os itens dos robôs pegam as pessoas pela regra de sempre: quem leva decide.
   */
  robosNaSala?: boolean;
  /**
   * Na sala, o que este computador viu dos robôs (24/11/2026: eles entram na classificação, e o tempo que vale é o que mais
   * computadores mandarem): a cada segundo e quando um chega, o passo e, de cada robô, [o passo da chegada (0: correndo), o
   * quanto andou].
   */
  aoRobos?: (n: number, robos: [number, number][]) => void;
  /** A classe rápida (o teto vezes isto), só contra os robôs. */
  classe?: number;
  /** A classificação na hora em que quem joga cruzou a chegada: quem chegou antes, eu, e quem ainda corria (pelo quanto andou). */
  aoClassificacao?: (lista: LinhaDaClassificacao[]) => void;
}

export interface LinhaDaClassificacao {
  id: number;
  nome: string;
  eu: boolean;
  /** O tempo da corrida em passos (null: não tinha chegado quando eu cheguei). */
  passos: number | null;
  avatar: number | string | null;
}

/** Onde um rival estava no passo `n`, entre duas posições; depois da última, um pouco à frente dela (no máximo 1/4 s). */
export function rivalEm(posicoes: PosicaoDoRival[], n: number): PosicaoDoRival | null {
  if (posicoes.length === 0) return null;
  let i = posicoes.length - 1;
  while (i > 0 && posicoes[i].n > n) i--;
  const a = posicoes[i];
  const b = posicoes[i + 1];
  if (b && b.n > a.n) {
    const t = Math.max(0, Math.min(1, (n - a.n) / (b.n - a.n)));
    return { n, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: a.a + (b.a - a.a) * t, andou: a.andou + (b.andou - a.andou) * t };
  }
  // depois da última: segue na direção que vinha, para a internet lenta não fazer o kart dar trancos
  const antes = posicoes[i - 1];
  if (!antes || a.n <= antes.n || n <= a.n) return a;
  const passos = Math.min(n - a.n, 15) / (a.n - antes.n);
  return { n, x: a.x + (a.x - antes.x) * passos, y: a.y + (a.y - antes.y) * passos, a: a.a, andou: a.andou };
}

/** O repolho anda 230 unidades por segundo pela linha do meio, por 4 s; a lama fica 30 s. */
export const VELOCIDADE_DO_REPOLHO = 230;
export const VIDA_DO_REPOLHO = 4 * 60;
export const VIDA_DA_LAMA = 30 * 60;

/** O ponto da linha do meio a `s` unidades da largada (dá a volta), e a direção dela ali. */
export function pontoNaLinha(p: Pista, s: number): { x: number; y: number; dx: number; dy: number } {
  const n = p.lx.length;
  const sv = ((s % p.comprimento) + p.comprimento) % p.comprimento;
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (p.la[m] <= sv) lo = m;
    else hi = m - 1;
  }
  const a = lo, b = (lo + 1) % n;
  const seg = p.la[lo + 1] - p.la[lo] || 1;
  const t = (sv - p.la[lo]) / seg;
  const dx = p.lx[b] - p.lx[a], dy = p.ly[b] - p.ly[a], l = Math.hypot(dx, dy) || 1;
  return { x: p.lx[a] + dx * t, y: p.ly[a] + dy * t, dx: dx / l, dy: dy / l };
}

/** Onde está o repolho no passo `m` de quem olha (null se ainda não saiu ou já acabou). */
export function repolhoEm(p: Pista, e: { n: number; s: number; lado: number }, m: number) {
  const dt = m - e.n;
  if (dt < 0 || dt > VIDA_DO_REPOLHO) return null;
  const q = pontoNaLinha(p, e.s + (VELOCIDADE_DO_REPOLHO * dt) / 60);
  return { x: q.x - q.dy * e.lado, y: q.y + q.dx * e.lado };
}

/** O repolho-roxo: 290 unidades por segundo, por 6 s, atrás do kart que estava à frente de quem o soltou. */
export const VELOCIDADE_DO_ROXO = 290;
export const VIDA_DO_ROXO = 6 * 60;
/** O escudo de alface dura 12 s (ou até segurar um item); a toca e a chuva, 3 s (em passos, para o desenho dos outros). */
export const VIDA_DA_ALFACE = 12 * 60;
export const PASSOS_DA_TOCA = 3 * 60;
export const PASSOS_DA_CHUVA = 3 * 60;

/** Onde está o repolho-roxo no passo `m` (null se ainda não saiu ou já acabou): pela linha do meio, indo ao centro. */
export function roxoEm(p: Pista, e: { n: number; s: number; lado: number }, m: number) {
  const dt = m - e.n;
  if (dt < 0 || dt > VIDA_DO_ROXO) return null;
  const q = pontoNaLinha(p, e.s + (VELOCIDADE_DO_ROXO * dt) / 60);
  const lado = e.lado * Math.max(0, 1 - dt / 60);
  return { x: q.x - q.dy * lado, y: q.y + q.dx * lado };
}

/**
 * O repolho-roxo alcançou quem está em `sVitima` (o ponto da linha do meio dela) no passo `m`? Quem decide é o alvo, como
 * nos outros itens: o repolho anda pela linha do meio, e alcança quando já andou o quanto o alvo estava à frente dele.
 */
export function roxoAlcancou(p: Pista, e: { n: number; s: number }, m: number, sVitima: number): boolean {
  const dt = m - e.n;
  if (dt < 0 || dt > VIDA_DO_ROXO) return false;
  const andou = (VELOCIDADE_DO_ROXO * dt) / 60;
  const distancia = (((sVitima - e.s) % p.comprimento) + p.comprimento) % p.comprimento;
  return andou >= distancia - 6 && andou - distancia < 60;
}

/**
 * O item que sai da caixa, pela posição (0 = na frente) entre `total`. Quem está atrás ganha mais cenoura, toca e regador;
 * quem está na frente, mais lama, alface e repolho. O líder nunca ganha o roxo (não há ninguém à frente) nem o regador, e o
 * regador só existe com 3 ou mais na corrida, para os do último terço.
 */
export function sortearItem(posicao: number, total: number, sorte = Math.random): Item {
  const a = total > 1 ? posicao / (total - 1) : 0.5;
  const pesos: [Item, number][] = [
    ['cenoura', 0.08 + 0.17 * a],
    ['cenouras', 0.2 * a],
    ['repolho', 0.25 - 0.1 * a],
    ['repolho-roxo', posicao === 0 ? 0 : 0.18 * (1 - Math.abs(2 * a - 1)) + 0.04],
    ['lama', 0.35 - 0.3 * a],
    ['alface', 0.25 - 0.15 * a],
    ['toca', 0.02 + 0.13 * a],
    ['regador', total >= 3 && a > 0.6 ? (0.15 * (a - 0.6)) / 0.4 : 0],
  ];
  const soma = pesos.reduce((s, [, w]) => s + w, 0);
  let r = sorte() * soma;
  for (const [item, w] of pesos) {
    if (r < w) return item;
    r -= w;
  }
  return 'cenoura';
}

export function rodarCorrida(o: OpcoesDoLaco): () => void {
  // o que o teclado e o toque apertam (quem chama escreve), somado a cada quadro ao controle de videogame (controle.ts)
  const doTeclado = o.comandos;
  const comandos: Comandos = { ...doTeclado };
  let vivo = true;
  let quadro = 0;
  const d: Desenho = prepararDesenho(o.canvas, o.pista.tema);
  /** O ronco do motor (19/11/2026, a auditoria: a corrida não tinha som nenhum), só de quem pilota. */
  let motor: ReturnType<typeof criarMotor> | null = null;

  void (async () => {
    d.coelho = await coelho();
    if (!vivo) return;
    const p = pistaDaCorrida(o.pista);
    const mapa = mapaDaPista(p, 56);
    const kart: Kart = novoKart(p);
    kart.classe = o.classe ?? 1;
    if (o.piloto) motor = criarMotor();
    // OS ROBÔS (só no Solo contra o computador): karts de verdade, cada um com os comandos dele, que entram na mesma lista
    // dos rivais da sala (o desenho, o nome em cima, a ordem e os itens servem igual); quem joga larga na última fila
    const robos: RoboDoKart[] = o.robos ? criarRobos(p, o.robos.quantos, o.robos.dificuldade, kart.classe) : [];
    if (robos.length) porNaGrade(kart, p, CASA_DE_QUEM_JOGA);
    const todosOsRivais: Map<number, Rival> | undefined = o.rivais ?? (robos.length ? new Map() : undefined);
    for (const r of robos) todosOsRivais!.set(r.id, { nome: r.nome, avatar: r.avatar, posicoes: [] });
    /** Os itens dos robôs: o que cada um tem na mão, quando vai usar, o escudo, e as caixas que ele já pegou. */
    const maoDoRobo = new Map<number, { item: Item; usos: number; usarEm: number }>();
    const escudoDoRobo = new Map<number, { id: string; ate: number }>();
    /** A posição de cada um na corrida agora (0 = na frente), e quem está logo à frente dele (o alvo do repolho-roxo). */
    const posicaoDe = new Map<number, number>();
    const aFrenteDe = new Map<number, number | null>();
    let classificacao: LinhaDaClassificacao[] | null = null;
    /** Por quantos passos o acelerador está apertado durante o semáforo (o turbo da largada). */
    let segurou = 0;
    let luzAntes = -1;
    const caminho: number[] = [];
    let camAngulo = kart.angulo;
    let contagem = o.contagem;
    let acumulado = 0;
    let antes = performance.now();
    let fimEm = 0;
    let avisouChegada = false;
    let tremor = 0;
    let pausado = false;
    let ordemAntes = '';
    /** Quem assiste: o passo da corrida que se mostra (o de quem está mais à frente no tempo). */
    let nAssistindo = 0;
    /** A minha posição agora (0 = na frente) e quantos correm: decide o item da caixa. */
    let minhaPosicao = 0;
    let quantos = 1;

    // AS CAIXAS: fileiras de quatro atravessando o asfalto, e a cada caixa o passo até quando ela está pega (para mim)
    const caixas = o.itens
      ? o.pista.caixas.flatMap((f) => {
          const q = pontoNaLinha(p, f * p.comprimento);
          return [-18, -6, 6, 18].map((lado) => ({ x: q.x - q.dy * lado, y: q.y + q.dx * lado, giro: Math.atan2(q.dy, q.dx), ate: 0 }));
        })
      : [];
    /** Cada robô pega as caixas dele (como cada pessoa na sala): até que passo cada caixa está pega para ele. */
    const caixasDoRobo = new Map(robos.map((r) => [r.id, caixas.map(() => 0)]));
    let meuItem: Item | null = null;
    /** Quantos usos o item na mão ainda tem (as três cenouras; os outros, 1). */
    let usos = 0;
    let usavaAntes = false;
    const acertados = new Set<string>();
    /** O meu escudo de alface: o id do evento e até que passo ele vale (0 = sem escudo). */
    let meuEscudo: { id: string; ate: number } | null = null;
    /** Os regadores que já choveram (ou não) em mim, e o quanto o dono tinha andado quando o usou (para o desenho). */
    const regadoresVistos = new Set<string>();
    const andouDoDono = new Map<string, number>();
    /** Quem está logo à frente de mim agora (o alvo do repolho-roxo), pela ordem da corrida. */
    let aFrente: number | null = null;
    const pegarItem = (item: Item | null) => {
      meuItem = item;
      usos = item === 'cenouras' ? 3 : item ? 1 : 0;
      // o botão de toque some com o item antes de o dedo levantar: a tecla "usar" volta sozinha, senão o próximo item
      // precisaria de dois toques (revisão de 03/11/2026)
      if (item === null) doTeclado.usa = comandos.usa = false;
      o.itens?.aoItem?.(item, usos);
    };
    const lancar = (e: EventoDeItem) => {
      o.itens!.eventos.push(e);
      o.itens!.aoEvento(e);
    };
    /** O evento de um robô: no Solo, como os meus; na sala, só aqui (cada computador o faz igual). */
    const lancarDoRobo = (e: EventoDeItem) => {
      if (o.robosNaSala) o.itens!.eventos.push(e);
      else lancar(e);
    };
    /** Na sala: os itens que já pegaram um robô (só os robôs contam, para todo computador ver o mesmo). */
    const sumiramParaOsRobos = new Set<string>();

    const andar = () => {
      if (contagem > 0) {
        // o bipe de cada luz do semáforo, e o turbo da largada: por quantos passos o acelerador já está apertado
        const luz = Math.floor((contagem - 1) / 60);
        if (luz !== luzAntes && o.piloto) {
          luzAntes = luz;
          tocar('largada');
        }
        segurou = comandos.acelera ? segurou + 1 : 0;
        contagem--;
        if (contagem === 0 && o.piloto) {
          tocar('chegada');
          const r = largada(kart, segurou, o.contagem);
          if (r === 'turbo') tocar('turbo');
          else if (r === 'patina') tocar('derrapa');
          for (const robo of robos) largadaDoRobo(robo, o.robos!.dificuldade, o.contagem);
        }
        return;
      }
      if (!o.piloto) return;
      const jaTinhaChegado = kart.terminou;
      const auto = import.meta.env.DEV && (window as { corridaPilotoAutomatico?: boolean }).corridaPilotoAutomatico;
      const c = auto ? { ...pilotoAutomatico(kart, p, true), usa: meuItem !== null } : comandos;
      const derivaAntes = kart.deriva, turboAntes = kart.turbo, voltaAntes = kart.volta;
      passo(kart, c, p);
      // OS ROBÔS andam o mesmo passo, e a posição deles entra na lista dos rivais (no passo da minha corrida)
      let algumChegou = false;
      for (const r of robos) {
        if (andarRobo(r, p, o.robosNaSala ? undefined : progresso(kart, p))) algumChegou = true;
        const rv = todosOsRivais!.get(r.id)!;
        const andou = r.kart.terminou ? p.def.voltas + 0.5 - r.chegada / 1e6 : progressoDoRobo(r, p);
        rv.posicoes.push({ n: kart.passos, x: r.kart.x, y: r.kart.y, a: r.kart.angulo, andou });
        if (rv.posicoes.length > 240) rv.posicoes.splice(0, 120);
      }
      if (o.aoRobos && robos.length && (algumChegou || kart.passos % 60 === 0)) {
        o.aoRobos(kart.passos, robos.map((r) => [r.chegada, +progressoDoRobo(r, p).toFixed(3)]));
      }
      if (!jaTinhaChegado) {
        amostrar(kart, caminho);
        if ((kart.passos - 1) % AMOSTRA === 0) {
          o.aoPosicao?.({ n: kart.passos, x: +kart.x.toFixed(1), y: +kart.y.toFixed(1), a: +kart.angulo.toFixed(3), andou: +progresso(kart, p).toFixed(3) });
        }
        // OS SONS do que aconteceu neste passo
        if (derivaAntes === 0 && kart.deriva !== 0) tocar('derrapa');
        if (kart.turbo > turboAntes + 0.05) tocar('turbo');
        if (kart.bateu && tremor === 0) tocar('impacto');
        if (kart.volta > voltaAntes) tocar(kart.terminou ? 'chegada' : 'bandeira');
        if (kart.terminou && robos.length) {
          // a classificação na hora da minha chegada: quem já tinha chegado, eu, e os outros pelo quanto andaram
          const linhas = [
            { id: o.eu, nome: '', eu: true, chegada: kart.voltas[kart.voltas.length - 1], andou: p.def.voltas, avatar: o.meuAvatar ?? null },
            ...robos.map((r) => ({ id: r.id, nome: r.nome, eu: false, chegada: r.chegada, andou: progressoDoRobo(r, p), avatar: r.avatar as number | string | null })),
          ];
          classificacao = ordemDaCorrida(linhas).map((l) => ({ id: l.id, nome: l.nome, eu: l.eu, passos: l.chegada || null, avatar: l.avatar }));
        }
      }
      if (o.itens && !kart.terminou) usarItens(c);
      if (o.itens && robos.length) itensDosRobos();
      if (kart.bateu) tremor = 6;
      // a câmera vai atrás do rumo, puxada um pouco para o nariz: na derrapagem, o kart aparece virado
      seguir(kart.rumo + (kart.angulo - kart.rumo) * 0.35);
    };

    const usarItens = (c: Comandos) => {
      const n = kart.passos;
      // pegar da caixa
      if (meuItem === null) {
        for (const cx of caixas) {
          if (cx.ate <= n && Math.hypot(cx.x - kart.x, cx.y - kart.y) < 8) {
            cx.ate = n + 120;
            pegarItem(sortearItem(minhaPosicao, quantos));
            tocar('item');
            break;
          }
        }
      }
      // usar (na hora em que a tecla desce)
      const usa = c.usa === true;
      if (usa && !usavaAntes && meuItem !== null) {
        const id = `${o.eu}-${n}`;
        // sai na frente do kart, na faixa em que ele está
        const q = pontoNaLinha(p, p.la[kart.indice]);
        const lado = +(-(kart.x - q.x) * q.dy + (kart.y - q.y) * q.dx).toFixed(1);
        const s = +(p.la[kart.indice] + 16).toFixed(1);
        tocar(meuItem === 'cenoura' || meuItem === 'cenouras' ? 'turbo' : meuItem === 'alface' ? 'cura' : meuItem === 'toca' ? 'pulo' : 'empurrao');
        if (meuItem === 'cenoura' || meuItem === 'cenouras') kart.turbo = Math.max(kart.turbo, 1.1);
        else if (meuItem === 'repolho') lancar({ tipo: 'repolho', id, dono: o.eu, n, s, lado });
        else if (meuItem === 'repolho-roxo') lancar({ tipo: 'repolho-roxo', id, dono: o.eu, n, s, lado, alvo: aFrente });
        else if (meuItem === 'lama') {
          lancar({ tipo: 'lama', id, dono: o.eu, n, x: +(kart.x - Math.cos(kart.angulo) * 12).toFixed(1), y: +(kart.y - Math.sin(kart.angulo) * 12).toFixed(1) });
        } else {
          if (meuItem === 'alface') meuEscudo = { id, ate: n + VIDA_DA_ALFACE };
          else if (meuItem === 'toca') kart.toca = TEMPO_DA_TOCA;
          else andouDoDono.set(id, progresso(kart, p));
          lancar({ tipo: meuItem, id, dono: o.eu, n });
        }
        usos--;
        if (usos <= 0) pegarItem(null);
        else o.itens?.aoItem?.(meuItem, usos);
      }
      usavaAntes = usa;
      if (meuEscudo && n >= meuEscudo.ate) meuEscudo = null;
      // fui atingido? (quem decide é quem leva). O item que já acertou alguém sumiu para todos, e não acerta mais ninguém
      // (revisão de 03/11/2026: o repolho invisível seguia derrubando quem vinha atrás)
      const sumiram = new Set(o.itens!.eventos.filter((e) => e.tipo === 'acertou').map((e) => e.id));
      for (const e of o.itens!.eventos) {
        if (e.tipo === 'acertou' || e.tipo === 'gastou' || e.dono === o.eu) continue;
        // O REGADOR: chove em mim se eu estava na frente de quem o usou, no passo em que ele usou
        if (e.tipo === 'regador') {
          if (regadoresVistos.has(e.id) || n < e.n) continue;
          const dono = todosOsRivais?.get(e.dono);
          const pos = dono ? rivalEm(dono.posicoes, e.n) : null;
          if (!pos) continue;
          regadoresVistos.add(e.id);
          if (!andouDoDono.has(e.id)) andouDoDono.set(e.id, pos.andou);
          if (progresso(kart, p) > (andouDoDono.get(e.id) ?? pos.andou) && kart.toca === 0 && n - e.n < PASSOS_DA_CHUVA) {
            kart.chuva = TEMPO_DA_CHUVA;
            tocar('agua');
          }
          continue;
        }
        if (e.tipo === 'alface' || e.tipo === 'toca') continue;
        if (acertados.has(e.id) || sumiram.has(e.id) || kart.rodando > 0 || kart.toca > 0) continue;
        let pegou = false;
        if (e.tipo === 'repolho-roxo') {
          // o roxo só pega o alvo dele; sem alvo (quem soltou ia na frente), pega quem estiver no caminho
          if (e.alvo === o.eu) pegou = roxoAlcancou(p, e, n, p.la[kart.indice]);
          else if (e.alvo === null) {
            const r = roxoEm(p, e, n);
            pegou = !!r && Math.hypot(r.x - kart.x, r.y - kart.y) < 9;
          }
        } else {
          const alvo = e.tipo === 'repolho' ? repolhoEm(p, e, n) : e.tipo === 'lama' && n >= e.n && n - e.n < VIDA_DA_LAMA ? e : null;
          pegou = !!alvo && Math.hypot(alvo.x - kart.x, alvo.y - kart.y) < (e.tipo === 'repolho' ? 9 : 8);
        }
        if (!pegou) continue;
        acertados.add(e.id);
        lancar({ tipo: 'acertou', id: e.id });
        if (meuEscudo) {
          // a alface segura o item, e acaba
          lancar({ tipo: 'gastou', id: meuEscudo.id });
          meuEscudo = null;
          tremor = 4;
          tocar('quebra');
        } else {
          atingir(kart, e.tipo === 'lama' ? 0.7 : 1);
          tocar(e.tipo === 'lama' ? 'desliza' : 'dano');
        }
      }
    };

    /**
     * OS ITENS DOS ROBÔS (19/11/2026): cada um pega as caixas dele, sorteia pela posição como quem joga, e usa o item depois
     * de um tempo (o sorteio dele). Os itens dos robôs são eventos como os de qualquer um, e o que pega quem joga já é
     * conferido acima; aqui se confere o que pega cada robô (a mesma regra: quem leva decide).
     */
    const itensDosRobos = () => {
      const n = kart.passos;
      const eventos = o.itens!.eventos;
      const sumiram = o.robosNaSala ? sumiramParaOsRobos : new Set(eventos.filter((e) => e.tipo === 'acertou').map((e) => e.id));
      // na sala, a posição e o kart da frente só entre os robôs (o que todo computador sabe igual)
      const entreRobos = o.robosNaSala ? [...robos].sort((a, b) => progressoDoRobo(b, p) - progressoDoRobo(a, p)) : null;
      for (const r of robos) {
        const k = r.kart;
        if (k.terminou) continue;
        let mao = maoDoRobo.get(r.id);
        const minhas = caixasDoRobo.get(r.id)!;
        if (!mao) {
          for (let i = 0; i < caixas.length; i++) {
            if (minhas[i] <= n && Math.hypot(caixas[i].x - k.x, caixas[i].y - k.y) < 8) {
              minhas[i] = n + 120;
              const item = entreRobos ? sortearItem(entreRobos.indexOf(r), entreRobos.length, r.sorte) : sortearItem(posicaoDe.get(r.id) ?? 0, quantos, r.sorte);
              mao = { item, usos: item === 'cenouras' ? 3 : 1, usarEm: n + 30 + Math.floor(r.sorte() * 150) };
              maoDoRobo.set(r.id, mao);
              break;
            }
          }
        }
        if (mao && n >= mao.usarEm && k.rodando === 0) {
          const id = `${r.id}-${n}`;
          const q = pontoNaLinha(p, p.la[k.indice]);
          const lado = +(-(k.x - q.x) * q.dy + (k.y - q.y) * q.dx).toFixed(1);
          const s = +(p.la[k.indice] + 16).toFixed(1);
          const it = mao.item;
          const aFrenteDoRobo = entreRobos ? (entreRobos[entreRobos.indexOf(r) - 1]?.id ?? null) : (aFrenteDe.get(r.id) ?? null);
          if (it === 'cenoura' || it === 'cenouras') k.turbo = Math.max(k.turbo, 1.1);
          else if (it === 'repolho') lancarDoRobo({ tipo: 'repolho', id, dono: r.id, n, s, lado });
          else if (it === 'repolho-roxo') lancarDoRobo({ tipo: 'repolho-roxo', id, dono: r.id, n, s, lado, alvo: aFrenteDoRobo });
          else if (it === 'lama') lancarDoRobo({ tipo: 'lama', id, dono: r.id, n, x: +(k.x - Math.cos(k.angulo) * 12).toFixed(1), y: +(k.y - Math.sin(k.angulo) * 12).toFixed(1) });
          else {
            if (it === 'alface') escudoDoRobo.set(r.id, { id, ate: n + VIDA_DA_ALFACE });
            else if (it === 'toca') k.toca = TEMPO_DA_TOCA;
            else andouDoDono.set(id, progressoDoRobo(r, p));
            lancarDoRobo({ tipo: it, id, dono: r.id, n });
          }
          mao.usos--;
          if (mao.usos <= 0) maoDoRobo.delete(r.id);
          else mao.usarEm = n + 40;
        }
        const escudo = escudoDoRobo.get(r.id);
        if (escudo && n >= escudo.ate) escudoDoRobo.delete(r.id);
        // o robô foi atingido?
        for (const e of eventos) {
          if (e.tipo === 'acertou' || e.tipo === 'gastou' || e.dono === r.id) continue;
          // na sala, o robô só leva item de robô (o das pessoas chega a cada computador numa hora)
          if (o.robosNaSala && e.dono >= 0) continue;
          if (e.tipo === 'regador') {
            const chave = `${r.id}|${e.id}`;
            if (regadoresVistos.has(chave) || n < e.n) continue;
            regadoresVistos.add(chave);
            const dono = andouDoDono.get(e.id);
            if (dono !== undefined && progressoDoRobo(r, p) > dono && k.toca === 0 && n - e.n < PASSOS_DA_CHUVA) k.chuva = TEMPO_DA_CHUVA;
            continue;
          }
          if (e.tipo === 'alface' || e.tipo === 'toca') continue;
          if (sumiram.has(e.id) || k.rodando > 0 || k.toca > 0) continue;
          let pegou = false;
          if (e.tipo === 'repolho-roxo') {
            if (e.alvo === r.id) pegou = roxoAlcancou(p, e, n, p.la[k.indice]);
            else if (e.alvo === null) {
              const q = roxoEm(p, e, n);
              pegou = !!q && Math.hypot(q.x - k.x, q.y - k.y) < 9;
            }
          } else {
            const alvo = e.tipo === 'repolho' ? repolhoEm(p, e, n) : e.tipo === 'lama' && n >= e.n && n - e.n < VIDA_DA_LAMA ? e : null;
            pegou = !!alvo && Math.hypot(alvo.x - k.x, alvo.y - k.y) < (e.tipo === 'repolho' ? 9 : 8);
          }
          if (!pegou) continue;
          sumiram.add(e.id);
          lancarDoRobo({ tipo: 'acertou', id: e.id });
          if (escudo && escudoDoRobo.has(r.id)) {
            lancarDoRobo({ tipo: 'gastou', id: escudo.id });
            escudoDoRobo.delete(r.id);
          } else atingir(k, e.tipo === 'lama' ? 0.7 : 1);
        }
      }
    };

    const seguir = (alvo: number) => {
      let dif = alvo - camAngulo;
      while (dif > Math.PI) dif -= 2 * Math.PI;
      while (dif < -Math.PI) dif += 2 * Math.PI;
      camAngulo += dif * Math.min(1, 7 * PASSO);
    };

    /** Os rivais no passo `n`, com o nome. */
    const rivaisEm = (n: number) => {
      const lista: { id: number; nome: string; avatar: number | string | null; pos: PosicaoDoRival }[] = [];
      for (const [id, r] of todosOsRivais ?? []) {
        const pos = rivalEm(r.posicoes, n);
        if (pos) lista.push({ id, nome: r.nome, avatar: r.avatar ?? null, pos });
      }
      return lista;
    };

    const desenhar = () => {
      const n = o.piloto ? Math.max(0, kart.passos) : nAssistindo;
      const rivais = rivaisEm(n);
      // quem assiste vai atrás de quem está na frente
      let foco = { x: kart.x, y: kart.y };
      if (!o.piloto) {
        const lider = [...rivais].sort((a, b) => b.pos.andou - a.pos.andou)[0];
        if (lider) {
          foco = lider.pos;
          seguir(lider.pos.a);
        } else {
          foco = p.largada;
        }
      }
      // OLHAR PARA TRÁS (05/11/2026, pedido dele): segurando a tecla, a câmera vai à frente do kart e olha para trás. Só o
      // desenho: a física e o volante continuam os mesmos
      const olhando = o.piloto && comandos.olha === true && contagem === 0 && !kart.terminou;
      const cam = olhando ? cameraAtras(kart.x, kart.y, camAngulo + Math.PI) : cameraAtras(foco.x, foco.y, camAngulo);
      desenharChao(d, p, cam);
      // o que cada evento de item está fazendo agora (para o desenho dos karts)
      const eventos = o.itens?.eventos ?? [];
      const gastos = new Set(eventos.filter((e) => e.tipo === 'gastou').map((e) => e.id));
      const ativo = (dono: number, tipo: 'alface' | 'toca', vida: number) =>
        eventos.some((e) => e.tipo === tipo && e.dono === dono && n >= e.n && n - e.n < vida && !gastos.has(e.id));
      /** Quem está na chuva, pelo que eu vejo: na frente do dono do regador, nos 3 s depois dele. */
      const naChuva = (andou: number) =>
        eventos.some((e) => e.tipo === 'regador' && n >= e.n && n - e.n < PASSOS_DA_CHUVA && andou > (andouDoDono.get(e.id) ?? Infinity));
      /** Os enfeites de um kart: a toca no lugar dele, a alface em volta, a nuvem em cima. */
      const enfeites = (x: number, y: number, z: number, escudo: boolean, chuva: boolean) => {
        if (escudo) {
          const f = figuraNoChao(d, cam, 'escudo', x, y, 1.9);
          if (f) figuras.push({ ...f, z: z - 0.02 });
        }
        if (chuva) {
          const pr = projetar(cam, x, y);
          const nv = d.figuras.nuvem;
          if (pr) {
            const w = Math.round(nv.width * 1.6 * pr.escala), h = Math.round(nv.height * 1.6 * pr.escala);
            figuras.push({ z: z - 0.03, desenhar: (ctx) => ctx.drawImage(nv, Math.round(pr.sx - w / 2), Math.round(pr.sy - h - 62 * pr.escala), w, h) });
          }
        }
      };
      const figuras: Figura[] = [];
      for (const ob of p.objetos) {
        const f = figuraNoChao(d, cam, ob.tipo, ob.x, ob.y, ob.raio > 0 ? 2.6 : ob.tipo === 'cenoura' ? 1 : 0.8);
        if (f) figuras.push(f);
      }
      // AS PORTEIRAS (a Fazenda): os três mourões, e a folha fechada de lado a lado da metade dela. A folha que vai fechar
      // pisca meio transparente no último meio segundo antes, para dar tempo de trocar de lado.
      for (const por of p.porteiras ?? []) {
        const nx = -por.ty, ny = por.tx, hw = p.def.meiaLargura + 4;
        for (const lat of [-hw, 0, hw]) {
          const f = figuraNoChao(d, cam, 'mourao', por.x + nx * lat, por.y + ny * lat, 1.6);
          if (f) figuras.push(f);
        }
        const fechado = ladoFechado(por, n);
        for (const lado of [-1, 1] as const) {
          const falta = fechado === lado ? 0 : passosAteFechar(por, lado, n);
          if (falta > 30 || (falta > 0 && Math.floor(falta / 5) % 2 === 1)) continue;
          for (let lat = 5; lat < hw - 2; lat += 7) {
            const f = figuraNoChao(d, cam, 'porteira', por.x + nx * lat * lado, por.y + ny * lat * lado, 1.4);
            if (!f) continue;
            figuras.push(falta > 0 ? { z: f.z, desenhar: (ctx) => { ctx.globalAlpha = 0.45; f.desenhar(ctx); ctx.globalAlpha = 1; } } : f);
          }
        }
      }
      // as caixas pulsam devagar; a que eu peguei some até voltar
      for (const cx of caixas) {
        if (o.piloto && cx.ate > n) continue;
        // a caixa em fatias, virada com a fileira (caixaEmFatias.ts); pulsa devagar
        const f = caixaNoChao(d, cam, cx.x, cx.y, 1.1, cx.giro, 1 + 0.04 * Math.sin(performance.now() / 260));
        if (f) figuras.push(f);
      }
      if (o.itens) {
        const sumiram = new Set(eventos.filter((e) => e.tipo === 'acertou').map((e) => e.id));
        for (const e of eventos) {
          if (e.tipo !== 'repolho' && e.tipo !== 'repolho-roxo' && e.tipo !== 'lama') continue;
          if (sumiram.has(e.id)) continue;
          const pos = e.tipo === 'repolho' ? repolhoEm(p, e, n) : e.tipo === 'repolho-roxo' ? roxoEm(p, e, n) : n >= e.n && n - e.n < VIDA_DA_LAMA ? e : null;
          if (!pos) continue;
          const f = figuraNoChao(d, cam, e.tipo, pos.x, pos.y, e.tipo === 'lama' ? 1.4 : 1.2);
          if (f) figuras.push(f);
        }
      }
      for (const fa of o.fantasmas ?? []) {
        const g = fantasmaEm(fa.amostras, n);
        if (!g) continue;
        const f = kartNaTela(d, cam, g.x, g.y, g.angulo, 0, { fantasma: true, avatar: fa.avatar });
        if (f) figuras.push(f);
      }
      for (const r of rivais) {
        // na toca, o kart some e fica o monte de terra andando, com as orelhas de fora
        const f = ativo(r.id, 'toca', PASSOS_DA_TOCA)
          ? figuraNoChao(d, cam, 'toca', r.pos.x, r.pos.y, 1.5)
          : kartNaTela(d, cam, r.pos.x, r.pos.y, r.pos.a, 0, { nome: r.nome, avatar: r.avatar });
        if (!f) continue;
        figuras.push(f);
        enfeites(r.pos.x, r.pos.y, f.z, ativo(r.id, 'alface', VIDA_DA_ALFACE), naChuva(r.pos.andou));
      }
      if (o.piloto) {
        const meu = kart.toca > 0
          ? figuraNoChao(d, cam, 'toca', kart.x, kart.y, 1.5)
          : kartNaTela(d, cam, kart.x, kart.y, kart.angulo, kart.pulo, { tremor: tremor > 0 ? (tremor % 2 ? 1 : -1) : 0, avatar: o.meuAvatar ?? null });
        if (meu) {
          figuras.push({ ...meu, z: meu.z - 0.01 });
          // a minha chuva é a da tela inteira (a nuvem em cima do meu kart parecia boiar na pista)
          enfeites(kart.x, kart.y, meu.z - 0.01, meuEscudo !== null, false);
        }
      }
      figuras.sort((a, b) => b.z - a.z);
      for (const f of figuras) f.desenhar(d.ctx);
      // o painel (faíscas, chuva, item, mapa, semáforo, pausa) na medida de 320 × 180, ampliado (render.ts, ESCALA_DA_TELA)
      d.ctx.save();
      d.ctx.scale(ESCALA_DA_TELA, ESCALA_DA_TELA);
      if (o.piloto && !olhando && kart.toca === 0 && (kart.deriva !== 0 || kart.turbo > 0)) {
        faiscas(d.ctx, W / 2, 168, kart.turbo > 0 ? 2 : nivelDaCarga(kart), performance.now() / 1000, kart.deriva);
      }
      // a chuva na tela de quem está debaixo dela
      if (o.piloto && kart.chuva > 0) chuvaNaTela(d.ctx, performance.now() / 1000);
      // olhando para trás: a moldura do retrovisor, para não confundir com a corrida andando ao contrário
      if (olhando) retrovisor(d.ctx);
      // o item na mão: um quadro no alto, no meio (como nos jogos da época)
      if (o.itens && o.piloto && contagem === 0 && !kart.terminou) quadroDoItem(d, meuItem, usos);
      // o mapa pequeno no canto: os fantasmas em cinza, os rivais em azul, a pessoa em laranja
      d.ctx.globalAlpha = 0.85;
      d.ctx.drawImage(mapa, W - 60, H - 60);
      d.ctx.globalAlpha = 1;
      for (const fa of o.fantasmas ?? []) {
        const g = fantasmaEm(fa.amostras, n);
        if (g) pontoNoMapa(d.ctx, W - 60, H - 60, 56, g.x, g.y, '#c8c0cc');
      }
      for (const r of rivais) pontoNoMapa(d.ctx, W - 60, H - 60, 56, r.pos.x, r.pos.y, '#7ab8ff');
      if (o.piloto) pontoNoMapa(d.ctx, W - 60, H - 60, 56, kart.x, kart.y, '#ffa24a');
      if (contagem > 0 || (o.piloto && kart.passos < 40)) semaforo(d.ctx, contagem);
      if (pausado && o.piloto) {
        d.ctx.fillStyle = '#140e188c';
        d.ctx.fillRect(0, 0, W, H);
        d.ctx.fillStyle = '#f4ead8';
        d.ctx.fillRect(W / 2 - 12, H / 2 - 14, 8, 28);
        d.ctx.fillRect(W / 2 + 4, H / 2 - 14, 8, 28);
      }
      d.ctx.restore();

      // a ordem de quem está na frente: eu pelo meu progresso, os rivais pelo deles no mesmo passo
      if (todosOsRivais) {
        const linhas = rivais.map((r) => ({ id: r.id, nome: r.nome, eu: false, andou: r.pos.andou }));
        // contra os robôs, quem chegou fica na ordem de chegada (o robô que chegou antes de mim, na frente)
        const minhaChegada = kart.terminou ? (robos.length ? p.def.voltas + 0.5 - kart.voltas[kart.voltas.length - 1] / 1e6 : p.def.voltas) : 0;
        if (o.piloto) linhas.push({ id: o.eu, nome: '', eu: true, andou: kart.terminou ? minhaChegada : progresso(kart, p) });
        // quem ainda não mandou posição nenhuma fica no fim, na ordem de chegada da lista
        for (const [id, r] of todosOsRivais) if (!linhas.some((l) => l.id === id)) linhas.push({ id, nome: r.nome, eu: false, andou: -1 });
        linhas.sort((a, b) => b.andou - a.andou);
        minhaPosicao = Math.max(0, linhas.findIndex((l) => l.eu));
        quantos = linhas.length;
        aFrente = minhaPosicao > 0 ? linhas[minhaPosicao - 1].id : null;
        linhas.forEach((l, i) => {
          posicaoDe.set(l.id, i);
          aFrenteDe.set(l.id, i > 0 ? linhas[i - 1].id : null);
        });
        const chave = linhas.map((l) => l.id).join(',');
        if (chave !== ordemAntes && o.aoOrdem) {
          ordemAntes = chave;
          o.aoOrdem(linhas.map(({ id, nome, eu }) => ({ id, nome, eu })));
        }
      }
    };

    const ciclo = (agora: number) => {
      if (!vivo) return;
      comandosComControle(doTeclado, comandos);
      const dt = Math.min(0.1, (agora - antes) / 1000);
      antes = agora;
      pausado = document.hidden || !document.hasFocus() || !!o.pausa?.ativa;
      if (!pausado || !o.piloto) {
        acumulado += dt;
        while (acumulado >= PASSO) {
          andar();
          if (!o.piloto && contagem === 0) nAssistindo++;
          acumulado -= PASSO;
          if (tremor > 0) tremor--;
        }
      }
      // quem assiste não pode ver o futuro: o passo mostrado não passa do último que chegou de alguém
      if (!o.piloto && todosOsRivais) {
        const ultimo = Math.max(0, ...[...todosOsRivais.values()].map((r) => r.posicoes.at(-1)?.n ?? 0));
        // e quem abriu no meio da corrida não começa do começo: vai para perto do agora
        nAssistindo = Math.min(Math.max(nAssistindo, ultimo - 12), ultimo);
      }
      if (!document.hidden) desenhar();
      const volta = Math.min(p.def.voltas, kart.volta + 1);
      const ms = passosEmMs(kart.terminou ? kart.voltas[kart.voltas.length - 1] : kart.passos);
      // o motor: no semáforo, um ronco baixo que sobe com o acelerador; depois, pela velocidade; parado e pausado, mudo
      if (motor) {
        const ronco = pausado ? 0 : contagem > 0 ? (comandos.acelera ? 0.35 : 0.06) : Math.abs(kart.v) / VTURBO;
        motor.ajustar(kart.terminou && Math.abs(kart.v) < 10 ? 0 : ronco);
      }
      o.aoPlacar({ volta, ms, pausado: pausado && o.piloto });
      if (kart.terminou && !fimEm) fimEm = agora;
      if (fimEm && agora - fimEm > 1600 && !avisouChegada) {
        avisouChegada = true;
        if (classificacao) o.aoClassificacao?.(classificacao);
        o.aoChegar?.(kart.voltas.slice(), caminho);
      }
      quadro = requestAnimationFrame(ciclo);
    };
    quadro = requestAnimationFrame(ciclo);
  })();

  return () => {
    vivo = false;
    cancelAnimationFrame(quadro);
    motor?.parar();
    motor = null;
  };
}

/** O quadro do item, no alto e no meio: vazio, ou com a figura do item (as cenouras, uma por uso que falta). */
function quadroDoItem(d: Desenho, item: Item | null, usos: number) {
  const ctx = d.ctx;
  const x = W / 2 - 13, y = 6;
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(x - 1, y - 1, 28, 24);
  ctx.fillStyle = '#3a3040';
  ctx.fillRect(x, y, 26, 22);
  ctx.fillStyle = '#fbf3e4';
  ctx.fillRect(x + 1, y + 1, 24, 1);
  if (!item) return;
  const desenhar = (nome: string, escala: number, cx: number, cy: number) => {
    const fig = d.figuras[nome];
    const w = Math.round(fig.width * escala), h = Math.round(fig.height * escala);
    ctx.drawImage(fig, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  };
  if (item === 'cenouras') {
    for (let i = 0; i < usos; i++) desenhar('cenoura', 1, x + 6 + i * 7, y + 11 + (i % 2 ? 2 : -2));
    return;
  }
  const figura = item === 'alface' ? 'escudo' : item === 'regador' ? 'regador' : item;
  desenhar(figura, item === 'lama' ? 1.2 : item === 'alface' || item === 'toca' ? 0.9 : 1.6, x + 13, y + 11);
}

/** As gotas da chuva do regador, caindo na tela inteira de quem está debaixo dela. */
function chuvaNaTela(ctx: CanvasRenderingContext2D, tempo: number) {
  ctx.fillStyle = '#9cc8f0';
  for (let i = 0; i < 70; i++) {
    const x = (i * 47 + Math.floor(tempo * 40) * (i % 3)) % W;
    const y = (i * 29 + tempo * 260) % H;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 4);
  }
  ctx.fillStyle = '#4a6a9022';
  ctx.fillRect(0, 0, W, H);
}

/** A moldura do retrovisor: olhando para trás, a tela ganha a borda e o espelhinho no alto. */
function retrovisor(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(0, 0, W, 3);
  ctx.fillRect(0, H - 3, W, 3);
  ctx.fillRect(0, 0, 3, H);
  ctx.fillRect(W - 3, 0, 3, H);
  ctx.fillStyle = '#c8c0cc';
  ctx.fillRect(3, 3, W - 6, 1);
  // o espelhinho: um retângulo arredondado com a seta para trás
  const x = 8, y = 8;
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(x, y, 22, 12);
  ctx.fillStyle = '#9cc8f0';
  ctx.fillRect(x + 1, y + 1, 20, 10);
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(x + 6, y + 5, 10, 2);
  ctx.fillRect(x + 6, y + 3, 2, 6);
  ctx.fillRect(x + 4, y + 4, 2, 4);
}

/** O semáforo da largada: três luzes vermelhas que acendem uma a uma, e as três verdes na hora de sair. */
function semaforo(ctx: CanvasRenderingContext2D, contagem: number) {
  const acesas = contagem > 0 ? Math.min(3, Math.max(0, 3 - Math.floor((contagem - 1) / 60))) : 3;
  const verde = contagem === 0;
  const x0 = W / 2 - 27, y0 = 14;
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(x0 - 4, y0 - 4, 62, 22);
  ctx.fillStyle = '#3a3040';
  ctx.fillRect(x0 - 3, y0 - 3, 60, 20);
  for (let i = 0; i < 3; i++) {
    const cx = x0 + 7 + i * 20;
    ctx.fillStyle = verde ? '#7ed060' : i < acesas ? '#e85a4a' : '#5a2a2a';
    ctx.fillRect(cx - 6, y0 + 1, 12, 12);
    ctx.fillStyle = verde ? '#c8f4a8' : i < acesas ? '#ffb0a0' : '#6a3434';
    ctx.fillRect(cx - 4, y0 + 3, 4, 4);
  }
}
