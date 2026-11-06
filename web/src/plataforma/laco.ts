import { tocar } from '../somDosJogos';
import { ALTURA, T, type Fase } from './fases';
import { barraDoCaminho, H, pintar, prepararPintura, semaforo, W, type Figura } from './desenho';
import { AMOSTRA, amostrar, fantasmaEm, novoCoelho, PASSO, passo, progresso, type Coelho, type Comandos } from './fisica';
import { planejar } from './piloto';

/**
 * O LAÇO DO PULO DO COELHO (03/11/2026), como o da corrida de kart (corrida/laco.ts): a física em passos fixos, a câmera e
 * o desenho. Quem chama diz o que muda: a fase, os fantasmas (contra o relógio), os RIVAIS ao vivo (na sala, chegam pelo
 * socket), a contagem da largada e o que fazer na chegada. Com a janela sem foco, o coelho PARA (a física e o relógio
 * também): o tempo de cada um é contado nos passos dele.
 */

let folha: HTMLImageElement | null = null;

async function coelho(): Promise<HTMLImageElement> {
  if (!folha) {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}plataforma/coelho.png`;
    await img.decode().catch(() => undefined);
    folha = img;
  }
  return folha;
}

/** Uma posição de um rival, como chegou pelo socket: o passo da corrida DELE em que ele estava ali. */
export interface PosicaoDoRival {
  n: number;
  x: number;
  y: number;
  j: number;
  andou: number;
}

export interface Rival {
  nome: string;
  posicoes: PosicaoDoRival[];
}

/**
 * Guarda a posição que chegou de um rival. A de passo menor que a última fica de fora (chegou velha), MENOS quando o passo
 * volta muito: é a corrida nova dele (revisão independente, 03/11/2026: a página recarregada recomeçava do passo 0, e esta
 * tela descartava tudo dali em diante, com o coelho dele congelado). Aí a lista recomeça. A mesma medida do servidor
 * (RECOMECO_PASSOS, em server/src/minijogo-plataforma.ts).
 */
export function guardarPosicaoDoRival(r: Rival, p: PosicaoDoRival) {
  const ultima = r.posicoes.at(-1);
  if (ultima && p.n < ultima.n - 60) r.posicoes = [];
  else if (ultima && ultima.n >= p.n) return;
  r.posicoes.push(p);
  if (r.posicoes.length > 2000) r.posicoes.splice(0, 1000);
}

/** Onde um rival estava no passo `n`, entre duas posições; depois da última, a última (sem adivinhar o pulo dele). */
export function rivalEm(posicoes: PosicaoDoRival[], n: number): PosicaoDoRival | null {
  if (posicoes.length === 0) return null;
  let i = posicoes.length - 1;
  while (i > 0 && posicoes[i].n > n) i--;
  const a = posicoes[i];
  const b = posicoes[i + 1];
  if (!b || b.n <= a.n || Math.abs(b.x - a.x) > 40) return a;
  const t = Math.max(0, Math.min(1, (n - a.n) / (b.n - a.n)));
  return { n, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, j: a.j, andou: a.andou + (b.andou - a.andou) * t };
}

export interface LinhaDaOrdem {
  id: number;
  nome: string;
  eu: boolean;
}

export interface OpcoesDoLaco {
  canvas: HTMLCanvasElement;
  comandos: Comandos;
  fase: Fase;
  /** Sem coelho (quem assiste): a câmera vai atrás de quem está na frente. */
  piloto: boolean;
  eu: number;
  fantasmas?: { amostras: number[] }[];
  rivais?: Map<number, Rival>;
  /** Passos de semáforo antes do verde (3 s = 180). */
  contagem: number;
  /** A pausa do ESC (pausaDosJogos.tsx), só no Solo: lida a cada quadro, como a janela sem foco. */
  pausa?: { readonly ativa: boolean };
  aoPlacar: (p: { ms: number; pausado: boolean; quedas: number }) => void;
  aoOrdem?: (ordem: LinhaDaOrdem[]) => void;
  /** A cada AMOSTRA passos, onde o coelho está (para mandar aos rivais). */
  aoPosicao?: (p: PosicaoDoRival) => void;
  /** Um pouco depois de cruzar a chegada: os passos e o caminho inteiro. */
  aoChegar?: (passos: number, caminho: number[]) => void;
  /**
   * QUEM JÁ CHEGOU ASSISTE A QUEM AINDA CORRE (pedido dele, 05/11/2026: "quando o jogador terminar, seria legal ele ver a tela do
   * amigo"): a câmera vai para o coelho de `seguir.id` (ou, sem escolha, para quem está mais adiante entre os que correm), e
   * `aoAssistir` diz quem é e quem mais ainda corre (para trocar). Quando ninguém mais corre, volta para o próprio coelho.
   */
  seguir?: { id: number | null };
  aoAssistir?: (alvo: { id: number; nome: string } | null, correndo: { id: number; nome: string }[]) => void;
}

export function rodarFase(o: OpcoesDoLaco): () => void {
  let vivo = true;
  let quadro = 0;
  const p = prepararPintura(o.canvas, o.fase);
  const f = o.fase;

  void (async () => {
    p.coelho = await coelho();
    if (!vivo) return;
    const k: Coelho = novoCoelho(f);
    const caminho: number[] = [];
    let camX = Math.max(0, k.x - 120), camY = ALTURA - H;
    let contagem = o.contagem;
    let acumulado = 0;
    let antes = performance.now();
    let fimEm = 0;
    let avisou = false;
    let pausado = false;
    let ordemAntes = '';
    let nAssistindo = 0;
    let assistindoAntes = '';
    // o piloto automático (só no site de desenvolvimento, para o e2e): planeja a fase inteira uma vez
    let plano: Comandos[] | null = null;

    const andar = () => {
      if (contagem > 0) {
        contagem--;
        return;
      }
      if (!o.piloto) return;
      const auto = import.meta.env.DEV && (window as { plataformaPilotoAutomatico?: boolean }).plataformaPilotoAutomatico;
      if (auto && !plano) plano = planejar(f, k) ?? [];
      const c = auto && plano ? (plano.shift() ?? { esquerda: false, direita: true, pula: false }) : o.comandos;
      const jaTinha = k.terminou;
      const noChaoAntes = k.noChao;
      const quedasAntes = k.quedas;
      passo(k, c, f);
      if (k.molou) tocar('mola');
      else if (noChaoAntes && !k.noChao && k.vy < 0) tocar('pulo');
      if (k.quedas > quedasAntes) tocar('queda');
      if (k.terminou && !jaTinha) tocar('chegada');
      if (!jaTinha) {
        amostrar(k, caminho);
        if ((k.passos - 1) % AMOSTRA === 0) {
          o.aoPosicao?.({ n: k.passos, x: +k.x.toFixed(1), y: +k.y.toFixed(1), j: k.lado * (k.noChao || k.espera > 0 ? 1 : 2), andou: +progresso(k, f).toFixed(3) });
        }
      }
    };

    const rivaisEm = (n: number) => {
      const lista: { id: number; nome: string; pos: PosicaoDoRival }[] = [];
      for (const [id, r] of o.rivais ?? []) {
        const pos = rivalEm(r.posicoes, n);
        if (pos) lista.push({ id, nome: r.nome, pos });
      }
      return lista;
    };

    const desenhar = () => {
      const n = o.piloto ? k.passos : nAssistindo;
      const rivais = rivaisEm(n);
      let foco = { x: k.x, y: k.y };
      if (!o.piloto) {
        const lider = [...rivais].sort((a, b) => b.pos.andou - a.pos.andou)[0];
        foco = lider ? lider.pos : f.largada;
      }
      if (o.piloto && k.terminou && o.rivais && o.aoAssistir) {
        const correndo = rivais.filter((r) => r.pos.andou < 0.999).sort((a, b) => b.pos.andou - a.pos.andou);
        const alvo = correndo.find((r) => r.id === o.seguir?.id) ?? correndo[0];
        if (alvo) foco = alvo.pos;
        if (o.seguir) o.seguir.id = alvo?.id ?? null;
        const chave = (alvo?.id ?? '') + '|' + correndo.map((r) => r.id).join(',');
        if (chave !== assistindoAntes) {
          assistindoAntes = chave;
          o.aoAssistir(alvo ? { id: alvo.id, nome: alvo.nome } : null, correndo.map((r) => ({ id: r.id, nome: r.nome })));
        }
      }
      // a câmera: o coelho um pouco à esquerda do meio (vê-se o que vem), e no alto só o que a fase tem
      const alvoX = Math.max(0, Math.min(f.colunas * T - W, foco.x - 130));
      const alvoY = Math.max(0, Math.min(ALTURA - H, foco.y - 112));
      camX += (alvoX - camX) * 0.2;
      camY += (alvoY - camY) * 0.12;
      const figuras: Figura[] = [];
      for (const fa of o.fantasmas ?? []) {
        const g = fantasmaEm(fa.amostras, n);
        if (g) figuras.push({ x: g.x, y: g.y, jeito: g.jeito, andado: g.x, alpha: 0.4 });
      }
      for (const r of rivais) figuras.push({ x: r.pos.x, y: r.pos.y, jeito: r.pos.j, andado: r.pos.x, alpha: 0.75, nome: r.nome });
      if (o.piloto) {
        figuras.push({
          x: k.x,
          y: k.y,
          jeito: k.lado * (k.noChao || k.espera > 0 ? 1 : 2),
          andado: Math.abs(k.vx) < 6 ? null : k.andado,
          piscando: k.espera > 0 && Math.floor(k.espera / 4) % 2 === 0,
        });
      }
      pintar(p, camX, camY, n, figuras);
      barraDoCaminho(p.ctx, [
        ...(o.fantasmas ?? []).map((fa) => ({ andou: ((fantasmaEm(fa.amostras, n)?.x ?? f.chegada) - f.largada.x) / (f.chegada - f.largada.x), cor: '#c8c0cc' })),
        ...rivais.map((r) => ({ andou: r.pos.andou, cor: '#7ab8ff' })),
        ...(o.piloto ? [{ andou: progresso(k, f), cor: '#ffa24a' }] : []),
      ]);
      if (contagem > 0 || (o.piloto && k.passos < 40)) semaforo(p.ctx, contagem);
      if (pausado && o.piloto) {
        p.ctx.fillStyle = '#140e188c';
        p.ctx.fillRect(0, 0, W, H);
        p.ctx.fillStyle = '#f4ead8';
        p.ctx.fillRect(W / 2 - 12, H / 2 - 14, 8, 28);
        p.ctx.fillRect(W / 2 + 4, H / 2 - 14, 8, 28);
      }
      if (o.rivais && o.aoOrdem) {
        const linhas = rivais.map((r) => ({ id: r.id, nome: r.nome, eu: false, andou: r.pos.andou }));
        if (o.piloto) linhas.push({ id: o.eu, nome: '', eu: true, andou: k.terminou ? 1 : progresso(k, f) });
        for (const [id, r] of o.rivais) if (!linhas.some((l) => l.id === id)) linhas.push({ id, nome: r.nome, eu: false, andou: -1 });
        linhas.sort((a, b) => b.andou - a.andou);
        const chave = linhas.map((l) => l.id).join(',');
        if (chave !== ordemAntes) {
          ordemAntes = chave;
          o.aoOrdem(linhas.map(({ id, nome, eu }) => ({ id, nome, eu })));
        }
      }
    };

    const ciclo = (agora: number) => {
      if (!vivo) return;
      const dt = Math.min(0.1, (agora - antes) / 1000);
      antes = agora;
      pausado = document.hidden || !document.hasFocus() || !!o.pausa?.ativa;
      if (!pausado || !o.piloto) {
        acumulado += dt;
        while (acumulado >= PASSO) {
          andar();
          if (!o.piloto && contagem === 0) nAssistindo++;
          acumulado -= PASSO;
        }
      }
      // quem assiste não vê o futuro: o passo mostrado não passa do último que chegou de alguém
      if (!o.piloto && o.rivais) {
        const ultimo = Math.max(0, ...[...o.rivais.values()].map((r) => r.posicoes.at(-1)?.n ?? 0));
        nAssistindo = Math.min(Math.max(nAssistindo, ultimo - 12), ultimo);
      }
      if (!document.hidden) desenhar();
      o.aoPlacar({ ms: Math.round(((k.terminou ? k.chegouEm : k.passos) * 1000) / 60), pausado: pausado && o.piloto, quedas: k.quedas });
      if (k.terminou && !fimEm) fimEm = agora;
      if (fimEm && agora - fimEm > 1200 && !avisou) {
        avisou = true;
        o.aoChegar?.(k.chegouEm, caminho);
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
