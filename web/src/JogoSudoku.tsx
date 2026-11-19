import { CheckCheck, Eraser, Pencil, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import type { EstadoSudoku, Partida } from './minijogos';
import { tocar } from './somDosJogos';
import './jogosDePalavras.css';

const SUDOKU_MS = 20 * 60_000;

/** O que o servidor de 19/11/2026 manda a mais (servidor antigo não manda: tudo opcional). */
type EstadoSudokuNovo = EstadoSudoku & {
  dificuldade?: 'facil' | 'medio' | 'dificil' | 'extremo';
  conferencia?: 'hora' | 'fim';
  penalidadeMs?: number;
  recorde?: { antes: number | null; novo: boolean; valor: number | null } | null;
};

/** "4:07": o tempo de quem terminou. */
const minutos = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const linha = (i: number) => Math.floor(i / 9);
const coluna = (i: number) => i % 9;
const bloco = (i: number) => Math.floor(linha(i) / 3) * 3 + Math.floor(coluna(i) / 3);
const vizinhas = (a: number, b: number) => linha(a) === linha(b) || coluna(a) === coluna(b) || bloco(a) === bloco(b);

/**
 * O SUDOKU EM CORRIDA (ver server/src/minijogo-sudoku.ts): o tabuleiro é o mesmo para todo mundo, cada um
 * resolve o seu, e embaixo a sala vê a barra de cada um subindo. Escolhe-se a casa e depois o número —
 * pelos botões ou pelo teclado (números, setas, Apagar).
 *
 * DESDE 19/11/2026: o LÁPIS (as anotações pequenas, só nesta tela: o servidor não as vê), o destaque da linha, da coluna, do
 * bloco e do mesmo número, o Desfazer (manda de volta o número que estava), e o "Conferir" quando a partida é de conferir no fim.
 */
export function JogoSudoku({
  estado: estadoBase,
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
  const estado = estadoBase as EstadoSudokuNovo & Partida;
  const [casa, setCasa] = useState<number | null>(null);
  const [lapis, setLapis] = useState(false);
  const [notas, setNotas] = useState<Record<number, number[]>>({});
  const [historico, setHistorico] = useState<{ casa: number; antes: number }[]>([]);
  const tabuleiro = estado.meu ?? estado.enigma;
  const minha = estado.corrida.find((l) => l.userId === eu);
  const terminei = minha?.tempoMs !== null && minha?.tempoMs !== undefined;
  const noFim = estado.conferencia === 'fim';
  const cheio = tabuleiro.every((n) => n !== 0);

  // Partida nova: as anotações e o histórico são de outro tabuleiro.
  const chaveDoEnigma = estado.enigma.join('');
  useEffect(() => {
    setNotas({});
    setHistorico([]);
    setCasa(null);
  }, [chaveDoEnigma]);

  // OS SONS (19/11/2026): encaixe no número certo, erro no errado, e o fim de quem terminou (a medalha no recorde).
  const antes = useRef({ certas: minha?.certas ?? 0, erros: minha?.erros ?? 0, terminei, novo: !!estado.recorde?.novo });
  useEffect(() => {
    const a = antes.current;
    const certas = minha?.certas ?? 0;
    const erros = minha?.erros ?? 0;
    const novo = !!estado.recorde?.novo;
    if (novo && !a.novo) tocar('medalha');
    else if (terminei && !a.terminei) tocar('acerto');
    else if (erros > a.erros) tocar('erro');
    else if (certas > a.certas && !noFim) tocar('encaixe');
    antes.current = { certas, erros, terminei, novo };
  }, [minha?.certas, minha?.erros, terminei, estado.recorde?.novo, noFim]);

  if (estado.terminada) {
    return (
      <>
        <Placar
          eu={eu}
          linhas={estado.corrida.map((l) => ({
            userId: l.userId,
            username: l.username,
            valor: l.tempoMs !== null ? minutos(l.tempoMs) : `${l.certas}/${estado.total}`,
          }))}
        />
        <Recorde recorde={estado.recorde} />
      </>
    );
  }

  const por = (valor: number) => {
    if (casa === null || estado.enigma[casa] !== 0 || terminei) return;
    if (lapis && valor !== 0) {
      if (tabuleiro[casa] !== 0) return;
      tocar('clique');
      setNotas((n) => {
        const atual = n[casa] ?? [];
        return { ...n, [casa]: atual.includes(valor) ? atual.filter((x) => x !== valor) : [...atual, valor].sort() };
      });
      return;
    }
    if (tabuleiro[casa] === valor) return;
    setHistorico((h) => [...h.slice(-200), { casa, antes: tabuleiro[casa] }]);
    // O número posto tira a mesma anotação das casas que o veem (e as da própria casa).
    if (valor !== 0) {
      setNotas((n) => {
        const nova: Record<number, number[]> = {};
        for (const [k, lista] of Object.entries(n)) {
          const i = Number(k);
          if (i === casa) continue;
          nova[i] = vizinhas(i, casa) ? lista.filter((x) => x !== valor) : lista;
        }
        return nova;
      });
    }
    agir({ tipo: 'jogada', casa, valor });
  };

  const desfazer = () => {
    const ultimo = historico[historico.length - 1];
    if (!ultimo || terminei) return;
    setHistorico((h) => h.slice(0, -1));
    setCasa(ultimo.casa);
    agir({ tipo: 'jogada', casa: ultimo.casa, valor: ultimo.antes });
  };

  const teclado = (e: KeyboardEvent) => {
    if (/^[1-9]$/.test(e.key)) por(Number(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') por(0);
    else if (e.key === 'p' || e.key === 'P') setLapis((l) => !l);
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      desfazer();
    } else {
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
          const minhasNotas = n === 0 ? (notas[i] ?? []) : [];
          const classes = [
            'sudoku-casa',
            dada && 'dada',
            estado.errados.includes(i) && 'errada',
            casa === i && 'escolhida',
            casa !== null && i !== casa && n !== 0 && n === destaque && 'mesmo',
            casa !== null && i !== casa && vizinhas(i, casa) && 'vizinha',
            i % 9 === 2 || i % 9 === 5 ? 'borda-direita' : '',
            Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? 'borda-baixo' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button key={i} type="button" role="gridcell" className={classes} tabIndex={-1} onClick={() => setCasa(i)}>
              {n ? (
                n
              ) : minhasNotas.length > 0 ? (
                <span className="sudoku-notas" aria-hidden="true">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <span key={d} className={destaque === d ? 'mesmo' : undefined}>
                      {minhasNotas.includes(d) ? d : ''}
                    </span>
                  ))}
                </span>
              ) : (
                ''
              )}
            </button>
          );
        })}
      </div>
      <div className="sudoku-numeros">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} type="button" disabled={terminei} className={lapis ? 'lapis' : undefined} onClick={() => por(n)}>
            {n}
          </button>
        ))}
        <button type="button" disabled={terminei} aria-label={t('Apagar')} title={t('Apagar')} onClick={() => por(0)}>
          <Eraser size={16} />
        </button>
      </div>
      <div className="sudoku-ferramentas">
        <button
          type="button"
          className={`icon-plain${lapis ? ' ligado' : ''}`}
          aria-pressed={lapis}
          aria-label={t('Lápis')}
          title={t('Lápis')}
          disabled={terminei}
          onClick={() => setLapis((l) => !l)}
        >
          <Pencil size={16} />
        </button>
        <button type="button" className="icon-plain" aria-label={t('Desfazer')} title={t('Desfazer')} disabled={terminei || historico.length === 0} onClick={desfazer}>
          <Undo2 size={16} />
        </button>
        {noFim && !terminei && (
          <button type="button" className="btn-primary" disabled={!cheio} title={cheio ? undefined : t('Preencha todas as casas antes de conferir.')} onClick={() => agir({ tipo: 'conferir' })}>
            <CheckCheck size={16} aria-hidden="true" /> {t('Conferir')}
          </button>
        )}
        {(estado.penalidadeMs ?? 0) > 0 && <span className="sudoku-penalidade">+{minutos(estado.penalidadeMs ?? 0)}</span>}
      </div>
      {terminei && <p className="minijogo-situacao">{t('Você terminou! Agora é torcer pelos outros.')}</p>}
      {terminei && <Recorde recorde={estado.recorde} />}
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

/** O recorde do Solo (o tempo que o servidor mediu, com as penalidades). */
function Recorde({ recorde }: { recorde: EstadoSudokuNovo['recorde'] }) {
  const t = useT();
  if (!recorde) return null;
  if (recorde.novo && recorde.valor !== null) return <p className="minijogo-recorde novo">🏅 {t('Novo recorde!')} {minutos(recorde.valor)}</p>;
  if (recorde.antes !== null) return <p className="minijogo-recorde">{t('Seu recorde: {tempo}', { tempo: minutos(recorde.antes) })}</p>;
  return null;
}
