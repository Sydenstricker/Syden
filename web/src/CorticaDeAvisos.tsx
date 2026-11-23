import { Megaphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { nomeDeCanal } from './bidi';
import { idiomaAtual, useT } from './i18n';
import type { Message } from './types';

/** Um aviso, com de onde ele veio (a comunidade e o canal). */
type AvisoDoQuarto = Message & { communityId: number; comunidade: string; canal: string };

/**
 * A CORTIÇA DO QUARTO (23/11/2026, decisão dele: "um item no quarto associado aos avisos"). Os últimos avisos de todas as
 * comunidades da pessoa, dos canais marcados como de avisos, do mais novo ao mais velho; clicar leva ao canal. A caixa de
 * ideias, que a cortiça abria, continua embaixo do quarto.
 */
export function CorticaDeAvisos({ aoFechar, aoAbrirCanal }: { aoFechar: () => void; aoAbrirCanal: (communityId: number, channelId: number) => void }) {
  const t = useT();
  const [avisos, setAvisos] = useState<AvisoDoQuarto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api<{ avisos: AvisoDoQuarto[] }>('/api/me/avisos')
      .then((r) => vivo && setAvisos(r.avisos))
      .catch((e) => vivo && setErro((e as Error).message));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="vila-painel cortica-de-avisos" role="dialog" aria-label={t('Avisos')}>
      <header>
        <h3>
          <Megaphone size={16} aria-hidden="true" /> {t('Avisos')}
        </h3>
        <button className="vila-painel-fechar" aria-label={t('Fechar')} onClick={aoFechar}>
          ✕
        </button>
      </header>
      {erro ? (
        <p className="vila-painel-vazio">{t(erro)}</p>
      ) : avisos === null ? null : avisos.length === 0 ? (
        <p className="vila-painel-vazio">{t('Nenhum aviso das suas comunidades por enquanto.')}</p>
      ) : (
        <ul>
          {avisos.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => {
                  aoFechar();
                  aoAbrirCanal(a.communityId, a.channelId);
                }}
              >
                <span className="cortica-aviso-onde">
                  {a.comunidade} · {nomeDeCanal(a.canal, true)} · <time dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleDateString(idiomaAtual())}</time>
                </span>
                <span className="cortica-aviso-texto">
                  <strong>{a.author.nomeDeExibicao || a.author.username}:</strong> {a.content || '📎'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
