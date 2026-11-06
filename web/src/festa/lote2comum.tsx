import { useEffect, useRef, type PointerEvent as PE } from 'react';
import { PASSO_MS, type Entrada } from './lote2sim';

/**
 * O QUE AS TELAS DO LOTE 2 DA FESTA USAM (05/11/2026): andar com as setas (ou WASD) ou com o dedo/mouse apertado no desenho,
 * que puxa o coelho (ou a nuvem) para onde está; e uns desenhos repetidos. As contas que o servidor refaz moram em ./lote2sim.
 */

/** O ponto da tela no desenho (as coordenadas do viewBox). */
export function pontoNoSvg(svg: SVGSVGElement, x: number, y: number): [number, number] | null {
  const m = svg.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(x, y).matrixTransform(m.inverse());
  return [p.x, p.y];
}

const TECLAS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
};

const ehCampo = (alvo: EventTarget | null) => {
  const a = alvo as HTMLElement | null;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
};

/**
 * A DIREÇÃO PEDIDA: as setas seguradas, ou o ponteiro apertado no desenho. `ler(de)` dá −1, 0 ou 1 em cada eixo (o ponteiro, em
 * relação ao ponto `de`, com uma folga para não tremer); `vetor(de)` dá a direção contínua, de tamanho até 1.
 * Ponha `svg` no <svg> e espalhe `ponteiro` nele.
 */
export function useDirecao(ativo: boolean) {
  const teclas = useRef(new Set<string>());
  const svg = useRef<SVGSVGElement>(null);
  const alvo = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!ativo) {
      teclas.current.clear();
      alvo.current = null;
      return;
    }
    const desce = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!(k in TECLAS) || e.ctrlKey || e.metaKey || e.altKey || ehCampo(e.target)) return;
      teclas.current.add(k);
      e.preventDefault();
    };
    const sobe = (e: KeyboardEvent) => teclas.current.delete(e.key.toLowerCase());
    const solta = () => teclas.current.clear();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', solta);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', solta);
    };
  }, [ativo]);

  const mirar = (ev: PE<SVGSVGElement>) => {
    if (svg.current) alvo.current = pontoNoSvg(svg.current, ev.clientX, ev.clientY);
  };
  const ponteiro = {
    onPointerDown(ev: PE<SVGSVGElement>) {
      if (!ativo) return;
      ev.preventDefault();
      ev.currentTarget.setPointerCapture?.(ev.pointerId);
      mirar(ev);
    },
    onPointerMove(ev: PE<SVGSVGElement>) {
      if (alvo.current) mirar(ev);
    },
    onPointerUp() {
      alvo.current = null;
    },
    onPointerCancel() {
      alvo.current = null;
    },
  };

  const dasTeclas = (): [number, number] => {
    let dx = 0;
    let dy = 0;
    for (const k of teclas.current) {
      dx += TECLAS[k][0];
      dy += TECLAS[k][1];
    }
    return [Math.sign(dx), Math.sign(dy)];
  };
  const ler = (de?: [number, number], folga = 6): [number, number] => {
    const [dx, dy] = dasTeclas();
    if (dx || dy || !alvo.current || !de) return [dx, dy];
    const ax = alvo.current[0] - de[0];
    const ay = alvo.current[1] - de[1];
    // oito direções: o eixo pequeno só conta se for pelo menos 40% do grande
    const m = Math.max(Math.abs(ax), Math.abs(ay));
    if (m < folga) return [0, 0];
    return [Math.abs(ax) >= m * 0.4 ? Math.sign(ax) : 0, Math.abs(ay) >= m * 0.4 ? Math.sign(ay) : 0];
  };
  const vetor = (de?: [number, number]): [number, number] => {
    const [dx, dy] = dasTeclas();
    if (dx || dy || !alvo.current || !de) {
      const m = Math.sqrt(dx * dx + dy * dy) || 1;
      return [dx / m, dy / m];
    }
    const ax = alvo.current[0] - de[0];
    const ay = alvo.current[1] - de[1];
    const d = Math.sqrt(ax * ax + ay * ay);
    if (d < 3) return [0, 0];
    // perto do dedo, mais devagar: não passa do ponto
    const f = Math.min(1, d / 18) / d;
    return [ax * f, ay * f];
  };
  return { svg, ponteiro, ler, vetor };
}

/**
 * A SIMULAÇÃO EM PASSOS (Regar a horta, Pegue a galinha): anda o estado até o passo de agora, com a mesma conta do servidor, e
 * guarda o passo de antes para o desenho ficar liso entre um e outro (`entre`). As entradas são a lista que a tela vai enchendo.
 */
export function usePassos<S extends { n: number }>(e: number, criar: () => S, passo: (s: S) => void, ate: number) {
  const ref = useRef<{ s: S; antes: S } | null>(null);
  if (!ref.current) {
    const s = criar();
    ref.current = { s, antes: { ...s } };
  }
  const r = ref.current;
  const alvo = Math.min(ate, Math.max(0, Math.floor(e / PASSO_MS)));
  while (r.s.n < alvo) {
    r.antes = { ...r.s };
    passo(r.s);
  }
  const f = Math.min(1, Math.max(0, e / PASSO_MS - r.s.n));
  const entre = (a: number, b: number) => a + (b - a) * f;
  return { s: r.s, antes: r.antes, entre };
}

/**
 * A DIREÇÃO QUE MUDOU vira uma entrada: no passo de agora (os anteriores já foram andados), na lista e na hora para o servidor.
 */
export function anotarDirecao(entradas: Entrada[], n: number, [dx, dy]: [number, number], lance: (corpo: Record<string, unknown>) => void) {
  const ultima = entradas[entradas.length - 1];
  if (ultima ? ultima[1] === dx && ultima[2] === dy : dx === 0 && dy === 0) return;
  entradas.push([n, dx, dy]);
  lance({ p: n, dx, dy });
}

/** Uma cenoura de pé (a ponta para baixo), em volta de (0, 0). */
export function Cenoura({ x = 0, y = 0, escala = 1, dourada = false }: { x?: number; y?: number; escala?: number; dourada?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <path d="M-2 -8 Q-6 -15 -3 -17 M0 -8 Q0 -16 2 -18 M2 -8 Q6 -14 6 -16" stroke="#4f8a3a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M-5 -8 Q0 -10 5 -8 L1 10 Q0 12 -1 10 Z" fill={dourada ? '#f2c94c' : '#e07a2e'} stroke={dourada ? '#b8892a' : '#a9541c'} strokeWidth="1.2" />
      <path d="M-3 -3 L0 -2 M-2 2 L1 3" stroke={dourada ? '#fff3b0' : '#f3a35f'} strokeWidth="1" strokeLinecap="round" />
    </g>
  );
}

/** A piscada de quem acabou de levar um golpe (some e volta a cada 120 ms). */
export const piscando = (agora: number, ate: number) => agora < ate && Math.floor(agora / 120) % 2 === 0;
