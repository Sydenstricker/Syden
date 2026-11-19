/**
 * O IMPACTO DOS JOGOS DE AÇÃO (19/11/2026, a auditoria dos mini-games: nenhum jogo de ação tinha a pausa no acerto, e só o
 * Ringue e a Esquadrilha tremiam a tela). Um módulo só, para o golpe pesar igual em todos: a Briga, o Comando, a Masmorra, o
 * Chefe, a Caça, a Esquadrilha, o Pulo, a Arena…
 *
 * SÓ DESENHO. Nada aqui entra na simulação nem no que vai ao servidor: a pausa no acerto ("hit-stop") congela o DESENHO e a
 * animação de quem bateu por uns quadros, e o passo da física continua (os jogos com regra em duas cópias e com servidor que
 * refaz não podem ter o relógio mexido). Quem usa:
 *
 *   const impacto = criarImpacto();
 *   // ao acertar:
 *   impacto.acerto({ forca: 0.6, pausaMs: 60, piscar: idDoBicho });
 *   // a cada quadro, antes de desenhar:
 *   const { dx, dy, congelado } = impacto.quadro(performance.now());
 *   ctx.translate(dx, dy);                          // o tremor
 *   if (!congelado) avancarAnimacoes();            // a pausa
 *   if (impacto.piscando(idDoBicho)) desenharBranco(); // o piscar
 *
 * "Menos movimento" no sistema: sem tremor (a pausa e o piscar ficam, porque não mexem a tela). Sem foco, quem chama não desenha.
 */

export const menosMovimentoNoSistema = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface OpcoesDoAcerto {
  /** De 0 a 1: quanto a tela treme (1 ≈ 6 px). 0 não treme. */
  forca?: number;
  /** Quanto tempo o tremor dura (padrão 180 ms). */
  tremorMs?: number;
  /** A pausa no acerto, em ms (padrão 0; um soco comum ~40, o golpe final ~90). Máximo de 150. */
  pausaMs?: number;
  /** O que pisca branco (o id do bicho, do inimigo), e por quanto tempo (padrão 90 ms). */
  piscar?: string | number;
  piscarMs?: number;
}

export interface Impacto {
  acerto(op?: OpcoesDoAcerto): void;
  /** Só o tremor (a explosão, o chefe pisando). */
  tremer(forca: number, ms?: number): void;
  /** O deslocamento da tela e se a animação está congelada neste quadro. */
  quadro(agora?: number): { dx: number; dy: number; congelado: boolean };
  piscando(id: string | number, agora?: number): boolean;
  /** Esquece tudo (fim da partida, troca de fase). */
  limpar(): void;
}

/** O gerador do tremor: determinístico pelo tempo, para não depender do Math.random a cada quadro. */
function ruido(t: number, semente: number): number {
  const x = Math.sin(t * 0.091 + semente * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export function criarImpacto(opcoes: { pixelsPorForca?: number } = {}): Impacto {
  const pixels = opcoes.pixelsPorForca ?? 6;
  let tremorAte = 0;
  let tremorDur = 1;
  let tremorForca = 0;
  let congeladoAte = 0;
  const piscas = new Map<string | number, number>();
  const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const tremer = (forca: number, ms = 180) => {
    if (forca <= 0 || menosMovimentoNoSistema()) return;
    const t = agora();
    // um tremor mais forte substitui o mais fraco; um mais fraco não encurta o que já está tremendo
    const restante = tremorAte > t ? tremorForca * ((tremorAte - t) / tremorDur) : 0;
    if (forca >= restante) {
      tremorForca = Math.min(1, forca);
      tremorDur = ms;
      tremorAte = t + ms;
    }
  };

  return {
    acerto(op = {}) {
      const t = agora();
      if (op.forca) tremer(op.forca, op.tremorMs);
      if (op.pausaMs) congeladoAte = Math.max(congeladoAte, t + Math.min(150, op.pausaMs));
      if (op.piscar !== undefined) piscas.set(op.piscar, t + (op.piscarMs ?? 90));
    },
    tremer,
    quadro(t = agora()) {
      let dx = 0;
      let dy = 0;
      if (t < tremorAte) {
        const k = tremorForca * ((tremorAte - t) / tremorDur) * pixels;
        dx = Math.round(ruido(t, 1) * k);
        dy = Math.round(ruido(t, 2) * k);
      }
      return { dx, dy, congelado: t < congeladoAte };
    },
    piscando(id, t = agora()) {
      const ate = piscas.get(id);
      if (ate === undefined) return false;
      if (t >= ate) {
        piscas.delete(id);
        return false;
      }
      return true;
    },
    limpar() {
      tremorAte = 0;
      congeladoAte = 0;
      piscas.clear();
    },
  };
}
