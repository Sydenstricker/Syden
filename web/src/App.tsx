import { useEffect, useState } from 'react';
import { ApiError, api, loadToken, saveToken } from './api';
import { sincronizarAoEntrar } from './preferencias';
import { AuthScreen } from './AuthScreen';
import { AvisoGeral } from './AvisoGeral';
import { concluir, lerVolta, NOMES, RECADOS } from './entradaSocial';
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
const SPLASH_MIN_MS = 1600;

/** O código do link de confirmação de e-mail (?confirmar=...), lido uma vez e tirado da barra. */
function lerConfirmacaoDaUrl(): string | null {
  const url = new URL(window.location.href);
  const codigo = url.searchParams.get('confirmar');
  if (!codigo) return null;
  url.searchParams.delete('confirmar');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return codigo;
}

export function App() {
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const [inviteCode] = useState(readInviteFromUrl);
  // Confirmar o e-mail funciona estando logado ou não: o link pode ser aberto em qualquer navegador.
  const [confirmacao, setConfirmacao] = useState<{ ok: boolean; texto: string } | null>(null);
  const [codigoDeConfirmacao] = useState(lerConfirmacaoDaUrl);
  // A volta do Google/Discord. Lida UMA VEZ, no primeiro desenho, e já apagada da barra de endereço:
  // recarregar a página não pode tentar usar de novo um comprovante que já foi gasto.
  const [volta] = useState(lerVolta);
  // A volta pode ser de três tipos: entrar, ligar um provedor numa conta que já existe, ou deu errado.
  const recadoDaVolta = volta && volta.situacao !== 'ok' && volta.situacao !== 'ligar' ? RECADOS[volta.situacao] : null;
  const [erroSocial, setErroSocial] = useState<string | null>(recadoDaVolta);
  /** "Conta do GitHub ligada." — a janela de configurações já fechou quando a volta chega. */
  const [ligacaoFeita, setLigacaoFeita] = useState<string | null>(null);

  useEffect(() => {
    if (!codigoDeConfirmacao) return;
    void api('/api/auth/confirmar-email', { method: 'POST', body: { codigo: codigoDeConfirmacao }, token: null }).then(
      () => setConfirmacao({ ok: true, texto: 'E-mail confirmado. Agora dá para recuperar a sua senha por ele.' }),
      (e) => setConfirmacao({ ok: false, texto: (e as Error).message }),
    );
  }, [codigoDeConfirmacao]);

  useEffect(() => {
    let cancelled = false;
    const minWait = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS));

    // Voltou do Google com um comprovante: troca por um token de verdade, apresentando o segredo que
    // ficou nesta aba. É esse par que impede que um link plantado por outra pessoa entre em alguma
    // conta (ver entradaSocial.ts). Falhando, cai na tela de entrada com o motivo escrito.
    const voltandoDoProvedor = (volta?.situacao === 'ok' || volta?.situacao === 'ligar') && volta.comprovante;
    if (voltandoDoProvedor) {
      void Promise.all([concluir(volta!.comprovante!), minWait])
        .then(async ([resultado]) => {
          if (cancelled) return;
          // Ligação: a pessoa já estava dentro, então não há sessão nova. Só o aviso, e a sessão que
          // já existia segue o caminho normal logo abaixo.
          if (resultado.ligado) {
            setLigacaoFeita(NOMES[resultado.ligado]);
            return entrarComOTokenGuardado();
          }
          if (!resultado.token || !resultado.user) throw new Error('A resposta veio sem a sua conta. Tente de novo.');
          saveToken(resultado.token);
          await sincronizarAoEntrar();
          setSession({ status: 'ready', token: resultado.token, user: resultado.user });
        })
        .catch((e) => {
          if (cancelled) return;
          setErroSocial((e as Error).message);
          void entrarComOTokenGuardado();
        });
      return () => {
        cancelled = true;
      };
    }

    // Abrir a sessão que já estava guardada. É o caminho de sempre, e também para onde a ligação e o
    // erro caem depois — em nenhum dos dois a pessoa deve ser jogada para fora do que já estava aberto.
    async function entrarComOTokenGuardado() {
      const guardado = loadToken();
      if (!guardado) return setSession({ status: 'anonymous' });
      try {
        const user = await api<User>('/api/me', { token: guardado });
        await sincronizarAoEntrar();
        setSession({ status: 'ready', token: guardado, user });
      } catch {
        setSession({ status: 'anonymous' });
      }
    }

    const token = loadToken();
    const auth = token
      ? api<User>('/api/me', { token }).then(
          async (user): Promise<Session> => {
            // As preferências chegam ANTES de a tela montar. Aplicá-las depois faria o Syden abrir no
            // tema errado e trocar na cara de quem está olhando — e, pior, os componentes já teriam
            // lido o idioma antigo. O `await` custa um pedido, e é o que faz a troca de navegador
            // parecer que não houve troca nenhuma.
            await sincronizarAoEntrar();
            return { status: 'ready', token, user };
          },
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
  }, [volta]);

  return (
    <>
      <DesktopTitleBar minimal={session.status === 'loading'} />
      {/* Fica FORA do app-body de propósito: assim o recado aparece na tela de entrada também, que é
          onde ele mais faz falta — quem não consegue entrar é quem mais precisa saber do porquê. */}
      {session.status !== 'loading' && <AvisoGeral />}
      {ligacaoFeita && (
        <p className="aviso-topo" role="status">
          Conta do {ligacaoFeita} ligada. Agora dá para entrar por ela.
          <button type="button" className="link" onClick={() => setLigacaoFeita(null)} aria-label="Fechar aviso">
            ✕
          </button>
        </p>
      )}
      {erroSocial && (
        <p className="aviso-topo ruim" role="alert">
          {erroSocial}
          <button type="button" className="link" onClick={() => setErroSocial(null)} aria-label="Fechar aviso">
            ✕
          </button>
        </p>
      )}
      {confirmacao && (
        <p className={`aviso-topo${confirmacao.ok ? '' : ' ruim'}`} role="status">
          {confirmacao.texto}
          <button type="button" className="link" onClick={() => setConfirmacao(null)} aria-label="Fechar aviso">
            ✕
          </button>
        </p>
      )}
      <div className="app-body">
        {session.status === 'loading' && (
          <div className="splash">
            <SplashLogo />
          </div>
        )}
        {session.status === 'anonymous' && (
          <AuthScreen
            initialInviteCode={inviteCode}
            onAuthenticated={async (token, user) => {
              saveToken(token);
              // As preferências descem ANTES de a tela montar. Existem três portas de entrada no
              // Syden — esta, a volta do login social e a sessão já guardada — e todas passam por
              // uma chamada destas. Deixar uma de fora faria a sincronia funcionar em alguns dias e
              // em outros não, que é o pior comportamento possível para quem tenta entender.
              await sincronizarAoEntrar();
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
