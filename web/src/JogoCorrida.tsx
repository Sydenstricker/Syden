import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { useT } from './i18n';
import { passosEmMs, tempoLegivel, type Comandos } from './corrida/fisica';
import { pistaDaCorrida, rodarCorrida, type LinhaDaOrdem, type PosicaoDoRival, type Rival } from './corrida/laco';
import { HORTA } from './corrida/pista';
import { H, mapaDaPista, pontoNoMapa, W } from './corrida/render';
import type { Agir } from './Minijogo';
import type { Partida } from './minijogos';

/**
 * A CORRIDA DOS COELHOS (03/11/2026, pedido dele): kart de 16 bits. O coelho no kart é o mascote 3D renderizado em 24
 * ângulos (e2e/pixel-art/personagem/blender/meshy/kart.py); a pista e o resto, desenhados por código (corrida/).
 *
 * Dois jeitos de jogar, o mesmo laço (corrida/laco.ts):
 * - CONTRA O RELÓGIO (degrau 1, JogoCorrida): na aba Solo, com os FANTASMAS dos recordes dos amigos. Só o resultado vai
 *   ao servidor (server/src/corrida.ts): o melhor tempo e o fantasma.
 * - NA SALA (degrau 2, JogoCorridaNaSala): a turma corre junto. O servidor dá a largada e repassa as posições; cada um
 *   dirige no próprio computador, e a classificação é pelo tempo de cada um (server/src/minijogo-corrida.ts).
 * O degrau 3, combinado com ele: os itens, as copas e os troféus (do quarto, de quem ganhou; e o coletivo, do salão).
 */

interface Recorde {
  userId: number;
  username: string;
  nomeDeExibicao: string | null;
  tempoMs: number;
  voltas: number[];
}

interface Resultado {
  tempoMs: number;
  voltas: number[];
  recorde: boolean | null;
  anterior: number | null;
}

const MAX_FANTASMAS = 3;
const CONTAGEM = 3 * 60;
const MEDALHAS = ['🥇', '🥈', '🥉'];

/** O TECLADO E O TOQUE: setas ou WASD, Espaço (ou Shift) derrapa. Só enquanto `ativo`, e sem rolar a página. */
function useControles(ativo: boolean) {
  const comandos = useRef<Comandos>({ acelera: false, freia: false, vira: 0, derrapa: false });
  const lados = useRef({ esquerda: false, direita: false, toqueEsquerda: false, toqueDireita: false });
  const virar = () => {
    const l = lados.current;
    comandos.current.vira = (l.direita || l.toqueDireita ? 1 : 0) - (l.esquerda || l.toqueEsquerda ? 1 : 0);
  };
  useEffect(() => {
    if (!ativo) return;
    const c = comandos.current;
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      // escrevendo na conversa, as setas são do texto
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = e.key.toLowerCase();
      let usou = true;
      if (k === 'arrowup' || k === 'w') c.acelera = apertada;
      else if (k === 'arrowdown' || k === 's') c.freia = apertada;
      else if (k === 'arrowleft' || k === 'a') lados.current.esquerda = apertada;
      else if (k === 'arrowright' || k === 'd') lados.current.direita = apertada;
      else if (k === ' ' || k === 'shift') c.derrapa = apertada;
      else usou = false;
      virar();
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    // na tela de toque não há botão de acelerar: o kart acelera sozinho, e os dedos só viram e derrapam
    if (window.matchMedia?.('(pointer: coarse)').matches) c.acelera = true;
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      Object.assign(c, { acelera: false, freia: false, vira: 0, derrapa: false });
    };
  }, [ativo]);
  const tocar = (lado: 'toqueEsquerda' | 'toqueDireita', apertado: boolean) => {
    lados.current[lado] = apertado;
    virar();
  };
  return { comandos, tocar };
}

function BotoesDeToque({ controles }: { controles: ReturnType<typeof useControles> }) {
  const t = useT();
  const { comandos, tocar } = controles;
  const lado = (qual: 'toqueEsquerda' | 'toqueDireita') => ({
    onPointerDown: () => tocar(qual, true),
    onPointerUp: () => tocar(qual, false),
    onPointerCancel: () => tocar(qual, false),
    onPointerLeave: () => tocar(qual, false),
  });
  return (
    <div className="corrida-toque">
      <button type="button" aria-label={t('Virar para a esquerda')} {...lado('toqueEsquerda')}>
        ◀
      </button>
      <button
        type="button"
        aria-label={t('Derrapar')}
        onPointerDown={() => (comandos.current.derrapa = true)}
        onPointerUp={() => (comandos.current.derrapa = false)}
        onPointerCancel={() => (comandos.current.derrapa = false)}
      >
        ⤴
      </button>
      <button type="button" aria-label={t('Virar para a direita')} {...lado('toqueDireita')}>
        ▶
      </button>
    </div>
  );
}

/** O placar de cima: a volta e o relógio. */
function Placar({ placar }: { placar: { volta: number; ms: number } }) {
  return (
    <div className="corrida-placar" aria-live="off">
      <span>🏁 {placar.volta}/{HORTA.voltas}</span>
      <span className="corrida-relogio">{tempoLegivel(placar.ms)}</span>
    </div>
  );
}

/** Só muda o estado quando a volta, o centésimo ou a pausa mudam (o laço chama a cada quadro). */
function usePlacar() {
  const [placar, setPlacar] = useState({ volta: 0, ms: 0, pausado: false });
  const atualizar = (p: { volta: number; ms: number; pausado: boolean }) =>
    setPlacar((a) => (a.volta === p.volta && Math.floor(a.ms / 10) === Math.floor(p.ms / 10) && a.pausado === p.pausado ? a : p));
  return [placar, atualizar] as const;
}

// =====================================================================================================================
// CONTRA O RELÓGIO (a aba Solo)
// =====================================================================================================================

export function JogoCorrida({ eu, aoVoltar }: { eu: number; aoVoltar: () => void }) {
  const t = useT();
  const [fase, setFase] = useState<'largada' | 'correndo' | 'fim'>('largada');
  const [recordes, setRecordes] = useState<Recorde[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [placar, setPlacar] = usePlacar();
  const canvas = useRef<HTMLCanvasElement>(null);
  const controles = useControles(fase === 'correndo');
  /** Cada "Jogar de novo" é uma corrida nova, sem voltar à tela da largada. */
  const [rodada, setRodada] = useState(0);
  const tela = useRef<HTMLDivElement>(null);
  const mapaDaLargada = useRef<HTMLCanvasElement>(null);
  const pista = HORTA.id;

  const lerRecordes = () =>
    api<{ recordes: Recorde[] }>(`/api/corrida/${pista}`)
      .then((r) => {
        setRecordes(r.recordes);
        return r.recordes;
      })
      .catch(() => {
        setRecordes([]);
        return [] as Recorde[];
      });

  // Os recordes ao abrir: os fantasmas que vêm marcados são o meu e os dos amigos logo acima de mim (o próximo alvo).
  useEffect(() => {
    void lerRecordes().then((lista) => {
      const meu = lista.findIndex((r) => r.userId === eu);
      const ate = meu < 0 ? lista.length : meu;
      const acima = lista.slice(Math.max(0, ate - (MAX_FANTASMAS - 1)), ate).map((r) => r.userId);
      setEscolhidos(new Set([...(meu >= 0 ? [eu] : []), ...acima].slice(0, MAX_FANTASMAS)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O MAPA DA LARGADA: a pista é montada já aqui (uns 300 ms, uma vez por página), e a corrida começa sem espera.
  useEffect(() => {
    if (fase !== 'largada') return;
    const quadro = requestAnimationFrame(() => {
      const p = pistaDaCorrida();
      const alvo = mapaDaLargada.current?.getContext('2d');
      if (alvo) {
        alvo.imageSmoothingEnabled = false;
        alvo.drawImage(mapaDaPista(p, 112), 0, 0);
        pontoNoMapa(alvo, 0, 0, 112, p.largada.x, p.largada.y, '#ffa24a');
      }
    });
    return () => cancelAnimationFrame(quadro);
  }, [fase]);

  // A CORRIDA: baixa os fantasmas marcados, conta 3, 2, 1 e roda até a chegada.
  useEffect(() => {
    if (fase !== 'correndo' || !canvas.current) return;
    let vivo = true;
    let parar = () => {};
    tela.current?.focus();
    void (async () => {
      const fantasmas = (
        await Promise.all(
          [...escolhidos].map((id) =>
            api<{ amostras: number[] }>(`/api/corrida/${pista}/fantasma/${id}`)
              .then((r) => r.amostras)
              .catch(() => null),
          ),
        )
      ).filter((a): a is number[] => a !== null);
      if (!vivo || !canvas.current) return;
      parar = rodarCorrida({
        canvas: canvas.current,
        comandos: controles.comandos.current,
        piloto: true,
        eu,
        fantasmas,
        contagem: CONTAGEM,
        aoPlacar: setPlacar,
        aoChegar: (voltas, caminho) => {
          const tempoMs = passosEmMs(voltas[voltas.length - 1]);
          setResultado({ tempoMs, voltas: voltas.map(passosEmMs), recorde: null, anterior: null });
          setFase('fim');
          api<{ recorde: boolean; anterior: number | null; tempoMs: number }>(`/api/corrida/${pista}`, {
            method: 'POST',
            body: { voltas, amostras: caminho },
          })
            .then((r) => {
              setResultado({ tempoMs: r.tempoMs, voltas: voltas.map(passosEmMs), recorde: r.recorde, anterior: r.anterior });
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
  }, [fase === 'largada', rodada]);

  const meu = recordes?.find((r) => r.userId === eu) ?? null;
  const outros = recordes?.filter((r) => r.userId !== eu) ?? [];
  const nome = (r: Recorde) => r.nomeDeExibicao || r.username;
  const alternar = (id: number) =>
    setEscolhidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < MAX_FANTASMAS) n.add(id);
      return n;
    });

  return (
    <div className="corrida">
      {fase === 'largada' && (
        <div className="corrida-largada">
          <div className="corrida-pista">
            <canvas ref={mapaDaLargada} width={112} height={112} aria-hidden="true" />
            <div className="corrida-pista-nome">
              <strong>{t('Horta')}</strong>
              {meu && <span>{t('Seu recorde: {tempo}', { tempo: tempoLegivel(meu.tempoMs) })}</span>}
              <p className="settings-hint">{t('Setas para dirigir, Espaço para derrapar e carregar o turbo.')}</p>
            </div>
          </div>
          {recordes !== null && (
            <fieldset className="corrida-fantasmas">
              <legend>{t('Correr contra')}</legend>
              {recordes.length === 0 || (outros.length === 0 && !meu) ? null : (
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
              {outros.length === 0 && <p className="settings-hint">{t('Nenhum amigo correu nesta pista ainda.')}</p>}
            </fieldset>
          )}
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={() => setFase('correndo')}>
              {t('Começar')}
            </button>
            <button type="button" className="btn-secondary" onClick={aoVoltar}>
              {t('Outros jogos')}
            </button>
          </div>
        </div>
      )}

      {fase !== 'largada' && (
        <div className="corrida-tela" ref={tela} tabIndex={-1}>
          <canvas ref={canvas} width={W} height={H} />
          {fase === 'correndo' && <Placar placar={placar} />}
          {fase === 'correndo' && <BotoesDeToque controles={controles} />}
          {fase === 'fim' && resultado && (
            <div className="corrida-fim">
              {resultado.recorde && <strong className="corrida-recorde">{t('Novo recorde!')}</strong>}
              <span className="corrida-relogio grande">{tempoLegivel(resultado.tempoMs)}</span>
              <ol className="corrida-voltas">
                {resultado.voltas.map((v, i) => (
                  <li key={i}>
                    🏁 {i + 1} · {tempoLegivel(v - (i ? resultado.voltas[i - 1] : 0))}
                  </li>
                ))}
              </ol>
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
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

// =====================================================================================================================
// NA SALA (a turma corre junto)
// =====================================================================================================================

/** A corrida da sala, como o servidor a manda (server/src/minijogo-corrida.ts). */
export interface EstadoCorrida {
  fase: 'largada' | 'correndo' | 'fim';
  pista: string;
  voltasDaCorrida: number;
  /** Em ordem: quem chegou, pelo tempo; depois quem não chegou, pelo quanto andou. */
  pilotos: { userId: number; username: string; tempoMs: number | null; voltas: number[] }[];
  prazo: boolean;
}

export function JogoCorridaNaSala({
  estado,
  eu,
  jogador,
  restante,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoCorrida & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: Agir;
  socket: Socket | null;
  channelId: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const [placar, setPlacar] = usePlacar();
  const [ordem, setOrdem] = useState<LinhaDaOrdem[]>([]);
  const [chegou, setChegou] = useState(false);
  const piloto = jogador && estado.pilotos.some((p) => p.userId === eu);
  const controles = useControles(piloto && !chegou && !estado.terminada);
  const rivais = useRef(new Map<number, Rival>());
  const fim = estado.fase === 'fim' || estado.terminada;

  // os rivais: todo mundo da corrida menos eu, com o nome que a turma vê
  for (const p of estado.pilotos) {
    if (p.userId === eu) continue;
    const r = rivais.current.get(p.userId);
    if (r) r.nome = p.username;
    else rivais.current.set(p.userId, { nome: p.username, posicoes: [] });
  }

  // AS POSIÇÕES DOS OUTROS chegam pelo socket, já com quem mandou (o servidor carimba)
  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: { userId?: number } & Partial<PosicaoDoRival> }) => {
      if (m.channelId !== channelId || !m.dados || typeof m.dados.userId !== 'number') return;
      const r = rivais.current.get(m.dados.userId);
      const { n, x, y, a, andou } = m.dados;
      if (!r || typeof n !== 'number' || typeof x !== 'number' || typeof y !== 'number' || typeof a !== 'number' || typeof andou !== 'number') return;
      const ultima = r.posicoes.at(-1);
      if (ultima && ultima.n >= n) return;
      r.posicoes.push({ n, x, y, a, andou });
      if (r.posicoes.length > 2000) r.posicoes.splice(0, 1000);
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId]);

  // A CORRIDA: começa ao abrir, com a contagem que o servidor deu (quem abre atrasado larga na hora: o tempo é o dele)
  useEffect(() => {
    if (fim || !canvas.current) return;
    tela.current?.focus();
    const contagem = estado.fase === 'largada' ? Math.max(0, Math.round((restante * 60) / 1000)) : 0;
    const parar = rodarCorrida({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      piloto,
      eu,
      rivais: rivais.current,
      contagem,
      aoPlacar: setPlacar,
      aoOrdem: setOrdem,
      aoPosicao: (pos) => socket?.emit('minijogo:tempo-real', { channelId, dados: pos }),
      aoChegar: (voltas, caminho) => {
        setChegou(true);
        void agir({ tipo: 'chegada', voltas, amostras: caminho });
      },
    });
    return parar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nomeDe = (id: number) => estado.pilotos.find((p) => p.userId === id)?.username ?? '';
  // depois da minha chegada (e no fim), a lista que vale é a do servidor, com os tempos
  const comTempos = chegou || fim;

  return (
    <div className="corrida">
      <div className="corrida-tela" ref={tela} tabIndex={-1}>
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
        {comTempos && (
          <div className="corrida-fim">
            <ol className="corrida-classificacao">
              {estado.pilotos.map((p, i) => (
                <li key={p.userId} className={p.userId === eu ? 'eu' : undefined}>
                  {/* a posição só no fim: antes, quem ainda corre pode fazer um tempo menor (a tela não afirma o que não é) */}
                  <span className="corrida-posicao">{!fim ? '' : p.tempoMs !== null && i < 3 ? MEDALHAS[i] : i + 1}</span>
                  <span className="corrida-quem">{p.username}</span>
                  <span className="corrida-relogio">{p.tempoMs !== null ? tempoLegivel(p.tempoMs) : fim ? '—' : '…'}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
