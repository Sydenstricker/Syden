import { useEffect, useRef, useState } from 'react';
import { mediaUrl } from './api';
import { useDirectory } from './directory';
import type { PresenceStatus } from './types';
import { useJanelaComFoco } from './janelaComFoco';

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
  // Sem foco, o mesmo desenho parado (avatar-*-parado.svg, do exportador): a animação dentro do SVG não se pausa de fora, e
  // dezenas delas na lista de membros repintavam sem parar com a janela atrás de um jogo (medido em 06/11/2026).
  const comFoco = useJanelaComFoco();
  return (
    <img
      className="avatar-coelho"
      data-status={pose}
      src={`${import.meta.env.BASE_URL}mascote/avatar-${pose}${comFoco ? '' : '-parado'}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

/** O desenho de um coelho pronto (public/avatares/), parado. É também o que a grade de escolha mostra. */
export function enderecoDoCoelhoPronto(numero: number, estado?: EstadoDoPronto) {
  return `${import.meta.env.BASE_URL}avatares/coelho-${String(numero).padStart(2, '0')}${estado ? '-' + estado : ''}.png`;
}

/**
 * O que um coelho pronto sabe fazer além de ficar parado. Cada estado é uma faixa de QUADROS_DO_PRONTO quadros
 * (e2e/pixel-art/avatares/folhas.mjs), tocada em laço pelo CSS: falando mexe a boca, ausente dorme, ocupado
 * franze a testa. Online não tem faixa: é o desenho parado, com o anel verde.
 */
export type EstadoDoPronto = 'falando' | 'ausente' | 'ocupado';
export const QUADROS_DO_PRONTO = 8;

function CoelhoPronto({ numero, estado }: { numero: number; estado: EstadoDoPronto | null }) {
  if (!estado) return <img className="avatar-pronto" src={enderecoDoCoelhoPronto(numero)} alt="" draggable={false} />;
  return (
    <span
      className="avatar-pronto avatar-pronto-faixa"
      data-estado={estado}
      style={{ backgroundImage: `url(${enderecoDoCoelhoPronto(numero, estado)})` }}
      aria-hidden="true"
    />
  );
}

/** Silêncio que precisa passar para o balão voltar a ser coelho; e quanto dura a volta.
 *  A FALA tem folga curta (15/10/2026, relato dele: "fica na animação de falando por mais tempo do que a pessoa de fato
 *  está falando"): o sinal de fala do LiveKit já chega com a margem dele, e 1,2 s a mais somava mais de 2 s de boca
 *  mexendo depois do silêncio. 0,45 s ainda cobre a pausa entre palavras. Digitar continua com a folga longa. */
const FOLGA_MS = 1200;
const FOLGA_DA_FALA_MS = 450;
const VOLTA_MS = 750;

/**
 * Em que momento da conversa o coelho está: parado (a pose do status), no balão (falando ou digitando)
 * ou voltando do balão para coelho.
 *
 * A FOLGA É O QUE IMPEDE O PISCA-PISCA. A detecção de fala liga e desliga a cada pausa entre palavras;
 * seguindo ela ao pé da letra, o coelho viraria balão e voltaria várias vezes numa frase. Entrar no
 * balão é imediato (é o que diz "ele começou"); sair só depois de um silêncio de verdade.
 */
function useMomentoDaConversa(ativo: boolean, folgaMs = FOLGA_MS): 'parado' | 'balao' | 'voltando' {
  const [momento, setMomento] = useState<'parado' | 'balao' | 'voltando'>(ativo ? 'balao' : 'parado');
  useEffect(() => {
    if (ativo) {
      setMomento('balao');
      return;
    }
    if (momento !== 'balao') return;
    const folga = setTimeout(() => setMomento('voltando'), folgaMs);
    return () => clearTimeout(folga);
  }, [ativo, momento, folgaMs]);
  useEffect(() => {
    if (momento !== 'voltando') return;
    const volta = setTimeout(() => setMomento('parado'), VOLTA_MS);
    return () => clearTimeout(volta);
  }, [momento]);
  return momento;
}

/** Onde passar o mouse anima o GIF do avatar: a linha inteira (a mensagem, a pessoa na lista), como no Discord. */
const LINHA_DO_AVATAR = ['.message', 'button', '[role="button"]', 'a', 'li'].join(', ');
/** Daqui para cima o avatar é o destaque (o cartão de perfil, Minha conta): o GIF anima sempre. */
const AVATAR_GRANDE = 80;

/** O GIF decodificado, um por endereço: dez mensagens da mesma pessoa não baixam nem decodificam dez vezes. */
const gifs = new Map<string, Promise<HTMLImageElement>>();
function carregarGif(src: string) {
  let promessa = gifs.get(src);
  if (!promessa) {
    promessa = new Promise((ok, falha) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = falha;
      img.src = src;
    });
    gifs.set(src, promessa);
  }
  return promessa;
}

function useMenosMovimento() {
  const [menos, setMenos] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const consulta = matchMedia('(prefers-reduced-motion: reduce)');
    const mudou = () => setMenos(consulta.matches);
    consulta.addEventListener('change', mudou);
    return () => consulta.removeEventListener('change', mudou);
  }, []);
  return menos;
}

/**
 * A FOTO DO AVATAR, e o GIF ANIMADO (pedido dele, 04/11/2026: "como o Discord faz na lista, para não virar um pisca-pisca"):
 * nas listas e nas mensagens o GIF aparece PARADO, no primeiro quadro (desenhado num canvas, porque um <img> de GIF não
 * para), e anima enquanto o mouse está na linha dele. Grande (o cartão de perfil, Minha conta), anima sempre. Com "menos
 * movimento" no sistema, nunca anima.
 *
 * E ANIMA ENQUANTO A PESSOA FALA (sugestão de quem usa, 04/11/2026, como o Discord: muita gente põe o GIF de um personagem
 * abrindo e fechando a boca, e na chamada parece que o avatar fala). O sinal é o mesmo que mexe a boca do coelho pronto,
 * com a folga curta da fala (FOLGA_DA_FALA_MS), para o GIF não parar e recomeçar entre uma palavra e outra.
 */
function FotoDoAvatar({ src, animado, estado, size }: { src: string; animado: boolean; estado: EstadoDoPronto | null; size: number }) {
  const menosMovimento = useMenosMovimento();
  const sempre = size >= AVATAR_GRANDE;
  const [linha, setLinha] = useState<Element | null>(null);
  const [mouseNaLinha, setMouseNaLinha] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  // a linha é achada pelo próprio elemento, uma vez: o avatar não sabe onde foi posto
  const guardar = (el: Element | null) => {
    if (!el || linha) return;
    const avatar = el.closest('.avatar');
    setLinha(avatar?.parentElement?.closest(LINHA_DO_AVATAR) ?? avatar?.parentElement ?? null);
  };

  useEffect(() => {
    if (!animado || sempre || !linha) return;
    const entrou = () => setMouseNaLinha(true);
    const saiu = () => setMouseNaLinha(false);
    linha.addEventListener('mouseenter', entrou);
    linha.addEventListener('mouseleave', saiu);
    linha.addEventListener('focusin', entrou);
    linha.addEventListener('focusout', saiu);
    return () => {
      linha.removeEventListener('mouseenter', entrou);
      linha.removeEventListener('mouseleave', saiu);
      linha.removeEventListener('focusin', entrou);
      linha.removeEventListener('focusout', saiu);
    };
  }, [animado, sempre, linha]);

  const falando = estado === 'falando';
  const parado = animado && (menosMovimento || (!sempre && !mouseNaLinha && !falando));

  // o primeiro quadro, recortado no meio como o object-fit: cover do <img>
  useEffect(() => {
    if (!parado) return;
    let vivo = true;
    void carregarGif(src).then(
      (img) => {
        const c = canvas.current;
        if (!vivo || !c) return;
        const lado = Math.round(size * (window.devicePixelRatio || 1));
        c.width = c.height = lado;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const menor = Math.min(img.naturalWidth, img.naturalHeight);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, (img.naturalWidth - menor) / 2, (img.naturalHeight - menor) / 2, menor, menor, 0, 0, lado, lado);
      },
      () => {},
    );
    return () => {
      vivo = false;
    };
  }, [parado, src, size]);

  if (parado) {
    return (
      <canvas
        ref={(el) => {
          canvas.current = el;
          guardar(el);
        }}
        className="avatar-foto"
        data-estado={estado ?? undefined}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      ref={guardar}
      className="avatar-foto"
      data-estado={estado ?? undefined}
      data-gif={animado ? '' : undefined}
      src={src}
      alt=""
      draggable={false}
    />
  );
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
  assistindo,
  size = 32,
}: {
  /** Não aparece mais no desenho (era a inicial, antes do coelho); fica para quem chama dizer de quem é. */
  name: string;
  userId?: number;
  online?: boolean;
  /** O estado (online/ausente/ocupado/invisível): a cor do anel e, no coelho, a pose. */
  status?: PresenceStatus;
  /** Sabidamente desconectada (o grupo "Offline" da lista de membros): o coelho recolhe as orelhas. */
  offline?: boolean;
  speaking?: boolean;
  /** Está escrevendo uma mensagem: o coelho vira o balão com os três pontos. */
  digitando?: boolean;
  /** Tem música tocando na chamada dele (o karaokê): o coelho aparece de fone, com notas. */
  musica?: boolean;
  /** Está na plateia de uma transmissão (ver assistindo.ts): o coelho aparece com a pipoca. */
  assistindo?: boolean;
  size?: number;
}) {
  const { members } = useDirectory();
  const membro = userId === undefined ? undefined : members.get(userId);
  const version = membro?.avatarVersion ?? null;
  const pronto = version === null ? (membro?.avatarPronto ?? null) : null;
  // A moldura vem do DIRETÓRIO, e não de quem chamou: assim ela aparece em toda parte onde já se
  // desenha um avatar (lista de membros, chamada, mensagem) sem passar a escolha de mão em mão. E
  // muda sozinha quando a pessoa troca, pelo mesmo "user:updated" que já atualiza o nome.
  const moldura = membro?.moldura ?? undefined;
  // Falar tem precedência sobre digitar: é o que os outros estão ouvindo agora.
  const fala = useMomentoDaConversa(!!speaking, FOLGA_DA_FALA_MS);
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
              : assistindo && !offline
              ? 'assistindo'
              : offline
              ? 'offline'
              : online
                ? POSE[status ?? 'online']
                : 'neutro';

  // O coelho pronto na pose do momento: falar vem antes de tudo (é o que os outros estão ouvindo), depois o
  // estado escolhido. Offline e "não se sabe" ficam no desenho parado.
  const estadoDoPronto: EstadoDoPronto | null =
    // (só no balão: na volta ele já parou de falar, e a boca mexendo ali era o "demora para voltar")
    fala === 'balao' ? 'falando' : online && !offline && (status === 'ausente' || status === 'ocupado') ? status : null;

  return (
    <span
      className={`avatar${speaking ? ' speaking' : ''}`}
      data-moldura={moldura || undefined}
      // O ANEL DO ESTADO (10/10/2026): um anel fino da cor do estado, POR FORA da moldura — a moldura que a
      // pessoa escolheu continua inteira. Substitui a bolinha do canto, que se perdia nas skins coloridas
      // (ver styles.css, ".avatar[data-estado]"). Só aparece quando o estado é sabido.
      data-estado={online && !offline ? (status ?? 'online') : undefined}
      style={{ width: size, height: size }}
    >
      {version !== null ? (
        // A FOTO PRÓPRIA também mostra o momento (pedido dele, 04/11/2026: "o mesmo comportamento das do Syden"): o
        // desenho de uma foto não se anima quadro a quadro como o coelho, então é a foto inteira que se mexe — pula de
        // leve falando, cochila (esmaecida, com o zzz) ausente, e balança devagar ocupada. Ver .avatar-foto em styles.css.
        <>
          <FotoDoAvatar src={mediaUrl.avatar(userId!, version)} animado={!!membro?.avatarAnimado} estado={estadoDoPronto} size={size} />
          {estadoDoPronto === 'ausente' && (
            <span className="avatar-foto-zzz" aria-hidden="true">
              z
            </span>
          )}
        </>
      ) : pronto !== null ? (
        <CoelhoPronto numero={pronto} estado={estadoDoPronto} />
      ) : (
        <AvatarCoelho pose={pose} />
      )}
    </span>
  );
}
