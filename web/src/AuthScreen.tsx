import { Download, MonitorDown } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { api } from './api';
import { DESKTOP_DOWNLOAD_URL, showDesktopDownload } from './desktopDownload';
import { installApp, useCanInstall } from './install';
import { Logo } from './Logo';
import type { User } from './types';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (token: string, user: User) => void }) {
  const canInstall = useCanInstall();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
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
          <form className="auth-card" onSubmit={submit}>
            <h1>{mode === 'login' ? 'Bem-vindo de volta!' : 'Criar uma conta'}</h1>
            <p className="auth-subtitle">{mode === 'login' ? 'Que bom te ver de novo.' : 'Chame a galera e bora.'}</p>

            <label>
              Nome de usuário
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
            </label>
            <label>
              Senha
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
                Código de convite
                <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
                <span className="auth-hint">O código que um amigo te passou. Ele já te coloca na comunidade dele.</span>
              </label>
            )}

            {error && <p className="form-error">{error}</p>}

            <button className="btn-primary" disabled={busy}>
              {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>

            <p className="auth-switch">
              {mode === 'login' ? 'Precisa de uma conta? ' : 'Já tem uma conta? '}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError(null);
                }}
              >
                {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
              </button>
            </p>

            <p className="auth-legal">
              <a href="privacidade.html" target="_blank" rel="noreferrer">
                Privacidade
              </a>
              {' · '}
              <a href="termos.html" target="_blank" rel="noreferrer">
                Termos de uso
              </a>
            </p>

            {(canInstall || showDesktopDownload) && (
              <div className="auth-download">
                <span>Prefere usar como programa?</span>
                {canInstall && (
                  <button type="button" className="btn-secondary" onClick={() => void installApp()}>
                    <MonitorDown size={18} /> Instalar o Syden
                  </button>
                )}
                {showDesktopDownload && (
                  <a className="btn-secondary" href={DESKTOP_DOWNLOAD_URL}>
                    <Download size={18} /> Baixar para Windows
                  </a>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
