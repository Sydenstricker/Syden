import { LogOut, Pencil, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { Avatar } from './Avatar';
import { ConfirmDialog } from './ConfirmDialog';
import { nomeDe, useDirectory } from './directory';
import { useT } from './i18n';
import type { DirectChannel } from './types';

type Aberto = 'adicionar' | 'renomear' | 'sair' | null;

/**
 * OS BOTÕES DA CONVERSA PRIVADA, no cabeçalho dela (auditoria de 17/10/2026: o servidor já sabia renomear o grupo,
 * chamar mais alguém e sair, e nenhuma tela usava). Chamar alguém vale em toda conversa: a de duas pessoas vira grupo
 * ao receber a terceira. Renomear e sair, só no grupo: a conversa de duas pessoas não tem nome, e "sair" dela seria
 * outra coisa ("quem vai pode voltar" vale para o grupo, de onde antes não havia saída).
 *
 * A lista muda sozinha pelo socket (direct:updated, direct:removed, em Shell.tsx): aqui só se pede ao servidor.
 */
export function AcoesDaConversa({ conversa, selfId }: { conversa: DirectChannel; selfId: number }) {
  const t = useT();
  const [aberto, setAberto] = useState<Aberto>(null);
  const grupo = conversa.members.length > 2;
  return (
    <div className="acoes-da-conversa">
      <button type="button" className="icon-plain" title={t('Adicionar pessoa')} aria-label={t('Adicionar pessoa')} onClick={() => setAberto('adicionar')}>
        <UserPlus size={18} />
      </button>
      {grupo && (
        <>
          <button type="button" className="icon-plain" title={t('Renomear grupo')} aria-label={t('Renomear grupo')} onClick={() => setAberto('renomear')}>
            <Pencil size={18} />
          </button>
          <button type="button" className="icon-plain" title={t('Sair do grupo')} aria-label={t('Sair do grupo')} onClick={() => setAberto('sair')}>
            <LogOut size={18} />
          </button>
        </>
      )}
      {aberto === 'adicionar' && <Adicionar conversa={conversa} selfId={selfId} aoFechar={() => setAberto(null)} />}
      {aberto === 'renomear' && <Renomear conversa={conversa} aoFechar={() => setAberto(null)} />}
      {aberto === 'sair' && <Sair conversa={conversa} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

/** Fecha no Esc, como os outros diálogos. */
function useEsc(aoFechar: () => void) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);
}

function Adicionar({ conversa, selfId, aoFechar }: { conversa: DirectChannel; selfId: number; aoFechar: () => void }) {
  const t = useT();
  const { members } = useDirectory();
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEsc(aoFechar);
  const dentro = new Set(conversa.members.map((m) => m.id));
  const pessoas = [...members.values()].filter((m) => m.id !== selfId && !dentro.has(m.id)).sort((a, b) => nomeDe(a).localeCompare(nomeDe(b)));

  async function chamar(userId: number) {
    setOcupado(userId);
    setErro(null);
    try {
      await api(`/api/direct/${conversa.id}/members`, { method: 'POST', body: { userId } });
      aoFechar();
    } catch (e) {
      setErro((e as Error).message);
      setOcupado(null);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="adicionar-titulo">
        <h2 id="adicionar-titulo">{t('Adicionar pessoa')}</h2>
        <div className="dialog-body">
          <div className="group-people">
            {pessoas.length === 0 && <p className="settings-hint">{t('Ninguém mais nesta comunidade ainda.')}</p>}
            {pessoas.map((pessoa) => (
              <button key={pessoa.id} className="group-person" disabled={ocupado !== null} onClick={() => void chamar(pessoa.id)}>
                <Avatar name={nomeDe(pessoa)} userId={pessoa.id} size={28} />
                <span className="group-person-name">{nomeDe(pessoa)}</span>
              </button>
            ))}
          </div>
        </div>
        {erro && <p className="form-error">{erro}</p>}
        <div className="dialog-actions">
          <button className="link-button" onClick={aoFechar}>
            {t('Cancelar')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Renomear({ conversa, aoFechar }: { conversa: DirectChannel; aoFechar: () => void }) {
  const t = useT();
  const [nome, setNome] = useState(conversa.name);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEsc(aoFechar);

  async function salvar() {
    setOcupado(true);
    setErro(null);
    try {
      await api(`/api/direct/${conversa.id}`, { method: 'PATCH', body: { name: nome.trim() } });
      aoFechar();
    } catch (e) {
      setErro((e as Error).message);
      setOcupado(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="renomear-titulo"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <h2 id="renomear-titulo">{t('Renomear grupo')}</h2>
        <label>
          {t('Nome do grupo')}
          <input value={nome} maxLength={50} autoFocus placeholder={t('Ex.: Time do Valorant')} onChange={(e) => setNome(e.target.value)} />
        </label>
        {erro && <p className="form-error">{erro}</p>}
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={aoFechar}>
            {t('Cancelar')}
          </button>
          <button type="submit" className="btn-primary" disabled={!nome.trim() || ocupado}>
            {t('Salvar')}
          </button>
        </div>
      </form>
    </div>
  );
}

function Sair({ conversa, aoFechar }: { conversa: DirectChannel; aoFechar: () => void }) {
  const t = useT();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <ConfirmDialog
      title={t('Sair do grupo')}
      confirmLabel={t('Sair')}
      busy={ocupado}
      error={erro}
      onCancel={aoFechar}
      onConfirm={async () => {
        setOcupado(true);
        try {
          await api(`/api/direct/${conversa.id}/leave`, { method: 'POST' });
          aoFechar();
        } catch (e) {
          setErro((e as Error).message);
          setOcupado(false);
        }
      }}
    >
      {t('As mensagens do grupo deixam de chegar. Para voltar, alguém de dentro precisa chamar de novo.')}
    </ConfirmDialog>
  );
}
