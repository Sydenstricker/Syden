import { Ticket as TicketIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useT } from './i18n';
import type { Community, DirectChannel } from './types';

// OS TICKETS (pacote MEE6, 12/10/2026; ver server/src/tickets-routes.ts). Um pedido a quem administra vira uma
// conversa privada em grupo, chamada "Ticket: assunto". Aqui moram as duas pontas: a seção das configurações (quem
// administra liga, vê e encerra) e o formulário de abrir (no início da comunidade).

export interface Ticket {
  id: number;
  channelId: number;
  abertoPorNome: string | null;
  assunto: string;
  abertoEm: string;
  fechadoEm: string | null;
  fechadoPorNome: string | null;
}

const dia = (iso: string) => new Date(iso).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function TicketsSection({ community }: { community: Community }) {
  const t = useT();
  const [ligados, setLigados] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<{ ligados: boolean; tickets: Ticket[] }>(`/api/communities/${community.id}/tickets`).then(
      (r) => {
        setLigados(r.ligados);
        setTickets(r.tickets);
      },
      () => {},
    );
  }, [community.id]);

  async function ligar(valor: boolean) {
    setErro(null);
    setLigados(valor);
    try {
      const r = await api<{ ligados: boolean }>(`/api/communities/${community.id}/tickets/ligados`, { method: 'PUT', body: { ligados: valor } });
      setLigados(r.ligados);
    } catch (e) {
      setLigados(!valor);
      setErro((e as Error).message);
    }
  }

  async function encerrar(ticket: Ticket) {
    setErro(null);
    try {
      const r = await api<{ ticket: Ticket }>(`/api/communities/${community.id}/tickets/${ticket.id}/encerrar`, { method: 'POST' });
      setTickets((lista) => lista.map((x) => (x.id === ticket.id ? r.ticket : x)));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const abertos = tickets.filter((x) => !x.fechadoEm);
  const encerrados = tickets.filter((x) => x.fechadoEm);

  return (
    <>
      <h2>{t('Tickets')}</h2>
      <p className="settings-lead">
        {t('Quem precisa falar com a administração abre um ticket no início da comunidade, com um assunto. Ele vira uma conversa privada em grupo entre essa pessoa e quem administra, e aparece na lista de conversas de vocês.')}
      </p>
      <div className="settings-card">
        <label className="cargo-separado">
          <input type="checkbox" checked={ligados} onChange={(e) => void ligar(e.target.checked)} />
          {t('Deixar os membros abrirem tickets')}
        </label>
      </div>

      <h3>{t('Abertos')}</h3>
      {abertos.length === 0 ? (
        <p className="settings-hint">{t('Nenhum ticket aberto.')}</p>
      ) : (
        <ul className="tickets-lista">
          {abertos.map((ticket) => (
            <li key={ticket.id}>
              <TicketIcon size={16} aria-hidden="true" />
              <div>
                <strong>{ticket.assunto}</strong>
                <small>
                  {t('aberto por {nome} em {data}', { nome: ticket.abertoPorNome ?? '?', data: dia(ticket.abertoEm) })}
                </small>
              </div>
              <button type="button" className="btn-secondary" onClick={() => void encerrar(ticket)}>
                {t('Encerrar')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {encerrados.length > 0 && (
        <>
          <h3>{t('Encerrados')}</h3>
          <ul className="tickets-lista encerrados">
            {encerrados.slice(0, 30).map((ticket) => (
              <li key={ticket.id}>
                <TicketIcon size={16} aria-hidden="true" />
                <div>
                  <strong>{ticket.assunto}</strong>
                  <small>
                    {t('encerrado por {nome} em {data}', { nome: ticket.fechadoPorNome ?? '?', data: dia(ticket.fechadoEm!) })}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {erro && <p className="form-error">{erro}</p>}
    </>
  );
}

/** O que vai para a conversa nova: a tela de conversas a abre. */
interface AoAbrir {
  (conversa: DirectChannel): void;
}

/**
 * Abrir um ticket, no início da comunidade: uma linha com o assunto e o botão. Só aparece quando a comunidade
 * liga os tickets — perguntar ao servidor é o que diz isso.
 */
export function AbrirTicket({ community, aoAbrir }: { community: Community; aoAbrir: AoAbrir }) {
  const t = useT();
  const [ligados, setLigados] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<{ ligados: boolean }>(`/api/communities/${community.id}/tickets`).then(
      (r) => setLigados(r.ligados),
      () => setLigados(false),
    );
  }, [community.id]);

  if (!ligados) return null;
  if (!aberto) {
    return (
      <button type="button" className="bv-atalho" onClick={() => setAberto(true)}>
        <TicketIcon size={16} />
        <span>{t('Falar com a administração')}</span>
      </button>
    );
  }
  return (
    <form
      className="ticket-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        try {
          const r = await api<{ conversa: DirectChannel }>(`/api/communities/${community.id}/tickets`, { method: 'POST', body: { assunto } });
          aoAbrir(r.conversa);
        } catch (falha) {
          setErro((falha as Error).message);
        }
      }}
    >
      <input
        autoFocus
        value={assunto}
        maxLength={40}
        placeholder={t('Assunto, em poucas palavras')}
        aria-label={t('Assunto do ticket')}
        onChange={(e) => setAssunto(e.target.value)}
      />
      <button type="submit" className="btn-primary" disabled={!assunto.trim()}>
        {t('Abrir ticket')}
      </button>
      <button type="button" className="btn-secondary" onClick={() => setAberto(false)}>
        {t('Cancelar')}
      </button>
      {erro && <p className="form-error">{erro}</p>}
    </form>
  );
}
