import { Gamepad2, Trophy, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
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

// O canal de transparência do desenho: o filtro pinta só onde o emoji tem tinta.
const ALFA = 'SourceAlpha';
const MEDALHAS = ['🥇', '🥈', '🥉'];

/**
 * A capa do "Qual é maior?": duas silhuetas lado a lado sobre uma grade, a de referência medida e a outra
 * com "?". As silhuetas são os próprios emojis do jogo pintados de uma cor só (o filtro troca a cor e
 * guarda o contorno), então a capa não tem arte de terceiro nem texto para traduzir.
 */
function CapaQualEMaior() {
  const id = useId().replace(/:/g, '');
  const grade = Array.from({ length: 9 }, (_, i) => 10 + i * 18);
  return (
    <svg className="minijogo-capa" viewBox="0 0 160 120" aria-hidden="true">
      <defs>
        <filter id={`${id}-azul`}>
          <feFlood floodColor="#4f7df5" />
          <feComposite in2={ALFA} operator="in" />
        </filter>
        <filter id={`${id}-laranja`}>
          <feFlood floodColor="#f2603f" />
          <feComposite in2={ALFA} operator="in" />
        </filter>
      </defs>
      <rect width="160" height="120" fill="#121a16" />
      {grade.map((x) => (
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="120" stroke="#1d2a23" strokeWidth="0.6" />
      ))}
      {grade.slice(0, 7).map((y) => (
        <line key={`h${y}`} x1="0" y1={y} x2="160" y2={y} stroke="#1d2a23" strokeWidth="0.6" />
      ))}
      <line x1="0" y1="104" x2="160" y2="104" stroke="#5f8f4e" strokeWidth="1" />
      <text x="44" y="103" fontSize="58" textAnchor="middle" filter={`url(#${id}-azul)`}>
        🦒
      </text>
      <text x="117" y="102" fontSize="50" textAnchor="middle" filter={`url(#${id}-laranja)`}>
        🐘
      </text>
      <rect x="90" y="30" width="54" height="74" fill="none" stroke="#e8e6df" strokeWidth="0.8" strokeDasharray="3 2" />
      <rect x="10" y="10" width="44" height="13" rx="2" fill="#e8e6df" />
      <rect x="10" y="10" width="2.5" height="13" fill="#4f7df5" />
      <text x="34" y="20" fontSize="8.5" fontWeight="700" textAnchor="middle" fill="#2c4fb0">
        {tamanhoLegivel(550, idiomaAtual())}
      </text>
      <rect x="96" y="10" width="44" height="13" rx="2" fill="#e8e6df" />
      <rect x="96" y="10" width="2.5" height="13" fill="#f2603f" />
      <text x="120" y="20" fontSize="8.5" fontWeight="700" textAnchor="middle" fill="#c2401f">
        ???
      </text>
    </svg>
  );
}

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
          <Gamepad2 size={16} aria-hidden="true" /> {partida ? t('Qual é maior?') : t('Mini-games')}
        </strong>
        {partida && partida.fase !== 'fim' && <span className="minijogo-rodada">{t('Rodada {n} de {total}', { n: partida.rodada, total: partida.rodadas })}</span>}
        <button type="button" className="icon-plain" aria-label={t('Fechar')} onClick={aoFechar}>
          <X size={16} />
        </button>
      </div>

      {/* A ESTANTE DE JOGOS (12/10/2026, pedido do Sydenstricker: a tela mais limpa). Uma capa por jogo, e
          clicar já começa para a sala inteira. A explicação mora na dica do mouse: a capa diz o que é. */}
      {!partida && (
        <ul className="minijogo-estante">
          <li>
            <button
              type="button"
              className="minijogo-jogo"
              title={t('Dois objetos aparecem e cada um escolhe, na própria tela, qual é o maior. O tamanho de verdade aparece para todo mundo ao mesmo tempo.')}
              onClick={tentar(aoComecar)}
            >
              <CapaQualEMaior />
              <span>{t('Qual é maior?')}</span>
            </button>
          </li>
        </ul>
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
