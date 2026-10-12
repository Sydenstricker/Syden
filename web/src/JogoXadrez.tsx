import { Check, ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { EstadoXadrez, Partida } from './minijogos';

const RESOLVENDO_MS = 60_000;
const SOLUCAO_MS = 7_000;

/**
 * As peças são as letras do xadrez em Unicode — as cheias para os dois lados, pintadas pela cor (assim
 * branca e preta têm o mesmo desenho em qualquer fonte). O U+FE0E pede a forma de texto: sem ele, o
 * peão vira emoji em alguns sistemas.
 */
const DESENHO: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const peca = (letra: string) => `${DESENHO[letra.toLowerCase()]}︎`;
const nomeDaCasa = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;

/** "0:42": o tempo de quem acertou. */
const segundos = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}`;

/**
 * OS PROBLEMAS DE XADREZ DO LICHESS, EM CORRIDA (ver server/src/minijogo-xadrez.ts). Cada um resolve no seu
 * tabuleiro, virado para a cor de quem joga: clica na peça, depois na casa. Um lance errado encerra a
 * tentativa; a resposta do adversário vem sozinha. No fim de cada problema, todo mundo vê a solução — e o
 * link para o problema no Lichess, para quem quiser estudar.
 */
export function JogoXadrez({
  estado,
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
  const [escolhida, setEscolhida] = useState<number | null>(null);

  if (estado.terminada) {
    return <Placar eu={eu} linhas={estado.placar.map((l) => ({ ...l, valor: String(l.pontos) }))} />;
  }

  const resolvendo = estado.fase === 'resolvendo' && estado.estado === 'resolvendo';
  const minha = (letra: string) => letra !== '' && (letra === letra.toUpperCase() ? 'w' : 'b') === estado.cor;
  // O tabuleiro fica virado para quem joga: com as pretas, a8 vai para baixo à direita.
  const ordem = Array.from({ length: 64 }, (_, i) => (estado.cor === 'w' ? i : 63 - i));
  const ultimo = estado.ultimo ? [estado.ultimo.slice(0, 2), estado.ultimo.slice(2, 4)] : [];

  const clicar = (i: number) => {
    if (!resolvendo) return;
    if (minha(estado.casas[i])) return setEscolhida(i === escolhida ? null : i);
    if (escolhida === null) return;
    const peao = estado.casas[escolhida].toLowerCase() === 'p';
    const ultimaFileira = Math.floor(i / 8) === (estado.cor === 'w' ? 0 : 7);
    agir({ tipo: 'lance', lance: `${nomeDaCasa(escolhida)}${nomeDaCasa(i)}${peao && ultimaFileira ? 'q' : ''}` });
    setEscolhida(null);
  };

  let situacao: string;
  if (estado.fase === 'solucao') situacao = t('A solução do problema.');
  else if (estado.estado === 'acertou') situacao = t('Acertou! Agora é torcer pelos outros.');
  else if (estado.estado === 'errou') situacao = t('Esse não era o lance. Espere a solução.');
  else situacao = estado.cor === 'w' ? t('Você joga com as brancas. Ache o melhor lance.') : t('Você joga com as pretas. Ache o melhor lance.');

  return (
    <div className="xadrez">
      <div className="xadrez-tabuleiro">
        {ordem.map((i) => {
          const letra = estado.casas[i];
          const clara = (Math.floor(i / 8) + (i % 8)) % 2 === 0;
          const classes = [
            'xadrez-casa',
            clara ? 'clara' : 'escura',
            ultimo.includes(nomeDaCasa(i)) && 'ultimo',
            escolhida === i && 'escolhida',
            resolvendo && minha(letra) && 'minha',
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
      <p className={`minijogo-situacao${resolvendo ? ' minha-vez' : ''}`} role="status">
        {situacao}
      </p>
      <ul className="xadrez-jogadores">
        {estado.jogadores.map((j) => (
          <li key={j.userId} className={`${j.estado}${j.userId === eu ? ' eu' : ''}`}>
            {j.estado === 'acertou' ? <Check size={14} aria-hidden="true" /> : j.estado === 'errou' ? <X size={14} aria-hidden="true" /> : <span className="xadrez-pensando">…</span>}
            {j.username}
            {j.tempoMs !== null && <span className="xadrez-tempo">{segundos(j.tempoMs)}</span>}
          </li>
        ))}
      </ul>
      <Relogio restante={restante} total={estado.fase === 'solucao' ? SOLUCAO_MS : RESOLVENDO_MS} />
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
