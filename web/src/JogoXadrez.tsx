import { Check, ExternalLink, Lightbulb, RotateCcw, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from './i18n';
import { Tabuleiro3D } from './JogoPartidaDeXadrez';
import { ComoJogar } from './MesaComum';
import { Placar, Relogio } from './Minijogo';
import type { EstadoXadrez, Partida } from './minijogos';

const RESOLVENDO_MS = 60_000;
const SOLUCAO_MS = 7_000;
const CORRIDA_MS = 3 * 60_000;
const SEQUENCIA_MS = 2 * 60_000;

/**
 * As peças são as letras do xadrez em Unicode — as cheias para os dois lados, pintadas pela cor (assim
 * branca e preta têm o mesmo desenho em qualquer fonte). O U+FE0E pede a forma de texto: sem ele, o
 * peão vira emoji em alguns sistemas.
 */
const DESENHO: Record<string, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};
const peca = (letra: string) => `${DESENHO[letra.toLowerCase()]}︎`;
const nomeDaCasa = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
const casaDoNome = (n: string) => (8 - Number(n[1])) * 8 + 'abcdefgh'.indexOf(n[0]);

/** "0:42": o tempo de quem acertou. */
const segundos = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}`;

/** O que o servidor manda desde 19/11/2026: as casas que cada peça alcança, o "de novo" do Solo e a corrida. */
type Estado = EstadoXadrez & {
  modo?: 'rodadas' | 'corrida' | 'sequencia';
  /** A dica (20/11/2026): a casa da peça que move, depois de pedida; `comDica`, se este problema já a custou. */
  dica?: number | null;
  comDica?: boolean;
  sequencia?: {
    acertos: number;
    comDica: number;
    recordeAntes: number | null;
    recorde: { antes: number | null; novo: boolean } | null;
  } | null;
  lances?: { de: number; para: number }[];
  podeTentarDeNovo?: boolean;
  corrida?: {
    restanteMs: number;
    resolvidos: number;
    erros: number;
    recordeAntes: number | null;
    recorde: { antes: number | null; novo: boolean } | null;
  } | null;
};

/**
 * OS PROBLEMAS DE XADREZ DO LICHESS, EM CORRIDA (ver server/src/minijogo-xadrez.ts). Cada um resolve no seu
 * tabuleiro, virado para a cor de quem joga: clica na peça, depois na casa. Um lance errado encerra a
 * tentativa; a resposta do adversário vem sozinha. No fim de cada problema, todo mundo vê a solução — e o
 * link para o problema no Lichess, para quem quiser estudar.
 *
 * DESDE 19/11/2026: o tabuleiro 3D e o destaque das casas que a peça alcança, os mesmos da partida (JogoPartidaDeXadrez.tsx);
 * no Solo, o "tente de novo" sem perder o problema; e a CORRIDA de 3 minutos, com o recorde.
 */
export function JogoXadrez({
  estado: bruto,
  eu,
  restante,
  agir,
}: {
  estado: EstadoXadrez & Partida;
  eu: number;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const estado = bruto as Estado & Partida;
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const corrida = estado.modo === 'corrida' ? estado.corrida : null;
  const sequencia = estado.modo === 'sequencia' ? estado.sequencia : null;
  // o problema mudou (ou o tabuleiro andou): a peça escolhida não vale mais
  const assinatura = `${estado.problema}:${estado.casas.join('')}`;
  useEffect(() => setEscolhida(null), [assinatura]);
  // a dica chegou: a peça que move fica escolhida, com as casas dela acesas
  const dica = estado.dica ?? null;
  useEffect(() => {
    if (dica !== null) setEscolhida(dica);
  }, [dica]);

  if (estado.terminada) {
    if (sequencia) {
      return (
        <div className="xadrez xadrez-fim-da-corrida">
          <p className="minijogo-situacao" role="status">
            {t('Acertos em sequência: {n}', { n: sequencia.acertos })}
          </p>
          {sequencia.recorde?.novo ? (
            <p className="minijogo-situacao">
              <Trophy size={16} aria-hidden="true" /> {t('Novo recorde!')}
            </p>
          ) : sequencia.recordeAntes !== null ? (
            <p className="minijogo-situacao">{t('Seu recorde: {n}', { n: sequencia.recordeAntes })}</p>
          ) : null}
        </div>
      );
    }
    if (corrida) {
      return (
        <div className="xadrez xadrez-fim-da-corrida">
          <p className="minijogo-situacao" role="status">
            {t('Problemas resolvidos: {n}', { n: corrida.resolvidos })}
          </p>
          {corrida.recorde?.novo ? (
            <p className="minijogo-situacao">
              <Trophy size={16} aria-hidden="true" /> {t('Novo recorde!')}
            </p>
          ) : corrida.recordeAntes !== null ? (
            <p className="minijogo-situacao">{t('Seu recorde: {n}', { n: corrida.recordeAntes })}</p>
          ) : null}
        </div>
      );
    }
    return <Placar eu={eu} linhas={estado.placar.map((l) => ({ ...l, valor: String(l.pontos) }))} />;
  }

  const resolvendo = estado.fase === 'resolvendo' && estado.estado === 'resolvendo';
  const girado = estado.cor === 'b';
  const lances = resolvendo ? (estado.lances ?? []) : [];
  const origens = new Set(lances.map((l) => l.de));
  const destinos = escolhida === null ? [] : lances.filter((l) => l.de === escolhida).map((l) => l.para);
  const minha = (letra: string) => letra !== '' && (letra === letra.toUpperCase() ? 'w' : 'b') === estado.cor;
  // O tabuleiro fica virado para quem joga: com as pretas, a8 vai para baixo à direita.
  const ordem = Array.from({ length: 64 }, (_, i) => (girado ? 63 - i : i));
  const ultimoNomes = estado.ultimo ? [estado.ultimo.slice(0, 2), estado.ultimo.slice(2, 4)] : [];
  const ultimo = estado.ultimo ? { de: casaDoNome(ultimoNomes[0]), para: casaDoNome(ultimoNomes[1]) } : null;

  const clicar = (i: number) => {
    if (!resolvendo) return;
    // sem a lista (servidor de antes), qualquer peça da cor de quem resolve
    if (lances.length ? origens.has(i) : minha(estado.casas[i])) return setEscolhida(i === escolhida ? null : i);
    if (escolhida === null) return;
    if (lances.length && !destinos.includes(i)) return;
    const peao = estado.casas[escolhida].toLowerCase() === 'p';
    const ultimaFileira = Math.floor(i / 8) === (estado.cor === 'w' ? 0 : 7);
    agir({
      tipo: 'lance',
      lance: `${nomeDaCasa(escolhida)}${nomeDaCasa(i)}${peao && ultimaFileira ? 'q' : ''}`,
    });
    setEscolhida(null);
  };

  let situacao: string;
  if (estado.fase === 'solucao') situacao = t('A solução do problema.');
  else if (estado.estado === 'acertou') situacao = t('Acertou! Agora é torcer pelos outros.');
  else if (estado.estado === 'errou' && sequencia) situacao = t('Esse não era o lance.');
  else if (estado.estado === 'errou') situacao = estado.podeTentarDeNovo ? t('Esse não era o lance.') : t('Esse não era o lance. Espere a solução.');
  else situacao = estado.cor === 'w' ? t('Você joga com as brancas. Ache o melhor lance.') : t('Você joga com as pretas. Ache o melhor lance.');

  const tabuleiro = (
    <div className="xadrez-tabuleiro">
      {ordem.map((i) => {
        const letra = estado.casas[i];
        const clara = (Math.floor(i / 8) + (i % 8)) % 2 === 0;
        const classes = [
          'xadrez-casa',
          clara ? 'clara' : 'escura',
          ultimoNomes.includes(nomeDaCasa(i)) && 'ultimo',
          escolhida === i && 'escolhida',
          (lances.length ? origens.has(i) : resolvendo && minha(letra)) && 'minha',
          destinos.includes(i) && 'destino',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button key={i} type="button" className={classes} aria-label={nomeDaCasa(i)} disabled={!resolvendo} onClick={() => clicar(i)}>
            {letra && <span className={`xadrez-peca ${letra === letra.toUpperCase() ? 'branca' : 'preta'}`}>{peca(letra)}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="xadrez">
      {sequencia && (
        <p className="minijogo-situacao">
          <Check size={14} aria-hidden="true" /> {sequencia.acertos}
          {sequencia.comDica > 0 && (
            <>
              {' '}
              · <Lightbulb size={14} aria-hidden="true" /> {sequencia.comDica}
            </>
          )}
          {sequencia.recordeAntes !== null && (
            <>
              {' '}
              · <Trophy size={14} aria-hidden="true" /> {sequencia.recordeAntes}
            </>
          )}
        </p>
      )}
      {corrida && (
        <p className="minijogo-situacao">
          <Check size={14} aria-hidden="true" /> {corrida.resolvidos} · <X size={14} aria-hidden="true" /> {corrida.erros}
          {corrida.recordeAntes !== null && (
            <>
              {' '}
              · <Trophy size={14} aria-hidden="true" /> {corrida.recordeAntes}
            </>
          )}
        </p>
      )}
      <Tabuleiro3D
        dados={{
          casas: estado.casas,
          girado,
          escolhida,
          destinos,
          ultimo,
          xequeEm: null,
        }}
        aoClicar={clicar}
        reserva={tabuleiro}
      />
      <p className={`minijogo-situacao${resolvendo ? ' minha-vez' : ''}`} role="status">
        {situacao}
      </p>
      {resolvendo && dica === null && (
        <div className="minijogo-acoes">
          <button type="button" className="btn-secondary" onClick={() => agir({ tipo: 'dica' })} title={corrida ? t('Dica: tira 10 segundos') : t('Dica: este problema não pontua')}>
            <Lightbulb size={14} aria-hidden="true" /> {t('Dica')}
          </button>
        </div>
      )}
      {estado.podeTentarDeNovo && (
        <div className="minijogo-acoes">
          <button type="button" className="btn-secondary" onClick={() => agir({ tipo: 'de-novo' })}>
            <RotateCcw size={14} aria-hidden="true" /> {t('Tentar de novo')}
          </button>
        </div>
      )}
      {!corrida && !sequencia && (
        <ul className="xadrez-jogadores">
          {estado.jogadores.map((j) => (
            <li key={j.userId} className={`${j.estado}${j.userId === eu ? ' eu' : ''}`}>
              {j.estado === 'acertou' ? (
                <Check size={14} aria-hidden="true" />
              ) : j.estado === 'errou' ? (
                <X size={14} aria-hidden="true" />
              ) : (
                <span className="xadrez-pensando">…</span>
              )}
              {j.username}
              {j.tempoMs !== null && <span className="xadrez-tempo">{segundos(j.tempoMs)}</span>}
            </li>
          ))}
        </ul>
      )}
      <Relogio restante={restante} total={corrida ? CORRIDA_MS : sequencia ? SEQUENCIA_MS : estado.fase === 'solucao' ? SOLUCAO_MS : RESOLVENDO_MS} />
      <ComoJogar jogo="xadrez" />
      <p className="xadrez-credito">
        {estado.fase === 'solucao' ? (
          <a href={`https://lichess.org/training/${estado.problema}`} target="_blank" rel="noopener noreferrer">
            {t('Ver este problema no Lichess')} <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : (
          t('Problema do Lichess · nota {nota}', { nota: estado.nota })
        )}
      </p>
    </div>
  );
}
