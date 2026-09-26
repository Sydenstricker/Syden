import { type FormEvent, useState } from 'react';
import { api } from './api';
import { useT } from './i18n';

/**
 * As duas telas de recuperação de senha, que vivem dentro da tela de entrada.
 *
 * "Esqueci a senha" nunca diz se a conta existe: a resposta é a mesma para um endereço cadastrado e para
 * um endereço que ninguém usa. Se dissesse, qualquer pessoa descobriria quem tem conta no Syden só
 * digitando endereços. O servidor faz a mesma coisa do lado de lá.
 */

/** Passo 1: pedir o link. */
export function EsqueciASenha({ aoVoltar }: { aoVoltar: () => void }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [pedido, setPedido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      await api('/api/auth/esqueci', { method: 'POST', body: { email }, token: null });
      setPedido(true);
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(false);
  }

  if (pedido) {
    return (
      <div className="auth-card">
        <h1>{t('Olhe o seu e-mail')}</h1>
        <p className="auth-subtitle">
          {t('Se existir uma conta com esse endereço, o link para escolher uma senha nova chegou lá. Ele vale por 1 hora.')}
        </p>
        <p className="settings-hint">{t('Não chegou? Veja também a caixa de spam.')}</p>
        <button type="button" className="btn-primary" onClick={aoVoltar}>
          {t('Voltar')}
        </button>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={enviar}>
      <h1>{t('Esqueceu a senha?')}</h1>
      <p className="auth-subtitle">{t('Diga o e-mail da sua conta e mandamos um link para escolher outra.')}</p>
      <label>
        {t('E-mail')}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
      </label>
      {erro && <p className="form-error">{erro}</p>}
      <button className="btn-primary" disabled={ocupado}>
        {ocupado ? t('Aguarde…') : t('Mandar o link')}
      </button>
      <p className="auth-switch">
        <button type="button" className="link" onClick={aoVoltar}>
          {t('Voltar para a entrada')}
        </button>
      </p>
    </form>
  );
}

/** Passo 2: chegou pelo link do e-mail (?recuperar=CÓDIGO) e escolhe a senha nova. */
export function EscolherSenhaNova({ codigo, aoTerminar }: { codigo: string; aoTerminar: () => void }) {
  const t = useT();
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function trocar(evento: FormEvent) {
    evento.preventDefault();
    if (senha !== confirma) return setErro(t('A confirmação não bate com a nova senha.'));
    setOcupado(true);
    setErro(null);
    try {
      await api('/api/auth/recuperar', { method: 'POST', body: { codigo, novaSenha: senha }, token: null });
      setPronto(true);
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(false);
  }

  if (pronto) {
    return (
      <div className="auth-card">
        <h1>{t('Senha trocada')}</h1>
        <p className="auth-subtitle">
          {t('Já pode entrar com a senha nova. Os aparelhos que estavam conectados foram desconectados, por segurança.')}
        </p>
        <button type="button" className="btn-primary" onClick={aoTerminar}>
          {t('Entrar')}
        </button>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={trocar}>
      <h1>{t('Escolha uma senha nova')}</h1>
      <label>
        {t('Nova senha')}
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          required
          autoFocus
        />
      </label>
      <label>
        {t('Confirmar nova senha')}
        <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" required />
      </label>
      {erro && <p className="form-error">{erro}</p>}
      <button className="btn-primary" disabled={ocupado}>
        {ocupado ? t('Aguarde…') : t('Salvar e entrar')}
      </button>
      <p className="auth-switch">
        <button type="button" className="link" onClick={aoTerminar}>
          {t('Cancelar')}
        </button>
      </p>
    </form>
  );
}
