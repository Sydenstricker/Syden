import { Eraser } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { EstadoSudoku, Partida } from './minijogos';

const SUDOKU_MS = 20 * 60_000;

/** "4:07": o tempo de quem terminou. */
const minutos = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * O SUDOKU EM CORRIDA (ver server/src/minijogo-sudoku.ts): o tabuleiro é o mesmo para todo mundo, cada um
 * resolve o seu, e embaixo a sala vê a barra de cada um subindo. Escolhe-se a casa e depois o número —
 * pelos botões ou pelo teclado (números, setas, Apagar).
 */
export function JogoSudoku({
  estado,
  eu,
  restante,
  agir,
}: {
  estado: EstadoSudoku & Partida;
  eu: number;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const [casa, setCasa] = useState<number | null>(null);
  const tabuleiro = estado.meu ?? estado.enigma;
  const minha = estado.corrida.find((l) => l.userId === eu);
  const terminei = minha?.tempoMs !== null && minha?.tempoMs !== undefined;

  if (estado.terminada) {
    return (
      <Placar
        eu={eu}
        linhas={estado.corrida.map((l) => ({
          userId: l.userId,
          username: l.username,
          valor: l.tempoMs !== null ? minutos(l.tempoMs) : `${l.certas}/${estado.total}`,
        }))}
      />
    );
  }

  const por = (valor: number) => {
    if (casa === null || estado.enigma[casa] !== 0 || terminei) return;
    agir({ tipo: 'jogada', casa, valor });
  };

  const teclado = (e: KeyboardEvent) => {
    if (/^[1-9]$/.test(e.key)) por(Number(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') por(0);
    else {
      const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key];
      if (passo === undefined) return;
      e.preventDefault();
      setCasa((atual) => Math.min(80, Math.max(0, (atual ?? 40) + passo)));
    }
  };

  const destaque = casa !== null ? tabuleiro[casa] : 0;
  return (
    <div className="sudoku">
      <div className="sudoku-grade" role="grid" tabIndex={0} onKeyDown={teclado}>
        {tabuleiro.map((n, i) => {
          const dada = estado.enigma[i] !== 0;
          const classes = [
            'sudoku-casa',
            dada && 'dada',
            estado.errados.includes(i) && 'errada',
            casa === i && 'escolhida',
            casa !== null && i !== casa && n !== 0 && n === destaque && 'mesmo',
            i % 9 === 2 || i % 9 === 5 ? 'borda-direita' : '',
            Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? 'borda-baixo' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button key={i} type="button" role="gridcell" className={classes} tabIndex={-1} onClick={() => setCasa(i)}>
              {n || ''}
            </button>
          );
        })}
      </div>
      <div className="sudoku-numeros">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} type="button" disabled={terminei} onClick={() => por(n)}>
            {n}
          </button>
        ))}
        <button type="button" disabled={terminei} aria-label={t('Apagar')} onClick={() => por(0)}>
          <Eraser size={16} />
        </button>
      </div>
      {terminei && <p className="minijogo-situacao">{t('Você terminou! Agora é torcer pelos outros.')}</p>}
      <ul className="sudoku-corrida">
        {estado.corrida.map((l) => (
          <li key={l.userId} className={l.userId === eu ? 'eu' : ''}>
            <span className="minijogo-nome">{l.username}</span>
            <span className="sudoku-barra" aria-hidden="true">
              <span style={{ width: `${(l.certas / estado.total) * 100}%` }} />
            </span>
            <span className="sudoku-numero">
              {l.tempoMs !== null ? `✓ ${minutos(l.tempoMs)}` : `${l.certas}/${estado.total}`}
              {l.erros > 0 && <span className="sudoku-erros"> · ✕{l.erros}</span>}
            </span>
          </li>
        ))}
      </ul>
      <Relogio restante={restante} total={SUDOKU_MS} />
    </div>
  );
}
