import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from './api';

interface Linha {
  id: number;
  at: string;
  actorName: string;
  action: string;
  target: string | null;
  communityId: number | null;
  detail: string | null;
}

/**
 * Como cada ação é contada em português. O banco guarda um código curto e estável (`conta.excluida`);
 * a frase fica aqui, no app, para dar para melhorar o texto sem mexer no que já está registrado.
 */
const FRASE: Record<string, (l: Linha) => string> = {
  'moderacao.mensagem': (l) => `apagou uma mensagem de outra pessoa (${l.target ?? 'sem detalhe'})`,
  'conta.excluida': (l) => `excluiu a conta de ${l.target}`,
  'membro.removido': (l) => `removeu ${l.target} da comunidade`,
  'admin.dado': (l) => `deu cargo de administrador a ${l.target}`,
  'admin.tirado': (l) => `tirou o cargo de administrador de ${l.target}`,
  'denuncia.resolvida': (l) => `resolveu a denúncia ${l.target}`,
};

/** Ações que mexem com o poder de alguém sobre os outros aparecem destacadas. */
const GRAVE = new Set(['conta.excluida', 'admin.dado', 'admin.tirado']);

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * O registro de quem fez o quê. Existe para uma pergunta específica: quando alguém reclamar de uma
 * mensagem apagada ou de uma conta removida, é aqui que está a resposta — com nome e hora.
 */
export function PainelAuditoria() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Linha[]>('/api/audit')
      .then(setLinhas)
      .catch((e) => setErro((e as Error).message));
  }, []);

  if (erro) return <p className="form-error">{erro}</p>;
  if (!linhas) return null;

  return (
    <section className="usage-card">
      <h3>
        <ScrollText size={16} aria-hidden="true" /> Registro de moderação
      </h3>
      {linhas.length === 0 ? (
        <p className="settings-hint">Nada registrado ainda. Só aparecem aqui as ações com poder sobre os outros.</p>
      ) : (
        <>
          <p className="settings-hint">
            As {linhas.length} ações mais recentes. Guardam o nome por extenso, para continuarem legíveis mesmo depois de
            a conta sumir.
          </p>
          <ul className="auditoria-lista">
            {linhas.map((l) => (
              <li key={l.id} className={`auditoria-linha${GRAVE.has(l.action) ? ' grave' : ''}`}>
                <time dateTime={l.at}>{quando(l.at)}</time>
                <span>
                  <strong>{l.actorName}</strong> {FRASE[l.action]?.(l) ?? `${l.action} ${l.target ?? ''}`}
                  {l.detail && <small>{l.detail}</small>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
