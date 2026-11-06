import { forwardRef, useEffect, useRef, useState } from 'react';
import { Check, Coins, Eraser, Hammer, Play, Undo2 } from 'lucide-react';
import { ComandosDoJogo } from './ComandosDosJogos';
import { chave, useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import { tocar } from './somDosJogos';
import { useVistaDaPonte } from './ponte/usarVista';
import { ALTURA, COR_DO_FUNDO, LARGURA, type VistaDaPonte } from './ponte/vista';
import {
  cabe,
  custo as custoDe,
  faseDe,
  FASES,
  MAX_PECAS,
  montar,
  passo,
  PASSO,
  pecaCabe,
  PECAS,
  PISTA,
  pontePronta,
  semSoltas,
  type Fase,
  type Sim,
} from './ponte/sim';
import './ponte/ponte.css';

/**
 * A PONTE DA TOCA (06/11/2026, pedido dele: "Jogadores têm 30 segundos para montar a ponte. Aquele que usar menos recursos e
 * conseguir fazer o tráfego atravessar a ponte ganha."). SÓ A MECÂNICA do gênero de construir ponte; tudo desenhado por código.
 *
 * A MONTAGEM é deste computador: arrastar de um nó (um apoio vermelho ou a ponta de uma peça) até um ponto da grade põe a peça do
 * tipo escolhido (ou clicar num nó e ir clicando os pontos, em corrente); o botão direito (ou "Apagar") tira uma peça, e o que fica
 * solto cai junto; Ctrl+Z desfaz. Pelo teclado: as setas levam o cursor, Enter liga, Delete apaga, 1/2/3 trocam a peça. "Testar"
 * roda o tráfego aqui mesmo (o relógio não para) e volta a montar; "Pronto", ou o fim dos 30 s, manda a lista de peças.
 *
 * O SERVIDOR refaz a simulação com a mesma regra (ponte/sim.ts ↔ server/src/ponte-sim.ts) e o resultado é o dele. Na sala, o relógio
 * é o do servidor (a contagem e os 30 s vêm no estado); no Solo, é o deste computador, e o ESC e a janela sem foco o PAUSAM.
 *
 * Desde o mesmo dia (pedidos dele): o DESENHO É 3D (ponte/cena3d.ts; a física continua a mesma, de lado), com o 2D de reserva; o
 * tráfego espera na margem desde a montagem, na ordem, com o peso (ponte/fila.ts); e TUDO fica dentro da tela do jogo — as peças,
 * os botões, o custo e o relógio por cima do quadro, e os comandos só na contagem e nos primeiros segundos.
 */

export interface LinhaDaPonte {
  userId: number;
  username: string;
  mandou: boolean;
  passou: boolean;
  progresso: number;
  custo: number;
  posicao: number | null;
}

export interface EstadoPonte {
  fase: 'montando' | 'fim';
  faseDaPonte: string;
  solo: boolean;
  contagemMs: number;
  montagemMs: number;
  meu: { passou: boolean; progresso: number; custo: number } | null;
  placar: LinhaDaPonte[];
  pontes: { userId: number; pecas: number[] }[];
  recorde: { antes: number | null; novo: boolean } | null;
  partidaId: string;
}

type Props = {
  estado: EstadoPonte & { terminada?: boolean };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
};

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e põe uma ponte inteira de uma vez (sem lista, a de referência) e lê a simulação. */
    ponteMontar?: (pecas?: number[]) => void;
    /** E onde fica um ponto da grade no canvas (em pixels lógicos), para o mouse do e2e. */
    ponteParaTela?: (x: number, y: number) => [number, number];
    ponteDoTeste?: Sim;
  }
}

const NOMES_DAS_PECAS = [chave('Pista'), chave('Madeira'), chave('Aço')];

export function JogoPonte({ estado, eu, jogador, agir }: Props) {
  const fase = faseDe(estado.faseDaPonte);
  const [minhas, setMinhas] = useState<number[] | null>(null);
  const fim = estado.terminada || estado.fase === 'fim';
  const meuNoPlacar = estado.placar.find((l) => l.userId === eu);
  const mandei = minhas !== null || (meuNoPlacar?.mandou ?? false);
  if (!fase) return <p className="minijogo-situacao">…</p>;
  if (!fim && jogador && meuNoPlacar && !mandei)
    return (
      <Montagem
        key={estado.partidaId}
        fase={fase}
        solo={estado.solo}
        contagemMs={estado.contagemMs}
        montagemMs={estado.montagemMs}
        aoMandar={(pecas) => {
          setMinhas(pecas);
          void agir({ tipo: 'ponte', pecas });
        }}
      />
    );
  if (!fim && !mandei) return <p className="minijogo-situacao">…</p>;
  return <Resultados estado={estado} fase={fase} eu={eu} minhas={minhas} fim={fim} />;
}

// =====================================================================================================================
// A ESCOLHA DA FASE
// =====================================================================================================================

function MiniaturaDaPonte({ fase }: { fase: Fase }) {
  const x0 = -2.5;
  const x1 = fase.largura + 2.5;
  const y1 = fase.alto + 0.8;
  const y0 = fase.fundo - 0.3;
  const X = (x: number) => ((x - x0) / (x1 - x0)) * 160;
  const Y = (y: number) => ((y1 - y) / (y1 - y0)) * 90;
  return (
    <svg className="ponte-miniatura" viewBox="0 0 160 90" aria-hidden="true">
      <rect width="160" height="90" fill="#bfe0ef" />
      <rect x={X(0)} y={Y(fase.fundo)} width={X(fase.largura) - X(0)} height={90 - Y(fase.fundo)} fill={fase.agua === null ? '#8a6f55' : '#6f8a6b'} />
      {fase.agua !== null && <rect x={X(0)} y={Y(fase.agua)} width={X(fase.largura) - X(0)} height={90 - Y(fase.agua)} fill="#4f9fc4" opacity="0.85" />}
      {Array.from({ length: fase.pedras.length / 2 }, (_, i) => (
        <path
          key={i}
          d={`M${X(fase.pedras[i * 2] - 1.2)} 90 L${X(fase.pedras[i * 2] - 0.7)} ${Y(fase.pedras[i * 2 + 1])} L${X(fase.pedras[i * 2] + 0.7)} ${Y(fase.pedras[i * 2 + 1])} L${X(fase.pedras[i * 2] + 1.2)} 90 Z`}
          fill="#8d877f"
        />
      ))}
      {/* os pilares de pedra das margens (os apoios acima da pista) */}
      {Array.from({ length: fase.ancoras.length / 2 }, (_, i) => [fase.ancoras[i * 2], fase.ancoras[i * 2 + 1]]).map(([x, y]) =>
        y > 0 && (x === 0 || x === fase.largura) ? (
          <rect key={`p${x}`} x={x === 0 ? X(-0.75) : X(x)} y={Y(y + 0.45)} width={X(0.75) - X(0)} height={Y(0) - Y(y + 0.45)} fill="#9c968d" />
        ) : null,
      )}
      <rect x="0" y={Y(0)} width={X(0)} height={90 - Y(0)} fill="#a77a4f" />
      <rect x={X(fase.largura)} y={Y(0)} width={160 - X(fase.largura)} height={90 - Y(0)} fill="#a77a4f" />
      <rect x="0" y={Y(0) - 2} width={X(0)} height="3" fill="#79b35a" />
      <rect x={X(fase.largura)} y={Y(0) - 2} width={160 - X(fase.largura)} height="3" fill="#79b35a" />
      {Array.from({ length: fase.ancoras.length / 2 }, (_, i) => (
        <circle key={i} cx={X(fase.ancoras[i * 2])} cy={Y(fase.ancoras[i * 2 + 1])} r="3.2" fill="#d0524c" stroke="#fff3e0" strokeWidth="1" />
      ))}
    </svg>
  );
}

export function EscolhaDaPonte({ aoEscolher, aoVoltar }: { aoEscolher: (fase: string) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="ponte-escolha">
      <ul className="ponte-fases">
        {FASES.map((f, i) => (
          <li key={f.id}>
            <button type="button" className="ponte-fase-botao" aria-label={t('Fase {n} de {total}', { n: i + 1, total: FASES.length })} onClick={() => aoEscolher(f.id)}>
              <MiniaturaDaPonte fase={f} />
              <strong>{i + 1}</strong>
            </button>
          </li>
        ))}
      </ul>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </div>
  );
}

// =====================================================================================================================
// O QUE A SIMULAÇÃO TOCA E MOSTRA (o teste da montagem e o fim)
// =====================================================================================================================

/** Anda a simulação pelo tempo real (passos fixos), toca os sons e dá os estilhaços ao desenho. */
function avancar(s: Sim, d: VistaDaPonte | null, conta: { acumulado: number; rangido: number }, dt: number, agora: number) {
  if (s.terminou) return;
  conta.acumulado += dt;
  let n = 0;
  while (conta.acumulado >= PASSO && n < 6 && !s.terminou) {
    passo(s);
    d?.ouvir(s);
    for (const ev of s.eventos) {
      if (ev.tipo === 'quebrou') tocar('quebra');
      else if (ev.tipo === 'chegou') tocar('chegada');
      else if (ev.tipo === 'caiu') tocar(s.fase.agua === null ? 'queda' : 'agua');
    }
    conta.acumulado -= PASSO;
    n++;
  }
  if (n === 6) conta.acumulado = 0;
  let pior = 0;
  for (const b of s.barras) if (b.inteira && b.esforco > pior) pior = b.esforco;
  if (pior > 0.85 && agora - conta.rangido > 700) {
    conta.rangido = agora;
    tocar('rangido');
  }
}

function ResultadoDaSimulacao({ passou, progresso, custo }: { passou: boolean; progresso: number; custo: number }) {
  const t = useT();
  return passou ? (
    <span className="ponte-resultado passou">
      <Check size={16} aria-hidden="true" /> {t('Passou!')} <Coins size={14} aria-hidden="true" /> {custo}
    </span>
  ) : (
    <span className="ponte-resultado caiu">{t('{n}% do caminho', { n: Math.floor(progresso / 10) })}</span>
  );
}

// =====================================================================================================================
// A MONTAGEM
// =====================================================================================================================

const noDe = (x: number, y: number) => `${x},${y}`;

interface Interacao {
  origem: [number, number] | null;
  /** Começou arrastando de um nó (soltar põe a peça e acaba); senão, é a corrente de cliques. */
  arrastando: boolean;
  /** Onde o botão desceu (soltar no mesmo ponto não é arrastar). */
  desceuEm: [number, number] | null;
  mouse: [number, number] | null;
  cursor: [number, number];
  teclado: boolean;
}

function Montagem({
  fase,
  solo,
  contagemMs,
  montagemMs,
  aoMandar,
}: {
  fase: Fase;
  solo: boolean;
  contagemMs: number;
  montagemMs: number;
  aoMandar: (pecas: number[]) => void;
}) {
  const t = useT();
  const tela = useRef<HTMLDivElement>(null);
  const { caixa3d, tela2d, vista: desenho, modo } = useVistaDaPonte(fase);
  const [pecas, setPecasEstado] = useState<number[]>([]);
  const pecasRef = useRef<number[]>([]);
  const historico = useRef<number[][]>([]);
  const [tipo, setTipo] = useState(PISTA);
  const tipoRef = useRef(PISTA);
  tipoRef.current = tipo;
  const [apagar, setApagar] = useState(false);
  const apagarRef = useRef(false);
  apagarRef.current = apagar;
  const [teste, setTeste] = useState<Sim | null>(null);
  const testeRef = useRef<Sim | null>(null);
  testeRef.current = teste;
  const [resultadoDoTeste, setResultadoDoTeste] = useState<{ passou: boolean; progresso: number; custo: number } | null>(null);
  const [relogio, setRelogio] = useState({ contagem: Math.ceil(contagemMs / 1000), restante: montagemMs });
  const contandoRef = useRef(contagemMs > 0);
  const mandou = useRef(false);
  const mandarRef = useRef(aoMandar);
  mandarRef.current = aoMandar;
  const { pausa, pausado, continuar } = usePausaComEsc(solo);
  const io = useRef<Interacao>({ origem: null, arrastando: false, desceuEm: null, mouse: null, cursor: [fase.ancoras[0], fase.ancoras[1]], teclado: false });
  const [, redesenhar] = useState(0);

  const setPecas = (novas: number[], guardar = true) => {
    if (guardar) historico.current.push(pecasRef.current);
    pecasRef.current = novas;
    setPecasEstado(novas);
  };

  const mandar = () => {
    if (mandou.current) return;
    mandou.current = true;
    tocar('fim');
    mandarRef.current(semSoltas(fase, pecasRef.current));
  };

  const parado = () => contandoRef.current || mandou.current || testeRef.current !== null || pausa.ativa;

  // ---- o relógio: na sala, o real (o do servidor); no Solo, só anda com a janela em foco e sem pausa ----
  useEffect(() => {
    let decorrido = 0;
    let antes = performance.now();
    const total = contagemMs + montagemMs;
    const id = setInterval(() => {
      const agora = performance.now();
      const dt = agora - antes;
      antes = agora;
      if (!solo || (!document.hidden && document.hasFocus() && !pausa.ativa)) decorrido += dt;
      const contagem = Math.max(0, Math.ceil((contagemMs - decorrido) / 1000));
      contandoRef.current = decorrido < contagemMs;
      const restante = Math.max(0, total - Math.max(decorrido, contagemMs));
      setRelogio((r) => (r.contagem === contagem && Math.ceil(r.restante / 1000) === Math.ceil(restante / 1000) ? r : { contagem, restante }));
      if (decorrido >= total) {
        clearInterval(id);
        mandar();
      }
    }, 100);
    return () => clearInterval(id);
    // o relógio nasce uma vez por partida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- o desenho (um quadro por vez, na vista que estiver aberta: o 3D, ou o 2D de reserva) ----
  useEffect(() => {
    let viva = true;
    let id = 0;
    let ultimo = performance.now();
    const conta = { acumulado: 0, rangido: 0 };
    const quadro = () => {
      if (!viva) return;
      id = requestAnimationFrame(quadro);
      const agora = performance.now();
      const dt = Math.min(0.1, (agora - ultimo) / 1000);
      ultimo = agora;
      // sem foco (o jogo de verdade, outra janela), escondida ou pausada: nada se mexe
      if (document.hidden || !document.hasFocus() || pausa.ativa) return;
      const d = desenho.current;
      const s = testeRef.current;
      if (s) {
        const terminou = s.terminou;
        avancar(s, d, conta, dt, agora);
        if (import.meta.env.DEV) window.ponteDoTeste = s;
        d?.simulacao(s, agora);
        if (!terminou && s.terminou) setResultadoDoTeste({ passou: s.passou, progresso: s.progresso, custo: s.custo });
        return;
      }
      if (!d) return;
      const i = io.current;
      const alvo = i.origem ? alvoDe(i) : null;
      const sobre = i.mouse && !i.teclado ? pontoEm(i.mouse) : null;
      d.montagem(pecasRef.current, {
        agora,
        origem: i.origem,
        cursor: i.teclado ? i.cursor : null,
        sobre: sobre && cabe(fase, sobre[0], sobre[1]) ? sobre : null,
        fantasma: i.origem && alvo ? { ax: i.origem[0], ay: i.origem[1], bx: alvo[0], by: alvo[1], tipo: tipoRef.current, valida: podeLigar(i.origem, alvo, tipoRef.current) } : null,
        apagando: apagarRef.current && i.mouse ? pecaEm(i.mouse[0], i.mouse[1]) : -1,
      });
    };
    id = requestAnimationFrame(quadro);
    if (import.meta.env.DEV) {
      window.ponteMontar = (lista) => setPecas(semSoltas(fase, lista ?? pontePronta(fase)));
      window.ponteParaTela = (x, y) => desenho.current?.paraTela(x, y) ?? [0, 0];
    }
    return () => {
      viva = false;
      cancelAnimationFrame(id);
      if (import.meta.env.DEV) window.ponteMontar = window.ponteParaTela = undefined;
    };
    // a cena nasce uma vez por fase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  // ---- as contas da montagem ----
  const nos = () => {
    const s = new Set<string>();
    for (let i = 0; i < fase.ancoras.length; i += 2) s.add(noDe(fase.ancoras[i], fase.ancoras[i + 1]));
    const p = pecasRef.current;
    for (let i = 0; i + 4 < p.length; i += 5) {
      s.add(noDe(p[i], p[i + 1]));
      s.add(noDe(p[i + 2], p[i + 3]));
    }
    return s;
  };
  const repetida = (a: [number, number], b: [number, number]) => {
    const p = pecasRef.current;
    for (let i = 0; i + 4 < p.length; i += 5)
      if ((p[i] === a[0] && p[i + 1] === a[1] && p[i + 2] === b[0] && p[i + 3] === b[1]) || (p[i] === b[0] && p[i + 1] === b[1] && p[i + 2] === a[0] && p[i + 3] === a[1]))
        return true;
    return false;
  };
  const podeLigar = (a: [number, number], b: [number, number], tp: number) =>
    !(a[0] === b[0] && a[1] === b[1]) && cabe(fase, b[0], b[1]) && pecaCabe(tp, a[0], a[1], b[0], b[1]) && !repetida(a, b) && pecasRef.current.length / 5 < MAX_PECAS;
  /** Para onde a peça vai: com o mouse, o ponto alcançável mais perto dele (a peça "estica" até o limite); com o teclado, o cursor. */
  function alvoDe(i: Interacao): [number, number] | null {
    if (!i.origem) return null;
    if (i.teclado || !i.mouse) return i.cursor;
    const [ox, oy] = i.origem;
    const [mx, my] = i.mouse;
    let melhor: [number, number] | null = null;
    let dist = Infinity;
    for (let x = ox - 4; x <= ox + 4; x++)
      for (let y = oy - 4; y <= oy + 4; y++) {
        if ((x === ox && y === oy) || !cabe(fase, x, y) || !pecaCabe(tipoRef.current, ox, oy, x, y)) continue;
        const d = (x - mx) * (x - mx) + (y - my) * (y - my);
        if (d < dist) {
          dist = d;
          melhor = [x, y];
        }
      }
    // perto da própria origem, ainda não é peça nenhuma
    const d0 = (ox - mx) * (ox - mx) + (oy - my) * (oy - my);
    return d0 < 0.16 ? null : melhor;
  }
  function pecaEm(x: number, y: number): number {
    const p = pecasRef.current;
    let melhor = -1;
    let dist = 0.3 * 0.3;
    for (let i = 0; i + 4 < p.length; i += 5) {
      const ax = p[i];
      const ay = p[i + 1];
      const dx = p[i + 2] - ax;
      const dy = p[i + 3] - ay;
      const l2 = dx * dx + dy * dy;
      let k = ((x - ax) * dx + (y - ay) * dy) / l2;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const ex = ax + k * dx - x;
      const ey = ay + k * dy - y;
      const d = ex * ex + ey * ey;
      if (d < dist) {
        dist = d;
        melhor = i / 5;
      }
    }
    return melhor;
  }
  const ligar = (a: [number, number], b: [number, number]) => {
    if (!podeLigar(a, b, tipoRef.current)) {
      tocar('erro');
      return false;
    }
    setPecas([...pecasRef.current, a[0], a[1], b[0], b[1], tipoRef.current]);
    tocar('encaixe');
    return true;
  };
  const tirar = (indice: number) => {
    if (indice < 0) return;
    const p = pecasRef.current.slice();
    p.splice(indice * 5, 5);
    // o que ficou sem ligação a um apoio cai junto
    setPecas(semSoltas(fase, p));
    tocar('quebra');
  };
  const desfazer = () => {
    const antes = historico.current.pop();
    if (antes) setPecas(antes, false);
  };
  const testar = () => {
    if (contandoRef.current || mandou.current) return;
    if (testeRef.current) {
      setTeste(null);
      setResultadoDoTeste(null);
      return;
    }
    io.current.origem = null;
    setResultadoDoTeste(null);
    setTeste(montar(fase, semSoltas(fase, pecasRef.current)));
  };

  // ---- o mouse e o toque ----
  const noMundo = (ev: React.PointerEvent<HTMLDivElement>): [number, number] | null => {
    const c = tela.current;
    const d = desenho.current;
    if (!c || !d) return null;
    const r = c.getBoundingClientRect();
    return d.paraMundo(((ev.clientX - r.left) / r.width) * LARGURA, ((ev.clientY - r.top) / r.height) * ALTURA);
  };
  const pontoEm = (m: [number, number]): [number, number] | null => {
    const x = Math.round(m[0]);
    const y = Math.round(m[1]);
    return (x - m[0]) * (x - m[0]) + (y - m[1]) * (y - m[1]) < 0.42 * 0.42 ? [x, y] : null;
  };
  const desceu = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (parado()) return;
    const m = noMundo(ev);
    if (!m) return;
    const i = io.current;
    i.teclado = false;
    i.mouse = m;
    if (ev.button === 2) {
      if (i.origem) i.origem = null;
      else tirar(pecaEm(m[0], m[1]));
      return;
    }
    if (apagarRef.current) {
      tirar(pecaEm(m[0], m[1]));
      return;
    }
    tela.current?.setPointerCapture(ev.pointerId);
    const p = pontoEm(m);
    if (!i.origem) {
      if (p && nos().has(noDe(p[0], p[1]))) {
        i.origem = p;
        i.arrastando = true;
        i.desceuEm = p;
      }
      return;
    }
    // a corrente: com uma origem escolhida, o clique vale no soltar
    i.arrastando = false;
    i.desceuEm = p;
  };
  const moveu = (ev: React.PointerEvent<HTMLDivElement>) => {
    const m = noMundo(ev);
    if (m) io.current.mouse = m;
  };
  const subiu = (ev: React.PointerEvent<HTMLDivElement>) => {
    const i = io.current;
    if (parado() || !i.origem || ev.button === 2 || apagarRef.current) return;
    const m = noMundo(ev);
    if (!m) return;
    i.mouse = m;
    const p = pontoEm(m);
    const naOrigem = p && p[0] === i.origem[0] && p[1] === i.origem[1];
    if (naOrigem) {
      // clicou no nó e soltou nele: fica escolhido (a corrente); clicou de novo nele: desiste
      if (!i.arrastando) i.origem = null;
      i.arrastando = false;
      return;
    }
    const alvo = alvoDe(i);
    if (alvo && ligar(i.origem, alvo)) i.origem = i.arrastando ? null : alvo;
    else if (i.arrastando) i.origem = null;
    i.arrastando = false;
  };

  // ---- o teclado ----
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = ev.key.toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && k === 'z') {
        ev.preventDefault();
        if (!parado()) desfazer();
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (k === 't' && !ev.repeat) {
        ev.preventDefault();
        testar();
        return;
      }
      if (parado()) return;
      const i = io.current;
      if (k === '1' || k === '2' || k === '3') {
        setTipo(Number(k) - 1);
        setApagar(false);
        return;
      }
      if (k === 'z' && !ev.repeat) {
        desfazer();
        return;
      }
      const mover: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, 1], arrowdown: [0, -1] };
      if (mover[k]) {
        ev.preventDefault();
        const [dx, dy] = mover[k];
        const x = Math.max(0, Math.min(fase.largura, i.cursor[0] + dx));
        const y = Math.max(Math.min(fase.baixo, ...ancorasY()), Math.min(Math.max(fase.alto, ...ancorasY()), i.cursor[1] + dy));
        i.cursor = [x, y];
        i.teclado = true;
        redesenhar((n) => n + 1);
        return;
      }
      if (k === 'enter' || k === ' ') {
        ev.preventDefault();
        i.teclado = true;
        if (!i.origem) {
          if (nos().has(noDe(i.cursor[0], i.cursor[1]))) i.origem = [i.cursor[0], i.cursor[1]];
          else tocar('erro');
        } else if (i.cursor[0] === i.origem[0] && i.cursor[1] === i.origem[1]) i.origem = null;
        else if (ligar(i.origem, i.cursor)) i.origem = [i.cursor[0], i.cursor[1]];
        return;
      }
      if (k === 'delete' || k === 'backspace') {
        ev.preventDefault();
        if (i.origem) {
          i.origem = null;
          return;
        }
        // a última peça que chega no nó do cursor
        const p = pecasRef.current;
        for (let j = p.length - 5; j >= 0; j -= 5)
          if ((p[j] === i.cursor[0] && p[j + 1] === i.cursor[1]) || (p[j + 2] === i.cursor[0] && p[j + 3] === i.cursor[1])) {
            tirar(j / 5);
            return;
          }
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
    // as funções leem tudo por referência
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ancorasY = () => fase.ancoras.filter((_, i) => i % 2 === 1);

  const seg = Math.ceil(relogio.restante / 1000);
  const total = custoDe(pecas);
  // os comandos, dentro da tela, só na contagem e nos primeiros 4 segundos (depois, os botões já dizem tudo)
  const ajuda = (relogio.contagem > 0 || relogio.restante > montagemMs - 4000) && teste === null;
  return (
    <div className="ponte">
      <div className="ponte-moldura">
        <TelaDaPonte
          ref={tela}
          caixa3d={caixa3d}
          tela2d={tela2d}
          modo={modo}
          className={apagar ? 'apagando' : undefined}
          onPointerDown={desceu}
          onPointerMove={moveu}
          onPointerUp={subiu}
          onPointerLeave={() => (io.current.mouse = null)}
        />
        <div className="ponte-painel" aria-hidden="true">
          <span className={`ponte-relogio${seg <= 5 ? ' acabando' : ''}`}>{`0:${String(seg).padStart(2, '0')}`}</span>
          <span className="ponte-custo">
            <Coins size={15} aria-hidden="true" /> {total}
          </span>
          {resultadoDoTeste && <ResultadoDaSimulacao {...resultadoDoTeste} />}
        </div>
        {relogio.contagem > 0 && <span className="ponte-contagem">{relogio.contagem}</span>}
        {ajuda && !pausado && (
          <div className="ponte-ajuda">
            <ComandosDoJogo
              itens={[
                { teclas: ['mouse-arrastar', 'setas'], toque: 'toque-arrastar', rotulo: t('Montar') },
                { teclas: ['mouse-direito'], rotulo: t('Apagar') },
                { teclas: ['z'], rotulo: t('Desfazer') },
                ...(solo ? [comandoDaPausa(t)] : []),
              ]}
            />
          </div>
        )}
        <div className="ponte-barra">
          <div className="ponte-pecas" role="radiogroup" aria-label={t('Ponte')}>
            {PECAS.map((p, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={tipo === i && !apagar}
                aria-label={t(NOMES_DAS_PECAS[i])}
                className={`ponte-peca-botao${tipo === i && !apagar ? ' escolhida' : ''}`}
                disabled={teste !== null}
                onClick={() => {
                  setTipo(i);
                  setApagar(false);
                }}
              >
                <span className={`ponte-amostra tipo-${i}`} aria-hidden="true" />
                <span className="ponte-rotulo" aria-hidden="true">
                  {t(NOMES_DAS_PECAS[i])}
                </span>
                <small aria-hidden="true">
                  <Coins size={11} /> {p.preco}
                </small>
                <kbd aria-hidden="true">{i + 1}</kbd>
              </button>
            ))}
            <button
              type="button"
              className={`ponte-peca-botao${apagar ? ' escolhida' : ''}`}
              aria-pressed={apagar}
              aria-label={t('Apagar')}
              disabled={teste !== null}
              onClick={() => setApagar((a) => !a)}
            >
              <Eraser size={16} aria-hidden="true" />
              <span className="ponte-rotulo" aria-hidden="true">
                {t('Apagar')}
              </span>
            </button>
          </div>
          <div className="ponte-acoes">
            <button type="button" className="ponte-acao" aria-label={t('Desfazer')} disabled={teste !== null || pecas.length === 0} onClick={desfazer}>
              <Undo2 size={16} aria-hidden="true" />
              <span className="ponte-rotulo" aria-hidden="true">
                {t('Desfazer')}
              </span>
            </button>
            <button type="button" className="ponte-acao" aria-label={teste ? t('Montar') : t('Testar')} onClick={testar}>
              {teste ? <Hammer size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              <span className="ponte-rotulo" aria-hidden="true">
                {teste ? t('Montar') : t('Testar')}
              </span>
            </button>
            <button type="button" className="ponte-acao principal" aria-label={t('Pronto')} onClick={mandar}>
              <Check size={16} aria-hidden="true" />
              <span className="ponte-rotulo" aria-hidden="true">
                {t('Pronto')}
              </span>
            </button>
          </div>
        </div>
        {pausado && <TelaDePausa aoContinuar={continuar} />}
      </div>
    </div>
  );
}

/**
 * A caixa da tela (16:9), onde o mouse e o toque são lidos: dentro, o 3D (a cena põe o canvas dela) ou o canvas do 2D de reserva.
 * Enquanto o 3D carrega, só a cor do céu dele.
 */
const TelaDaPonte = forwardRef<
  HTMLDivElement,
  {
    caixa3d: React.RefObject<HTMLDivElement | null>;
    tela2d: React.RefObject<HTMLCanvasElement | null>;
    modo: 'carregando' | '3d' | '2d';
    className?: string;
  } & Pick<React.HTMLAttributes<HTMLDivElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerLeave'>
>(function TelaDaPonte({ caixa3d, tela2d, modo, className, ...eventos }, ref) {
  return (
    <div
      ref={ref}
      className={`ponte-tela${className ? ' ' + className : ''}`}
      data-modo={modo}
      style={{ background: COR_DO_FUNDO }}
      onContextMenu={(ev) => ev.preventDefault()}
      {...eventos}
    >
      {modo === '2d' ? <canvas ref={tela2d} className="ponte-tela-2d" width={LARGURA} height={ALTURA} /> : <div ref={caixa3d} className="ponte-3d" />}
    </div>
  );
});

// =====================================================================================================================
// O FIM: a ponte de cada um passando, e o placar
// =====================================================================================================================

function Reprise({ fase, pecas }: { fase: Fase; pecas: number[] }) {
  const { caixa3d, tela2d, vista, modo } = useVistaDaPonte(fase);
  useEffect(() => {
    let s = montar(fase, pecas);
    let viva = true;
    let id = 0;
    let ultimo = performance.now();
    let acabouEm = 0;
    const conta = { acumulado: 0, rangido: 0 };
    const quadro = () => {
      if (!viva) return;
      id = requestAnimationFrame(quadro);
      const agora = performance.now();
      const dt = Math.min(0.1, (agora - ultimo) / 1000);
      ultimo = agora;
      if (document.hidden || !document.hasFocus()) return;
      // a reprise começa quando a cena abriu (senão a ponte já teria passado quando ela aparecesse)
      const d = vista.current;
      if (!d) return;
      avancar(s, d, conta, dt, agora);
      if (import.meta.env.DEV) window.ponteDoTeste = s;
      d.simulacao(s, agora);
      // acabou: mais um tempinho na tela e começa de novo
      if (s.terminou && !acabouEm) acabouEm = agora;
      if (acabouEm && agora - acabouEm > 2500) {
        s = montar(fase, pecas);
        acabouEm = 0;
      }
    };
    id = requestAnimationFrame(quadro);
    return () => {
      viva = false;
      cancelAnimationFrame(id);
    };
    // a vista é lida por referência a cada quadro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, pecas]);
  return <TelaDaPonte caixa3d={caixa3d} tela2d={tela2d} modo={modo} />;
}

function Resultados({ estado, fase, eu, minhas, fim }: { estado: EstadoPonte; fase: Fase; eu: number; minhas: number[] | null; fim: boolean }) {
  const t = useT();
  const comPonte = estado.placar.filter((l) => estado.pontes.some((p) => p.userId === l.userId));
  const [vendo, setVendo] = useState<number | null>(null);
  // no fim, a vencedora primeiro; antes, a minha
  const quem = fim ? (vendo ?? comPonte[0]?.userId ?? eu) : eu;
  const pecas = estado.pontes.find((p) => p.userId === quem)?.pecas ?? (quem === eu ? minhas : null);
  const linhas = estado.placar.filter((l) => l.mandou);
  const nomeDeQuem = estado.placar.find((l) => l.userId === quem)?.username;
  return (
    <div className="ponte ponte-fim">
      <div className="ponte-moldura">
        {pecas ? <Reprise key={`${quem}`} fase={fase} pecas={pecas} /> : <div className="ponte-tela ponte-vazia" />}
        <div className="ponte-painel">
          {fim && linhas.length > 1 && nomeDeQuem && <span className="ponte-de-quem minijogo-nome">{nomeDeQuem}</span>}
          {estado.meu && quem === eu && <ResultadoDaSimulacao {...estado.meu} />}
        </div>
      </div>
      {estado.recorde &&
        (estado.recorde.novo ? (
          <p className="minijogo-situacao ponte-recorde">{t('Novo recorde!')}</p>
        ) : (
          estado.recorde.antes !== null && (
            <p className="minijogo-situacao">
              <Coins size={14} aria-hidden="true" /> {t('Seu recorde: {tempo}', { tempo: estado.recorde.antes })}
            </p>
          )
        ))}
      {linhas.length > 1 && (
        <ol className="ponte-placar">
          {linhas.map((l) => (
            <li key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
              <button type="button" aria-pressed={quem === l.userId} disabled={!fim} onClick={() => setVendo(l.userId)}>
                <span className="ponte-placar-pos">{l.posicao ?? '–'}</span>
                <span className="minijogo-nome">{l.username}</span>
                {l.passou ? (
                  <strong>
                    <Coins size={13} aria-hidden="true" /> {l.custo}
                  </strong>
                ) : (
                  <span className="ponte-placar-caiu">{t('{n}% do caminho', { n: Math.floor(l.progresso / 10) })}</span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

