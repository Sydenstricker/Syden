import { Gamepad2, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { CapaDoJogo } from './CapasDosJogos';
import { IconButton } from './IconButton';
import { idiomaAtual, useT } from './i18n';
import { JogoDesenho } from './JogoDesenho';
import { JogoDuelo } from './JogoDuelo';
import { JogoLobisomem } from './JogoLobisomem';
import { JogoStop } from './JogoStop';
import { JogoSudoku } from './JogoSudoku';
import { JogoXadrez } from './JogoXadrez';
import {
  FRASE_DA_MEDIDA,
  JOGOS,
  nomeDoJogo,
  OBJETOS,
  tamanhoLegivel,
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
  (jogo: IdDoJogo): Promise<void>;
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
      {!partida && (
        <ul className="minijogo-estante">
          {JOGOS.map((jogo) => (
            <li key={jogo.id}>
              <button type="button" className="minijogo-jogo" title={t(jogo.dica)} onClick={() => tentar(() => aoComecar(jogo.id))}>
                <CapaDoJogo jogo={jogo.id} />
                <span>{t(jogo.nome)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

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
          <button type="button" className="btn-primary" onClick={() => tentar(() => aoComecar(partida.jogo))}>
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

function JogoTamanho({
  estado,
  eu,
  restante,
  agir,
}: {
  estado: EstadoTamanho & Partida;
  eu: number;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const revelando = estado.fase === 'revelando';
  const jaVotei = estado.votaram.includes(eu);
  // A carta que EU escolhi fica marcada já na votação: o servidor esconde os votos de todo mundo, mas o
  // meu eu sei. Zera a cada rodada.
  const [escolhi, setEscolhi] = useState<{ rodada: number; lado: 0 | 1 } | null>(null);
  const minhaCarta = escolhi?.rodada === estado.rodada ? escolhi.lado : null;
  const meuVoto = estado.votos?.[String(eu)];
  const nomeDe = (userId: number) => estado.placar.find((l) => l.userId === userId)?.username ?? '?';

  if (estado.terminada) {
    return <Placar eu={eu} linhas={estado.placar.map((l) => ({ ...l, valor: `${l.pontos}/${estado.rodadas}` }))} />;
  }

  return (
    <>
      <div className="minijogo-par">
        {estado.par.map((objeto, lado) => {
          const info = OBJETOS[objeto.id];
          const eraEsse = estado.certo === lado;
          const quem = revelando
            ? Object.entries(estado.votos ?? {})
                .filter(([, e]) => e === lado)
                .map(([id]) => nomeDe(Number(id)))
            : [];
          return (
            <button
              key={objeto.id}
              type="button"
              className={`minijogo-carta${revelando && eraEsse ? ' certo' : ''}${minhaCarta === lado ? ' escolhida' : ''}`}
              disabled={revelando}
              aria-pressed={minhaCarta === lado}
              onClick={() => {
                setEscolhi({ rodada: estado.rodada, lado: lado as 0 | 1 });
                agir({ tipo: 'voto', escolha: lado });
              }}
            >
              <span className="minijogo-emoji" aria-hidden="true">
                {info?.emoji ?? '❓'}
              </span>
              <span className="minijogo-objeto">{info ? t(info.nome) : objeto.id}</span>
              {revelando && objeto.cm !== undefined && objeto.medida && (
                <span className="minijogo-tamanho">{t(FRASE_DA_MEDIDA[objeto.medida], { tamanho: tamanhoLegivel(objeto.cm, idiomaAtual()) })}</span>
              )}
              {revelando && eraEsse && <span className="minijogo-selo">{t('Maior!')}</span>}
              {revelando && quem.length > 0 && <span className="minijogo-quem">{quem.join(', ')}</span>}
            </button>
          );
        })}
      </div>

      <Relogio restante={restante} total={revelando ? 5000 : 15_000} />

      <p className="minijogo-situacao" role="status">
        {revelando
          ? meuVoto === undefined
            ? t('Você não votou nesta.')
            : meuVoto === estado.certo
              ? t('Acertou!')
              : t('Errou!')
          : jaVotei
            ? t('Você votou. {n} de {total} já escolheram.', {
                n: estado.votaram.length,
                total: Math.max(estado.placar.length, estado.votaram.length),
              })
            : t('Qual é maior? Clique num dos dois.')}
      </p>
    </>
  );
}
