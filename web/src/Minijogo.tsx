import { Gamepad2, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from './IconButton';
import { idiomaAtual, useT } from './i18n';
import { FRASE_DA_MEDIDA, OBJETOS, tamanhoLegivel, type PartidaPublica } from './minijogos';

/**
 * O botão de videogame da sala de voz e o painel do jogo (12/10/2026). O botão fica na barra, ao lado do
 * compartilhar tela e do soundboard: sem partida, ele oferece começar; com partida, mostra ou esconde o
 * painel. O painel aparece SOZINHO para todo mundo da sala quando alguém começa — é um jogo da turma, e
 * ninguém precisa procurar onde entrar.
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

/** Um pedido ao servidor (começar, encerrar); o erro dele aparece no painel. */
interface Acao {
  (): Promise<void>;
}
interface Voto {
  (escolha: 0 | 1): Promise<void>;
}

export function PainelDoMinijogo({
  partida,
  eu,
  podeEncerrar,
  aoComecar,
  aoVotar,
  aoEncerrar,
  aoFechar,
}: {
  partida: (PartidaPublica & { recebidaEm: number }) | null;
  eu: number;
  podeEncerrar: boolean;
  aoComecar: Acao;
  aoVotar: Voto;
  aoEncerrar: Acao;
  aoFechar: () => void;
}) {
  const t = useT();
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(Date.now());

  // O relógio da rodada anda na tela; quem manda no fim dela é o servidor.
  useEffect(() => {
    if (partida?.fase !== 'votando') return;
    const relogio = setInterval(() => setAgora(Date.now()), 200);
    return () => clearInterval(relogio);
  }, [partida?.fase, partida?.rodada]);

  const tentar = (acao: Acao) => () => {
    setErro(null);
    void acao().catch((e) => setErro((e as Error).message));
  };

  const nomeDe = (userId: number) => partida?.placar.find((l) => l.userId === userId)?.username ?? '?';

  return (
    <div className="minijogo" role="dialog" aria-label={t('Qual é maior?')}>
      <div className="minijogo-topo">
        <strong>
          <Gamepad2 size={16} aria-hidden="true" /> {t('Qual é maior?')}
        </strong>
        {partida && partida.fase !== 'fim' && <span className="minijogo-rodada">{t('Rodada {n} de {total}', { n: partida.rodada, total: partida.rodadas })}</span>}
        <button type="button" className="icon-plain" aria-label={t('Fechar')} onClick={aoFechar}>
          <X size={16} />
        </button>
      </div>

      {!partida && (
        <div className="minijogo-convite">
          <p>{t('Dois objetos aparecem e cada um escolhe, na própria tela, qual é o maior. O tamanho de verdade aparece para todo mundo ao mesmo tempo.')}</p>
          <button type="button" className="btn-primary" onClick={tentar(aoComecar)}>
            {t('Começar com a turma')}
          </button>
        </div>
      )}

      {partida && partida.fase !== 'fim' && (
        <Rodada partida={partida} eu={eu} agora={agora} nomeDe={nomeDe} aoVotar={(e) => tentar(() => aoVotar(e))()} />
      )}

      {partida?.fase === 'fim' && (
        <div className="minijogo-fim">
          <p className="minijogo-fim-titulo">
            <Trophy size={20} aria-hidden="true" /> {t('Fim de jogo!')}
          </p>
          <ol className="minijogo-placar">
            {partida.placar.map((linha, i) => (
              <li key={linha.userId} className={linha.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha">{MEDALHAS[i] ?? `${i + 1}.`}</span>
                <span className="minijogo-nome">{linha.username}</span>
                <span className="minijogo-pontos">
                  {linha.pontos}/{partida.rodadas}
                </span>
              </li>
            ))}
          </ol>
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={tentar(aoComecar)}>
              {t('Jogar de novo')}
            </button>
            <button type="button" className="btn-secondary" onClick={tentar(aoEncerrar)}>
              {t('Fechar')}
            </button>
          </div>
        </div>
      )}

      {partida && partida.fase !== 'fim' && podeEncerrar && (
        <button type="button" className="link-button minijogo-encerrar" onClick={tentar(aoEncerrar)}>
          {t('Encerrar partida')}
        </button>
      )}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

function Rodada({
  partida,
  eu,
  agora,
  nomeDe,
  aoVotar,
}: {
  partida: PartidaPublica & { recebidaEm: number };
  eu: number;
  agora: number;
  nomeDe: (userId: number) => string;
  aoVotar: (escolha: 0 | 1) => void;
}) {
  const t = useT();
  const revelando = partida.fase === 'revelando';
  const jaVotei = partida.votaram.includes(eu);
  // A carta que EU escolhi fica marcada já na votação: o servidor esconde os votos de todo mundo, mas o
  // meu eu sei. Zera a cada rodada.
  const [escolhi, setEscolhi] = useState<{ rodada: number; lado: 0 | 1 } | null>(null);
  const minhaCarta = escolhi?.rodada === partida.rodada ? escolhi.lado : null;
  const meuVoto = partida.votos?.[String(eu)];
  const restante = Math.max(0, partida.restanteMs - (agora - partida.recebidaEm));
  const total = revelando ? 5000 : 15_000;

  return (
    <>
      <div className="minijogo-par">
        {partida.par.map((objeto, lado) => {
          const info = OBJETOS[objeto.id];
          const eraEsse = partida.certo === lado;
          const quem = revelando ? Object.entries(partida.votos ?? {}).filter(([, e]) => e === lado).map(([id]) => nomeDe(Number(id))) : [];
          return (
            <button
              key={objeto.id}
              type="button"
              className={`minijogo-carta${revelando && eraEsse ? ' certo' : ''}${minhaCarta === lado ? ' escolhida' : ''}`}
              disabled={revelando}
              aria-pressed={minhaCarta === lado}
              onClick={() => {
                setEscolhi({ rodada: partida.rodada, lado: lado as 0 | 1 });
                aoVotar(lado as 0 | 1);
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

      <div className="minijogo-tempo" aria-hidden="true">
        <span style={{ width: `${(restante / total) * 100}%` }} />
      </div>

      <p className="minijogo-situacao" role="status">
        {revelando
          ? meuVoto === undefined
            ? t('Você não votou nesta.')
            : meuVoto === partida.certo
              ? t('Acertou!')
              : t('Errou!')
          : jaVotei
            ? t('Você votou. {n} de {total} já escolheram.', { n: partida.votaram.length, total: Math.max(partida.placar.length, partida.votaram.length) })
            : t('Qual é maior? Clique num dos dois.')}
      </p>
    </>
  );
}
