import {
  AMOSTRA,
  amostrar,
  atingir,
  fantasmaEm,
  nivelDaCarga,
  novoKart,
  PASSO,
  passo,
  passosEmMs,
  pilotoAutomatico,
  progresso,
  type Comandos,
  type Kart,
} from './fisica';
import { HORTA, montarPista, type DefinicaoDaPista, type Pista } from './pista';
import {
  cameraAtras,
  desenharChao,
  faiscas,
  figuraNoChao,
  H,
  kartNaTela,
  mapaDaPista,
  pontoNoMapa,
  prepararDesenho,
  W,
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

const pistas = new Map<string, Pista>();
let coelhoPronto: HTMLImageElement | null = null;

/** A pista, montada uma vez por página (são uns 300 ms de conta, e 20 MB que não mudam). */
export function pistaDaCorrida(def: DefinicaoDaPista = HORTA): Pista {
  let p = pistas.get(def.id);
  if (!p) {
    p = montarPista(def);
    pistas.set(def.id, p);
  }
  return p;
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
  /** Em ordem de passo; o laço lê, quem recebe do socket acrescenta. */
  posicoes: PosicaoDoRival[];
}

export interface LinhaDaOrdem {
  id: number;
  nome: string;
  eu: boolean;
}

export type Item = 'cenoura' | 'repolho' | 'lama';

/** O que um item fez, no passo `n` da corrida de quem o usou. O servidor carimba o `dono`. */
export type EventoDeItem =
  | { tipo: 'repolho'; id: string; dono: number; n: number; s: number; lado: number }
  | { tipo: 'lama'; id: string; dono: number; n: number; x: number; y: number }
  | { tipo: 'acertou'; id: string };

export interface Itens {
  /** Todos os eventos da corrida, os meus e os que chegaram: o laço lê, quem recebe do socket acrescenta. */
  eventos: EventoDeItem[];
  /** Um evento meu, para mandar aos outros (o laço já o pôs em `eventos`). */
  aoEvento: (e: Exclude<EventoDeItem, { tipo: 'acertou' }> | { tipo: 'acertou'; id: string }) => void;
  /** O item na mão mudou (para o botão de toque). */
  aoItem?: (item: Item | null) => void;
}

export interface OpcoesDoLaco {
  canvas: HTMLCanvasElement;
  /** O que o teclado e o toque estão apertando (quem chama escreve aqui). */
  comandos: Comandos;
  pista: DefinicaoDaPista;
  /** Sem kart (quem assiste): a câmera vai atrás de quem está na frente. */
  piloto: boolean;
  eu: number;
  /** Os fantasmas (amostras do servidor) do contra o relógio. */
  fantasmas?: number[][];
  /** Os rivais da sala, por id. */
  rivais?: Map<number, Rival>;
  /** Os itens (só na sala). */
  itens?: Itens;
  /** Passos de semáforo antes do verde (3 s = 180). */
  contagem: number;
  aoPlacar: (p: { volta: number; ms: number; pausado: boolean }) => void;
  /** A ordem de quem está na frente (só com rivais): muda pouco, e só é avisada quando muda. */
  aoOrdem?: (ordem: LinhaDaOrdem[]) => void;
  /** A cada AMOSTRA passos, onde o kart está (para mandar aos rivais). */
  aoPosicao?: (p: PosicaoDoRival) => void;
  /** 1,6 s depois da linha de chegada: as voltas (em passos) e o caminho inteiro. */
  aoChegar?: (voltas: number[], caminho: number[]) => void;
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

/** O item que sai da caixa, pela posição (0 = na frente) entre `total`. */
export function sortearItem(posicao: number, total: number, sorte = Math.random): Item {
  const atras = total > 1 ? posicao / (total - 1) : 0.5;
  // na frente: 10% cenoura, 30% repolho, 60% lama; atrás: 50% cenoura, 40% repolho, 10% lama
  const cenoura = 0.1 + 0.4 * atras, repolho = 0.3 + 0.1 * atras;
  const r = sorte();
  return r < cenoura ? 'cenoura' : r < cenoura + repolho ? 'repolho' : 'lama';
}

export function rodarCorrida(o: OpcoesDoLaco): () => void {
  const { comandos } = o;
  let vivo = true;
  let quadro = 0;
  const d: Desenho = prepararDesenho(o.canvas, o.pista.tema);

  void (async () => {
    d.coelho = await coelho();
    if (!vivo) return;
    const p = pistaDaCorrida(o.pista);
    const mapa = mapaDaPista(p, 56);
    const kart: Kart = novoKart(p);
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
          return [-18, -6, 6, 18].map((lado) => ({ x: q.x - q.dy * lado, y: q.y + q.dx * lado, ate: 0 }));
        })
      : [];
    let meuItem: Item | null = null;
    let usavaAntes = false;
    const acertados = new Set<string>();
    const pegarItem = (item: Item | null) => {
      meuItem = item;
      o.itens?.aoItem?.(item);
    };
    const lancar = (e: EventoDeItem) => {
      o.itens!.eventos.push(e);
      o.itens!.aoEvento(e);
    };

    const andar = () => {
      if (contagem > 0) {
        contagem--;
        return;
      }
      if (!o.piloto) return;
      const jaTinhaChegado = kart.terminou;
      const auto = import.meta.env.DEV && (window as { corridaPilotoAutomatico?: boolean }).corridaPilotoAutomatico;
      const c = auto ? { ...pilotoAutomatico(kart, p, true), usa: meuItem !== null } : comandos;
      passo(kart, c, p);
      if (!jaTinhaChegado) {
        amostrar(kart, caminho);
        if ((kart.passos - 1) % AMOSTRA === 0) {
          o.aoPosicao?.({ n: kart.passos, x: +kart.x.toFixed(1), y: +kart.y.toFixed(1), a: +kart.angulo.toFixed(3), andou: +progresso(kart, p).toFixed(3) });
        }
      }
      if (o.itens && !kart.terminou) usarItens(c);
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
            break;
          }
        }
      }
      // usar (na hora em que a tecla desce)
      const usa = c.usa === true;
      if (usa && !usavaAntes && meuItem !== null) {
        const id = `${o.eu}-${n}`;
        if (meuItem === 'cenoura') kart.turbo = Math.max(kart.turbo, 1.1);
        else if (meuItem === 'repolho') {
          // sai na frente do kart, na faixa em que ele está
          const q = pontoNaLinha(p, p.la[kart.indice]);
          const lado = -(kart.x - q.x) * q.dy + (kart.y - q.y) * q.dx;
          lancar({ tipo: 'repolho', id, dono: o.eu, n, s: +(p.la[kart.indice] + 16).toFixed(1), lado: +lado.toFixed(1) });
        } else {
          lancar({ tipo: 'lama', id, dono: o.eu, n, x: +(kart.x - Math.cos(kart.angulo) * 12).toFixed(1), y: +(kart.y - Math.sin(kart.angulo) * 12).toFixed(1) });
        }
        pegarItem(null);
      }
      usavaAntes = usa;
      // fui atingido? (quem decide é quem leva)
      for (const e of o.itens!.eventos) {
        if (e.tipo === 'acertou' || acertados.has(e.id) || e.dono === o.eu || kart.rodando > 0) continue;
        const alvo = e.tipo === 'repolho' ? repolhoEm(p, e, n) : n >= e.n && n - e.n < VIDA_DA_LAMA ? e : null;
        if (alvo && Math.hypot(alvo.x - kart.x, alvo.y - kart.y) < (e.tipo === 'repolho' ? 9 : 8)) {
          atingir(kart, e.tipo === 'lama' ? 0.7 : 1);
          acertados.add(e.id);
          lancar({ tipo: 'acertou', id: e.id });
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
      const lista: { id: number; nome: string; pos: PosicaoDoRival }[] = [];
      for (const [id, r] of o.rivais ?? []) {
        const pos = rivalEm(r.posicoes, n);
        if (pos) lista.push({ id, nome: r.nome, pos });
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
      const cam = cameraAtras(foco.x, foco.y, camAngulo);
      desenharChao(d, p, cam);
      const figuras: Figura[] = [];
      for (const ob of p.objetos) {
        const f = figuraNoChao(d, cam, ob.tipo, ob.x, ob.y, ob.raio > 0 ? 2.6 : ob.tipo === 'cenoura' ? 1 : 0.8);
        if (f) figuras.push(f);
      }
      // as caixas pulsam devagar; a que eu peguei some até voltar
      for (const cx of caixas) {
        if (o.piloto && cx.ate > n) continue;
        const f = figuraNoChao(d, cam, 'caixa', cx.x, cx.y, 1.1 + 0.06 * Math.sin(performance.now() / 260));
        if (f) figuras.push(f);
      }
      if (o.itens) {
        const sumiram = new Set(o.itens.eventos.filter((e) => e.tipo === 'acertou').map((e) => e.id));
        for (const e of o.itens.eventos) {
          if (e.tipo === 'acertou' || sumiram.has(e.id)) continue;
          const pos = e.tipo === 'repolho' ? repolhoEm(p, e, n) : n >= e.n && n - e.n < VIDA_DA_LAMA ? e : null;
          if (!pos) continue;
          const f = figuraNoChao(d, cam, e.tipo, pos.x, pos.y, e.tipo === 'repolho' ? 1.2 : 1.4);
          if (f) figuras.push(f);
        }
      }
      for (const amostras of o.fantasmas ?? []) {
        const g = fantasmaEm(amostras, n);
        if (!g) continue;
        const f = kartNaTela(d, cam, g.x, g.y, g.angulo, 0, { fantasma: true });
        if (f) figuras.push(f);
      }
      for (const r of rivais) {
        const f = kartNaTela(d, cam, r.pos.x, r.pos.y, r.pos.a, 0, { nome: r.nome });
        if (f) figuras.push(f);
      }
      if (o.piloto) {
        const meu = kartNaTela(d, cam, kart.x, kart.y, kart.angulo, kart.pulo, { tremor: tremor > 0 ? (tremor % 2 ? 1 : -1) : 0 });
        if (meu) figuras.push({ ...meu, z: meu.z - 0.01 });
      }
      figuras.sort((a, b) => b.z - a.z);
      for (const f of figuras) f.desenhar(d.ctx);
      if (o.piloto && (kart.deriva !== 0 || kart.turbo > 0)) {
        faiscas(d.ctx, W / 2, 168, kart.turbo > 0 ? 2 : nivelDaCarga(kart), performance.now() / 1000, kart.deriva);
      }
      // o item na mão: um quadro no alto, no meio (como nos jogos da época)
      if (o.itens && o.piloto && contagem === 0 && !kart.terminou) quadroDoItem(d, meuItem);
      // o mapa pequeno no canto: os fantasmas em cinza, os rivais em azul, a pessoa em laranja
      d.ctx.globalAlpha = 0.85;
      d.ctx.drawImage(mapa, W - 60, H - 60);
      d.ctx.globalAlpha = 1;
      for (const amostras of o.fantasmas ?? []) {
        const g = fantasmaEm(amostras, n);
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

      // a ordem de quem está na frente: eu pelo meu progresso, os rivais pelo deles no mesmo passo
      if (o.rivais) {
        const linhas = rivais.map((r) => ({ id: r.id, nome: r.nome, eu: false, andou: r.pos.andou }));
        if (o.piloto) linhas.push({ id: o.eu, nome: '', eu: true, andou: kart.terminou ? p.def.voltas : progresso(kart, p) });
        // quem ainda não mandou posição nenhuma fica no fim, na ordem de chegada da lista
        for (const [id, r] of o.rivais) if (!linhas.some((l) => l.id === id)) linhas.push({ id, nome: r.nome, eu: false, andou: -1 });
        linhas.sort((a, b) => b.andou - a.andou);
        minhaPosicao = Math.max(0, linhas.findIndex((l) => l.eu));
        quantos = linhas.length;
        const chave = linhas.map((l) => l.id).join(',');
        if (chave !== ordemAntes && o.aoOrdem) {
          ordemAntes = chave;
          o.aoOrdem(linhas.map(({ id, nome, eu }) => ({ id, nome, eu })));
        }
      }
    };

    const ciclo = (agora: number) => {
      if (!vivo) return;
      const dt = Math.min(0.1, (agora - antes) / 1000);
      antes = agora;
      pausado = document.hidden || !document.hasFocus();
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
      if (!o.piloto && o.rivais) {
        const ultimo = Math.max(0, ...[...o.rivais.values()].map((r) => r.posicoes.at(-1)?.n ?? 0));
        // e quem abriu no meio da corrida não começa do começo: vai para perto do agora
        nAssistindo = Math.min(Math.max(nAssistindo, ultimo - 12), ultimo);
      }
      if (!document.hidden) desenhar();
      const volta = Math.min(p.def.voltas, kart.volta + 1);
      const ms = passosEmMs(kart.terminou ? kart.voltas[kart.voltas.length - 1] : kart.passos);
      o.aoPlacar({ volta, ms, pausado: pausado && o.piloto });
      if (kart.terminou && !fimEm) fimEm = agora;
      if (fimEm && agora - fimEm > 1600 && !avisouChegada) {
        avisouChegada = true;
        o.aoChegar?.(kart.voltas.slice(), caminho);
      }
      quadro = requestAnimationFrame(ciclo);
    };
    quadro = requestAnimationFrame(ciclo);
  })();

  return () => {
    vivo = false;
    cancelAnimationFrame(quadro);
  };
}

/** O quadro do item, no alto e no meio: vazio, ou com a figura do item. */
function quadroDoItem(d: Desenho, item: Item | null) {
  const ctx = d.ctx;
  const x = W / 2 - 13, y = 6;
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(x - 1, y - 1, 28, 24);
  ctx.fillStyle = '#3a3040';
  ctx.fillRect(x, y, 26, 22);
  ctx.fillStyle = '#fbf3e4';
  ctx.fillRect(x + 1, y + 1, 24, 1);
  if (!item) return;
  const fig = d.figuras[item];
  const escala = item === 'lama' ? 1.2 : 1.6;
  const w = Math.round(fig.width * escala), h = Math.round(fig.height * escala);
  ctx.drawImage(fig, Math.round(x + 13 - w / 2), Math.round(y + 11 - h / 2), w, h);
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
