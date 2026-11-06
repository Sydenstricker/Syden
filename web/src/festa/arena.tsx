import { useEffect, useRef, type ReactNode } from 'react';
import { useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { CoelhoDeFrente, corDe, LinhaDoTempo, menosMovimento, Moldura, useAoVivo, useRelogio, type PropsDoMicro, type QuadroAoVivo, type TurmaNaTela } from './comum';

/**
 * A ARENA DA HORTA NA TELA (lote 5, 05/11/2026): o que os microjogos de empurra-empurra têm em comum (server/src/festa/
 * arena-da-horta.ts, onde está a regra e o porquê da rede). Eu ando AQUI, na hora; os outros chegam pelos quadros do servidor e
 * são desenhados ~100 ms atrás, suavizados. O empurrão mostra a área no chão desde o aperto (a minha na hora; a dos outros quando
 * o quadro chega), e quem decide quem levou e quem caiu é o servidor.
 *
 * Teclado: setas ou WASD andam, Espaço (ou Enter) empurra para onde se olha. Toque e mouse: segurar anda até o dedo; um toque
 * rápido empurra na direção dele.
 */

// Os mesmos números do servidor (server/src/festa/arena-da-horta.ts).
export const ARENA_L = 300;
export const ARENA_A = 200;
export const RAIO = 9;
export const VELOCIDADE = 95;
export const EMPURRAO_PREPARO = 500;
export const EMPURRAO_FOLGA = 150;
export const EMPURRAO_ESPERA = 1000;
export const EMPURRAO_RAIO = 20;
export const EMPURRAO_ALCANCE = 16;

/** O quadro comum: j = [id, x, y, vivo, dx×100, dy×100, pontos]; g = [id, dono, x, y, dx×100, dy×100, inicio, bate]. */
export interface QuadroDaArena {
  j: number[][];
  g: number[][];
  e: (string | number)[][];
  [extra: string]: unknown;
}

export interface DadosDaArena {
  turma?: TurmaNaTela;
}

const comprimento = (x: number, y: number) => Math.sqrt(x * x + y * y);
const normal = (x: number, y: number): [number, number] => {
  const l = comprimento(x, y);
  return l < 1e-6 ? [0, 1] : [x / l, y / l];
};
const prender = (v: number, max: number) => Math.min(max - RAIO, Math.max(RAIO, v));
/** Quanto atrás os outros são desenhados (a suavização entre os quadros). */
const ATRAS_MS = 110;

export interface PropsDaArena<D extends DadosDaArena> extends PropsDoMicro<D> {
  id: string;
  /** O nome do microjogo (com chave()), para o leitor de tela. */
  nome: string;
  duracaoMs: number;
  /** O placar em cima (o tempo em pé, as chaves…). */
  placar: (q: QuadroDaArena | null, eu: number) => string;
  /** Onde a tela deixa eu andar agora (o canteiro de hoje): devolve o ponto preso dentro. Padrão: o campo. */
  prender?: (x: number, y: number, e: number, q: QuadroDaArena | null, x0: number, y0: number) => [number, number];
  /** O chão, embaixo de todos (desenhado a cada quadro, com o tempo `e`). */
  chao: (e: number, q: QuadroDaArena | null) => ReactNode;
  /** O que vai por cima do chão e embaixo dos coelhos (as chaves, a porteira). */
  objetos?: (e: number, q: QuadroDaArena | null) => ReactNode;
  /** A minha velocidade (quem carrega a chave anda menos). */
  velocidade?: (q: QuadroDaArena | null, eu: number) => number;
  /** A cada quadro que chega (os sons do jogo: a chave pega, a porteira). */
  aoQuadro?: (q: QuadroAoVivo<QuadroDaArena>, eu: number) => void;
  /** Para o robô dos testes: a tela anda sozinha até aqui. */
  meta?: (q: QuadroDaArena | null, eu: number, x: number, y: number) => [number, number] | null;
  /** Algo a mandar a cada posição (pegar a chave): devolve a mensagem extra, ou null. */
  aoAndar?: (x: number, y: number, q: QuadroDaArena | null, eu: number) => Record<string, unknown> | null;
  /** Um enfeite em cima de alguém (a chave carregada). */
  enfeite?: (id: number, q: QuadroDaArena | null) => ReactNode;
}

interface Local {
  x: number;
  y: number;
  dx: number;
  dy: number;
  vivo: boolean;
  /** O empurrão: deslizando de (x0, y0) até (x1, y1), de `de` até `ate` (Date.now). */
  desliza: { x0: number; y0: number; x1: number; y1: number; de: number; ate: number } | null;
  /** O meu empurrão, desde o aperto (ms desde o começo) até o servidor mostrar o dele. */
  preparo: { e: number; x: number; y: number; dx: number; dy: number } | null;
  prontoEm: number;
  caiuEm: number | null;
  posicionado: boolean;
}

export function Arena<D extends DadosDaArena>(props: PropsDaArena<D>) {
  const { id, dados, inicio, ativo, lance, duracaoMs, placar, chao, objetos, aoQuadro, enfeite } = props;
  const t = useT();
  const turma = dados.turma;
  const eu = turma?.eu ?? 0;
  const linha = useRef(new LinhaDoTempo<QuadroDaArena>()).current;
  const local = useRef<Local>({ x: ARENA_L / 2, y: ARENA_A / 2, dx: 0, dy: 1, vivo: true, desliza: null, preparo: null, prontoEm: 0, caiuEm: null, posicionado: false });
  const caiuEm = useRef(new Map<number, number>());
  const saiuEm = useRef(new Map<number, number>());
  const teclas = useRef(new Set<string>());
  const dedo = useRef<{ x: number; y: number; desde: number; andou: boolean } | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const ultimoEnvio = useRef(0);
  const ultimoQuadro = useRef(Date.now());
  const props_ = useRef(props);
  props_.current = props;

  const mandar = useAoVivo<QuadroDaArena>(id, ativo, lance, (quadro) => {
    linha.chegou(quadro);
    ultimoQuadro.current = Date.now();
    const q = quadro.q;
    const eu_ = local.current;
    const meu = q.j.find((l) => l[0] === eu);
    if (meu && !eu_.posicionado) {
      // a primeira vez: começo onde o servidor me pôs
      eu_.posicionado = true;
      eu_.x = meu[1];
      eu_.y = meu[2];
      [eu_.dx, eu_.dy] = normal(meu[4], meu[5]);
    }
    for (const ev of q.e) {
      const [tipo, alvo, x, y, dono] = ev as [string, number, number, number, number];
      if (tipo === 'k') {
        if (alvo === eu) {
          eu_.desliza = { x0: eu_.x, y0: eu_.y, x1: x, y1: y, de: Date.now(), ate: Date.now() + 260 };
          eu_.prontoEm = Math.max(eu_.prontoEm, Date.now() + 450);
          tocar('soco');
        } else if (dono === eu) tocar('acerto');
      } else if (tipo === 'c') {
        caiuEm.current.set(alvo, Date.now());
        if (alvo === eu) {
          eu_.vivo = false;
          eu_.caiuEm = Date.now();
          eu_.x = x;
          eu_.y = y;
        }
        tocar('queda');
      } else if (tipo === 'g') {
        // passou (pela porteira): sai para cima, sem cair
        saiuEm.current.set(alvo, Date.now());
        if (alvo === eu) {
          eu_.vivo = false;
          eu_.caiuEm = null;
        }
        tocar('chegada');
      }
    }
    // o que o servidor não aceitou (andei rápido demais, a rede engasgou): volto para onde ele me tem
    if (meu && eu_.vivo && !eu_.desliza && comprimento(meu[1] - eu_.x, meu[2] - eu_.y) > 45) {
      eu_.x = meu[1];
      eu_.y = meu[2];
    }
    if (meu && meu[3] === 0 && eu_.vivo && !saiuEm.current.has(eu)) {
      eu_.vivo = false;
      eu_.caiuEm = Date.now();
    }
    props_.current.aoQuadro?.(quadro, eu);
  });

  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const ultimo = linha.ultimo()?.q ?? null;

  // as teclas seguradas (o andar precisa saber o que está apertado, não só o aperto)
  useEffect(() => {
    if (!ativo) return;
    const baixo = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = ev.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        teclas.current.add(k);
        ev.preventDefault();
      } else if ((k === ' ' || k === 'enter') && !ev.repeat) {
        empurrar(null);
        ev.preventDefault();
      }
    };
    const cima = (ev: KeyboardEvent) => teclas.current.delete(ev.key.toLowerCase());
    const sair = () => teclas.current.clear();
    window.addEventListener('keydown', baixo);
    window.addEventListener('keyup', cima);
    window.addEventListener('blur', sair);
    return () => {
      window.removeEventListener('keydown', baixo);
      window.removeEventListener('keyup', cima);
      window.removeEventListener('blur', sair);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  const empurrar = (para: [number, number] | null) => {
    const eu_ = local.current;
    const tempo = Date.now() - inicio;
    if (!ativo || !eu_.vivo || Date.now() < eu_.prontoEm || tempo < 0 || tempo > duracaoMs) return;
    if (props_.current.velocidade && props_.current.velocidade(linha.ultimo()?.q ?? null, eu) <= 0) return;
    let [dx, dy] = [eu_.dx, eu_.dy];
    if (para) [dx, dy] = normal(para[0] - eu_.x, para[1] - eu_.y);
    eu_.dx = dx;
    eu_.dy = dy;
    eu_.prontoEm = Date.now() + EMPURRAO_ESPERA;
    eu_.preparo = { e: tempo, x: eu_.x, y: eu_.y, dx, dy };
    mandar({ tipo: 'e', dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100, x: Math.round(eu_.x), y: Math.round(eu_.y) });
    tocar('pulo');
  };

  // o passo local: andar, deslizar, mandar a posição (a cada quadro do relógio)
  const anterior = useRef(agora);
  useEffect(() => {
    const eu_ = local.current;
    const dt = Math.min(0.1, Math.max(0, (agora - anterior.current) / 1000));
    anterior.current = agora;
    if (ativo && eu_.vivo && e >= 0 && e <= duracaoMs) {
      let vx = 0;
      let vy = 0;
      const k = teclas.current;
      if (k.has('arrowleft') || k.has('a')) vx -= 1;
      if (k.has('arrowright') || k.has('d')) vx += 1;
      if (k.has('arrowup') || k.has('w')) vy -= 1;
      if (k.has('arrowdown') || k.has('s')) vy += 1;
      if (dedo.current) {
        const ddx = dedo.current.x - eu_.x;
        const ddy = dedo.current.y - eu_.y;
        if (comprimento(ddx, ddy) > 4 && Date.now() - dedo.current.desde > 150) [vx, vy] = normal(ddx, ddy);
      }
      // o piloto automático dos testes
      const piloto = import.meta.env.DEV && (window as unknown as { festaPilotoAutomatico?: boolean }).festaPilotoAutomatico;
      if (piloto) {
        const meta = props_.current.meta?.(ultimo, eu, eu_.x, eu_.y) ?? pilotoPadrao(ultimo, eu, eu_.x, eu_.y);
        if (meta) {
          const [mx, my] = meta;
          if (comprimento(mx - eu_.x, my - eu_.y) > 6) [vx, vy] = normal(mx - eu_.x, my - eu_.y);
          const alvo = ultimo?.j.find((l) => l[0] !== eu && l[3] === 1 && comprimento(l[1] - eu_.x, l[2] - eu_.y) < 30);
          if (alvo && Date.now() >= eu_.prontoEm && Math.random() < 0.05) empurrar([alvo[1], alvo[2]]);
        }
      }
      // parado durante a minha preparação
      const preparando = eu_.preparo && e - eu_.preparo.e < EMPURRAO_PREPARO + 100;
      if (eu_.desliza) {
        const f = Math.min(1, (Date.now() - eu_.desliza.de) / (eu_.desliza.ate - eu_.desliza.de));
        eu_.x = eu_.desliza.x0 + (eu_.desliza.x1 - eu_.desliza.x0) * f;
        eu_.y = eu_.desliza.y0 + (eu_.desliza.y1 - eu_.desliza.y0) * f;
        if (f >= 1) eu_.desliza = null;
      } else if ((vx || vy) && !preparando) {
        const [nx, ny] = normal(vx, vy);
        const v = props_.current.velocidade?.(ultimo, eu) ?? VELOCIDADE;
        let x = prender(eu_.x + nx * v * dt, ARENA_L);
        let y = prender(eu_.y + ny * v * dt, ARENA_A);
        if (props_.current.prender) [x, y] = props_.current.prender(x, y, e, ultimo, eu_.x, eu_.y);
        eu_.x = x;
        eu_.y = y;
        eu_.dx = nx;
        eu_.dy = ny;
      }
      if (Date.now() - ultimoEnvio.current >= 66 && eu_.posicionado) {
        ultimoEnvio.current = Date.now();
        mandar({ tipo: 'p', x: Math.round(eu_.x * 10) / 10, y: Math.round(eu_.y * 10) / 10, dx: Math.round(eu_.dx * 100) / 100, dy: Math.round(eu_.dy * 100) / 100 });
        const extra = props_.current.aoAndar?.(eu_.x, eu_.y, ultimo, eu);
        if (extra) mandar(extra);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agora]);

  // o que está na tela: os outros, interpolados um pouco atrás
  const volta = linha.em(e - ATRAS_MS);
  const ordem = ultimo?.j.map((l) => l[0]) ?? [];
  const coelhos: { id: number; x: number; y: number; dx: number; vivo: boolean }[] = [];
  if (volta) {
    for (const a of volta.a.q.j) {
      const b = volta.b.q.j.find((l) => l[0] === a[0]) ?? a;
      if (a[0] === eu) continue;
      coelhos.push({ id: a[0], x: a[1] + (b[1] - a[1]) * volta.k, y: a[2] + (b[2] - a[2]) * volta.k, dx: b[4], vivo: (ultimo?.j.find((l) => l[0] === a[0])?.[3] ?? 1) === 1 });
    }
  }
  const eu_ = local.current;
  if (eu_.posicionado) coelhos.push({ id: eu, x: eu_.x, y: eu_.y, dx: eu_.dx, vivo: eu_.vivo });
  coelhos.sort((a, b) => a.y - b.y);

  // as áreas dos golpes: as do servidor, e a minha desde o aperto
  const golpes = (ultimo?.g ?? []).map((g) => ({ id: g[0], dono: g[1], x: g[2], y: g[3], dx: g[4] / 100, dy: g[5] / 100, inicio: g[6], bate: g[7] }));
  if (eu_.preparo && !golpes.some((g) => g.dono === eu) && e - eu_.preparo.e < EMPURRAO_PREPARO + 250) {
    const p = eu_.preparo;
    golpes.push({ id: -1, dono: eu, x: p.x, y: p.y, dx: p.dx, dy: p.dy, inicio: p.e, bate: p.e + EMPURRAO_PREPARO + 120 });
  }

  const ponto = (ev: React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * ARENA_L, ((ev.clientY - r.top) / r.height) * ARENA_A];
  };
  const quieto = menosMovimento();

  return (
    <Moldura placar={placar(ultimo, eu)} fracao={e / duracaoMs}>
      <svg
        ref={svg}
        viewBox={`0 0 ${ARENA_L} ${ARENA_A}`}
        role="group"
        aria-label={t(props.nome)}
        style={{ width: '100%', touchAction: 'none', userSelect: 'none' }}
        onPointerDown={(ev) => {
          if (!ativo) return;
          ev.preventDefault();
          (ev.target as Element).setPointerCapture?.(ev.pointerId);
          const [x, y] = ponto(ev);
          dedo.current = { x, y, desde: Date.now(), andou: false };
        }}
        onPointerMove={(ev) => {
          if (!dedo.current) return;
          const [x, y] = ponto(ev);
          if (comprimento(x - dedo.current.x, y - dedo.current.y) > 6) dedo.current.andou = true;
          dedo.current.x = x;
          dedo.current.y = y;
        }}
        onPointerUp={() => {
          const d = dedo.current;
          dedo.current = null;
          // o toque rápido empurra para onde se tocou
          if (d && Date.now() - d.desde < 220 && !d.andou) empurrar([d.x, d.y]);
        }}
        onPointerCancel={() => (dedo.current = null)}
      >
        {chao(e, ultimo)}
        {golpes.map((g) => {
          const f = Math.min(1, Math.max(0, (e - g.inicio) / Math.max(1, g.bate - g.inicio)));
          const cx = g.x + g.dx * EMPURRAO_ALCANCE;
          const cy = g.y + g.dy * EMPURRAO_ALCANCE;
          return (
            <g key={g.id} pointerEvents="none">
              <circle cx={cx} cy={cy} r={EMPURRAO_RAIO + RAIO} fill="#e0604f" opacity={0.12 + 0.25 * f} />
              <circle cx={cx} cy={cy} r={(EMPURRAO_RAIO + RAIO) * f} fill="none" stroke="#c0392b" strokeWidth="2" opacity={0.8} />
              <path
                d={`M${g.x + g.dx * 8} ${g.y + g.dy * 8} L${cx + g.dx * 14} ${cy + g.dy * 14}`}
                stroke="#c0392b"
                strokeWidth="3"
                strokeLinecap="round"
                opacity={0.7}
              />
            </g>
          );
        })}
        {objetos?.(e, ultimo)}
        {coelhos.map((c) => {
          const saiu = saiuEm.current.get(c.id);
          if (saiu !== undefined) {
            // quem passou sobe e some
            const fs = Math.min(1, (Date.now() - saiu) / 500);
            if (fs >= 1) return null;
            return (
              <g key={c.id} transform={`translate(${c.x} ${c.y - fs * 20})`} opacity={1 - fs} pointerEvents="none">
                <CoelhoDeFrente escala={0.8} />
              </g>
            );
          }
          const caiu = c.id === eu ? eu_.caiuEm : (caiuEm.current.get(c.id) ?? (c.vivo ? null : 0));
          const f = caiu === null ? (c.vivo ? 0 : 1) : caiu === 0 ? 1 : Math.min(1, (Date.now() - caiu) / 600);
          if (f >= 1) return null;
          const cor = corDe(turma, c.id, ordem);
          const preparando = golpes.some((g) => g.dono === c.id && e < g.bate);
          const nome = turma?.nomes[c.id] ?? '';
          const escala = 0.8 * (1 - f * 0.8);
          return (
            <g key={c.id} transform={`translate(${c.x} ${c.y + f * 18})`} opacity={1 - f} pointerEvents="none">
              <ellipse cx="0" cy="1" rx="12" ry="5" fill={cor} opacity={c.id === eu ? 0.95 : 0.7} stroke={c.id === eu ? '#fff' : 'none'} strokeWidth="1.5" />
              <g transform={`scale(${c.dx < 0 ? -1 : 1} ${preparando && !quieto ? 0.86 : 1})`}>
                <CoelhoDeFrente escala={escala} />
              </g>
              {enfeite?.(c.id, ultimo)}
              <text y={-33} textAnchor="middle" fontSize="8" fontWeight={c.id === eu ? 700 : 400} fill="#3a2e2a" stroke="#fffaf0" strokeWidth="2.5" paintOrder="stroke">
                {nome}
              </text>
            </g>
          );
        })}
      </svg>
    </Moldura>
  );
}

/** O piloto automático (só nos testes da tela): vai para o centro e empurra quem chegar perto. */
function pilotoPadrao(q: QuadroDaArena | null, eu: number, x: number, y: number): [number, number] | null {
  const alvo = q?.j.filter((l) => l[0] !== eu && l[3] === 1).sort((a, b) => comprimento(a[1] - x, a[2] - y) - comprimento(b[1] - x, b[2] - y))[0];
  if (!alvo) return [ARENA_L / 2, ARENA_A / 2];
  return [(alvo[1] + ARENA_L / 2) / 2, (alvo[2] + ARENA_A / 2) / 2];
}

/** O placar de quem sobrevive: o tempo em pé (ou o de quando caí). */
export function placarDeSobrevivencia(q: QuadroDaArena | null, eu: number) {
  const vivos = q ? q.j.filter((l) => l[3] === 1).length : 0;
  const meu = q?.j.find((l) => l[0] === eu);
  return `${meu && meu[3] === 0 ? '💫' : '🐰'} × ${vivos}`;
}
