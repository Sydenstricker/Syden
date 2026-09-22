import { useEffect, useState } from 'react';
import { ApiError, api, loadToken, saveToken } from './api';
import { AuthScreen } from './AuthScreen';
import { DesktopTitleBar } from './DesktopTitleBar';
import { Shell } from './Shell';
import { SplashLogo } from './SplashLogo';
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

// Tempo mínimo do splash ao abrir o app: sem isso, num servidor rápido a checagem da sessão termina antes
// da animação (~1,3s) acabar de tocar, e ninguém chega a ver o coelho se formar.
const SPLASH_MIN_MS = 1400;

export function App() {
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const [inviteCode] = useState(readInviteFromUrl);

  useEffect(() => {
    let cancelled = false;
    const minWait = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS));
    const token = loadToken();
    const auth = token
      ? api<User>('/api/me', { token }).then(
          (user): Session => ({ status: 'ready', token, user }),
          (error): Session => {
            // Só descarta o token se o servidor recusou; se estiver fora do ar, tenta de novo ao recarregar.
            if (error instanceof ApiError && error.status === 401) saveToken(null);
            return { status: 'anonymous' };
          },
        )
      : Promise.resolve<Session>({ status: 'anonymous' });

    // Sem token nenhum, não há o que esperar do servidor: só o tempo mínimo do splash mesmo.
    Promise.all([auth, minWait]).then(([result]) => {
      if (!cancelled) setSession(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <DesktopTitleBar />
      <div className="app-body">
        {session.status === 'loading' && (
          <div className="splash">
            <SplashLogo size={88} />
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
