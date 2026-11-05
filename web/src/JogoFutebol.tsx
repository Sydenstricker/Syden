import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Trophy } from 'lucide-react';
import { ComandosDoJogo } from './ComandosDosJogos';
import { CORES_DOS_AVATARES } from './corrida/coresDosAvatares';
import { useT } from './i18n';
import { tocar } from './somDosJogos';
import { carregarFolhas, COR_DO_TIME, desenharBola, desenharCampo, desenharJogador, desenharNome, type Folhas, type JogadorNaTela } from './futebol/desenho';
import { ClienteDaSala, type EventoDaTela, type Quadro } from './futebol/sala';
import { comandoDoRobo, CONTAGEM, H, NADA, novoMundo, PARTIDA_PASSOS, passoDoMundo, W, type Comando, type Evento, type Jogador, type Mundo } from './futebol/sim';
import './futebol/futebol.css';

/**
 * O FUTEBOL DOS COELHOS (05/11/2026, server/src/minijogo-futebol.ts): futebol de campo pequeno, visto de cima, com os jogadores
 * da Kenney (Sports Pack, CC0) virados coelhos pelas orelhas desenhadas por código. SÓ A MECÂNICA dos futebóis de fliperama, sem
 * música (a regra do "nunca fazer a nossa"); os efeitos são os de somDosJogos.ts.
 *
 * NO SOLO, a partida inteira roda aqui (futebol/sim.ts, com os robôs locais): sem rede no meio, sem atraso. No fim, o placar vai
 * ao servidor, que confere o tamanho. NA SALA, a bola e os robôs são do servidor, e o meu coelho anda aqui (futebol/sala.ts).
 * Com a janela sem foco, nada se desenha (e no Solo a partida pausa).
 */

export interface PessoaDoFutebol {
  userId: number;
  username: string;
  robo: boolean;
  avatar: number | null;
  slot: number;
}

export interface EstadoFutebol {
  fase: 'jogando' | 'fim';
  solo: boolean;
  partidaId: string;
  // na sala
  porTime?: number;
  meuTime?: 0 | 1 | null;
  times?: PessoaDoFutebol[][];
  placar?: [number, number];
  resultado?: {
    placar: [number, number];
    venceu: 0 | 1 | -1;
    jogadores: { userId: number; username: string; time: 0 | 1; gols: number; robo: boolean }[];
  } | null;
  // no Solo
  formato?: number | null;
  resultadoDoSolo?: { formato: number; gols: number; contra: number } | null;
  username?: string;
  avatar?: number | null;
  robos?: { userId: number; username: string }[];
}

type Props = {
  estado: EstadoFutebol & { terminada?: boolean };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  socket?: Socket | null;
  channelId?: number;
};

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o meu coelho joga sozinho (com as regras do robô). */
    futebolPilotoAutomatico?: boolean;
  }
}

const PELO_DO_MASCOTE: [number, number, number] = [250, 241, 212];
const peloDe = (avatar: number | null | undefined): [number, number, number] => (avatar && CORES_DOS_AVATARES[avatar]?.pelo) || PELO_DO_MASCOTE;
const FORMATO_GUARDADO = 'syden:futebolFormato';

export function JogoFutebol({ estado, eu, jogador, agir, socket = null, channelId = 0 }: Props) {
  const t = useT();
  const fim = estado.terminada || estado.fase === 'fim';
  const [formato, setFormato] = useState<number | null>(estado.formato ?? null);
  if (fim) return <TelaDoFim estado={estado} eu={eu} />;
  if (estado.solo) {
    if (!formato) return <EscolhaDoFormato aoEscolher={setFormato} />;
    return (
      <PartidaSolo
        key={estado.partidaId}
        formato={formato}
        eu={eu}
        nome={estado.username ?? ''}
        avatar={estado.avatar ?? null}
        robos={estado.robos ?? []}
        aoTerminar={(m) => void agir({ tipo: 'fim', formato, gols: m.placar[0], contra: m.placar[1], passos: m.passo, tempo: m.tempo })}
      />
    );
  }
  const souDoJogo = jogador && (estado.times ?? []).some((time) => time.some((p) => p.userId === eu));
  return <PartidaNaSala key={estado.partidaId} estado={estado} eu={souDoJogo ? eu : null} socket={socket} channelId={channelId} />;
}

// ---------------------------------------------------------------------------------------------------------------------
// A ESCOLHA DO SOLO: quantos por time (a pessoa e os robôs do time dela contra os robôs do outro)
// ---------------------------------------------------------------------------------------------------------------------

function EscolhaDoFormato({ aoEscolher }: { aoEscolher: (n: number) => void }) {
  const t = useT();
  const guardado = (() => {
    try {
      return Number(localStorage.getItem(FORMATO_GUARDADO)) || 2;
    } catch {
      return 2;
    }
  })();
  const escolher = (n: number) => {
    try {
      localStorage.setItem(FORMATO_GUARDADO, String(n));
    } catch {
      // sem o armazenamento, só não se lembra da escolha
    }
    tocar('clique');
    aoEscolher(n);
  };
  return (
    <div className="futebol-escolha">
      <p className="minijogo-situacao">{t('Quantos por time?')}</p>
      <div className="futebol-formatos">
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" className={n === guardado ? 'btn-primary' : 'btn-secondary'} onClick={() => escolher(n)}>
            {n} × {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// O FIM
// ---------------------------------------------------------------------------------------------------------------------

function TelaDoFim({ estado, eu }: { estado: EstadoFutebol; eu: number }) {
  const t = useT();
  const nomeDoTime = (time: 0 | 1) => (time === 0 ? t('Azul') : t('Laranja'));
  if (estado.solo) {
    const r = estado.resultadoDoSolo;
    if (!r) return <p className="minijogo-situacao">{t('Fim de jogo!')}</p>;
    return (
      <div className="futebol-fim">
        <p className="futebol-fim-titulo">{r.gols > r.contra ? t('Seu time venceu!') : r.gols < r.contra ? t('Seu time perdeu.') : t('Empate!')}</p>
        <p className="futebol-fim-placar">
          <span style={{ color: COR_DO_TIME[0] }}>{r.gols}</span> × <span style={{ color: COR_DO_TIME[1] }}>{r.contra}</span>
        </p>
      </div>
    );
  }
  const r = estado.resultado;
  if (!r) return <p className="minijogo-situacao">{t('Fim de jogo!')}</p>;
  const meu = r.jogadores.find((j) => j.userId === eu);
  const titulo =
    r.venceu === -1 ? t('Empate!') : meu ? (meu.time === r.venceu ? t('Seu time venceu!') : t('Seu time perdeu.')) : t('{nome} venceu!', { nome: nomeDoTime(r.venceu) });
  return (
    <div className="futebol-fim">
      <p className="futebol-fim-titulo">
        <Trophy size={20} aria-hidden="true" /> {titulo}
      </p>
      <p className="futebol-fim-placar">
        <span style={{ color: COR_DO_TIME[0] }}>{r.placar[0]}</span> × <span style={{ color: COR_DO_TIME[1] }}>{r.placar[1]}</span>
      </p>
      <div className="futebol-fim-times">
        {([0, 1] as const).map((time) => (
          <div key={time} className="futebol-fim-time">
            <strong style={{ color: COR_DO_TIME[time] }}>{nomeDoTime(time)}</strong>
            <ul>
              {r.jogadores
                .filter((j) => j.time === time)
                .map((j) => (
                  <li key={j.userId} className={j.userId === eu ? 'eu' : undefined}>
                    <span className="minijogo-nome">{j.username}</span>
                    {j.gols > 0 && <span className="futebol-gols">⚽ {j.gols}</span>}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// OS COMANDOS: o teclado e, na tela de toque, o direcional e os dois botões
// ---------------------------------------------------------------------------------------------------------------------

interface Entrada {
  esquerda: boolean;
  direita: boolean;
  cima: boolean;
  baixo: boolean;
  chute: boolean;
  /** O passe apertado, até o próximo passo o usar. */
  passe: boolean;
  /** O direcional de toque (null: solto). */
  toque: { dx: number; dy: number } | null;
}

const entradaVazia = (): Entrada => ({ esquerda: false, direita: false, cima: false, baixo: false, chute: false, passe: false, toque: null });

function useEntrada(ativo: boolean) {
  const entrada = useRef<Entrada>(entradaVazia());
  useEffect(() => {
    if (!ativo) return;
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (apertada && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      if (apertada && (e.ctrlKey || e.metaKey || e.altKey)) return;
      const c = entrada.current;
      const k = e.key.toLowerCase();
      let usou = true;
      if (k === 'arrowleft' || k === 'a') c.esquerda = apertada;
      else if (k === 'arrowright' || k === 'd') c.direita = apertada;
      else if (k === 'arrowup' || k === 'w') c.cima = apertada;
      else if (k === 'arrowdown' || k === 's') c.baixo = apertada;
      else if (k === ' ') c.chute = apertada;
      else if (k === 'x' || k === 'z') {
        if (apertada && !e.repeat) c.passe = true;
      } else usou = false;
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    // trocou de janela com a tecla apertada: o "soltar" vai para a outra janela, e o coelho seguiria correndo
    const soltar = () => Object.assign(entrada.current, entradaVazia());
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
  return entrada;
}

/** O comando do passo; o passe vale uma vez. */
function comandoDa(e: Entrada): Comando {
  let dx = (e.direita ? 1 : 0) - (e.esquerda ? 1 : 0);
  let dy = (e.baixo ? 1 : 0) - (e.cima ? 1 : 0);
  if (e.toque) {
    dx = e.toque.dx;
    dy = e.toque.dy;
  }
  const passe = e.passe;
  e.passe = false;
  return { dx, dy, chute: e.chute, passe };
}

const ehToque = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

function ControlesDeToque({ entrada }: { entrada: React.RefObject<Entrada> }) {
  const t = useT();
  const base = useRef<HTMLDivElement>(null);
  const [ponto, setPonto] = useState<{ x: number; y: number } | null>(null);
  const mover = (e: React.PointerEvent) => {
    const r = base.current?.getBoundingClientRect();
    if (!r) return;
    const raio = r.width / 2;
    let dx = (e.clientX - (r.left + raio)) / raio;
    let dy = (e.clientY - (r.top + raio)) / raio;
    const n = Math.sqrt(dx * dx + dy * dy);
    if (n > 1) {
      dx /= n;
      dy /= n;
    }
    entrada.current.toque = n < 0.15 ? { dx: 0, dy: 0 } : { dx, dy };
    setPonto({ x: dx, y: dy });
  };
  const soltar = () => {
    entrada.current.toque = null;
    setPonto(null);
  };
  return (
    <div className="futebol-toque">
      <div
        ref={base}
        className="futebol-direcional"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          mover(e);
        }}
        onPointerMove={(e) => e.buttons && mover(e)}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      >
        <span style={ponto ? { transform: `translate(${ponto.x * 30}px, ${ponto.y * 30}px)` } : undefined} />
      </div>
      <div className="futebol-botoes">
        <button type="button" onPointerDown={() => (entrada.current.passe = true)}>
          {t('Passe')}
        </button>
        <button
          type="button"
          className="chute"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            entrada.current.chute = true;
          }}
          onPointerUp={() => (entrada.current.chute = false)}
          onPointerCancel={() => (entrada.current.chute = false)}
        >
          {t('Chutar')}
        </button>
      </div>
    </div>
  );
}

function Comandos() {
  const t = useT();
  return (
    <ComandosDoJogo
      itens={[
        { teclas: ['setas'], toque: 'toque-arrastar', rotulo: t('Andar') },
        { teclas: ['espaco'], toque: 'toque-segurar', rotulo: t('Chutar (segure para mais força)') },
        { teclas: ['x', 'z'], toque: 'toque', rotulo: t('Passe') },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// O PALCO: o canvas, o laço de 60 passos por segundo, e o painel por cima
// ---------------------------------------------------------------------------------------------------------------------

interface Painel {
  placar: [number, number];
  restante: number;
  contagem: number | null;
  gol: { time: 0 | 1; contra: boolean; autor: string } | null;
}

interface Motor {
  /** Antes dos passos de cada quadro (a sala atualiza a vista). */
  antes?(agora: number): void;
  passo(agora: number): void;
  desenhar(g: CanvasRenderingContext2D, agora: number): void;
  painel(): Omit<Painel, 'gol'>;
  /** No Solo, sem foco a partida pausa; na sala, ela segue no servidor. */
  pausaSemFoco: boolean;
  /** A partida saiu da tela (o ouvinte do socket sai junto). */
  destruir?(): void;
}

function Palco({ criar, deps }: { criar: (aoGol: (g: Painel['gol']) => void) => Motor; deps: unknown[] }) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painel, setPainel] = useState<Painel>({ placar: [0, 0], restante: PARTIDA_PASSOS, contagem: null, gol: null });
  const [toque] = useState(ehToque);
  const criarRef = useRef(criar);
  criarRef.current = criar;

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    g.imageSmoothingEnabled = false;
    let gol: Painel['gol'] = null;
    let golAte = 0;
    const motor = criarRef.current((novo) => {
      gol = novo;
      golAte = performance.now() + 2200;
    });
    let id = 0;
    let ultimo = performance.now();
    let acumulado = 0;
    let ultimoPainel = 0;
    const quadro = () => {
      id = requestAnimationFrame(quadro);
      const agora = performance.now();
      const dt = Math.min(0.1, (agora - ultimo) / 1000);
      ultimo = agora;
      // sem foco (o jogo de verdade, outra janela) ou escondida: não se desenha (e o Solo pausa)
      if (document.hidden || !document.hasFocus()) {
        if (!motor.pausaSemFoco) acumulado = 0;
        return;
      }
      motor.antes?.(agora);
      acumulado += dt;
      let n = 0;
      while (acumulado >= 1 / 60 && n < 6) {
        motor.passo(agora);
        acumulado -= 1 / 60;
        n++;
      }
      if (n === 6) acumulado = 0;
      motor.desenhar(g, agora);
      if (agora - ultimoPainel > 100) {
        ultimoPainel = agora;
        if (gol && agora > golAte) gol = null;
        setPainel({ ...motor.painel(), gol });
      }
    };
    id = requestAnimationFrame(quadro);
    return () => {
      cancelAnimationFrame(id);
      motor.destruir?.();
    };
    // o motor nasce uma vez por partida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const seg = Math.ceil(painel.restante / 60);
  const relogio = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  return (
    <div className="futebol">
      <div className="futebol-moldura">
        <canvas ref={canvas} className="futebol-tela" width={W} height={H} />
        <div className="futebol-painel" aria-hidden="true">
          <span className="futebol-placar">
            <span className="futebol-time" style={{ background: COR_DO_TIME[0] }}>
              {painel.placar[0]}
            </span>
            <span className={`futebol-relogio${painel.restante < 600 ? ' acabando' : ''}`}>{relogio}</span>
            <span className="futebol-time" style={{ background: COR_DO_TIME[1] }}>
              {painel.placar[1]}
            </span>
          </span>
          {painel.contagem !== null && <span className="futebol-contagem">{painel.contagem}</span>}
          {painel.gol && (
            <span className="futebol-gol" style={{ color: COR_DO_TIME[painel.gol.time] }}>
              {t('Gol!')}
              <small>{painel.gol.contra ? t('Gol contra') : painel.gol.autor}</small>
            </span>
          )}
        </div>
      </div>
      {toque ? null : <Comandos />}
    </div>
  );
}

/** Os jogadores da vista para o desenho. */
function desenharMundo(
  g: CanvasRenderingContext2D,
  campo: HTMLCanvasElement,
  folhas: Folhas,
  m: Mundo,
  bola: { x: number; y: number },
  giro: number,
  quem: (j: Jogador) => { nome: string; pelo: [number, number, number]; eu: boolean },
  agora: number,
) {
  g.drawImage(campo, 0, 0);
  const lista: JogadorNaTela[] = m.jogadores.map((j) => ({
    id: j.id,
    time: j.time,
    x: j.x,
    y: j.y,
    fx: j.fx,
    fy: j.fy,
    vel: Math.sqrt(j.vx * j.vx + j.vy * j.vy),
    carga: j.carga,
    tonto: j.tonto,
    ...quem(j),
  }));
  // quem está mais embaixo, por cima
  lista.sort((a, b) => a.y - b.y);
  const bolaAntes = m.bola.dono === 0;
  if (bolaAntes) desenharBola(g, folhas, bola.x, bola.y, giro);
  for (const j of lista) desenharJogador(g, folhas, j, agora);
  if (!bolaAntes) desenharBola(g, folhas, bola.x, bola.y, giro);
  for (const j of lista) desenharNome(g, j);
}

function somDoEvento(e: Evento | EventoDaTela, meuTime: 0 | 1 | null, nome: (id: number) => string, aoGol: (g: Painel['gol']) => void) {
  switch (e.tipo) {
    case 'chute':
      tocar('tacada');
      break;
    case 'passe':
      tocar('clique');
      break;
    case 'roubo':
      tocar('soco');
      break;
    case 'gol':
      tocar(meuTime === null ? 'acerto' : e.time === meuTime ? 'combo' : 'erro');
      aoGol({ time: e.time, contra: e.contra, autor: e.autor ? nome(e.autor) : '' });
      break;
    case 'reinicio':
      tocar('vez');
      break;
    case 'fim':
      tocar('fim');
      break;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// O SOLO: a partida inteira aqui
// ---------------------------------------------------------------------------------------------------------------------

function PartidaSolo({
  formato,
  eu,
  nome,
  avatar,
  robos,
  aoTerminar,
}: {
  formato: number;
  eu: number;
  nome: string;
  avatar: number | null;
  robos: { userId: number; username: string }[];
  aoTerminar: (m: Mundo) => void;
}) {
  const entrada = useEntrada(true);
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;
  const [toque] = useState(ehToque);
  const nomes = new Map(robos.map((r) => [r.userId, r.username]));
  nomes.set(eu, nome);
  const nomeDe = (id: number) => nomes.get(id) ?? '';

  return (
    <>
      <Palco
        deps={[formato]}
        criar={(aoGol) => {
          // a pessoa e (formato − 1) robôs contra (formato) robôs: -1, -2… do meu lado primeiro
          const ids = Array.from({ length: formato * 2 - 1 }, (_, k) => -(k + 1));
          const m = novoMundo([[eu, ...ids.slice(0, formato - 1)], ids.slice(formato - 1)]);
          const campo = desenharCampo();
          const folhas = carregarFolhas();
          const pelo = peloDe(avatar);
          let giro = 0;
          let antes = { x: m.bola.x, y: m.bola.y };
          let mandou = false;
          return {
            pausaSemFoco: true,
            passo() {
              if (m.fim) return;
              passoDoMundo(m, (j) => {
                if (j.id !== eu) return comandoDoRobo(m, j);
                if (import.meta.env.DEV && window.futebolPilotoAutomatico) return comandoDoRobo(m, j);
                return comandoDa(entrada.current);
              });
              for (const e of m.eventos) somDoEvento(e, 0, nomeDe, aoGol);
              if (m.pausa === CONTAGEM - 1) tocar('vez');
              if (m.fim && !mandou) {
                mandou = true;
                terminar.current(m);
              }
            },
            desenhar(g, agora) {
              giro += Math.sqrt((m.bola.x - antes.x) ** 2 + (m.bola.y - antes.y) ** 2) / 5;
              antes = { x: m.bola.x, y: m.bola.y };
              desenharMundo(g, campo, folhas, m, m.bola, giro, (j) => ({ nome: nomeDe(j.id), pelo: j.id === eu ? pelo : PELO_DO_MASCOTE, eu: j.id === eu }), agora);
            },
            painel() {
              return {
                placar: m.placar,
                restante: PARTIDA_PASSOS - m.passo,
                contagem: m.passo === 0 && m.pausa > 0 ? Math.ceil(m.pausa / 60) : null,
              };
            },
          };
        }}
      />
      {toque && <ControlesDeToque entrada={entrada} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// NA SALA: a bola e os robôs do servidor, o meu coelho daqui
// ---------------------------------------------------------------------------------------------------------------------

function PartidaNaSala({ estado, eu, socket, channelId }: { estado: EstadoFutebol; eu: number | null; socket: Socket | null; channelId: number }) {
  const t = useT();
  const entrada = useEntrada(eu !== null);
  const [toque] = useState(ehToque);
  const times = estado.times ?? [[], []];
  const pessoas = new Map(times.flat().map((p) => [p.userId, p]));
  const pessoasRef = useRef(pessoas);
  pessoasRef.current = pessoas;
  const nomeDe = (id: number) => pessoasRef.current.get(id)?.username ?? '';
  const meuTime = estado.meuTime ?? null;

  return (
    <>
      {eu === null && <p className="minijogo-situacao">{t('Assistindo')}</p>}
      <Palco
        deps={[socket, channelId]}
        criar={(aoGol) => {
          const campo = desenharCampo();
          const folhas = carregarFolhas();
          const enviar = (dados: unknown) => socket?.emit('minijogo:tempo-real', { channelId, dados });
          const cliente = new ClienteDaSala(
            times.map((time) => [...time].sort((a, b) => a.slot - b.slot).map((p) => p.userId)),
            eu,
            enviar,
            (e) => somDoEvento(e, meuTime, nomeDe, aoGol),
          );
          const chegou = (msg: { channelId?: number; dados?: unknown }) => {
            if (msg?.channelId !== channelId || !msg.dados || (msg.dados as Quadro).tipo !== 'q') return;
            cliente.receber(msg.dados as Quadro, performance.now());
          };
          socket?.on('minijogo:tempo-real', chegou);
          return {
            pausaSemFoco: false,
            destruir() {
              socket?.off('minijogo:tempo-real', chegou);
            },
            antes(agora) {
              cliente.atualizar(agora);
            },
            passo(agora) {
              if (!cliente.eu) return;
              const c = import.meta.env.DEV && window.futebolPilotoAutomatico ? comandoDoRobo(cliente.vista, cliente.eu) : comandoDa(entrada.current);
              cliente.passo(cliente.eu.tonto > 0 ? NADA : c, agora);
            },
            desenhar(g, agora) {
              if (!cliente.ultimo) {
                g.drawImage(campo, 0, 0);
                return;
              }
              desenharMundo(
                g,
                campo,
                folhas,
                cliente.vista,
                cliente.bolaNaTela(),
                cliente.giro,
                (j) => {
                  const p = pessoasRef.current.get(j.id);
                  return { nome: p?.username ?? '', pelo: peloDe(p?.avatar), eu: j.id === eu };
                },
                agora,
              );
            },
            painel() {
              const q = cliente.ultimo;
              if (!q) return { placar: estado.placar ?? [0, 0], restante: PARTIDA_PASSOS, contagem: null };
              const correndo = q.pa === 0 && !q.fim ? Math.round((performance.now() - cliente.ultimoEm) / (1000 / 60)) : 0;
              return {
                placar: q.g,
                restante: Math.max(0, PARTIDA_PASSOS - q.p - correndo),
                contagem: q.p === 0 && q.pa > 0 ? Math.ceil(q.pa / 60) : null,
              };
            },
          };
        }}
      />
      {toque && eu !== null && <ControlesDeToque entrada={entrada} />}
    </>
  );
}
