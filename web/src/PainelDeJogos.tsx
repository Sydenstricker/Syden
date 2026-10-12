import { Gamepad2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useT } from './i18n';
import { JOGOS } from './minijogos';

interface LinhaDoJogo {
  jogo: string;
  partidas: number;
  completas: number;
  pessoas: number;
  mediaDeJogadores: number;
  comunidades: number;
  duracaoMedia: number | null;
  ultimaEm: string;
}

const JANELAS = [7, 30, 90] as const;

/** "12 min" ou "1 h 5 min": a duração média de uma partida que foi até o fim. */
function duracao(seg: number | null): string {
  if (!seg) return '—';
  const min = Math.max(1, Math.round(seg / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

/**
 * OS MINI-GAMES NO PAINEL DE USO (12/10/2026): qual jogo a turma realmente joga. Foi a recomendação ao fechar
 * a estante com oito jogos — medir antes de fazer o nono. Os jogos que ninguém jogou aparecem também, com
 * zero, porque "ninguém abriu" é exatamente o que esta tela existe para mostrar.
 *
 * Só CONTAGEM, como o resto do painel: o que cada um respondeu, desenhou ou votou mora na memória durante a
 * partida e não é guardado em lugar nenhum.
 */
export function PainelDeJogos() {
  const t = useT();
  const [dias, setDias] = useState<number>(30);
  const [linhas, setLinhas] = useState<LinhaDoJogo[] | null>(null);

  useEffect(() => {
    setLinhas(null);
    api<{ jogos: LinhaDoJogo[] }>(`/api/status/jogos?dias=${dias}`)
      .then((r) => setLinhas(r.jogos))
      .catch(() => setLinhas([]));
  }, [dias]);

  if (linhas === null) return null;

  const porJogo = new Map(linhas.map((l) => [l.jogo, l]));
  const todos = JOGOS.map((j) => ({ ...j, linha: porJogo.get(j.id) }))
    .sort((a, b) => (b.linha?.partidas ?? 0) - (a.linha?.partidas ?? 0));
  const partidas = linhas.reduce((s, l) => s + l.partidas, 0);
  const completas = linhas.reduce((s, l) => s + l.completas, 0);
  const nuncaJogados = todos.filter((j) => !j.linha).length;

  return (
    <section className="usage-card">
      <h3>
        <Gamepad2 size={16} aria-hidden="true" /> {t('Mini-games')}
      </h3>
      <p className="settings-hint">
        {t('Quais jogos a turma joga, com quantas pessoas e quantas partidas vão até o fim. Só contagem: respostas e desenhos não são guardados. Conta a partir de 12/10/2026.')}
      </p>

      <div className="comunidades-janela" role="group" aria-label={t('Período')}>
        {JANELAS.map((n) => (
          <button key={n} className={`chip${dias === n ? ' ativo' : ''}`} onClick={() => setDias(n)} aria-pressed={dias === n}>
            {t('{n} dias', { n })}
          </button>
        ))}
      </div>

      <div className="painel-numeros">
        <div>
          <strong>{partidas}</strong>
          <small>{t('Partidas')}</small>
        </div>
        <div>
          <strong>{partidas ? `${Math.round((completas / partidas) * 100)}%` : '—'}</strong>
          <small>{t('Até o placar final')}</small>
        </div>
        <div>
          <strong>{nuncaJogados}</strong>
          <small>{t('Jogos que ninguém jogou')}</small>
        </div>
      </div>

      <table className="comunidades-tabela">
        <thead>
          <tr>
            <th scope="col">{t('Jogo')}</th>
            <th scope="col">{t('Partidas')}</th>
            <th scope="col">{t('Até o fim')}</th>
            <th scope="col">{t('Pessoas')}</th>
            <th scope="col">{t('Por partida')}</th>
            <th scope="col">{t('Comunidades')}</th>
            <th scope="col">{t('Duração')}</th>
          </tr>
        </thead>
        <tbody>
          {todos.map(({ id, nome, linha }) => (
            <tr key={id} className={linha ? undefined : 'muda'}>
              <th scope="row">
                <strong>{t(nome)}</strong>
                {linha && <small>{t('última em {data}', { data: new Date(linha.ultimaEm).toLocaleDateString() })}</small>}
              </th>
              <td>{linha?.partidas ?? 0}</td>
              <td>{linha ? `${Math.round((linha.completas / linha.partidas) * 100)}%` : '—'}</td>
              <td>{linha?.pessoas ?? 0}</td>
              <td>{linha ? linha.mediaDeJogadores.toLocaleString() : '—'}</td>
              <td>{linha?.comunidades ?? 0}</td>
              <td>{duracao(linha?.duracaoMedia ?? null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
