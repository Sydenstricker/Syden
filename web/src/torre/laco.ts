import { tocar } from '../somDosJogos';
import { H, semaforo, W } from '../plataforma/desenho';
import type { LinhaDaOrdem, PosicaoDoRival, Rival } from '../plataforma/laco';
import { altura, type Torre } from './fases';
import { barraDaSubida, pintar, prepararPintura, type Figura } from './desenho';
import { AMOSTRA, amostrar, fantasmaEm, novoCoelho, PASSO, passo, progresso, type Coelho, type Comandos } from './fisica';
import { planejar } from './piloto';

/**
 * O LAÇO DA TORRE DO CELEIRO (05/11/2026), o do Pulo do coelho (plataforma/laco.ts) com a câmera que SOBE: a física em
 * passos fixos, a câmera e o desenho. Quem chama diz o que muda: a torre, os fantasmas (contra o relógio), os RIVAIS ao
 * vivo (na sala, chegam pelo socket), a contagem da largada e o que fazer na chegada. Com a janela sem foco, o coelho PARA
 * (a física e o relógio também): o tempo de cada um é contado nos passos dele.
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

/** Onde um rival estava no passo `n`, entre duas posições (sem atravessar a volta ao posto); depois da última, a última. */
export function rivalNaTorre(posicoes: PosicaoDoRival[], n: number): PosicaoDoRival | null {
  if (posicoes.length === 0) return null;
  let i = posicoes.length - 1;
  while (i > 0 && posicoes[i].n > n) i--;
  const a = posicoes[i];
  const b = posicoes[i + 1];
  if (!b || b.n <= a.n || Math.abs(b.x - a.x) > 40 || Math.abs(b.y - a.y) > 40) return a;
  const t = Math.max(0, Math.min(1, (n - a.n) / (b.n - a.n)));
  return { n, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, j: a.j, andou: a.andou + (b.andou - a.andou) * t };
}

export interface OpcoesDaTorre {
  canvas: HTMLCanvasElement;
  comandos: Comandos;
  torre: Torre;
  /** Sem coelho (quem assiste): a câmera vai atrás de quem está mais alto. */
  piloto: boolean;
  eu: number;
  meuAvatar?: number | null;
  fantasmas?: { amostras: number[]; avatar?: number | null }[];
  rivais?: Map<number, Rival & { avatar?: number | null }>;
  contagem: number;
  calmo?: boolean;
  /** A pausa do ESC (pausaDosJogos.tsx), só no Solo: lida a cada quadro, como a janela sem foco. */
  pausa?: { readonly ativa: boolean };
  aoPlacar: (p: { ms: number; pausado: boolean; quedas: number }) => void;
  aoOrdem?: (ordem: LinhaDaOrdem[]) => void;
  aoPosicao?: (p: PosicaoDoRival) => void;
  aoChegar?: (passos: number, caminho: number[]) => void;
  /** Quem já chegou assiste a quem ainda sobe (como no Pulo): a câmera vai para `seguir.id`, ou para o mais alto. */
  seguir?: { id: number | null };
  aoAssistir?: (alvo: { id: number; nome: string } | null, subindo: { id: number; nome: string }[]) => void;
}

export function rodarTorre(o: OpcoesDaTorre): () => void {
  let vivo = true;
  let quadro = 0;
  const f = o.torre;
  const p = prepararPintura(o.canvas, f, o.calmo);

  void (async () => {
    p.coelho = await coelho();
    if (!vivo) return;
    const k: Coelho = novoCoelho(f);
    const caminho: number[] = [];
    let camY = Math.max(0, altura(f) - H);
    let contagem = o.contagem;
    let acumulado = 0;
    let antes = performance.now();
    let fimEm = 0;
    let avisou = false;
    let pausado = false;
    let ordemAntes = '';
    let nAssistindo = 0;
    let assistindoAntes = '';
    let plano: Comandos[] | null = null;

    const andar = () => {
      if (contagem > 0) {
        contagem--;
        return;
      }
      if (!o.piloto) return;
      const auto = import.meta.env.DEV && (window as { torrePilotoAutomatico?: boolean }).torrePilotoAutomatico;
      if (auto && !plano) plano = planejar(f, k) ?? [];
      const c = auto && plano ? (plano.shift() ?? { esquerda: false, direita: false, pula: false }) : o.comandos;
      const jaTinha = k.terminou;
      const noChaoAntes = k.noChao;
      const quedasAntes = k.quedas;
      passo(k, c, f);
      if (noChaoAntes && !k.noChao && k.vy < 0) tocar('pulo');
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
      const lista: { id: number; nome: string; avatar: number | null; pos: PosicaoDoRival }[] = [];
      for (const [id, r] of o.rivais ?? []) {
        const pos = rivalNaTorre(r.posicoes, n);
        if (pos) lista.push({ id, nome: r.nome, avatar: r.avatar ?? null, pos });
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
        const subindo = rivais.filter((r) => r.pos.andou < 0.99).sort((a, b) => b.pos.andou - a.pos.andou);
        const alvo = subindo.find((r) => r.id === o.seguir?.id) ?? subindo[0];
        if (alvo) foco = alvo.pos;
        if (o.seguir) o.seguir.id = alvo?.id ?? null;
        const chave = (alvo?.id ?? '') + '|' + subindo.map((r) => r.id).join(',');
        if (chave !== assistindoAntes) {
          assistindoAntes = chave;
          o.aoAssistir(alvo ? { id: alvo.id, nome: alvo.nome } : null, subindo.map((r) => ({ id: r.id, nome: r.nome })));
        }
      }
      // a câmera: o coelho um pouco abaixo do meio (vê-se mais do que vem por cima)
      const alvoY = Math.max(0, Math.min(altura(f) - H, foco.y - 112));
      camY += (alvoY - camY) * 0.14;
      const figuras: Figura[] = [];
      for (const fa of o.fantasmas ?? []) {
        const g = fantasmaEm(fa.amostras, n);
        if (g) figuras.push({ x: g.x, y: g.y, jeito: g.jeito, andado: g.x, alpha: 0.35, avatar: fa.avatar ?? null });
      }
      for (const r of rivais) figuras.push({ x: r.pos.x, y: r.pos.y, jeito: r.pos.j, andado: r.pos.y, alpha: 0.5, nome: r.nome, avatar: r.avatar });
      if (o.piloto) {
        figuras.push({
          x: k.x,
          y: k.y,
          jeito: k.lado * (k.noChao || k.espera > 0 ? 1 : 2),
          andado: Math.abs(k.vx) < 6 ? null : k.andado,
          piscando: k.espera > 0 && Math.floor(k.espera / 4) % 2 === 0,
          avatar: o.meuAvatar ?? null,
        });
      }
      pintar(p, camY, n, figuras);
      barraDaSubida(p.ctx, [
        ...(o.fantasmas ?? []).map((fa) => {
          const g = fantasmaEm(fa.amostras, n);
          return { andou: g ? progresso(g, f) : 1, cor: '#c8c0cc' };
        }),
        ...rivais.map((r) => ({ andou: r.pos.andou, cor: '#7ab8ff' })),
        ...(o.piloto ? [{ andou: k.terminou ? 1 : progresso(k, f), cor: '#ffa24a' }] : []),
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
