import { Component, useEffect, useState, type ReactNode } from 'react';
import { coresDoJogador, type AvatarDoJogo } from '../coelho/cores';
import { menosMovimento, type MicrojogoDaTela, type PropsDoMicro } from './comum';

/**
 * A MOLDURA DA FESTA, menos magra (19/11/2026, pedido dele na auditoria dos mini-games): no "prepare-se", o desenho dos
 * controles (as teclas e o toque) e a figura do microjogo (a própria tela dele, parada e pequena); na revelação, quem venceu
 * comemorando, com os pontos subindo. Tudo desenhado por código e sem texto: as teclas se reconhecem pelo desenho.
 */

/** Como se joga cada microjogo: 'aperto' (Espaço ou Enter), 'setas' (as setas ou WASD), 'numeros' (1, 2, 3…), 'clique' (mouse ou toque). */
export type Controle = 'aperto' | 'setas' | 'numeros' | 'clique';

/**
 * Os controles de cada microjogo (lidos das telas em 19/11/2026: quem usa `ehAperto`, as setas, os números). Microjogo novo
 * sem linha aqui mostra só o clique; com teclas, ganhe a linha.
 */
export const CONTROLES: Record<string, Controle[]> = {
  arena: ['setas', 'clique'],
  balanco: ['aperto', 'clique'],
  brasas: ['setas', 'clique'],
  cabo: ['setas', 'clique'],
  canteiro: ['setas', 'clique'],
  cavalinho: ['setas', 'clique'],
  celeiro: ['setas', 'clique'],
  chuva: ['setas', 'clique'],
  cipo: ['aperto', 'clique'],
  colheita: ['setas', 'clique'],
  copos: ['numeros', 'clique'],
  desmorona: ['setas', 'clique'],
  flecha: ['aperto', 'clique'],
  flor: ['aperto', 'clique'],
  foguete: ['aperto', 'clique'],
  forca: ['aperto', 'clique'],
  galinha: ['setas', 'clique'],
  gelo: ['setas', 'clique'],
  ladeira: ['setas', 'clique'],
  nabo: ['aperto', 'clique'],
  onda: ['aperto', 'setas', 'clique'],
  ponteiro: ['aperto', 'clique'],
  ponteriacho: ['setas', 'clique'],
  portas: ['numeros', 'clique'],
  porteira: ['setas', 'clique'],
  potes: ['setas', 'clique'],
  rebater: ['aperto', 'clique'],
  regar: ['setas', 'clique'],
  relogio: ['aperto', 'clique'],
  remada: ['setas', 'clique'],
  retrato: ['aperto', 'setas', 'clique'],
  revezamento: ['setas', 'clique'],
  rio: ['aperto', 'setas', 'clique'],
  rodafeira: ['aperto', 'clique'],
  saque: ['aperto', 'clique'],
  siga: ['setas', 'clique'],
  tacada: ['aperto', 'clique'],
  tambor: ['numeros', 'clique'],
  torta: ['setas', 'clique'],
  trinca: ['aperto', 'setas', 'clique'],
};

const TECLA = '#f3ead8';
const BORDA = '#a89276';
const TINTA = '#5a3a2a';

/** Uma tecla: a sombra embaixo e o tampo. */
function Tecla({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y + 2} width={w} height={h} rx="2" fill={BORDA} />
      <rect x={x} y={y} width={w} height={h} rx="2" fill={TECLA} />
      {children}
    </g>
  );
}

/** O desenho de um controle (sem texto). */
function DesenhoDoControle({ c }: { c: Controle }) {
  if (c === 'aperto')
    return (
      <svg width="64" height="26" viewBox="0 0 64 26" aria-hidden="true" shapeRendering="crispEdges">
        <Tecla x={2} y={6} w={60} h={16}>
          <rect x="22" y="15" width="20" height="2" fill={TINTA} />
          <rect x="22" y="12" width="2" height="5" fill={TINTA} />
          <rect x="40" y="12" width="2" height="5" fill={TINTA} />
        </Tecla>
      </svg>
    );
  if (c === 'setas') {
    const seta = (x: number, y: number, giro: number) => (
      <Tecla x={x} y={y} w={14} h={12}>
        <g transform={`rotate(${giro} ${x + 7} ${y + 6})`}>
          <rect x={x + 6} y={y + 3} width="2" height="7" fill={TINTA} />
          <rect x={x + 4} y={y + 5} width="6" height="2" fill={TINTA} />
          <rect x={x + 5} y={y + 4} width="4" height="1" fill={TINTA} />
        </g>
      </Tecla>
    );
    return (
      <svg width="52" height="34" viewBox="0 0 52 34" aria-hidden="true" shapeRendering="crispEdges">
        {seta(19, 2, 0)}
        {seta(3, 18, 270)}
        {seta(19, 18, 180)}
        {seta(35, 18, 90)}
      </svg>
    );
  }
  if (c === 'numeros')
    return (
      <svg width="52" height="22" viewBox="0 0 52 22" aria-hidden="true">
        {[1, 2, 3].map((n, i) => (
          <Tecla key={n} x={2 + i * 17} y={2} w={14} h={14}>
            <text x={9 + i * 17} y={13} fontSize="10" fontWeight="700" textAnchor="middle" fill={TINTA} fontFamily="system-ui, sans-serif">
              {n}
            </text>
          </Tecla>
        ))}
      </svg>
    );
  // o clique: o mouse e o dedo
  return (
    <svg width="46" height="30" viewBox="0 0 46 30" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="3" y="4" width="14" height="22" rx="6" fill={TECLA} stroke={BORDA} strokeWidth="2" />
      <rect x="9" y="5" width="2" height="7" fill={BORDA} />
      <rect x="4" y="5" width="5" height="7" fill="#f2c46a" />
      <rect x="29" y="3" width="5" height="14" fill="#e8c4a8" />
      <rect x="26" y="13" width="14" height="13" fill="#e8c4a8" />
      <rect x="29" y="3" width="5" height="3" fill="#f3ead8" />
      <rect x="24" y="16" width="3" height="6" fill="#e8c4a8" />
    </svg>
  );
}

/** Os controles do microjogo, lado a lado. */
export function Controles({ id }: { id: string }) {
  const lista = CONTROLES[id] ?? ['clique'];
  return (
    <div className="festa-controles" aria-hidden="true" style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
      {lista.map((c) => (
        <DesenhoDoControle key={c} c={c} />
      ))}
    </div>
  );
}

/** Se a tela parada falhar (um microjogo que não aceita ser mostrado antes da hora), a figura some: o preparo continua. */
class SemFigura extends Component<{ children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    return this.state.falhou ? null : this.props.children;
  }
}

const nada = () => {};

/**
 * A FIGURA DO MICROJOGO: a própria tela, parada (desligada, com o começo lá na frente), pequena, sem receber clique nem foco.
 * Assim a figura é sempre a do jogo de verdade, sem uma arte a mais para manter.
 */
export function FiguraDoMicro({ micro, dados }: { micro: MicrojogoDaTela<never>; dados: unknown }) {
  const [inicio] = useState(() => Date.now() + 3_600_000);
  if (!dados) return null;
  const props: PropsDoMicro<never> = { dados: dados as never, inicio, ativo: false, enviar: nada, lance: nada, sinal: false, resposta: null };
  return (
    <SemFigura>
      <div
        className="festa-figura"
        aria-hidden="true"
        inert
        style={{ pointerEvents: 'none', maxHeight: 150, overflow: 'hidden', display: 'flex', justifyContent: 'center', opacity: 0.92 }}
      >
        <div style={{ transform: 'scale(0.5)', transformOrigin: 'top center', width: '100%', maxWidth: 520, height: 300 }}>
          <micro.Tela {...props} />
        </div>
      </div>
    </SemFigura>
  );
}

/** Um coelho de pixels grandes, de braços para cima, pulando (parado com "menos movimento"). */
export function CoelhoComemorando({ avatar, tamanho = 64, atraso = 0 }: { avatar: AvatarDoJogo; tamanho?: number; atraso?: number }) {
  const c = coresDoJogador(avatar);
  const rgb = (v: [number, number, number]) => `rgb(${v.join(',')})`;
  const pelo = c ? rgb(c.pelo) : '#e8dccb';
  const roupa = c ? rgb(c.roupa) : '#d9774f';
  const [parado] = useState(menosMovimento);
  return (
    <svg width={tamanho} height={tamanho * 1.25} viewBox="0 0 20 25" aria-hidden="true" shapeRendering="crispEdges">
      <g>
        {!parado && <animateTransform attributeName="transform" type="translate" values="0 0; 0 -3; 0 0" dur="0.5s" begin={`${atraso}s`} repeatCount="indefinite" />}
        {/* os braços para cima */}
        <rect x="3" y="11" width="2" height="5" fill={roupa} />
        <rect x="15" y="11" width="2" height="5" fill={roupa} />
        <rect x="3" y="9" width="2" height="2" fill={pelo} />
        <rect x="15" y="9" width="2" height="2" fill={pelo} />
        {/* o corpo, a cabeça e as orelhas */}
        <rect x="5" y="15" width="10" height="7" fill={roupa} />
        <rect x="5" y="8" width="10" height="8" fill={pelo} />
        <rect x="6" y="1" width="3" height="8" fill={pelo} />
        <rect x="11" y="1" width="3" height="8" fill={pelo} />
        <rect x="7" y="2" width="1" height="5" fill="#d98a8a" />
        <rect x="12" y="2" width="1" height="5" fill="#d98a8a" />
        {/* os olhos fechados de alegria e a boca aberta */}
        <rect x="7" y="11" width="2" height="1" fill="#3a2e2a" />
        <rect x="11" y="11" width="2" height="1" fill="#3a2e2a" />
        <rect x="9" y="13" width="2" height="2" fill="#a8504a" />
        <rect x="6" y="22" width="3" height="2" fill={pelo} />
        <rect x="11" y="22" width="3" height="2" fill={pelo} />
      </g>
      {/* os confetes */}
      {!parado &&
        [
          [1, 4, '#f2c46a'],
          [18, 6, '#7fae5a'],
          [2, 18, '#7d93c4'],
          [17, 16, '#d9774f'],
        ].map(([x, y, cor], i) => (
          <rect key={i} x={x as number} y={y as number} width="1.5" height="1.5" fill={cor as string}>
            <animate attributeName="opacity" values="1;0.2;1" dur="0.7s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
          </rect>
        ))}
    </svg>
  );
}

/** Um número que sobe de zero até `valor` em ~0,7 s (os pontos da revelação). */
export function ContaQueSobe({ valor, prefixo = '+' }: { valor: number; prefixo?: string }) {
  const [mostrado, setMostrado] = useState(() => (menosMovimento() ? valor : 0));
  useEffect(() => {
    if (menosMovimento()) return setMostrado(valor);
    const comeco = performance.now();
    let id = 0;
    const passo = () => {
      const f = Math.min(1, (performance.now() - comeco) / 700);
      setMostrado(Math.round(valor * (1 - (1 - f) * (1 - f))));
      if (f < 1) id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [valor]);
  return (
    <>
      {prefixo}
      {mostrado}
    </>
  );
}

/** QUEM VENCEU A RODADA: o coelho de cada um em 1º lugar comemorando, com o nome e os pontos subindo. */
export function Vencedores({ vencedores }: { vencedores: { userId: number; username: string; avatar: AvatarDoJogo; pontos: number }[] }) {
  if (!vencedores.length) return null;
  return (
    <div className="festa-vencedores" style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', margin: '4px 0 8px' }}>
      {vencedores.slice(0, 4).map((v, i) => (
        <div key={v.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CoelhoComemorando avatar={v.avatar} atraso={i * 0.12} />
          <span className="minijogo-nome">{v.username}</span>
          <strong className="festa-pontos" style={{ fontSize: '1.4em' }}>
            <ContaQueSobe valor={v.pontos} />
          </strong>
        </div>
      ))}
    </div>
  );
}
