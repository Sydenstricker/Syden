import { Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { folhaDe } from './briga/desenho';
import { carregarFolhas } from './briga/sprites';
import type { TipoDeInimigo } from './briga/fases';
import { chave, useT } from './i18n';
import { useJanelaComFoco } from './janelaComFoco';
import {
  desenharCena,
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
 * velocidade e manda os acontecimentos, que a tela toca um a um (lendas/desenho.ts). Entre as lutas, o mapa do caminho e o
 * espólio. O texto na tela é pouco de propósito: o que dá para dizer com figura (a classe, a peça, a energia) é figura.
 */

// Os mesmos números do servidor.
const TEMPO_DA_ESCOLHA = 20_000;
const TEMPO_DA_CLASSE = 30_000;
const TEMPO_DO_ESPOLIO = 15_000;
const CUSTO_DO_COMBO = 2;

type Acao = 'atacar' | 'habilidade' | 'defender' | 'combo';
type Peca = 'arma' | 'armadura' | 'amuleto';

interface Heroi extends HeroiNaTela {
  avatar: number | string | null;
  robo: boolean;
  presente: boolean;
  en: number;
  enMax: number;
  atk: number;
  mag: number;
  def: number;
  custo: number;
  equip: Record<Peca, number>;
  pontos: number;
  escolheu: boolean;
  peloRobo: boolean;
  noCombo: boolean;
  alvoDoCombo: number | null;
}

export interface EstadoLendas {
  partidaId: string;
  fase: 'classes' | 'mapa' | 'descanso' | 'escolha' | 'acao' | 'espolio' | 'fim';
  parada: number;
  rota: { id: string; tipo: 'luta' | 'descanso' | 'chefe' }[];
  rodada: number;
  resolucao: number;
  venceu: boolean;
  herois: Heroi[];
  inimigos: InimigoNaTela[];
  eventos: Evento[];
  minhaEscolha: { acao: Acao; alvo: number | null } | null;
  meuEspolio: { item: { peca: Peca; valor: number } | null; atual: Record<Peca, number>; decidi: boolean } | null;
  resultado: { userId: number; username: string; pontos: number; posicao: number | null }[] | null;
}

export const CLASSES: { id: Classe; emoji: string; nome: string; dica: string }[] = [
  { id: 'escudo', emoji: '🛡️', nome: chave('Escudo'), dica: chave('Aguenta mais e protege a turma.') },
  { id: 'faisca', emoji: '✨', nome: chave('Faísca'), dica: chave('Acerta todos os inimigos.') },
  { id: 'erva', emoji: '🌿', nome: chave('Erva'), dica: chave('Cura a turma e levanta quem caiu.') },
  { id: 'flecha', emoji: '🏹', nome: chave('Flecha'), dica: chave('Um tiro forte, que passa da defesa.') },
];
const classe = (id: Classe | null) => CLASSES.find((c) => c.id === id);

/** As bases do servidor, para a escolha de classe mostrar a diferença em barras (sem números nem palavras). */
const BARRAS: Record<Classe, [number, number, number, number]> = {
  // vida, ataque, magia, velocidade (de 0 a 5)
  escudo: [5, 3, 1, 1],
  faisca: [2, 1, 5, 2],
  erva: [3, 1, 4, 2],
  flecha: [3, 4, 1, 5],
};
const ICONES_DAS_BARRAS = ['❤️', '⚔️', '🔮', '💨'];

const PARADAS: Record<string, string> = { floresta: '🌲', deserto: '🌵', fogueira: '🔥', neve: '❄️', castelo: '🏰' };
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

  return (
    <div className="lendas">
      <Caminho estado={estado} />
      {estado.fase === 'classes' && <EscolhaDaClasse estado={estado} meu={meu} jogador={jogador} agir={agir} restante={solo ? null : restante} />}
      {(estado.fase === 'mapa' || estado.fase === 'descanso') && <Turma herois={estado.herois} eu={eu} descanso={estado.fase === 'descanso'} />}
      {(estado.fase === 'escolha' || estado.fase === 'acao') && (
        <Luta estado={estado} eu={eu} meu={jogador ? meu : null} agir={agir} restante={solo ? null : restante} />
      )}
      {estado.fase === 'espolio' && <Espolio estado={estado} eu={eu} agir={agir} restante={solo ? null : restante} />}
      {estado.fase === 'fim' && estado.resultado && (
        <div className="minijogo-fim">
          <p className="minijogo-fim-titulo">
            <Trophy size={20} aria-hidden="true" /> {estado.venceu ? t('Vitória!') : t('Derrota')}
          </p>
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

/** O mapa do caminho: as cinco paradas, a de agora marcada. Mora em cima da tela o tempo todo. */
function Caminho({ estado }: { estado: EstadoLendas }) {
  return (
    <ol className="lendas-caminho" aria-hidden="true">
      {estado.rota.map((p, k) => (
        <li key={p.id} className={k < estado.parada ? 'feita' : k === estado.parada && estado.fase !== 'classes' ? 'agora' : ''}>
          <span>{PARADAS[p.id] ?? '•'}</span>
          {k === estado.parada && estado.fase !== 'classes' && <span className="lendas-coelho">🐰</span>}
        </li>
      ))}
    </ol>
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

/** A turma em linhas: a classe, o nome, a vida e a energia (o painel de baixo dos RPGs de turno). */
function Turma({ herois, eu, descanso = false, marcas = false }: { herois: Heroi[]; eu: number; descanso?: boolean; marcas?: boolean }) {
  return (
    <ul className={`lendas-turma${descanso ? ' descanso' : ''}`}>
      {herois.map((h) => (
        <li key={h.userId} className={`${h.userId === eu ? 'eu' : ''}${h.hp <= 0 ? ' caido' : ''}`}>
          <span className="lendas-turma-classe" aria-hidden="true">
            {classe(h.classe)?.emoji ?? '…'}
          </span>
          <span className="minijogo-nome">{h.username}</span>
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
  /** A ação que pede alvo, enquanto espero o clique no inimigo. */
  const [mirando, setMirando] = useState<Acao | null>(null);
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
      desenharCena(
        g,
        {
          parada: e.rota[e.parada]?.id === 'castelo' ? 'castelo' : (e.rota[e.parada]?.id ?? 'floresta'),
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
        const k = Math.floor((agora - d - 250) / 850) + 1;
        while (tocadosSom.current < Math.min(k, e.eventos.length)) {
          const ev = e.eventos[tocadosSom.current++];
          if (ev.tipo === 'combo') tocar('combo');
          else if (ev.tipo === 'habilidade' && ev.alvos.some((a) => a.cura)) tocar('moeda');
          else if (ev.alvos.some((a) => a.ko)) tocar('queda');
          else if (ev.tipo === 'ataque' || ev.tipo === 'inimigo' || ev.tipo === 'sopro' || ev.tipo === 'habilidade') tocar('soco');
        }
      }
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
  }, [comFoco, eu]);

  const escolher = (acao: Acao, alvo: number | null = null) => {
    setMirando(null);
    void agir({ tipo: 'acao', acao, alvo });
  };
  const pedeAlvo = (acao: Acao) => acao === 'atacar' || acao === 'combo' || (acao === 'habilidade' && meu?.classe === 'flecha');
  const clicar = (acao: Acao) => {
    const vivos = estado.inimigos.filter((i) => i.hp > 0);
    if (!pedeAlvo(acao)) return escolher(acao);
    // com um inimigo só, nem pergunta
    if (vivos.length === 1) return escolher(acao, vivos[0].id);
    // o combo de quem já chamou: vai no mesmo alvo
    const chamado = acao === 'combo' ? estado.herois.find((h) => h.noCombo && h.userId !== eu && h.alvoDoCombo !== null) : undefined;
    if (chamado) return escolher(acao, chamado.alvoDoCombo);
    setMirando(acao);
  };
  const noCanvas = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mirando) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const alvo = inimigoEm(((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * H, estado.inimigos);
    if (alvo !== null) escolher(mirando, alvo);
  };

  // O PILOTO DO E2E (só no site de desenvolvimento): a habilidade quando dá, senão ataca o primeiro vivo
  useEffect(() => {
    if (!import.meta.env.DEV || !window.lendasPilotoAutomatico || !posso || estado.minhaEscolha) return;
    const vivo = estado.inimigos.find((i) => i.hp > 0);
    if (!vivo || !meu) return;
    const pausa = setTimeout(() => escolher(meu.en >= meu.custo ? 'habilidade' : 'atacar', meu.classe === 'flecha' || meu.en < meu.custo ? vivo.id : null), 400);
    return () => clearTimeout(pausa);
    // (as dependências são a rodada, e não cada desenho: o painel redesenha a cada 250 ms, e a pausa nunca chegava ao fim)
  }, [posso, estado.rodada, estado.parada, !!estado.minhaEscolha]); // eslint-disable-line react-hooks/exhaustive-deps

  // a vida na lista acompanha o desenho: durante a rodada, ela desce golpe a golpe (a do servidor já é a de depois)
  const tocados = desde === null ? estado.eventos.length : tocadosAte({ eventos: estado.eventos, desde }, performance.now());
  const naLista = desde === null ? estado.herois : estado.herois.map((h) => ({ ...h, hp: vidaNaTela({ h: h.userId }, h.hp, h.hpMax, estado.eventos, tocados) }));
  const minha = estado.minhaEscolha;
  const custo = meu?.custo ?? 0;
  return (
    <div className="lendas-luta">
      {restante !== null && estado.fase === 'escolha' && <Relogio restante={restante} total={TEMPO_DA_ESCOLHA} />}
      <div className={`lendas-tela${mirando ? ' mirando' : ''}`}>
        <canvas ref={canvas} width={W} height={H} onClick={noCanvas} />
      </div>
      {/* os alvos também em botões: para o teclado, o leitor de tela, e o dedo no celular */}
      {mirando && (
        <div className="lendas-alvos">
          {estado.inimigos
            .filter((i) => i.hp > 0)
            .map((i) => (
              <button key={i.id} type="button" className="btn-secondary" data-alvo={i.id} onClick={() => escolher(mirando, i.id)}>
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
          <button
            type="button"
            className={minha?.acao === 'habilidade' ? 'escolhida' : ''}
            disabled={!posso || meu.en < custo}
            onClick={() => clicar('habilidade')}
            title={t(classe(meu.classe)?.dica ?? '')}
            data-acao="habilidade"
          >
            <span aria-hidden="true">{classe(meu.classe)?.emoji}</span> {t('Habilidade')} <small>⚡{custo}</small>
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
        </div>
      )}
      <Turma herois={naLista} eu={eu} marcas={estado.fase === 'escolha'} />
    </div>
  );
}

function Espolio({ estado, eu, agir, restante }: { estado: EstadoLendas; eu: number; agir: (corpo: Record<string, unknown>) => Promise<void>; restante: number | null }) {
  const t = useT();
  const meu = estado.meuEspolio;
  const item = meu?.item;
  // o piloto do e2e veste sempre (uma vez por parada: o efeito roda duas vezes no modo estrito do desenvolvimento)
  const vestiu = useRef(-1);
  useEffect(() => {
    if (!import.meta.env.DEV || !window.lendasPilotoAutomatico || !meu || meu.decidi || vestiu.current === estado.parada) return;
    vestiu.current = estado.parada;
    // (com uma pausa: a peça fica um instante na tela, para a foto do teste)
    setTimeout(() => void agir({ tipo: 'espolio', equipar: true }), 1500);
  }, [meu?.decidi, estado.parada]); // eslint-disable-line react-hooks/exhaustive-deps
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
      <Turma herois={estado.herois} eu={eu} marcas />
    </div>
  );
}
