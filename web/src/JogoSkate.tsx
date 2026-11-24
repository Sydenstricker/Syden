import { temWebGL } from './temWebGL';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ComandosDoJogo } from './ComandosDosJogos';
import { coresDoAvatar } from './coelho3d';
import { useT } from './i18n';
import { lerControle } from './controleDosJogos';
import { comandoDaPausa, TelaDePausa, usePausaComEsc, useTeclaDeRecomecar } from './pausaDosJogos';
import { Alavanca, direcoesDaAlavanca, useGrupoDeToque } from './toqueDosJogos';
import { tocar } from './somDosJogos';
import {
  comboAberto,
  gravador,
  NADA,
  novoSkatista,
  objetivos as objetivosDa,
  type Objetivo,
  PASSO,
  passo,
  PASSOS_DA_SESSAO,
  PASSOS_MAXIMOS,
  valorDoCombo,
  type Comandos,
  type Entradas,
  type Evento,
  type Manobra,
  type Skatista,
} from './skate/fisica';
import { criarPiloto } from './skate/piloto';
import { CONJUNTOS, IDS_DAS_PISTAS, pecaEm, PALAVRAS, PISTAS, usarPista } from './skate/pista';
import type { CenaDoSkate, QuadroDoOutro } from './skate/cena';
import './skate.css';

/**
 * O ROLÊ DO COELHO (05/11/2026, pedido dele: "um mini Tony Hawk"): um minuto numa pista de skate pequena, com o nosso coelho
 * 3D em cima da prancha da Kenney. SÓ A MECÂNICA dos jogos de skate de pontos: nada de nome, personagem, fase ou música de
 * ninguém (e sem música nenhuma: a regra do "nunca fazer a nossa"; os efeitos são os de somDosJogos.ts).
 *
 * A SESSÃO É DESTE COMPUTADOR, como o contra o relógio do kart: a física (skate/fisica.ts) anda em passos fixos de 1/60 s, e
 * o minuto são 3600 passos — a janela sem foco pausa tudo. No fim, os COMANDOS de cada passo vão ao servidor
 * (server/src/minijogo-skate.ts), que refaz a sessão com a mesma física (a cópia dela em server/src/skate/) e guarda o recorde.
 *
 * NA SALA (06/11/2026, pedido dele: "um modo com mais pessoas no skate, com fantasmas como fizemos no jogo de corrida"), de 2
 * a 8: o servidor dá o verde, cada um anda na própria pista, e os outros aparecem como FANTASMAS (o coelho de cada um, meio
 * transparente, com o nome em cima), pelas posições que o servidor repassa (15 por segundo), um tico atrás do meu passo e
 * interpolados. Sem batida entre skatistas, e sem pausa. Quem não joga assiste pela câmera de quem tem mais pontos.
 */

export interface EstadoSkate {
  fase: 'largada' | 'jogando' | 'fim';
  solo?: boolean;
  duracaoMs: number;
  /** O que eu já mandei (null: ainda andando). */
  meu: { pontos: number | null; melhorCombo: number | null } | null;
  /** Mais pontos primeiro; a posição só entre quem terminou (empatados dividem). */
  placar: { userId: number; username: string; avatar?: number | string | null; pontos: number | null; melhorCombo: number | null; posicao: number | null }[];
  /** O recorde de antes, e se esta sessão virou o novo (no Solo; na sala, o de cada um). */
  recorde: { antes: number | null; novo: boolean } | null;
  partidaId: string;
  /** A pista (19/11/2026: o parque ou a praça), os recordes de cada uma (no Solo) e os objetivos da sessão refeita. */
  pista?: string;
  recordes?: Record<string, number | null>;
  objetivos?: Objetivo[] | null;
  /** No Solo: o mais de objetivos já cumpridos numa sessão, por pista (e os do segundo conjunto, 21/11/2026). */
  objetivosAntes?: Record<string, number>;
  objetivosAntes2?: Record<string, number>;
  /** O conjunto de objetivos da sessão (21/11/2026): 0 o primeiro, 1 o segundo. */
  conjunto?: number;
}

type T = ReturnType<typeof useT>;

/** O nome de uma manobra na tela: as gírias do skate ficam como são; os saltos com nome ("gap:<id>") são nossos e traduzidos. */
function nomeDaManobra(t: T, nome: string): string {
  switch (nome) {
    case 'gap:meio':
      return t('Salto do meio');
    case 'gap:caixa':
      return t('Salto até a caixa');
    case 'gap:piramide':
      return t('Salto da pirâmide');
    case 'gap:esquerda':
      return t('Salto da rampa da esquerda');
    case 'gap:quarter':
      return t('Salto até o quarter');
    // os da Quadra (24/11/2026); o 'caixa' dela é o mesmo nome do parque
    case 'gap:caixote':
      return t('Salto por cima da caixa');
    case 'gap:corrimao':
      return t('Salto até o corrimão');
    default:
      return nome;
  }
}

/** O texto de um objetivo. */
function textoDoObjetivo(t: T, o: Objetivo, conjunto = 0): string {
  switch (o.id) {
    case 'letras':
      return t('Pegue as letras {palavra}', { palavra: PALAVRAS[conjunto] ?? PALAVRAS[0] });
    // as duas manobras do segundo conjunto (21/11/2026)
    case 'giro':
      return t('Pouse um giro de {n}', { n: o.valor ?? 0 });
    case 'manual':
      return t('Faça um manual de {n} s', { n: o.valor ?? 0 });
    case 'pontos':
      return t('Faça {n} pontos', { n: mil(o.valor ?? 0) });
    case 'combo':
      return t('Faça um combo de {n}', { n: mil(o.valor ?? 0) });
    case 'fita':
      return t('Ache a fita escondida');
    default:
      return nomeDaManobra(t, o.id);
  }
}

/** O nome de uma pista. */
const nomeDaPista = (t: T, id: string) => (id === 'praca-1' ? t('Praça') : id === 'quadra-1' ? t('Quadra') : t('Parque'));

/** A lista dos objetivos, com o ✓ dos cumpridos (sem pressão: o que falta só fica sem o ✓). */
function ListaDeObjetivos({ lista, conjunto = 0 }: { lista: Objetivo[]; conjunto?: number }) {
  const t = useT();
  return (
    <ul className="skate-objetivos">
      {lista.map((o) => (
        <li key={o.id} className={o.feito ? 'feito' : undefined}>
          <span aria-hidden="true">{o.feito ? '✓' : '·'}</span> {textoDoObjetivo(t, o, conjunto)}
        </li>
      ))}
    </ul>
  );
}

type Props = {
  estado: EstadoSkate & { terminada?: boolean };
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  /** Na sala: quanto falta para o verde (o relógio da partida), e o socket das posições ao vivo. */
  restante?: number;
  socket?: Socket | null;
  channelId?: number;
};

const mil = (n: number) => n.toLocaleString();
const MEDALHAS = ['🥇', '🥈', '🥉'];

/** A posição que vai à turma (a cada 4 passos): o desenho do passo e os pontos de agora (só para a ordem ao vivo). */
type Posicao = QuadroDoOutro & { n: number; p: number };

/** Um skatista da turma: as posições que o servidor repassou, pelo passo da sessão dele. */
interface Rival {
  nome: string;
  avatar: number | string | null;
  posicoes: Posicao[];
}

const jeitoDe = (k: Skatista) => (k.modo === 'ar' ? 1 : k.modo === 'grind' ? 2 : k.modo === 'manual' ? 3 : k.modo === 'caido' ? 4 : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function JogoSkate(props: Props) {
  const solo = props.estado.solo ?? props.estado.placar.length === 1;
  return solo ? <SkateSolo {...props} /> : <SkateNaSala {...props} />;
}

function Placar({ estado, eu, fim, solo }: { estado: EstadoSkate; eu: number; fim: boolean; solo: boolean }) {
  const t = useT();
  const meu = estado.placar.find((l) => l.userId === eu);
  // na sala, a turma inteira (quem ainda anda, com "…"); a posição e as medalhas só no fim
  const linhas = solo ? [] : estado.placar;
  const valem = linhas.filter((l) => l.posicao !== null).length;
  return (
    <div className="skate-fim">
      {meu && meu.pontos !== null && <p className="skate-fim-pontos">{t('Pontos: {n}', { n: mil(meu.pontos) })}</p>}
      {estado.recorde &&
        meu &&
        meu.pontos !== null &&
        (estado.recorde.novo ? (
          <p className="minijogo-situacao skate-recorde">{t('Novo recorde!')}</p>
        ) : (
          estado.recorde.antes !== null && <p className="minijogo-situacao">{t('Seu recorde: {tempo}', { tempo: mil(estado.recorde.antes) })}</p>
        ))}
      {meu && meu.melhorCombo !== null && meu.melhorCombo > 0 && <p className="minijogo-situacao">{t('Melhor combo: {n}', { n: mil(meu.melhorCombo) })}</p>}
      {estado.objetivos && estado.objetivos.length > 0 && (
        <>
          <p className="minijogo-situacao">
            {t('Objetivos')}: {estado.objetivos.filter((o) => o.feito).length}/{estado.objetivos.length}
          </p>
          <ListaDeObjetivos lista={estado.objetivos} conjunto={estado.conjunto ?? 0} />
        </>
      )}
      {linhas.length > 1 && (
        <ol className="skate-placar">
          {linhas.map((l) => (
            <li key={l.userId} className={l.userId === eu ? 'eu' : undefined}>
              <span className="skate-placar-pos">{fim ? (l.posicao === null ? '–' : valem >= 2 && l.posicao <= 3 ? MEDALHAS[l.posicao - 1] : l.posicao) : ''}</span>
              <span className="minijogo-nome">{l.username}</span>
              <strong>{l.pontos !== null ? mil(l.pontos) : fim ? '—' : '…'}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SkateSolo({ estado, eu, jogador, agir }: Props) {
  const t = useT();
  const fim = !!estado.terminada || estado.fase === 'fim';
  const meu = estado.placar.find((l) => l.userId === eu);
  // A ESCOLHA DA PISTA (19/11/2026), antes do minuto: o servidor recomeça o relógio dele quando ela chega
  const [pista, setPista] = useState<string | null>(null);
  const [marcada, setMarcada] = useState(estado.pista ?? IDS_DAS_PISTAS[0]);
  /** O conjunto de objetivos (21/11/2026), escolhido junto com a pista. */
  const [conjunto, setConjunto] = useState(estado.conjunto ?? 0);
  /** O TREINO LIVRE (20/11/2026): a pista sem relógio, só no site (o servidor nem sabe). */
  const [livre, setLivre] = useState<string | null>(null);
  /** Cada "Jogar de novo" (a pausa ou a tecla R) é uma sessão nova, do zero. */
  const [rodada, setRodada] = useState(0);
  const andando = livre !== null || (pista !== null && !fim && !!meu && meu.pontos === null);
  const recomecar = () => {
    // no minuto que vale, o relógio do servidor recomeça junto (só fica mais estrito); no treino, nada vai ao servidor
    if (livre === null && pista !== null) Promise.resolve(agir({ tipo: 'pista', pista, conjunto })).catch(() => {});
    setRodada((r) => r + 1);
  };
  const sair = () => {
    setLivre(null);
    setPista(null);
  };
  useTeclaDeRecomecar(andando, recomecar);
  if (livre !== null) {
    return (
      <Sessao
        key={`livre-${rodada}`}
        solo
        livre
        pista={Math.max(0, IDS_DAS_PISTAS.indexOf(livre))}
        conjunto={conjunto}
        aoTerminar={() => {}}
        aoRecomecar={recomecar}
        aoSair={sair}
      />
    );
  }
  if (fim || (meu && meu.pontos !== null)) return <Placar estado={estado} eu={eu} fim={fim} solo />;
  if (!jogador || !meu) return <p className="minijogo-situacao">…</p>;
  if (pista === null) {
    return (
      <div className="skate-escolha">
        <ul className="skate-pistas" role="radiogroup">
          {IDS_DAS_PISTAS.map((id) => (
            <li key={id}>
              <button type="button" role="radio" aria-checked={marcada === id} className={marcada === id ? 'escolhida' : undefined} onClick={() => setMarcada(id)}>
                <MapaDaPista id={id} conjunto={conjunto} />
                <strong>{nomeDaPista(t, id)}</strong>
                {estado.recordes?.[id] != null && <span>{t('Seu recorde: {tempo}', { tempo: mil(estado.recordes[id]!) })}</span>}
                {((conjunto === 1 ? estado.objetivosAntes2 : estado.objetivosAntes)?.[id] ?? 0) > 0 && (
                  <span>
                    {t('Objetivos')}: {(conjunto === 1 ? estado.objetivosAntes2 : estado.objetivosAntes)![id]}/
                    {conjunto === 1 ? 6 : 4 + PISTAS[IDS_DAS_PISTAS.indexOf(id)].objetivos.saltos.length}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <EscolhaDoConjunto conjunto={conjunto} aoEscolher={setConjunto} />
        <div className="minijogo-acoes">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              Promise.resolve(agir({ tipo: 'pista', pista: marcada, conjunto }))
                .then(() => setPista(marcada))
                .catch(() => setPista(marcada));
            }}
          >
            {t('Começar')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setLivre(marcada)}>
            {t('Treino livre')}
          </button>
        </div>
      </div>
    );
  }
  // ESC pausa só no Solo (o recorde é dele): na sala, o relógio é o de todos
  return (
    <Sessao
      key={`${estado.partidaId}-${rodada}`}
      solo
      pista={Math.max(0, IDS_DAS_PISTAS.indexOf(pista))}
      conjunto={conjunto}
      aoTerminar={(entradas) => void agir({ tipo: 'fim', entradas })}
      aoRecomecar={recomecar}
      aoSair={sair}
    />
  );
}

/**
 * A ESCOLHA DO CONJUNTO DE OBJETIVOS (21/11/2026): cada botão é a palavra do conjunto ("TOCA", "PULO"), que é nossa e igual em
 * todo idioma; o nome para o leitor de tela é "Objetivos 1" e "Objetivos 2".
 */
function EscolhaDoConjunto({ conjunto, aoEscolher }: { conjunto: number; aoEscolher: (c: number) => void }) {
  const t = useT();
  return (
    <div className="skate-conjuntos" role="radiogroup" aria-label={t('Objetivos')}>
      {Array.from({ length: CONJUNTOS }, (_, c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={conjunto === c}
          aria-label={`${t('Objetivos')} ${c + 1}`}
          className={conjunto === c ? 'escolhida' : undefined}
          onClick={() => aoEscolher(c)}
        >
          {'★'.repeat(c + 1)} {PALAVRAS[c]}
        </button>
      ))}
    </div>
  );
}

/** O mapa da pista, de cima (as peças com chão, por perfil), para a escolha. */
function MapaDaPista({ id, conjunto = 0 }: { id: string; conjunto?: number }) {
  const p = PISTAS[Math.max(0, IDS_DAS_PISTAS.indexOf(id))];
  const letras = conjunto === 1 ? p.segundo.letras : p.objetivos.letras;
  const cor: Record<string, string> = { quarter: '#8fa3b8', rampa: '#d9a65a', caixa: '#c46d4a', corrimao: '#3b4050' };
  return (
    <svg className="skate-mapa" viewBox="-0.5 -0.5 13 19" aria-hidden="true">
      <rect x="0" y="0" width="12" height="18" rx="0.4" fill="#cfd5dc" />
      {p.pecas
        .filter((q) => q.perfil)
        .map((q, i) => {
          const fino = q.perfil === 'corrimao' ? 0.18 : q.perfil === 'caixa' ? 0.5 : 1;
          const deLado = q.rot === 1 || q.rot === 3;
          return (
            <rect key={i} x={q.x - (deLado ? 0.5 : fino / 2)} y={q.z - (deLado ? fino / 2 : 0.5)} width={deLado ? 1 : fino} height={deLado ? fino : 1} fill={cor[q.perfil!]} />
          );
        })}
      {letras.map((l, i) => (
        <circle key={i} cx={l.x} cy={l.z} r="0.28" fill="#f2c14e" stroke="#2a2333" strokeWidth="0.08" />
      ))}
    </svg>
  );
}

function SkateNaSala({ estado, eu, jogador, agir, restante = 0, socket = null, channelId = 0 }: Props) {
  const fim = !!estado.terminada || estado.fase === 'fim';
  const meu = estado.placar.find((l) => l.userId === eu);
  // quem abre a página com a sessão já andando assiste (o relógio do servidor não deixaria a sessão dela valer)
  const [desdeALargada] = useState(() => estado.fase === 'largada');
  const corro = jogador && !!meu && desdeALargada;
  const rivais = useRef<Map<number, Rival> | null>(null);
  if (!rivais.current) {
    rivais.current = new Map(estado.placar.filter((l) => l.userId !== eu || !corro).map((l) => [l.userId, { nome: l.username, avatar: l.avatar ?? null, posicoes: [] }]));
  }
  useEffect(() => {
    if (!socket) return;
    const chegada = (m: { channelId?: number; dados?: Record<string, unknown> }) => {
      if (m.channelId !== channelId || !m.dados || typeof m.dados.userId !== 'number') return;
      const r = rivais.current?.get(m.dados.userId);
      const d = m.dados as unknown as Posicao;
      if (!r || [d.n, d.x, d.y, d.z, d.cx, d.cz].some((v) => typeof v !== 'number')) return;
      const ultima = r.posicoes.at(-1);
      if (ultima && ultima.n >= d.n) return;
      r.posicoes.push({ n: d.n, x: d.x, y: d.y, z: d.z, cx: d.cx, cz: d.cz, e: d.e | 0, b: d.b === -1 ? -1 : 1, f: d.f | 0, p: d.p | 0 });
      if (r.posicoes.length > 2000) r.posicoes.splice(0, 1000);
    };
    socket.on('minijogo:tempo-real', chegada);
    return () => {
      socket.off('minijogo:tempo-real', chegada);
    };
  }, [socket, channelId]);
  // a contagem é o relógio da partida até o verde do servidor (o mesmo semáforo para todos)
  const [contagem] = useState(() => (estado.fase === 'largada' ? Math.max(0, restante) : 0));
  if (fim || (meu && meu.pontos !== null)) return <Placar estado={estado} eu={eu} fim={fim} solo={false} />;
  if (!corro && estado.fase === 'largada') return <p className="minijogo-situacao">…</p>;
  return (
    <Sessao
      key={estado.partidaId}
      pista={Math.max(0, IDS_DAS_PISTAS.indexOf(estado.pista ?? IDS_DAS_PISTAS[0]))}
      conjunto={estado.conjunto ?? 0}
      corro={corro}
      contagemMs={contagem}
      rivais={rivais.current}
      aoPosicao={(dados) => socket?.emit('minijogo:tempo-real', { channelId, dados })}
      aoTerminar={(entradas) => void agir({ tipo: 'fim', entradas })}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// O TECLADO: setas andam (e giram no ar), Espaço pula (segurar carrega), Z flip, X grab, C manual.
// O TOQUE E O CONTROLE (20/11/2026, a segunda auditoria: "só teclado"): a alavanca e os quatro botões na tela, e o direcional
// (ou o analógico) e A, X, B, Y no controle de videogame. Os MESMOS comandos do teclado, somados: a física e o servidor não
// mudam, e a seta junto com o botão dá as variações (Heelflip, Melon…) como no teclado.
// ---------------------------------------------------------------------------------------------------------------------

/** O controle de videogame em comandos do skate: o direcional ou o analógico andam, A pula, X flip, B grab, Y manual. */
function comandosDoControle(): Comandos | null {
  const c = lerControle();
  if (!c) return null;
  return {
    frente: c.vertical < -0.4,
    tras: c.vertical > 0.4,
    esquerda: c.direcao < -0.4,
    direita: c.direcao > 0.4,
    pulo: c.a,
    flip: c.x,
    grab: c.b,
    manual: c.y,
  };
}

function useComandos() {
  const teclado = useTeclado();
  const toque = useRef<Comandos>({ ...NADA });
  const juntos = useRef<Comandos>({ ...NADA });
  /** Os comandos deste passo: o teclado, o toque e o controle, somados. */
  const ler = (): Comandos => {
    const a = teclado.current;
    const b = toque.current;
    const c = comandosDoControle() ?? NADA;
    const j = juntos.current;
    for (const k of Object.keys(NADA) as (keyof Comandos)[]) j[k] = a[k] || b[k] || c[k];
    return j;
  };
  const alavanca = (x: number, y: number) => Object.assign(toque.current, direcoesComoComandos(x, y));
  const botoes = (s: ReadonlySet<string>) => Object.assign(toque.current, { pulo: s.has('pulo'), flip: s.has('flip'), grab: s.has('grab'), manual: s.has('manual') });
  return { ler, alavanca, botoes };
}

const direcoesComoComandos = (x: number, y: number) => {
  const d = direcoesDaAlavanca(x, y);
  return { frente: d.cima, tras: d.baixo, esquerda: d.esquerda, direita: d.direita };
};

/** Os controles na tela de toque: a alavanca à esquerda, e os quatro botões à direita, no losango do controle (A embaixo). */
function ToqueDoSkate({ comandos }: { comandos: ReturnType<typeof useComandos> }) {
  const t = useT();
  const grupo = useGrupoDeToque(comandos.botoes);
  return (
    <div className="skate-toque">
      <Alavanca aoMudar={comandos.alavanca} rotulo={t('Andar')} />
      <div className="skate-toque-botoes" {...grupo}>
        <button type="button" className="manual" data-toque="manual" aria-label={t('Manual')}>
          ⇅
        </button>
        <button type="button" className="flip" data-toque="flip" aria-label={t('Kickflip')}>
          ⟲
        </button>
        <button type="button" className="grab" data-toque="grab" aria-label={t('Grab')}>
          ✋
        </button>
        <button type="button" className="pulo" data-toque="pulo" aria-label={t('Pular')}>
          ⤒
        </button>
      </div>
    </div>
  );
}

function useTeclado() {
  const comandos = useRef<Comandos>({ ...NADA });
  useEffect(() => {
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      const alvo = e.target as HTMLElement | null;
      if (apertada && alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const c = comandos.current;
      const k = e.key.toLowerCase();
      let usou = true;
      if (k === 'arrowup' || k === 'w') c.frente = apertada;
      else if (k === 'arrowdown' || k === 's') c.tras = apertada;
      else if (k === 'arrowleft' || k === 'a') c.esquerda = apertada;
      else if (k === 'arrowright' || k === 'd') c.direita = apertada;
      else if (k === ' ') c.pulo = apertada;
      else if (k === 'z') c.flip = apertada;
      else if (k === 'x') c.grab = apertada;
      else if (k === 'c') c.manual = apertada;
      else usou = false;
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    const soltar = () => Object.assign(comandos.current, NADA);
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
    };
  }, []);
  return comandos;
}

// ---------------------------------------------------------------------------------------------------------------------
// A SESSÃO
// ---------------------------------------------------------------------------------------------------------------------

interface Placa {
  id: number;
  tipo: 'combo' | 'queda';
  pontos: number;
  vezes: number;
}

interface Painel {
  pontos: number;
  restante: number;
  combo: Manobra[];
  modo: Skatista['modo'];
  contagem: number | null;
  /** A barra de especial (0 a 1), as letras pegas (um bit cada) e quantos objetivos já foram cumpridos. */
  especial: number;
  letras: number;
  feitos: number;
  total: number;
  /** Na sala: a ordem ao vivo, pelos pontos que cada um diz ter agora (o placar do fim é o que o servidor refez). */
  ordem: { id: string; nome: string; pontos: number; eu: boolean }[];
}

declare global {
  interface Window {
    /** Só no site de desenvolvimento: o e2e liga o piloto automático e lê a sessão. */
    skatePilotoAutomatico?: boolean;
    skateSessaoDoTeste?: Skatista;
  }
}

const CONTAGEM_MS = 3000;
/** Os fantasmas da turma andam este tanto de passos atrás do meu (100 ms): o que chega pela rede tem com que interpolar. */
const ATRASO_DOS_RIVAIS = 6;

/** A posição do rival no passo `n` (fracionário), entre as duas posições que o servidor repassou em volta dele. */
function posicaoDoRival(r: Rival, n: number): Posicao | null {
  const l = r.posicoes;
  if (!l.length) return null;
  if (n <= l[0].n) return l[0];
  const u = l[l.length - 1];
  if (n >= u.n) return u;
  for (let i = l.length - 1; i > 0; i--) {
    const a = l[i - 1];
    const b = l[i];
    if (a.n <= n && n <= b.n) {
      const k = (n - a.n) / Math.max(1, b.n - a.n);
      // a prancha gira pelo caminho mais curto: interpola o vetor e deixa a cena normalizar o ângulo
      return { ...b, n, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, cx: a.cx + (b.cx - a.cx) * k, cz: a.cz + (b.cz - a.cz) * k, e: k < 0.5 ? a.e : b.e };
    }
  }
  return u;
}

/** O skatista "de mentira" que a câmera segue quando eu só assisto: o desenho de um rival, com o que a cena lê. */
function skatistaDoRival(q: Posicao, k: Skatista): Skatista {
  usarPista(k.pista);
  k.x = q.x;
  k.y = q.y;
  k.z = q.z;
  k.cx = q.cx;
  k.cz = q.cz;
  k.rx = q.cx;
  k.rz = q.cz;
  k.vel = 1;
  k.base = q.b;
  k.flip = q.f;
  k.modo = q.e === 1 ? 'ar' : q.e === 2 ? 'grind' : q.e === 3 ? 'manual' : q.e === 4 ? 'caido' : 'chao';
  k.saida = 'ollie';
  k.peca = pecaEm(q.x, q.z);
  k.pontos = q.p;
  return k;
}

export function Sessao({
  aoTerminar,
  pista = 0,
  conjunto = 0,
  solo = false,
  corro = true,
  contagemMs = CONTAGEM_MS,
  rivais,
  aoPosicao,
  livre = false,
  aoRecomecar,
  aoSair,
}: {
  aoTerminar: (entradas: Entradas, k: Skatista) => void;
  /** A pista (o índice em PISTAS). */
  pista?: number;
  /** O conjunto de objetivos (21/11/2026): 0 ou 1. */
  conjunto?: number;
  solo?: boolean;
  /** false: só assisto (a câmera segue quem tem mais pontos). */
  corro?: boolean;
  contagemMs?: number;
  rivais?: Map<number, Rival>;
  aoPosicao?: (dados: Posicao) => void;
  /** O TREINO LIVRE (20/11/2026, só no Solo e só no site): sem relógio, sem fim, nada vai ao servidor. */
  livre?: boolean;
  /** No Solo: o "Jogar de novo" e o "Sair" da pausa. */
  aoRecomecar?: () => void;
  aoSair?: () => void;
}) {
  const t = useT();
  const caixa = useRef<HTMLDivElement>(null);
  const medidor = useRef<HTMLDivElement>(null);
  const entrada = useComandos();
  const [toque] = useState(() => !!window.matchMedia?.('(pointer: coarse)').matches);
  const [estado, setEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (temWebGL() ? 'carregando' : 'falhou'));
  const [painel, setPainel] = useState<Painel>({
    pontos: 0,
    restante: PASSOS_DA_SESSAO,
    combo: [],
    modo: 'chao',
    contagem: Math.ceil(contagemMs / 1000),
    ordem: [],
    especial: 0,
    letras: 0,
    feitos: 0,
    total: 0,
  });
  const [placas, setPlacas] = useState<Placa[]>([]);
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;
  const posicao = useRef(aoPosicao);
  posicao.current = aoPosicao;
  const { pausa, pausado, continuar } = usePausaComEsc(solo && estado === 'pronta');

  useEffect(() => {
    if (estado === 'falhou' || !caixa.current) return;
    let viva = true;
    let cena: CenaDoSkate | null = null;
    let id = 0;
    let placaId = 0;
    const lista = rivais ? [...rivais.entries()] : [];
    import('./skate/cena')
      .then(async ({ CenaDoSkate }) => {
        if (!viva || !caixa.current) return;
        // a cena lê a pista que as contas leem: a desta sessão
        usarPista(pista);
        cena = new CenaDoSkate(caixa.current);
        await cena.montar(lista.map(([, r]) => ({ cores: coresDoAvatar(r.avatar), nome: r.nome })));
        if (!viva) return;
        usarPista(pista);
        cena.montarObjetivos(conjunto === 1 ? PISTAS[pista].segundo : PISTAS[pista].objetivos, PALAVRAS[conjunto] ?? PALAVRAS[0]);
        setEstado('pronta');
        const k = novoSkatista(pista, conjunto);
        if (import.meta.env.DEV && corro) window.skateSessaoDoTeste = k;
        const gravar = gravador();
        const piloto = criarPiloto();
        let antes = { x: k.x, y: k.y, z: k.z };
        let acumulado = 0;
        let ultimo = performance.now();
        let ultimoPainel = 0;
        let largada = performance.now() + contagemMs;
        let mandou = false;
        let comandos: Comandos = NADA;
        /** Quem só assiste: o passo do mundo desde o verde, e quem a câmera segue (pintado com as cores dele). */
        let nAssistindo = 0;
        let seguido = -1;
        const deMentira = novoSkatista(pista);
        let feitosAntes = 0;
        let especialCheio = false;
        let letrasAntes = 0;
        let fitaAntes = false;

        const ouvir = (e: Evento) => {
          switch (e.tipo) {
            case 'ollie':
              tocar('pulo');
              break;
            case 'pouso':
              tocar('tacada');
              break;
            case 'grind':
              tocar('carta');
              break;
            case 'manobra':
              if (e.nome.startsWith('gap:')) tocar('bandeira');
              else if (e.nome.startsWith('Double')) tocar('turbo');
              else if (e.nome.endsWith('flip') || e.nome.endsWith('Flip') || e.nome.endsWith('Shove-it')) tocar('clique');
              break;
            case 'combo':
              tocar(e.vezes >= 3 ? 'combo' : 'moeda');
              if (e.vezes >= 2 || e.pontos >= 300) {
                const p: Placa = { id: ++placaId, tipo: 'combo', pontos: e.pontos, vezes: e.vezes };
                setPlacas((l) => [...l.slice(-2), p]);
                setTimeout(() => setPlacas((l) => l.filter((x) => x.id !== p.id)), 1800);
              }
              break;
            case 'queda': {
              tocar('queda');
              const p: Placa = { id: ++placaId, tipo: 'queda', pontos: e.perdeu, vezes: 0 };
              setPlacas((l) => [...l.slice(-2), p]);
              setTimeout(() => setPlacas((l) => l.filter((x) => x.id !== p.id)), 1600);
              break;
            }
          }
        };

        const quadro = () => {
          if (!viva || !cena) return;
          id = requestAnimationFrame(quadro);
          const agora = performance.now();
          const dt = Math.min(0.1, (agora - ultimo) / 1000);
          ultimo = agora;
          // sem foco (o jogo de verdade, outra janela), escondida ou pausada (ESC): nem física, nem desenho, e a contagem espera
          if (document.hidden || !document.hasFocus() || pausa.ativa) {
            if (largada > agora) largada += dt * 1000;
            return;
          }
          const contando = largada > agora;
          if (!contando && !k.terminou) {
            acumulado += dt;
            let n = 0;
            while (acumulado >= PASSO && n < 6 && !k.terminou) {
              acumulado -= PASSO;
              n++;
              if (!corro) {
                if (nAssistindo < PASSOS_MAXIMOS) nAssistindo++;
                continue;
              }
              antes = { x: k.x, y: k.y, z: k.z };
              comandos = import.meta.env.DEV && window.skatePilotoAutomatico ? piloto(k) : entrada.ler();
              if (livre) {
                // o treino não acaba: o passo volta antes do fim do minuto (por um múltiplo de 23, o ciclo da deriva da física,
                // para o skate andar igual), e nada é gravado
                if (k.passo >= PASSOS_DA_SESSAO - 600) k.passo -= 23 * 78;
              } else gravar.anotar(comandos);
              passo(k, comandos);
              for (const e of k.eventos) ouvir(e);
              if (k.passo % 4 === 0 || k.terminou) {
                posicao.current?.({
                  n: k.passo,
                  x: r2(k.x),
                  y: r2(k.y),
                  z: r2(k.z),
                  cx: r2(k.cx),
                  cz: r2(k.cz),
                  e: jeitoDe(k),
                  b: k.base > 0 ? 1 : -1,
                  f: k.flip,
                  p: k.pontos,
                });
              }
            }
            if (n === 6) acumulado = 0;
          }
          const f = contando ? 1 : Math.min(1, acumulado / PASSO);
          // A TURMA: cada rival no meu passo (um tico atrás), interpolado entre as posições que chegaram
          const nR = (corro ? k.passo : nAssistindo) - ATRASO_DOS_RIVAIS + f;
          const quadros = lista.map(([, r]) => posicaoDoRival(r, nR));
          if (!corro) {
            // quem só assiste segue quem tem mais pontos (e o desenha no lugar do principal, com as cores dele)
            let melhor = -1;
            quadros.forEach((q, i) => q && (melhor < 0 || q.p > quadros[melhor]!.p) && (melhor = i));
            if (melhor >= 0 && melhor !== seguido) {
              seguido = melhor;
              cena.pintar(coresDoAvatar(lista[melhor][1].avatar));
            }
          }
          const seguida = !corro && seguido >= 0 ? quadros[seguido] : null;
          // as letras e a fita: de quem joga, as que ele pegou somem; quem assiste vê todas
          cena.marcarPegos(corro ? k.letras : 0, corro ? k.fita : false, dt);
          // o som do que acabou de ser cumprido (um objetivo, a barra cheia)
          if (corro) {
            const objs = objetivosDa(k);
            const feitos = objs.filter((o) => o.feito).length;
            if (feitos > feitosAntes) tocar('medalha');
            else if (k.letras !== letrasAntes || (k.fita && !fitaAntes)) tocar('item');
            feitosAntes = feitos;
            letrasAntes = k.letras;
            fitaAntes = k.fita;
            if (k.especial >= 1 && !especialCheio) tocar('turbo');
            especialCheio = k.especial >= 1;
          }
          cena.desenharOutros(
            quadros.map((q, i) => (i === seguido && !corro ? null : q)),
            dt,
          );
          if (seguida) {
            const kk = skatistaDoRival(seguida, deMentira);
            cena.desenhar(kk, kk, 1, dt, false);
          } else cena.desenhar(antes, k, f, dt, comandos.frente);
          // o equilíbrio vai direto na barra (todo quadro); o resto do painel, umas 12 vezes por segundo
          const m = medidor.current;
          if (m) {
            const mostra = corro && (k.modo === 'grind' || k.modo === 'manual');
            m.style.visibility = mostra ? 'visible' : 'hidden';
            m.dataset.eixo = k.modo === 'manual' ? 'vertical' : 'horizontal';
            m.style.setProperty('--equilibrio', String(Math.max(-1, Math.min(1, k.equilibrio))));
          }
          if (agora - ultimoPainel > 80) {
            ultimoPainel = agora;
            const ordem = lista.length
              ? [
                  ...(corro ? [{ id: 'eu', nome: '', pontos: k.pontos, eu: true }] : []),
                  ...lista.map(([uid, r], i) => ({ id: `r${uid}`, nome: r.nome, pontos: quadros[i]?.p ?? 0, eu: false })),
                ].sort((a, b) => b.pontos - a.pontos)
              : [];
            const passoAgora = corro ? k.passo : nAssistindo;
            const objs = corro ? objetivosDa(k) : [];
            setPainel({
              pontos: corro ? k.pontos : (seguida?.p ?? 0),
              restante: Math.max(0, PASSOS_DA_SESSAO - passoAgora),
              combo: corro ? comboAberto(k) : [],
              modo: k.modo,
              contagem: contando ? Math.ceil((largada - agora) / 1000) : null,
              ordem,
              especial: corro ? k.especial : 0,
              letras: corro ? k.letras : 0,
              feitos: objs.filter((o) => o.feito).length,
              total: objs.length,
            });
          }
          if (corro && k.terminou && !mandou && !livre) {
            mandou = true;
            tocar('fim');
            terminar.current(gravar.entradas, k);
          }
        };
        id = requestAnimationFrame(quadro);
      })
      .catch(() => {
        cena?.destruir();
        cena = null;
        if (viva) setEstado('falhou');
      });
    return () => {
      viva = false;
      cancelAnimationFrame(id);
      cena?.destruir();
    };
    // a cena nasce uma vez por sessão
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado === 'falhou']);

  if (estado === 'falhou') return <p className="minijogo-situacao">{t('Este jogo precisa de gráficos 3D, que não abriram neste aparelho.')}</p>;

  const seg = Math.ceil(painel.restante * PASSO);
  const relogio = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  const combo = painel.combo;
  return (
    <div className="skate">
      <div className="skate-moldura">
        <div ref={caixa} className={`skate-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
        {estado === 'pronta' && (
          <div className="skate-painel" aria-hidden="true">
            <span className="skate-pontos">{mil(painel.pontos)}</span>
            {!livre && <span className={`skate-relogio${painel.restante < 600 ? ' acabando' : ''}`}>{relogio}</span>}
            {painel.ordem.length > 1 && (
              <ol className="skate-ordem">
                {painel.ordem.map((l) => (
                  <li key={l.id} className={l.eu ? 'eu' : undefined}>
                    <span>{l.eu ? '★' : l.nome}</span>
                    <strong>{mil(l.pontos)}</strong>
                  </li>
                ))}
              </ol>
            )}
            {combo.length > 0 && (
              <div className="skate-combo">
                <span className="skate-manobras">{combo.map((m) => nomeDaManobra(t, m.nome)).join(' + ')}</span>
                <span className="skate-valor">
                  {mil(combo.reduce((s, m) => s + m.pontos, 0))} × {combo.length}
                  <small> = {mil(valorDoCombo(combo))}</small>
                </span>
              </div>
            )}
            <div className="skate-placas">
              {placas.map((p) =>
                p.tipo === 'combo' ? (
                  <span key={p.id} className="skate-placa">
                    +{mil(p.pontos)}
                  </span>
                ) : (
                  <span key={p.id} className="skate-placa queda">
                    {t('Caiu!')}
                    {p.pontos > 0 && <s> {mil(p.pontos)}</s>}
                  </span>
                ),
              )}
            </div>
            <div ref={medidor} className="skate-equilibrio" style={{ visibility: 'hidden' }}>
              <span />
            </div>
            {corro && (
              <div className="skate-objetivos-painel">
                <span className="skate-letras">
                  {[...(PALAVRAS[conjunto] ?? PALAVRAS[0])].map((l, i) => (
                    <b key={i} className={painel.letras & (1 << i) ? 'pega' : undefined}>
                      {l}
                    </b>
                  ))}
                </span>
                <span className="skate-feitos">
                  ★ {painel.feitos}/{painel.total}
                </span>
                <span className={`skate-especial${painel.especial >= 1 ? ' cheia' : ''}`} title={t('Especial')}>
                  <span style={{ width: `${Math.round(painel.especial * 100)}%` }} />
                </span>
              </div>
            )}
            {painel.contagem !== null && <span className="skate-contagem">{painel.contagem}</span>}
          </div>
        )}
        {estado === 'pronta' && corro && toque && <ToqueDoSkate comandos={entrada} />}
        {pausado && <TelaDePausa aoContinuar={continuar} aoRecomecar={aoRecomecar} aoSair={aoSair} />}
      </div>
      {corro && (
        <ComandosDoJogo
          itens={[
            { teclas: ['setas'], rotulo: t('Andar') },
            { teclas: ['espaco'], rotulo: t('Pular') },
            { teclas: ['setas-lado'], rotulo: t('Girar') },
            { teclas: ['z'], rotulo: t('Kickflip') },
            { teclas: ['x'], rotulo: t('Grab') },
            { teclas: ['setas', 'z'], rotulo: t('Outras manobras') },

            { teclas: ['c'], rotulo: t('Manual') },
            ...(solo ? [comandoDaPausa(t)] : []),
          ]}
        />
      )}
    </div>
  );
}

/** A escolha da pista na sala (antes do convite): o mapa de cada uma, e clicar começa (19/11/2026). */
export function EscolhaDaPistaDoSkate({ aoEscolher, aoVoltar }: { aoEscolher: (pista: string, conjunto: number) => void; aoVoltar: () => void }) {
  const t = useT();
  const [conjunto, setConjunto] = useState(0);
  return (
    <div className="skate-escolha">
      <EscolhaDoConjunto conjunto={conjunto} aoEscolher={setConjunto} />
      <ul className="skate-pistas">
        {IDS_DAS_PISTAS.map((id) => (
          <li key={id}>
            <button type="button" onClick={() => aoEscolher(id, conjunto)}>
              <MapaDaPista id={id} conjunto={conjunto} />
              <strong>{nomeDaPista(t, id)}</strong>
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
