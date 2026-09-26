import { Download, MonitorDown } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { EscolherSenhaNova, EsqueciASenha } from './Recuperacao';
import { api } from './api';
import { DESKTOP_DOWNLOAD_URL, showDesktopDownload } from './desktopDownload';
import { installApp, useCanInstall } from './install';
import { useT } from './i18n';
import { Logo } from './Logo';
import type { User } from './types';

/** Lê o código do link de recuperação que veio no endereço e o tira da barra, para não ficar no histórico. */
function lerCodigoDaUrl(): string | null {
  const url = new URL(window.location.href);
  const codigo = url.searchParams.get('recuperar');
  if (!codigo) return null;
  url.searchParams.delete('recuperar');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return codigo;
}

export function AuthScreen({
  onAuthenticated,
  initialInviteCode,
}: {
  onAuthenticated: (token: string, user: User) => void;
  /** Veio de um link de convite (?convite=xxxx): já entra na tela de cadastro com o código preenchido. */
  initialInviteCode?: string | null;
}) {
  const t = useT();
  const canInstall = useCanInstall();
  const [mode, setMode] = useState<'login' | 'register'>(initialInviteCode ? 'register' : 'login');
  // Quem chega pelo link do e-mail vem com ?recuperar=CÓDIGO e cai direto na troca de senha.
  const [recuperacao, setRecuperacao] = useState<'nao' | 'pedindo' | string>(() => lerCodigoDaUrl() ?? 'nao');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ token: string; user: User }>(`/api/auth/${mode}`, {
        method: 'POST',
        body: { username, password, inviteCode },
        token: null,
      });
      onAuthenticated(result.token, result.user);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-column">
          <div className="auth-brand">
            <Logo size={64} />
            <span>Syden</span>
          </div>
          {recuperacao === 'pedindo' && <EsqueciASenha aoVoltar={() => setRecuperacao('nao')} />}
          {recuperacao !== 'nao' && recuperacao !== 'pedindo' && (
            <EscolherSenhaNova codigo={recuperacao} aoTerminar={() => setRecuperacao('nao')} />
          )}
          {recuperacao === 'nao' && (
          <form className="auth-card" onSubmit={submit}>
            <h1>{mode === 'login' ? t('Bem-vindo de volta!') : t('Criar uma conta')}</h1>
            <p className="auth-subtitle">{mode === 'login' ? t('Que bom te ver de novo.') : t('Chame a galera e bora.')}</p>

            <label>
              {t('Nome de usuário')}
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
            </label>
            <label>
              {t('Senha')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </label>
            {mode === 'register' && (
              <label>
                {t('Código de convite')}
                <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
                <span className="auth-hint">{t('O código que um amigo te passou. Ele já te coloca na comunidade dele.')}</span>
              </label>
            )}

            {error && <p className="form-error">{error}</p>}

            <button className="btn-primary" disabled={busy}>
              {busy ? t('Aguarde…') : mode === 'login' ? t('Entrar') : t('Cadastrar')}
            </button>

            {mode === 'login' && (
              <p className="auth-switch">
                <button type="button" className="link" onClick={() => setRecuperacao('pedindo')}>
                  {t('Esqueci a minha senha')}
                </button>
              </p>
            )}

            <p className="auth-switch">
              {mode === 'login' ? t('Precisa de uma conta? ') : t('Já tem uma conta? ')}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError(null);
                }}
              >
                {mode === 'login' ? t('Cadastre-se') : t('Entrar')}
              </button>
            </p>

            <p className="auth-legal">
              <a href="privacidade.html" target="_blank" rel="noreferrer">
                {t('Privacidade')}
              </a>
              {' · '}
              <a href="termos.html" target="_blank" rel="noreferrer">
                {t('Termos de uso')}
              </a>
            </p>

            {(canInstall || showDesktopDownload) && (
              <div className="auth-download">
                <span>{t('Prefere usar como programa?')}</span>
                {canInstall && (
                  <button type="button" className="btn-secondary" onClick={() => void installApp()}>
                    <MonitorDown size={18} /> {t('Instalar o Syden')}
                  </button>
                )}
                {showDesktopDownload && (
                  <a className="btn-secondary" href={DESKTOP_DOWNLOAD_URL}>
                    <Download size={18} /> {t('Baixar para Windows')}
                  </a>
                )}
              </div>
            )}
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
