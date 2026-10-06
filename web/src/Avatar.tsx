import { useEffect, useState } from 'react';
import { mediaUrl } from './api';
import { useDirectory } from './directory';
import type { PresenceStatus } from './types';

/** Mesmas cores do Discord: verde online, amarelo ausente, vermelho não perturbe, cinza invisível/offline. */
const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: 'var(--green)',
  ausente: '#f0b232',
  ocupado: 'var(--red)',
  invisivel: '#80848e',
};

/**
 * O coelho em cada status — o mascote, e não o D4 (decisão de 05/10/2026). Cada status é um SVG
 * exportado do estúdio (animacaoSVG/animacoes_d4.html, grupo "O avatar"), recortado perto da cabeça:
 * online de orelhas em pé, ausente dormindo com os "z", ocupado no notebook, offline descansando com
 * as orelhas caídas. A cor da faixa da orelha reforça, mas a POSTURA é que diz o status — dá para ler
 * sem distinguir verde de vermelho.
 *
 * 'neutro' é quando não se sabe o status (numa mensagem, numa chamada): olhos abertos e a faixa rosa,
 * sem afirmar "online" para quem pode não estar.
 */
const POSE: Record<PresenceStatus, string> = {
  online: 'online',
  ausente: 'ausente',
  ocupado: 'ocupado',
  invisivel: 'offline',
};

function AvatarCoelho({ pose }: { pose: string }) {
  return (
    <img
      className="avatar-coelho"
      data-status={pose}
      src={`${import.meta.env.BASE_URL}mascote/avatar-${pose}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

/** Silêncio que precisa passar para o balão voltar a ser coelho; e quanto dura a volta. */
const FOLGA_MS = 1200;
const VOLTA_MS = 750;

/**
 * Em que momento da conversa o coelho está: parado (a pose do status), no balão (falando ou digitando)
 * ou voltando do balão para coelho.
 *
 * A FOLGA É O QUE IMPEDE O PISCA-PISCA. A detecção de fala liga e desliga a cada pausa entre palavras;
 * seguindo ela ao pé da letra, o coelho viraria balão e voltaria várias vezes numa frase. Entrar no
 * balão é imediato (é o que diz "ele começou"); sair só depois de um silêncio de verdade.
 */
function useMomentoDaConversa(ativo: boolean): 'parado' | 'balao' | 'voltando' {
  const [momento, setMomento] = useState<'parado' | 'balao' | 'voltando'>(ativo ? 'balao' : 'parado');
  useEffect(() => {
    if (ativo) {
      setMomento('balao');
      return;
    }
    if (momento !== 'balao') return;
    const folga = setTimeout(() => setMomento('voltando'), FOLGA_MS);
    return () => clearTimeout(folga);
  }, [ativo, momento]);
  useEffect(() => {
    if (momento !== 'voltando') return;
    const volta = setTimeout(() => setMomento('parado'), VOLTA_MS);
    return () => clearTimeout(volta);
  }, [momento]);
  return momento;
}

/**
 * Foto de perfil quando a pessoa enviou uma; senão, o coelho do Syden na pose do status dela. Quando
 * ela fala ou digita, o coelho vira o balão do D4 (barras ou três pontos) e volta depois — o mascote é
 * o personagem, e o D4 aparece quando a conversa acontece.
 * A foto substitui o coelho por escolha de quem a envia (Configurações → Minha conta).
 */
export function Avatar({
  userId,
  online,
  offline,
  status,
  speaking,
  digitando,
  musica,
  size = 32,
}: {
  /** Não aparece mais no desenho (era a inicial, antes do coelho); fica para quem chama dizer de quem é. */
  name: string;
  userId?: number;
  online?: boolean;
  /** Bolinha colorida pelo status (online/ausente/ocupado/invisível) em vez do verde padrão. */
  status?: PresenceStatus;
  /** Sabidamente desconectada (o grupo "Offline" da lista de membros): o coelho recolhe as orelhas. */
  offline?: boolean;
  speaking?: boolean;
  /** Está escrevendo uma mensagem: o coelho vira o balão com os três pontos. */
  digitando?: boolean;
  /** Tem música tocando na chamada dele (o karaokê): o coelho aparece de fone, com notas. */
  musica?: boolean;
  size?: number;
}) {
  const { members } = useDirectory();
  const membro = userId === undefined ? undefined : members.get(userId);
  const version = membro?.avatarVersion ?? null;
  // A moldura vem do DIRETÓRIO, e não de quem chamou: assim ela aparece em toda parte onde já se
  // desenha um avatar (lista de membros, chamada, mensagem) sem passar a escolha de mão em mão. E
  // muda sozinha quando a pessoa troca, pelo mesmo "user:updated" que já atualiza o nome.
  const moldura = membro?.moldura ?? undefined;
  // Falar tem precedência sobre digitar: é o que os outros estão ouvindo agora.
  const fala = useMomentoDaConversa(!!speaking);
  const escrita = useMomentoDaConversa(!!digitando && !speaking);
  const pose =
    fala === 'balao'
      ? 'falando'
      : fala === 'voltando'
        ? 'parou-de-falar'
        : escrita === 'balao'
          ? 'digitando'
          : escrita === 'voltando'
            ? 'parou-de-digitar'
            : musica
              ? 'musica'
              : offline
              ? 'offline'
              : online
                ? POSE[status ?? 'online']
                : 'neutro';

  return (
    <span
      className={`avatar${speaking ? ' speaking' : ''}`}
      data-moldura={moldura || undefined}
      style={{
        width: size,
        height: size,
      }}
    >
      {version === null ? (
        <AvatarCoelho pose={pose} />
      ) : (
        <img src={mediaUrl.avatar(userId!, version)} alt="" draggable={false} />
      )}
      {/* Com foto, o status vai na bolinha; no coelho, a pose dele já diz. */}
      {online && version !== null && <span className="avatar-status" style={{ background: STATUS_COLORS[status ?? 'online'] }} />}
    </span>
  );
}
