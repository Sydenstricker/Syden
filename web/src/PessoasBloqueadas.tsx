import { useCallback, useEffect, useState } from 'react';
import { Ban } from 'lucide-react';
import { api } from './api';
import { Avatar } from './Avatar';
import { carregarBloqueios } from './bloqueios';
import { useT } from './i18n';

interface Bloqueado {
  userId: number;
  username: string;
  desde: string;
}

const quando = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'short' });

/**
 * As pessoas que você bloqueou.
 *
 * Esta tela não é enfeite: sem ela, bloquear seria uma porta de sentido único. O menu de uma pessoa
 * só aparece onde ela aparece — e quem foi bloqueado justamente sumiu das telas. Sem uma lista num
 * lugar fixo, desbloquear alguém viraria um quebra-cabeça.
 *
 * Só quem bloqueou vê esta lista. Não há nada aqui sobre quem bloqueou você, e isso é decisão: saber
 * quem te bloqueou não serve para nada além de alimentar um conflito.
 */
export function PessoasBloqueadas() {
  const t = useT();
  const [lista, setLista] = useState<Bloqueado[] | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const buscar = useCallback(async () => {
    try {
      setLista(await api<Bloqueado[]>('/api/me/bloqueios'));
    } catch {
      setLista([]);
    }
  }, []);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  if (lista === null) return null;

  const desbloquear = async (userId: number) => {
    setOcupado(true);
    try {
      await api(`/api/me/bloqueios/${userId}`, { method: 'DELETE' });
      await buscar();
      await carregarBloqueios();
    } catch {
      // Falhou: a lista continua como está.
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="settings-block">
      <h3>
        <Ban size={16} aria-hidden="true" /> {t('Pessoas bloqueadas')}
      </h3>
      <p className="settings-hint">
        {t('Quem está aqui não vê as suas mensagens nem você as dele, não consegue abrir conversa privada com você e não pode te mandar pedido de amizade.')}{' '}
        <strong>{t('Ninguém é avisado de que foi bloqueado.')}</strong>
      </p>

      {lista.length === 0 ? (
        <p className="settings-hint">{t('Você não bloqueou ninguém.')}</p>
      ) : (
        <ul className="amigos-lista">
          {lista.map((b) => (
            <li key={b.userId}>
              <Avatar name={b.username} userId={b.userId} size={36} />
              <span className="amigos-nome">
                {b.username}
                <small>bloqueada em {quando(b.desde)}</small>
              </span>
              <button className="btn-sutil" disabled={ocupado} onClick={() => void desbloquear(b.userId)}>
                {t('Desbloquear')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {lista.length > 0 && (
        <p className="settings-hint">
          Desbloquear reabre a conversa, mas <strong>não devolve a amizade</strong>: ela foi desfeita quando você
          bloqueou, e refazê-la é escolha das duas pessoas de novo.
        </p>
      )}
    </section>
  );
}
