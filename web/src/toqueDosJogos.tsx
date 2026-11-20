import { useRef } from 'react';
import { direcoesDaAlavanca, type Direcoes } from './alavancaDosJogos';
import './toqueDosJogos.css';

export { direcoesDaAlavanca, type Direcoes };

/**
 * OS CONTROLES DE TOQUE DOS JOGOS (20/11/2026, a segunda auditoria dos mini-games: "função que só existe no teclado não existe no
 * celular"). Duas peças, só da tela: nada aqui vai ao servidor nem mexe na regra; cada jogo traduz o que elas dizem para os
 * mesmos bits de comando do teclado.
 *
 * - A ALAVANCA (`Alavanca`): a base redonda e o pino que segue o dedo. Ela diz o quanto o dedo saiu do meio (−1 … 1 em cada
 *   eixo; y para baixo é positivo), e `direcoesDaAlavanca` corta isso em OITO direções de 45°, para os jogos de quatro bits
 *   (frente, trás, esquerda, direita) andarem também na diagonal.
 * - O GRUPO DE BOTÕES (`useGrupoDeToque`): os botões são achados PELA POSIÇÃO DO DEDO, e não pelo elemento em que ele desceu.
 *   O polegar desliza de ◀ para ▶ (ou do pulo para o flip) sem levantar, e dois dedos valem ao mesmo tempo. Cada botão do grupo
 *   leva `data-toque="<id>"`.
 */

/** A alavanca virtual. `aoMudar` recebe a posição do dedo (−1 … 1), e (0, 0) quando ele sai. */
export function Alavanca({ aoMudar, rotulo, className = '' }: { aoMudar: (x: number, y: number) => void; rotulo?: string; className?: string }) {
  const base = useRef<HTMLDivElement>(null);
  const pino = useRef<HTMLSpanElement>(null);
  const dedo = useRef<number | null>(null);
  const mover = (cx: number, cy: number) => {
    const b = base.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const raio = r.width / 2;
    let x = (cx - (r.left + raio)) / raio;
    let y = (cy - (r.top + r.height / 2)) / raio;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    if (pino.current) pino.current.style.transform = `translate(${x * raio * 0.6}px, ${y * raio * 0.6}px)`;
    aoMudar(x, y);
  };
  const soltar = (e: React.PointerEvent) => {
    if (dedo.current !== e.pointerId) return;
    dedo.current = null;
    if (pino.current) pino.current.style.transform = '';
    aoMudar(0, 0);
  };
  return (
    <div
      ref={base}
      className={`alavanca-dos-jogos ${className}`}
      role="img"
      aria-label={rotulo}
      onPointerDown={(e) => {
        e.preventDefault();
        if (dedo.current !== null) return;
        dedo.current = e.pointerId;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        mover(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => dedo.current === e.pointerId && mover(e.clientX, e.clientY)}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onLostPointerCapture={soltar}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span ref={pino} className="alavanca-dos-jogos-pino" />
    </div>
  );
}

/** Quanto o dedo pode passar da borda de um botão e ainda valer nele (cobre o vão entre dois botões vizinhos). */
const FOLGA = 10;

/** O botão do grupo sob o ponto (o mais perto, se o ponto está na folga de mais de um); null se nenhum. */
function botaoEm(grupo: HTMLElement, x: number, y: number): string | null {
  let melhor: string | null = null;
  let menor = Infinity;
  for (const el of grupo.querySelectorAll<HTMLElement>('[data-toque]')) {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const d = Math.hypot(dx, dy);
    if (d <= FOLGA && d < menor) {
      menor = d;
      melhor = el.dataset.toque ?? null;
    }
  }
  return melhor;
}

/**
 * O grupo de botões de toque: devolve as propriedades do elemento que contém os botões. A cada mudança, `aoMudar` recebe o
 * conjunto dos botões com dedo em cima agora. Os botões também ganham a classe `apertado` (o retorno visual).
 */
export function useGrupoDeToque(aoMudar: (apertados: ReadonlySet<string>) => void) {
  const dedos = useRef(new Map<number, string | null>());
  const mudar = useRef(aoMudar);
  mudar.current = aoMudar;
  const avisar = (grupo: HTMLElement) => {
    const s = new Set<string>();
    for (const id of dedos.current.values()) if (id) s.add(id);
    for (const el of grupo.querySelectorAll<HTMLElement>('[data-toque]')) el.classList.toggle('apertado', s.has(el.dataset.toque ?? ''));
    mudar.current(s);
  };
  const atualizar = (e: React.PointerEvent<HTMLElement>) => {
    if (!dedos.current.has(e.pointerId)) return;
    const id = botaoEm(e.currentTarget, e.clientX, e.clientY);
    if (dedos.current.get(e.pointerId) === id) return;
    dedos.current.set(e.pointerId, id);
    avisar(e.currentTarget);
  };
  const soltar = (e: React.PointerEvent<HTMLElement>) => {
    if (!dedos.current.delete(e.pointerId)) return;
    avisar(e.currentTarget);
  };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      const id = botaoEm(e.currentTarget, e.clientX, e.clientY);
      if (!id) return;
      e.preventDefault();
      // o dedo é seguido pelo grupo: os movimentos dele chegam aqui mesmo fora do botão em que desceu
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dedos.current.set(e.pointerId, id);
      avisar(e.currentTarget);
    },
    onPointerMove: atualizar,
    onPointerUp: soltar,
    onPointerCancel: soltar,
    onLostPointerCapture: soltar,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
