import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { useT } from './i18n';
import { IconeDeHud } from './iconesDeHud';
import { comandoDaPausa, TelaDePausa, usePausaComEsc, type Pausa } from './pausaDosJogos';
import { tocar } from './somDosJogos';
import { coresDoAvatar, minhasCoresDoCoelho, type CoresDoCoelho } from './coelho3d';
import { tempoLegivel } from './jato/util';
import { planejar } from './gincana/piloto';
import {
  DIREITA,
  ESQUERDA,
  FRENTE,
  gravador,
  IDS_DOS_PERCURSOS,
  leitor,
  novoCoelho,
  passo,
  PASSO,
  PERCURSOS,
  PULO,
  TRAS,
  type Coelho,
  type Entradas,
  type Percurso,
} from './gincana/sim';
import type { CenaDaGincana, QuadroDoCoelho } from './gincana/cena';
import type { Agir } from './Minijogo';
import type { Partida } from './minijogos';
import './gincana/gincana.css';

/**
 * A GINCANA DA TOCA (06/11/2026, pedido dele): a corrida de obstáculos em 3D com as peças do Platformer Pack da KayKit. O coelho
 * corre (setas ou WASD; o direcional ou a alavanca do controle; os botões na tela de toque), pula (Espaço, o botão A, o botão
 * da tela) e se equilibra até a bandeira; caiu do mapa (ou levou serra, ou espinho), volta à última bandeira. A regra é
 * gincana/sim.ts, a mesma do servidor.
 * - NO SOLO, contra o relógio num dos três percursos, com os fantasmas dos amigos; os comandos de cada passo vão ao servidor,
 *   que refaz o percurso e guarda o melhor tempo (server/src/minijogo-gincana.ts). ESC pausa; sem foco, nada se mexe.
 * - NA SALA, o mesmo percurso para a turma: o servidor dá o verde, repassa as posições e classifica pelo tempo refeito.
 */

export interface EstadoGincana {
  fase: 'escolha' | 'correndo' | 'resultado' | 'largada' | 'fim';
  solo: boolean;
  percurso: string;
  partidaId: string;
  // o Solo
  recordes?: { userId: number; nome: string; avatar: number | null; percurso: string; tempoMs: number }[];
  meuAvatar?: number | null;
  meuNome?: string;
  fantasmas?: { userId: number; nome: string; avatar: number | null; tempoMs: number; entradas: number[] }[];
  rodada?: number;
  resultado?: { tempoMs: number; quedas: number; recorde: boolean; anterior: number | null } | null;
  // a sala
  corredores?: { userId: number; username: string; tempoMs: number | null; quedas: number; posicao: number | null; avatar: number | null }[];
  prazo?: boolean;
}

const MAX_FANTASMAS = 3;
const CONTAGEM = 3 * 60;
const MEDALHAS = ['🥇', '🥈', '🥉'];

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático e lê o coelho. */
    gincanaPilotoAutomatico?: boolean;
    gincanaDoTeste?: Coelho;
  }
}

/** Os comandos de agora: o teclado, os botões da tela de toque e o controle, em bits (sim.ts). */
function useComandos(ativo: boolean) {
  const teclas = useRef(new Set<string>());
  const toque = useRef(0);
  useEffect(() => {
    if (!ativo) return;
    const mapa: Record<string, string> = { arrowup: 'f', w: 'f', arrowdown: 't', s: 't', arrowleft: 'e', a: 'e', arrowright: 'd', d: 'd', ' ': 'p' };
    const tecla = (e: KeyboardEvent, desce: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (desce && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable || alvo.tagName === 'BUTTON')) return;
      const k = mapa[e.key.toLowerCase()];
      if (!k) return;
      if (desce) teclas.current.add(k);
      else teclas.current.delete(k);
      e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltar = () => {
      teclas.current.clear();
      toque.current = 0;
    };
    const escondeu = () => document.hidden && soltar();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltar);
    document.addEventListener('visibilitychange', escondeu);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltar);
      document.removeEventListener('visibilitychange', escondeu);
      soltar();
    };
  }, [ativo]);
  const ler = (): number => {
    const t = teclas.current;
    let e = (t.has('f') ? FRENTE : 0) | (t.has('t') ? TRAS : 0) | (t.has('e') ? ESQUERDA : 0) | (t.has('d') ? DIREITA : 0) | (t.has('p') ? PULO : 0) | toque.current;
    // o controle: o direcional, a alavanca esquerda (com uma zona morta) e o botão A
    for (const p of navigator.getGamepads?.() ?? []) {
      if (!p) continue;
      const [ax = 0, ay = 0] = p.axes;
      if (p.buttons[12]?.pressed || ay < -0.4) e |= FRENTE;
      if (p.buttons[13]?.pressed || ay > 0.4) e |= TRAS;
      if (p.buttons[14]?.pressed || ax < -0.4) e |= ESQUERDA;
      if (p.buttons[15]?.pressed || ax > 0.4) e |= DIREITA;
      if (p.buttons[0]?.pressed) e |= PULO;
    }
    // os dois lados juntos se anulam
    if (e & FRENTE && e & TRAS) e &= ~(FRENTE | TRAS);
    if (e & ESQUERDA && e & DIREITA) e &= ~(ESQUERDA | DIREITA);
    return e;
  };
  /** Os botões da tela de toque: cada um liga o seu bit enquanto o dedo está nele. */
  const botao = (bit: number) => ({
    onPointerDown: (ev: React.PointerEvent) => {
      ev.preventDefault();
      toque.current |= bit;
      (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    },
    onPointerUp: () => (toque.current &= ~bit),
    onPointerCancel: () => (toque.current &= ~bit),
    onContextMenu: (ev: React.MouseEvent) => ev.preventDefault(),
  });
  return { ler, botao };
}

interface Painel {
  ms: number;
  posto: number;
  postos: number;
  quedas: number;
  contagem: number | null;
  ordem: { id: string; nome: string; eu: boolean }[];
}

/** Um rival da sala: as posições que o servidor repassou, pelo passo do percurso dele. */
interface Rival {
  nome: string;
  avatar: number | null;
  posicoes: { n: number; x: number; y: number; z: number; e: number }[];
  chegou: boolean;
}

interface ConfigDoPercurso {
  caixa: HTMLElement;
  percurso: Percurso;
  /** Eu corro (false: só assisto). */
  corro: boolean;
  meuNome: string;
  minhasCores: Promise<CoresDoCoelho>;
  fantasmas: { nome: string; avatar: number | null; entradas: Entradas }[];
  rivais?: Map<number, Rival>;
  contagem: number;
  pausa?: Pausa;
  ler: () => number;
  aoPainel: (p: Painel) => void;
  aoChegar: (entradas: Entradas, ordem: Painel['ordem']) => void;
  aoPosicao?: (dados: { n: number; x: number; y: number; z: number; e: number }) => void;
  aoPronta: () => void;
  aoFalhar: () => void;
}

/** O laço do percurso (Solo e sala): a regra a 60 por segundo, a cena no ritmo da tela. Devolve quem para tudo. */
function rodarPercurso(cfg: ConfigDoPercurso): () => void {
  let viva = true;
  let cena: CenaDaGincana | null = null;
  let id = 0;
  const p = cfg.percurso;
  const eu = cfg.corro ? novoCoelho(p) : null;
  if (eu && import.meta.env.DEV) window.gincanaDoTeste = eu;
  const gravar = gravador();
  const fantasmas = cfg.fantasmas.map((f) => ({ ...f, k: novoCoelho(p), ler: leitor(f.entradas) }));
  const rivais = cfg.rivais ? [...cfg.rivais.entries()] : [];
  let antes = new Map<Coelho, { x: number; y: number; z: number }>();
  let mandou = false;
  let ordemFinal: Painel['ordem'] | null = null;
  let ultimoPainel = 0;
  let contagem = cfg.contagem;
  /** O passo do mundo para quem só assiste (o relógio desde o verde). */
  let nAssistindo = 0;
  let plano: number[] | null = null;
  let iPlano = 0;

  const todos = (): Coelho[] => [...(eu ? [eu] : []), ...fantasmas.map((f) => f.k)];
  const nAgora = () => (eu ? eu.passo : nAssistindo);

  const posicaoDoRival = (r: Rival, n: number) => {
    const l = r.posicoes;
    if (!l.length) return null;
    if (n <= l[0].n) return l[0];
    for (let i = l.length - 1; i > 0; i--) {
      if (l[i - 1].n <= n && n <= l[i].n) {
        const a = l[i - 1], b = l[i];
        // a volta à bandeira é um salto: não se interpola
        const salto = (b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z) > 9;
        if (salto) return b;
        const k = (n - a.n) / Math.max(1, b.n - a.n);
        return { n, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, e: b.e };
      }
    }
    return l[l.length - 1];
  };

  const ordem = (): Painel['ordem'] => {
    const linhas: { id: string; nome: string; eu: boolean; chegou: number | null; andou: number }[] = [];
    if (eu) linhas.push({ id: 'eu', nome: cfg.meuNome, eu: true, chegou: eu.chegou ? eu.chegouEm : null, andou: eu.z });
    fantasmas.forEach((f, i) => linhas.push({ id: `f${i}`, nome: f.nome, eu: false, chegou: f.k.chegou ? f.k.chegouEm : null, andou: f.k.z }));
    for (const [uid, r] of rivais) {
      const q = r.posicoes.at(-1);
      linhas.push({ id: `r${uid}`, nome: r.nome, eu: false, chegou: null, andou: q ? q.z : 0 });
    }
    linhas.sort((a, b) => (a.chegou !== null && b.chegou !== null ? a.chegou - b.chegou : a.chegou !== null ? -1 : b.chegou !== null ? 1 : b.andou - a.andou));
    return linhas.map(({ id, nome, eu }) => ({ id, nome, eu }));
  };

  void import('./gincana/cena')
    .then(async ({ CenaDaGincana }) => {
      if (!viva) return;
      cena = new CenaDaGincana(cfg.caixa, p);
      const minhas = eu ? await cfg.minhasCores : null;
      if (!viva) return;
      await cena.montar([
        ...(eu && minhas ? [{ cores: minhas }] : []),
        ...rivais.map(([, r]) => ({ cores: coresDoAvatar(r.avatar), nome: r.nome })),
        ...fantasmas.map((f) => ({ cores: coresDoAvatar(f.avatar), fantasma: true, nome: f.nome })),
      ]);
      if (!viva) return;
      cfg.aoPronta();
      let ultimo = performance.now();
      let acumulado = 0;
      const quadro = () => {
        if (!viva || !cena) return;
        id = requestAnimationFrame(quadro);
        const agora = performance.now();
        const dt = Math.min(0.1, (agora - ultimo) / 1000);
        ultimo = agora;
        // sem foco (o jogo de verdade, outra janela), escondida ou pausada (ESC): nem regra, nem desenho
        if (document.hidden || !document.hasFocus() || cfg.pausa?.ativa) return;
        acumulado += dt;
        let n = 0;
        while (acumulado >= PASSO && n < 6) {
          acumulado -= PASSO;
          n++;
          if (contagem > 0) {
            contagem--;
            if (contagem % 60 === 0) tocar(contagem === 0 ? 'acerto' : 'clique');
            continue;
          }
          antes = new Map(todos().map((c) => [c, { x: c.x, y: c.y, z: c.z }]));
          nAssistindo++;
          if (eu && !eu.chegou) {
            let e: number;
            if (import.meta.env.DEV && window.gincanaPilotoAutomatico) {
              // o piloto automático planeja de onde o coelho está (uma vez; de novo se o plano acabar ou desviar)
              if (!plano || iPlano >= plano.length) {
                plano = planejar(p, eu) ?? [];
                iPlano = 0;
              }
              e = plano[iPlano++] ?? 0;
            } else e = cfg.ler();
            gravar.anotar(e);
            const ev = passo(eu, e, p);
            if (ev === 'pulo') tocar('pulo');
            else if (ev === 'mola') tocar('mola');
            else if (ev === 'queda') tocar('queda');
            else if (ev === 'machucou') tocar('serra');
            else if (ev === 'empurrao') tocar('empurrao');
            else if (ev === 'posto') tocar('bandeira');
            else if (ev === 'chegou') {
              tocar('chegada');
              ordemFinal = ordem();
            }
            if (eu.passo % 4 === 0 || ev === 'chegou') cfg.aoPosicao?.({ n: eu.passo, x: eu.x, y: eu.y, z: eu.z, e: eu.pisca > 0 ? 2 : eu.noChao ? 0 : 1 });
          } else if (eu) eu.passo++;
          for (const f of fantasmas) passo(f.k, f.ler(), p);
        }
        if (n === 6) acumulado = 0;
        const k = contagem > 0 ? 1 : Math.min(1, acumulado / PASSO);
        const desenho = (c: Coelho): QuadroDoCoelho => {
          const a = antes.get(c) ?? c;
          return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, z: a.z + (c.z - a.z) * k, noChao: c.noChao, pisca: c.pisca, escondido: c.chegou && c !== eu };
        };
        const nR = nAgora() - 6;
        const quadros: QuadroDoCoelho[] = [
          ...(eu ? [desenho(eu)] : []),
          ...rivais.map(([, r]) => {
            const q = posicaoDoRival(r, nR);
            if (!q) return { x: 0, y: 0, z: 0, noChao: true, pisca: 0, escondido: true };
            return { x: q.x, y: q.y, z: q.z, noChao: q.e !== 1, pisca: q.e === 2 ? Math.floor(agora / 16) : 0 };
          }),
          ...fantasmas.map((f) => desenho(f.k)),
        ];
        // quem só assiste: a câmera segue o rival mais adiantado
        if (!eu && quadros.length > 1) {
          let melhor = 0;
          quadros.forEach((q, i) => !q.escondido && (quadros[melhor].escondido || q.z > quadros[melhor].z) && (melhor = i));
          if (melhor > 0) [quadros[0], quadros[melhor]] = [quadros[melhor], quadros[0]];
        }
        const passoDoMundo = contagem > 0 ? 0 : nAgora() - 1 + k;
        cena.desenhar(Math.max(0, passoDoMundo), eu, quadros, dt);
        if (agora - ultimoPainel > 90) {
          ultimoPainel = agora;
          cfg.aoPainel({
            ms: eu ? Math.round(((eu.chegou ? eu.chegouEm : eu.passo) * 1000) / 60) : 0,
            posto: eu ? eu.posto : 0,
            postos: p.postos.length - 1,
            quedas: eu ? eu.quedas : 0,
            contagem: contagem > 0 ? Math.ceil(contagem / 60) : null,
            ordem: ordemFinal ?? ordem(),
          });
        }
        if (eu?.chegou && !mandou) {
          mandou = true;
          cfg.aoChegar(gravar.entradas, ordemFinal ?? ordem());
        }
      };
      id = requestAnimationFrame(quadro);
    })
    .catch(() => {
      cena?.destruir();
      cena = null;
      if (viva) cfg.aoFalhar();
    });
  return () => {
    viva = false;
    cancelAnimationFrame(id);
    cena?.destruir();
  };
}

function temWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function Comandos({ solo = false }: { solo?: boolean }) {
  const t = useT();
  return (
    <ComandosDoJogo
      itens={[{ teclas: ['setas'], rotulo: t('Andar') }, { teclas: ['espaco'], rotulo: t('Pular') }, ...(solo ? [comandoDaPausa(t)] : [])]}
    />
  );
}

/** O PERFIL do percurso, de lado (a altura de cada peça pelo caminho), para a escolha. */
export function PerfilDoPercurso({ percurso }: { percurso: Percurso }) {
  const comp = percurso.chegada.z + 6;
  const ys = [...percurso.caixas.filter((c) => c.modelo).map((c) => c.y1), ...percurso.rampas.map((r) => r.yAlto)];
  const alto = Math.max(...ys) + 2;
  const baixo = Math.min(...ys) - 3;
  const W = 160, H = 60;
  const X = (z: number) => (z / comp) * (W - 8) + 4;
  const Y = (y: number) => H - 6 - ((y - baixo) / (alto - baixo)) * (H - 14);
  const cor: Record<string, string> = { firme: '#4db4ef', esteira: '#3b4050', cai: '#e0574f', mola: '#f2c14e', espinhos: '#9aa4b1', posto: '#5bc46a', chegada: '#5bc46a' };
  return (
    <svg className="gincana-perfil" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <rect width={W} height={H} rx="6" fill="#bfe6f8" />
      <rect y={H - 6} width={W} height="6" fill="#4fa9d9" />
      {percurso.caixas.filter((c) => c.modelo).map((c) => (
        <rect key={c.i} x={X(c.z0)} y={Y(c.y1)} width={Math.max(0.8, X(c.z1 + (c.mov?.az ?? 0)) - X(c.z0) - 0.4)} height={Math.max(2, Y(c.y0) - Y(c.y1))} fill={c.mov ? '#f2c14e' : cor[c.tipo]} rx="0.6" />
      ))}
      {percurso.rampas.map((r) => (
        <polygon key={r.i} points={`${X(r.z0)},${Y(r.yBaixo)} ${X(r.z1)},${Y(r.yAlto)} ${X(r.z1)},${Y(r.yBaixo - 1)} ${X(r.z0)},${Y(r.yBaixo - 1)}`} fill="#4db4ef" />
      ))}
      {percurso.postos.slice(1).map((q) => (
        <path key={q.z} d={`M${X(q.z)} ${Y(q.y)} v-9 l5 2 -5 2`} stroke="#2f8a3d" strokeWidth="1" fill="#5bc46a" />
      ))}
      <path d={`M${X(percurso.chegada.z)} ${Y(percurso.chegada.y)} v-11`} stroke="#2a2a2a" strokeWidth="1.2" />
      <rect x={X(percurso.chegada.z)} y={Y(percurso.chegada.y) - 11} width="7" height="5" fill="#ffffff" stroke="#2a2a2a" strokeWidth="0.6" />
    </svg>
  );
}

/** A escolha do percurso na sala (antes do convite): os três, de lado. */
export function EscolhaDoPercurso({ aoEscolher, aoVoltar }: { aoEscolher: (percurso: string) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="gincana-escolha-sala">
      <ul className="gincana-percursos">
        {IDS_DOS_PERCURSOS.map((id, i) => (
          <li key={id}>
            <button type="button" className="gincana-percurso" aria-label={t('Fase {n} de {total}', { n: i + 1, total: IDS_DOS_PERCURSOS.length })} onClick={() => aoEscolher(id)}>
              <PerfilDoPercurso percurso={PERCURSOS[id]} />
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

/** A tela do percurso: a cena, o painel por cima e os botões de toque. */
function Percorrer({
  config,
  solo,
  ligada,
  aoChegar,
  aoPosicao,
}: {
  config: Omit<ConfigDoPercurso, 'caixa' | 'ler' | 'aoPainel' | 'aoPronta' | 'aoFalhar' | 'aoChegar' | 'aoPosicao' | 'pausa'>;
  solo: boolean;
  ligada: boolean;
  aoChegar: (entradas: Entradas, ordem: Painel['ordem']) => void;
  aoPosicao?: ConfigDoPercurso['aoPosicao'];
}) {
  const t = useT();
  const caixa = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (temWebGL() ? 'carregando' : 'falhou'));
  const [painel, setPainel] = useState<Painel | null>(null);
  const [chegou, setChegou] = useState(false);
  const comandos = useComandos(ligada && !chegou);
  const { pausa, pausado, continuar } = usePausaComEsc(solo && ligada && !chegou && estado === 'pronta');
  const chegar = useRef(aoChegar);
  chegar.current = aoChegar;
  const posicao = useRef(aoPosicao);
  posicao.current = aoPosicao;
  const [toque] = useState(() => !!window.matchMedia?.('(pointer: coarse)').matches);

  useEffect(() => {
    if (estado === 'falhou' || !caixa.current) return;
    return rodarPercurso({
      ...config,
      caixa: caixa.current,
      pausa,
      ler: comandos.ler,
      aoPainel: setPainel,
      aoPronta: () => setEstado('pronta'),
      aoFalhar: () => setEstado('falhou'),
      aoChegar: (e, o) => {
        setChegou(true);
        chegar.current(e, o);
      },
      aoPosicao: (d) => posicao.current?.(d),
    });
    // o percurso é um por montagem (a `key` de quem chama)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado === 'falhou']);

  if (estado === 'falhou') return <p className="minijogo-situacao">{t('Este jogo precisa de gráficos 3D, que não abriram neste aparelho.')}</p>;
  return (
    <div className="gincana-moldura">
      <div ref={caixa} className={`gincana-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
      {estado === 'pronta' && painel && (
        <div className="gincana-painel" aria-hidden="true">
          {config.corro && (
            <>
              <span className="gincana-relogio">{tempoLegivel(painel.ms)}</span>
              <span className="gincana-bandeiras">
                ⚑ {painel.posto}/{painel.postos}
              </span>
              {painel.quedas > 0 && (
                <span className="gincana-quedas">
                  <IconeDeHud nome="voltar" tamanho={14} /> {painel.quedas}
                </span>
              )}
            </>
          )}
          {painel.ordem.length > 1 && !chegou && (
            <ol className="gincana-ordem">
              {painel.ordem.map((l, i) => (
                <li key={l.id} className={l.eu ? 'eu' : undefined}>
                  <span>{i + 1}</span> {l.nome}
                </li>
              ))}
            </ol>
          )}
          {painel.contagem !== null && <span className="gincana-contagem">{painel.contagem}</span>}
        </div>
      )}
      {estado === 'pronta' && config.corro && ligada && !chegou && toque && (
        <div className="gincana-toque">
          <div className="gincana-cruz">
            <button type="button" className="cima" aria-label="↑" {...comandos.botao(FRENTE)}>
              ▲
            </button>
            <button type="button" className="esquerda" aria-label="←" {...comandos.botao(ESQUERDA)}>
              ◀
            </button>
            <button type="button" className="direita" aria-label="→" {...comandos.botao(DIREITA)}>
              ▶
            </button>
            <button type="button" className="baixo" aria-label="↓" {...comandos.botao(TRAS)}>
              ▼
            </button>
          </div>
          <button type="button" className="gincana-pulo" aria-label={t('Pular')} {...comandos.botao(PULO)}>
            ⤒
          </button>
        </div>
      )}
      {pausado && <TelaDePausa aoContinuar={continuar} />}
    </div>
  );
}

export function JogoGincana(props: { estado: EstadoGincana & Partida; eu: number; jogador: boolean; restante: number; agir: Agir; socket: Socket | null; channelId: number }) {
  return props.estado.solo ? <GincanaSolo {...props} /> : <GincanaNaSala {...props} />;
}

// =====================================================================================================================
// O SOLO
// =====================================================================================================================

function GincanaSolo({ estado, eu, agir }: { estado: EstadoGincana & Partida; eu: number; agir: Agir }) {
  const t = useT();
  const [percurso, setPercurso] = useState(estado.percurso || IDS_DOS_PERCURSOS[0]);
  const recordes = (estado.recordes ?? []).filter((r) => r.percurso === percurso);
  const [escolhidos, setEscolhidos] = useState<{ percurso: string; ids: Set<number> } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const meuNome = estado.meuNome ?? '';

  const marcados = (() => {
    if (escolhidos && escolhidos.percurso === percurso) return escolhidos.ids;
    const meu = recordes.findIndex((r) => r.userId === eu);
    const ate = meu < 0 ? recordes.length : meu;
    const acima = recordes.slice(Math.max(0, ate - (MAX_FANTASMAS - 1)), ate).map((r) => r.userId);
    return new Set([...(meu >= 0 ? [eu] : []), ...acima].slice(0, MAX_FANTASMAS));
  })();
  const tentar = (corpo: Record<string, unknown>) => {
    setErro(null);
    agir(corpo).catch((e) => setErro((e as Error).message));
  };
  const correr = () => tentar({ tipo: 'correr', percurso, fantasmas: [...marcados] });
  const alternar = (id: number) => {
    const n = new Set(marcados);
    if (n.has(id)) n.delete(id);
    else if (n.size < MAX_FANTASMAS) n.add(id);
    setEscolhidos({ percurso, ids: n });
  };
  const meu = recordes.find((r) => r.userId === eu) ?? null;
  const outros = recordes.filter((r) => r.userId !== eu);

  if (estado.fase === 'escolha') {
    return (
      <div className="gincana">
        <div className="gincana-escolha">
          <ul className="gincana-percursos" role="radiogroup">
            {IDS_DOS_PERCURSOS.map((id, i) => (
              <li key={id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={percurso === id}
                  className={`gincana-percurso${percurso === id ? ' escolhido' : ''}`}
                  aria-label={t('Fase {n} de {total}', { n: i + 1, total: IDS_DOS_PERCURSOS.length })}
                  onClick={() => setPercurso(id)}
                >
                  <PerfilDoPercurso percurso={PERCURSOS[id]} />
                  <strong>{i + 1}</strong>
                </button>
              </li>
            ))}
          </ul>
          {meu && <span>{t('Seu recorde: {tempo}', { tempo: tempoLegivel(meu.tempoMs) })}</span>}
          <Comandos solo />
          <fieldset className="gincana-fantasmas">
            <legend>{t('Correr contra')}</legend>
            {recordes.length > 0 && (
              <ul>
                {recordes.map((r) => (
                  <li key={r.userId}>
                    <label>
                      <input type="checkbox" checked={marcados.has(r.userId)} disabled={!marcados.has(r.userId) && marcados.size >= MAX_FANTASMAS} onChange={() => alternar(r.userId)} />
                      <span className="gincana-quem">{r.nome}</span>
                      <span className="gincana-tempo">{tempoLegivel(r.tempoMs)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {outros.length === 0 && <p className="settings-hint">{t('Nenhum amigo correu nesta pista ainda.')}</p>}
          </fieldset>
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={correr}>
              {t('Começar')}
            </button>
          </div>
          {erro && <p className="form-error small">{erro}</p>}
        </div>
      </div>
    );
  }

  const r = estado.resultado;
  return (
    <div className="gincana">
      <Percorrer
        key={`${estado.partidaId}-${estado.rodada ?? 0}`}
        solo
        ligada={estado.fase === 'correndo'}
        config={{
          percurso: PERCURSOS[estado.percurso] ?? PERCURSOS[IDS_DOS_PERCURSOS[0]],
          corro: true,
          meuNome,
          minhasCores: minhasCoresDoCoelho(),
          fantasmas: (estado.fantasmas ?? []).map((f) => ({ nome: f.nome, avatar: f.avatar, entradas: f.entradas })),
          contagem: CONTAGEM,
        }}
        aoChegar={(entradas) => agir({ tipo: 'chegada', entradas }).catch((e) => setErro((e as Error).message))}
      />
      {estado.fase === 'resultado' && r && (
        <div className="gincana-fim-solo">
          {r.recorde && <strong className="gincana-recorde">{t('Novo recorde!')}</strong>}
          <span className="gincana-tempo grande">{tempoLegivel(r.tempoMs)}</span>
          {r.quedas > 0 && <span className="settings-hint">{t('Quedas: {n}', { n: r.quedas })}</span>}
          {!r.recorde && r.anterior !== null && <span className="settings-hint">{t('Seu recorde: {tempo}', { tempo: tempoLegivel(r.anterior) })}</span>}
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={() => tentar({ tipo: 'correr', percurso: estado.percurso, fantasmas: [...marcados] })}>
              {t('Jogar de novo')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => tentar({ tipo: 'escolher' })}>
              {t('Correr contra')}
            </button>
          </div>
        </div>
      )}
      {estado.fase === 'correndo' && <Comandos solo />}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

// =====================================================================================================================
// NA SALA
// =====================================================================================================================

const marcaDoLugar = (posicao: number | null, chegou: boolean, ficaram: number) =>
  posicao === null ? '–' : chegou && ficaram >= 2 && posicao <= 3 ? MEDALHAS[posicao - 1] : posicao;

function GincanaNaSala({
  estado,
  eu,
  jogador,
  restante,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoGincana & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: Agir;
  socket: Socket | null;
  channelId: number;
}) {
  const corredores = estado.corredores ?? [];
  const fim = estado.fase === 'fim' || estado.terminada;
  const meu = corredores.find((c) => c.userId === eu);
  // quem abre a página com o percurso já andando assiste (a chegada de quem recomeça no meio não valeria)
  const [desdeALargada] = useState(() => estado.fase === 'largada');
  const corro = jogador && !!meu && desdeALargada;
  const [chegou, setChegou] = useState(false);
  const rivais = useRef<Map<number, Rival> | null>(null);
  if (!rivais.current) {
    rivais.current = new Map(corredores.filter((c) => c.userId !== eu || !corro).map((c) => [c.userId, { nome: c.username, avatar: c.avatar, posicoes: [], chegou: false }]));
  }

  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados || typeof m.dados.userId !== 'number') return;
      const r = rivais.current?.get(m.dados.userId);
      const { n, x, y, z, e } = m.dados as { n: number; x: number; y: number; z: number; e: number };
      if (!r || typeof n !== 'number' || typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return;
      const ultima = r.posicoes.at(-1);
      if (ultima && ultima.n >= n) return;
      r.posicoes.push({ n, x, y, z, e: e === 1 || e === 2 ? e : 0 });
      if (r.posicoes.length > 3000) r.posicoes.splice(0, 1500);
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId]);

  const contagem = useRef(estado.fase === 'largada' ? Math.max(0, Math.round((restante * 60) / 1000)) : 0);
  const comTempos = chegou || fim;
  const ficaram = corredores.filter((c) => c.posicao !== null).length;
  return (
    <div className="gincana">
      {!fim && (
        <Percorrer
          key={estado.partidaId}
          solo={false}
          ligada={corro && !fim}
          config={{
            percurso: PERCURSOS[estado.percurso] ?? PERCURSOS[IDS_DOS_PERCURSOS[0]],
            corro,
            meuNome: meu?.username ?? '',
            minhasCores: Promise.resolve(coresDoAvatar(meu?.avatar)),
            fantasmas: [],
            rivais: rivais.current,
            contagem: contagem.current,
          }}
          aoChegar={(entradas) => {
            setChegou(true);
            void agir({ tipo: 'chegada', entradas });
          }}
          aoPosicao={(dados) => socket?.emit('minijogo:tempo-real', { channelId, dados })}
        />
      )}
      {comTempos && (
        <ol className="gincana-classificacao">
          {corredores.map((c) => (
            <li key={c.userId} className={c.userId === eu ? 'eu' : undefined}>
              {/* a posição só no fim: antes, quem ainda corre pode fazer um tempo menor */}
              <span className="gincana-posicao">{fim ? marcaDoLugar(c.posicao, c.tempoMs !== null, ficaram) : ''}</span>
              <span className="gincana-quem">{c.username}</span>
              <span className="gincana-tempo">{c.tempoMs !== null ? tempoLegivel(c.tempoMs) : fim ? '—' : '…'}</span>
            </li>
          ))}
        </ol>
      )}
      {corro && !fim && !chegou && <Comandos />}
    </div>
  );
}
