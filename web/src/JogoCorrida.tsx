import { ComandosDoJogo } from './ComandosDosJogos';
import { Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { chave, useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import { passosEmMs, tempoLegivel, type Comandos } from './corrida/fisica';
import { diferencaLegivel, criarParciais, MEDALHAS_DA_CORRIDA, medalhaDaCorrida, parciaisDoFantasma, TEMPO_DO_PILOTO } from './corrida/parciais';
import { pistaDaCorrida, rodarCorrida, TIPOS_DE_EVENTO, type EventoDeItem, type Item, type LinhaDaClassificacao, type LinhaDaOrdem, type PosicaoDoRival, type Rival } from './corrida/laco';
import { nomeDaPistaEm } from './corrida/nomes';
import { COPAS, espelhar, HORTA, linhaDaPista, MUNDO, PISTAS, pistaPorId, type DefinicaoDaPista } from './corrida/pista';
import { DIFICULDADES_DA_CORRIDA, PONTOS_DA_COPA, somarPontos, type DificuldadeDaCorrida, type PontosNaCopa } from './corrida/robos';
import { H, pontoNoMapa, W } from './corrida/render';
import type { Agir } from './Minijogo';
import type { Partida } from './minijogos';
import { Trofeus } from './Trofeus';
import { useMusicaDoJogo } from './musicaDosJogos';
import './corrida.css';

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
  avatarPronto?: number | string | null;
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
 * O TECLADO E O TOQUE: setas ou WASD, Espaço (ou Shift) derrapa, E (ou Ctrl) usa o item, Q segurado olha para trás. Só
 * enquanto `ativo`, e sem rolar a página.
 */
function useControles(ativo: boolean) {
  const comandos = useRef<Comandos>({ acelera: false, freia: false, vira: 0, derrapa: false, usa: false, olha: false });
  /** As setas do teclado, e o VOLANTE do toque (−1 … 1, proporcional: a física aceita o volante parcial). */
  const lados = useRef({ esquerda: false, direita: false, toque: 0 });
  const virar = () => {
    const l = lados.current;
    const teclado = (l.direita ? 1 : 0) - (l.esquerda ? 1 : 0);
    comandos.current.vira = teclado !== 0 ? teclado : l.toque;
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
      else if (k === 'q') c.olha = apertada;
      else usou = false;
      virar();
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    // trocou de janela com a tecla apertada: o "soltar" vai para a outra janela, e o kart seguiria virando sozinho
    const soltarTudo = () => {
      const toque = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      Object.assign(c, { acelera: toque, freia: false, vira: 0, derrapa: false, usa: false, olha: false });
      Object.assign(lados.current, { esquerda: false, direita: false, toque: 0 });
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
      Object.assign(c, { acelera: false, freia: false, vira: 0, derrapa: false, usa: false, olha: false });
    };
  }, [ativo]);
  const volante = (vira: number) => {
    lados.current.toque = vira;
    virar();
  };
  return { comandos, volante };
}

/** A figura do item no botão de toque (as três cenouras com quantas faltam). */
const EMOJI_DO_ITEM: Record<Item, string> = {
  cenoura: '🥕',
  cenouras: '🥕',
  repolho: '🥬',
  'repolho-roxo': '🟣',
  lama: '🟤',
  alface: '🥗',
  toca: '🕳️',
  regador: '🌧️',
};

/**
 * O VOLANTE DO TOQUE (20/11/2026, a segunda auditoria): no lugar dos dois botões ◀ ▶, uma faixa larga em que o dedo vira o
 * quanto está longe do meio: tocar na ponta é a curva inteira (como os botões de antes), e arrastar dá a curva parcial. O
 * meio tem uma folga, para o dedo parado não virar sozinho.
 */
function Volante({ aoVirar }: { aoVirar: (vira: number) => void }) {
  const t = useT();
  const ponto = useRef<HTMLSpanElement>(null);
  const mostrar = (vira: number) => {
    if (ponto.current) ponto.current.style.transform = `translateX(calc(${vira} * var(--volante-curso)))`;
  };
  const ler = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - (r.left + r.width / 2)) / ((r.width / 2) * 0.8);
    const folga = 0.12;
    const vira = Math.abs(f) <= folga ? 0 : Math.sign(f) * Math.min(1, (Math.abs(f) - folga) / (1 - folga));
    aoVirar(vira);
    mostrar(vira);
  };
  const soltar = () => {
    aoVirar(0);
    mostrar(0);
  };
  return (
    <div
      className="corrida-volante"
      role="group"
      aria-label={t('Dirigir')}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        ler(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) ler(e);
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onLostPointerCapture={soltar}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span aria-hidden="true">◀</span>
      <span className="corrida-volante-ponto" ref={ponto} aria-hidden="true" />
      <span aria-hidden="true">▶</span>
    </div>
  );
}

function BotoesDeToque({ controles, item, usos = 1 }: { controles: ReturnType<typeof useControles>; item?: Item | null; usos?: number }) {
  const t = useT();
  const { comandos, volante } = controles;
  const segurar = (campo: 'usa' | 'olha' | 'derrapa' | 'freia') => ({
    onPointerDown: () => (comandos.current[campo] = true),
    onPointerUp: () => (comandos.current[campo] = false),
    onPointerCancel: () => (comandos.current[campo] = false),
    onPointerLeave: () => (comandos.current[campo] = false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  return (
    <div className="corrida-toque">
      <Volante aoVirar={volante} />
      {item && (
        <button type="button" aria-label={t('Usar o item')} {...segurar('usa')} onPointerLeave={undefined}>
          {EMOJI_DO_ITEM[item]}
          {usos > 1 && <small>×{usos}</small>}
        </button>
      )}
      <button type="button" aria-label={t('Olhar para trás')} {...segurar('olha')}>
        👀
      </button>
      {/* FREAR E DAR RÉ (20/11/2026): no toque o kart acelera sozinho, e sem isto não havia como frear nem sair de ré de um canto */}
      <button type="button" aria-label={t('Frear')} {...segurar('freia')}>
        ▼
      </button>
      <button type="button" aria-label={t('Derrapar')} {...segurar('derrapa')} onPointerLeave={undefined}>
        ⤴
      </button>
    </div>
  );
}

const FIGURA_DA_MEDALHA = ['🥇', '🥈', '🥉'];
const NOME_DA_MEDALHA = [chave('Ouro'), chave('Prata'), chave('Bronze')];

/**
 * AS MEDALHAS DO CONTRA O RELÓGIO (20/11/2026), como as da Torre: na escolha, os três tempos a bater; no fim, a que a corrida
 * ganhou. Só tela: o servidor guarda o tempo, não a medalha (corrida/parciais.ts).
 */
function MedalhasDaCorrida({ pista, tempoMs }: { pista: string; tempoMs?: number }) {
  const t = useT();
  const base = TEMPO_DO_PILOTO[pista];
  if (!base) return null;
  if (tempoMs !== undefined) {
    const m = medalhaDaCorrida(pista, Math.round((tempoMs * 60) / 1000));
    if (m === null) return null;
    return (
      <span className="corrida-medalha-ganha" role="img" aria-label={t(NOME_DA_MEDALHA[m])} title={t(NOME_DA_MEDALHA[m])}>
        {FIGURA_DA_MEDALHA[m]}
      </span>
    );
  }
  return (
    <span className="corrida-medalhas">
      {MEDALHAS_DA_CORRIDA.map((fator, i) => (
        <span key={i} title={t(NOME_DA_MEDALHA[i])}>
          <span role="img" aria-label={t(NOME_DA_MEDALHA[i])}>{FIGURA_DA_MEDALHA[i]}</span> {tempoLegivel(passosEmMs(Math.round(base * fator)))}
        </span>
      ))}
    </span>
  );
}

/** A diferença da última parcial para o fantasma de referência: verde à frente, vermelho atrás, por 2,5 s. */
function Parcial({ parcial }: { parcial: { ms: number; vez: number } | null }) {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    if (!parcial) return;
    setVisivel(true);
    const id = setTimeout(() => setVisivel(false), 2500);
    return () => clearTimeout(id);
  }, [parcial]);
  if (!parcial || !visivel) return null;
  return (
    <span className={`corrida-parcial ${parcial.ms <= 0 ? 'frente' : 'atras'}`} aria-live="off">
      {diferencaLegivel(parcial.ms)}
    </span>
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
  const [fase, setFase] = useState<'largada' | 'correndo' | 'fim' | 'robos'>('largada');
  const [def, setDef] = useState<DefinicaoDaPista>(HORTA);
  /** Contra o relógio (com os fantasmas, vale recorde) ou contra o computador (os robôs, uma pista ou uma copa; não vale). */
  const [modo, setModo] = useState<'relogio' | 'robos'>('relogio');
  const [contraRobos, setContraRobos] = useState<OpcoesContraRobos>({ escolha: HORTA.id, dificuldade: 'medio', espelho: false, rapida: false });
  const [recordes, setRecordes] = useState<Recorde[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [placar, setPlacar] = usePlacar();
  const [vendoTrofeus, setVendoTrofeus] = useState(false);
  /** A diferença da última parcial para o fantasma de referência (o meu recorde, ou o mais rápido dos marcados). */
  const [parcial, setParcial] = useState<{ ms: number; vez: number } | null>(null);
  /** O tempo do fantasma de referência das parciais: no fim, a diferença final é contra ele. */
  const tempoDaReferencia = useRef<number | null>(null);
  /** O meu avatar pronto (o servidor diz junto dos recordes): as cores do meu kart. */
  const [meuAvatar, setMeuAvatar] = useState<number | string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controles = useControles(fase === 'correndo');
  // ESC pausa (só aqui, no Solo: na sala o relógio é o de todos)
  const { pausa, pausado, continuar } = usePausaComEsc(fase === 'correndo');
  // a música só com a corrida rodando (nem a largada, nem a pausa, nem o placar)
  useMusicaDoJogo(fase === 'correndo' && !pausado ? 'corrida' : null);
  /** Cada "Jogar de novo" é uma corrida nova, sem voltar à tela da largada. */
  const [rodada, setRodada] = useState(0);
  const tela = useRef<HTMLDivElement>(null);
  const pista = def.id;

  const lerRecordes = (id = pista) =>
    api<{ recordes: Recorde[]; meuAvatar?: number | string | null }>(`/api/corrida/${id}`)
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
    setParcial(null);
    void (async () => {
      // o meu recorde vem sempre (a referência das parciais), mesmo quando não está marcado para aparecer na pista
      const meuRecorde = recordes?.find((x) => x.userId === eu) ?? null;
      const ids = [...new Set([...escolhidos, ...(meuRecorde ? [eu] : [])])];
      const baixados = (
        await Promise.all(
          ids.map((id) =>
            api<{ amostras: number[] }>(`/api/corrida/${pista}/fantasma/${id}`)
              .then((r) => ({ id, amostras: r.amostras, avatar: recordes?.find((x) => x.userId === id)?.avatarPronto ?? null }))
              .catch(() => null),
          ),
        )
      ).filter((a): a is { id: number; amostras: number[]; avatar: number | string | null } => a !== null);
      if (!vivo || !canvas.current) return;
      const fantasmas = baixados.filter((f) => escolhidos.has(f.id)).map(({ amostras, avatar }) => ({ amostras, avatar }));
      // AS PARCIAIS: contra o meu recorde; sem ele, contra o mais rápido dos marcados
      const tempoDe = (id: number) => recordes?.find((x) => x.userId === id)?.tempoMs ?? Infinity;
      const referencia = baixados.find((f) => f.id === eu) ?? [...baixados].sort((a, b) => tempoDe(a.id) - tempoDe(b.id))[0] ?? null;
      const p = pistaDaCorrida(def);
      const marcosDaReferencia = referencia ? parciaisDoFantasma(p, def.voltas, referencia.amostras) : [];
      const seguir = criarParciais(p, def.voltas);
      tempoDaReferencia.current = referencia ? tempoDe(referencia.id) : null;
      let vez = 0;
      parar = rodarCorrida({
        canvas: canvas.current,
        comandos: controles.comandos.current,
        pista: def,
        piloto: true,
        pausa,
        eu,
        meuAvatar,
        fantasmas,
        contagem: CONTAGEM,
        aoPlacar: setPlacar,
        aoPosicao: referencia
          ? (pos) => {
              for (const k of seguir.andar(pos.x, pos.y)) {
                if (marcosDaReferencia[k]) setParcial({ ms: passosEmMs(pos.n - marcosDaReferencia[k]), vez: ++vez });
              }
            }
          : undefined,
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
      {fase === 'robos' && (
        <CorridaContraRobos opcoes={contraRobos} eu={eu} meuAvatar={meuAvatar} aoEscolher={() => setFase('largada')} aoVoltar={aoVoltar} />
      )}
      {fase === 'largada' && (
        <div className="minijogo-abas corrida-modo" role="tablist">
          <button type="button" role="tab" aria-selected={modo === 'relogio'} className={modo === 'relogio' ? 'ativa' : undefined} onClick={() => setModo('relogio')}>
            ⏱ {t('Contra o relógio')}
          </button>
          <button type="button" role="tab" aria-selected={modo === 'robos'} className={modo === 'robos' ? 'ativa' : undefined} onClick={() => setModo('robos')}>
            🤖 {t('Contra o computador')}
          </button>
        </div>
      )}
      {fase === 'largada' && modo === 'robos' && (
        <EscolhaContraRobos opcoes={contraRobos} mudar={setContraRobos} aoComecar={() => setFase('robos')} aoVoltar={aoVoltar} />
      )}
      {fase === 'largada' && modo === 'relogio' && (
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
            <MedalhasDaCorrida pista={pista} />
            <ComandosDoJogo itens={[{ teclas: ['setas'], rotulo: t('Dirigir') }, { teclas: ['espaco'], rotulo: t('Derrapar') }, { teclas: ['q'], rotulo: t('Olhar para trás') }, comandoDaPausa(t)]} />
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

      {(fase === 'correndo' || fase === 'fim') && (
        <div className="corrida-tela" ref={tela} tabIndex={-1}>
          <canvas ref={canvas} width={W} height={H} />
          {fase === 'correndo' && <Placar placar={placar} voltas={def.voltas} />}
          {fase === 'correndo' && <Parcial parcial={parcial} />}
          {fase === 'correndo' && <BotoesDeToque controles={controles} />}
          {fase === 'correndo' && pausado && <TelaDePausa aoContinuar={continuar} icone={false} />}
          {fase === 'fim' && resultado && (
            <div className="corrida-fim">
              {resultado.recorde && <strong className="corrida-recorde">{t('Novo recorde!')}</strong>}
              <MedalhasDaCorrida pista={pista} tempoMs={resultado.tempoMs} />
              <span className="corrida-relogio grande">{tempoLegivel(resultado.tempoMs)}</span>
              {tempoDaReferencia.current !== null && Number.isFinite(tempoDaReferencia.current) && (
                <span className={`corrida-parcial no-fim ${resultado.tempoMs <= tempoDaReferencia.current ? 'frente' : 'atras'}`}>
                  {diferencaLegivel(resultado.tempoMs - tempoDaReferencia.current)}
                </span>
              )}
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
type LinhaDaCorrida = { userId: number; username: string; tempoMs: number | null; voltas?: number[]; avatar?: number | string | null; posicao?: number | null };

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
  const [item, setItem] = useState<{ item: Item | null; usos: number }>({ item: null, usos: 0 });
  const piloto = jogador && estado.pilotos.some((p) => p.userId === eu);
  const controles = useControles(piloto && !chegou && !fim);
  // a música enquanto a corrida roda; quem chegou já está no placar
  useMusicaDoJogo(!fim && !chegou ? 'corrida' : null);
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
      if ((TIPOS_DE_EVENTO as readonly unknown[]).includes(d.tipo)) {
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
      itens: estado.itens === false ? undefined : { eventos: eventos.current, aoEvento: enviar, aoItem: (i, usos) => setItem({ item: i, usos }) },
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
        {!fim && piloto && !chegou && <BotoesDeToque controles={controles} item={item.item} usos={item.usos} />}
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
      {piloto && !fim && (
        <ComandosDoJogo
          itens={[
            { teclas: ['setas'], rotulo: t('Dirigir') },
            { teclas: ['espaco'], rotulo: t('Derrapar') },
            { teclas: ['e'], rotulo: t('Usar o item') },
            { teclas: ['q'], rotulo: t('Olhar para trás') },
          ]}
        />
      )}
      {piloto && !fim && <p className="settings-hint corrida-dica">{t('Setas para dirigir, Espaço para derrapar, E para usar o item.')}</p>}
    </>
  );
}

// =====================================================================================================================
// CONTRA O COMPUTADOR (a aba Solo, 19/11/2026): sete robôs, uma pista ou uma copa, com os itens. Não vale recorde.
// =====================================================================================================================

export interface OpcoesContraRobos {
  /** Uma pista (o id) ou uma copa (o id da copa). */
  escolha: string;
  dificuldade: DificuldadeDaCorrida;
  /** As pistas viradas da esquerda para a direita. */
  espelho: boolean;
  /** A classe rápida (o teto 25% mais alto). */
  rapida: boolean;
}

const ROBOS_NA_COPA = 7;
const CLASSE_RAPIDA = 1.25;
const NOME_DA_DIFICULDADE: Record<DificuldadeDaCorrida, string> = { facil: chave('Fácil'), medio: chave('Médio'), dificil: chave('Difícil'), mestre: chave('Mestre') };

function EscolhaContraRobos({
  opcoes,
  mudar,
  aoComecar,
  aoVoltar,
}: {
  opcoes: OpcoesContraRobos;
  mudar: (o: OpcoesContraRobos) => void;
  aoComecar: () => void;
  aoVoltar: () => void;
}) {
  const t = useT();
  return (
    <div className="corrida-largada">
      <ul className="corrida-pistas" role="radiogroup">
        {PISTAS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              role="radio"
              aria-checked={opcoes.escolha === p.id}
              className={`corrida-pista-botao${opcoes.escolha === p.id ? ' escolhida' : ''}`}
              onClick={() => mudar({ ...opcoes, escolha: p.id })}
            >
              <MapaDaPista def={opcoes.espelho ? espelhar(p) : p} lado={72} />
              <strong>{nomeDaPistaEm(t, p.id)}</strong>
            </button>
          </li>
        ))}
        {Object.entries(COPAS).map(([copa, pistas]) => (
          <li key={copa}>
            <button
              type="button"
              role="radio"
              aria-checked={opcoes.escolha === copa}
              className={`corrida-pista-botao copa${opcoes.escolha === copa ? ' escolhida' : ''}`}
              onClick={() => mudar({ ...opcoes, escolha: copa })}
            >
              <span className="corrida-copa-mapas" aria-hidden="true">
                <Trophy size={40} />
              </span>
              <strong>{nomeDaPistaEm(t, copa)}</strong>
              <small>{pistas.map((p) => nomeDaPistaEm(t, p)).join(' · ')}</small>
            </button>
          </li>
        ))}
      </ul>
      <div className="minijogo-abas corrida-dificuldade" role="radiogroup" aria-label={t('Computador')}>
        {DIFICULDADES_DA_CORRIDA.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={opcoes.dificuldade === d} className={opcoes.dificuldade === d ? 'ativa' : undefined} onClick={() => mudar({ ...opcoes, dificuldade: d })}>
            {t(NOME_DA_DIFICULDADE[d])}
          </button>
        ))}
      </div>
      <div className="corrida-opcoes-robos">
        <label>
          <input type="checkbox" checked={opcoes.espelho} onChange={() => mudar({ ...opcoes, espelho: !opcoes.espelho })} /> 🪞 {t('Espelho')}
        </label>
        <label>
          <input type="checkbox" checked={opcoes.rapida} onChange={() => mudar({ ...opcoes, rapida: !opcoes.rapida })} /> ⚡ {t('Classe rápida')}
        </label>
      </div>
      <div className="corrida-pista-nome">
        <ComandosDoJogo
          itens={[
            { teclas: ['setas'], rotulo: t('Dirigir') },
            { teclas: ['espaco'], rotulo: t('Derrapar') },
            { teclas: ['e'], rotulo: t('Usar o item') },
            { teclas: ['q'], rotulo: t('Olhar para trás') },
            comandoDaPausa(t),
          ]}
        />
        <p className="settings-hint">{t('Acelere logo depois da terceira luz vermelha para sair com turbo.')}</p>
      </div>
      <div className="minijogo-acoes">
        <button type="button" className="btn-primary" onClick={aoComecar}>
          {t('Começar')}
        </button>
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </div>
  );
}

function CorridaContraRobos({
  opcoes,
  eu,
  meuAvatar,
  aoEscolher,
  aoVoltar,
}: {
  opcoes: OpcoesContraRobos;
  eu: number;
  meuAvatar: number | string | null;
  aoEscolher: () => void;
  aoVoltar: () => void;
}) {
  const t = useT();
  const copa = COPAS[opcoes.escolha] ? opcoes.escolha : null;
  const pistas = copa ? COPAS[copa] : [opcoes.escolha];
  const [indice, setIndice] = useState(0);
  /** Cada corrida (e cada "Jogar de novo") é um laço novo. */
  const [rodada, setRodada] = useState(0);
  const [fase, setFase] = useState<'correndo' | 'resultado'>('correndo');
  const [classificacao, setClassificacao] = useState<LinhaDaClassificacao[] | null>(null);
  const [pontos, setPontos] = useState<PontosNaCopa[]>([]);
  const [placar, setPlacar] = usePlacar();
  const [item, setItem] = useState<{ item: Item | null; usos: number }>({ item: null, usos: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const controles = useControles(fase === 'correndo');
  const { pausa, pausado, continuar } = usePausaComEsc(fase === 'correndo');
  useMusicaDoJogo(fase === 'correndo' && !pausado ? 'corrida' : null);
  const base = pistaPorId(pistas[indice]);
  const def = opcoes.espelho ? espelhar(base) : base;
  const ultima = indice === pistas.length - 1;
  const nomeDe = (l: { nome: string; eu: boolean }) => (l.eu ? t('você') : l.nome);

  useEffect(() => {
    if (fase !== 'correndo' || !canvas.current) return;
    tela.current?.focus();
    setItem({ item: null, usos: 0 });
    return rodarCorrida({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      pista: def,
      piloto: true,
      pausa,
      eu,
      meuAvatar,
      robos: { quantos: ROBOS_NA_COPA, dificuldade: opcoes.dificuldade },
      classe: opcoes.rapida ? CLASSE_RAPIDA : 1,
      itens: { eventos: [], aoEvento: () => {}, aoItem: (i, usos) => setItem({ item: i, usos }) },
      contagem: CONTAGEM,
      aoPlacar: setPlacar,
      aoClassificacao: (lista) => {
        setClassificacao(lista);
        // os pontos da copa: 10, 8, 6, 5… pela posição desta corrida
        setPontos((antes) => somarPontos(antes, lista));
      },
      aoChegar: () => setFase('resultado'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase === 'correndo', rodada, indice]);

  const proxima = () => {
    setClassificacao(null);
    setIndice((i) => i + 1);
    setFase('correndo');
  };
  const deNovo = () => {
    setClassificacao(null);
    setPontos([]);
    setIndice(0);
    setFase('correndo');
    setRodada((r) => r + 1);
  };
  const minhaPosicao = classificacao ? classificacao.findIndex((l) => l.eu) : -1;
  const acabou = fase === 'resultado' && (!copa || ultima);
  const lugar = (i: number) => (acabou && i < 3 ? MEDALHAS[i] : i + 1);

  return (
    <>
      {copa && (
        <div className="corrida-copa-topo">
          <strong>{nomeDaPistaEm(t, copa)}</strong>
          <span>
            {t('Rodada {n} de {total}', { n: indice + 1, total: pistas.length })} · {nomeDaPistaEm(t, base.id)}
            {opcoes.espelho ? ' 🪞' : ''}
          </span>
        </div>
      )}
      <div className="corrida-tela" ref={tela} tabIndex={-1}>
        <canvas ref={canvas} width={W} height={H} />
        {fase === 'correndo' && <Placar placar={placar} voltas={def.voltas} />}
        {fase === 'correndo' && <BotoesDeToque controles={controles} item={item.item} usos={item.usos} />}
        {fase === 'correndo' && pausado && <TelaDePausa aoContinuar={continuar} icone={false} />}
        {fase === 'resultado' && classificacao && (
          <div className="corrida-fim">
            {/* a corrida: a ordem de chegada, com o tempo de quem chegou antes de mim */}
            {(!copa || !acabou) && (
              <ol className="corrida-classificacao">
                {classificacao.map((l, i) => (
                  <li key={l.id} className={l.eu ? 'eu' : undefined}>
                    <span className="corrida-posicao">{!copa ? lugar(i) : i + 1}</span>
                    <span className="corrida-quem">{nomeDe(l)}</span>
                    <span className="corrida-relogio">{l.passos !== null ? tempoLegivel(passosEmMs(l.passos)) : '…'}</span>
                    {copa && <span className="corrida-pontos">+{PONTOS_DA_COPA[i] ?? 0}</span>}
                  </li>
                ))}
              </ol>
            )}
            {/* a copa: os pontos somados, e no fim o pódio */}
            {copa && (
              <ol className="corrida-classificacao">
                {pontos.map((l, i) => (
                  <li key={l.id} className={l.eu ? 'eu' : undefined}>
                    <span className="corrida-posicao">{lugar(i)}</span>
                    <span className="corrida-quem">{nomeDe(l)}</span>
                    <span className="corrida-pontos">{l.pontos}</span>
                  </li>
                ))}
              </ol>
            )}
            {acabou && !copa && minhaPosicao >= 0 && minhaPosicao < 3 && <strong className="corrida-recorde">{MEDALHAS[minhaPosicao]}</strong>}
            <div className="minijogo-acoes">
              {copa && !ultima ? (
                <button type="button" className="btn-primary" onClick={proxima}>
                  {t('Próxima pista')}
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={deNovo}>
                  {t('Jogar de novo')}
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={aoEscolher}>
                {t('Escolher a pista')}
              </button>
              <button type="button" className="btn-secondary" onClick={aoVoltar}>
                {t('Outros jogos')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

