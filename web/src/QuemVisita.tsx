import { useEffect, useState } from 'react';
import { api } from './api';
import { useT } from './i18n';

/**
 * Configurações → Minha conta: QUEM ENTRA NO SEU QUARTO (03/11/2026, decisão dele, como o perfil da Steam). Público,
 * amigos (o de fábrica) ou privado; no privado, nem os amigos entram, só quem a pessoa convidar — e é aqui que ela
 * convida, da lista de amigos. As regras moram no servidor (server/src/trofeus-routes.ts): antes dos 18, o público não
 * existe.
 */
type Modo = 'publico' | 'amigos' | 'privado';
interface Pessoa {
  id: number;
  username: string;
  nomeDeExibicao: string | null;
}

export function QuemVisita() {
  const t = useT();
  const [modo, setModo] = useState<Modo | null>(null);
  const [menor, setMenor] = useState(false);
  const [convidados, setConvidados] = useState<Set<number>>(new Set());
  const [amigos, setAmigos] = useState<Pessoa[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api<{ modo: Modo; menor: boolean; convidados: Pessoa[] }>('/api/quarto-acesso')
      .then((r) => {
        if (!vivo) return;
        setModo(r.modo);
        setMenor(r.menor);
        setConvidados(new Set(r.convidados.map((c) => c.id)));
      })
      .catch((e: Error) => vivo && setErro(e.message));
    api<{ amigos: { userId: number; username: string; nomeDeExibicao: string | null; situacao: string }[] }>('/api/amigos')
      .then((r) => vivo && setAmigos(r.amigos.filter((a) => a.situacao === 'aceita').map((a) => ({ id: a.userId, username: a.username, nomeDeExibicao: a.nomeDeExibicao }))))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const escolher = (novo: Modo) => {
    const antes = modo;
    setModo(novo);
    setErro(null);
    api('/api/quarto-acesso', { method: 'PUT', body: { modo: novo } }).catch((e: Error) => {
      setModo(antes);
      setErro(e.message);
    });
  };

  const convidar = (id: number, sim: boolean) => {
    const antes = convidados;
    const novo = new Set(antes);
    if (sim) novo.add(id);
    else novo.delete(id);
    setConvidados(novo);
    setErro(null);
    api(`/api/quarto-acesso/convidados/${id}`, { method: sim ? 'POST' : 'DELETE' }).catch((e: Error) => {
      setConvidados(antes);
      setErro(e.message);
    });
  };

  if (!modo) return erro ? <p className="form-error">{erro}</p> : null;
  return (
    <>
      <h3>{t('Quem visita o seu quarto')}</h3>
      <div className="settings-card quem-visita">
        <select className="moderacao-tempo" value={modo} aria-label={t('Quem visita o seu quarto')} onChange={(e) => escolher(e.target.value as Modo)}>
          {!menor && <option value="publico">{t('Todo mundo')}</option>}
          <option value="amigos">{t('Seus amigos')}</option>
          <option value="privado">{t('Só quem você convidar')}</option>
        </select>
        <p className="settings-hint">
          {modo === 'publico' && t('Qualquer conta pode entrar e ver os troféus em destaque.')}
          {modo === 'amigos' && t('Seus amigos podem entrar e ver os troféus em destaque.')}
          {modo === 'privado' && t('Nem os amigos entram, só quem você marcar aqui.')}
        </p>
        {modo === 'privado' &&
          (amigos.length === 0 ? (
            <p className="settings-hint">{t('Você ainda não tem amigos para convidar.')}</p>
          ) : (
            <ul className="quem-visita-lista">
              {amigos.map((a) => (
                <li key={a.id}>
                  <label>
                    <input type="checkbox" checked={convidados.has(a.id)} onChange={(e) => convidar(a.id, e.target.checked)} />
                    {a.nomeDeExibicao || a.username}
                  </label>
                </li>
              ))}
            </ul>
          ))}
        {erro && <p className="form-error">{erro}</p>}
      </div>
    </>
  );
}
