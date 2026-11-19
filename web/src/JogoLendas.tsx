import { Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { folhaDe } from './briga/desenho';
import { carregarFolhas } from './briga/sprites';
import type { TipoDeInimigo } from './briga/fases';
import { chave, useT } from './i18n';
import { useJanelaComFoco } from './janelaComFoco';
import {
  desenharCena,
  EVENTO_MS,
  H,
  inimigoEm,
  letraDoInimigo,
  tocadosAte,
  vidaNaTela,
  W,
  type Classe,
  type Evento,
  type HeroiNaTela,
  type InimigoNaTela,
} from './lendas/desenho';
import { Relogio } from './Minijogo';
import type { Partida } from './minijogos';
import { tocar } from './somDosJogos';
import './lendas.css';

/**
 * LENDAS DA TOCA (16/11/2026, server/src/lendas-regras.ts): o RPG de turnos da turma, só a mecânica do gênero. Cada um
 * escolhe a classe do seu herói, e na luta a turma escolhe AO MESMO TEMPO o que fazer na rodada; o servidor resolve tudo pela
 * velocidade e manda os acontecimentos, que a tela toca um a um (lendas/desenho.ts). Entre as lutas, o mapa do caminho, o voto
 * da bifurcação, a loja ou o evento, e o espólio com a melhoria do nível (19/11/2026). O texto na tela é pouco de propósito:
 * o que dá para dizer com figura (a classe, a peça, a energia, a melhoria) é figura.
 */

// Os mesmos números do servidor.
const TEMPO_DA_ESCOLHA = 20_000;
const TEMPO_DA_CLASSE = 30_000;
const TEMPO_DO_ESPOLIO = 20_000;
const TEMPO_DA_LOJA = 20_000;
const TEMPO_DO_RUMO = 15_000;
const CUSTO_DO_COMBO = 2;

type Acao = 'atacar' | 'habilidade' | 'defender' | 'combo';
type Peca = 'arma' | 'armadura' | 'amuleto';
type Melhoria = 'vida' | 'forca' | 'magia' | 'pele' | 'pressa' | 'folego';
type TipoDeParada = 'luta' | 'descanso' | 'loja' | 'evento' | 'chefe';

interface Heroi extends HeroiNaTela {
  avatar: number | string | null;
  robo: boolean;
  presente: boolean;
  en: number;
  enMax: number;
  atk: number;
  mag: number;
  def: number;
  nivel?: number;
  habilidades?: { id: string; custo: number; alvo: 'inimigo' | 'nenhum' }[];
  envenenado?: boolean;
  /** (servidor antigo) o custo da habilidade única */
  custo?: number;
  equip: Record<Peca, number>;
  pontos: number;
  escolheu: boolean;
  peloRobo: boolean;
  noCombo: boolean;
  alvoDoCombo: number | null;
}

export interface EstadoLendas {
  partidaId: string;
  fase: 'classes' | 'mapa' | 'rumo' | 'descanso' | 'loja' | 'evento' | 'escolha' | 'acao' | 'espolio' | 'fim';
  parada: number;
  rota: { opcoes: { id: string; tipo: TipoDeParada }[]; escolhida: string | null }[];
  cenario?: string;
  tipoDaParada?: TipoDeParada;
  evento?: 'fonte' | 'bau' | 'treino' | null;
  rumo?: { opcoes: string[]; votos: Record<string, number> } | null;
  rodada: number;
  rodadasTotais?: number;
  resolucao: number;
  venceu: boolean;
  herois: Heroi[];
  inimigos: InimigoNaTela[];
  eventos: Evento[];
  minhaEscolha: { acao: Acao; alvo: number | null; hab?: number } | null;
  meuEspolio: { item: { peca: Peca; valor: number } | null; atual: Record<Peca, number>; decidi: boolean; melhorias?: Melhoria[]; melhorei?: boolean } | null;
  minhaLoja?: { itens: { peca: Peca; valor: number }[]; atual: Record<Peca, number>; decidi: boolean } | null;
  resultado: { userId: number; username: string; pontos: number; posicao: number | null }[] | null;
  recorde?: { valor: number; antes: number | null; novo: boolean } | null;
}

export const CLASSES: { id: Classe; emoji: string; nome: string; dica: string }[] = [
  { id: 'escudo', emoji: '🛡️', nome: chave('Escudo'), dica: chave('Aguenta mais e protege a turma.') },
  { id: 'faisca', emoji: '✨', nome: chave('Faísca'), dica: chave('Acerta todos os inimigos.') },
  { id: 'erva', emoji: '🌿', nome: chave('Erva'), dica: chave('Cura a turma e levanta quem caiu.') },
  { id: 'flecha', emoji: '🏹', nome: chave('Flecha'), dica: chave('Um tiro forte, que passa da defesa.') },
];
const classe = (id: Classe | null) => CLASSES.find((c) => c.id === id);

/** As habilidades (três por classe, a segunda e a terceira pelo nível): a figura, o nome e a dica. */
const HABILIDADES: Record<string, { emoji: string; nome: string; dica: string }> = {
  proteger: { emoji: '🛡️', nome: chave('Proteger'), dica: chave('Leva o golpe no lugar da turma, com metade do dano.') },
  provocar: { emoji: '📣', nome: chave('Provocar'), dica: chave('Todos os golpes vêm em você nesta rodada, e doem menos.') },
  muralha: { emoji: '🧱', nome: chave('Muralha'), dica: chave('A turma inteira leva bem menos dano nesta rodada.') },
  chuva: { emoji: '✨', nome: chave('Chuva de faíscas'), dica: chave('Acerta todos os inimigos.') },
  raio: { emoji: '⚡', nome: chave('Raio'), dica: chave('Um golpe forte de magia num inimigo só.') },
  acelerar: { emoji: '💨', nome: chave('Acelerar'), dica: chave('A turma age antes nas duas rodadas seguintes.') },
  curar: { emoji: '🌿', nome: chave('Curar'), dica: chave('Cura a turma e levanta quem caiu.') },
  veneno: { emoji: '🧪', nome: chave('Veneno'), dica: chave('O inimigo perde vida no fim de três rodadas.') },
  renovar: { emoji: '🌱', nome: chave('Renovar'), dica: chave('A turma recupera vida no fim de três rodadas.') },
  tiro: { emoji: '🏹', nome: chave('Tiro certeiro'), dica: chave('Um tiro forte, que passa da defesa.') },
  atordoar: { emoji: '💫', nome: chave('Atordoar'), dica: chave('Um tiro que deixa o inimigo tonto: ele perde a vez.') },
  rajada: { emoji: '🎯', nome: chave('Rajada'), dica: chave('Três flechas em inimigos ao acaso.') },
};
/** O servidor antigo não manda a lista: a primeira de cada classe. */
const PRIMEIRA: Record<Classe, string> = { escudo: 'proteger', faisca: 'chuva', erva: 'curar', flecha: 'tiro' };

/** Os traços dos inimigos: a figura e a frase curta (o nome do bicho não importa, o que ele faz sim). */
const TRACOS: Record<string, { emoji: string; texto: string }> = {
  espinhos: { emoji: '🌵', texto: chave('Devolve parte do golpe de perto.') },
  ligeiro: { emoji: '💨', texto: chave('Age duas vezes por rodada.') },
  pedra: { emoji: '🪨', texto: chave('Só a magia machuca de verdade.') },
  etereo: { emoji: '👻', texto: chave('Metade dos golpes físicos passa direto.') },
  peconha: { emoji: '🧪', texto: chave('O golpe envenena.') },
  regenera: { emoji: '🍄', texto: chave('Recupera vida a cada rodada.') },
  furia: { emoji: '😤', texto: chave('Com pouca vida, bate mais forte.') },
  ladrao: { emoji: '🫳', texto: chave('O golpe rouba energia.') },
  sopro: { emoji: '🔥', texto: chave('Enche o fôlego e queima a turma inteira.') },
};

/** Os combos de três classes ou mais: o nome de cada combinação. */
const COMBOS: Record<string, string> = {
  luz: chave('Escudo de Luz'),
  tempestade: chave('Tempestade de Aço'),
  raiz: chave('Raiz de Ferro'),
  polen: chave('Chuva de Pólen'),
  coracao: chave('Coração da Toca'),
};

/** As melhorias do nível: só figura e número. */
const MELHORIAS: Record<Melhoria, string> = { vida: '❤️ +20', forca: '⚔️ +4', magia: '🔮 +4', pele: '🛡️ +3', pressa: '💨 +2', folego: '⚡ +2' };

/** As bases do servidor, para a escolha de classe mostrar a diferença em barras (sem números nem palavras). */
const BARRAS: Record<Classe, [number, number, number, number]> = {
  // vida, ataque, magia, velocidade (de 0 a 5)
  escudo: [5, 3, 1, 1],
  faisca: [2, 1, 5, 2],
  erva: [3, 1, 4, 2],
  flecha: [3, 4, 1, 5],
};
const ICONES_DAS_BARRAS = ['❤️', '⚔️', '🔮', '💨'];

const PARADAS: Record<string, { emoji: string; nome: string }> = {
  floresta: { emoji: '🌲', nome: chave('Floresta') },
  horta: { emoji: '🥕', nome: chave('Horta') },
  deserto: { emoji: '🌵', nome: chave('Deserto') },
  ruinas: { emoji: '🏚️', nome: chave('Ruínas') },
  fogueira: { emoji: '🔥', nome: chave('Fogueira') },
  loja: { emoji: '🎒', nome: chave('Loja') },
  evento: { emoji: '❓', nome: chave('Surpresa') },
  neve: { emoji: '❄️', nome: chave('Neve') },
  geleira: { emoji: '🧊', nome: chave('Geleira') },
  castelo: { emoji: '🏰', nome: chave('Castelo') },
};
const EVENTOS: Record<string, { emoji: string; texto: string }> = {
  fonte: { emoji: '⛲', texto: chave('Uma fonte: a turma recupera a vida e a energia.') },
  bau: { emoji: '🧰', texto: chave('Um baú: cada um ganhou uma peça.') },
  treino: { emoji: '🎯', texto: chave('Um treino: a turma ficou mais forte.') },
};
const PECAS: Record<Peca, { emoji: string; atributo: string }> = {
  arma: { emoji: '🗡️', atributo: '⚔️🔮' },
  armadura: { emoji: '🪖', atributo: '🛡️' },
  amuleto: { emoji: '💍', atributo: '❤️' },
};

declare global {
  interface Window {
    /** Só no desenvolvimento: escolhe sozinho (o e2e). */
    lendasPilotoAutomatico?: boolean;
  }
}

/** As habilidades que o herói tem agora (o servidor antigo mandava só o custo da primeira). */
const habilidadesDe = (h: Heroi | null) =>
  !h || !h.classe ? [] : (h.habilidades ?? [{ id: PRIMEIRA[h.classe], custo: h.custo ?? 2, alvo: h.classe === 'flecha' ? ('inimigo' as const) : ('nenhum' as const) }]);

export function JogoLendas({
  estado,
  eu,
  jogador,
  restante,
  agir,
}: {
  estado: EstadoLendas & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: (corpo: Record<string, unknown>) => Promise<void>;
}) {
  const t = useT();
  const meu = estado.herois.find((h) => h.userId === eu) ?? null;
  const solo = estado.solo === true;
  // as medalhas só com o pódio de verdade: o dragão vencido e duas pessoas ou mais (no Solo, a ordem é só a da turma)
  const medalhas = estado.venceu && (estado.resultado?.filter((l) => l.posicao !== null).length ?? 0) >= 2;
  const relogio = solo ? null : restante;

  // o som da vitória e do recorde
  useEffect(() => {
    if (estado.fase !== 'fim') return;
    tocar(estado.venceu ? (estado.recorde?.novo ? 'medalha' : 'fim') : 'derrota');
  }, [estado.fase]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="lendas">
      <Caminho estado={estado} />
      {estado.fase === 'classes' && <EscolhaDaClasse estado={estado} meu={meu} jogador={jogador} agir={agir} restante={relogio} />}
      {estado.fase === 'rumo' && <Rumo estado={estado} eu={eu} jogador={jogador} agir={agir} restante={relogio} />}
      {(estado.fase === 'mapa' || estado.fase === 'descanso') && <Turma herois={estado.herois} eu={eu} descanso={estado.fase === 'descanso'} />}
      {estado.fase === 'evento' && estado.evento && (
        <div className="lendas-evento">
          <span className="lendas-peca-emoji" aria-hidden="true">
            {EVENTOS[estado.evento]?.emoji}
          </span>
          <p>{t(EVENTOS[estado.evento]?.texto ?? '')}</p>
          <Turma herois={estado.herois} eu={eu} />
        </div>
      )}
      {(estado.fase === 'escolha' || estado.fase === 'acao') && <Luta estado={estado} eu={eu} meu={jogador ? meu : null} agir={agir} restante={relogio} />}
      {estado.fase === 'espolio' && <Espolio estado={estado} eu={eu} agir={agir} restante={relogio} />}
      {estado.fase === 'loja' && <Loja estado={estado} eu={eu} agir={agir} restante={relogio} />}
      {estado.fase === 'fim' && estado.resultado && (
        <div className="minijogo-fim">
          <p className="minijogo-fim-titulo">
            <Trophy size={20} aria-hidden="true" /> {estado.venceu ? t('Vitória!') : t('Derrota')}
          </p>
          {estado.recorde && (
            <p className="lendas-recorde">
              {estado.recorde.novo ? `🏆 ${t('Novo recorde!')} ` : ''}
              {t('{n} rodadas até o dragão', { n: estado.recorde.valor })}
              {estado.recorde.antes !== null && ` · ${t('Recorde: {n} rodadas', { n: Math.min(estado.recorde.antes, estado.recorde.valor) })}`}
            </p>
          )}
          <ol className="minijogo-placar">
            {estado.resultado.map((l, n) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha">{medalhas && l.posicao !== null && l.posicao <= 3 ? ['🥇', '🥈', '🥉'][l.posicao - 1] : `${n + 1}.`}</span>
                <span className="minijogo-nome">
                  {classe(estado.herois.find((h) => h.userId === l.userId)?.classe ?? null)?.emoji} {l.username}
                </span>
                <span className="minijogo-pontos">{l.pontos}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** O mapa do caminho: os cinco passos (a bifurcação com as duas paradas, a escolhida em destaque), o de agora marcado. */
function Caminho({ estado }: { estado: EstadoLendas }) {
  const t = useT();
  return (
    <ol className="lendas-caminho">
      {estado.rota.map((p, k) => {
        const agora = k === estado.parada && estado.fase !== 'classes';
        return (
          <li key={k} className={`${k < estado.parada ? 'feita' : agora ? 'agora' : ''}${p.opcoes.length > 1 ? ' bifurcacao' : ''}`}>
            {p.opcoes.map((o) => (
              <span key={o.id} className={p.escolhida && p.escolhida !== o.id ? 'outra' : ''} title={t(PARADAS[o.id]?.nome ?? '')}>
                {PARADAS[o.id]?.emoji ?? '•'}
              </span>
            ))}
            {agora && (
              <span className="lendas-coelho" aria-hidden="true">
                🐰
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A BIFURCAÇÃO: as duas paradas, e cada um vota (o voto é aberto; empate, o servidor sorteia). */
function Rumo({
  estado,
  eu,
  jogador,
  agir,
  restante,
}: {
  estado: EstadoLendas;
  eu: number;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => Promise<void>;
  restante: number | null;
}) {
  const t = useT();
  const rumo = estado.rumo;
  // o piloto do e2e vai sempre pelo primeiro
  useEffect(() => {
    if (!import.meta.env.DEV || !window.lendasPilotoAutomatico || !rumo || rumo.votos[String(eu)] !== undefined) return;
    const pausa = setTimeout(() => void agir({ tipo: 'rumo', lado: 0 }), 600);
    return () => clearTimeout(pausa);
  }, [estado.parada]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rumo) return null;
  const quem = (lado: number) =>
    Object.entries(rumo.votos)
      .filter(([, v]) => v === lado)
      .map(([id]) => estado.herois.find((h) => h.userId === Number(id))?.username ?? '?');
  return (
    <div className="lendas-rumo">
      {restante !== null && <Relogio restante={restante} total={TEMPO_DO_RUMO} />}
      <p className="lendas-titulo">{t('Para onde a turma vai?')}</p>
      <div className="lendas-rumo-opcoes">
        {rumo.opcoes.map((id, lado) => (
          <button
            key={id}
            type="button"
            className={`lendas-carta${rumo.votos[String(eu)] === lado ? ' escolhida' : ''}`}
            disabled={!jogador}
            onClick={() => void agir({ tipo: 'rumo', lado })}
            data-rumo={lado}
          >
            <span className="lendas-carta-emoji" aria-hidden="true">
              {PARADAS[id]?.emoji}
            </span>
            <strong>{t(PARADAS[id]?.nome ?? '')}</strong>
            <small>{quem(lado).join(', ')}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function EscolhaDaClasse({
  estado,
  meu,
  jogador,
  agir,
  restante,
}: {
  estado: EstadoLendas;
  meu: Heroi | null;
  jogador: boolean;
  agir: (corpo: Record<string, unknown>) => Promise<void>;
  restante: number | null;
}) {
  const t = useT();
  return (
    <div className="lendas-classes">
      {restante !== null && <Relogio restante={restante} total={TEMPO_DA_CLASSE} />}
      <p className="lendas-titulo">{t('Escolha o seu herói')}</p>
      <div className="lendas-cartas">
        {CLASSES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`lendas-carta${meu?.classe === c.id ? ' escolhida' : ''}`}
            disabled={!jogador || !meu}
            onClick={() => void agir({ tipo: 'classe', classe: c.id })}
            data-classe={c.id}
          >
            <span className="lendas-carta-emoji" aria-hidden="true">
              {c.emoji}
            </span>
            <strong>{t(c.nome)}</strong>
            <small>{t(c.dica)}</small>
            <span className="lendas-barras" aria-hidden="true">
              {BARRAS[c.id].map((n, k) => (
                <span key={k}>
                  {ICONES_DAS_BARRAS[k]}
                  <i style={{ width: `${n * 20}%` }} />
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
      <ul className="lendas-quem">
        {estado.herois
          .filter((h) => !h.robo)
          .map((h) => (
            <li key={h.userId}>
              {h.classe ? classe(h.classe)?.emoji : '…'} {h.username}
            </li>
          ))}
      </ul>
    </div>
  );
}

/** A turma em linhas: a classe, o nome, o nível, a vida e a energia (o painel de baixo dos RPGs de turno). */
function Turma({ herois, eu, descanso = false, marcas = false }: { herois: Heroi[]; eu: number; descanso?: boolean; marcas?: boolean }) {
  return (
    <ul className={`lendas-turma${descanso ? ' descanso' : ''}`}>
      {herois.map((h) => (
        <li key={h.userId} className={`${h.userId === eu ? 'eu' : ''}${h.hp <= 0 ? ' caido' : ''}`}>
          <span className="lendas-turma-classe" aria-hidden="true">
            {classe(h.classe)?.emoji ?? '…'}
          </span>
          <span className="minijogo-nome">
            {h.username}
            {!!h.nivel && <small className="lendas-nivel"> ★{h.nivel}</small>}
            {h.envenenado && <small aria-hidden="true"> 🧪</small>}
          </span>
          <span className="lendas-vida" title={`${h.hp}/${h.hpMax}`}>
            <i style={{ width: `${(100 * h.hp) / Math.max(1, h.hpMax)}%` }} />
            <small>{h.hp}</small>
          </span>
          <span className="lendas-energia" title={`${h.en}/${h.enMax}`} aria-label={`⚡ ${h.en}/${h.enMax}`}>
            {Array.from({ length: h.enMax }, (_, k) => (
              <i key={k} className={k < h.en ? 'cheia' : ''} />
            ))}
          </span>
          {marcas && (
            <span className="lendas-marca" aria-hidden="true">
              {h.noCombo ? '🤝' : h.escolheu ? (h.peloRobo ? '🤖' : '✓') : ''}
            </span>
          )}
        </li>
      ))}
      {descanso && <li className="lendas-fogueira" aria-hidden="true">🔥</li>}
    </ul>
  );
}

function Luta({
  estado,
  eu,
  meu,
  agir,
  restante,
}: {
  estado: EstadoLendas & Partida;
  eu: number;
  meu: Heroi | null;
  agir: (corpo: Record<string, unknown>) => Promise<void>;
  restante: number | null;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const comFoco = useJanelaComFoco();
  /** A ação que pede alvo (e qual habilidade), enquanto espero o clique no inimigo. */
  const [mirando, setMirando] = useState<{ acao: Acao; hab?: number } | null>(null);
  // A RODADA NOVA: o relógio da página marca quando os acontecimentos começam a ser tocados
  const tocando = useRef<{ resolucao: number; desde: number }>({ resolucao: -1, desde: 0 });
  if (estado.fase === 'acao' && tocando.current.resolucao !== estado.resolucao) tocando.current = { resolucao: estado.resolucao, desde: performance.now() };
  const desde = estado.fase === 'acao' && tocando.current.resolucao === estado.resolucao ? tocando.current.desde : null;
  const posso = !!meu && meu.hp > 0 && estado.fase === 'escolha';
  useEffect(() => {
    if (!posso) setMirando(null);
  }, [posso]);
  // a vez de escolher chega: o som de sempre
  useEffect(() => {
    if (estado.fase === 'escolha' && meu && meu.hp > 0) tocar('vez');
  }, [estado.fase, estado.rodada]); // eslint-disable-line react-hooks/exhaustive-deps

  // o que o desenho precisa, num ref (o laço lê sempre o último)
  const dados = useRef({ estado, mirando, desde });
  dados.current = { estado, mirando, desde };

  // as folhas: o coelho com as cores de cada um, e os bichos da parada
  const folhas = useRef(new Map<number, CanvasImageSource | null>());
  const base = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    carregarFolhas(estado.inimigos.map((i) => i.tipo as TipoDeInimigo));
  }, [estado.parada]); // eslint-disable-line react-hooks/exhaustive-deps

  // OS SONS de cada acontecimento, quando ele é tocado
  const tocadosSom = useRef(0);
  useEffect(() => {
    tocadosSom.current = 0;
  }, [desde]);

  useEffect(() => {
    if (!comFoco && !(import.meta.env.DEV && window.lendasPilotoAutomatico)) return;
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    g.imageSmoothingEnabled = false;
    if (!base.current) {
      base.current = new Image();
      base.current.src = `${import.meta.env.BASE_URL}briga/coelho.png`;
    }
    let id = 0;
    let ultimo = 0;
    const quadro = (agora: number) => {
      id = requestAnimationFrame(quadro);
      // 30 quadros por segundo bastam para uma luta de turnos
      if (agora - ultimo < 32) return;
      ultimo = agora;
      const { estado: e, mirando: m, desde: d } = dados.current;
      for (const h of e.herois) if (!folhas.current.get(h.userId) && base.current) folhas.current.set(h.userId, folhaDe(base.current, h.avatar));
      const p = e.rota[e.parada];
      desenharCena(
        g,
        {
          parada: e.cenario ?? p?.escolhida ?? p?.opcoes[0]?.id ?? 'floresta',
          herois: e.herois,
          inimigos: e.inimigos,
          eventos: d === null ? [] : e.eventos,
          desde: d,
          meuAlvo: e.minhaEscolha?.alvo ?? null,
          mirando: m !== null,
          eu,
        },
        folhas.current,
        agora,
      );
      // o som do acontecimento que acabou de começar
      if (d !== null) {
        const k = Math.floor((agora - d - 250) / EVENTO_MS) + 1;
        while (tocadosSom.current < Math.min(k, e.eventos.length)) somDoEvento(e.eventos[tocadosSom.current++]);
      }
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
  }, [comFoco, eu]);

  const habs = habilidadesDe(meu);
  const escolher = (acao: Acao, alvo: number | null = null, hab?: number) => {
    setMirando(null);
    void agir({ tipo: 'acao', acao, alvo, ...(hab !== undefined ? { hab } : {}) });
  };
  const pedeAlvo = (acao: Acao, hab?: number) => acao === 'atacar' || acao === 'combo' || (acao === 'habilidade' && habs[hab ?? 0]?.alvo === 'inimigo');
  const clicar = (acao: Acao, hab?: number) => {
    const vivos = estado.inimigos.filter((i) => i.hp > 0);
    if (!pedeAlvo(acao, hab)) return escolher(acao, null, hab);
    // com um inimigo só, nem pergunta
    if (vivos.length === 1) return escolher(acao, vivos[0].id, hab);
    // o combo de quem já chamou: vai no mesmo alvo
    const chamado = acao === 'combo' ? estado.herois.find((h) => h.noCombo && h.userId !== eu && h.alvoDoCombo !== null) : undefined;
    if (chamado) return escolher(acao, chamado.alvoDoCombo);
    setMirando({ acao, hab });
  };
  const noCanvas = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mirando) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const alvo = inimigoEm(((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * H, estado.inimigos);
    if (alvo !== null) escolher(mirando.acao, alvo, mirando.hab);
  };

  // O PILOTO DO E2E (só no site de desenvolvimento): a primeira habilidade quando dá, senão ataca o primeiro vivo
  useEffect(() => {
    if (!import.meta.env.DEV || !window.lendasPilotoAutomatico || !posso || estado.minhaEscolha) return;
    const vivo = estado.inimigos.find((i) => i.hp > 0);
    if (!vivo || !meu) return;
    const h = habs[0];
    const usa = !!h && meu.en >= h.custo;
    const pausa = setTimeout(() => escolher(usa ? 'habilidade' : 'atacar', !usa || h.alvo === 'inimigo' ? vivo.id : null, usa ? 0 : undefined), 400);
    return () => clearTimeout(pausa);
    // (as dependências são a rodada, e não cada desenho: o painel redesenha a cada 250 ms, e a pausa nunca chegava ao fim)
  }, [posso, estado.rodada, estado.parada, !!estado.minhaEscolha]); // eslint-disable-line react-hooks/exhaustive-deps

  // a vida na lista acompanha o desenho: durante a rodada, ela desce golpe a golpe (a do servidor já é a de depois)
  const tocados = desde === null ? estado.eventos.length : tocadosAte({ eventos: estado.eventos, desde }, performance.now());
  const naLista = desde === null ? estado.herois : estado.herois.map((h) => ({ ...h, hp: vidaNaTela({ h: h.userId }, h.hp, h.hpMax, estado.eventos, tocados) }));
  // o combo com nome, enquanto ele é tocado
  const atual = desde === null ? null : estado.eventos[Math.floor((performance.now() - desde - 250) / EVENTO_MS)];
  const nomeDoCombo = atual?.tipo === 'combo' && atual.nome ? COMBOS[atual.nome] : null;
  const minha = estado.minhaEscolha;
  const vivosI = estado.inimigos.filter((i) => i.hp > 0);
  return (
    <div className="lendas-luta">
      {restante !== null && estado.fase === 'escolha' && <Relogio restante={restante} total={TEMPO_DA_ESCOLHA} />}
      <div className={`lendas-tela${mirando ? ' mirando' : ''}`}>
        <canvas ref={canvas} width={W} height={H} onClick={noCanvas} />
        {nomeDoCombo && (
          <p className="lendas-combo-nome" role="status">
            {t(nomeDoCombo)}
          </p>
        )}
      </div>
      {/* os traços dos inimigos: a letra, a figura e a frase curta */}
      <ul className="lendas-tracos">
        {vivosI.map((i) =>
          i.traco && TRACOS[i.traco] ? (
            <li key={i.id}>
              <strong>{letraDoInimigo(i.id)}</strong> <span aria-hidden="true">{TRACOS[i.traco].emoji}</span> {t(TRACOS[i.traco].texto)}
            </li>
          ) : null,
        )}
      </ul>
      {/* os alvos também em botões: para o teclado, o leitor de tela, e o dedo no celular */}
      {mirando && (
        <div className="lendas-alvos">
          {vivosI.map((i) => (
            <button key={i.id} type="button" className="btn-secondary" data-alvo={i.id} onClick={() => escolher(mirando.acao, i.id, mirando.hab)}>
              <strong>{letraDoInimigo(i.id)}</strong>
              <span className="lendas-vida inimigo">
                <i style={{ width: `${(100 * i.hp) / i.hpMax}%` }} />
              </span>
            </button>
          ))}
        </div>
      )}
      {meu && (
        <div className="lendas-acoes" role="group">
          <button type="button" className={minha?.acao === 'atacar' ? 'escolhida' : ''} disabled={!posso} onClick={() => clicar('atacar')} data-acao="atacar">
            <span aria-hidden="true">⚔️</span> {t('Atacar')}
          </button>
          <button type="button" className={minha?.acao === 'defender' ? 'escolhida' : ''} disabled={!posso} onClick={() => clicar('defender')} data-acao="defender">
            <span aria-hidden="true">🛡️</span> {t('Defender')}
          </button>
          <button
            type="button"
            className={minha?.acao === 'combo' ? 'escolhida' : ''}
            disabled={!posso || meu.en < CUSTO_DO_COMBO}
            onClick={() => clicar('combo')}
            title={t('Dois ou mais no Combo atacam juntos.')}
            data-acao="combo"
          >
            <span aria-hidden="true">🤝</span> {t('Combo')} <small>⚡{CUSTO_DO_COMBO}</small>
          </button>
          {habs.map((h, k) => {
            const d = HABILIDADES[h.id];
            return (
              <button
                key={h.id}
                type="button"
                className={`lendas-hab${minha?.acao === 'habilidade' && (minha.hab ?? 0) === k ? ' escolhida' : ''}`}
                disabled={!posso || meu.en < h.custo}
                onClick={() => clicar('habilidade', k)}
                title={d ? t(d.dica) : undefined}
                data-acao="habilidade"
                data-hab={k}
              >
                <span aria-hidden="true">{d?.emoji}</span> {d ? t(d.nome) : h.id} <small>⚡{h.custo}</small>
              </button>
            );
          })}
        </div>
      )}
      <Turma herois={naLista} eu={eu} marcas={estado.fase === 'escolha'} />
    </div>
  );
}

/** O som de cada acontecimento (sintetizado, somDosJogos.ts). */
function somDoEvento(ev: Evento) {
  if (ev.tipo === 'combo') return tocar(ev.nome ? 'medalha' : 'combo');
  if (ev.tipo === 'veneno') return tocar('chiado');
  if (ev.tipo === 'renovar' || ev.tipo === 'regenera') return tocar('cura');
  if (ev.tipo === 'espinhos') return tocar('dano');
  if (ev.tipo === 'sopro') return tocar('explosao');
  if (ev.tipo === 'habilidade') {
    if (ev.hab === 'acelerar') return tocar('turbo');
    if (ev.hab === 'muralha' || ev.hab === 'proteger') return tocar('encaixe');
    if (ev.hab === 'provocar') return tocar('alarme');
    if (ev.hab === 'raio') return tocar('explosao');
    if (ev.alvos.some((a) => a.cura)) return tocar('cura');
  }
  if (ev.alvos.some((a) => a.ko)) return tocar('queda');
  if (ev.alvos.some((a) => a.errou)) return tocar('desliza');
  if (ev.tipo === 'ataque' || ev.tipo === 'inimigo' || ev.tipo === 'habilidade') tocar(ev.tipo === 'inimigo' ? 'impacto' : 'soco');
}

/** O ESPÓLIO E O NÍVEL: a peça (vestir ou deixar) e a melhoria (uma de duas). */
function Espolio({ estado, eu, agir, restante }: { estado: EstadoLendas; eu: number; agir: (corpo: Record<string, unknown>) => Promise<void>; restante: number | null }) {
  const t = useT();
  const meu = estado.meuEspolio;
  const item = meu?.item;
  // o piloto do e2e veste sempre e pega a primeira melhoria (uma vez por parada: o efeito roda duas vezes no modo estrito)
  const vestiu = useRef(-1);
  useEffect(() => {
    if (!import.meta.env.DEV || !window.lendasPilotoAutomatico || !meu || meu.decidi || vestiu.current === estado.parada) return;
    vestiu.current = estado.parada;
    // (com uma pausa: a peça fica um instante na tela, para a foto do teste)
    setTimeout(() => {
      void agir({ tipo: 'espolio', equipar: true });
      if (meu.melhorias?.length) void agir({ tipo: 'melhoria', escolha: 0 });
    }, 1500);
  }, [meu?.decidi, estado.parada]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (meu && meu.melhorias?.length && !meu.melhorei) tocar('item');
  }, [estado.parada]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="lendas-espolio">
      {restante !== null && <Relogio restante={restante} total={TEMPO_DO_ESPOLIO} />}
      {item && meu && (
        <div className="lendas-peca">
          <span className="lendas-peca-emoji" aria-hidden="true">
            {PECAS[item.peca].emoji}
          </span>
          <span className="lendas-peca-troca">
            {PECAS[item.peca].atributo} +{meu.atual[item.peca]} → <strong className={item.valor > meu.atual[item.peca] ? 'melhor' : 'pior'}>+{item.valor}</strong>
          </span>
          {!meu.decidi && (
            <div className="minijogo-acoes">
              <button type="button" className="btn-primary" onClick={() => void agir({ tipo: 'espolio', equipar: true })}>
                {t('Equipar')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => void agir({ tipo: 'espolio', equipar: false })}>
                {t('Deixar')}
              </button>
            </div>
          )}
        </div>
      )}
      {meu?.melhorias && meu.melhorias.length > 0 && (
        <div className="lendas-melhorias">
          <p className="lendas-titulo">{meu.melhorei ? '★' : t('Subiu de nível! Escolha uma melhoria.')}</p>
          {!meu.melhorei && (
            <div className="minijogo-acoes">
              {meu.melhorias.map((m, k) => (
                <button key={m} type="button" className="btn-secondary lendas-melhoria" onClick={() => void agir({ tipo: 'melhoria', escolha: k })} data-melhoria={k}>
                  {MELHORIAS[m]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <Turma herois={estado.herois} eu={eu} marcas />
    </div>
  );
}

/** A LOJA: três peças, uma de cada tipo; cada um leva uma, ou nada. */
function Loja({ estado, eu, agir, restante }: { estado: EstadoLendas; eu: number; agir: (corpo: Record<string, unknown>) => Promise<void>; restante: number | null }) {
  const t = useT();
  const loja = estado.minhaLoja;
  const levou = useRef(-1);
  useEffect(() => {
    if (!import.meta.env.DEV || !window.lendasPilotoAutomatico || !loja || loja.decidi || levou.current === estado.parada) return;
    levou.current = estado.parada;
    setTimeout(() => void agir({ tipo: 'loja', item: 0 }), 1000);
  }, [loja?.decidi, estado.parada]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="lendas-espolio">
      {restante !== null && <Relogio restante={restante} total={TEMPO_DA_LOJA} />}
      <p className="lendas-titulo">
        <span aria-hidden="true">🎒</span> {t('Leve uma peça.')}
      </p>
      {loja && !loja.decidi && (
        <div className="lendas-loja">
          {loja.itens.map((item, k) => (
            <button key={item.peca} type="button" className="lendas-carta" onClick={() => void agir({ tipo: 'loja', item: k })} data-item={k}>
              <span className="lendas-carta-emoji" aria-hidden="true">
                {PECAS[item.peca].emoji}
              </span>
              <span className="lendas-peca-troca">
                {PECAS[item.peca].atributo} +{loja.atual[item.peca]} → <strong className={item.valor > loja.atual[item.peca] ? 'melhor' : 'pior'}>+{item.valor}</strong>
              </span>
            </button>
          ))}
          <button type="button" className="btn-secondary" onClick={() => void agir({ tipo: 'loja', item: -1 })}>
            {t('Deixar')}
          </button>
        </div>
      )}
      <Turma herois={estado.herois} eu={eu} marcas />
    </div>
  );
}
