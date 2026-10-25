import { Gamepad2, Trophy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { CapaDoJogo, CapaPalavraDoDia } from './CapasDosJogos';
import { IconButton } from './IconButton';
import { idiomaAtual, useT } from './i18n';
import { JogoDesenho } from './JogoDesenho';
import { JogoDuelo } from './JogoDuelo';
import { JogoLobisomem } from './JogoLobisomem';
import { JogoPalavra } from './JogoPalavra';
import { JogoQuiz } from './JogoQuiz';
import { ehQuiz, type EstadoQuiz } from './quiz';
import { JogoStop } from './JogoStop';
import { JogoSudoku } from './JogoSudoku';
import { EscolhaDeCategoria, JogoTamanho } from './JogoTamanho';
import { JogoXadrez } from './JogoXadrez';
import {
  JOGOS,
  JOGOS_DE_MESA,
  nomeDoIdioma,
  nomeDoJogo,
  souJogador,
  SITES_PARA_TRANSMITIR,
  type EstadoDesenho,
  type EstadoDuelo,
  type EstadoLobisomem,
  type EstadoPalavra,
  type EstadoStop,
  type EstadoSudoku,
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
  partida,
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
  /** O "Qual é o tamanho?" pede a categoria antes de começar. */
  const [escolhendoCategoria, setEscolhendoCategoria] = useState(false);
  /** A aba da estante: a última escolhida volta na próxima vez (só neste navegador). */
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
    if (comecarCom === 'tamanho') setEscolhendoCategoria(true);
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
  const agir = (corpo: Record<string, unknown>) => tentar(() => aoAgir(corpo));
  const restante = partida ? Math.max(0, partida.restanteMs - (agora - partida.recebidaEm)) : 0;
  const naEspera = Boolean(partida?.convite);
  const rodada =
    partida && !naEspera && (partida.jogo === 'tamanho' || partida.jogo === 'stop' || partida.jogo === 'xadrez' || partida.jogo === 'palavra' || ehQuiz(partida.jogo)) && !partida.terminada
      ? (partida as unknown as EstadoTamanho)
      : null;
  // Quem não aceitou o convite vê a partida, mas não mexe nela (a mesa cuida de quem senta).
  const soAssiste = partida !== null && !naEspera && !souJogador(partida) && !JOGOS_DE_MESA.includes(partida.jogo);
  const jogoNaTela = partida && !naEspera ? partida : null;

  return (
    <div className={`minijogo${partida ? ` jogando-${partida.jogo}` : ' na-estante'}`} role="dialog" aria-label={partida ? t(nomeDoJogo(partida.jogo)) : t('Mini-games')}>
      <div className="minijogo-topo">
        <strong>
          <Gamepad2 size={16} aria-hidden="true" /> {partida ? t(nomeDoJogo(partida.jogo)) : t('Mini-games')}
        </strong>
        {/* As abas da estante (pedido dele, 14/10/2026): o que se joga sozinho e o que é da turma. */}
        {!partida && !escolhendoCategoria && !soSolo && (
          <div className="minijogo-abas" role="tablist" aria-label={t('Mini-games')}>
            {(['solo', 'coletivo'] as const).map((grupo) => (
              <button key={grupo} type="button" role="tab" aria-selected={aba === grupo} className={aba === grupo ? 'ativa' : ''} onClick={() => escolherAba(grupo)}>
                {grupo === 'solo' ? t('Solo') : t('Coletivo')}
              </button>
            ))}
          </div>
        )}
        {rodada && <span className="minijogo-rodada">{t('Rodada {n} de {total}', { n: rodada.rodada, total: rodada.rodadas })}</span>}
        <button type="button" className="icon-plain" aria-label={t('Fechar')} onClick={aoFechar}>
          <X size={16} />
        </button>
      </div>

      {/* A ESTANTE DE JOGOS (pedido do Sydenstricker: a tela mais limpa). Uma capa por jogo, e clicar já
          começa para a sala inteira. A explicação mora na dica do mouse: a capa diz o que é. */}
      {!partida && escolhendoCategoria && (
        <EscolhaDeCategoria
          aoEscolher={(categoria) => tentar(() => aoComecar('tamanho', { categoria }, aba === 'solo').then(() => setEscolhendoCategoria(false)))}
          aoVoltar={() => setEscolhendoCategoria(false)}
        />
      )}
      {!partida && !escolhendoCategoria && (
        <ul className="minijogo-estante">
          {JOGOS.filter((jogo) => jogo.abas.includes(aba)).map((jogo) => (
            <li key={jogo.id}>
              <button
                type="button"
                className="minijogo-jogo"
                title={t(jogo.dica)}
                onClick={() => (jogo.id === 'tamanho' ? setEscolhendoCategoria(true) : tentar(() => aoComecar(jogo.id, {}, aba === 'solo')))}
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
      {jogoNaTela?.jogo === 'lobisomem' && <JogoLobisomem estado={jogoNaTela as unknown as EstadoLobisomem & Partida} eu={eu} restante={restante} agir={agir} />}
      {(jogoNaTela?.jogo === 'gomoku' || jogoNaTela?.jogo === 'mancala') && (
        <JogoDuelo jogo={jogoNaTela.jogo} estado={jogoNaTela as unknown as EstadoDuelo & Partida} eu={eu} restante={restante} agir={agir} />
      )}
      </div>

      {partida?.terminada && (
        <div className="minijogo-acoes">
          <button
            type="button"
            className="btn-primary"
            onClick={() => tentar(() => aoComecar(partida.jogo, partida.jogo === 'tamanho' ? { categoria: partida.categoria } : {}, partida.solo === true))}
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

/** O placar final, com medalha para os três primeiros. `valor` é o que aparece à direita de cada nome. */
export function Placar({ linhas, eu }: { linhas: { userId: number; username: string; valor: string }[]; eu: number }) {
  const t = useT();
  return (
    <div className="minijogo-fim">
      <p className="minijogo-fim-titulo">
        <Trophy size={20} aria-hidden="true" /> {t('Fim de jogo!')}
      </p>
      <ol className="minijogo-placar">
        {linhas.map((linha, i) => (
          <li key={linha.userId} className={linha.userId === eu ? 'eu' : ''}>
            <span className="minijogo-medalha">{MEDALHAS[i] ?? `${i + 1}.`}</span>
            <span className="minijogo-nome">{linha.username}</span>
            <span className="minijogo-pontos">{linha.valor}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
