import { Download, MonitorDown, Ticket } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { EscolherSenhaNova, EsqueciASenha } from './Recuperacao';
import { ConfirmeSeuEmail } from './ConfirmeSeuEmail';
import { AVISOS, entrarCom, NOMES, type Provedor } from './entradaSocial';
import { MarcaSocial } from './MarcasSociais';
import { Turnstile } from './Turnstile';
import { api, ApiError } from './api';
import { LINK_PRINCIPAL, PELA_STORE, showDesktopDownload } from './desktopDownload';
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
  const [inviteCode] = useState(initialInviteCode ?? '');
  const [email, setEmail] = useState('');
  /** Cadastrou e falta abrir o link: a tela sai do formulário e vira o aviso. */
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Este Syden aceita qualquer pessoa ou só quem foi convidado? Muda o que a tela pede.
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Quais provedores o servidor tem configurados. Sem chave, o botão nem aparece: um botão do Google
  // que leva a um erro é pior do que não ter botão nenhum.
  const [provedores, setProvedores] = useState<Provedor[]>([]);
  const [indoPara, setIndoPara] = useState<Provedor | null>(null);

  useEffect(() => {
    void api<{ cadastroAberto: boolean; turnstileSiteKey: string | null; social?: Provedor[] }>('/api/inicio', {
      token: null,
    })
      .then((inicio) => {
        setCadastroAberto(inicio.cadastroAberto);
        setTurnstileSiteKey(inicio.turnstileSiteKey);
        setProvedores(inicio.social ?? []);
      })
      .catch(() => {}); // servidor velho ou fora do ar: segue pedindo convite, que é o mais seguro
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ token?: string; user?: User; precisaConfirmar?: boolean }>(`/api/auth/${mode}`, {
        method: 'POST',
        body: { username, password, email, inviteCode, turnstile: turnstileToken },
        token: null,
      });
      // Cadastro não devolve mais sessão: devolve a tarefa de abrir o e-mail.
      if (result.precisaConfirmar || !result.token || !result.user) {
        setAguardandoConfirmacao(email || username);
        setBusy(false);
        return;
      }
      onAuthenticated(result.token, result.user);
    } catch (e) {
      // Entrar sem ter confirmado não é erro de senha: é a mesma tarefa pendente, e a tela leva para lá
      // em vez de repetir "usuário ou senha incorretos", que mandaria a pessoa procurar no lugar errado.
      if (e instanceof ApiError && e.status === 403 && (e.corpo as { precisaConfirmar?: boolean })?.precisaConfirmar) {
        setAguardandoConfirmacao(username);
        setBusy(false);
        return;
      }
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
          {aguardandoConfirmacao !== null && (
            <ConfirmeSeuEmail
              paraOndeFoi={aguardandoConfirmacao}
              username={username}
              aoVoltar={() => {
                setAguardandoConfirmacao(null);
                setMode('login');
              }}
            />
          )}
          {aguardandoConfirmacao === null && recuperacao === 'nao' && (
          <form className="auth-card" onSubmit={submit}>
            <h1>{mode === 'login' ? t('Bem-vindo de volta!') : t('Criar uma conta')}</h1>
            <p className="auth-subtitle">{mode === 'login' ? t('Que bom te ver de novo.') : t('Chame a galera e bora.')}</p>

            {provedores.length > 0 && (
              <>
                <div className="auth-social">
                  {provedores.map((provedor) => (
                    <span key={provedor} className="auth-social-item">
                    <button
                      type="button"
                      className="btn-secondary auth-social-botao"
                      disabled={indoPara !== null}
                      onClick={() => {
                        setIndoPara(provedor);
                        setError(null);
                        // Dando certo, a página sai do ar antes de o then rodar. O catch é para o
                        // caso de o servidor recusar: aí a pessoa continua aqui e precisa saber.
                        void entrarCom(provedor).catch((e) => {
                          setError((e as Error).message);
                          setIndoPara(null);
                        });
                      }}
                    >
                      <span className="auth-social-conteudo">
                        <MarcaSocial provedor={provedor} size={20} />
                        <span>{indoPara === provedor ? t('Abrindo…') : `Entrar com ${NOMES[provedor]}`}</span>
                      </span>
                    </button>
                    {AVISOS[provedor] && <small className="auth-social-aviso">{AVISOS[provedor]}</small>}
                    </span>
                  ))}
                </div>
                <div className="auth-ou">
                  <span>{t('ou')}</span>
                </div>
              </>
            )}

            <label>
              {t('Nome de usuário')}
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
            </label>
            {mode === 'register' && (
              <label>
                {t('E-mail')}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <span className="auth-hint">
                  {t('Mandamos um link para confirmar. É por ele que você recupera a senha, se um dia esquecer.')}
                </span>
              </label>
            )}
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
            {/*
              Quem chegou por um link de convite não vê campo nenhum: o código já veio no endereço, e
              pedir que a pessoa confira um código que ela não digitou é atrito à toa. O campo só aparece
              para quem digitou o endereço do Syden na mão — e aí ele é mesmo necessário, porque é o que
              separa "fui convidado" de "achei o site".
            */}
            {/*
              O CAMPO DE CÓDIGO SAIU DAQUI, e o código não sumiu: ele continua chegando pelo LINK de
              convite (?convite=…), que é como as pessoas de fato compartilham, e continua podendo ser
              digitado DENTRO do app, em "Adicionar comunidade". Tirar da porta de entrada deixa o
              cadastro com três campos em vez de quatro, e nenhum deles opcional — que é o que faz uma
              tela de cadastro parecer séria.
            */}
            {mode === 'register' && initialInviteCode && (
              <p className="auth-convidado">
                <Ticket size={16} aria-hidden="true" />
                {t('Você foi convidado. É só escolher um nome, um e-mail e uma senha.')}
              </p>
            )}

            {/* Só existe se o servidor tiver chave configurada. Na maioria das vezes resolve sozinho. */}
            {mode === 'register' && turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} aoResolver={setTurnstileToken} />}

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
                  <a className="btn-secondary" href={LINK_PRINCIPAL}>
                    <Download size={18} /> {PELA_STORE ? t('Baixar na Microsoft Store') : t('Baixar para Windows')}
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
