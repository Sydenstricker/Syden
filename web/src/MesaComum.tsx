import { CircleHelp, Flag, Handshake, Undo2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useT } from './i18n';
import { MARES_DA_NAVAL } from './naval3d/montagem';
import './MesaComum.css';

/**
 * A MESA COMUM (19/11/2026, a auditoria dos mini-games; o servidor em server/src/minijogo-tabuleiro.ts, o `duelo`): o que todos
 * os jogos da mesa de duas pessoas ganharam juntos — a escolha antes de começar (o nível do robô no Solo, o relógio de partida na
 * sala, as variantes de cada jogo), o "Como jogar", voltar o lance no Solo, a oferta de empate na sala, o relógio e o histórico
 * dos lances. Cada jogo põe `ControlesDaMesa` embaixo do tabuleiro e `HistoricoDaMesa` ao lado dele.
 */

/** Os jogos que passam pela escolha antes de começar. */
export const MESAS_COM_ESCOLHAS = new Set<string>(['gomoku', 'mancala', 'damas', 'naval', 'partida-de-xadrez', 'xadrez']);

const NIVEIS = ['facil', 'normal', 'dificil'] as const;
/** O xadrez tem cinco (20/11/2026: o motor próprio, server/src/xadrez-motor.ts). */
const NIVEIS_DO_XADREZ = ['iniciante', 'facil', 'normal', 'dificil', 'mestre'] as const;
type NivelDaMesa = (typeof NIVEIS_DO_XADREZ)[number];
const RELOGIOS = ['3+2', '5+3', '10+0', '15+10'] as const;

/** Os jogos de mesa (os problemas de xadrez não são: lá a escolha é o modo). */
const ehDuelo = (jogo: string) => jogo !== 'xadrez';

export function EscolhaDaMesa({
  jogo,
  solo,
  aoEscolher,
  aoVoltar,
}: {
  jogo: string;
  solo: boolean;
  aoEscolher: (corpo: Record<string, unknown>) => void;
  aoVoltar: () => void;
}) {
  const t = useT();
  const [nivel, setNivel] = useState<NivelDaMesa>('normal');
  const niveis: readonly NivelDaMesa[] = jogo === 'partida-de-xadrez' ? NIVEIS_DO_XADREZ : NIVEIS;
  const [relogio, setRelogio] = useState<string | null>(null);
  const [exato, setExato] = useState(false);
  const [troca, setTroca] = useState(false);
  const [sementes, setSementes] = useState(4);
  const [variante, setVariante] = useState<'kalah' | 'oware'>('kalah');
  const [salvo, setSalvo] = useState(false);
  // as variantes de 20/11/2026 (o lote C da segunda auditoria): a regra de fábrica continua a de sempre
  const [captura, setCaptura] = useState(false);
  const [tresTres, setTresTres] = useState(false);
  const [paraTras, setParaTras] = useState(true);
  const [mar, setMar] = useState(10);
  const nomeDoNivel: Record<NivelDaMesa, string> = {
    iniciante: t('Iniciante'),
    facil: t('Fácil'),
    normal: t('Normal'),
    dificil: t('Difícil'),
    mestre: t('Mestre'),
  };

  const comecar = (extra: Record<string, unknown> = {}) => {
    const corpo: Record<string, unknown> = { ...extra };
    if (ehDuelo(jogo)) {
      if (solo) corpo.nivel = nivel;
      else if (relogio) corpo.relogio = relogio;
    }
    if (jogo === 'gomoku') Object.assign(corpo, { exato, troca, captura, tresTres });
    if (jogo === 'mancala') Object.assign(corpo, { sementes, variante });
    if (jogo === 'naval') Object.assign(corpo, { salvo, mar });
    if (jogo === 'damas') corpo.paraTras = paraTras;
    aoEscolher(corpo);
  };

  return (
    <div className="tab-escolha mesa-escolha">
      {ehDuelo(jogo) && solo && (
        <fieldset className="mesa-grupo">
          <legend>{t('Nível do computador')}</legend>
          <div className="mesa-botoes">
            {niveis.map((n) => (
              <button
                key={n}
                type="button"
                className={`tab-rodadas-botao${nivel === n ? ' escolhida' : ''}`}
                aria-pressed={nivel === n}
                onClick={() => setNivel(n)}
              >
                {nomeDoNivel[n]}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {ehDuelo(jogo) && !solo && (
        <fieldset className="mesa-grupo">
          <legend>{t('Relógio de partida')}</legend>
          <div className="mesa-botoes">
            <button
              type="button"
              className={`tab-rodadas-botao${relogio === null ? ' escolhida' : ''}`}
              aria-pressed={relogio === null}
              onClick={() => setRelogio(null)}
            >
              {t('Sem relógio')}
            </button>
            {RELOGIOS.map((r) => (
              <button
                key={r}
                type="button"
                className={`tab-rodadas-botao${relogio === r ? ' escolhida' : ''}`}
                aria-pressed={relogio === r}
                onClick={() => setRelogio(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {jogo === 'gomoku' && (
        <fieldset className="mesa-grupo">
          <label className="mesa-opcao">
            <input type="checkbox" checked={exato} onChange={(e) => setExato(e.target.checked)} />
            {t('Exatamente 5 (seis seguidas não valem)')}
          </label>
          <label className="mesa-opcao">
            <input type="checkbox" checked={troca} onChange={(e) => setTroca(e.target.checked)} />
            {t('Troca na abertura (quem responde escolhe a cor)')}
          </label>
          <label className="mesa-opcao">
            <input type="checkbox" checked={captura} onChange={(e) => setCaptura(e.target.checked)} />
            {t('Captura: cercar duas pedras do outro tira as duas')}
          </label>
          <label className="mesa-opcao">
            <input type="checkbox" checked={tresTres} onChange={(e) => setTresTres(e.target.checked)} />
            {t('As escuras não fazem dois três abertos de uma vez')}
          </label>
        </fieldset>
      )}
      {jogo === 'damas' && (
        <fieldset className="mesa-grupo">
          <label className="mesa-opcao">
            <input type="checkbox" checked={!paraTras} onChange={(e) => setParaTras(!e.target.checked)} />
            {t('A pedra não come para trás')}
          </label>
        </fieldset>
      )}
      {jogo === 'mancala' && (
        <fieldset className="mesa-grupo">
          <legend>{t('Sementes por casa')}</legend>
          <div className="mesa-botoes">
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                className={`tab-rodadas-botao${sementes === n ? ' escolhida' : ''}`}
                aria-pressed={sementes === n}
                onClick={() => setSementes(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mesa-botoes">
            {(['kalah', 'oware'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`tab-rodadas-botao${variante === v ? ' escolhida' : ''}`}
                aria-pressed={variante === v}
                onClick={() => setVariante(v)}
              >
                {v === 'kalah' ? 'Kalah' : 'Oware'}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {jogo === 'naval' && (
        <fieldset className="mesa-grupo">
          <legend>{t('Tamanho do mar')}</legend>
          {/* os três mares (server/src/minijogo-naval.ts, MARES): o lado e a frota, só figura */}
          <div className="mesa-botoes">
            {MARES_DA_NAVAL.map((m) => (
              <button
                key={m.lado}
                type="button"
                className={`tab-rodadas-botao mesa-mar${mar === m.lado ? ' escolhida' : ''}`}
                aria-pressed={mar === m.lado}
                aria-label={`${m.lado} × ${m.lado}`}
                onClick={() => setMar(m.lado)}
              >
                <span>
                  {m.lado} × {m.lado}
                </span>
                <span className="mesa-mar-frota" aria-hidden="true">
                  {m.frota.map((tamanho, i) => (
                    <span key={i} style={{ width: `${tamanho * 5}px` }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
          <label className="mesa-opcao">
            <input type="checkbox" checked={salvo} onChange={(e) => setSalvo(e.target.checked)} />
            {t('Salvo: um tiro por navio que ainda boia')}
          </label>
        </fieldset>
      )}
      <ComoJogar jogo={jogo} />
      <div className="minijogo-acoes">
        {jogo === 'xadrez' && solo ? (
          <>
            <button type="button" className="btn-primary" onClick={() => comecar()}>
              {t('Cinco problemas')}
            </button>
            <button type="button" className="btn-primary" onClick={() => comecar({ modo: 'corrida' })}>
              {t('Corrida de 3 minutos')}
            </button>
            <button type="button" className="btn-primary" onClick={() => comecar({ modo: 'sequencia' })}>
              {t('Sequência')}
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={() => comecar()}>
            {t('Jogar')}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </div>
  );
}

/**
 * As regras curtas de cada jogo, num botão que abre e fecha. `figura` vai em cima das frases (20/11/2026: Truco, Dominó, Capitais
 * e Sudoku ganharam o "Como jogar", cada um com o desenho dele).
 */
export function ComoJogar({ jogo, figura }: { jogo: string; figura?: ReactNode }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const regras: Record<string, string[]> = {
    gomoku: [
      t('Cada um põe uma pedra por vez. Vence quem fizer cinco seguidas, na linha, na coluna ou na diagonal.'),
      t('Com "exatamente 5", seis ou mais seguidas não valem.'),
      t('Com a troca, quem abre põe três pedras e quem responde escolhe a cor.'),
      t('Com a captura, cercar duas pedras do outro entre duas suas tira as duas; cinco capturas também vencem.'),
      t('Com a restrição 3-3, as escuras não podem fazer dois três abertos de uma vez.'),
    ],
    mancala: [
      t('Escolha uma casa sua: as sementes andam uma por casa, no sentido anti-horário. Vence quem guardar mais.'),
      t('No Kalah, a última semente no seu depósito joga de novo; numa casa sua vazia, leva também as da frente.'),
      t('No Oware, a última semente na casa do outro que fica com 2 ou 3 leva essa casa e as anteriores com 2 ou 3. Deixe sempre sementes para o outro.'),
    ],
    damas: [
      t('As pedras andam uma casa na diagonal, para a frente. Comer é obrigatório, também para trás, e vale o lance que come mais.'),
      t('A pedra que termina o lance na última fileira vira dama, que anda a diagonal inteira.'),
      t('A mesma posição pela terceira vez empata, e 20 lances só de dama sem comer também.'),
      t('Na variante sem comer para trás, a pedra só come para a frente; a dama continua comendo para todo lado.'),
    ],
    naval: [
      t('Ponha os navios sem encostar um no outro, nem na diagonal.'),
      t('Atire no mar do outro: acertou, atira de novo. Vence quem afundar a frota inteira.'),
      t('No salvo, cada vez é uma rajada com um tiro por navio seu que ainda boia.'),
      t('O mar de 8 × 8 tem a frota menor, e o de 12 × 12, a maior.'),
    ],
    'partida-de-xadrez': [t('As regras do xadrez inteiras. Clique na peça e depois na casa: as casas que valem acendem.'), t('Quem abre fica com as brancas.')],
    xadrez: [
      t('Ache o melhor lance da posição. A resposta do outro lado vem sozinha.'),
      t('Na corrida, são 3 minutos de problemas, do mais fácil ao mais difícil: cada erro tira 10 segundos.'),
      t('Na sequência, cada acerto traz um problema mais difícil, e o primeiro erro acaba.'),
      t('A dica acende a peça que move. O problema com dica não pontua; na corrida, ela tira 10 segundos.'),
    ],
    truco: [
      t('Cada um recebe 3 cartas. Leva a mão quem ganhar 2 das 3 rodadas.'),
      t('A manilha é o valor seguinte ao da vira e ganha de todas. Entre elas: ouros, espadas, copas e paus, o zap.'),
      t('Peça truco e a mão vale 3. Quem responde aceita, corre ou aumenta para 6, 9 ou 12.'),
      t('Com 11 pontos, a dupla vê as cartas e decide se joga a mão de onze. Vence quem chegar a 12.'),
      t('No mineiro não há vira: as manilhas são o 4 de paus, o 7 de copas, o ás de espadas e o 7 de ouros.'),
      t('No mineiro, a mão vale 2, e o truco, o seis, o nove e o doze valem 4, 8, 10 e 12. Com 10 pontos, é a mão de dez: jogar valendo 4, ou correr e dar 2.'),
    ],
    domino: [
      t('Encoste uma pedra numa ponta da mesa com o mesmo número.'),
      t('Sem pedra que sirva, compre. Sem nada para comprar, a vez passa.'),
      t('Quem bate fica sem pedras e leva os pontos das mãos dos outros. Trancado, leva quem tem menos pontos na mão.'),
      t('Com as batidas especiais, bater com carroça ou com a pedra que serve nas duas pontas vale o dobro; a carroça nas duas pontas, o quádruplo.'),
    ],
    cidades: [
      t('Ande pelo dado e compre a capital onde parar. Quem para na cidade de outro paga aluguel.'),
      t('Com a região inteira, construa até 4 prédios: o aluguel sobe a cada um.'),
      t('A cidade que ninguém compra vai a leilão. Hipotecar uma cidade dá dinheiro, mas ela não cobra aluguel.'),
      t('Ganha o maior patrimônio no fim das rodadas, ou quem sobrar.'),
    ],
    sudoku: [
      t('Cada linha, coluna e bloco de 3 × 3 tem os números de 1 a 9, sem repetir.'),
      t('Escolha a casa e depois o número. O lápis anota só para você.'),
      t('O número pequeno no botão diz quantos ainda faltam.'),
    ],
  };
  if (!regras[jogo]) return null;
  return (
    <div className="mesa-como-jogar">
      <button type="button" className="link-button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <CircleHelp size={14} aria-hidden="true" /> {t('Como jogar')}
      </button>
      {aberto && figura && <div className="mesa-regras-figura">{figura}</div>}
      {aberto && (
        <ul className="mesa-regras">
          {regras[jogo].map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** O que a mesa comum manda no público (minijogo-tabuleiro.ts). */
export interface EstadoDaMesa {
  fase: string;
  jogadores: { userId: number; username: string }[];
  vez: 0 | 1;
  historico?: { lado: 0 | 1; texto: string }[];
  podeVoltar?: boolean;
  oferta?: 0 | 1 | null;
  relogio?: {
    nome: string;
    restam: [number, number];
    correndo: boolean;
  } | null;
  recebidaEm?: number;
}

/** "4:05": o tempo que resta. */
const minutos = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** O relógio de partida dos dois lados: o de quem tem a vez anda na tela (quem decide quando acaba é o servidor). */
function RelogioDaMesa({ estado }: { estado: EstadoDaMesa }) {
  const [, setTique] = useState(0);
  const r = estado.relogio;
  const correndo = r?.correndo === true;
  useEffect(() => {
    if (!correndo) return;
    const id = setInterval(() => setTique((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [correndo]);
  if (!r) return null;
  const passou = correndo && estado.recebidaEm ? Date.now() - estado.recebidaEm : 0;
  return (
    <div className="mesa-relogio" aria-label={r.nome}>
      {[0, 1].map((lado) => {
        const ms = r.restam[lado] - (correndo && estado.vez === lado ? passou : 0);
        return (
          <span key={lado} className={`mesa-relogio-lado${correndo && estado.vez === lado ? ' correndo' : ''}${ms < 20_000 ? ' pouco' : ''}`}>
            {estado.jogadores[lado]?.username ?? '…'} <strong>{minutos(ms)}</strong>
          </span>
        );
      })}
    </div>
  );
}

/** Os botões da mesa: voltar (Solo), o empate (sala), o relógio e o "Como jogar". */
export function ControlesDaMesa({
  jogo,
  estado,
  eu,
  agir,
}: {
  jogo: string;
  estado: EstadoDaMesa;
  eu: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const meuLado = estado.jogadores.findIndex((j) => j.userId === eu);
  const sentado = meuLado === 0 || meuLado === 1;
  const jogando = estado.fase === 'jogando';
  const contraORobo = estado.jogadores.some((j) => j.userId < 0);
  const ofereceram = estado.oferta !== null && estado.oferta !== undefined;
  const ofertaDoOutro = ofereceram && sentado && estado.oferta !== meuLado;
  return (
    <div className="mesa-controles">
      <RelogioDaMesa estado={estado} />
      {jogando && ofereceram && (
        <p className="mesa-oferta" role="status">
          {t('{nome} ofereceu empate.', {
            nome: estado.jogadores[estado.oferta!]?.username ?? '?',
          })}
        </p>
      )}
      <div className="mesa-botoes">
        {jogando && estado.podeVoltar && (
          <button type="button" className="btn-secondary" onClick={() => agir({ tipo: 'voltar' })}>
            <Undo2 size={14} aria-hidden="true" /> {t('Voltar o lance')}
          </button>
        )}
        {jogando && sentado && !contraORobo && !ofereceram && (
          <button type="button" className="btn-secondary" onClick={() => agir({ tipo: 'empate', acao: 'oferecer' })}>
            <Handshake size={14} aria-hidden="true" /> {t('Oferecer empate')}
          </button>
        )}
        {jogando && ofertaDoOutro && (
          <>
            <button type="button" className="btn-primary" onClick={() => agir({ tipo: 'empate', acao: 'aceitar' })}>
              <Flag size={14} aria-hidden="true" /> {t('Aceitar o empate')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => agir({ tipo: 'empate', acao: 'recusar' })}>
              <X size={14} aria-hidden="true" /> {t('Recusar')}
            </button>
          </>
        )}
      </div>
      <ComoJogar jogo={jogo} />
    </div>
  );
}

/** O histórico dos lances, em pares (o lance de cada lado na mesma linha), do mais novo embaixo. */
export function HistoricoDaMesa({ estado }: { estado: EstadoDaMesa }) {
  const t = useT();
  const lista = estado.historico ?? [];
  if (!lista.length) return null;
  return (
    <ol className="mesa-historico" aria-label={t('Lances')}>
      {lista.map((h, i) => (
        <li key={i} className={`lado-${h.lado}`}>
          <span className="mesa-historico-n">{i + 1}.</span> {h.texto}
        </li>
      ))}
    </ol>
  );
}

/** O tabuleiro com o histórico ao lado quando a mesa é larga, e embaixo quando é estreita (MesaComum.css, @container). */
export function ComHistorico({ estado, children }: { estado: EstadoDaMesa; children: ReactNode }) {
  return (
    <div className="mesa-com-historico">
      <div className="mesa-com-historico-linha">
        <div className="mesa-com-historico-tabuleiro">{children}</div>
        <HistoricoDaMesa estado={estado} />
      </div>
    </div>
  );
}
