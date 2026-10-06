import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useT } from './i18n';
import type { Community } from './types';

// OS COMANDOS PERSONALIZADOS, nas configurações da comunidade (só para quem administra). Alguém escreve
// "!regras" e o Syden responde no canal com o texto cadastrado. Ver server/src/comandos-routes.ts.

interface Comando {
  id: number;
  nome: string;
  resposta: string;
}

export function ComandosSection({ community }: { community: Community }) {
  const t = useT();
  const [comandos, setComandos] = useState<Comando[]>([]);
  const [nome, setNome] = useState('');
  const [resposta, setResposta] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Comando[]>(`/api/communities/${community.id}/comandos`).then(setComandos, () => setComandos([]));
  }, [community.id]);

  async function salvar() {
    setErro(null);
    try {
      const salvo = await api<Comando>(`/api/communities/${community.id}/comandos`, { method: 'PUT', body: { nome, resposta } });
      setComandos((lista) => [...lista.filter((c) => c.id !== salvo.id), salvo].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNome('');
      setResposta('');
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function apagar(comando: Comando) {
    setErro(null);
    try {
      await api(`/api/communities/${community.id}/comandos/${comando.id}`, { method: 'DELETE' });
      setComandos((lista) => lista.filter((c) => c.id !== comando.id));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <>
      <h2>{t('Comandos')}</h2>
      <p className="settings-lead">
        {t('Alguém escreve o comando no começo de uma mensagem, como !regras, e o Syden responde no canal com o texto que você cadastrar. Use {pessoa} para o nome de quem pediu e {comunidade} para o nome da comunidade.')}
      </p>

      {comandos.length > 0 && (
        <ul className="comandos-lista">
          {comandos.map((comando) => (
            <li key={comando.id}>
              <div className="comandos-cabeca">
                <code>!{comando.nome}</code>
                <button
                  type="button"
                  className="icon-plain expression-delete"
                  aria-label={t('Apagar o comando {comando}', { comando: comando.nome })}
                  onClick={() => void apagar(comando)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {/* Clicar na resposta traz o comando para o formulário: editar é salvar de novo com o mesmo nome. */}
              <button
                type="button"
                className="comandos-resposta"
                title={t('Editar')}
                onClick={() => {
                  setNome(comando.nome);
                  setResposta(comando.resposta);
                }}
              >
                {comando.resposta}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>{nome && comandos.some((c) => c.nome === nome.replace(/^!/, '').toLowerCase()) ? t('Editar comando') : t('Novo comando')}</h3>
      <form
        className="settings-card comandos-form"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <label className="comandos-nome">
          <span aria-hidden="true">!</span>
          <input value={nome} maxLength={21} placeholder={t('regras')} aria-label={t('Nome do comando')} onChange={(e) => setNome(e.target.value)} />
        </label>
        <textarea
          className="moderacao-palavras"
          rows={4}
          maxLength={2000}
          value={resposta}
          placeholder={t('O que o Syden responde')}
          aria-label={t('Resposta do comando')}
          onChange={(e) => setResposta(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={!nome.trim() || !resposta.trim()}>
          {t('Salvar comando')}
        </button>
      </form>
      {erro && <p className="form-error">{erro}</p>}
    </>
  );
}
