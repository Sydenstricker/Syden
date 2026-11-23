import { Link, LogIn, Plus, SlidersHorizontal } from 'lucide-react';
import { type FormEvent, type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { CommunityIcon } from './CommunityIcon';
import { ConfigurarConvite } from './ConfigurarConvite';
import { useT } from './i18n';
import { Logo } from './Logo';
import type { Community } from './types';

interface Props {
  communities: Community[];
  currentId: number | null;
  onSelect: (id: number) => void;
  onChanged: (community: Community) => void;
  /** Botão extra acima das comunidades (as conversas privadas ficam aqui). */
  top?: ReactNode;
  /** O logo no alto abre a tela inicial. */
  onHome: () => void;
  homeActive: boolean;
}

export function CommunityRail({ communities, currentId, onSelect, onChanged, top, onHome, homeActive }: Props) {
  const t = useT();
  const [dialog, setDialog] = useState<CommunityDialogMode | null>(null);
  const [menu, setMenu] = useState<{ community: Community; x: number; y: number } | null>(null);
  // O convite com prazo e limite (ConfigurarConvite.tsx), aberto pelo menu.
  const [configurando, setConfigurando] = useState<Community | null>(null);

  return (
    <nav className="rail" aria-label={t('Comunidades')}>
      <button
        className={`rail-logo${homeActive ? ' active' : ''}`}
        title={t('Início do Syden')}
        aria-label={t('Início do Syden')}
        aria-current={homeActive}
        onClick={onHome}
      >
        <Logo size={34} />
      </button>
      {top}
      <div className="rail-list">
        {communities.map((community) => (
          <button
            key={community.id}
            className={`rail-item${community.id === currentId ? ' active' : ''}`}
            title={community.name}
            aria-label={community.name}
            aria-current={community.id === currentId}
            onClick={() => onSelect(community.id)}
            onContextMenu={(e: MouseEvent) => {
              e.preventDefault();
              setMenu({ community, x: e.clientX, y: e.clientY });
            }}
          >
            <CommunityIcon community={community} />
          </button>
        ))}
      </div>
      {/* Um botão só: criar do zero e entrar por convite são dois caminhos da mesma coisa (ter mais uma
          comunidade na lista), e a escolha fica dentro da janela. */}
      <button
        className="rail-item rail-action"
        title={t('Adicionar comunidade')}
        aria-label={t('Adicionar comunidade')}
        onClick={() => setDialog('choose')}
      >
        <Plus size={20} />
      </button>

      {dialog && (
        <CommunityDialog
          mode={dialog}
          onClose={() => setDialog(null)}
          onDone={(community) => {
            setDialog(null);
            onChanged(community);
          }}
        />
      )}

      {menu && (
        <CommunityMenu
          community={menu.community}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          aoConfigurar={() => {
            setConfigurando(menu.community);
            setMenu(null);
          }}
        />
      )}
      {configurando && <ConfigurarConvite communityId={configurando.id} nome={configurando.name} aoFechar={() => setConfigurando(null)} />}
    </nav>
  );
}

/**
 * Menu do botão direito em cima de uma comunidade na barra: por enquanto, só o link de convite —
 * só existe para quem administra (é quem recebe o código; ver server/src/db.ts, listCommunitiesForUser).
 */
function CommunityMenu({
  community,
  x,
  y,
  onClose,
  aoConfigurar,
}: {
  community: Community;
  x: number;
  y: number;
  onClose: () => void;
  aoConfigurar: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);

  function copyLink() {
    const url = new URL(window.location.href);
    url.search = `?convite=${community.inviteCode}`;
    url.hash = '';
    void navigator.clipboard?.writeText(url.toString());
    setCopied(true);
    setTimeout(onClose, 900);
  }

  return createPortal(
    <div
      className="person-menu"
      role="menu"
      style={{ top: Math.min(y, window.innerHeight - 140), left: Math.min(x, window.innerWidth - 250) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="person-menu-name">{community.name}</div>
      {community.inviteCode ? (
        <button className="person-menu-item" onClick={copyLink}>
          <Link size={16} /> {copied ? t('Link copiado!') : t('Copiar link de convite')}
        </button>
      ) : null}
      {community.inviteCode ? (
        <button className="person-menu-item" onClick={aoConfigurar}>
          <SlidersHorizontal size={16} /> {t('Configurar convite')}
        </button>
      ) : (
        <p className="person-menu-hint">{t('Só quem administra pode convidar gente nova.')}</p>
      )}
    </div>,
    document.body,
  );
}

export type CommunityDialogMode = 'choose' | 'create' | 'join';

/**
 * Ter mais uma comunidade na lista: criando do zero ou entrando na de alguém com o código. Começando em
 * "choose", a janela pergunta primeiro qual dos dois — é o mesmo lugar, com dois caminhos.
 */
export function CommunityDialog({
  mode: modoInicial,
  onClose,
  onDone,
}: {
  mode: CommunityDialogMode;
  onClose: () => void;
  onDone: (community: Community) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<CommunityDialogMode>(modoInicial);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creating = mode === 'create';
  // A estrutura de um servidor do Discord (ver modelo-do-discord.ts no servidor): só vai ao criar depois da prévia.
  const [modelo, setModelo] = useState<{ link: string; previa: PreviaDoModelo } | null>(null);

  function escolher(proximo: CommunityDialogMode) {
    setValue('');
    setError(null);
    setModelo(null);
    setMode(proximo);
  }

  if (mode === 'choose') {
    return (
      <div className="dialog-backdrop" onClick={onClose}>
        <div className="dialog" role="dialog" aria-label={t('Adicionar comunidade')} onClick={(e) => e.stopPropagation()}>
          <h2>{t('Adicionar comunidade')}</h2>
          <p className="dialog-body">{t('Comece a sua, ou entre na de alguém com o código que essa pessoa te passou.')}</p>
          <div className="community-choice">
            <button className="community-choice-option" onClick={() => escolher('create')}>
              <Plus size={22} />
              <span>
                <strong>{t('Criar a minha')}</strong>
                <small>{t('Um lugar novo, com canais próprios, e você decide quem entra.')}</small>
              </span>
            </button>
            <button className="community-choice-option" onClick={() => escolher('join')}>
              <LogIn size={20} />
              <span>
                <strong>{t('Entrar com um convite')}</strong>
                <small>{t('Já recebeu um código de alguém? É por aqui.')}</small>
              </span>
            </button>
          </div>
          <div className="dialog-actions">
            <button type="button" className="link-button" onClick={onClose}>
              {t('Cancelar')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const community = creating
        ? await api<Community>('/api/communities', {
            method: 'POST',
            // Os canais iniciais nascem no idioma de quem cria (eram sempre geral, jogos, Sala 1 e Sala 2).
            body: {
              name: value,
              canais: [t('geral'), t('jogos'), t('Sala 1'), t('Sala 2')],
              ...(modelo && { modeloDoDiscord: modelo.link }),
            },
          })
        : await api<Community>('/api/communities/join', { method: 'POST', body: { code: value } });
      onDone(community);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog" role="dialog" aria-label={creating ? t('Criar comunidade') : t('Entrar com um convite')} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{creating ? t('Criar comunidade') : t('Entrar com um convite')}</h2>
        <p className="dialog-body">
          {creating
            ? t('Um lugar novo, com canais próprios. Você escolhe quem entra pelo código de convite.')
            : t('Cole aqui o código que alguém te passou.')}
        </p>
        <label>
          {creating ? t('Nome da comunidade') : t('Código de convite')}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={creating ? t('Ex.: Time do Valorant') : t('Ex.: k3m9xq2p')}
            autoFocus
            required
          />
        </label>
        {creating && (
          <ModeloDoDiscord
            modelo={modelo}
            aoMudar={(novo) => {
              setModelo(novo);
              // O nome do servidor de lá vira a sugestão, se a pessoa ainda não escreveu um.
              if (novo && !value.trim()) setValue(novo.previa.nome);
            }}
          />
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button
            type="button"
            className="link-button"
            onClick={() => (modoInicial === 'choose' ? escolher('choose') : onClose())}
          >
            {modoInicial === 'choose' ? t('Voltar') : t('Cancelar')}
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? t('Aguarde…') : creating ? t('Criar') : t('Entrar')}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Um endereço, não uma frase: não se traduz. */
const EXEMPLO_DO_LINK = 'https://discord.new/…';

interface PreviaDoModelo {
  nome: string;
  canais: { name: string; type: 'text' | 'voice' }[];
  cargos: { nome: string; cor: string }[];
  cortados: number;
}

/**
 * TRAZER A ESTRUTURA DE UM SERVIDOR DO DISCORD (23/11/2026): fechado, é só um link discreto embaixo do nome, para não
 * atrapalhar quem só quer criar. Aberto, a pessoa cola o link do modelo de servidor e vê a PRÉVIA (os canais de texto, os de
 * voz e os cargos, com os nomes) antes de criar. Quem fala com o Discord é o servidor.
 */
function ModeloDoDiscord({
  modelo,
  aoMudar,
}: {
  modelo: { link: string; previa: PreviaDoModelo } | null;
  aoMudar: (modelo: { link: string; previa: PreviaDoModelo } | null) => void;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [link, setLink] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto && !modelo) {
    return (
      <button type="button" className="link-button" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setAberto(true)}>
        {t('Trazer de um servidor do Discord')}
      </button>
    );
  }

  async function verPrevia() {
    const pedido = link.trim();
    if (!pedido) return;
    setBuscando(true);
    setErro(null);
    try {
      const previa = await api<PreviaDoModelo>('/api/modelo-do-discord', { method: 'POST', body: { link: pedido } });
      aoMudar({ link: pedido, previa });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  if (modelo) {
    const { previa } = modelo;
    const texto = previa.canais.filter((c) => c.type === 'text');
    const voz = previa.canais.filter((c) => c.type === 'voice');
    const lista = { display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 96, overflowY: 'auto', margin: '2px 0 8px' } as const;
    const pilula = { fontSize: 12, padding: '1px 8px', borderRadius: 999, background: 'var(--bg-input)' } as const;
    return (
      <div aria-live="polite">
        <strong>{t('Trazer de um servidor do Discord')}</strong>
        {[
          [t('Canais de texto'), texto.map((c) => '#' + c.name)],
          [t('Canais de voz'), voz.map((c) => c.name)],
        ].map(([titulo, nomes]) => (
          <div key={titulo as string}>
            <small>
              {titulo} ({(nomes as string[]).length})
            </small>
            <div style={lista}>
              {(nomes as string[]).map((nome, i) => (
                <span key={i} style={pilula}>
                  {nome}
                </span>
              ))}
            </div>
          </div>
        ))}
        <small>
          {t('Cargos')} ({previa.cargos.length})
        </small>
        <div style={lista}>
          {previa.cargos.map((cargo, i) => (
            <span key={i} style={{ ...pilula, color: cargo.cor }}>
              {cargo.nome}
            </span>
          ))}
        </div>
        {previa.cortados > 0 && <small>{t('Passou do limite do Syden: {n} ficam de fora.', { n: previa.cortados })}</small>}
        <div>
          <button type="button" className="link-button" style={{ padding: 0 }} onClick={() => aoMudar(null)}>
            {t('Tirar')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label>
        {t('Link do modelo do servidor')}
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            // Enter aqui busca a prévia, e não cria a comunidade sem ela.
            if (e.key === 'Enter') {
              e.preventDefault();
              void verPrevia();
            }
          }}
          placeholder={EXEMPLO_DO_LINK}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <small className="dialog-body">
        {t('No Discord, quem cuida do servidor gera o link em Configurações do servidor → Modelo de servidor. Vêm os canais e os cargos (nome e cor), sem as mensagens.')}
      </small>
      {erro && <p className="form-error">{erro}</p>}
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        <button type="button" className="btn-secondary" disabled={buscando || !link.trim()} onClick={() => void verPrevia()}>
          {buscando ? t('Aguarde…') : t('Ver o que vem')}
        </button>
        <button type="button" className="link-button" onClick={() => { setAberto(false); setErro(null); }}>
          {t('Cancelar')}
        </button>
      </div>
    </div>
  );
}
