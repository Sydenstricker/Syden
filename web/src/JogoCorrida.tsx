import { Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { useT } from './i18n';
import { passosEmMs, tempoLegivel, type Comandos } from './corrida/fisica';
import { rodarCorrida, type EventoDeItem, type Item, type LinhaDaOrdem, type PosicaoDoRival, type Rival } from './corrida/laco';
import { nomeDaPistaEm } from './corrida/nomes';
import { COPAS, HORTA, linhaDaPista, MUNDO, PISTAS, pistaPorId, type DefinicaoDaPista } from './corrida/pista';
import { H, pontoNoMapa, W } from './corrida/render';
import type { Agir } from './Minijogo';
import type { Partida } from './minijogos';
import { Trofeus } from './Trofeus';

/**
 * A CORRIDA DOS COELHOS (03/11/2026, pedido dele): kart de 16 bits. O coelho no kart é o mascote 3D renderizado em 24
 * ângulos (e2e/pixel-art/personagem/blender/meshy/kart.py); as pistas e o resto, desenhados por código (corrida/).
 *
 * Dois jeitos de jogar, o mesmo laço (corrida/laco.ts):
 * - CONTRA O RELÓGIO (degrau 1, JogoCorrida): na aba Solo, em qualquer das três pistas, com os FANTASMAS dos recordes dos
 *   amigos, e sem itens (o recorde é da pilotagem). Só o resultado vai ao servidor (server/src/corrida.ts).
 * - NA SALA (degraus 2 e 3, JogoCorridaNaSala): a turma corre junto, numa pista ou na Copa da Cenoura (as três seguidas),
 *   com os itens. O servidor dá a largada, repassa as posições e os itens, e classifica pelo tempo de cada um
 *   (server/src/minijogo-corrida.ts). O pódio vira TROFÉU no quarto de quem ganhou (Trofeus.tsx), e a copa
 *   corrida até o fim conta na conquista coletiva do salão.
 */

interface Recorde {
  userId: number;
  username: string;
  nomeDeExibicao: string | null;
  avatarPronto?: number | null;
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

/**
 * O TECLADO E O TOQUE: setas ou WASD, Espaço (ou Shift) derrapa, E (ou Ctrl) usa o item. Só enquanto `ativo`, e sem rolar
 * a página.
 */
function useControles(ativo: boolean) {
  const comandos = useRef<Comandos>({ acelera: false, freia: false, vira: 0, derrapa: false, usa: false });
  const lados = useRef({ esquerda: false, direita: false, toqueEsquerda: false, toqueDireita: false });
  const virar = () => {
    const l = lados.current;
    comandos.current.vira = (l.direita || l.toqueDireita ? 1 : 0) - (l.esquerda || l.toqueEsquerda ? 1 : 0);
  };
  useEffect(() => {
    if (!ativo) return;
    const c = comandos.current;
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      // escrevendo na conversa, as setas são do texto (mas soltar a tecla vale sempre, senão ela fica presa)
      const alvo = e.target as HTMLElement | null;
      if (apertada && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const k = e.key.toLowerCase();
      let usou = true;
      if (k === 'arrowup' || k === 'w') c.acelera = apertada;
      else if (k === 'arrowdown' || k === 's') c.freia = apertada;
      else if (k === 'arrowleft' || k === 'a') lados.current.esquerda = apertada;
      else if (k === 'arrowright' || k === 'd') lados.current.direita = apertada;
      else if (k === ' ' || k === 'shift') c.derrapa = apertada;
      else if (k === 'e' || k === 'control') c.usa = apertada;
      else usou = false;
      virar();
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    // trocou de janela com a tecla apertada: o "soltar" vai para a outra janela, e o kart seguiria virando sozinho
    const soltarTudo = () => {
      const toque = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      Object.assign(c, { acelera: toque, freia: false, vira: 0, derrapa: false, usa: false });
      Object.assign(lados.current, { esquerda: false, direita: false, toqueEsquerda: false, toqueDireita: false });
    };
    const escondeu = () => document.hidden && soltarTudo();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltarTudo);
    document.addEventListener('visibilitychange', escondeu);
    // na tela de toque não há botão de acelerar: o kart acelera sozinho, e os dedos só viram e derrapam
    if (window.matchMedia?.('(pointer: coarse)').matches) c.acelera = true;
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltarTudo);
      document.removeEventListener('visibilitychange', escondeu);
      Object.assign(c, { acelera: false, freia: false, vira: 0, derrapa: false, usa: false });
    };
  }, [ativo]);
  const tocar = (lado: 'toqueEsquerda' | 'toqueDireita', apertado: boolean) => {
    lados.current[lado] = apertado;
    virar();
  };
  return { comandos, tocar };
}

function BotoesDeToque({ controles, item }: { controles: ReturnType<typeof useControles>; item?: Item | null }) {
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
      {item && (
        <button
          type="button"
          aria-label={t('Usar o item')}
          onPointerDown={() => (comandos.current.usa = true)}
          onPointerUp={() => (comandos.current.usa = false)}
          onPointerCancel={() => (comandos.current.usa = false)}
        >
          {item === 'cenoura' ? '🥕' : item === 'repolho' ? '🥬' : '🟤'}
        </button>
      )}
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
function Placar({ placar, voltas }: { placar: { volta: number; ms: number }; voltas: number }) {
  return (
    <div className="corrida-placar" aria-live="off">
      <span>🏁 {placar.volta}/{voltas}</span>
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

/**
 * O mapa pequeno de uma pista, na escolha: SÓ A LINHA DO MEIO, com a largura do asfalto e a zebra em volta, nas cores do
 * mapa da corrida. Montar a pista inteira (o chão e a textura) para isto custava ~300 ms e ~24 MB por pista, e a escolha
 * mostra as seis (revisão independente, 03/11/2026).
 */
function MapaDaPista({ def, lado }: { def: DefinicaoDaPista; lado: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const alvo = ref.current?.getContext('2d');
    if (!alvo) return;
    const { lx, ly } = linhaDaPista(def);
    const k = lado / MUNDO;
    alvo.clearRect(0, 0, lado, lado);
    alvo.lineJoin = alvo.lineCap = 'round';
    const tracar = (cor: string, largura: number) => {
      alvo.beginPath();
      for (let i = 0; i < lx.length; i++) alvo[i ? 'lineTo' : 'moveTo'](lx[i] * k, ly[i] * k);
      alvo.closePath();
      alvo.strokeStyle = cor;
      alvo.lineWidth = largura;
      alvo.stroke();
    };
    tracar('rgb(214, 104, 92)', (2 * def.meiaLargura + 8) * k);
    tracar('rgb(236, 228, 214)', 2 * def.meiaLargura * k);
    // a largada fica três pontos antes da linha, como em montarPista
    const i0 = lx.length - 3;
    pontoNoMapa(alvo, 0, 0, lado, lx[i0], ly[i0], '#ffa24a');
  }, [def, lado]);
  return <canvas ref={ref} width={lado} height={lado} aria-hidden="true" style={{ background: corDoFundo(def) }} />;
}

const corDoFundo = (def: DefinicaoDaPista) => {
  const c = def.tema.grama[0];
  return `rgb(${c & 0xff}, ${(c >> 8) & 0xff}, ${(c >> 16) & 0xff})`;
};

/** A ESCOLHA DA PISTA da corrida na sala: as três, ou a copa com as três seguidas. */
export function EscolhaDaPista({ aoEscolher, aoVoltar }: { aoEscolher: (pista: string) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="corrida-escolha">
      <ul className="corrida-pistas">
        {PISTAS.map((def) => (
          <li key={def.id}>
            <button type="button" className="corrida-pista-botao" onClick={() => aoEscolher(def.id)}>
              <MapaDaPista def={def} lado={72} />
              <strong>{nomeDaPistaEm(t, def.id)}</strong>
            </button>
          </li>
        ))}
        {Object.entries(COPAS).map(([copa, pistas]) => (
          <li key={copa}>
            <button type="button" className="corrida-pista-botao copa" onClick={() => aoEscolher(copa)}>
              <span className="corrida-copa-mapas" aria-hidden="true">
                <Trophy size={40} />
              </span>
              <strong>{nomeDaPistaEm(t, copa)}</strong>
              <small>{pistas.map((p) => nomeDaPistaEm(t, p)).join(' · ')}</small>
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

export function JogoCorrida({ eu, aoVoltar }: { eu: number; aoVoltar: () => void }) {
  const t = useT();
  const [fase, setFase] = useState<'largada' | 'correndo' | 'fim'>('largada');
  const [def, setDef] = useState<DefinicaoDaPista>(HORTA);
  const [recordes, setRecordes] = useState<Recorde[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [placar, setPlacar] = usePlacar();
  const [vendoTrofeus, setVendoTrofeus] = useState(false);
  /** O meu avatar pronto (o servidor diz junto dos recordes): as cores do meu kart. */
  const [meuAvatar, setMeuAvatar] = useState<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controles = useControles(fase === 'correndo');
  /** Cada "Jogar de novo" é uma corrida nova, sem voltar à tela da largada. */
  const [rodada, setRodada] = useState(0);
  const tela = useRef<HTMLDivElement>(null);
  const pista = def.id;

  const lerRecordes = (id = pista) =>
    api<{ recordes: Recorde[]; meuAvatar?: number | null }>(`/api/corrida/${id}`)
      .then((r) => {
        setRecordes(r.recordes);
        setMeuAvatar(r.meuAvatar ?? null);
        return r.recordes;
      })
      .catch(() => {
        setRecordes([]);
        return [] as Recorde[];
      });

  // Os recordes da pista escolhida: os fantasmas que vêm marcados são o meu e os dos amigos logo acima de mim (o próximo alvo).
  useEffect(() => {
    setRecordes(null);
    void lerRecordes(pista).then((lista) => {
      const meu = lista.findIndex((r) => r.userId === eu);
      const ate = meu < 0 ? lista.length : meu;
      const acima = lista.slice(Math.max(0, ate - (MAX_FANTASMAS - 1)), ate).map((r) => r.userId);
      setEscolhidos(new Set([...(meu >= 0 ? [eu] : []), ...acima].slice(0, MAX_FANTASMAS)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pista]);

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
              .then((r) => ({ amostras: r.amostras, avatar: recordes?.find((x) => x.userId === id)?.avatarPronto ?? null }))
              .catch(() => null),
          ),
        )
      ).filter((a): a is { amostras: number[]; avatar: number | null } => a !== null);
      if (!vivo || !canvas.current) return;
      parar = rodarCorrida({
        canvas: canvas.current,
        comandos: controles.comandos.current,
        pista: def,
        piloto: true,
        eu,
        meuAvatar,
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
          {/* a escolha da pista: o mapa de cada uma, e a escolhida em destaque */}
          <ul className="corrida-pistas" role="radiogroup">
            {PISTAS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={p.id === pista}
                  className={`corrida-pista-botao${p.id === pista ? ' escolhida' : ''}`}
                  onClick={() => setDef(p)}
                >
                  <MapaDaPista def={p} lado={72} />
                  <strong>{nomeDaPistaEm(t, p.id)}</strong>
                </button>
              </li>
            ))}
          </ul>
          <div className="corrida-pista-nome">
            {meu && <span>{t('Seu recorde: {tempo}', { tempo: tempoLegivel(meu.tempoMs) })}</span>}
            <p className="settings-hint">{t('Setas para dirigir, Espaço para derrapar e carregar o turbo.')}</p>
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
        <div className="corrida-tela" ref={tela} tabIndex={-1}>
          <canvas ref={canvas} width={W} height={H} />
          {fase === 'correndo' && <Placar placar={placar} voltas={def.voltas} />}
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
 * saiu, que vem depois, sem posição nem medalha (revisão independente, 03/11/2026: a tela dava a medalha pela ordem da
 * lista, com quem saiu dentro dela, e o troféu guardado era outro).
 */
type LinhaDaCorrida = { userId: number; username: string; tempoMs: number | null; voltas?: number[]; avatar?: number | null; posicao?: number | null };

/** A marca do lugar no fim: a medalha só para quem tem resultado, entre 2 ou mais que ficaram (como o troféu); senão o número. */
const marcaDoLugar = (posicao: number | null | undefined, comResultado: boolean, ficaram: number) =>
  posicao === null || posicao === undefined ? '–' : comResultado && ficaram >= 2 && posicao <= 3 ? MEDALHAS[posicao - 1] : posicao;

/** A corrida da sala, como o servidor a manda (server/src/minijogo-corrida.ts). */
export interface EstadoCorrida {
  fase: 'largada' | 'correndo' | 'intervalo' | 'fim';
  /** A pista desta corrida (na copa, a da vez). */
  pista: string;
  /** A pista avulsa, ou a copa (o id dela). */
  categoria?: string;
  copa?: boolean;
  /** Na copa: qual corrida é esta (1 a 3), de quantas. */
  corrida?: number;
  corridas?: number;
  voltasDaCorrida: number;
  itens?: boolean;
  /** Em ordem: quem chegou, pelo tempo; depois quem não chegou, pelo quanto andou. */
  pilotos: LinhaDaCorrida[];
  /** Na copa: os pontos somados, do primeiro ao último. */
  placarDaCopa?: { userId: number; username: string; pontos: number; posicao?: number | null }[] | null;
  /** A classificação da corrida que acabou de acabar (no intervalo e no fim). */
  ultima?: LinhaDaCorrida[] | null;
  prazo: boolean;
}

export function JogoCorridaNaSala(props: {
  estado: EstadoCorrida & Partida;
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

  // entre as corridas da copa: a última corrida e o placar somado
  if (estado.fase === 'intervalo' || (fim && copa)) {
    const ficaram = (estado.placarDaCopa ?? []).filter((l) => l.posicao !== null && l.posicao !== undefined).length;
    return (
      <div className="corrida">
        {cabecalho}
        <div className="corrida-tela corrida-placar-da-copa">
          <div className="corrida-fim">
            <ol className="corrida-classificacao">
              {(estado.placarDaCopa ?? []).map((p) => (
                <li key={p.userId} className={p.userId === eu ? 'eu' : undefined}>
                  <span className="corrida-posicao">{fim ? marcaDoLugar(p.posicao, p.pontos > 0, ficaram) : (p.posicao ?? '–')}</span>
                  <span className="corrida-quem">{p.username}</span>
                  <span className="corrida-pontos">{p.pontos}</span>
                </li>
              ))}
            </ol>
            {estado.ultima && (
              <ol className="corrida-voltas corrida-ultima">
                {estado.ultima.map((p) => (
                  <li key={p.userId}>
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
      {/* uma corrida, um laço: na copa, cada corrida monta a sua (os rivais e os itens recomeçam) */}
      <CorridaDaSala key={`${estado.corrida ?? 1}-${estado.pista}`} {...props} fim={fim} />
    </div>
  );
}

function CorridaDaSala({
  estado,
  eu,
  jogador,
  restante,
  agir,
  socket,
  channelId,
  fim,
}: {
  estado: EstadoCorrida & Partida;
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
  const [item, setItem] = useState<Item | null>(null);
  const piloto = jogador && estado.pilotos.some((p) => p.userId === eu);
  const controles = useControles(piloto && !chegou && !fim);
  const rivais = useRef(new Map<number, Rival>());
  const eventos = useRef<EventoDeItem[]>([]);
  const def = pistaPorId(estado.pista);

  // os rivais: todo mundo da corrida menos eu, com o nome que a turma vê
  for (const p of estado.pilotos) {
    if (p.userId === eu) continue;
    const r = rivais.current.get(p.userId);
    if (r) r.nome = p.username;
    else rivais.current.set(p.userId, { nome: p.username, avatar: p.avatar ?? null, posicoes: [] });
  }

  // AS POSIÇÕES E OS ITENS DOS OUTROS chegam pelo socket, já com quem mandou (o servidor carimba)
  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados) return;
      const d = m.dados;
      if (d.tipo === 'repolho' || d.tipo === 'lama' || d.tipo === 'acertou') {
        if (typeof d.id === 'string' && !eventos.current.some((e) => e.id === d.id && e.tipo === d.tipo)) eventos.current.push(d as unknown as EventoDeItem);
        return;
      }
      if (typeof d.userId !== 'number') return;
      const r = rivais.current.get(d.userId);
      const { n, x, y, a, andou } = d as unknown as PosicaoDoRival;
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

  // A CORRIDA: começa ao abrir, com a contagem que o servidor deu (quem abre atrasado larga na hora: o tempo é o dele), e
  // PARA quando a corrida acaba (revisão de 03/11/2026: quem não tinha chegado seguia correndo atrás da classificação, e a
  // chegada depois do prazo dava "A partida acabou." embaixo dela)
  const pararCorrida = useRef<() => void>(() => {});
  const acabou = useRef(fim);
  acabou.current = fim;
  useEffect(() => {
    if (fim) pararCorrida.current();
  }, [fim]);
  useEffect(() => {
    if (fim || !canvas.current) return;
    tela.current?.focus();
    const contagem = estado.fase === 'largada' ? Math.max(0, Math.round((restante * 60) / 1000)) : 0;
    const enviar = (dados: unknown) => socket?.emit('minijogo:tempo-real', { channelId, dados });
    const parar = rodarCorrida({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      pista: def,
      piloto,
      eu,
      meuAvatar: estado.pilotos.find((p) => p.userId === eu)?.avatar ?? null,
      rivais: rivais.current,
      itens: estado.itens === false ? undefined : { eventos: eventos.current, aoEvento: enviar, aoItem: setItem },
      contagem,
      aoPlacar: setPlacar,
      aoOrdem: setOrdem,
      aoPosicao: enviar,
      aoChegar: (voltas, caminho) => {
        if (acabou.current) return;
        setChegou(true);
        void agir({ tipo: 'chegada', voltas, amostras: caminho });
      },
    });
    pararCorrida.current = parar;
    return parar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nomeDe = (id: number) => estado.pilotos.find((p) => p.userId === id)?.username ?? '';
  // depois da minha chegada (e no fim), a lista que vale é a do servidor, com os tempos
  const comTempos = chegou || fim;
  const ficaram = estado.pilotos.filter((p) => p.posicao !== null && p.posicao !== undefined).length;

  return (
    <>
      <div className="corrida-tela" ref={tela} tabIndex={-1}>
        <canvas ref={canvas} width={W} height={H} />
        {!fim && piloto && <Placar placar={placar} voltas={def.voltas} />}
        {!comTempos && ordem.length > 1 && (
          <ol className="corrida-ordem" aria-live="off">
            {ordem.map((l, i) => (
              <li key={l.id} className={l.eu ? 'eu' : undefined}>
                <span>{i + 1}</span> {l.eu ? nomeDe(eu) : l.nome}
              </li>
            ))}
          </ol>
        )}
        {!fim && piloto && !chegou && <BotoesDeToque controles={controles} item={item} />}
        {comTempos && (
          <div className="corrida-fim">
            <ol className="corrida-classificacao">
              {estado.pilotos.map((p) => (
                <li key={p.userId} className={p.userId === eu ? 'eu' : undefined}>
                  {/* a posição só no fim: antes, quem ainda corre pode fazer um tempo menor (a tela não afirma o que não é) */}
                  <span className="corrida-posicao">{!fim ? '' : marcaDoLugar(p.posicao, p.tempoMs !== null, ficaram)}</span>
                  <span className="corrida-quem">{p.username}</span>
                  <span className="corrida-relogio">{p.tempoMs !== null ? tempoLegivel(p.tempoMs) : fim ? '—' : '…'}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {piloto && !fim && <p className="settings-hint corrida-dica">{t('Setas para dirigir, Espaço para derrapar, E para usar o item.')}</p>}
    </>
  );
}
