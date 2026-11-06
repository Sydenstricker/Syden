import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { idiomaAtual } from '../i18n';

/**
 * O QUE TODA TELA DE MICROJOGO DA FESTA USA (05/11/2026): o contrato `MicrojogoDaTela`, o relógio, as teclas e os formatos.
 * O guia de como fazer um microjogo novo está no topo de server/src/festa/registro.ts; o registro do site é ./registro.ts.
 */

export interface PropsDoMicro<D = Record<string, unknown>> {
  /** Os dados prontos do microjogo, como o servidor os manda (iguais para todos). */
  dados: D;
  /** Quando o jogo começa, no relógio deste computador (Date.now). Tudo o que se mede é "ms desde o começo". */
  inicio: number;
  /** Valendo: sou jogador, a rodada está correndo e ainda não mandei o resultado. */
  ativo: boolean;
  /** O resultado, uma vez só (o primeiro é o que vale). */
  enviar: (corpo: Record<string, unknown>) => void;
  /** Uma ação AO VIVO (cada acerto, cada pulo), na hora: o servidor confere no relógio dele. */
  lance: (corpo: Record<string, unknown>) => void;
  /** O sinal saiu (o saque). */
  sinal: boolean;
  /** A resposta certa, só na revelação (os copos). */
  resposta: number | null;
}

export interface MicrojogoDaTela<D = Record<string, unknown>> {
  /** O id, o mesmo do servidor (server/src/festa/<id>.ts). */
  id: string;
  /** O nome e a dica do "prepare-se", com chave(): UMA frase curta, sem marcar o gênero de quem lê. */
  nome: string;
  dica: string;
  /** A tela do jogo. */
  Tela: (props: PropsDoMicro<D>) => ReactElement;
  /** O valor da revelação, formatado (a reação em ms, "🥕 × 3"…). */
  valor: (v: number, f: Formatos) => string;
  /** 'errou' mostra o valor (zero acertos) em vez de "Errou". */
  errouComValor?: boolean;
  /** A tela continua na revelação (os copos mostram onde estava a cenoura). */
  naRevelacao?: boolean;
}

/** Ajuda a escrever uma tela com os tipos certos. */
export const microjogoDaTela = <D,>(m: MicrojogoDaTela<D>): MicrojogoDaTela<D> => m;

/** O relógio da tela, a cada quadro, enquanto ligado (com a janela escondida, o navegador não dá quadros: não desenha). */
export function useRelogio(ligado: boolean) {
  const [agora, setAgora] = useState(Date.now);
  useEffect(() => {
    if (!ligado) return;
    let id = 0;
    const passo = () => {
      setAgora(Date.now());
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [ligado]);
  return agora;
}

/** As teclas enquanto o jogo está valendo (fora dos campos de texto, sem a repetição da tecla segurada). */
export function useTeclas(ligado: boolean, aoApertar: (e: KeyboardEvent) => boolean) {
  const ref = useRef(aoApertar);
  ref.current = aoApertar;
  useEffect(() => {
    if (!ligado) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      if (ref.current(e)) e.preventDefault();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [ligado]);
}

export const ehAperto = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';

/** Prefere menos movimento (o sistema pede): as animações de enfeite param; o jogo continua. */
export const menosMovimento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useFormatos() {
  const idioma = idiomaAtual();
  const [f] = useState(() => ({
    ms: new Intl.NumberFormat(idioma, { style: 'unit', unit: 'millisecond', unitDisplay: 'short', maximumFractionDigits: 0 }),
    s: new Intl.NumberFormat(idioma, { style: 'unit', unit: 'second', unitDisplay: 'short', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    numero: new Intl.NumberFormat(idioma, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct: new Intl.NumberFormat(idioma, { style: 'percent', maximumFractionDigits: 1 }),
    inteiro: new Intl.NumberFormat(idioma, { maximumFractionDigits: 0 }),
  }));
  return f;
}
export type Formatos = ReturnType<typeof useFormatos>;

/**
 * A MOLDURA dos microjogos de 05/11: em cima, o placar de quem joga e a barra do tempo que falta (as classes do Tiro ao alvo);
 * embaixo, o jogo. `fracao` é o que já passou, de 0 a 1.
 */
export function Moldura({ placar, fracao, children }: { placar: string; fracao: number; children: ReactNode }) {
  return (
    <div className="festa-alvo">
      <div className="festa-alvo-topo">
        <span className="festa-mostrador">{placar}</span>
        <span className="festa-alvo-tempo" aria-hidden="true">
          <span style={{ width: `${(1 - Math.min(1, Math.max(0, fracao))) * 100}%` }} />
        </span>
      </div>
      {children}
    </div>
  );
}

// ================================ AS EQUIPES E O CANAL AO VIVO (lote 5, 05/11/2026) ================================
// O guia está em server/src/festa/registro.ts, "O CONTATO AO VIVO E AS EQUIPES".

/**
 * QUEM É QUEM, nos dados do microjogo ao vivo ou de equipes: a rodada do servidor põe isto em `dados.turma` (a tela não tem
 * outro jeito de saber quem é ela mesma, nem os nomes).
 */
export interface TurmaNaTela {
  eu: number;
  /** As equipes (cada uma a lista de ids), ou null: cada um por si. */
  equipes: number[][] | null;
  robos: number[];
  nomes: Record<string, string>;
}

/** As cores das equipes (e de cada um, no cada-um-por-si), na ordem. Fortes o bastante para o anel no chão. */
export const CORES_DAS_EQUIPES = ['#e0604f', '#4f8fe0', '#e8b33c', '#5bb36a', '#a46ad8', '#e07fb8', '#3fb8b0', '#8a8a8a'];

/** A cor de alguém: a da equipe, ou a da posição na lista de jogadores. */
export function corDe(turma: TurmaNaTela | undefined, quem: number, ordem: number[]): string {
  const e = turma?.equipes?.findIndex((eq) => eq.includes(quem)) ?? -1;
  if (e >= 0) return CORES_DAS_EQUIPES[e % CORES_DAS_EQUIPES.length];
  const i = ordem.indexOf(quem);
  return CORES_DAS_EQUIPES[(i < 0 ? 0 : i) % CORES_DAS_EQUIPES.length];
}

/**
 * AS EQUIPES NA TELA: uma faixa com a cor e os nomes de cada equipe, a minha marcada. Sem texto nenhum além dos nomes; vai em
 * cima do jogo, dentro da `Moldura` (como `children`) ou fora dela.
 */
export function FaixaDasEquipes({ turma, pontos }: { turma: TurmaNaTela | undefined; pontos?: (number | string)[] }) {
  if (!turma?.equipes) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', margin: '4px 0' }}>
      {turma.equipes.map((eq, i) => {
        const minha = eq.includes(turma.eu);
        return (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 999,
              border: `2px solid ${CORES_DAS_EQUIPES[i % CORES_DAS_EQUIPES.length]}`,
              background: minha ? CORES_DAS_EQUIPES[i % CORES_DAS_EQUIPES.length] : 'transparent',
              color: minha ? '#fff' : 'inherit',
              fontSize: 13,
              fontWeight: minha ? 700 : 400,
            }}
          >
            {eq.map((id) => turma.nomes[id] ?? '?').join(' + ')}
            {pontos?.[i] !== undefined && <strong style={{ marginLeft: 4 }}>{pontos[i]}</strong>}
          </span>
        );
      })}
    </div>
  );
}

/**
 * O CANAL AO VIVO: o tempo real do motor ('minijogo:tempo-real' na sala, 'minijogo-solo:tempo-real' no Solo). Quem monta o
 * painel dos jogos liga o canal uma vez (`ligarCanalDaFesta(canalDoSocket(socket, channelId))`, ou `null` no Solo para o
 * canal do Solo); a tela de um microjogo só usa `useAoVivo`. Sem canal ligado, o que se manda vai pela ação 'acerto' (mais
 * devagar), e os quadros do servidor não chegam.
 */
export interface CanalAoVivo {
  enviar(dados: unknown): void;
  ouvir(aoChegar: (dados: unknown) => void): () => void;
}

interface SocketMinimo {
  emit(evento: string, dados: unknown): unknown;
  on(evento: string, fn: (m: { channelId?: number; dados?: unknown }) => void): unknown;
  off(evento: string, fn: (m: { channelId?: number; dados?: unknown }) => void): unknown;
}

/** O canal pelo socket do Syden: `channelId` da sala, ou null no Solo. */
export function canalDoSocket(socket: SocketMinimo, channelId: number | null): CanalAoVivo {
  const evento = channelId === null ? 'minijogo-solo:tempo-real' : 'minijogo:tempo-real';
  return {
    enviar: (dados) => socket.emit(evento, channelId === null ? { dados } : { channelId, dados }),
    ouvir(aoChegar) {
      const fn = (m: { channelId?: number; dados?: unknown }) => {
        if (channelId !== null && m?.channelId !== channelId) return;
        aoChegar(m?.dados);
      };
      socket.on(evento, fn);
      return () => socket.off(evento, fn);
    },
  };
}

let canalLigado: CanalAoVivo | null = null;
const aoTrocarCanal = new Set<() => void>();
/** Liga (ou desliga, com null) o canal ao vivo da Festa. */
export function ligarCanalDaFesta(canal: CanalAoVivo | null) {
  canalLigado = canal;
  for (const f of aoTrocarCanal) f();
}

/** Um quadro do servidor (o passo do microjogo): `n` o número do passo, `t` quanto o jogo já durava, `q` o que o microjogo mandou. */
export interface QuadroAoVivo<Q> {
  n: number;
  t: number;
  q: Q;
}

/**
 * O CANAL AO VIVO NUMA TELA: `aoQuadro` recebe cada quadro deste microjogo (só enquanto `ligado`); devolve o "mandar", que vai
 * pelo socket (ou, sem ele, pela ação 'acerto' com `aoVivo`). Os quadros chegam com `t` perto do "ms desde o começo" desta tela
 * (o começo daqui já está atrasado de uma ida): para desenhar os outros, interpole uns 100 ms atrás (`LinhaDoTempo`).
 */
export function useAoVivo<Q>(id: string, ligado: boolean, lance: (corpo: Record<string, unknown>) => void, aoQuadro: (quadro: QuadroAoVivo<Q>) => void) {
  const fn = useRef(aoQuadro);
  fn.current = aoQuadro;
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    const trocou = () => setVersao((v) => v + 1);
    aoTrocarCanal.add(trocou);
    return () => {
      aoTrocarCanal.delete(trocou);
    };
  }, []);
  useEffect(() => {
    if (!ligado || !canalLigado) return;
    return canalLigado.ouvir((d) => {
      const m = d as { festa?: unknown; n?: unknown; t?: unknown; q?: unknown } | null;
      if (!m || m.festa !== id || typeof m.n !== 'number' || typeof m.t !== 'number') return;
      fn.current({ n: m.n, t: m.t, q: m.q as Q });
    });
  }, [id, ligado, versao]);
  const lanceRef = useRef(lance);
  lanceRef.current = lance;
  return useRef((dados: Record<string, unknown>) => {
    if (canalLigado) canalLigado.enviar(dados);
    else lanceRef.current({ aoVivo: dados });
  }).current;
}

/**
 * A LINHA DO TEMPO dos quadros: guarda os últimos e dá, para um instante (ms desde o começo), os dois quadros em volta e a
 * fração entre eles, para desenhar os outros suavizados.
 */
export class LinhaDoTempo<Q> {
  private quadros: QuadroAoVivo<Q>[] = [];
  chegou(q: QuadroAoVivo<Q>) {
    if (this.quadros.length && q.n <= this.quadros[this.quadros.length - 1].n) return;
    this.quadros.push(q);
    if (this.quadros.length > 40) this.quadros.shift();
  }
  ultimo(): QuadroAoVivo<Q> | null {
    return this.quadros[this.quadros.length - 1] ?? null;
  }
  /** Os dois quadros em volta de `t` (ou o mais perto, repetido) e a fração de 0 a 1. */
  em(t: number): { a: QuadroAoVivo<Q>; b: QuadroAoVivo<Q>; k: number } | null {
    const l = this.quadros;
    if (!l.length) return null;
    if (t <= l[0].t) return { a: l[0], b: l[0], k: 0 };
    for (let i = l.length - 1; i > 0; i--) {
      if (l[i - 1].t <= t) {
        const a = l[i - 1];
        const b = l[i];
        if (t >= b.t) return { a: b, b, k: 0 };
        return { a, b, k: (t - a.t) / Math.max(1, b.t - a.t) };
      }
    }
    return { a: l[l.length - 1], b: l[l.length - 1], k: 0 };
  }
}

/** O coelho da festa, de frente (o mesmo desenho dos microjogos de 03/11), num <g> para pôr onde quiser. */
export function CoelhoDeFrente({ x = 0, y = 0, escala = 1, olhos = 'abertos' }: { x?: number; y?: number; escala?: number; olhos?: 'abertos' | 'tontos' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <ellipse cx="-6" cy="-30" rx="3.5" ry="9" fill="#e8dccb" />
      <ellipse cx="6" cy="-30" rx="3.5" ry="9" fill="#e8dccb" />
      <ellipse cx="-6" cy="-29" rx="1.5" ry="6" fill="#e4b5b0" />
      <ellipse cx="6" cy="-29" rx="1.5" ry="6" fill="#e4b5b0" />
      <circle cx="0" cy="-12" r="12" fill="#e8dccb" />
      {olhos === 'abertos' ? (
        <>
          <circle cx="-4" cy="-13" r="1.8" fill="#3a2e2a" />
          <circle cx="4" cy="-13" r="1.8" fill="#3a2e2a" />
        </>
      ) : (
        <path d="M-6 -15 L-2 -11 M-2 -15 L-6 -11 M2 -15 L6 -11 M6 -15 L2 -11" stroke="#3a2e2a" strokeWidth="1.4" strokeLinecap="round" />
      )}
      <circle cx="0" cy="-9" r="1.5" fill="#d98a8a" />
    </g>
  );
}
