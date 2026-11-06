import { ComandosDoJogo } from './ComandosDosJogos';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import { tempoLegivel } from './jato/util';
import type { ComandosDoBarco } from './barco/fisica';
import { rodarBarco, type LinhaDaOrdem, type PosicaoNaSala, type RivalDoBarco } from './barco/laco';
import { nomeDaPistaDoBarco } from './barco/nomes';
import { LAGO_DA_HORTA, linhaDoBarco, MUNDO, PISTAS_DO_BARCO, pistaDoBarcoPorId, type DefinicaoDoBarco } from './barco/pista';
import { H, W } from './barco/render';
import type { Agir } from './Minijogo';
import type { Partida } from './minijogos';
import './barco.css';

/**
 * A REGATA DA TOCA (05/11/2026): corrida de barquinhos em perspectiva, no lago da horta, no riacho e no mangue. Só a mecânica
 * do gênero; a água, o barco e as margens são desenhados por código (barco/). O laço é o mesmo nos dois jeitos de jogar
 * (barco/laco.ts):
 * - NO SOLO, contra o relógio, com os fantasmas dos amigos; o tempo vai ao servidor, que o confere e guarda o melhor
 *   (server/src/minijogo-barco.ts).
 * - NA SALA, a turma corre junto: o servidor dá o verde, repassa as posições e classifica pelo tempo de cada um.
 */

export interface EstadoBarco {
  fase: 'escolha' | 'correndo' | 'resultado' | 'largada' | 'fim';
  solo: boolean;
  pista: string;
  voltasDaCorrida: number;
  partidaId: string;
  // o Solo
  recordes?: { userId: number; nome: string; avatar: number | null; tempoMs: number }[];
  meuAvatar?: number | null;
  fantasmas?: { userId: number; nome: string; avatar: number | null; tempoMs: number; amostras: number[] }[];
  rodada?: number;
  resultado?: { tempoMs: number; voltas: number[]; recorde: boolean; anterior: number | null } | null;
  // a sala
  pilotos?: { userId: number; username: string; tempoMs: number | null; voltas: number[]; posicao: number | null; avatar: number | null }[];
  prazo?: boolean;
}

const MAX_FANTASMAS = 3;
const CONTAGEM = 3 * 60;
const MEDALHAS = ['🥇', '🥈', '🥉'];

/** Setas ou WASD. Na tela de toque, o barco acelera sozinho e os botões viram. */
function useControles(ativo: boolean) {
  const comandos = useRef<ComandosDoBarco>({ acelera: false, freia: false, vira: 0 });
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
      else usou = false;
      virar();
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltarTudo = () => {
      const toque = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      Object.assign(c, { acelera: toque, freia: false, vira: 0 });
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
      Object.assign(c, { acelera: false, freia: false, vira: 0 });
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
  // segurar o freio tira o pé do acelerador (no toque, ele fica sempre apertado)
  const freio = {
    onPointerDown: () => Object.assign(comandos.current, { freia: true }),
    onPointerUp: () => Object.assign(comandos.current, { freia: false }),
    onPointerCancel: () => Object.assign(comandos.current, { freia: false }),
    onPointerLeave: () => Object.assign(comandos.current, { freia: false }),
  };
  return (
    <div className="barco-toque">
      <button type="button" aria-label={t('Virar para a esquerda')} {...lado('toqueEsquerda')}>
        ◀
      </button>
      <button type="button" aria-label={t('Frear')} {...freio}>
        ⏸
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
    <div className="barco-placar" aria-live="off">
      <span>🏁 {placar.volta}/{voltas}</span>
      <span className="barco-relogio">{tempoLegivel(placar.ms)}</span>
    </div>
  );
}

const menosMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function Comandos({ solo = false }: { solo?: boolean }) {
  const t = useT();
  return (
    <ComandosDoJogo
      itens={[
        { teclas: ['setas'], rotulo: t('Pilotar (para trás, freia e dá ré)') },
        ...(solo ? [comandoDaPausa(t)] : []),
      ]}
    />
  );
}

/** O mapa pequeno de uma pista, na escolha: a linha do meio, com a largura da água e a margem. */
function MapaDaPista({ def, lado }: { def: DefinicaoDoBarco; lado: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    const { lx, ly } = linhaDoBarco(def);
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
    const b = def.tema.barranco, a = def.tema.agua.rasa;
    tracar(`rgb(${b[0]}, ${b[1]}, ${b[2]})`, (2 * def.meiaLargura + 10) * k);
    tracar(`rgb(${a[0]}, ${a[1]}, ${a[2]})`, 2 * def.meiaLargura * k);
  }, [def, lado]);
  const c = def.tema.chao[0];
  return <canvas ref={ref} width={lado} height={lado} aria-hidden="true" style={{ background: `rgb(${c[0]}, ${c[1]}, ${c[2]})` }} />;
}

/** A ESCOLHA DA PISTA da corrida na sala (antes do convite): as três pistas. */
export function EscolhaDaPistaDoBarco({ aoEscolher, aoVoltar }: { aoEscolher: (pista: string) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="barco-escolha">
      <ul className="barco-pistas">
        {PISTAS_DO_BARCO.map((def) => (
          <li key={def.id}>
            <button type="button" className="barco-pista-botao" onClick={() => aoEscolher(def.id)}>
              <MapaDaPista def={def} lado={72} />
              <strong>{nomeDaPistaDoBarco(t, def.id)}</strong>
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

export function JogoBarco(props: { estado: EstadoBarco & Partida; eu: number; jogador: boolean; restante: number; agir: Agir; socket: Socket | null; channelId: number }) {
  return props.estado.solo ? <BarcoSolo {...props} /> : <BarcoNaSala {...props} />;
}

// =====================================================================================================================
// O SOLO: contra o relógio
// =====================================================================================================================

function BarcoSolo({ estado, eu, agir }: { estado: EstadoBarco & Partida; eu: number; agir: Agir }) {
  const t = useT();
  const recordes = estado.recordes ?? [];
  const def = pistaDoBarcoPorId(estado.pista);
  const [escolhidos, setEscolhidos] = useState<Set<number> | null>(null);
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
  const correr = () => tentar({ tipo: 'correr', fantasmas: [...marcados] });
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
      <div className="barco">
        <ul className="barco-pistas" role="radiogroup">
          {PISTAS_DO_BARCO.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="radio"
                aria-checked={p.id === estado.pista}
                className={`barco-pista-botao${p.id === estado.pista ? ' escolhida' : ''}`}
                onClick={() => p.id !== estado.pista && tentar({ tipo: 'pista', pista: p.id })}
              >
                <MapaDaPista def={p} lado={72} />
                <strong>{nomeDaPistaDoBarco(t, p.id)}</strong>
                <small>{t('{n} voltas', { n: p.voltas })}</small>
              </button>
            </li>
          ))}
        </ul>
        <div className="barco-pista-nome">
          {meu && <span>{t('Seu recorde: {tempo}', { tempo: tempoLegivel(meu.tempoMs) })}</span>}
          <Comandos solo />
          <p className="settings-hint">{t('O barco desliza: tire o pé antes da curva. As argolas laranja dão um empurrão.')}</p>
        </div>
        <fieldset className="barco-fantasmas">
          <legend>{t('Correr contra')}</legend>
          {recordes.length > 0 && (
            <ul>
              {recordes.map((r) => (
                <li key={r.userId}>
                  <label>
                    <input type="checkbox" checked={marcados.has(r.userId)} disabled={!marcados.has(r.userId) && marcados.size >= MAX_FANTASMAS} onChange={() => alternar(r.userId)} />
                    <span className="barco-quem">{r.nome}</span>
                    <span className="barco-relogio">{tempoLegivel(r.tempoMs)}</span>
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
    <div className="barco">
      <CorridaSolo key={`${estado.partidaId}-${estado.rodada ?? 0}`} estado={estado} def={def} agir={agir} aoErro={setErro} />
      {estado.fase === 'resultado' && r && (
        <div className="barco-fim-solo">
          {r.recorde && <strong className="barco-recorde">{t('Novo recorde!')}</strong>}
          <span className="barco-relogio grande">{tempoLegivel(r.tempoMs)}</span>
          <ol className="barco-voltas">
            {r.voltas.map((v, i) => (
              <li key={i}>
                🏁 {i + 1} · {tempoLegivel(v - (i ? r.voltas[i - 1] : 0))}
              </li>
            ))}
          </ol>
          {!r.recorde && r.anterior !== null && <span className="settings-hint">{t('Seu recorde: {tempo}', { tempo: tempoLegivel(r.anterior) })}</span>}
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

function CorridaSolo({ estado, def, agir, aoErro }: { estado: EstadoBarco & Partida; def: DefinicaoDoBarco; agir: Agir; aoErro: (e: string) => void }) {
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
    return rodarBarco({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      pista: def,
      piloto: true,
        pausa,
      meuAvatar: estado.meuAvatar ?? null,
      fantasmas: (estado.fantasmas ?? []).map((f) => ({ amostras: f.amostras, avatar: f.avatar })),
      contagem: CONTAGEM,
      calmo: menosMovimento(),
      aoPlacar: setPlacar,
      aoChegar: (voltas, caminho) => {
        setAcabou(true);
        agir({ tipo: 'chegada', voltas, amostras: caminho }).catch((e) => aoErro((e as Error).message));
      },
    });
    // a corrida é uma por rodada (a `key` de quem chama): os fantasmas e a pista são os do começo dela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="barco-tela" ref={tela} tabIndex={-1}>
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

function BarcoNaSala({
  estado,
  eu,
  jogador,
  restante,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoBarco & Partida;
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
  const rivais = useRef(new Map<number, RivalDoBarco>());
  const def = pistaDoBarcoPorId(estado.pista ?? LAGO_DA_HORTA.id);

  for (const p of pilotos) {
    if (p.userId === eu) continue;
    const r = rivais.current.get(p.userId);
    if (r) r.nome = p.username;
    else rivais.current.set(p.userId, { nome: p.username, avatar: p.avatar, posicoes: [] });
  }

  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados || typeof m.dados.userId !== 'number') return;
      const r = rivais.current.get(m.dados.userId);
      const { n, x, y, a, andou, b, v } = m.dados as unknown as PosicaoNaSala;
      if (!r || ![n, x, y, a, andou].every((q) => typeof q === 'number')) return;
      const ultima = r.posicoes.at(-1);
      if (ultima && ultima.n >= n) return;
      r.posicoes.push({ n, x, y, a, andou, b: typeof b === 'number' ? b : 0, v: typeof v === 'number' ? v : 0 });
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
    parar.current = rodarBarco({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      pista: def,
      piloto,
      meuAvatar: pilotos.find((p) => p.userId === eu)?.avatar ?? null,
      rivais: rivais.current,
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
    });
    return parar.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nomeDe = (id: number) => (id === -1 ? (pilotos.find((p) => p.userId === eu)?.username ?? '') : (pilotos.find((p) => p.userId === id)?.username ?? ''));
  const comTempos = chegou || fim;
  const ficaram = pilotos.filter((p) => p.posicao !== null).length;

  return (
    <div className="barco">
      <div className="barco-topo">
        <strong>{nomeDaPistaDoBarco(t, def.id)}</strong>
      </div>
      <div className="barco-tela" ref={tela} tabIndex={-1}>
        <canvas ref={canvas} width={W} height={H} />
        {!fim && piloto && !chegou && <Placar placar={placar} voltas={def.voltas} />}
        {!comTempos && ordem.length > 1 && (
          <ol className="barco-ordem" aria-live="off">
            {ordem.map((l, i) => (
              <li key={l.id} className={l.eu ? 'eu' : undefined}>
                <span>{i + 1}</span> {nomeDe(l.id)}
              </li>
            ))}
          </ol>
        )}
        {!fim && piloto && !chegou && <BotoesDeToque controles={controles} />}
        {comTempos && (
          <div className="barco-fim">
            <ol className="barco-classificacao">
              {pilotos.map((p) => (
                <li key={p.userId} className={p.userId === eu ? 'eu' : undefined}>
                  {/* a posição só no fim: antes, quem ainda corre pode fazer um tempo menor */}
                  <span className="barco-posicao">{fim ? marcaDoLugar(p.posicao, p.tempoMs !== null, ficaram) : ''}</span>
                  <span className="barco-quem">{p.username}</span>
                  <span className="barco-relogio">{p.tempoMs !== null ? tempoLegivel(p.tempoMs) : fim ? '—' : '…'}</span>
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
