import { ComandosDoJogo } from './ComandosDosJogos';
import { Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { tempoLegivel } from './corrida/fisica';
import { nomeDaPistaEm } from './corrida/nomes';
import { useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import type { Agir } from './Minijogo';
import type { Partida } from './minijogos';
import { H, W } from './plataforma/desenho';
import { COPAS_DO_PULO, FASES, fasePorId, type Fase } from './plataforma/fases';
import { passosEmMs, type Comandos } from './plataforma/fisica';
import { guardarPosicaoDoRival, rodarFase, type LinhaDaOrdem, type PosicaoDoRival, type Rival } from './plataforma/laco';
import { Trofeus } from './Trofeus';

/**
 * O PULO DO COELHO (03/11/2026): corrida de plataforma de 16 bits, só a mecânica (correr, pular mais alto segurando, a
 * folga da beirada, molas, plataformas que andam, buracos e espinhos que voltam ao posto). Tudo desenhado por código
 * (plataforma/), e o coelho é o mascote 3D de três quartos (web/scripts/plataforma-coelho.py).
 *
 * Como a Corrida dos coelhos, dois jeitos de jogar com o mesmo laço (plataforma/laco.ts):
 * - CONTRA O RELÓGIO (JogoPlataforma, aba Solo): uma das três fases, com os FANTASMAS dos recordes dos amigos. Só o
 *   resultado vai ao servidor (server/src/plataforma.ts).
 * - NA SALA (JogoPlataformaNaSala): a turma corre junto uma fase ou as três (a Copa do Pulo); o servidor dá a largada,
 *   repassa as posições e classifica pelo tempo de cada um (server/src/minijogo-plataforma.ts). O pódio vira troféu.
 */

interface Recorde {
  userId: number;
  username: string;
  nomeDeExibicao: string | null;
  tempoMs: number;
}

const MAX_FANTASMAS = 3;
const CONTAGEM = 3 * 60;
const MEDALHAS = ['🥇', '🥈', '🥉'];

/** O TECLADO E O TOQUE: setas (ou A e D) correm, Espaço (ou seta para cima, W) pula. Só enquanto `ativo`. */
function useControles(ativo: boolean) {
  const comandos = useRef<Comandos>({ esquerda: false, direita: false, pula: false });
  const teclas = useRef({ esquerda: false, direita: false, pula: false });
  const toque = useRef({ esquerda: false, direita: false, pula: false });
  const juntar = () => {
    const c = comandos.current, a = teclas.current, b = toque.current;
    c.esquerda = a.esquerda || b.esquerda;
    c.direita = a.direita || b.direita;
    c.pula = a.pula || b.pula;
  };
  useEffect(() => {
    if (!ativo) return;
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      // escrevendo na conversa, as teclas são do texto (mas soltar vale sempre, senão a tecla fica presa)
      const alvo = e.target as HTMLElement | null;
      if (apertada && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const a = teclas.current;
      let usou = true;
      if (k === 'arrowleft' || k === 'a') a.esquerda = apertada;
      else if (k === 'arrowright' || k === 'd') a.direita = apertada;
      else if (k === ' ' || k === 'arrowup' || k === 'w' || k === 'z') a.pula = apertada;
      else usou = false;
      juntar();
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltarTudo = () => {
      Object.assign(teclas.current, { esquerda: false, direita: false, pula: false });
      Object.assign(toque.current, { esquerda: false, direita: false, pula: false });
      juntar();
    };
    const escondeu = () => document.hidden && soltarTudo();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltarTudo);
    document.addEventListener('visibilitychange', escondeu);
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltarTudo);
      document.removeEventListener('visibilitychange', escondeu);
      soltarTudo();
    };
  }, [ativo]);
  const tocar = (qual: 'esquerda' | 'direita' | 'pula', apertado: boolean) => {
    toque.current[qual] = apertado;
    juntar();
  };
  return { comandos, tocar };
}

function BotoesDeToque({ controles }: { controles: ReturnType<typeof useControles> }) {
  const t = useT();
  const botao = (qual: 'esquerda' | 'direita' | 'pula') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      controles.tocar(qual, true);
    },
    onPointerUp: () => controles.tocar(qual, false),
    onPointerCancel: () => controles.tocar(qual, false),
    onPointerLeave: () => controles.tocar(qual, false),
  });
  return (
    <div className="pulo-toque">
      <div>
        <button type="button" aria-label={t('Para a esquerda')} {...botao('esquerda')}>
          ◀
        </button>
        <button type="button" aria-label={t('Para a direita')} {...botao('direita')}>
          ▶
        </button>
      </div>
      <button type="button" className="pulo-toque-pular" aria-label={t('Pular')} {...botao('pula')}>
        ⤒
      </button>
    </div>
  );
}

/** O placar de cima: o relógio, e quantas vezes caiu. */
function Placar({ placar }: { placar: { ms: number; quedas: number } }) {
  return (
    <div className="pulo-placar" aria-live="off">
      <span className="corrida-relogio">{tempoLegivel(placar.ms)}</span>
      {placar.quedas > 0 && <span aria-hidden="true">✖ {placar.quedas}</span>}
    </div>
  );
}

function usePlacar() {
  const [placar, setPlacar] = useState({ ms: 0, pausado: false, quedas: 0 });
  const atualizar = (p: { ms: number; pausado: boolean; quedas: number }) =>
    setPlacar((a) => (Math.floor(a.ms / 10) === Math.floor(p.ms / 10) && a.pausado === p.pausado && a.quedas === p.quedas ? a : p));
  return [placar, atualizar] as const;
}

/** A miniatura de uma fase: o recorte dos blocos, para escolher (nenhum texto dentro). */
function MiniaturaDaFase({ fase }: { fase: Fase }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const cores: Record<string, [string, string, string]> = { prado: ['#ecc8a6', '#8c6248', '#78a85a'], toca: ['#44363a', '#6e5a4e', '#7e8a62'], copas: ['#d8dcc8', '#7a5a40', '#6a9a52'] };
    const [ceu, chao, topo] = cores[fase.tema];
    ctx.fillStyle = ceu;
    ctx.fillRect(0, 0, 96, 28);
    // a fase inteira, reduzida: uma coluna de pixel a cada 2 casas
    for (let c = 0; c < fase.colunas; c += 2) {
      for (let l = 0; l < 14; l++) {
        const b = fase.blocos[l * fase.colunas + c];
        if (!b) continue;
        ctx.fillStyle = b === 1 ? (l > 0 && fase.blocos[(l - 1) * fase.colunas + c] === 1 ? chao : topo) : '#d46a4e';
        ctx.fillRect(Math.floor((c / fase.colunas) * 96), l * 2, 1, 2);
      }
    }
  }, [fase]);
  return <canvas ref={ref} width={96} height={28} aria-hidden="true" className="pulo-miniatura" />;
}

/** A ESCOLHA DA FASE na sala: uma das três, ou a copa (as três seguidas). */
export function EscolhaDaFase({ aoEscolher, aoVoltar }: { aoEscolher: (fase: string) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="corrida-escolha">
      <ul className="corrida-pistas">
        {FASES.map((f) => (
          <li key={f.id}>
            <button type="button" className="corrida-pista-botao" onClick={() => aoEscolher(f.id)}>
              <MiniaturaDaFase fase={f} />
              <strong>{nomeDaPistaEm(t, f.id)}</strong>
            </button>
          </li>
        ))}
        {Object.entries(COPAS_DO_PULO).map(([copa, fases]) => (
          <li key={copa}>
            <button type="button" className="corrida-pista-botao copa" onClick={() => aoEscolher(copa)}>
              <span className="corrida-copa-mapas" aria-hidden="true">
                <Trophy size={28} />
              </span>
              <strong>{nomeDaPistaEm(t, copa)}</strong>
              <small>{fases.map((id) => nomeDaPistaEm(t, id)).join(' · ')}</small>
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
// CONTRA O RELÓGIO (a aba Solo)
// =====================================================================================================================

export function JogoPlataforma({ eu, aoVoltar }: { eu: number; aoVoltar: () => void }) {
  const t = useT();
  const [fase, setFase] = useState<'largada' | 'correndo' | 'fim'>('largada');
  const [def, setDef] = useState<Fase>(FASES[0]);
  const [recordes, setRecordes] = useState<Recorde[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [resultado, setResultado] = useState<{ tempoMs: number; recorde: boolean | null; anterior: number | null; quedas: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [placar, setPlacar] = usePlacar();
  const [vendoTrofeus, setVendoTrofeus] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const controles = useControles(fase === 'correndo');
  // ESC pausa (só aqui, no Solo: na sala o relógio é o de todos)
  const { pausa, pausado, continuar } = usePausaComEsc(fase === 'correndo');
  /** Cada "Jogar de novo" é uma corrida nova. */
  const [rodada, setRodada] = useState(0);
  const quedas = useRef(0);
  const id = def.id;

  const lerRecordes = (qual = id) =>
    api<{ recordes: Recorde[] }>(`/api/plataforma/${qual}`)
      .then((r) => {
        setRecordes(r.recordes);
        return r.recordes;
      })
      .catch(() => {
        setRecordes([]);
        return [] as Recorde[];
      });

  // os recordes da fase escolhida: marcados, o meu e os dos amigos logo acima de mim (o próximo alvo)
  useEffect(() => {
    let vivo = true;
    setRecordes(null);
    void lerRecordes(id).then((lista) => {
      if (!vivo) return;
      const meu = lista.findIndex((r) => r.userId === eu);
      const ate = meu < 0 ? lista.length : meu;
      const acima = lista.slice(Math.max(0, ate - (MAX_FANTASMAS - 1)), ate).map((r) => r.userId);
      setEscolhidos(new Set([...(meu >= 0 ? [eu] : []), ...acima].slice(0, MAX_FANTASMAS)));
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // A FASE: baixa os fantasmas marcados, conta 3, 2, 1 e roda até a chegada
  useEffect(() => {
    if (fase !== 'correndo' || !canvas.current) return;
    let vivo = true;
    let parar = () => {};
    tela.current?.focus();
    void (async () => {
      const fantasmas = (
        await Promise.all([...escolhidos].map((quem) => api<{ amostras: number[] }>(`/api/plataforma/${id}/fantasma/${quem}`).catch(() => null)))
      ).filter((a): a is { amostras: number[] } => a !== null);
      if (!vivo || !canvas.current) return;
      parar = rodarFase({
        canvas: canvas.current,
        comandos: controles.comandos.current,
        fase: def,
        piloto: true,
        pausa,
        eu,
        fantasmas,
        contagem: CONTAGEM,
        aoPlacar: (p) => {
          quedas.current = p.quedas;
          setPlacar(p);
        },
        aoChegar: (passos, caminho) => {
          if (!vivo) return;
          const tempoMs = passosEmMs(passos);
          setResultado({ tempoMs, recorde: null, anterior: null, quedas: quedas.current });
          setFase('fim');
          api<{ recorde: boolean; anterior: number | null; tempoMs: number }>(`/api/plataforma/${id}`, { method: 'POST', body: { passos, amostras: caminho } })
            .then((r) => {
              setResultado((a) => (a ? { ...a, tempoMs: r.tempoMs, recorde: r.recorde, anterior: r.anterior } : a));
              void lerRecordes();
            })
            .catch((e) => setErro((e as Error).message));
        },
      });
    })();
    return () => {
      vivo = false;
      parar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase === 'correndo', rodada]);

  const meu = recordes?.find((r) => r.userId === eu) ?? null;
  const outros = recordes?.filter((r) => r.userId !== eu) ?? [];
  const nome = (r: Recorde) => r.nomeDeExibicao || r.username;
  const alternar = (quem: number) =>
    setEscolhidos((s) => {
      const n = new Set(s);
      if (n.has(quem)) n.delete(quem);
      else if (n.size < MAX_FANTASMAS) n.add(quem);
      return n;
    });

  return (
    <div className="corrida pulo">
      {fase === 'largada' && (
        <div className="corrida-largada">
          <ul className="corrida-pistas" role="radiogroup">
            {FASES.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={f.id === id}
                  className={`corrida-pista-botao${f.id === id ? ' escolhida' : ''}`}
                  onClick={() => setDef(f)}
                >
                  <MiniaturaDaFase fase={f} />
                  <strong>{nomeDaPistaEm(t, f.id)}</strong>
                </button>
              </li>
            ))}
          </ul>
          <div className="corrida-pista-nome">
            {meu && <span>{t('Seu recorde: {tempo}', { tempo: tempoLegivel(meu.tempoMs) })}</span>}
            <ComandosDoJogo itens={[{ teclas: ['setas-lado'], rotulo: t('Correr') }, { teclas: ['espaco'], rotulo: t('Pular') }, comandoDaPausa(t)]} />
            <p className="settings-hint">{t('Setas para correr, Espaço para pular (segure para ir mais alto).')}</p>
          </div>
          {recordes !== null && (
            <fieldset className="corrida-fantasmas">
              <legend>{t('Correr contra')}</legend>
              {recordes.length > 0 && (
                <ul>
                  {recordes.map((r) => (
                    <li key={r.userId}>
                      <label>
                        <input
                          type="checkbox"
                          checked={escolhidos.has(r.userId)}
                          disabled={!escolhidos.has(r.userId) && escolhidos.size >= MAX_FANTASMAS}
                          onChange={() => alternar(r.userId)}
                        />
                        <span className="corrida-quem">{nome(r)}</span>
                        <span className="corrida-tempo">{tempoLegivel(r.tempoMs)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {outros.length === 0 && <p className="settings-hint">{t('Nenhum amigo jogou esta fase ainda.')}</p>}
            </fieldset>
          )}
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={() => setFase('correndo')}>
              {t('Começar')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setVendoTrofeus(true)}>
              <Trophy size={14} aria-hidden="true" /> {t('Troféus')}
            </button>
            <button type="button" className="btn-secondary" onClick={aoVoltar}>
              {t('Outros jogos')}
            </button>
          </div>
        </div>
      )}

      {fase !== 'largada' && (
        <div className="corrida-tela pulo-tela" ref={tela} tabIndex={-1}>
          <canvas key={rodada} ref={canvas} width={W} height={H} />
          {fase === 'correndo' && <Placar placar={placar} />}
          {fase === 'correndo' && <BotoesDeToque controles={controles} />}
          {fase === 'correndo' && pausado && <TelaDePausa aoContinuar={continuar} icone={false} />}
          {fase === 'fim' && resultado && (
            <div className="corrida-fim">
              {resultado.recorde && <strong className="corrida-recorde">{t('Novo recorde!')}</strong>}
              <span className="corrida-relogio grande">{tempoLegivel(resultado.tempoMs)}</span>
              {resultado.quedas > 0 && <span aria-hidden="true">✖ {resultado.quedas}</span>}
              {resultado.recorde === false && resultado.anterior !== null && (
                <span className="settings-hint">{t('Seu recorde: {tempo}', { tempo: tempoLegivel(resultado.anterior) })}</span>
              )}
              <div className="minijogo-acoes">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setResultado(null);
                    setFase('correndo');
                    setRodada((r) => r + 1);
                  }}
                >
                  {t('Jogar de novo')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setFase('largada')}>
                  {t('Correr contra')}
                </button>
                <button type="button" className="btn-secondary" onClick={aoVoltar}>
                  {t('Outros jogos')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {vendoTrofeus && <Trofeus aoFechar={() => setVendoTrofeus(false)} />}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

// =====================================================================================================================
// NA SALA (a turma corre junto)
// =====================================================================================================================

/**
 * `posicao` vem do servidor: só entre quem ficou até o fim (empatados dividem, a mesma conta do troféu); null para quem
 * saiu, que vem depois, sem posição nem medalha.
 */
type LinhaDoPulo = { userId: number; username: string; tempoMs: number | null; posicao: number | null };

/** O Pulo do coelho da sala, como o servidor o manda (server/src/minijogo-plataforma.ts). */
export interface EstadoPlataforma {
  fase: 'largada' | 'correndo' | 'intervalo' | 'fim';
  pista: string;
  categoria?: string;
  copa?: boolean;
  corrida?: number;
  corridas?: number;
  pilotos: LinhaDoPulo[];
  placarDaCopa?: { userId: number; username: string; pontos: number; soma: number | null; posicao: number | null }[] | null;
  ultima?: LinhaDoPulo[] | null;
  prazo: boolean;
}

/**
 * O que vai no lugar da posição, no fim: a medalha (só com 2 ou mais que ficaram, e com resultado de verdade, como o
 * troféu), o número da posição, ou "–" para quem saiu.
 */
const marcaDoLugar = (posicao: number | null, comResultado: boolean, ficaram: number) =>
  posicao === null ? '–' : comResultado && ficaram >= 2 && posicao <= 3 ? MEDALHAS[posicao - 1] : posicao;

export function JogoPlataformaNaSala(props: {
  estado: EstadoPlataforma & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: Agir;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const { estado, eu } = props;
  const fim = estado.fase === 'fim' || estado.terminada;
  const copa = estado.copa === true;
  const cabecalho = copa && (
    <div className="corrida-copa-topo">
      <strong>{nomeDaPistaEm(t, estado.categoria ?? '')}</strong>
      <span>
        {t('Rodada {n} de {total}', { n: estado.corrida ?? 1, total: estado.corridas ?? 3 })} · {nomeDaPistaEm(t, estado.pista)}
      </span>
    </div>
  );

  if (estado.fase === 'intervalo' || (fim && copa)) {
    const placar = estado.placarDaCopa ?? [];
    // a posição vem do servidor, só entre quem correu todas as fases até aqui (a mesma do troféu); quem saiu, sem posição
    const ficaram = placar.filter((l) => l.posicao !== null).length;
    return (
      <div className="corrida">
        {cabecalho}
        <div className="corrida-tela corrida-placar-da-copa">
          <div className="corrida-fim">
            <ol className="corrida-classificacao">
              {placar.map((p) => (
                <li key={p.userId} className={[p.userId === eu ? 'eu' : '', p.posicao === null ? 'pulo-saiu' : ''].join(' ').trim() || undefined}>
                  <span className="corrida-posicao">{fim ? marcaDoLugar(p.posicao, p.pontos > 0, ficaram) : (p.posicao ?? '–')}</span>
                  <span className="corrida-quem">{p.username}</span>
                  <span className="corrida-pontos">{p.pontos}</span>
                </li>
              ))}
            </ol>
            {estado.ultima && (
              <ol className="corrida-voltas corrida-ultima">
                {estado.ultima.map((p) => (
                  <li key={p.userId} className={p.posicao === null ? 'pulo-saiu' : undefined}>
                    {p.posicao ?? '–'}. {p.username} · {p.tempoMs !== null ? tempoLegivel(p.tempoMs) : '—'}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="corrida">
      {cabecalho}
      {/* uma fase, um laço: na copa, cada fase monta o seu (os rivais recomeçam) */}
      <FaseDaSala key={`${estado.corrida ?? 1}-${estado.pista}`} {...props} fim={fim} />
    </div>
  );
}

function FaseDaSala({
  estado,
  eu,
  jogador,
  restante,
  agir,
  socket,
  channelId,
  fim,
}: {
  estado: EstadoPlataforma & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: Agir;
  socket: Socket | null;
  channelId: number;
  fim: boolean;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const [placar, setPlacar] = usePlacar();
  const [ordem, setOrdem] = useState<LinhaDaOrdem[]>([]);
  const [chegou, setChegou] = useState(false);
  // depois de chegar, a câmera vai para quem ainda corre (o laço escolhe; as setas e os botões trocam)
  const seguir = useRef<{ id: number | null }>({ id: null });
  const [assistindo, setAssistindo] = useState<{ alvo: { id: number; nome: string } | null; correndo: { id: number; nome: string }[] }>({ alvo: null, correndo: [] });
  const trocarDeAmigo = (passo: number) => {
    const lista = assistindo.correndo;
    if (lista.length < 2) return;
    const i = Math.max(0, lista.findIndex((r) => r.id === assistindo.alvo?.id));
    seguir.current.id = lista[(i + passo + lista.length) % lista.length].id;
  };
  // ABERTA NO MEIO DA FASE (a página recarregada, o painel aberto depois do verde): esta fase a pessoa ASSISTE (revisão
  // independente, 03/11/2026). Antes ela corria de novo do passo 0, com o relógio limpo, como se fosse a primeira vez; o
  // servidor não aceita mais essa chegada, e a tela não finge que ela conta. Na copa, a fase seguinte monta de novo, na
  // largada, e ela corre.
  const [abriuNoMeio] = useState(() => estado.fase === 'correndo');
  const inscrito = jogador && estado.pilotos.some((p) => p.userId === eu);
  const piloto = inscrito && !abriuNoMeio;
  const controles = useControles(piloto && !chegou && !fim);
  const rivais = useRef(new Map<number, Rival>());
  const def = fasePorId(estado.pista);

  for (const p of estado.pilotos) {
    if (p.userId === eu) continue;
    const r = rivais.current.get(p.userId);
    if (r) r.nome = p.username;
    else rivais.current.set(p.userId, { nome: p.username, posicoes: [] });
  }

  // AS POSIÇÕES DOS OUTROS chegam pelo socket, já com quem mandou (o servidor carimba)
  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados || typeof m.dados.userId !== 'number') return;
      const r = rivais.current.get(m.dados.userId);
      const { n, x, y, j, andou } = m.dados as unknown as PosicaoDoRival;
      if (!r || ![n, x, y, j, andou].every((v) => typeof v === 'number')) return;
      guardarPosicaoDoRival(r, { n, x, y, j, andou });
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId]);

  // A FASE: começa ao abrir, com a contagem que o servidor deu, e PARA quando a partida acaba
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
    const p = rodarFase({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      fase: def,
      piloto,
      eu,
      rivais: rivais.current,
      contagem,
      aoPlacar: setPlacar,
      aoOrdem: setOrdem,
      aoPosicao: enviar,
      seguir: seguir.current,
      aoAssistir: (alvo, correndo) => setAssistindo({ alvo, correndo }),
      aoChegar: (passos, caminho) => {
        if (acabou.current) return;
        setChegou(true);
        void agir({ tipo: 'chegada', passos, amostras: caminho });
      },
    });
    parar.current = p;
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nomeDe = (id: number) => estado.pilotos.find((p) => p.userId === id)?.username ?? '';
  const comTempos = chegou || fim;
  // chegou e há amigo correndo: a tela é a dele, e os tempos vão para o canto
  const vendoAmigo = chegou && !fim && assistindo.alvo !== null;
  useEffect(() => {
    if (!vendoAmigo) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') trocarDeAmigo(-1);
      else if (e.key === 'ArrowRight') trocarDeAmigo(1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });
  const ficaram = estado.pilotos.filter((p) => p.posicao !== null).length;

  return (
    <>
      <div className="corrida-tela pulo-tela" ref={tela} tabIndex={-1}>
        <canvas ref={canvas} width={W} height={H} />
        {!fim && piloto && <Placar placar={placar} />}
        {!comTempos && ordem.length > 1 && (
          <ol className="corrida-ordem" aria-live="off">
            {ordem.map((l, i) => (
              <li key={l.id} className={l.eu ? 'eu' : undefined}>
                <span>{i + 1}</span> {l.eu ? nomeDe(eu) : l.nome}
              </li>
            ))}
          </ol>
        )}
        {!fim && piloto && !chegou && <BotoesDeToque controles={controles} />}
        {vendoAmigo && (
          <div className="pulo-assistindo">
            {assistindo.correndo.length > 1 && (
              <button type="button" aria-label="◀" onClick={() => trocarDeAmigo(-1)}>
                ◀
              </button>
            )}
            <span>{t('Assistindo {pessoa}', { pessoa: assistindo.alvo!.nome })}</span>
            {assistindo.correndo.length > 1 && (
              <button type="button" aria-label="▶" onClick={() => trocarDeAmigo(1)}>
                ▶
              </button>
            )}
          </div>
        )}
        {comTempos && (
          <div className={vendoAmigo ? 'corrida-fim pulo-fim-no-canto' : 'corrida-fim'}>
            <ol className="corrida-classificacao">
              {estado.pilotos.map((p) => (
                <li key={p.userId} className={[p.userId === eu ? 'eu' : '', fim && p.posicao === null ? 'pulo-saiu' : ''].join(' ').trim() || undefined}>
                  {/* a posição só no fim (antes, quem ainda corre pode fazer um tempo menor), e a do servidor: só entre quem
                      ficou, empatados dividem, a mesma do troféu */}
                  <span className="corrida-posicao">{!fim ? '' : marcaDoLugar(p.posicao, p.tempoMs !== null, ficaram)}</span>
                  <span className="corrida-quem">{p.username}</span>
                  <span className="corrida-relogio">{p.tempoMs !== null ? tempoLegivel(p.tempoMs) : fim ? '—' : '…'}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {inscrito && abriuNoMeio && !fim && <p className="settings-hint corrida-dica">{t('Esta fase já tinha começado quando você abriu: você assiste.')}</p>}
      {piloto && !fim && <ComandosDoJogo itens={[{ teclas: ['setas-lado'], rotulo: t('Correr') }, { teclas: ['espaco'], rotulo: t('Pular') }]} />}
      {piloto && !fim && <p className="settings-hint corrida-dica">{t('Setas para correr, Espaço para pular (segure para ir mais alto).')}</p>}
    </>
  );
}
