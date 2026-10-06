import { Headphones, Users, Wifi } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { useDirectory } from './directory';
import { chave, idiomaAtual, useT } from './i18n';
import type { Community, PresenceEntry, VoiceMember } from './types';

// OS CONTADORES (ver server/src/contadores-routes.ts): quem administra escolhe quais números aparecem no
// alto da lista de canais, e cada tela faz a conta com o que já sabe — ao vivo e na língua de quem lê.

type Contador = 'membros' | 'online' | 'em-chamada';

const ROTULOS: { id: Contador; rotulo: string; contagem: string; icone: ReactNode }[] = [
  { id: 'membros', rotulo: chave('Membros'), contagem: chave('Membros: {n}'), icone: <Users size={14} aria-hidden="true" /> },
  { id: 'online', rotulo: chave('Online agora'), contagem: chave('Online agora: {n}'), icone: <Wifi size={14} aria-hidden="true" /> },
  { id: 'em-chamada', rotulo: chave('Em chamada'), contagem: chave('Em chamada: {n}'), icone: <Headphones size={14} aria-hidden="true" /> },
];

const escolhidos = (community: Community) => (community.contadores ?? '').split(',').filter(Boolean) as Contador[];

/** A faixa no alto da lista de canais. Sem contador escolhido, não ocupa lugar nenhum. */
export function FaixaDeContadores({
  community,
  online,
  voiceMembers,
  selfId,
}: {
  community: Community;
  online: PresenceEntry[];
  voiceMembers: VoiceMember[];
  selfId: number;
}) {
  const t = useT();
  const { members } = useDirectory();
  const lista = escolhidos(community);
  if (lista.length === 0) return null;
  // "Invisível" conta como fora para todo mundo, menos para a própria pessoa — a mesma regra da lista
  // de membros, para os dois números nunca discordarem na mesma tela.
  const noAr = online.filter((p) => members.has(p.id) && (p.id === selfId || p.status !== 'invisivel')).length;
  const valores: Record<Contador, number> = {
    membros: members.size || community.memberCount || 0,
    online: noAr,
    'em-chamada': voiceMembers.filter((m) => m.communityId === community.id).length,
  };
  const numero = new Intl.NumberFormat(idiomaAtual());
  return (
    <ul className="faixa-de-contadores">
      {ROTULOS.filter((r) => lista.includes(r.id)).map((r) => (
        <li key={r.id} title={t(r.contagem, { n: numero.format(valores[r.id]) })}>
          {r.icone}
          <span className="so-para-leitor">{t(r.contagem, { n: numero.format(valores[r.id]) })}</span>
          <span aria-hidden="true">{numero.format(valores[r.id])}</span>
        </li>
      ))}
    </ul>
  );
}

/** As caixas de escolha, nas configurações da comunidade (só quem administra). */
export function ConfiguracaoDeContadores({ community }: { community: Community }) {
  const t = useT();
  // Marca NA HORA, sem esperar o servidor (a mesma armadilha do "separado" dos cargos).
  const [lista, setLista] = useState<Contador[]>(() => escolhidos(community));
  useEffect(() => setLista(escolhidos(community)), [community.contadores]); // eslint-disable-line react-hooks/exhaustive-deps
  const [erro, setErro] = useState<string | null>(null);

  async function alternar(id: Contador, quer: boolean) {
    const nova = quer ? [...lista, id] : lista.filter((c) => c !== id);
    setLista(nova);
    setErro(null);
    try {
      await api(`/api/communities/${community.id}/contadores`, { method: 'PUT', body: { lista: nova } });
    } catch (e) {
      setErro((e as Error).message);
      setLista(lista);
    }
  }

  return (
    <div className="settings-card">
      <p className="settings-hint">{t('Os números aparecem no alto da lista de canais, para todo mundo, e mudam sozinhos.')}</p>
      {ROTULOS.map((r) => (
        <label key={r.id} className="cargo-separado">
          <input type="checkbox" checked={lista.includes(r.id)} onChange={(e) => void alternar(r.id, e.target.checked)} />
          {r.icone} {t(r.rotulo)}
        </label>
      ))}
      {erro && <p className="form-error">{erro}</p>}
    </div>
  );
}
