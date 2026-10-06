import { useEffect, useState } from 'react';
import { esconderAbertura } from './abertura';
import { ApiError, api, loadToken, saveToken } from './api';
import { sincronizarAoEntrar } from './preferencias';
import { AuthScreen } from './AuthScreen';
import { AvisoGeral } from './AvisoGeral';
import { aoVoltarPeloApp, concluir, lerVolta, NOMES, RECADOS } from './entradaSocial';
import { DesktopTitleBar } from './DesktopTitleBar';
import { Shell } from './Shell';
import type { User } from './types';
import { esquecerLinkDaAula, guardarAulaEmCurso, lerLinkDaAula } from './aula';
import { EntradaNaAula } from './EntradaNaAula';

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

// O TEMPO MÍNIMO SAIU DAQUI e foi para web/src/abertura.ts, junto com a tela que ele segura.
//
// Ele existia para ninguém perder a animação do brasão num servidor rápido. Aquela animação não existe
// mais — é o coelho da abertura que espera agora, e o piso dele é contado desde o começo da página.
// Manter os dois somaria os tempos: dois segundos de coelho MAIS um segundo e meio de espera inventada.

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
  // O link da aula (?aula=…): sem conta, a porta é a EntradaNaAula; com conta, o Shell põe na sala.
  const [linkDaAula, setLinkDaAula] = useState(lerLinkDaAula);
  const [querUsarConta, setQuerUsarConta] = useState(false);
  // Confirmar o e-mail funciona estando logado ou não: o link pode ser aberto em qualquer navegador.
  const [confirmacao, setConfirmacao] = useState<{ ok: boolean; texto: string } | null>(null);
  const [codigoDeConfirmacao] = useState(lerConfirmacaoDaUrl);
  // A volta do Google/Discord. Lida UMA VEZ, no primeiro desenho, e já apagada da barra de endereço:
  // recarregar a página não pode tentar usar de novo um comprovante que já foi gasto.
  const [volta, setVolta] = useState(lerVolta);

  /**
   * No app, a volta do Google chega pela ponte, e não pela barra de endereço.
   *
   * Ela pode chegar A QUALQUER MOMENTO — inclusive minutos depois, porque a pessoa foi criar a conta
   * do Google no navegador enquanto o app ficou aberto esperando. Por isso é um estado que muda, e
   * não um valor lido uma vez no primeiro desenho como no navegador.
   */
  useEffect(() => aoVoltarPeloApp(setVolta), []);
  // A volta pode ser de três tipos: entrar, ligar um provedor numa conta que já existe, ou deu errado.
  const recadoDaVolta = volta && volta.situacao !== 'ok' && volta.situacao !== 'ligar' ? RECADOS[volta.situacao] : null;
  const [erroSocial, setErroSocial] = useState<string | null>(recadoDaVolta);
  // No navegador a volta é lida uma vez e o recado nasce com ela. No app ela chega depois, pela ponte,
  // e sem isto a pessoa que cancelasse no Google não veria explicação nenhuma — só a tela de entrada
  // de novo, como se o clique não tivesse acontecido.
  useEffect(() => {
    if (recadoDaVolta) setErroSocial(recadoDaVolta);
  }, [recadoDaVolta]);
  /** "Conta do GitHub ligada." — a janela de configurações já fechou quando a volta chega. */
  const [ligacaoFeita, setLigacaoFeita] = useState<string | null>(null);

  /**
   * A abertura sai quando o Syden tem o que mostrar — seja lá por qual caminho ele chegou lá.
   *
   * Num efeito sobre o estado, e não numa chamada em cada lugar que resolve a sessão: são três portas
   * (a sessão guardada, a volta do login social e quem não tem conta nenhuma), e uma chamada esquecida
   * em qualquer uma delas deixaria o coelho por cima do app até a pessoa recarregar. O estado é o único
   * ponto por onde as três passam.
   */
  useEffect(() => {
    if (session.status !== 'loading') esconderAbertura();
  }, [session.status]);

  useEffect(() => {
    if (!codigoDeConfirmacao) return;
    void api('/api/auth/confirmar-email', { method: 'POST', body: { codigo: codigoDeConfirmacao }, token: null }).then(
      () => setConfirmacao({ ok: true, texto: 'E-mail confirmado. Agora dá para recuperar a sua senha por ele.' }),
      (e) => setConfirmacao({ ok: false, texto: (e as Error).message }),
    );
  }, [codigoDeConfirmacao]);

  useEffect(() => {
    let cancelled = false;

    // Voltou do Google com um comprovante: troca por um token de verdade, apresentando o segredo que
    // ficou nesta aba. É esse par que impede que um link plantado por outra pessoa entre em alguma
    // conta (ver entradaSocial.ts). Falhando, cai na tela de entrada com o motivo escrito.
    /**
     * A VOLTA PELO ENDEREÇO É A REDE, e não mais o caminho principal no app.
     *
     * Dentro do app, quem conclui a entrada é o próprio app perguntando ao servidor (ver
     * entradaSocial.ts) — assim ninguém precisa abrir o aplicativo de fora, e o Windows não tem o que
     * perguntar. A volta por `syden://` continua valendo para quem usar o botão da página de volta.
     *
     * Chegando as duas, a segunda encontra a entrada já usada e mostraria "essa entrada não vale mais"
     * para alguém que acabou de entrar com sucesso. Com a sessão aberta, uma volta de ENTRAR não tem
     * mais o que fazer e é descartada. A de LIGAR não: ligar acontece justamente com a sessão aberta.
     */
    if (session.status === 'ready' && volta?.situacao === 'ok') return;

    const voltandoDoProvedor = (volta?.situacao === 'ok' || volta?.situacao === 'ligar') && volta.comprovante;
    if (voltandoDoProvedor) {
      void concluir(volta!.comprovante!)
        .then(async (resultado) => {
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

    void auth.then((result) => {
      if (cancelled) return;
      setSession(result);
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
        {/* Enquanto carrega não se desenha nada: quem está na tela é a abertura (web/index.html), e
            ela só sai quando esta espera acaba. Duas animações em fila para o mesmo ato de abrir o
            app faziam a segunda parecer que algo tinha recomeçado. */}
        {session.status === 'anonymous' && linkDaAula && !querUsarConta && (
          <EntradaNaAula
            token={linkDaAula}
            aoUsarConta={() => setQuerUsarConta(true)}
            aoEntrar={async ({ token, user, communityId, channelId }) => {
              saveToken(token);
              esquecerLinkDaAula();
              setLinkDaAula(null);
              guardarAulaEmCurso({ communityId, channelId });
              await sincronizarAoEntrar();
              setSession({ status: 'ready', token, user });
            }}
          />
        )}
        {session.status === 'anonymous' && (!linkDaAula || querUsarConta) && (
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
            linkDaAula={linkDaAula}
            aoUsarLinkDaAula={() => {
              esquecerLinkDaAula();
              setLinkDaAula(null);
            }}
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
