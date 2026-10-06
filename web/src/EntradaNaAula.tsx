import { useEffect, useState } from 'react';
import { ApiError, api } from './api';
import { useT } from './i18n';
import { Mascote } from './Mascote';
import { Turnstile } from './Turnstile';
import type { User } from './types';

/**
 * A porta de quem chega pelo LINK DA AULA sem conta (ver aula.ts e server/src/aula-routes.ts).
 *
 * Pensada para quem não é de tecnologia: uma pergunta só — o nome — e um botão. Nada de e-mail, senha,
 * convite ou escolher comunidade. A conta que nasce aqui vale só até o link vencer, e a tela diz isso
 * com todas as letras: prometer acesso e tirá-lo calado seria mentir para quem entra.
 *
 * Quem tem conta não precisa disto: "Já tenho conta" leva à entrada de sempre, e o mesmo link põe a
 * pessoa na sala depois do login.
 */
export function EntradaNaAula({
  token,
  aoEntrar,
  aoUsarConta,
}: {
  token: string;
  aoEntrar: (sessao: { token: string; user: User; communityId: number; channelId: number }) => void;
  aoUsarConta: () => void;
}) {
  const t = useT();
  const [aula, setAula] = useState<{ sala: string; comunidade: string } | null | 'invalida'>(null);
  const [nome, setNome] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [comprovante, setComprovante] = useState<string | null>(null);

  useEffect(() => {
    api<{ sala: string; comunidade: string }>(`/api/aula/${encodeURIComponent(token)}`, { token: null }).then(
      setAula,
      () => setAula('invalida'),
    );
    void api<{ turnstileSiteKey: string | null }>('/api/inicio', { token: null }).then(
      (inicio) => setSiteKey(inicio.turnstileSiteKey),
      () => {},
    );
  }, [token]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      const sessao = await api<{ token: string; user: User; communityId: number; channelId: number }>(
        `/api/aula/${encodeURIComponent(token)}/entrar`,
        { method: 'POST', token: null, body: { nome, turnstile: comprovante } },
      );
      aoEntrar(sessao);
    } catch (falha) {
      setErro(falha instanceof ApiError ? falha.message : t('Não deu para entrar agora. Tente de novo.'));
      setEntrando(false);
    }
  }

  return (
    <div className="entrada-aula">
      <Mascote nome={aula === 'invalida' ? 'erro-404' : 'introducao'} tamanho={220} />
      {aula === 'invalida' ? (
        <>
          <h1>{t('Este link de aula não vale mais')}</h1>
          <p>{t('Peça um link novo a quem dá a aula.')}</p>
        </>
      ) : (
        <form onSubmit={(e) => void entrar(e)}>
          {/* O nome da sala e da turma esperam carregar SEM afirmar nada no lugar (ver CLAUDE.md, "A tela
              não afirma o que não é"): até chegar, o título fica vazio, guardando a altura. */}
          <h1>{aula ? t('Aula de {sala}', { sala: aula.sala }) : ' '}</h1>
          <p className="entrada-aula-turma">{aula?.comunidade ?? ' '}</p>
          <label>
            {t('Seu nome')}
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} autoFocus required autoComplete="name" />
          </label>
          {siteKey && <Turnstile siteKey={siteKey} aoResolver={setComprovante} />}
          {erro && <p className="form-error">{erro}</p>}
          <button type="submit" className="btn-primary" disabled={entrando || !aula || nome.trim().length < 2}>
            {entrando ? t('Entrando…') : t('Entrar na aula')}
          </button>
          <p className="entrada-aula-miudo">{t('Você entra só para esta aula: o acesso some quando o link vencer.')}</p>
          <p className="entrada-aula-miudo">
            <a href="../termos.html" target="_blank" rel="noreferrer">
              {t('Ao entrar, você concorda com os termos de uso.')}
            </a>
          </p>
          <button type="button" className="link" onClick={aoUsarConta}>
            {t('Já tenho conta')}
          </button>
        </form>
      )}
    </div>
  );
}
