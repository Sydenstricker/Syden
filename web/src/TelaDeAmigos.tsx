import { nomeDe } from './directory';
import { useCallback, useEffect, useState } from 'react';
import { Check, UserPlus, UserX, X } from 'lucide-react';
import { ApiError, api } from './api';
import { Avatar } from './Avatar';
import { useT } from './i18n';

interface Amigo {
  userId: number;
  username: string;
  nomeDeExibicao?: string | null;
  avatarVersion: number | null;
  situacao: 'pendente' | 'aceita';
  euPedi: boolean;
  desde: string;
}

interface Sugestao {
  userId: number;
  username: string;
  nomeDeExibicao?: string | null;
  avatarVersion: number | null;
  emComum: number;
  /** Vocês já têm conversa privada: é o motivo mais forte, e vem escrito na tela. */
  jaConversaram: boolean;
}

/**
 * Por que esta pessoa apareceu.
 *
 * Dizer o motivo não é enfeite. Sem ele, uma lista de nomes parece o Syden entregando gente ao
 * acaso — e a primeira pergunta de quem olha é "por que esta pessoa está aqui?". Com o motivo
 * escrito, ela reconhece a ligação e decide com informação em vez de desconfiança.
 */
function porQue(s: Sugestao, t: ReturnType<typeof useT>): string {
  if (s.jaConversaram) return s.emComum > 0 ? t('vocês já conversam · mesma comunidade') : t('vocês já conversam');
  return s.emComum === 1 ? t('1 comunidade em comum') : t('{n} comunidades em comum', { n: s.emComum });
}

type Aba = 'amigos' | 'pedidos' | 'adicionar';

/**
 * A tela de amigos.
 *
 * Antes dela o Syden só tinha conversa privada, e para começar uma era preciso encontrar a pessoa numa
 * lista de membros. Não havia relação nenhuma guardada entre duas pessoas, então nada sobrevivia a
 * sair de uma comunidade.
 *
 * As três abas existem porque são três perguntas diferentes: **quem são meus amigos**, **quem está
 * esperando resposta** e **como acho mais gente**. Juntá-las numa lista só faria o pedido de alguém
 * ficar perdido no meio de nomes já conhecidos — e pedido que ninguém vê é pedido recusado na prática.
 */
export function TelaDeAmigos({ aoConversar }: { aoConversar?: (userId: number) => void }) {
  const t = useT();
  const [aba, setAba] = useState<Aba>('amigos');
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const dados = await api<{ amigos: Amigo[]; sugestoes: Sugestao[] }>('/api/amigos');
      setAmigos(dados.amigos);
      setSugestoes(dados.sugestoes);
    } catch {
      // Sem rede, a tela fica com o que já tinha em vez de esvaziar na cara de quem olha.
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);
  // pedido aceito, recusado ou desfeito do outro lado (Shell.tsx repassa o 'amigos:mudou')
  useEffect(() => {
    const aoMudar = () => void carregar();
    window.addEventListener('syden:amigos', aoMudar);
    return () => window.removeEventListener('syden:amigos', aoMudar);
  }, [carregar]);

  const aceitos = amigos.filter((a) => a.situacao === 'aceita');
  const recebidos = amigos.filter((a) => a.situacao === 'pendente' && !a.euPedi);
  const enviados = amigos.filter((a) => a.situacao === 'pendente' && a.euPedi);

  async function agir(fazer: () => Promise<unknown>, mensagem?: string) {
    setOcupado(true);
    setErro(null);
    try {
      await fazer();
      await carregar();
      if (mensagem) setAviso(mensagem);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : t('Não deu certo. Tente de novo.'));
    } finally {
      setOcupado(false);
    }
  }

  const pedir = (username: string) =>
    agir(() => api('/api/amigos', { method: 'POST', body: { username } }), t('Pedido enviado para {nome}.', { nome: username }));

  return (
    <div className="amigos">
      <header className="amigos-abas" role="tablist">
        {(
          [
            // (traduzidos desde a auditoria de 17/10/2026: estavam em português cravado)
            ['amigos', t('Amigos'), aceitos.length],
            ['pedidos', t('Pedidos'), recebidos.length],
            ['adicionar', t('Adicionar'), 0],
          ] as const
        ).map(([id, rotulo, quantos]) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            className={`tab${aba === id ? ' active' : ''}`}
            onClick={() => setAba(id)}
          >
            {rotulo}
            {/* O número só aparece quando há algo esperando: contador zerado é ruído. */}
            {quantos > 0 && <span className="amigos-selo">{quantos}</span>}
          </button>
        ))}
      </header>

      {erro && <p className="form-error">{erro}</p>}
      {aviso && (
        <p className="amigos-aviso" role="status">
          {aviso}
          <button type="button" className="link" onClick={() => setAviso(null)} aria-label={t('Fechar aviso')}>
            ✕
          </button>
        </p>
      )}

      {aba === 'amigos' && (
        <ul className="amigos-lista">
          {aceitos.map((a) => (
            <li key={a.userId}>
              <Avatar name={nomeDe(a)} userId={a.userId} size={36} />
              <span className="amigos-nome">{nomeDe(a)}</span>
              {aoConversar && (
                <button className="btn-sutil" onClick={() => aoConversar(a.userId)}>
                  {t('Conversar')}
                </button>
              )}
              <button
                className="btn-sutil perigo"
                disabled={ocupado}
                onClick={() => agir(() => api(`/api/amigos/${a.userId}`, { method: 'DELETE' }))}
                aria-label={t('Desfazer amizade com {nome}', { nome: nomeDe(a) })}
                title={t('Desfazer amizade')}
              >
                <UserX size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
          {aceitos.length === 0 && (
            <li className="amigos-vazio">
              {t('Você ainda não tem amigos no Syden. A aba')} <strong>{t('Adicionar')}</strong> {t('mostra quem divide comunidade com você.')}
            </li>
          )}
        </ul>
      )}

      {aba === 'pedidos' && (
        <>
          <h4 className="amigos-titulo">{t('Esperando você responder')}</h4>
          <ul className="amigos-lista">
            {recebidos.map((a) => (
              <li key={a.userId}>
                <Avatar name={nomeDe(a)} userId={a.userId} size={36} />
                <span className="amigos-nome">{nomeDe(a)}</span>
                <button
                  className="btn-sutil"
                  disabled={ocupado}
                  onClick={() => agir(() => api(`/api/amigos/${a.userId}/aceitar`, { method: 'POST' }))}
                >
                  <Check size={15} aria-hidden="true" /> {t('Aceitar')}
                </button>
                <button
                  className="btn-sutil perigo"
                  disabled={ocupado}
                  onClick={() => agir(() => api(`/api/amigos/${a.userId}`, { method: 'DELETE' }))}
                  aria-label={t('Recusar o pedido de {nome}', { nome: nomeDe(a) })}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
            {recebidos.length === 0 && <li className="amigos-vazio">{t('Nenhum pedido esperando.')}</li>}
          </ul>

          <h4 className="amigos-titulo">{t('Pedidos que você enviou')}</h4>
          <ul className="amigos-lista">
            {enviados.map((a) => (
              <li key={a.userId}>
                <Avatar name={nomeDe(a)} userId={a.userId} size={36} />
                <span className="amigos-nome">{nomeDe(a)}</span>
                <small className="amigos-esperando">{t('esperando resposta')}</small>
                <button
                  className="btn-sutil perigo"
                  disabled={ocupado}
                  onClick={() => agir(() => api(`/api/amigos/${a.userId}`, { method: 'DELETE' }))}
                  aria-label={t('Cancelar o pedido para {nome}', { nome: nomeDe(a) })}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
            {enviados.length === 0 && <li className="amigos-vazio">{t('Você não enviou nenhum pedido.')}</li>}
          </ul>
        </>
      )}

      {aba === 'adicionar' && (
        <>
          <form
            className="amigos-busca"
            onSubmit={(e) => {
              e.preventDefault();
              const alvo = nome.trim();
              if (!alvo) return;
              void pedir(alvo).then(() => setNome(''));
            }}
          >
            <label htmlFor="amigos-nome">{t('Nome de usuário')}</label>
            <div>
              <input
                id="amigos-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={t('o nome exato da pessoa')}
                autoComplete="off"
              />
              <button type="submit" disabled={ocupado || !nome.trim()}>
                <UserPlus size={15} aria-hidden="true" /> {t('Enviar pedido')}
              </button>
            </div>
            {/* Dito de frente, porque a alternativa é a pessoa achar que o Syden está quebrado: a
                busca é por nome exato de propósito. Uma busca parcial deixaria qualquer um listar as
                contas do Syden digitando letra por letra. */}
            <small>
              {t('Precisa ser o nome exato — o Syden não lista contas por pedaços de nome, para ninguém conseguir descobrir quem existe aqui dentro.')}
            </small>
          </form>

          <h4 className="amigos-titulo">{t('Pessoas das suas comunidades')}</h4>
          <ul className="amigos-lista">
            {sugestoes.map((s) => (
              <li key={s.userId}>
                <Avatar name={nomeDe(s)} userId={s.userId} size={36} />
                <span className="amigos-nome">
                  {nomeDe(s)}
                  <small>{porQue(s, t)}</small>
                </span>
                <button className="btn-sutil" disabled={ocupado} onClick={() => pedir(s.username)}>
                  <UserPlus size={15} aria-hidden="true" /> {t('Adicionar')}
                </button>
              </li>
            ))}
            {sugestoes.length === 0 && (
              <li className="amigos-vazio">{t('Ninguém para sugerir por enquanto — entre numa comunidade para conhecer gente.')}</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
