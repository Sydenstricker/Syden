import { Check, MessageSquare, Pencil, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiError, api } from './api';
import { Avatar } from './Avatar';
import { EscolhasDoCartao } from './Aparencia';
import { nomeDe, useDirectory } from './directory';
import { EtiquetasDeCargo } from './Cargos';
import { IdiomasNoCartao } from './IdiomasDoPerfil';
import { Vitrine, legendaDaVitrine } from './Vitrine';
import { useNota } from './notas';
import { classeDoFundo, corDoNome, efeitoDoNome, letraDoNome } from './profileStyles';
import type { CommunityMember, PresenceStatus } from './types';
import { chave, useT } from './i18n';

const CARGO: Record<string, string> = {
  owner: chave('Dono da comunidade'),
  admin: chave('Administra a comunidade'),
  member: chave('Membro'),
};
const PRESENCA: Record<PresenceStatus, string> = {
  online: chave('Disponível'),
  ausente: chave('Ausente'),
  ocupado: chave('Não perturbe'),
  invisivel: chave('Offline'),
};

type Relacao = 'nenhuma' | 'enviei' | 'recebi' | 'amigos';

/**
 * ADICIONAR AMIGO PELO CARTÃO (pedido dele, 02/11/2026): "quando eu clico no balão da pessoa, deveria ter a opção".
 * Antes o pedido só saía pela tela de Amigos, e ela só abre pelo quadro de fotos do quarto — quem não achava o quadro
 * não achava os amigos.
 *
 * Vai pelo NOME da conta, pela mesma rota da tela de Amigos (com o freio e a recusa que não conta se a pessoa existe:
 * ver amigos-routes.ts). A relação é lida ao abrir, para o botão não oferecer o que já foi feito; quem já é amigo não vê
 * botão nenhum, porque desfazer amizade num clique distraído do cartão seria fácil demais (fica na tela de Amigos).
 */
function BotaoDeAmizade({ userId, username }: { userId: number; username: string }) {
  const t = useT();
  const [relacao, setRelacao] = useState<Relacao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      // Só a relação com esta pessoa (GET /api/amigos/:id), e não a lista inteira com as sugestões (revisão de 02/11/2026).
      const r = await api<{ situacao: 'pendente' | 'aceita' | null; euPedi?: boolean }>(`/api/amigos/${userId}`);
      setRelacao(!r.situacao ? 'nenhuma' : r.situacao === 'aceita' ? 'amigos' : r.euPedi ? 'enviei' : 'recebi');
    } catch {
      // Sem a resposta, nada de botão: oferecer um pedido que talvez já exista seria a tela afirmando o que não sabe.
    }
  }, [userId]);

  useEffect(() => {
    void carregar();
    const aoMudar = () => void carregar();
    window.addEventListener('syden:amigos', aoMudar);
    return () => window.removeEventListener('syden:amigos', aoMudar);
  }, [carregar]);

  async function agir(fazer: () => unknown) {
    setOcupado(true);
    setErro(null);
    try {
      await fazer();
      await carregar();
    } catch (e) {
      // A recusa do pedido fala em "conferir o nome", que no cartão ninguém digitou: ali ela vira a frase geral. Ela é a
      // mesma para "não existe", "bloqueou" e "já há pedido" de propósito (ver amigos-routes.ts), e continua sendo.
      const generica = !(e instanceof ApiError) || e.status === 404 || e.status === 409;
      setErro(generica ? t('Não deu certo. Tente de novo.') : e.message);
    } finally {
      setOcupado(false);
    }
  }

  if (relacao === null || relacao === 'amigos') return null;
  return (
    <>
      {relacao === 'nenhuma' && (
        <button
          className="perfil-acao perfil-acao-sutil"
          disabled={ocupado}
          onClick={() => agir(() => api('/api/amigos', { method: 'POST', body: { username } }))}
        >
          <UserPlus size={16} aria-hidden="true" />
          {t('Pedir amizade')}
        </button>
      )}
      {relacao === 'recebi' && (
        <button
          className="perfil-acao perfil-acao-sutil"
          disabled={ocupado}
          onClick={() => agir(() => api(`/api/amigos/${userId}/aceitar`, { method: 'POST' }))}
        >
          <Check size={16} aria-hidden="true" />
          {t('Aceitar o pedido de amizade')}
        </button>
      )}
      {relacao === 'enviei' && (
        <p className="perfil-amizade-enviada" role="status">
          <Check size={14} aria-hidden="true" />
          {t('Pedido de amizade enviado')}
        </p>
      )}
      {erro && <p className="form-error">{erro}</p>}
    </>
  );
}

/**
 * O cartão que aparece ao clicar em alguém: o fundo escolhido pela pessoa, o avatar por cima e o nome
 * na cor dela. É aqui que os enfeites de perfil ganham um lugar de verdade para aparecer.
 */
export function ProfileCard({
  membro: doClique,
  status,
  x,
  y,
  onClose,
  onSendMessage,
  isSelf,
  aoEditar,
}: {
  membro: CommunityMember;
  status: PresenceStatus | undefined;
  x: number;
  y: number;
  onClose: () => void;
  onSendMessage: (userId: number) => void;
  isSelf: boolean;
  /**
   * Abre Configurações → Aparência, a tela completa. O lápis do SEU cartão abre as escolhas ali mesmo
   * (EscolhasDoCartao); isto é o link no fim delas, para insígnias, pacotes e paleta. No cartão dos
   * outros não há lápis: não haveria o que editar.
   */
  aoEditar?: () => void;
}) {
  const t = useT();
  const [editando, setEditando] = useState(false);
  // A pessoa vem do DIRETÓRIO, e não da cópia tirada no clique: é o que faz o cartão ser a prévia
  // enquanto você veste — o "user:updated" que chega depois de salvar atualiza o diretório.
  const { members } = useDirectory();
  const membro = members.get(doClique.id) ?? doClique;
  const nota = useNota(membro.id);
  const ref = useRef<HTMLDivElement | null>(null);
  const [lugar, setLugar] = useState({ left: x, top: y });

  // O cartão nasce onde o mouse clicou, mas não pode passar da borda da janela.
  // E ACOMPANHA O PRÓPRIO TAMANHO: abrir as escolhas do lápis aumenta o cartão, e de novo quando o
  // guarda-roupa termina de carregar. Medir só ao abrir deixava o fim dele para fora da tela.
  useEffect(() => {
    const cartao = ref.current;
    if (!cartao) return;
    const posicionar = () => {
      const caixa = cartao.getBoundingClientRect();
      setLugar({
        left: Math.max(8, Math.min(x, window.innerWidth - caixa.width - 8)),
        top: Math.max(8, Math.min(y, window.innerHeight - caixa.height - 8)),
      });
    };
    posicionar();
    const observador = new ResizeObserver(posicionar);
    observador.observe(cartao);
    return () => observador.disconnect();
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="perfil-sombra" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={ref}
        className="perfil-cartao"
        style={{ left: lugar.left, top: lugar.top }}
        role="dialog"
        aria-label={`Perfil de ${nomeDe(membro)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`perfil-banner ${classeDoFundo(membro.banner)}`} aria-hidden="true" />
        {isSelf && aoEditar && (
          <button
            className="perfil-editar"
            aria-label={t('Editar')}
            title={t('Editar')}
            aria-pressed={editando}
            onClick={() => setEditando((antes) => !antes)}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        )}
        <div className="perfil-avatar">
          <Avatar name={nomeDe(membro)} userId={membro.id} size={72} />
        </div>
        <div className="perfil-corpo">
          <h3 className="perfil-nome" data-cor={corDoNome(membro.nameColor)} data-efeito={efeitoDoNome(membro.nameEffect)} style={{ fontFamily: letraDoNome(membro.nameFont) }}>
            {nomeDe(membro)}
          </h3>
          {/* Com apelido ou nome de exibição, o nome da conta fica embaixo, como no Discord: é por ele que se acha a pessoa. */}
          {nomeDe(membro) !== membro.username && <p className="perfil-conta">{membro.username}</p>}
          <p className="perfil-linha">{t(CARGO[membro.role] ?? chave('Membro'))}</p>
          <EtiquetasDeCargo ids={membro.cargos} />
          <p className="perfil-linha">{t(status ? PRESENCA[status] : chave('Offline'))}</p>
          {membro.vitrine?.length > 0 && (
            <span className="medalha-linha">
              {/* 46 e não 72: a conta está no .medalha-linha, e é o que faz cinco insígnias caberem
                  numa fileira só em vez de virarem uma coluna. */}
              <Vitrine membro={membro} tamanho={46} />
              <span className="medalha-legenda">
                <strong>{legendaDaVitrine(membro)}</strong>
                {/* SEM "DELA": a frase fala de uma pessoa que pode ser qualquer pessoa, e o cartão é o
                    lugar mais errado possível para errar isso. "Teve uma ideia" resolve sem rodeio.
                    E passa pelo t(): estava cravada em português porque texto dentro de chaves não é
                    alcançado pela busca de texto cravado — ali dentro é código. */}
                {membro.acceptedIdeas > 0 && (
                  <small>
                    {membro.acceptedIdeas === 1
                      ? t('Teve uma ideia que entrou no app')
                      : t('Teve {quantas} ideias que entraram no app', { quantas: membro.acceptedIdeas })}
                  </small>
                )}
              </span>
            </span>
          )}
          <IdiomasNoCartao userId={membro.id} />
          {nota && (
            <p className="perfil-nota" title={t('Anotação sua, guardada só neste computador')}>
              {nota}
            </p>
          )}
          {isSelf && editando && aoEditar && (
            <EscolhasDoCartao
              nome={membro.username}
              aoAbrirAparencia={() => {
                onClose();
                aoEditar();
              }}
            />
          )}
          {!isSelf && (
            <button
              className="perfil-acao"
              onClick={() => {
                onClose();
                onSendMessage(membro.id);
              }}
            >
              <MessageSquare size={16} aria-hidden="true" />
              {t('Mandar mensagem')}
            </button>
          )}
          {!isSelf && <BotaoDeAmizade userId={membro.id} username={membro.username} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
