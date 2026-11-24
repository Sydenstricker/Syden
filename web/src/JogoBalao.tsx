import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { BotoesDosRobos, cadaUmPorSi, type OpcaoDeRobos } from './EscolhaDosRobos';
import { chave, useT } from './i18n';
import { comandoDaPausa, TelaDePausa, usePausaComEsc } from './pausaDosJogos';
import { Placar } from './Minijogo';
import { tocar } from './somDosJogos';
import type { Comandos } from './corrida/fisica';
import type { PosicaoDoRival, Rival } from './corrida/laco';
import { H, W } from './corrida/render';
import { NOMES_DAS_ARENAS } from './balao/nomes';
import { figuraDoItem, rodarBalao, TIPOS_DO_BALAO, type EventoDoBalao, type Participante } from './balao/laco';
import { corDoBalao } from './balao/render';
import { DIFICULDADES_DO_BALAO, type DificuldadeDoBalao } from './balao/robo';
import { ARENAS, BALOES, MODOS_DO_BALAO, type ItemDoBalao, type ModoDoBalao } from './balao/sim';
import './balao/balao.css';

/**
 * O ESTOURA-BALÃO (05/11/2026): o modo arena dos jogos de kart, só a mecânica, sobre o motor da Corrida dos coelhos. Cada um
 * dirige o próprio coelho-kart numa arena fechada, com três balões presos atrás; o repolho que quica e a lama estouram o
 * balão de quem é atingido, a cenoura dá turbo e a alface segura um item. Sem balão, sai e assiste. Ganha quem sobrar, ou
 * quem tiver mais balões quando o tempo acabar.
 *
 * NA SALA (server/src/minijogo-balao.ts): cada um dirige aqui e manda a posição; o servidor dá a largada, carimba os itens,
 * confere os estouros e fecha a partida. NO SOLO, contra os coelhos do computador, a partida inteira roda aqui (balao/laco.ts
 * com balao/robo.ts), e só o fim vai ao servidor. A câmera e o coelho são os da corrida (o Mode 7 e a troca de paleta do
 * avatar), e Q olha para trás.
 */

export interface JogadorDoBalao {
  userId: number;
  username: string;
  avatar: number | string | null;
  largada: number;
  /** As duplas (21/11/2026): o time. */
  equipe?: number;
  baloes: number;
  estouros: number;
  vivo: boolean;
  posicao: number | null;
  /** O modo da cenoura dourada (24/11/2026): os segundos com ela. */
  dourada?: number;
}

export interface EstadoBalao {
  fase: 'largada' | 'jogando' | 'fim';
  solo?: boolean;
  partidaId: string;
  // na sala
  arena?: string;
  /** A sala em duplas (21/11/2026). */
  duplas?: boolean;
  /** O modo (24/11/2026): os balões de sempre, ou a cenoura dourada. */
  modo?: ModoDoBalao;
  /** No modo da cenoura: com quem ela está (null: no chão, em x, y), desde o passo n. */
  dourada?: { dono: number | null; x: number; y: number; n: number } | null;
  semente?: number;
  decorridoMs?: number | null;
  duracaoMs?: number;
  jogadores?: JogadorDoBalao[];
  // no Solo
  username?: string;
  avatar?: number | string | null;
  robos?: { userId: number; username: string }[];
  resultadoDoSolo?: { posicao: number; total: number; baloes: number; estouros: number; dourada?: number | null } | null;
}

type Props = {
  estado: EstadoBalao & { terminada?: boolean; restanteMs?: number };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  socket?: Socket | null;
  channelId?: number;
};

const ARENA_GUARDADA = 'syden:balaoArena';
const ROBOS_GUARDADOS = 'syden:balaoRobos';
const DIFICULDADE_GUARDADA = 'syden:balaoDificuldade';
const MODO_GUARDADO = 'syden:balaoModo';
/**
 * AS DUPLAS NO SOLO (21/11/2026): eu e um robô de parceiro contra os outros, em times de dois. A opção leva o número de robôs
 * NEGATIVO (o mesmo 3 de "cada um por si" seria outra mesa), e a figura mostra os times.
 */
const DUPLAS_DO_SOLO: OpcaoDeRobos[] = [
  { robos: -3, lados: [['eu', 'robo'], ['robo', 'robo']], rotulo: '2 × 2' },
  { robos: -5, lados: [['eu', 'robo'], ['robo', 'robo'], ['robo', 'robo']], rotulo: '2 × 2 × 2' },
];
/** O time de cada lugar na largada, nas duplas: `total / 2` times, um a cada lugar (os dois de um time largam do mesmo lado). */
export const equipeDaLargada = (i: number, total: number) => i % Math.max(1, Math.floor(total / 2));
const NOME_DA_DIFICULDADE: Record<DificuldadeDoBalao, string> = { facil: chave('Fácil'), medio: chave('Médio'), dificil: chave('Difícil') };

const lerGuardado = (chave: string, padrao: string) => {
  try {
    return localStorage.getItem(chave) ?? padrao;
  } catch {
    return padrao;
  }
};
const guardar = (chave: string, valor: string) => {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // sem o armazenamento, só não se lembra da escolha
  }
};

export function JogoBalao({ estado, eu, jogador, agir, socket = null, channelId = 0 }: Props) {
  const fim = estado.terminada || estado.fase === 'fim';
  const [escolha, setEscolha] = useState<{ arena: string; robos: number; dificuldade: DificuldadeDoBalao; duplas: boolean; modo: ModoDoBalao } | null>(null);
  if (fim) return <TelaDoFim estado={estado} eu={eu} />;
  if (estado.solo) {
    if (!escolha) return <EscolhaDoSolo aoEscolher={setEscolha} />;
    return (
      <PartidaSolo
        key={estado.partidaId}
        arena={escolha.arena}
        quantos={escolha.robos}
        dificuldade={escolha.dificuldade}
        duplas={escolha.duplas}
        dourada={escolha.modo === 'dourada'}
        eu={eu}
        nome={estado.username ?? ''}
        avatar={estado.avatar ?? null}
        robos={estado.robos ?? []}
        aoTerminar={(r) => void agir({ tipo: 'fim', ...r })}
      />
    );
  }
  const souDoJogo = jogador && (estado.jogadores ?? []).some((j) => j.userId === eu);
  return <PartidaNaSala key={estado.partidaId} estado={estado} eu={eu} piloto={souDoJogo} socket={socket} channelId={channelId} />;
}

// ---------------------------------------------------------------------------------------------------------------------
// A ESCOLHA: a arena (na sala, quem começa escolhe; no Solo, também quantos coelhos do computador)
// ---------------------------------------------------------------------------------------------------------------------

/** O desenho de cima de uma arena (a borda, os obstáculos), para o botão da escolha. */
function MapaDaArena({ id, lado }: { id: string; lado: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    const a = ARENAS.find((x) => x.id === id);
    if (!g || !a) return;
    const [x0, y0, x1, y1] = a.circulo ? [a.circulo[0] - a.circulo[2], a.circulo[1] - a.circulo[2], a.circulo[0] + a.circulo[2], a.circulo[1] + a.circulo[2]] : a.retangulo!;
    const m = Math.max(x1 - x0, y1 - y0) + 20;
    const k = lado / m;
    g.clearRect(0, 0, lado, lado);
    g.save();
    g.scale(k, k);
    g.translate(-(x0 + x1) / 2 + m / 2, -(y0 + y1) / 2 + m / 2);
    g.fillStyle = '#ece4d6';
    if (a.circulo) {
      g.beginPath();
      g.arc(a.circulo[0], a.circulo[1], a.circulo[2], 0, Math.PI * 2);
      g.fill();
    } else g.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (const [cx, cy, r, qual] of a.circulos) {
      g.fillStyle = qual === 'agua' ? '#5c96be' : '#786054';
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#966e46';
    for (const [mx0, my0, mx1, my1] of a.muros) g.fillRect(mx0, my0, mx1 - mx0, my1 - my0);
    g.fillStyle = '#f0a040';
    for (const [cx, cy] of a.caixas) g.fillRect(cx - 6, cy - 6, 12, 12);
    g.restore();
  }, [id, lado]);
  return <canvas ref={ref} width={lado} height={lado} aria-hidden="true" />;
}

/** A escolha da arena da sala (para quem começa a partida: `aoEscolher` vai com o id, que o servidor recebe em `arena`). */
/** O MODO (24/11/2026): os balões de sempre, ou a cenoura dourada. Figura e nome, nas duas escolhas (a sala e o Solo). */
function EscolhaDoModo({ modo, aoMudar }: { modo: ModoDoBalao; aoMudar: (m: ModoDoBalao) => void }) {
  const t = useT();
  return (
    <div className="minijogo-abas corrida-dificuldade" role="radiogroup" aria-label={t('Modo')}>
      {MODOS_DO_BALAO.map((m) => (
        <button key={m} type="button" role="radio" aria-checked={modo === m} className={modo === m ? 'ativa' : undefined} onClick={() => aoMudar(m)}>
          {m === 'dourada' ? `🥕 ${t('Cenoura dourada')}` : `🎈 ${t('Balões')}`}
        </button>
      ))}
    </div>
  );
}

export function EscolhaDaArena({ aoEscolher, aoVoltar }: { aoEscolher: (arena: string, extra?: { duplas: boolean; modo: ModoDoBalao }) => void; aoVoltar: () => void }) {
  const t = useT();
  const [duplas, setDuplas] = useState(false);
  const [modo, setModo] = useState<ModoDoBalao>('baloes');
  return (
    <div className="corrida-escolha">
      <EscolhaDoModo modo={modo} aoMudar={setModo} />
      {modo === 'dourada' && <p className="settings-hint">{t('Segure a cenoura dourada: quem leva um item ou uma batida a derruba. Ganha quem a segurar por mais tempo.')}</p>}
      <div className="minijogo-abas corrida-dificuldade" role="radiogroup">
        {[false, true].map((d) => (
          <button key={String(d)} type="button" role="radio" aria-checked={duplas === d} className={duplas === d ? 'ativa' : undefined} onClick={() => setDuplas(d)}>
            {d ? t('Em duplas') : t('Cada um por si')}
          </button>
        ))}
      </div>
      {duplas && <p className="settings-hint">{t('Em duplas, com 4, 6 ou 8 pessoas: o item não pega o colega.')}</p>}
      <ul className="corrida-pistas">
        {ARENAS.map((a) => (
          <li key={a.id}>
            <button type="button" className="corrida-pista-botao" onClick={() => aoEscolher(a.id, { duplas, modo })}>
              <MapaDaArena id={a.id} lado={72} />
              <strong>{t(NOMES_DAS_ARENAS[a.id] ?? a.id)}</strong>
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

function EscolhaDoSolo({ aoEscolher }: { aoEscolher: (e: { arena: string; robos: number; dificuldade: DificuldadeDoBalao; duplas: boolean; modo: ModoDoBalao }) => void }) {
  const t = useT();
  const [modo, setModo] = useState<ModoDoBalao>(() => (lerGuardado(MODO_GUARDADO, 'baloes') === 'dourada' ? 'dourada' : 'baloes'));
  const [arena, setArena] = useState(() => {
    const g = lerGuardado(ARENA_GUARDADA, 'horta');
    return ARENAS.some((a) => a.id === g) ? g : 'horta';
  });
  // o número de robôs; negativo, as duplas (DUPLAS_DO_SOLO)
  const [robos, setRobos] = useState(() => {
    const g = Number(lerGuardado(ROBOS_GUARDADOS, '3')) || 3;
    return g === -3 || g === -5 ? g : Math.min(5, Math.max(1, g));
  });
  const [dificuldade, setDificuldade] = useState<DificuldadeDoBalao>(() => {
    const g = lerGuardado(DIFICULDADE_GUARDADA, 'medio');
    return (DIFICULDADES_DO_BALAO as string[]).includes(g) ? (g as DificuldadeDoBalao) : 'medio';
  });
  const comecar = () => {
    guardar(ARENA_GUARDADA, arena);
    guardar(ROBOS_GUARDADOS, String(robos));
    guardar(DIFICULDADE_GUARDADA, dificuldade);
    guardar(MODO_GUARDADO, modo);
    tocar('clique');
    aoEscolher({ arena, robos: Math.abs(robos), dificuldade, duplas: robos < 0, modo });
  };
  return (
    <div className="balao-escolha">
      <EscolhaDoModo modo={modo} aoMudar={setModo} />
      <ul className="corrida-pistas">
        {ARENAS.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className={`corrida-pista-botao${a.id === arena ? ' escolhida' : ''}`}
              aria-pressed={a.id === arena}
              onClick={() => setArena(a.id)}
            >
              <MapaDaArena id={a.id} lado={72} />
              <strong>{t(NOMES_DAS_ARENAS[a.id] ?? a.id)}</strong>
            </button>
          </li>
        ))}
      </ul>
      <BotoesDosRobos opcoes={[...[1, 2, 3, 4, 5].map(cadaUmPorSi), ...DUPLAS_DO_SOLO]} escolhida={robos} aoEscolher={setRobos} pergunta={t('Quantos adversários do computador?')} />
      <div className="minijogo-abas corrida-dificuldade" role="radiogroup" aria-label={t('Computador')}>
        {DIFICULDADES_DO_BALAO.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={dificuldade === d} className={dificuldade === d ? 'ativa' : undefined} onClick={() => setDificuldade(d)}>
            {t(NOME_DA_DIFICULDADE[d])}
          </button>
        ))}
      </div>
      <div className="minijogo-acoes">
        <button type="button" className="btn-primary" onClick={comecar}>
          {t('Começar')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// O TECLADO E O TOQUE (como na corrida): setas ou WASD, Espaço derrapa, E (ou Ctrl) usa o item, Q segurado olha para trás
// ---------------------------------------------------------------------------------------------------------------------

function useControles(ativo: boolean) {
  const comandos = useRef<Comandos>({ acelera: false, freia: false, vira: 0, derrapa: false, usa: false, olha: false });
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
      Object.assign(lados.current, { esquerda: false, direita: false, toqueEsquerda: false, toqueDireita: false });
    };
    const escondeu = () => document.hidden && soltarTudo();
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    window.addEventListener('blur', soltarTudo);
    document.addEventListener('visibilitychange', escondeu);
    // na tela de toque, o kart acelera sozinho, e os dedos viram, usam o item e olham para trás
    if (window.matchMedia?.('(pointer: coarse)').matches) c.acelera = true;
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('blur', soltarTudo);
      document.removeEventListener('visibilitychange', escondeu);
      Object.assign(c, { acelera: false, freia: false, vira: 0, derrapa: false, usa: false, olha: false });
    };
  }, [ativo]);
  const tocarLado = (lado: 'toqueEsquerda' | 'toqueDireita', apertado: boolean) => {
    lados.current[lado] = apertado;
    virar();
  };
  return { comandos, tocarLado };
}

const EMOJI_DO_ITEM: Record<ItemDoBalao, string> = { cenoura: '🥕', repolho: '🥬', lama: '🟤', alface: '🥗' };

function BotoesDeToque({ controles, item }: { controles: ReturnType<typeof useControles>; item: ItemDoBalao | null }) {
  const t = useT();
  const { comandos, tocarLado } = controles;
  const lado = (qual: 'toqueEsquerda' | 'toqueDireita') => ({
    onPointerDown: () => tocarLado(qual, true),
    onPointerUp: () => tocarLado(qual, false),
    onPointerCancel: () => tocarLado(qual, false),
    onPointerLeave: () => tocarLado(qual, false),
  });
  const segurar = (campo: 'usa' | 'olha' | 'derrapa' | 'freia') => ({
    onPointerDown: () => (comandos.current[campo] = true),
    onPointerUp: () => (comandos.current[campo] = false),
    onPointerCancel: () => (comandos.current[campo] = false),
    onPointerLeave: () => (comandos.current[campo] = false),
  });
  return (
    <div className="corrida-toque balao-toque">
      <button type="button" aria-label={t('Virar para a esquerda')} {...lado('toqueEsquerda')}>
        ◀
      </button>
      {/* A RÉ (20/11/2026): no toque o kart acelera sozinho, e encostado num muro não havia como sair */}
      <button type="button" aria-label={t('Frear')} {...segurar('freia')}>
        ▼
      </button>
      <button type="button" aria-label={t('Pular')} {...segurar('derrapa')}>
        ⤒
      </button>
      {item && (
        <button type="button" aria-label={t('Usar o item')} {...segurar('usa')}>
          {EMOJI_DO_ITEM[item]}
        </button>
      )}
      <button type="button" aria-label={t('Olhar para trás')} {...segurar('olha')}>
        👀
      </button>
      <button type="button" aria-label={t('Virar para a direita')} {...lado('toqueDireita')}>
        ▶
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// A TELA DA ARENA (a mesma para a sala e para o Solo)
// ---------------------------------------------------------------------------------------------------------------------

const relogio = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * O QUE É MEU, GRANDE, POR CIMA DA TELA (16/11/2026, relato dele: "os ícones estão muito pequenos"): desenhados na tela de
 * 320 × 180, os meus balões tinham 9 pontos e o quadro do item 26 × 22. Em HTML, eles acompanham o tamanho do painel: os
 * balões no canto de cima à esquerda e o quadro do item no meio, com a figura do item (a mesma pixel art da arena) ampliada.
 * Só desenho: a lista de todos (BaloesDeTodos) e o botão do item dizem o mesmo ao leitor de tela.
 */
function MeuPainel({ quantos, cor, item, semBaloes = false }: { quantos: number; cor: string; item: ItemDoBalao | null; semBaloes?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    const fig = item ? figuraDoItem(item) : null;
    if (!fig) return;
    g.imageSmoothingEnabled = false;
    // a figura inteira, no maior múltiplo inteiro que cabe (pixel art só amplia em inteiros)
    const k = Math.max(1, Math.floor(Math.min((c.width - 4) / fig.width, (c.height - 4) / fig.height)));
    const w = fig.width * k, h = fig.height * k;
    g.drawImage(fig, Math.round((c.width - w) / 2), Math.round((c.height - h) / 2), w, h);
  }, [item]);
  return (
    <div className="balao-meu" aria-hidden="true">
      {!semBaloes && (
        <span className="balao-meus-baloes">
          {Array.from({ length: BALOES }, (_, i) => (
            <i key={i} className={i < quantos ? 'cheio' : undefined} style={i < quantos ? { background: cor } : undefined} />
          ))}
        </span>
      )}
      <span className={`balao-item${item ? ' com-item' : ''}`}>
        <canvas ref={ref} width={32} height={32} />
      </span>
    </div>
  );
}

/** A cor dos balões de alguém: a do lugar na largada, ou, nas duplas, a do time. */
const corDe = (q: Participante | undefined, duplas: boolean) => corDoBalao(q ? (duplas && q.equipe !== undefined ? q.equipe : q.largada) : 0);

/** Os balões de cada um, no canto: o nome e as bolinhas da cor dele (nas duplas, a do time). */
function BaloesDeTodos({ participantes, baloes, eu, duplas = false }: { participantes: Participante[]; baloes: Map<number, number>; eu: number; duplas?: boolean }) {
  const t = useT();
  const ordem = [...participantes].sort((a, b) => (baloes.get(b.id) ?? BALOES) - (baloes.get(a.id) ?? BALOES));
  return (
    <ol className="balao-todos" aria-label={t('Balões')}>
      {ordem.map((q) => {
        const n = baloes.get(q.id) ?? BALOES;
        return (
          <li key={q.id} className={`${q.id === eu ? 'eu' : ''}${n === 0 ? ' fora' : ''}`}>
            <span className="balao-bolinhas" aria-label={String(n)}>
              {Array.from({ length: BALOES }, (_, i) => (
                <i key={i} style={i < n ? { background: corDe(q, duplas) } : undefined} />
              ))}
            </span>
            <span className="balao-nome">{q.nome}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * O MODO CENOURA DOURADA (24/11/2026): no lugar dos balões, o tempo de cada um com a cenoura, do mais ao menos; quem está com
 * ela agora leva a cenoura ao lado do nome. Nas duplas, a cor do time.
 */
function DouradaDeTodos({ participantes, dourada, eu, duplas = false }: { participantes: Participante[]; dourada: { dono: number | null; segundos: Map<number, number> }; eu: number; duplas?: boolean }) {
  const t = useT();
  const ordem = [...participantes].sort((a, b) => (dourada.segundos.get(b.id) ?? 0) - (dourada.segundos.get(a.id) ?? 0));
  return (
    <ol className="balao-todos" aria-label={t('Cenoura dourada')}>
      {ordem.map((q) => (
        <li key={q.id} className={q.id === eu ? 'eu' : undefined}>
          <span className="balao-bolinhas">
            <i style={{ background: corDe(q, duplas) }} />
          </span>
          <span className="balao-nome">
            {dourada.dono === q.id ? '🥕 ' : ''}
            {q.nome} · {relogio((dourada.segundos.get(q.id) ?? 0) * 1000)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Comandos_({ piloto, solo = false }: { piloto: boolean; solo?: boolean }) {
  const t = useT();
  if (!piloto) return null;
  return (
    <ComandosDoJogo
      itens={[
        { teclas: ['setas'], rotulo: t('Dirigir') },
        // o Espaço pula (em linha reta) e, virando, derrapa (16/11/2026)
        { teclas: ['espaco'], rotulo: t('Pular') },
        { teclas: ['e'], rotulo: t('Usar o item') },
        { teclas: ['q'], rotulo: t('Olhar para trás') },
        ...(solo ? [comandoDaPausa(t)] : []),
      ]}
    />
  );
}

function PartidaSolo({
  arena,
  quantos,
  dificuldade,
  duplas,
  dourada = false,
  eu,
  nome,
  avatar,
  robos,
  aoTerminar,
}: {
  arena: string;
  quantos: number;
  dificuldade: DificuldadeDoBalao;
  duplas: boolean;
  dourada?: boolean;
  eu: number;
  nome: string;
  avatar: number | string | null;
  robos: { userId: number; username: string }[];
  aoTerminar: (r: { posicao: number; total: number; baloes: number; estouros: number; passos: number; dourada?: number }) => void;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const [acabou, setAcabou] = useState(false);
  const [ouro, setOuro] = useState<{ dono: number | null; segundos: Map<number, number> }>({ dono: null, segundos: new Map() });
  const ouroRef = useRef(ouro);
  const controles = useControles(!acabou);
  // ESC pausa (só aqui, no Solo: na sala o relógio é o de todos)
  const { pausa, pausado, continuar } = usePausaComEsc(!acabou);
  const [item, setItem] = useState<ItemDoBalao | null>(null);
  const [restante, setRestante] = useState({ restanteMs: 0, pausado: false });
  const [baloes, setBaloes] = useState(new Map<number, number>());
  const participantes = useRef<Participante[]>(
    [
      { id: eu, nome, avatar, largada: 0 },
      ...robos.slice(0, quantos).map((r, i) => ({ id: r.userId, nome: r.username, avatar: (((i * 5 + 3) % 16) + 1) as number, largada: i + 1 })),
    ].map((q, _, todos) => (duplas ? { ...q, equipe: equipeDaLargada(q.largada, todos.length) } : q)),
  );
  useEffect(() => {
    if (!canvas.current) return;
    tela.current?.focus();
    const lista = participantes.current;
    const parar = rodarBalao({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      arena,
      eu,
      piloto: true,
        pausa,
      participantes: lista,
      robos: lista.filter((q) => q.id !== eu).map((q) => q.id),
      dificuldade,
      duplas,
      dourada,
      aoDourada: (d) => {
        const a = ouroRef.current;
        if (a.dono === d.dono && [...d.segundos].every(([id, s]) => a.segundos.get(id) === s)) return;
        if (d.dono !== a.dono) tocar(d.dono === eu ? 'moeda' : a.dono === eu ? 'queda' : 'clique');
        ouroRef.current = d;
        setOuro(d);
      },
      semente: Math.floor(Math.random() * 2 ** 31),
      verdeEm: performance.now() + 3000,
      baloes: new Map(lista.map((q) => [q.id, BALOES])),
      rivais: new Map(),
      eventos: [],
      pausaSemFoco: true,
      aoItem: (i) => {
        setItem(i);
        if (i) tocar('moeda');
      },
      aoPlacar: (p) => setRestante((a) => (Math.ceil(a.restanteMs / 1000) === Math.ceil(p.restanteMs / 1000) && a.pausado === p.pausado ? a : p)),
      aoBaloes: (b) =>
        setBaloes((antes) => {
          if ((b.get(eu) ?? BALOES) < (antes.get(eu) ?? BALOES)) tocar('queda');
          else if ([...b].some(([id, n]) => n < (antes.get(id) ?? BALOES))) tocar('acerto');
          return b;
        }),
      aoFim: (r) => {
        setAcabou(true);
        tocar('fim');
        aoTerminar(dourada ? { ...r, dourada: ouroRef.current.segundos.get(eu) ?? 0 } : r);
      },
    });
    return parar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="corrida balao">
      <div className="corrida-tela" ref={tela} tabIndex={-1}>
        <canvas ref={canvas} width={W} height={H} />
        <div className="corrida-placar balao-placar" aria-live="off">
          <span />
          <span className="corrida-relogio">{relogio(restante.restanteMs)}</span>
        </div>
        {dourada ? (
          <DouradaDeTodos participantes={participantes.current} dourada={ouro} eu={eu} duplas={duplas} />
        ) : (
          <BaloesDeTodos participantes={participantes.current} baloes={baloes} eu={eu} duplas={duplas} />
        )}
        {!acabou && !dourada && (baloes.get(eu) ?? BALOES) === 0 && <p className="balao-aviso">{t('Sem balões: você segue de fantasma, soltando itens.')}</p>}
        {!acabou && <MeuPainel quantos={baloes.get(eu) ?? BALOES} cor={corDoBalao(0)} item={item} semBaloes={dourada} />}
        {!acabou && <BotoesDeToque controles={controles} item={item} />}
          {!acabou && pausado && <TelaDePausa aoContinuar={continuar} icone={false} />}
      </div>
      <Comandos_ piloto={!acabou} solo />
      {!acabou && (
        <p className="settings-hint corrida-dica">
          {dourada
            ? t('Segure a cenoura dourada: quem leva um item ou uma batida a derruba. Ganha quem a segurar por mais tempo.')
            : t('Pegue as caixas e estoure os balões dos outros. Quem fica sem balão sai.')}
        </p>
      )}
    </div>
  );
}

function PartidaNaSala({
  estado,
  eu,
  piloto,
  socket,
  channelId,
}: {
  estado: EstadoBalao & { restanteMs?: number };
  eu: number;
  piloto: boolean;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const [item, setItem] = useState<ItemDoBalao | null>(null);
  const [restante, setRestante] = useState({ restanteMs: 0, pausado: false });
  const jogadores = estado.jogadores ?? [];
  const duplas = !!estado.duplas;
  const dourada = estado.modo === 'dourada';
  const [ouro, setOuro] = useState<{ dono: number | null; segundos: Map<number, number> }>({ dono: null, segundos: new Map() });
  const ouroRef = useRef(ouro);
  const participantes = useRef<Participante[]>(jogadores.map((j) => ({ id: j.userId, nome: j.username, avatar: j.avatar, largada: j.largada, equipe: j.equipe })));
  const baloesVerdade = useRef(new Map(jogadores.map((j) => [j.userId, j.baloes])));
  const [baloes, setBaloes] = useState(new Map(baloesVerdade.current));
  const euVivo = piloto && (baloes.get(eu) ?? 0) > 0;
  // sem balão, o kart segue de fantasma (21/11/2026): os controles continuam
  const controles = useControles(piloto);
  const rivais = useRef(new Map<number, Rival>());
  const eventos = useRef<EventoDoBalao[]>([]);

  // os balões de cada um, pela verdade do servidor (a cada "mudou"). Um balão nunca volta: o estado que chega atrasado, de
  // antes de um estouro que já veio pelo socket, não devolve nada
  useEffect(() => {
    let mudou = false;
    for (const j of jogadores) {
      const antes = baloesVerdade.current.get(j.userId) ?? j.baloes;
      if (j.baloes < antes) mudou = true;
      baloesVerdade.current.set(j.userId, Math.min(j.baloes, antes));
    }
    if (mudou) setBaloes(new Map(baloesVerdade.current));
  }, [jogadores]);
  for (const q of participantes.current) {
    if (q.id === eu || rivais.current.has(q.id)) continue;
    rivais.current.set(q.id, { nome: q.nome, avatar: q.avatar, posicoes: [] });
  }

  // AS POSIÇÕES E OS ITENS DOS OUTROS chegam pelo socket, carimbados pelo servidor; os estouros também (pelo difundir)
  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados) return;
      const d = m.dados;
      if (d.tipo === 'dourada') {
        // a cenoura dourada (o servidor diz com quem está): na ordem em que chega
        if (typeof d.n !== 'number' || typeof d.x !== 'number' || typeof d.y !== 'number') return;
        eventos.current.push({ tipo: 'dourada', dono: typeof d.dono === 'number' ? d.dono : null, x: d.x, y: d.y, n: d.n });
        return;
      }
      if ((TIPOS_DO_BALAO as readonly unknown[]).includes(d.tipo)) {
        if (typeof d.id !== 'string') return;
        if (!eventos.current.some((e) => e.tipo !== 'dourada' && e.id === d.id && e.tipo === d.tipo)) eventos.current.push(d as unknown as EventoDoBalao);
        return;
      }
      if (typeof d.userId !== 'number') return;
      const r = rivais.current.get(d.userId);
      const { n, x, y, a } = d as unknown as PosicaoDoRival;
      if (!r || typeof n !== 'number' || typeof x !== 'number' || typeof y !== 'number' || typeof a !== 'number') return;
      const ultima = r.posicoes.at(-1);
      if (ultima && ultima.n >= n) return;
      r.posicoes.push({ n, x, y, a, andou: 0 });
      if (r.posicoes.length > 2000) r.posicoes.splice(0, 1000);
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId]);

  useEffect(() => {
    if (!canvas.current) return;
    tela.current?.focus();
    // O SINAL VERDE neste computador: durante a contagem, daqui a `restanteMs`; para quem abre no meio, o que já passou
    const verdeEm =
      estado.fase === 'largada' ? performance.now() + Math.max(0, estado.restanteMs ?? 0) : performance.now() - Math.max(0, estado.decorridoMs ?? 0);
    const enviar = (dados: Record<string, unknown>) => socket?.emit('minijogo:tempo-real', { channelId, dados });
    // quem abre no meio da partida: a cenoura onde o servidor diz que está agora (o tempo de antes, só no placar do fim)
    if (dourada && estado.dourada && (estado.dourada.dono !== null || estado.dourada.n > 0)) eventos.current.push({ tipo: 'dourada', ...estado.dourada });
    return rodarBalao({
      canvas: canvas.current,
      comandos: controles.comandos.current,
      arena: estado.arena ?? 'horta',
      eu,
      piloto,
      participantes: participantes.current,
      duplas,
      dourada,
      aoDourada: (d) => {
        const a = ouroRef.current;
        if (a.dono === d.dono && [...d.segundos].every(([id, s]) => a.segundos.get(id) === s)) return;
        if (d.dono !== a.dono) tocar(d.dono === eu ? 'moeda' : a.dono === eu ? 'queda' : 'clique');
        ouroRef.current = d;
        setOuro(d);
      },
      semente: estado.semente ?? 0,
      verdeEm,
      baloes: baloesVerdade.current,
      rivais: rivais.current,
      eventos: eventos.current,
      enviar,
      pausaSemFoco: false,
      aoItem: (i) => {
        setItem(i);
        if (i) tocar('moeda');
      },
      aoPlacar: (p) => setRestante((a) => (Math.ceil(a.restanteMs / 1000) === Math.ceil(p.restanteMs / 1000) ? a : p)),
      aoBaloes: (b) =>
        setBaloes((antes) => {
          if ((b.get(eu) ?? BALOES) < (antes.get(eu) ?? BALOES)) tocar('queda');
          else if ([...b].some(([id, n]) => n < (antes.get(id) ?? BALOES))) tocar('acerto');
          return b;
        }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="corrida balao">
      <div className="corrida-tela" ref={tela} tabIndex={-1}>
        <canvas ref={canvas} width={W} height={H} />
        <div className="corrida-placar balao-placar" aria-live="off">
          <span />
          <span className="corrida-relogio">{relogio(restante.restanteMs)}</span>
        </div>
        {dourada ? (
          <DouradaDeTodos participantes={participantes.current} dourada={ouro} eu={eu} duplas={duplas} />
        ) : (
          <BaloesDeTodos participantes={participantes.current} baloes={baloes} eu={eu} duplas={duplas} />
        )}
        {piloto && !dourada && !euVivo && <p className="balao-aviso">{t('Sem balões: você segue de fantasma, soltando itens.')}</p>}
        {piloto && <MeuPainel quantos={baloes.get(eu) ?? 0} cor={corDe(participantes.current.find((q) => q.id === eu), duplas)} item={item} semBaloes={dourada} />}
        {piloto && <BotoesDeToque controles={controles} item={item} />}
      </div>
      <Comandos_ piloto={piloto} />
      {euVivo && (
        <p className="settings-hint corrida-dica">
          {dourada
            ? t('Segure a cenoura dourada: quem leva um item ou uma batida a derruba. Ganha quem a segurar por mais tempo.')
            : t('Pegue as caixas e estoure os balões dos outros. Quem fica sem balão sai.')}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// O FIM
// ---------------------------------------------------------------------------------------------------------------------

function TelaDoFim({ estado, eu }: { estado: EstadoBalao; eu: number }) {
  const t = useT();
  if (estado.solo) {
    const r = estado.resultadoDoSolo;
    if (!r) return <p className="minijogo-situacao">{t('Fim de jogo!')}</p>;
    return (
      <div className="balao-fim-solo">
        <p className="minijogo-situacao">{r.posicao === 1 ? t('Você venceu!') : t('{posicao}º lugar, entre {total}', { posicao: r.posicao, total: r.total })}</p>
        <p className="settings-hint">
          {typeof r.dourada === 'number'
            ? `🥕 ${relogio(r.dourada * 1000)}`
            : `${t('Balões que sobraram: {n}', { n: r.baloes })} · ${t('Balões estourados: {n}', { n: r.estouros })}`}
        </p>
      </div>
    );
  }
  const linhas = (estado.jogadores ?? []).filter((j) => j.posicao !== null);
  return (
    <Placar
      eu={eu}
      linhas={(linhas.length ? linhas : estado.jogadores ?? []).map((j) => ({
        userId: j.userId,
        username: j.username,
        valor: estado.modo === 'dourada' ? `🥕 ${relogio((j.dourada ?? 0) * 1000)} · 💥 ${j.estouros}` : `🎈 ${j.baloes} · 💥 ${j.estouros}`,
        posicao: j.posicao ?? undefined,
      }))}
    />
  );
}
