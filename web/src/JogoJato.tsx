import { ComandosDoJogo } from './ComandosDosJogos';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import { tempoLegivel } from './jato/util';
import type { ComandosDoJato } from './jato/fisica';
import { rodarJato, type LinhaDaOrdem, type PosicaoNaSala, type RivalDoJato } from './jato/laco';
import { nomeDaPistaDoJato } from './jato/nomes';
import { CIDADE, linhaDoJato, MUNDO, PISTAS_DO_JATO, pistaDoJatoPorId, type DefinicaoDoJato } from './jato/pista';
import { H, W } from './jato/render';
import type { Agir } from './Minijogo';
import type { Partida } from './minijogos';
import './jato.css';

/**
 * OS COELHOS A JATO (05/11/2026): a corrida futurista em perspectiva, as naves-cenoura flutuando sobre faixas suspensas (a
 * cidade à noite, a órbita, o mar de nuvens). Só a mecânica do gênero; a pista, as naves e o resto são desenhados por código
 * (jato/). O laço é o mesmo nos dois jeitos de jogar (jato/laco.ts):
 * - NO SOLO, contra o relógio, com os fantasmas dos amigos e as naves do computador na pista; o tempo vai ao servidor, que o
 *   confere e guarda o melhor (server/src/minijogo-jato.ts).
 * - NA SALA, a turma corre junto: o servidor dá o verde, repassa as posições e classifica pelo tempo de cada um.
 */

export interface EstadoJato {
  fase: 'escolha' | 'correndo' | 'resultado' | 'largada' | 'fim';
  solo: boolean;
  pista: string;
  voltasDaCorrida: number;
  robos: number;
  partidaId: string;
  // o Solo
  recordes?: { userId: number; nome: string; avatar: number | string | null; tempoMs: number }[];
  meuAvatar?: number | string | null;
  fantasmas?: { userId: number; nome: string; avatar: number | string | null; tempoMs: number; amostras: number[] }[];
  rodada?: number;
  resultado?: { tempoMs: number | null; voltas: number[]; recorde: boolean; anterior: number | null; explodiu: boolean } | null;
  // a sala
  pilotos?: { userId: number; username: string; tempoMs: number | null; voltas: number[]; posicao: number | null; explodiu: boolean; avatar: number | string | null }[];
  prazo?: boolean;
}

const MAX_FANTASMAS = 3;
const CONTAGEM = 3 * 60;
const MEDALHAS = ['🥇', '🥈', '🥉'];

/** Setas ou WASD, Espaço o turbo, Z (ou Shift) o freio de ar. Na tela de toque, a nave acelera sozinha. */
function useControles(ativo: boolean) {
  const comandos = useRef<ComandosDoJato>({ acelera: false, freia: false, vira: 0, turbo: false, freioDeAr: false });
  const lados = useRef({ esquerda: false, direita: false, toqueEsquerda: false, toqueDireita: false });
  const virar = () => {
    const l = lados.current;
    comandos.current.vira = (l.direita || l.toqueDireita ? 1 : 0) - (l.esquerda || l.toqueEsquerda ? 1 : 0);
  };
  useEffect(() => {
    if (!ativo) return;
    const c = comandos.current;
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (apertada && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = e.key.toLowerCase();
      let usou = true;
      if (k === 'arrowup' || k === 'w') c.acelera = apertada;
      else if (k === 'arrowdown' || k === 's') c.freia = apertada;
      else if (k === 'arrowleft' || k === 'a') lados.current.esquerda = apertada;
      else if (k === 'arrowright' || k === 'd') lados.current.direita = apertada;
      else if (k === ' ') c.turbo = apertada;
      else if (k === 'z' || k === 'shift') c.freioDeAr = apertada;
      else usou = false;
      virar();
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltarTudo = () => {
      const toque = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      Object.assign(c, { acelera: toque, freia: false, vira: 0, turbo: false, freioDeAr: false });
      Object.assign(lados.current, { esquerda: false, direita: false, toqueEsquerda: false, toqueDireita: false });
    };
    const escondeu = () => document.hidden && soltarTudo();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltarTudo);
    document.addEventListener('visibilitychange', escondeu);
    if (window.matchMedia?.('(pointer: coarse)').matches) c.acelera = true;
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltarTudo);
      document.removeEventListener('visibilitychange', escondeu);
      Object.assign(c, { acelera: false, freia: false, vira: 0, turbo: false, freioDeAr: false });
    };
  }, [ativo]);
  const tocarLado = (lado: 'toqueEsquerda' | 'toqueDireita', apertado: boolean) => {
    lados.current[lado] = apertado;
    virar();
  };
  return { comandos, tocarLado };
}

function BotoesDeToque({ controles }: { controles: ReturnType<typeof useControles> }) {
  const t = useT();
  const { comandos, tocarLado } = controles;
  const lado = (qual: 'toqueEsquerda' | 'toqueDireita') => ({
    onPointerDown: () => tocarLado(qual, true),
    onPointerUp: () => tocarLado(qual, false),
    onPointerCancel: () => tocarLado(qual, false),
    onPointerLeave: () => tocarLado(qual, false),
  });
  const segurar = (campo: 'turbo' | 'freioDeAr') => ({
    onPointerDown: () => (comandos.current[campo] = true),
    onPointerUp: () => (comandos.current[campo] = false),
    onPointerCancel: () => (comandos.current[campo] = false),
    onPointerLeave: () => (comandos.current[campo] = false),
  });
  return (
    <div className="jato-toque">
      <button type="button" aria-label={t('Virar para a esquerda')} {...lado('toqueEsquerda')}>
        ◀
      </button>
      <button type="button" aria-label={t('Freio de ar')} {...segurar('freioDeAr')}>
        ⤵
      </button>
      <button type="button" aria-label={t('Turbo')} {...segurar('turbo')}>
        ⚡
      </button>
      <button type="button" aria-label={t('Virar para a direita')} {...lado('toqueDireita')}>
        ▶
      </button>
    </div>
  );
}

function usePlacar() {
  const [placar, setPlacar] = useState({ volta: 0, ms: 0, pausado: false });
  const atualizar = (p: { volta: number; ms: number; pausado: boolean }) =>
    setPlacar((a) => (a.volta === p.volta && Math.floor(a.ms / 10) === Math.floor(p.ms / 10) && a.pausado === p.pausado ? a : p));
  return [placar, atualizar] as const;
}

function Placar({ placar, voltas }: { placar: { volta: number; ms: number }; voltas: number }) {
  return (
    <div className="jato-placar" aria-live="off">
      <span>🏁 {placar.volta}/{voltas}</span>
      <span className="jato-relogio">{tempoLegivel(placar.ms)}</span>
    </div>
  );
}

const menosMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function Comandos({ solo = false }: { solo?: boolean }) {
  const t = useT();
  return (
    <ComandosDoJogo
      itens={[
        { teclas: ['setas'], rotulo: t('Pilotar') },
        { teclas: ['espaco'], rotulo: t('Turbo (da segunda volta em diante)') },
        { teclas: ['z'], rotulo: t('Freio de ar') },
        ...(solo ? [comandoDaPausa(t)] : []),
      ]}
    />
  );
}

/** O mapa pequeno de uma pista, na escolha: só a linha do meio, com a largura e a borda. */
function MapaDaPista({ def, lado }: { def: DefinicaoDoJato; lado: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    const { lx, ly } = linhaDoJato(def);
    const k = lado / MUNDO;
    g.clearRect(0, 0, lado, lado);
    g.lineJoin = g.lineCap = 'round';
    const tracar = (cor: string, largura: number) => {
      g.beginPath();
      for (let i = 0; i < lx.length; i++) g[i ? 'lineTo' : 'moveTo'](lx[i] * k, ly[i] * k);
      g.closePath();
      g.strokeStyle = cor;
      g.lineWidth = largura;
      g.stroke();
    };
    const [r, gg, b] = [def.tema.borda[0] & 0xff, (def.tema.borda[0] >> 8) & 0xff, (def.tema.borda[0] >> 16) & 0xff];
    tracar(`rgb(${r}, ${gg}, ${b})`, (2 * def.meiaLargura + 8) * k);
    tracar('rgb(226, 220, 240)', 2 * def.meiaLargura * k);
  }, [def, lado]);
  const c = def.tema.ceu.meio;
  return <canvas ref={ref} width={lado} height={lado} aria-hidden="true" style={{ background: `rgb(${c[0]}, ${c[1]}, ${c[2]})` }} />;
}

/** A ESCOLHA DA PISTA da corrida na sala (antes do convite): as três pistas. */
export function EscolhaDaPistaDoJato({ aoEscolher, aoVoltar }: { aoEscolher: (pista: string) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="jato-escolha">
      <ul className="jato-pistas">
        {PISTAS_DO_JATO.map((def) => (
          <li key={def.id}>
            <button type="button" className="jato-pista-botao" onClick={() => aoEscolher(def.id)}>
              <MapaDaPista def={def} lado={72} />
              <strong>{nomeDaPistaDoJato(t, def.id)}</strong>
              <small>{t('{n} voltas', { n: def.voltas })}</small>
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

export function JogoJato(props: { estado: EstadoJato & Partida; eu: number; jogador: boolean; restante: number; agir: Agir; socket: Socket | null; channelId: number }) {
  return props.estado.solo ? <JatoSolo {...props} /> : <JatoNaSala {...props} />;
}

// =====================================================================================================================
// O SOLO: contra o relógio
// =====================================================================================================================

function JatoSolo({ estado, eu, agir }: { estado: EstadoJato & Partida; eu: number; agir: Agir }) {
  const t = useT();
  const recordes = estado.recordes ?? [];
  const def = pistaDoJatoPorId(estado.pista);
  const [escolhidos, setEscolhidos] = useState<Set<number> | null>(null);
  const [chegada, setChegada] = useState<{ posicao: number; total: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // os fantasmas que vêm marcados: o meu e os dos amigos logo acima de mim (o próximo alvo); refeito ao trocar de pista
  const marcados = (() => {
    if (escolhidos) return escolhidos;
    const meu = recordes.findIndex((r) => r.userId === eu);
    const ate = meu < 0 ? recordes.length : meu;
    const acima = recordes.slice(Math.max(0, ate - (MAX_FANTASMAS - 1)), ate).map((r) => r.userId);
    return new Set([...(meu >= 0 ? [eu] : []), ...acima].slice(0, MAX_FANTASMAS));
  })();
  useEffect(() => setEscolhidos(null), [estado.pista]);

  const tentar = (corpo: Record<string, unknown>) => {
    setErro(null);
    agir(corpo).catch((e) => setErro((e as Error).message));
  };
  const correr = () => {
    setChegada(null);
    tentar({ tipo: 'correr', fantasmas: [...marcados] });
  };
  const alternar = (id: number) => {
    const n = new Set(marcados);
    if (n.has(id)) n.delete(id);
    else if (n.size < MAX_FANTASMAS) n.add(id);
    setEscolhidos(n);
  };
  const meu = recordes.find((r) => r.userId === eu) ?? null;
  const outros = recordes.filter((r) => r.userId !== eu);

  if (estado.fase === 'escolha') {
    return (
      <div className="jato">
        <ul className="jato-pistas" role="radiogroup">
          {PISTAS_DO_JATO.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="radio"
                aria-checked={p.id === estado.pista}
                className={`jato-pista-botao${p.id === estado.pista ? ' escolhida' : ''}`}
                onClick={() => p.id !== estado.pista && tentar({ tipo: 'pista', pista: p.id })}
              >
                <MapaDaPista def={p} lado={72} />
                <strong>{nomeDaPistaDoJato(t, p.id)}</strong>
                <small>{t('{n} voltas', { n: p.voltas })}</small>
              </button>
            </li>
          ))}
        </ul>
        <div className="jato-pista-nome">
          {meu && <span>{t('Seu recorde: {tempo}', { tempo: tempoLegivel(meu.tempoMs) })}</span>}
          <Comandos solo />
          <p className="settings-hint">{t('A energia é a vida e o turbo: bater na borda gasta, a faixa cor-de-rosa recarrega.')}</p>
        </div>
        <fieldset className="jato-fantasmas">
          <legend>{t('Correr contra')}</legend>
          {recordes.length > 0 && (
            <ul>
              {recordes.map((r) => (
                <li key={r.userId}>
                  <label>
                    <input type="checkbox" checked={marcados.has(r.userId)} disabled={!marcados.has(r.userId) && marcados.size >= MAX_FANTASMAS} onChange={() => alternar(r.userId)} />
                    <span className="jato-quem">{r.nome}</span>
                    <span className="jato-relogio">{tempoLegivel(r.tempoMs)}</span>
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
    );
  }

  const r = estado.resultado;
  return (
    <div className="jato">
      <CorridaSolo key={`${estado.partidaId}-${estado.rodada ?? 0}`} estado={estado} def={def} agir={agir} aoChegar={setChegada} aoErro={setErro} />
      {estado.fase === 'resultado' && r && (
        <div className="jato-fim-solo">
          {r.explodiu ? (
            <strong className="jato-explodiu">{t('A nave explodiu: a energia acabou.')}</strong>
          ) : (
            <>
              {r.recorde && <strong className="jato-recorde">{t('Novo recorde!')}</strong>}
              <span className="jato-relogio grande">{r.tempoMs !== null ? tempoLegivel(r.tempoMs) : '—'}</span>
              {chegada && <span>{t('Posição: {posicao} de {total}', { posicao: chegada.posicao, total: chegada.total })}</span>}
              <ol className="jato-voltas">
                {r.voltas.map((v, i) => (
                  <li key={i}>
                    🏁 {i + 1} · {tempoLegivel(v - (i ? r.voltas[i - 1] : 0))}
                  </li>
                ))}
              </ol>
              {!r.recorde && r.anterior !== null && <span className="settings-hint">{t('Seu recorde: {tempo}', { tempo: tempoLegivel(r.anterior) })}</span>}
            </>
          )}
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={correr}>
              {t('Jogar de novo')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => tentar({ tipo: 'escolher' })}>
              {t('Escolher a pista')}
            </button>
          </div>
        </div>
      )}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

function CorridaSolo({
  estado,
  def,
  agir,
  aoChegar,
  aoErro,
}: {
  estado: EstadoJato & Partida;
  def: DefinicaoDoJato;
  agir: Agir;
  aoChegar: (c: { posicao: number; total: number }) => void;
  aoErro: (e: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const [placar, setPlacar] = usePlacar();
  const [acabou, setAcabou] = useState(false);
  const controles = useControles(estado.fase === 'correndo' && !acabou);
  // ESC pausa (só aqui, no Solo: na sala o relógio é o de todos)
  const { pausa, pausado, continuar } = usePausaComEsc(estado.fase === 'correndo' && !acabou);
  useEffect(() => {
    if (!canvas.current) return;
    tela.current?.focus();
    return rodarJato({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      pista: def,
      piloto: true,
        pausa,
      meuAvatar: estado.meuAvatar ?? null,
      fantasmas: (estado.fantasmas ?? []).map((f) => ({ amostras: f.amostras, avatar: f.avatar })),
      robos: estado.robos,
      contagem: CONTAGEM,
      calmo: menosMovimento(),
      aoPlacar: setPlacar,
      aoChegar: (voltas, caminho, posicao, total) => {
        setAcabou(true);
        aoChegar({ posicao, total });
        agir({ tipo: 'chegada', voltas, amostras: caminho }).catch((e) => aoErro((e as Error).message));
      },
      aoExplodir: () => {
        setAcabou(true);
        agir({ tipo: 'explodiu' }).catch((e) => aoErro((e as Error).message));
      },
    });
    // a corrida é uma por rodada (a `key` de quem chama): os fantasmas e a pista são os do começo dela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="jato-tela" ref={tela} tabIndex={-1}>
      <canvas ref={canvas} width={W} height={H} />
      {!acabou && <Placar placar={placar} voltas={def.voltas} />}
      {!acabou && <BotoesDeToque controles={controles} />}
          {!acabou && pausado && <TelaDePausa aoContinuar={continuar} icone={false} />}
    </div>
  );
}

// =====================================================================================================================
// NA SALA: a turma corre junto
// =====================================================================================================================

const marcaDoLugar = (posicao: number | null, chegou: boolean, ficaram: number) =>
  posicao === null ? '–' : chegou && ficaram >= 2 && posicao <= 3 ? MEDALHAS[posicao - 1] : posicao;

function JatoNaSala({
  estado,
  eu,
  jogador,
  restante,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoJato & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: Agir;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const [placar, setPlacar] = usePlacar();
  const [ordem, setOrdem] = useState<LinhaDaOrdem[]>([]);
  const [chegou, setChegou] = useState(false);
  const pilotos = estado.pilotos ?? [];
  const fim = estado.fase === 'fim' || estado.terminada;
  const piloto = jogador && pilotos.some((p) => p.userId === eu);
  const controles = useControles(piloto && !chegou && !fim);
  const rivais = useRef(new Map<number, RivalDoJato>());
  const def = pistaDoJatoPorId(estado.pista ?? CIDADE.id);

  for (const p of pilotos) {
    if (p.userId === eu) continue;
    const r = rivais.current.get(p.userId);
    if (r) {
      r.nome = p.username;
      r.fora = p.explodiu;
    } else rivais.current.set(p.userId, { nome: p.username, avatar: p.avatar, posicoes: [], fora: p.explodiu });
  }

  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados || typeof m.dados.userId !== 'number') return;
      const r = rivais.current.get(m.dados.userId);
      const { n, x, y, a, andou, b, t: turbo } = m.dados as unknown as PosicaoNaSala;
      if (!r || ![n, x, y, a, andou].every((v) => typeof v === 'number')) return;
      const ultima = r.posicoes.at(-1);
      if (ultima && ultima.n >= n) return;
      r.posicoes.push({ n, x, y, a, andou, b: typeof b === 'number' ? b : 0, t: turbo === true });
      if (r.posicoes.length > 2000) r.posicoes.splice(0, 1000);
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId]);

  const parar = useRef<() => void>(() => {});
  const acabou = useRef(fim);
  acabou.current = fim;
  useEffect(() => {
    if (fim) parar.current();
  }, [fim]);
  useEffect(() => {
    if (fim || !canvas.current) return;
    tela.current?.focus();
    const contagem = estado.fase === 'largada' ? Math.max(0, Math.round((restante * 60) / 1000)) : 0;
    const enviar = (dados: unknown) => socket?.emit('minijogo:tempo-real', { channelId, dados });
    parar.current = rodarJato({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      pista: def,
      piloto,
      meuAvatar: pilotos.find((p) => p.userId === eu)?.avatar ?? null,
      rivais: rivais.current,
      robos: estado.robos,
      contagem,
      calmo: menosMovimento(),
      aoPlacar: setPlacar,
      aoOrdem: setOrdem,
      aoPosicao: enviar,
      aoChegar: (voltas, caminho) => {
        if (acabou.current) return;
        setChegou(true);
        void agir({ tipo: 'chegada', voltas, amostras: caminho });
      },
      aoExplodir: () => {
        if (acabou.current) return;
        setChegou(true);
        void agir({ tipo: 'explodiu' });
      },
    });
    return parar.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nomeDe = (id: number) => (id === -1 ? (pilotos.find((p) => p.userId === eu)?.username ?? '') : (pilotos.find((p) => p.userId === id)?.username ?? ''));
  const comTempos = chegou || fim;
  const ficaram = pilotos.filter((p) => p.posicao !== null).length;

  return (
    <div className="jato">
      <div className="jato-topo">
        <strong>{nomeDaPistaDoJato(t, def.id)}</strong>
      </div>
      <div className="jato-tela" ref={tela} tabIndex={-1}>
        <canvas ref={canvas} width={W} height={H} />
        {!fim && piloto && !chegou && <Placar placar={placar} voltas={def.voltas} />}
        {!comTempos && ordem.length > 1 && (
          <ol className="jato-ordem" aria-live="off">
            {ordem.map((l, i) => (
              <li key={l.id} className={l.eu ? 'eu' : undefined}>
                <span>{i + 1}</span> {nomeDe(l.id)}
              </li>
            ))}
          </ol>
        )}
        {!fim && piloto && !chegou && <BotoesDeToque controles={controles} />}
        {comTempos && (
          <div className="jato-fim">
            <ol className="jato-classificacao">
              {pilotos.map((p) => (
                <li key={p.userId} className={p.userId === eu ? 'eu' : undefined}>
                  {/* a posição só no fim: antes, quem ainda corre pode fazer um tempo menor */}
                  <span className="jato-posicao">{fim ? marcaDoLugar(p.posicao, p.tempoMs !== null, ficaram) : ''}</span>
                  <span className="jato-quem">{p.username}</span>
                  <span className="jato-relogio">{p.tempoMs !== null ? tempoLegivel(p.tempoMs) : p.explodiu ? '💥' : fim ? '—' : '…'}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {piloto && !fim && <Comandos />}
    </div>
  );
}

