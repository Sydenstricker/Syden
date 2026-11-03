import { Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useT } from './i18n';
import { tempoLegivel } from './corrida/fisica';
import { nomeDaPistaEm } from './corrida/nomes';

/**
 * OS TROFÉUS DA CORRIDA, no quarto de quem ganhou (03/11/2026, decisão dele: "um registro do momento entre amigos"). Cada
 * troféu é um pódio de verdade, de uma corrida ou de uma Copa da Cenoura na sala, com 2 pessoas ou mais: a posição, a
 * pista, o tempo (na copa, a soma, e os pontos), quando, e contra quem. Os nomes são os de agora; quem excluiu a conta
 * aparece só como "Conta excluída" (o servidor não guarda o nome dela: server/src/db.ts, corrida_trofeus).
 */

interface Trofeu {
  id: number;
  pista: string;
  posicao: number;
  tempoMs: number | null;
  pontos: number | null;
  em: string;
  rivais: { userId: number; username: string; nomeDeExibicao: string | null }[];
  excluidos: number;
}

const MEDALHA = ['', '🥇', '🥈', '🥉'];

export function TrofeusDaCorrida({ aoFechar }: { aoFechar: () => void }) {
  const t = useT();
  const [trofeus, setTrofeus] = useState<Trofeu[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api<{ trofeus: Trofeu[] }>('/api/corrida-trofeus')
      .then((r) => vivo && setTrofeus(r.trofeus))
      .catch((e: Error) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  const data = new Intl.DateTimeFormat(document.documentElement.lang || undefined, { dateStyle: 'medium' });
  const contraQuem = (tr: Trofeu) => {
    const nomes = tr.rivais.map((r) => r.nomeDeExibicao || r.username);
    for (let i = 0; i < tr.excluidos; i++) nomes.push(t('Conta excluída'));
    return new Intl.ListFormat(document.documentElement.lang || undefined, { type: 'conjunction' }).format(nomes);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog conquistas trofeus" role="dialog" aria-modal="true" aria-labelledby="trofeus-titulo">
        <div className="conquistas-topo">
          <h2 id="trofeus-titulo">
            <Trophy size={18} aria-hidden="true" /> {t('Troféus')}
          </h2>
          <button type="button" className="icon-plain" onClick={aoFechar} aria-label={t('Fechar')} title={t('Fechar')} autoFocus>
            <X size={18} />
          </button>
        </div>
        {erro && <p className="form-error">{erro}</p>}
        {trofeus && trofeus.length === 0 && (
          <p className="settings-hint">{t('Nenhum troféu ainda. Fique no pódio de uma corrida na sala, com a turma.')}</p>
        )}
        {trofeus && trofeus.length > 0 && (
          <ul className="trofeus-lista">
            {trofeus.map((tr) => (
              <li key={tr.id}>
                <span className="trofeu-medalha" aria-hidden="true">
                  {MEDALHA[tr.posicao] ?? tr.posicao}
                </span>
                <div>
                  <strong>{nomeDaPistaEm(t, tr.pista)}</strong>
                  <span className="trofeu-detalhe">
                    {tr.tempoMs !== null && <span className="corrida-relogio">{tempoLegivel(tr.tempoMs)}</span>}
                    {tr.pontos !== null && <span>{t('Placar')}: {tr.pontos}</span>}
                    <span>{data.format(new Date(tr.em))}</span>
                  </span>
                  <span className="trofeu-rivais">{t('contra {nomes}', { nomes: contraQuem(tr) })}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
