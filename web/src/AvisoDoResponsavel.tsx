import { useEffect, useState } from 'react';
import { api } from './api';
import type { MinhaProtecao } from './protecao';
import { useT } from './i18n';

/**
 * De 13 a 15 anos, sem responsável ainda: o aviso no alto, com o prazo (depois dele, a conta para; ver protecao.ts).
 * Não é um alarme: é o lembrete de uma tarefa com data, e o caminho para fazê-la.
 */
export function AvisoDoResponsavel() {
  const t = useT();
  const [prazo, setPrazo] = useState<string | null>(null);
  useEffect(() => {
    const ler = () => api<MinhaProtecao>('/api/me/protecao').then((eu) => setPrazo(eu.prazoResponsavel), () => {});
    void ler();
    window.addEventListener('syden:protecao', ler);
    return () => window.removeEventListener('syden:protecao', ler);
  }, []);
  if (!prazo) return null;
  return (
    <p className="aviso-topo" role="status">
      {t('Ligue a sua conta a um responsável até {data}, em Configurações → Família.', {
        data: new Date(prazo).toLocaleDateString(undefined, { dateStyle: 'short' }),
      })}
    </p>
  );
}
