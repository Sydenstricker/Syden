import { useEffect, useState } from 'react';
import { ApiError, api, loadToken, saveToken } from './api';
import { AuthScreen } from './AuthScreen';
import { DesktopTitleBar } from './DesktopTitleBar';
import { Logo } from './Logo';
import { Shell } from './Shell';
import type { User } from './types';

type Session = { status: 'loading' } | { status: 'anonymous' } | { status: 'ready'; token: string; user: User };

/** Código de convite que veio num link (?convite=xxxx), lido uma única vez e tirado da URL. */
function readInviteFromUrl(): string | null {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('convite');
  if (!code) return null;
  url.searchParams.delete('convite');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return code;
}

export function App() {
  const [session, setSession] = useState<Session>(() => (loadToken() ? { status: 'loading' } : { status: 'anonymous' }));
  const [inviteCode] = useState(readInviteFromUrl);

  useEffect(() => {
    const token = loadToken();
    if (!token) return;
    api<User>('/api/me', { token })
      .then((user) => setSession({ status: 'ready', token, user }))
      .catch((error) => {
        // Só descarta o token se o servidor recusou; se estiver fora do ar, tenta de novo ao recarregar.
        if (error instanceof ApiError && error.status === 401) saveToken(null);
        setSession({ status: 'anonymous' });
      });
  }, []);

  return (
    <>
      <DesktopTitleBar />
      <div className="app-body">
        {session.status === 'loading' && (
          <div className="splash">
            <Logo size={72} className="splash-logo" />
          </div>
        )}
        {session.status === 'anonymous' && (
          <AuthScreen
            initialInviteCode={inviteCode}
            onAuthenticated={(token, user) => {
              saveToken(token);
              setSession({ status: 'ready', token, user });
            }}
          />
        )}
        {session.status === 'ready' && (
          <Shell
            token={session.token}
            user={session.user}
            pendingInviteCode={inviteCode}
            onLogout={() => {
              saveToken(null);
              setSession({ status: 'anonymous' });
            }}
          />
        )}
      </div>
    </>
  );
}
