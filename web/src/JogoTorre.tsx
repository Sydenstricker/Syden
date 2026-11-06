import { ComandosDoJogo } from './ComandosDosJogos';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { tempoLegivel } from './corrida/fisica';
import { useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import type { Agir } from './Minijogo';
import type { Partida } from './minijogos';
import { H, W } from './plataforma/desenho';
import { guardarPosicaoDoRival, type LinhaDaOrdem, type PosicaoDoRival, type Rival } from './plataforma/laco';
import { Bloco, COLUNAS, TORRES, torrePorId, type Torre } from './torre/fases';
import type { Comandos } from './torre/fisica';
import { rodarTorre } from './torre/laco';
import { nomeDaTorre } from './torre/nomes';
import './torre/torre.css';

/**
 * A TORRE DO CELEIRO (05/11/2026): a subida vertical, no motor do Pulo do coelho. Tábuas, fardos de feno, vigas que sobem e
 * descem, prateleiras que andam; a pá, o saco, o regador e o ancinho caem num roteiro fixo da torre, e os corvos cruzam o
 * celeiro. Encostar volta ao último andar. Chega ao cata-vento primeiro quem ganha. Tudo desenhado por código (torre/), e o
 * coelho é o do Pulo, com as cores do avatar de cada um. O laço é o mesmo nos dois jeitos de jogar (torre/laco.ts):
 * - NO SOLO, contra o relógio, com os fantasmas dos amigos; o tempo vai ao servidor, que o confere e guarda o melhor
 *   (server/src/minijogo-torre.ts).
 * - NA SALA, a turma sobe junto: o servidor dá o verde, repassa as posições e classifica pelo tempo de cada um.
 */

export interface EstadoTorre {
  fase: 'escolha' | 'correndo' | 'resultado' | 'largada' | 'fim';
  solo: boolean;
  pista: string;
  partidaId: string;
  // o Solo
  recordes?: { userId: number; nome: string; avatar: number | null; tempoMs: number }[];
  meuAvatar?: number | null;
  fantasmas?: { userId: number; nome: string; avatar: number | null; tempoMs: number; amostras: number[] }[];
  rodada?: number;
  resultado?: { tempoMs: number; recorde: boolean; anterior: number | null } | null;
  // a sala
  pilotos?: { userId: number; username: string; tempoMs: number | null; posicao: number | null; avatar: number | null }[];
  prazo?: boolean;
}

const MAX_FANTASMAS = 3;
const CONTAGEM = 3 * 60;
const MEDALHAS = ['🥇', '🥈', '🥉'];

const menosMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** O TECLADO E O TOQUE (os do Pulo do coelho): setas (ou A e D) andam, Espaço (ou seta para cima, W) pula. */
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

function usePlacar() {
  const [placar, setPlacar] = useState({ ms: 0, pausado: false, quedas: 0 });
  const atualizar = (p: { ms: number; pausado: boolean; quedas: number }) =>
    setPlacar((a) => (Math.floor(a.ms / 10) === Math.floor(p.ms / 10) && a.pausado === p.pausado && a.quedas === p.quedas ? a : p));
  return [placar, atualizar] as const;
}

function Placar({ placar }: { placar: { ms: number; quedas: number } }) {
  return (
    <div className="pulo-placar" aria-live="off">
      <span className="corrida-relogio">{tempoLegivel(placar.ms)}</span>
      {placar.quedas > 0 && <span aria-hidden="true">✖ {placar.quedas}</span>}
    </div>
  );
}

function Comandos({ solo = false }: { solo?: boolean }) {
  const t = useT();
  return (
    <>
      <ComandosDoJogo itens={[{ teclas: ['setas-lado'], rotulo: t('Andar') }, { teclas: ['espaco'], rotulo: t('Pular') }, ...(solo ? [comandoDaPausa(t)] : [])]} />
      <p className="settings-hint">{t('Suba até o cata-vento. O que cai e os corvos levam de volta ao último andar.')}</p>
    </>
  );
}

/** A miniatura de uma torre: ela inteira, de pé, para escolher (nenhum texto dentro). */
function MiniaturaDaTorre({ torre }: { torre: Torre }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const alto = Math.ceil(torre.linhas / 2);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const fundo: Record<string, string> = { celeiro: '#9a4a3a', paiol: '#7a5a3e', silo: '#3e4458' };
    ctx.fillStyle = fundo[torre.tema];
    ctx.fillRect(0, 0, COLUNAS * 2, alto);
    for (let l = 0; l < torre.linhas; l += 2) {
      for (let c = 0; c < COLUNAS; c++) {
        const b = Math.max(torre.blocos[l * COLUNAS + c], l + 1 < torre.linhas ? torre.blocos[(l + 1) * COLUNAS + c] : 0);
        if (!b) continue;
        ctx.fillStyle = b === Bloco.Feno ? '#e8c25a' : b === Bloco.Tabua ? '#d8a874' : '#54382a';
        ctx.fillRect(c * 2, l / 2, 2, 1);
      }
    }
    ctx.fillStyle = '#e3b45a';
    ctx.fillRect(COLUNAS - 1, Math.max(0, torre.chegada / 32 - 4), 2, 4);
  }, [torre, alto]);
  return <canvas ref={ref} width={COLUNAS * 2} height={alto} aria-hidden="true" className="torre-miniatura" />;
}

/** A ESCOLHA DA TORRE na sala (antes do convite). */
export function EscolhaDaTorre({ aoEscolher, aoVoltar }: { aoEscolher: (torre: string) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="torre">
      <ul className="torre-torres">
        {TORRES.map((f) => (
          <li key={f.id}>
            <button type="button" className="torre-botao" onClick={() => aoEscolher(f.id)}>
              <MiniaturaDaTorre torre={f} />
              <strong>{nomeDaTorre(t, f.id)}</strong>
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

export function JogoTorre(props: { estado: EstadoTorre & Partida; eu: number; jogador: boolean; restante: number; agir: Agir; socket: Socket | null; channelId: number }) {
  return props.estado.solo ? <TorreSolo {...props} /> : <TorreNaSala {...props} />;
}

// =====================================================================================================================
// O SOLO: contra o relógio
// =====================================================================================================================

function TorreSolo({ estado, eu, agir }: { estado: EstadoTorre & Partida; eu: number; agir: Agir }) {
  const t = useT();
  const recordes = estado.recordes ?? [];
  const def = torrePorId(estado.pista);
  const [escolhidos, setEscolhidos] = useState<Set<number> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [quedas, setQuedas] = useState(0);

  // os fantasmas que vêm marcados: o meu e os dos amigos logo acima de mim (o próximo alvo); refeito ao trocar de torre
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
      <div className="torre">
        <ul className="torre-torres" role="radiogroup">
          {TORRES.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                role="radio"
                aria-checked={f.id === estado.pista}
                className={`torre-botao${f.id === estado.pista ? ' escolhida' : ''}`}
                onClick={() => f.id !== estado.pista && tentar({ tipo: 'pista', pista: f.id })}
              >
                <MiniaturaDaTorre torre={f} />
                <strong>{nomeDaTorre(t, f.id)}</strong>
              </button>
            </li>
          ))}
        </ul>
        <div className="corrida-pista-nome">
          {meu && <span>{t('Seu recorde: {tempo}', { tempo: tempoLegivel(meu.tempoMs) })}</span>}
          <Comandos solo />
        </div>
        <fieldset className="corrida-fantasmas">
          <legend>{t('Subir contra')}</legend>
          {recordes.length > 0 && (
            <ul>
              {recordes.map((r) => (
                <li key={r.userId}>
                  <label>
                    <input type="checkbox" checked={marcados.has(r.userId)} disabled={!marcados.has(r.userId) && marcados.size >= MAX_FANTASMAS} onChange={() => alternar(r.userId)} />
                    <span className="corrida-quem">{r.nome}</span>
                    <span className="corrida-tempo">{tempoLegivel(r.tempoMs)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {outros.length === 0 && <p className="settings-hint">{t('Nenhum amigo subiu esta torre ainda.')}</p>}
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
    <div className="torre">
      <div className="corrida-tela torre-tela">
        <SubidaSolo key={`${estado.partidaId}-${estado.rodada ?? 0}`} estado={estado} def={def} agir={agir} aoQuedas={setQuedas} aoErro={setErro} />
        {estado.fase === 'resultado' && r && (
          <div className="corrida-fim">
            {r.recorde && <strong className="corrida-recorde">{t('Novo recorde!')}</strong>}
            <span className="corrida-relogio grande">{tempoLegivel(r.tempoMs)}</span>
            {quedas > 0 && <span aria-hidden="true">✖ {quedas}</span>}
            {!r.recorde && r.anterior !== null && <span className="settings-hint">{t('Seu recorde: {tempo}', { tempo: tempoLegivel(r.anterior) })}</span>}
            <div className="minijogo-acoes">
              <button type="button" className="btn-primary" onClick={correr}>
                {t('Jogar de novo')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => tentar({ tipo: 'escolher' })}>
                {t('Escolher a torre')}
              </button>
            </div>
          </div>
        )}
      </div>
      {estado.fase === 'correndo' && <Comandos solo />}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

function SubidaSolo({
  estado,
  def,
  agir,
  aoQuedas,
  aoErro,
}: {
  estado: EstadoTorre & Partida;
  def: Torre;
  agir: Agir;
  aoQuedas: (n: number) => void;
  aoErro: (e: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [placar, setPlacar] = usePlacar();
  const [acabou, setAcabou] = useState(false);
  const controles = useControles(estado.fase === 'correndo' && !acabou);
  // ESC pausa (só aqui, no Solo: na sala o relógio é o de todos)
  const { pausa, pausado, continuar } = usePausaComEsc(estado.fase === 'correndo' && !acabou);
  const quedas = useRef(0);
  useEffect(() => {
    if (!canvas.current) return;
    canvas.current.parentElement?.focus();
    return rodarTorre({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      torre: def,
      piloto: true,
        pausa,
      eu: 0,
      meuAvatar: estado.meuAvatar ?? null,
      fantasmas: (estado.fantasmas ?? []).map((f) => ({ amostras: f.amostras, avatar: f.avatar })),
      contagem: CONTAGEM,
      calmo: menosMovimento(),
      aoPlacar: (p) => {
        quedas.current = p.quedas;
        setPlacar(p);
      },
      aoChegar: (passos, caminho) => {
        setAcabou(true);
        aoQuedas(quedas.current);
        agir({ tipo: 'chegada', passos, amostras: caminho }).catch((e) => aoErro((e as Error).message));
      },
    });
    // a subida é uma por rodada (a `key` de quem chama): os fantasmas e a torre são os do começo dela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <canvas ref={canvas} width={W} height={H} />
      {!acabou && <Placar placar={placar} />}
      {!acabou && <BotoesDeToque controles={controles} />}
          {!acabou && pausado && <TelaDePausa aoContinuar={continuar} icone={false} />}
    </>
  );
}

// =====================================================================================================================
// NA SALA: a turma sobe junto
// =====================================================================================================================

const marcaDoLugar = (posicao: number | null, chegou: boolean, ficaram: number) =>
  posicao === null ? '–' : chegou && ficaram >= 2 && posicao <= 3 ? MEDALHAS[posicao - 1] : posicao;

function TorreNaSala({
  estado,
  eu,
  jogador,
  restante,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoTorre & Partida;
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
  const fim = estado.fase === 'fim' || estado.terminada;
  const pilotos = estado.pilotos ?? [];
  const seguir = useRef<{ id: number | null }>({ id: null });
  const [assistindo, setAssistindo] = useState<{ alvo: { id: number; nome: string } | null; subindo: { id: number; nome: string }[] }>({ alvo: null, subindo: [] });
  const trocarDeAmigo = (passo: number) => {
    const lista = assistindo.subindo;
    if (lista.length < 2) return;
    const i = Math.max(0, lista.findIndex((r) => r.id === assistindo.alvo?.id));
    seguir.current.id = lista[(i + passo + lista.length) % lista.length].id;
  };
  // aberta no meio da subida (a página recarregada): esta subida a pessoa ASSISTE (a regra do Pulo na sala)
  const [abriuNoMeio] = useState(() => estado.fase === 'correndo');
  const inscrito = jogador && pilotos.some((p) => p.userId === eu);
  const piloto = inscrito && !abriuNoMeio;
  const controles = useControles(piloto && !chegou && !fim);
  const rivais = useRef(new Map<number, Rival & { avatar?: number | null }>());
  const def = torrePorId(estado.pista);
  const meuAvatar = pilotos.find((p) => p.userId === eu)?.avatar ?? null;

  for (const p of pilotos) {
    if (p.userId === eu) continue;
    const r = rivais.current.get(p.userId);
    if (r) {
      r.nome = p.username;
      r.avatar = p.avatar;
    } else rivais.current.set(p.userId, { nome: p.username, posicoes: [], avatar: p.avatar });
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
    const p = rodarTorre({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      torre: def,
      piloto,
      eu,
      meuAvatar,
      rivais: rivais.current,
      contagem,
      calmo: menosMovimento(),
      aoPlacar: setPlacar,
      aoOrdem: setOrdem,
      aoPosicao: enviar,
      seguir: seguir.current,
      aoAssistir: (alvo, subindo) => setAssistindo({ alvo, subindo }),
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

  const nomeDe = (id: number) => pilotos.find((p) => p.userId === id)?.username ?? '';
  const comTempos = chegou || fim;
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
  const ficaram = pilotos.filter((p) => p.posicao !== null).length;

  return (
    <div className="torre">
      <div className="corrida-tela torre-tela" ref={tela} tabIndex={-1}>
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
            {assistindo.subindo.length > 1 && (
              <button type="button" aria-label="◀" onClick={() => trocarDeAmigo(-1)}>
                ◀
              </button>
            )}
            <span>{t('Assistindo {pessoa}', { pessoa: assistindo.alvo!.nome })}</span>
            {assistindo.subindo.length > 1 && (
              <button type="button" aria-label="▶" onClick={() => trocarDeAmigo(1)}>
                ▶
              </button>
            )}
          </div>
        )}
        {comTempos && (
          <div className={vendoAmigo ? 'corrida-fim pulo-fim-no-canto' : 'corrida-fim'}>
            <ol className="corrida-classificacao">
              {pilotos.map((p) => (
                <li key={p.userId} className={[p.userId === eu ? 'eu' : '', fim && p.posicao === null ? 'pulo-saiu' : ''].join(' ').trim() || undefined}>
                  {/* a posição só no fim (antes, quem ainda sobe pode fazer um tempo menor), e a do servidor */}
                  <span className="corrida-posicao">{!fim ? '' : marcaDoLugar(p.posicao, p.tempoMs !== null, ficaram)}</span>
                  <span className="corrida-quem">{p.username}</span>
                  <span className="corrida-relogio">{p.tempoMs !== null ? tempoLegivel(p.tempoMs) : fim ? '—' : '…'}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {inscrito && abriuNoMeio && !fim && <p className="settings-hint corrida-dica">{t('Esta subida já tinha começado quando você abriu: você assiste.')}</p>}
      {piloto && !fim && <Comandos />}
    </div>
  );
}
