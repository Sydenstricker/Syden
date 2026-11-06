import { Gamepad2, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { aoMudarSomDosJogos, silenciarJogos, somDosJogosMudo, tocar } from './somDosJogos';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { CapaDoJogo, CapaPalavraDoDia } from './CapasDosJogos';
import { IconButton } from './IconButton';
import { idiomaAtual, useT } from './i18n';
import { EscolhaDaBriga, JogoBriga } from './JogoBriga';
import { EscolhaDosBlocos, JogoBlocos } from './JogoBlocos';
import { JogoDesenho } from './JogoDesenho';
import { JogoDuelo } from './JogoDuelo';
import { JogoDamas } from './JogoDamas';
import { JogoPartidaDeXadrez } from './JogoPartidaDeXadrez';
import { JogoDomino } from './JogoDomino';
import { JogoNaval } from './JogoNaval';
import { JogoTruco } from './JogoTruco';
import { JogoFesta } from './JogoFesta';
import { JogoGolfe } from './JogoGolfe';
import { canalDoSocket, ligarCanalDaFesta } from './festa/comum';
import { FicharioDeGeneros, naFicha, useFicha, classeDaFicha, fichaQueVale } from './FicharioDeGeneros';
import { JogoGolfe3D, type EstadoGolfe3D } from './JogoGolfe3D';
import { JogoFutebol, type EstadoFutebol } from './JogoFutebol';
import { JogoTocas, type EstadoTocas } from './JogoTocas';
import { JogoCaca } from './JogoCaca';
import { JogoNave, type EstadoNave } from './JogoNave';
import { EscolhaDaArena, JogoBalao, type EstadoBalao } from './JogoBalao';
import { EscolhaDaPistaDoJato, JogoJato, type EstadoJato } from './JogoJato';
import { EscolhaDaPistaDoBarco, JogoBarco, type EstadoBarco } from './JogoBarco';
import { JogoChefe } from './JogoChefe';
import { JogoAvioes, type EstadoDosAvioes } from './JogoAvioes';
import { EscolhaDaTorre, JogoTorre, type EstadoTorre } from './JogoTorre';
import type { EstadoChefe } from './chefe/regras';
import { JogoCozinha, type EstadoCozinha } from './JogoCozinha';
import { JogoSkate, type EstadoSkate } from './JogoSkate';
import { JogoCarrinhos, type EstadoCarrinhos } from './JogoCarrinhos';
import { EscolhaDoPercurso, JogoGincana, type EstadoGincana } from './JogoGincana';
import { JogoTransito, type EstadoTransito } from './JogoTransito';
import { EscolhaDaPonte, JogoPonte, type EstadoPonte } from './JogoPonte';
import { JogoLobisomem } from './JogoLobisomem';
import { JogoPalavra } from './JogoPalavra';
import { EscolhaDaFase, JogoPlataforma, JogoPlataformaNaSala, type EstadoPlataforma } from './JogoPlataforma';
import { EscolhaDoQuiz, JogoQuiz } from './JogoQuiz';
import { CATEGORIAS_DO_QUIZ, ehQuiz, type EstadoQuiz } from './quiz';
import { EscolhaDaPista, JogoCorrida, JogoCorridaNaSala, type EstadoCorrida } from './JogoCorrida';
import { JogoStop } from './JogoStop';
import { JogoSudoku } from './JogoSudoku';
import { EscolhaDasRodadas, JogoTabuleiro } from './JogoTabuleiro';
import { EscolhaDasCidades, JogoCidades } from './JogoCidades';
import { cadaUmPorSi, EM_DUPLAS, EscolhaDosRobos, type OpcaoDeRobos } from './EscolhaDosRobos';
import { IconeDeHud } from './iconesDeHud';
import { EscolhaDeCategoria, JogoTamanho } from './JogoTamanho';
import { JogoXadrez } from './JogoXadrez';
import {
  JOGOS,
  JOGOS_DE_MESA,
  nomeDoIdioma,
  nomeDoJogo,
  souJogador,
  SITES_PARA_TRANSMITIR,
  type EstadoBriga,
  type EstadoBlocos,
  type EstadoDesenho,
  type EstadoDuelo,
  type EstadoFesta,
  type EstadoGolfe,
  type EstadoCaca,
  type EstadoLobisomem,
  type EstadoPalavra,
  type EstadoStop,
  type EstadoSudoku,
  type EstadoTabuleiro,
  type EstadoCidades,
  type EstadoTamanho,
  type EstadoXadrez,
  type GrupoDoJogo,
  type IdDoJogo,
  type Partida,
  type PartidaPublica,
} from './minijogos';

/**
 * O botão de videogame da sala de voz e o painel do jogo (12/10/2026). O botão fica na barra, ao lado do
 * compartilhar tela e do soundboard: sem partida, ele abre a estante de jogos; com partida, mostra ou
 * esconde o painel. Desde 13/10/2026 começar é CONVIDAR: o painel abre para quem começou e para quem aceita; os
 * outros recebem um convite pequeno (ConviteDoMinijogo), e quem não joga pode abrir e assistir. Antes ele abria
 * sozinho para a sala inteira, e quem estava transmitindo outro jogo virava jogador sem querer.
 */
export function BotaoMinijogo({
  partida,
  aberto,
  aoAlternar,
}: {
  partida: PartidaPublica | null;
  aberto: boolean;
  aoAlternar: () => void;
}) {
  const t = useT();
  return (
    <IconButton label={t('Mini-games')} active={aberto || partida !== null} onClick={aoAlternar}>
      <Gamepad2 />
    </IconButton>
  );
}

const MEDALHAS = ['🥇', '🥈', '🥉'];

/**
 * Os jogos da turma que, no Solo, só pedem quantos adversários do computador (pedido dele, 05/11/2026; os robôs em
 * server/src/minijogo-robos.ts). Os de mesa (Cinco em linha, Mancala, Damas, Batalha naval) começam direto contra um robô; o
 * Cidades à venda e o Tabuleiro da turma perguntam junto com as rodadas.
 */
/** Os jogos de vez, em que cada jogada é um clique na tela (o som dela toca aqui). */
const JOGOS_DE_VEZ = new Set<string>(['gomoku', 'mancala', 'damas', 'naval', 'partida-de-xadrez', 'cidades', 'tabuleiro', 'xadrez', 'lobisomem']);

const ROBOS_NO_SOLO: Partial<Record<IdDoJogo, OpcaoDeRobos[]>> = {
  domino: [cadaUmPorSi(1), cadaUmPorSi(2), EM_DUPLAS],
  truco: [cadaUmPorSi(1), EM_DUPLAS],
};

/** Um pedido ao servidor; o erro dele aparece no painel. */
interface Acao {
  (): Promise<void>;
}
interface Comecar {
  /** `solo`: a partida é só minha (a aba Solo); senão, a sala é convidada. */
  (jogo: IdDoJogo, escolhas?: Record<string, unknown>, solo?: boolean): Promise<void>;
}
/** A resposta ao convite (ver o convite em minijogos-routes.ts, no servidor). */
interface Responder {
  (resposta: 'jogar' | 'sair' | 'agora-nao'): Promise<void>;
}
export interface Agir {
  (corpo: Record<string, unknown>): Promise<void>;
}

export function PainelDoMinijogo({
  partida: partidaDaSala,
  eu,
  podeEncerrar,
  aoComecar,
  aoAgir,
  aoEncerrar,
  aoResponder,
  aoLargar,
  aoFechar,
  socket,
  channelId,
  aoAbrirSite,
  soSolo = false,
  comecarCom = null,
}: {
  partida: Partida | null;
  eu: number;
  podeEncerrar: boolean;
  aoComecar: Comecar;
  aoAgir: Agir;
  aoEncerrar: Acao;
  aoResponder: Responder;
  aoLargar: Acao;
  aoFechar: () => void;
  /** O desenho manda e recebe o traço por aqui, na hora. */
  socket: Socket | null;
  channelId: number;
  /** Abre um jogo de parceiro (o Termo) no palco da sala: só para quem clicou. */
  aoAbrirSite: (site: { nome: string; endereco: string }) => void;
  /** Fora da sala (o computador do quarto): só a aba Solo, sem as abas. */
  soSolo?: boolean;
  /** Abre já começando este jogo (no Solo), ou a escolha de categoria se for o "Qual é o tamanho?". */
  comecarCom?: IdDoJogo | null;
}) {
  const t = useT();
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(Date.now());
  /** O jogo que pede a categoria antes de começar ("Qual é o tamanho?", a mitologia), enquanto ela é escolhida. */
  const [escolhendo, setEscolhendo] = useState<IdDoJogo | null>(null);
  const escolhendoCategoria = escolhendo !== null;
  /** A Corrida dos coelhos aberta: ela não é partida do servidor (roda aqui), então mora fora da `partida`. */
  const [correndo, setCorrendo] = useState(false);
  // Correndo sozinho, o jogo da sala fica fora da tela (revisão de 03/11/2026: um convite de outra pessoa derrubava a corrida
  // no meio). O convite continua chegando pelo aviso pequeno da sala; ao sair da corrida, o jogo da sala aparece.
  /** O Pulo do coelho aberto no Solo: como a corrida, roda aqui, fora da `partida`. */
  const [pulando, setPulando] = useState(false);
  const sozinho = correndo || pulando;
  const partida = sozinho ? null : partidaDaSala;
  // O CANAL AO VIVO DA FESTA (os microjogos de empurrar e de equipe, desde 05/11/2026): o socket da sala, ou o do Solo.
  const festaSolo = partida?.solo === true;
  useEffect(() => {
    ligarCanalDaFesta(socket ? canalDoSocket(socket, festaSolo ? null : channelId) : null);
    return () => ligarCanalDaFesta(null);
  }, [socket, channelId, festaSolo]);
  const setEscolhendoCategoria = (sim: boolean) => setEscolhendo(sim ? 'tamanho' : null);
  /** Os jogos que pedem categoria: clicar na capa abre a escolha, e não a partida. */
  // (a Horta em cascata pede o modo só no Solo: sem fim ou 2 minutos; na sala é sempre o versus)
  const pedeCategoria = (jogo: IdDoJogo, solo = true) =>
    jogo === 'tamanho' || (jogo === 'blocos' && solo) || (ehQuiz(jogo) && CATEGORIAS_DO_QUIZ[jogo] !== undefined);
  /** A aba da estante: a última escolhida volta na próxima vez (só neste navegador). */
  const [ficha, setFicha] = useFicha();
  const [abaEscolhida, setAba] = useState<GrupoDoJogo>(() => {
    try {
      return localStorage.getItem('syden:aba-dos-minijogos') === 'solo' ? 'solo' : 'coletivo';
    } catch {
      return 'coletivo';
    }
  });
  const aba: GrupoDoJogo = soSolo ? 'solo' : abaEscolhida;
  const escolherAba = (grupo: GrupoDoJogo) => {
    setAba(grupo);
    try {
      localStorage.setItem('syden:aba-dos-minijogos', grupo);
    } catch {
      /* sem guardar: volta no Coletivo */
    }
  };

  // Veio do computador do quarto com um jogo escolhido: começa (no Solo) assim que o painel abre, uma vez só.
  const comecou = useRef(false);
  useEffect(() => {
    if (!comecarCom || partida || comecou.current) return;
    comecou.current = true;
    if (comecarCom === 'corrida') setCorrendo(true);
    else if (comecarCom === 'plataforma') setPulando(true);
    else if (pedeCategoria(comecarCom) || comecarCom === 'briga' || comecarCom === 'ponte' || comecarCom === 'cidades' || comecarCom === 'tabuleiro' || ROBOS_NO_SOLO[comecarCom]) setEscolhendo(comecarCom);
    else void tentar(() => aoComecar(comecarCom, {}, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comecarCom]);

  // O relógio anda na tela; quem manda no fim de cada fase é o servidor.
  const andando = partida !== null && !partida.terminada;
  useEffect(() => {
    if (!andando) return;
    const relogio = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(relogio);
  }, [andando]);

  const tentar = (acao: Acao) => {
    setErro(null);
    return acao().catch((e) => setErro((e as Error).message));
  };
  // nos jogos de vez (de mesa, de cartas, de tabuleiro), cada jogada tem o seu som; nos de tempo real, quem toca é o jogo
  const agir = (corpo: Record<string, unknown>) => {
    const jogo = partida?.jogo;
    if (jogo === 'truco' || jogo === 'domino') tocar('carta');
    else if (jogo && JOGOS_DE_VEZ.has(jogo)) tocar('clique');
    return tentar(() => aoAgir(corpo));
  };
  // O SOM DOS JOGOS (somDosJogos.ts): o botão de silenciar do cabeçalho, e os sons que todo jogo tem em comum — a vez que
  // chega a mim, os dados que rolam, e o fim da partida. Os de cada jogo (o pulo, a tacada, o tiro) tocam no próprio jogo.
  const [mudo, setMudo] = useState(somDosJogosMudo);
  useEffect(() => aoMudarSomDosJogos(setMudo), []);
  const p = partida as (Partida & { vez?: number | null; ultimo?: { id?: number; dados?: unknown } | null }) | null;
  const minhaVez = !!p && !p.terminada && p.vez === eu;
  const lances = p?.ultimo?.dados ? p.ultimo.id : undefined;
  const terminou = !!p?.terminada;
  const antes = useRef({ minhaVez, lances, terminou, id: p?.partidaId });
  useEffect(() => {
    const a = antes.current;
    if (a.id === p?.partidaId) {
      if (terminou && !a.terminou) tocar('fim');
      else if (lances !== undefined && lances !== a.lances) tocar('dado');
      else if (minhaVez && !a.minhaVez) tocar('vez');
    }
    antes.current = { minhaVez, lances, terminou, id: p?.partidaId };
  }, [minhaVez, lances, terminou, p?.partidaId]);
  const restante = partida ? Math.max(0, partida.restanteMs - (agora - partida.recebidaEm)) : 0;
  const naEspera = Boolean(partida?.convite);
  const rodada =
    partida && !naEspera && (partida.jogo === 'tamanho' || partida.jogo === 'stop' || partida.jogo === 'xadrez' || partida.jogo === 'palavra' || partida.jogo === 'festa' || partida.jogo === 'tabuleiro' || partida.jogo === 'golfe' || partida.jogo === 'golfe3d' || partida.jogo === 'caca' || ehQuiz(partida.jogo)) && !partida.terminada
      ? (partida as unknown as EstadoTamanho)
      : null;
  // Quem não aceitou o convite vê a partida, mas não mexe nela (a mesa cuida de quem senta).
  const soAssiste = partida !== null && !naEspera && !souJogador(partida) && !JOGOS_DE_MESA.includes(partida.jogo);
  const jogoNaTela = partida && !naEspera ? partida : null;

  return (
    <div
      className={`minijogo${partida ? ` jogando-${partida.jogo}` : correndo ? ' jogando-corrida' : pulando ? ' jogando-plataforma' : ' na-estante'}`}
      role="dialog"
      aria-label={partida ? t(nomeDoJogo(partida.jogo)) : correndo ? t(nomeDoJogo('corrida')) : pulando ? t(nomeDoJogo('plataforma')) : t('Mini-games')}
    >
      <div className="minijogo-topo">
        <strong>
          <Gamepad2 size={16} aria-hidden="true" /> {partida ? t(nomeDoJogo(partida.jogo)) : correndo ? t(nomeDoJogo('corrida')) : pulando ? t(nomeDoJogo('plataforma')) : t('Mini-games')}
        </strong>
        {/* As abas da estante (pedido dele, 14/10/2026): o que se joga sozinho e o que é da turma. */}
        {!partida && !escolhendoCategoria && !sozinho && !soSolo && (
          <div className="minijogo-abas" role="tablist" aria-label={t('Mini-games')}>
            {(['solo', 'coletivo'] as const).map((grupo) => (
              <button key={grupo} type="button" role="tab" aria-selected={aba === grupo} className={aba === grupo ? 'ativa' : ''} onClick={() => escolherAba(grupo)}>
                <IconeDeHud nome={grupo === 'solo' ? 'singleplayer' : 'multiplayer'} />
                {grupo === 'solo' ? t('Solo') : t('Coletivo')}
              </button>
            ))}
          </div>
        )}
        {rodada && <span className="minijogo-rodada">{t('Rodada {n} de {total}', { n: rodada.rodada, total: rodada.rodadas })}</span>}
        <button type="button" className="icon-plain" aria-label={t('Silenciar')} aria-pressed={mudo} title={t('Silenciar')} onClick={() => silenciarJogos(!mudo)}>
          {mudo ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button type="button" className="icon-plain" aria-label={t('Fechar')} onClick={aoFechar}>
          <X size={16} />
        </button>
      </div>

      {/* A ESTANTE DE JOGOS (pedido do Sydenstricker: a tela mais limpa). Uma capa por jogo, e clicar já
          começa para a sala inteira. A explicação mora na dica do mouse: a capa diz o que é. */}
      {!partida && escolhendo !== null && ehQuiz(escolhendo) && (
        <EscolhaDoQuiz
          categorias={CATEGORIAS_DO_QUIZ[escolhendo] ?? []}
          aoEscolher={(categoria) => tentar(() => aoComecar(escolhendo, { categoria }, aba === 'solo').then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && escolhendo === 'corrida' && (
        <EscolhaDaPista
          aoEscolher={(pista) => tentar(() => aoComecar('corrida', { pista }, false).then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && escolhendo === 'torre' && (
        <EscolhaDaTorre
          aoEscolher={(pista) => tentar(() => aoComecar('torre', { pista }, false).then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && escolhendo === 'barco' && (
        <EscolhaDaPistaDoBarco
          aoEscolher={(pista) => tentar(() => aoComecar('barco', { pista }, false).then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && escolhendo === 'jato' && (
        <EscolhaDaPistaDoJato
          aoEscolher={(pista) => tentar(() => aoComecar('jato', { pista }, false).then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {/* A Gincana da toca na sala: o percurso da turma (no Solo, a escolha fica dentro do jogo, com os recordes de cada um). */}
      {!partida && escolhendo === 'gincana' && (
        <EscolhaDoPercurso
          aoEscolher={(percurso) => tentar(() => aoComecar('gincana', { percurso }, false).then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && escolhendo === 'balao' && (
        <EscolhaDaArena
          aoEscolher={(arena) => tentar(() => aoComecar('balao', { arena }, false).then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && escolhendo === 'tabuleiro' && (
        <EscolhaDasRodadas
          solo={aba === 'solo'}
          aoEscolher={(rodadas, robos) =>
            tentar(() => aoComecar('tabuleiro', aba === 'solo' ? { rodadas, robos } : { rodadas }, aba === 'solo').then(() => setEscolhendo(null)))
          }
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {/* O Dominó e o Truco no Solo: só quantos robôs (pedido dele, 05/11/2026). */}
      {!partida && escolhendo !== null && ROBOS_NO_SOLO[escolhendo] && (
        <EscolhaDosRobos
          opcoes={ROBOS_NO_SOLO[escolhendo]!}
          aoEscolher={(robos) => tentar(() => aoComecar(escolhendo, { robos }, true).then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && escolhendo === 'cidades' && (
        <EscolhaDasCidades
          solo={aba === 'solo'}
          aoEscolher={(corpo) => tentar(() => aoComecar('cidades', corpo, aba === 'solo').then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && escolhendo === 'tamanho' && (
        <EscolhaDeCategoria
          aoEscolher={(categoria) => tentar(() => aoComecar('tamanho', { categoria }, aba === 'solo').then(() => setEscolhendoCategoria(false)))}
          aoVoltar={() => setEscolhendoCategoria(false)}
        />
      )}
      {!partida && escolhendo === 'blocos' && (
        <EscolhaDosBlocos
          aoEscolher={(modo) => tentar(() => aoComecar('blocos', { modo }, true).then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && escolhendo === 'briga' && (
        <EscolhaDaBriga
          aoEscolher={(fase) => tentar(() => aoComecar('briga', { fase }, aba === 'solo').then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {/* A Ponte da toca: a fase (no Solo, cada uma tem o seu recorde; na sala, a mesma para a turma). */}
      {!partida && escolhendo === 'ponte' && (
        <EscolhaDaPonte
          aoEscolher={(fase) => tentar(() => aoComecar('ponte', { fase }, aba === 'solo').then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && escolhendo === 'plataforma' && (
        <EscolhaDaFase
          aoEscolher={(fase) => tentar(() => aoComecar('plataforma', { pista: fase }, false).then(() => setEscolhendo(null)))}
          aoVoltar={() => setEscolhendo(null)}
        />
      )}
      {!partida && correndo && <JogoCorrida eu={eu} aoVoltar={() => setCorrendo(false)} />}
      {!partida && pulando && <JogoPlataforma eu={eu} aoVoltar={() => setPulando(false)} />}
      {!partida && !escolhendoCategoria && !sozinho && (
        <FicharioDeGeneros jogos={JOGOS.filter((jogo) => jogo.abas.includes(aba)).map((j) => j.id)} ficha={ficha} aoEscolher={setFicha} />
      )}
      {!partida && !escolhendoCategoria && !sozinho && (
        <ul className={`minijogo-estante no-fichario ${classeDaFicha(fichaQueVale(JOGOS.filter((jogo) => jogo.abas.includes(aba)).map((j) => j.id), ficha))}`}>
          {naFicha(JOGOS.filter((jogo) => jogo.abas.includes(aba)), ficha).map((jogo) => (
            <li key={jogo.id}>
              <button
                type="button"
                className="minijogo-jogo"
                title={t(jogo.dica)}
                onClick={() =>
                  jogo.id === 'corrida'
                    ? aba === 'solo'
                      ? setCorrendo(true)
                      : setEscolhendo('corrida')
                    : jogo.id === 'plataforma'
                      ? aba === 'solo'
                        ? setPulando(true)
                        : setEscolhendo('plataforma')
                    : (jogo.id === 'balao' || jogo.id === 'jato' || jogo.id === 'barco' || jogo.id === 'torre' || jogo.id === 'gincana') && aba === 'coletivo'
                      ? setEscolhendo(jogo.id)
                    : jogo.id === 'briga' || jogo.id === 'ponte' || jogo.id === 'tabuleiro' || jogo.id === 'cidades' || (aba === 'solo' && ROBOS_NO_SOLO[jogo.id]) || pedeCategoria(jogo.id, aba === 'solo')
                      ? setEscolhendo(jogo.id)
                      : tentar(() => aoComecar(jogo.id, {}, aba === 'solo'))
                }
              >
                <CapaDoJogo jogo={jogo.id} />
                <span>
                  {t(jogo.nome)}
                  {/* O jogo de uma língua só aparece para todo mundo, com o nome da língua (a regra dos sites). */}
                  {jogo.idioma && !idiomaAtual().startsWith(jogo.idioma) && (
                    <small className="minijogo-idioma"> · {nomeDoIdioma(jogo.idioma, idiomaAtual())}</small>
                  )}
                </span>
              </button>
            </li>
          ))}
          {/* Os jogos de parceiro que rodam dentro do Syden (o Termo): no fim da estante, e abrem SÓ para quem
              clicou — a partida da sala continua livre para os outros. */}
          {aba === 'solo' && SITES_PARA_TRANSMITIR.filter((site) => site.embutir).map((site) => (
            <li key={site.endereco}>
              <button type="button" className="minijogo-jogo minijogo-parceiro" title={t(site.dica)} onClick={() => aoAbrirSite(site)}>
                <CapaPalavraDoDia />
                <span>{site.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {partida?.convite && (
        <SalaDeEspera
          partida={partida}
          eu={eu}
          aoResponder={(resposta) => tentar(() => aoResponder(resposta))}
          aoLargar={() => tentar(aoLargar)}
          aoCancelar={() => tentar(aoEncerrar)}
        />
      )}
      {soAssiste && !partida.terminada && <p className="minijogo-assistindo-aviso">{t('Você está assistindo. Dá para entrar na próxima partida.')}</p>}

      <div className={`minijogo-corpo${soAssiste ? ' so-assistindo' : ''}`} inert={soAssiste || undefined}>
      {jogoNaTela?.jogo === 'tamanho' && <JogoTamanho estado={jogoNaTela as unknown as EstadoTamanho & Partida} eu={eu} restante={restante} agir={agir} />}
      {jogoNaTela?.jogo === 'stop' && <JogoStop estado={jogoNaTela as unknown as EstadoStop & Partida} eu={eu} restante={restante} agir={agir} aoAgir={aoAgir} />}
      {jogoNaTela?.jogo === 'sudoku' && <JogoSudoku estado={jogoNaTela as unknown as EstadoSudoku & Partida} eu={eu} restante={restante} agir={agir} />}
      {jogoNaTela?.jogo === 'desenho' && (
        <JogoDesenho estado={jogoNaTela as unknown as EstadoDesenho & Partida} eu={eu} restante={restante} agir={agir} socket={socket} channelId={channelId} />
      )}
      {jogoNaTela?.jogo === 'xadrez' && <JogoXadrez estado={jogoNaTela as unknown as EstadoXadrez & Partida} eu={eu} restante={restante} agir={agir} />}
      {jogoNaTela?.jogo === 'palavra' && <JogoPalavra estado={jogoNaTela as unknown as EstadoPalavra & Partida} eu={eu} jogador={souJogador(partida)} restante={restante} agir={agir} />}
      {jogoNaTela && ehQuiz(jogoNaTela.jogo) && (
        <JogoQuiz tema={jogoNaTela.jogo} estado={jogoNaTela as unknown as EstadoQuiz & Partida} eu={eu} jogador={souJogador(partida)} restante={restante} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'corrida' && (
        <JogoCorridaNaSala
          estado={jogoNaTela as unknown as EstadoCorrida & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          restante={restante}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'festa' && (
        <JogoFesta
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoFesta & Partida} eu={eu} jogador={souJogador(partida)} restante={restante} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'torre' && (
        <JogoTorre
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoTorre & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          restante={restante}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'duelo' && (
        <JogoAvioes
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoDosAvioes & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'chefe' && (
        <JogoChefe
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoChefe & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'barco' && (
        <JogoBarco
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoBarco & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          restante={restante}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'jato' && (
        <JogoJato
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoJato & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          restante={restante}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'balao' && (
        <JogoBalao
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoBalao & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'nave' && (
        <JogoNave
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoNave & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'briga' && (
        <JogoBriga
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoBriga & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'blocos' && (
        <JogoBlocos
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoBlocos & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          aoAgir={aoAgir}
        />
      )}
      {jogoNaTela?.jogo === 'plataforma' && (
        <JogoPlataformaNaSala
          estado={jogoNaTela as unknown as EstadoPlataforma & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          restante={restante}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'skate' && (
        <JogoSkate key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')} estado={jogoNaTela as unknown as EstadoSkate & Partida} eu={eu} jogador={souJogador(partida)} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'ponte' && (
        <JogoPonte key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')} estado={jogoNaTela as unknown as EstadoPonte & Partida} eu={eu} jogador={souJogador(partida)} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'transito' && (
        <JogoTransito key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')} estado={jogoNaTela as unknown as EstadoTransito & Partida} eu={eu} jogador={souJogador(partida)} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'gincana' && (
        <JogoGincana
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoGincana & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          restante={restante}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'carrinhos' && (
        <JogoCarrinhos
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoCarrinhos & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          restante={restante}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'cozinha' && (
        <JogoCozinha key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')} estado={jogoNaTela as unknown as EstadoCozinha & Partida} eu={eu} jogador={souJogador(partida)} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'caca' && (
        <JogoCaca
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoCaca & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          agir={agir}
        />
      )}
      {jogoNaTela?.jogo === 'golfe' && (
        <JogoGolfe
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoGolfe & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'golfe3d' && (
        <JogoGolfe3D
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoGolfe3D & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'tocas' && (
        <JogoTocas key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')} estado={jogoNaTela as unknown as EstadoTocas & Partida} eu={eu} jogador={souJogador(partida)} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'futebol' && (
        <JogoFutebol
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoFutebol & Partida}
          eu={eu}
          jogador={souJogador(partida)}
          agir={agir}
          socket={socket}
          channelId={channelId}
        />
      )}
      {jogoNaTela?.jogo === 'tabuleiro' && (
        <JogoTabuleiro
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoTabuleiro & Partida} eu={eu} jogador={souJogador(partida)} restante={restante} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'cidades' && (
        <JogoCidades
          key={String((jogoNaTela as { partidaId?: unknown }).partidaId ?? '')}
          estado={jogoNaTela as unknown as EstadoCidades & Partida} eu={eu} jogador={souJogador(partida)} restante={restante} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'lobisomem' && <JogoLobisomem estado={jogoNaTela as unknown as EstadoLobisomem & Partida} eu={eu} restante={restante} agir={agir} />}
      {(jogoNaTela?.jogo === 'gomoku' || jogoNaTela?.jogo === 'mancala') && (
        <JogoDuelo jogo={jogoNaTela.jogo} estado={jogoNaTela as unknown as EstadoDuelo & Partida} eu={eu} restante={restante} agir={agir} />
      )}
      {/* Os clássicos de mesa (04/11/2026): cada um com a sua tela; a chave da partida zera o estado local entre partidas. */}
      {jogoNaTela?.jogo === 'domino' && (
        <JogoDomino key={String(jogoNaTela.partidaId ?? '')} estado={jogoNaTela} eu={eu} jogador={souJogador(partida)} restante={restante} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'truco' && (
        <JogoTruco key={String(jogoNaTela.partidaId ?? '')} estado={jogoNaTela} eu={eu} jogador={souJogador(partida)} restante={restante} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'partida-de-xadrez' && (
        <JogoPartidaDeXadrez key={String(jogoNaTela.partidaId ?? '')} estado={jogoNaTela} eu={eu} jogador={souJogador(partida)} restante={restante} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'damas' && (
        <JogoDamas key={String(jogoNaTela.partidaId ?? '')} estado={jogoNaTela} eu={eu} jogador={souJogador(partida)} restante={restante} agir={agir} />
      )}
      {jogoNaTela?.jogo === 'naval' && (
        <JogoNaval key={String(jogoNaTela.partidaId ?? '')} estado={jogoNaTela} eu={eu} jogador={souJogador(partida)} restante={restante} agir={agir} />
      )}
      </div>

      {partida?.terminada && (
        <div className="minijogo-acoes">
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              tentar(() =>
                aoComecar(
                  partida.jogo,
                  partida.categoria
                    ? { categoria: partida.categoria }
                    : partida.jogo === 'tabuleiro'
                      ? { rodadas: partida.rodadas, robos: partida.robos }
                      : partida.jogo === 'cidades'
                        ? { modo: partida.modo, rodadas: partida.rodadas, robos: partida.robos }
                        : ROBOS_NO_SOLO[partida.jogo]
                          ? { robos: partida.robos }
                          : {},
                  partida.solo === true,
                ),
              )
            }
          >
            {t('Jogar de novo')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => tentar(aoEncerrar)}>
            {t('Outros jogos')}
          </button>
        </div>
      )}
      {partida && !partida.terminada && !naEspera && podeEncerrar && (
        <button type="button" className="link-button minijogo-encerrar" onClick={() => tentar(aoEncerrar)}>
          {t('Encerrar partida')}
        </button>
      )}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

/**
 * O CONVITE, para quem está na sala e ainda não respondeu: pequeno, em cima da barra, sem cobrir o palco. "Jogar"
 * entra (na mesa, senta) e abre o painel; "Agora não" some e não volta nesta partida. Ignorar também vale: a partida
 * começa sem a pessoa, e o convite some na largada.
 */
export function ConviteDoMinijogo({
  partida,
  aoResponder,
  aoAgir,
  aoAbrir,
}: {
  partida: Partida;
  aoResponder: Responder;
  aoAgir: Agir;
  aoAbrir: () => void;
}) {
  const t = useT();
  const [erro, setErro] = useState<string | null>(null);
  const mesa = JOGOS_DE_MESA.includes(partida.jogo);
  const quem = partida.jogadores?.find((j) => j.userId === partida.criadaPor)?.username ?? '';
  const jogo = t(nomeDoJogo(partida.jogo));
  const jogar = () => {
    setErro(null);
    void (mesa ? aoAgir({ tipo: 'sentar' }) : aoResponder('jogar')).then(aoAbrir, (e) => setErro((e as Error).message));
  };
  return (
    <div className="minijogo-convite" role="status">
      <span className="minijogo-convite-capa" aria-hidden="true">
        <CapaDoJogo jogo={partida.jogo} />
      </span>
      <p>{mesa ? t('{nome} quer jogar {jogo}.', { nome: quem, jogo }) : t('{nome} chamou a sala para jogar {jogo}.', { nome: quem, jogo })}</p>
      <div className="minijogo-convite-acoes">
        <button type="button" className="btn-primary" onClick={jogar}>
          {mesa ? t('Sentar') : t('Jogar')}
        </button>
        <button type="button" className="btn-secondary" onClick={() => void aoResponder('agora-nao').catch((e) => setErro((e as Error).message))}>
          {t('Agora não')}
        </button>
      </div>
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

/**
 * O CONVITE ABERTO, dentro do painel: quem vai jogar, quem disse "agora não", e o que cada um pode fazer. Quem começou
 * dá a largada quando quiser (com o mínimo do jogo); quem aceitou espera; quem ainda não respondeu responde aqui.
 */
function SalaDeEspera({
  partida,
  eu,
  aoResponder,
  aoLargar,
  aoCancelar,
}: {
  partida: Partida;
  eu: number;
  aoResponder: (resposta: 'jogar' | 'sair' | 'agora-nao') => void;
  aoLargar: () => void;
  aoCancelar: () => void;
}) {
  const t = useT();
  const jogadores = partida.jogadores ?? [];
  const minimo = partida.convite?.minimo ?? 1;
  // quem aceitou e saiu da sala não conta para a largada (o servidor conta só os presentes)
  const falta = Math.max(0, minimo - (partida.convite?.presentes ?? jogadores.length));
  const quemConvidou = jogadores.find((j) => j.userId === partida.criadaPor)?.username ?? '';
  const souEu = partida.criadaPor === eu;
  const dentro = souJogador(partida);
  return (
    <div className="minijogo-espera">
      <div className="minijogo-espera-capa" aria-hidden="true">
        <CapaDoJogo jogo={partida.jogo} />
      </div>
      <p className="minijogo-espera-titulo">
        {souEu ? t('Convite feito. Quem aceitar aparece aqui.') : t('{nome} chamou a sala para jogar.', { nome: quemConvidou })}
      </p>
      <ul className="minijogo-espera-lista" aria-label={t('Vão jogar')}>
        {jogadores.map((j) => (
          <li key={j.userId} className={j.userId === eu ? 'eu' : undefined}>
            {j.username}
          </li>
        ))}
      </ul>
      {(partida.recusaram?.length ?? 0) > 0 && (
        <p className="minijogo-espera-recusaram">
          {t('Agora não: {nomes}', { nomes: partida.recusaram!.map((r) => r.username).join(', ') })}
        </p>
      )}
      {souEu && falta > 0 && (
        <p className="minijogo-situacao">{falta === 1 ? t('Falta 1 pessoa para começar.') : t('Faltam {n} pessoas para começar.', { n: falta })}</p>
      )}
      <div className="minijogo-acoes">
        {souEu ? (
          <>
            <button type="button" className="btn-primary" disabled={falta > 0} onClick={aoLargar}>
              {t('Começar')}
            </button>
            <button type="button" className="btn-secondary" onClick={aoCancelar}>
              {t('Cancelar')}
            </button>
          </>
        ) : dentro ? (
          <>
            <span className="minijogo-situacao">{t('Esperando {nome} começar.', { nome: quemConvidou })}</span>
            <button type="button" className="btn-secondary" onClick={() => aoResponder('sair')}>
              {t('Sair')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={() => aoResponder('jogar')}>
              {t('Jogar')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => aoResponder('agora-nao')}>
              {t('Agora não')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** A barra do tempo que falta na fase. */
export function Relogio({ restante, total }: { restante: number; total: number }) {
  return (
    <div className="minijogo-tempo" aria-hidden="true">
      <span style={{ width: `${Math.min(100, (restante / total) * 100)}%` }} />
    </div>
  );
}

/**
 * O PLACAR AO VIVO (pedido dele, 02/11/2026, para o Stop e os quizzes): uma faixa compacta em cima do jogo, na ordem de
 * quem está na frente, com você em destaque. No Stop ele anda a cada rodada (as respostas só se conhecem no STOP); no
 * quiz, a cada acerto.
 */
export function PlacarAoVivo({ linhas, eu }: { linhas: { userId: number; username: string; pontos: number }[]; eu: number }) {
  const t = useT();
  if (linhas.length < 2) return null;
  return (
    <ol className="placar-ao-vivo" aria-label={t('Placar')}>
      {linhas.map((linha) => (
        <li key={linha.userId} className={linha.userId === eu ? 'eu' : ''}>
          {/* Empatados dividem a posição: no começo, todos com 0 são "1", e não 1, 2, 3 pela ordem alfabética. */}
          <span className="placar-ao-vivo-posicao">{1 + linhas.filter((o) => o.pontos > linha.pontos).length}</span>
          <span className="minijogo-nome">{linha.username}</span>
          <strong>{linha.pontos}</strong>
        </li>
      ))}
    </ol>
  );
}

/** O placar final, com medalha para os três primeiros. `valor` é o que aparece à direita de cada nome. */
export function Placar({ linhas, eu }: { linhas: { userId: number; username: string; valor: string; posicao?: number }[]; eu: number }) {
  const t = useT();
  return (
    <div className="minijogo-fim">
      <p className="minijogo-fim-titulo">
        <Trophy size={20} aria-hidden="true" /> {t('Fim de jogo!')}
      </p>
      <ol className="minijogo-placar">
        {linhas.map((linha, i) => (
          <li key={linha.userId} className={linha.userId === eu ? 'eu' : ''}>
            <span className="minijogo-medalha">{MEDALHAS[(linha.posicao ?? i + 1) - 1] ?? `${linha.posicao ?? i + 1}.`}</span>
            <span className="minijogo-nome">{linha.username}</span>
            <span className="minijogo-pontos">{linha.valor}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
