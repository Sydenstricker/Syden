import { useEffect, useState } from 'react';
import { ApiError, api, loadToken, saveToken } from './api';
import { AuthScreen } from './AuthScreen';
import { Shell } from './Shell';
import type { User } from './types';

type Session = { status: 'loading' } | { status: 'anonymous' } | { status: 'ready'; token: string; user: User };

export function App() {
  const [session, setSession] = useState<Session>(() => (loadToken() ? { status: 'loading' } : { status: 'anonymous' }));

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

  if (session.status === 'loading') return <div className="splash">Carregando…</div>;

  if (session.status === 'anonymous') {
    return (
      <AuthScreen
        onAuthenticated={(token, user) => {
          saveToken(token);
          setSession({ status: 'ready', token, user });
        }}
      />
    );
  }

  return (
    <Shell
      token={session.token}
      user={session.user}
      onLogout={() => {
        saveToken(null);
        setSession({ status: 'anonymous' });
      }}
    />
  );
}
