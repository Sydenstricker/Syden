import { useEffect, useState } from 'react';
import { useT } from './i18n';

export interface DadosDoPacote {
  name: string;
  description: string;
  icon: string;
}

/**
 * EDITAR O NOME, A DESCRIÇÃO E O ÍCONE DE UM PACOTE, de som ou de emoji (auditoria de 17/10/2026: o servidor já
 * aceitava, e quem montou o pacote não tinha como corrigir um erro de digitação). Os mesmos campos e limites da
 * criação; quem chama decide para onde vai (PackCatalog, EmojiPackCatalog).
 */
export function EditarPacote({
  inicial,
  maxDescricao,
  salvar,
  aoFechar,
}: {
  inicial: DadosDoPacote;
  maxDescricao: number;
  salvar(dados: DadosDoPacote): Promise<void>;
  aoFechar: () => void;
}) {
  const t = useT();
  const [dados, setDados] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);
  const mudar = (campo: keyof DadosDoPacote) => (e: React.ChangeEvent<HTMLInputElement>) => setDados({ ...dados, [campo]: e.target.value });

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-pacote-titulo"
        onSubmit={async (e) => {
          e.preventDefault();
          setOcupado(true);
          setErro(null);
          try {
            await salvar({ name: dados.name.trim(), description: dados.description.trim(), icon: dados.icon.trim() || inicial.icon });
            aoFechar();
          } catch (falha) {
            setErro((falha as Error).message);
            setOcupado(false);
          }
        }}
      >
        <h2 id="editar-pacote-titulo">{t('Editar pacote')}</h2>
        <div className="upload-row">
          <label className="settings-field icon-field">
            {t('Ícone')}
            <input value={dados.icon} onChange={mudar('icon')} maxLength={8} />
          </label>
          <label className="settings-field">
            {t('Nome do pacote')}
            <input value={dados.name} onChange={mudar('name')} maxLength={32} autoFocus />
          </label>
        </div>
        <label className="settings-field">
          {t('Descrição')}
          <input value={dados.description} onChange={mudar('description')} placeholder={t('O que tem dentro do pacote')} maxLength={maxDescricao} />
        </label>
        {erro && <p className="form-error">{erro}</p>}
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={aoFechar}>
            {t('Cancelar')}
          </button>
          <button type="submit" className="btn-primary" disabled={dados.name.trim().length < 2 || ocupado}>
            {t('Salvar')}
          </button>
        </div>
      </form>
    </div>
  );
}
