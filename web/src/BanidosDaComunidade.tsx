import { UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { Avatar } from './Avatar';
import { idiomaAtual, useT } from './i18n';

interface Banido {
  id: number;
  username: string;
  nomeDeExibicao: string | null;
  por: string | null;
  em: string;
}

/**
 * QUEM FOI BANIDO DA COMUNIDADE (23/11/2026; ver server/src/banidos-routes.ts), em Configurações → Membros, só para quem
 * administra. Banir tira a pessoa e impede que ela volte por qualquer convite; desbanir só libera a volta (ela não entra
 * sozinha: precisa de um convite de novo).
 */
export function BanidosDaComunidade({ communityId }: { communityId: number }) {
  const t = useT();
  const [lista, setLista] = useState<Banido[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const idioma = idiomaAtual();

  useEffect(() => {
    api<Banido[]>(`/api/communities/${communityId}/banidos`).then(setLista, (e) => setErro((e as Error).message));
  }, [communityId]);

  async function desbanir(b: Banido) {
    setErro(null);
    try {
      await api(`/api/communities/${communityId}/banidos/${b.id}`, { method: 'DELETE' });
      setLista((l) => l?.filter((x) => x.id !== b.id) ?? l);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <>
      <h3>{t('Pessoas banidas')}</h3>
      {erro && <p className="form-error">{erro}</p>}
      {lista && lista.length === 0 && <p className="settings-hint">{t('Ninguém foi banido desta comunidade.')}</p>}
      <div className="expression-list">
        {lista?.map((b) => {
          const nome = b.nomeDeExibicao ?? b.username;
          return (
            <div key={b.id} className="expression-row">
              <Avatar name={nome} userId={b.id} size={32} />
              <span className="expression-name">{nome}</span>
              <span className="expression-author">
                {b.por
                  ? t('Por {pessoa}, em {data}', { pessoa: b.por, data: new Date(b.em).toLocaleDateString(idioma) })
                  : new Date(b.em).toLocaleDateString(idioma)}
              </span>
              <button className="icon-plain expression-play" title={t('Desbanir {pessoa}', { pessoa: nome })} aria-label={t('Desbanir {pessoa}', { pessoa: nome })} onClick={() => void desbanir(b)}>
                <UserCheck size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
