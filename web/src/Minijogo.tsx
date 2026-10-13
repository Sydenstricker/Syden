import { Gamepad2, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { CapaDoJogo, CapaPalavraDoDia } from './CapasDosJogos';
import { IconButton } from './IconButton';
import { useT } from './i18n';
import { JogoDesenho } from './JogoDesenho';
import { JogoDuelo } from './JogoDuelo';
import { JogoLobisomem } from './JogoLobisomem';
import { JogoStop } from './JogoStop';
import { JogoSudoku } from './JogoSudoku';
import { EscolhaDeCategoria, JogoTamanho } from './JogoTamanho';
import { JogoXadrez } from './JogoXadrez';
import { SiteEmbutido } from './SiteEmbutido';
import {
  JOGOS,
  nomeDoJogo,
  SITES_PARA_TRANSMITIR,
  type EstadoDesenho,
  type EstadoDuelo,
  type EstadoLobisomem,
  type EstadoStop,
  type EstadoSudoku,
  type EstadoTamanho,
  type EstadoXadrez,
  type IdDoJogo,
  type Partida,
  type PartidaPublica,
} from './minijogos';

/**
 * O botão de videogame da sala de voz e o painel do jogo (12/10/2026). O botão fica na barra, ao lado do
 * compartilhar tela e do soundboard: sem partida, ele abre a estante de jogos; com partida, mostra ou
 * esconde o painel. O painel aparece SOZINHO para todo mundo da sala quando alguém começa — é um jogo da
 * turma, e ninguém precisa procurar onde entrar.
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
  (jogo: IdDoJogo, escolhas?: Record<string, unknown>): Promise<void>;
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
  aoFechar,
  socket,
  channelId,
}: {
  partida: Partida | null;
  eu: number;
  podeEncerrar: boolean;
  aoComecar: Comecar;
  aoAgir: Agir;
  aoEncerrar: Acao;
  aoFechar: () => void;
  /** O desenho manda e recebe o traço por aqui, na hora. */
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(Date.now());
  /** O "Qual é o tamanho?" pede a categoria antes de começar. */
  const [escolhendoCategoria, setEscolhendoCategoria] = useState(false);
  /** O jogo de parceiro aberto (o Termo): só para quem clicou, porque ele é de um jogador só. */
  const [siteAberto, setSiteAberto] = useState<{ nome: string; endereco: string } | null>(null);

  // O relógio anda na tela; quem manda no fim de cada fase é o servidor.
  const andando = partida !== null && !partida.terminada;
  useEffect(() => {
    if (!andando) return;
    const relogio = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(relogio);
  }, [andando]);

  const tentar = (acao: Acao) => {
    setErro(null);
    void acao().catch((e) => setErro((e as Error).message));
  };
  const agir = (corpo: Record<string, unknown>) => tentar(() => aoAgir(corpo));
  const restante = partida ? Math.max(0, partida.restanteMs - (agora - partida.recebidaEm)) : 0;
  const rodada = partida && (partida.jogo === 'tamanho' || partida.jogo === 'stop' || partida.jogo === 'xadrez') && !partida.terminada ? (partida as unknown as EstadoTamanho) : null;

  return (
    <div className={`minijogo${partida ? ` jogando-${partida.jogo}` : ''}`} role="dialog" aria-label={partida ? t(nomeDoJogo(partida.jogo)) : t('Mini-games')}>
      <div className="minijogo-topo">
        <strong>
          <Gamepad2 size={16} aria-hidden="true" /> {partida ? t(nomeDoJogo(partida.jogo)) : t('Mini-games')}
        </strong>
        {rodada && <span className="minijogo-rodada">{t('Rodada {n} de {total}', { n: rodada.rodada, total: rodada.rodadas })}</span>}
        <button type="button" className="icon-plain" aria-label={t('Fechar')} onClick={aoFechar}>
          <X size={16} />
        </button>
      </div>

      {/* A ESTANTE DE JOGOS (pedido do Sydenstricker: a tela mais limpa). Uma capa por jogo, e clicar já
          começa para a sala inteira. A explicação mora na dica do mouse: a capa diz o que é. */}
      {!partida && escolhendoCategoria && (
        <EscolhaDeCategoria
          aoEscolher={(categoria) => tentar(() => aoComecar('tamanho', { categoria }).then(() => setEscolhendoCategoria(false)))}
          aoVoltar={() => setEscolhendoCategoria(false)}
        />
      )}
      {!partida && !escolhendoCategoria && (
        <ul className="minijogo-estante">
          {JOGOS.map((jogo) => (
            <li key={jogo.id}>
              <button
                type="button"
                className="minijogo-jogo"
                title={t(jogo.dica)}
                onClick={() => (jogo.id === 'tamanho' ? setEscolhendoCategoria(true) : tentar(() => aoComecar(jogo.id)))}
              >
                <CapaDoJogo jogo={jogo.id} />
                <span>{t(jogo.nome)}</span>
              </button>
            </li>
          ))}
          {/* Os jogos de parceiro que rodam dentro do Syden (o Termo): no fim da estante, e abrem SÓ para quem
              clicou — a partida da sala continua livre para os outros. */}
          {SITES_PARA_TRANSMITIR.filter((site) => site.embutir).map((site) => (
            <li key={site.endereco}>
              <button type="button" className="minijogo-jogo minijogo-parceiro" title={t(site.dica)} onClick={() => setSiteAberto(site)}>
                <CapaPalavraDoDia />
                <span>{site.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {siteAberto && <SiteEmbutido nome={siteAberto.nome} endereco={siteAberto.endereco} aoFechar={() => setSiteAberto(null)} />}

      {partida?.jogo === 'tamanho' && <JogoTamanho estado={partida as unknown as EstadoTamanho & Partida} eu={eu} restante={restante} agir={agir} />}
      {partida?.jogo === 'stop' && <JogoStop estado={partida as unknown as EstadoStop & Partida} eu={eu} restante={restante} agir={agir} aoAgir={aoAgir} />}
      {partida?.jogo === 'sudoku' && <JogoSudoku estado={partida as unknown as EstadoSudoku & Partida} eu={eu} restante={restante} agir={agir} />}
      {partida?.jogo === 'desenho' && (
        <JogoDesenho estado={partida as unknown as EstadoDesenho & Partida} eu={eu} restante={restante} agir={agir} socket={socket} channelId={channelId} />
      )}
      {partida?.jogo === 'xadrez' && <JogoXadrez estado={partida as unknown as EstadoXadrez & Partida} eu={eu} restante={restante} agir={agir} />}
      {partida?.jogo === 'lobisomem' && <JogoLobisomem estado={partida as unknown as EstadoLobisomem & Partida} eu={eu} restante={restante} agir={agir} />}
      {(partida?.jogo === 'gomoku' || partida?.jogo === 'mancala') && (
        <JogoDuelo jogo={partida.jogo} estado={partida as unknown as EstadoDuelo & Partida} eu={eu} restante={restante} agir={agir} />
      )}

      {partida?.terminada && (
        <div className="minijogo-acoes">
          <button
            type="button"
            className="btn-primary"
            onClick={() => tentar(() => aoComecar(partida.jogo, partida.jogo === 'tamanho' ? { categoria: partida.categoria } : {}))}
          >
            {t('Jogar de novo')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => tentar(aoEncerrar)}>
            {t('Outros jogos')}
          </button>
        </div>
      )}
      {partida && !partida.terminada && podeEncerrar && (
        <button type="button" className="link-button minijogo-encerrar" onClick={() => tentar(aoEncerrar)}>
          {t('Encerrar partida')}
        </button>
      )}
      {erro && <p className="form-error small">{erro}</p>}
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
