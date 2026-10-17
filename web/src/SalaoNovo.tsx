import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { API_URL, loadToken, mediaUrl } from './api';
import { useT } from './i18n';
import type { PecaClicada } from './CartaoDaPeca';
import { type Arrumacao, EditorDaCena, type Figuras } from './QuartoNovo';
import type { AcoesDoSalao } from './Salao';
import type { Community } from './types';

/**
 * O SALÃO NOVO, o isométrico de móveis soltos (e2e/pixel-art/salao/, montado por montar.mjs salao), dentro do início da
 * comunidade. SÓ NO DESENVOLVIMENTO, como o QuartoNovo.tsx: o Vite serve a página (vite.config.ts, "salao-novo") e ela
 * não entra no build; o Salao.tsx de frente continua publicado até ele lançar este (decisão dele, 15/10/2026: o
 * isométrico SUBSTITUI o de frente).
 *
 * A conversa com a página é a do quarto (mensagens da mesma origem), com o que é do salão:
 * - daqui para lá: as funções de cada objeto (as mesmas do Salao.tsx, já traduzidas), QUEM ESTÁ NA CALL de verdade (com
 *   o papel: transmitindo vai para a TV, jogando vai para o fliperama), o Ao vivo da TV, a imagem da comunidade para o
 *   quadro, o recado do balcão, e a conta com a rota do salão desta comunidade e se a pessoa pode arrumar;
 * - de lá para cá: pronto, as figuras da barra, o clique numa função e a troca de canal da TV.
 *
 * A ARRUMAÇÃO É DA COMUNIDADE (salao-routes.ts): todo membro vê igual, e só quem administra tem a barra de arrumar. O
 * servidor também confere: a barra escondida não é a trava. Quando quem administra muda o salão, a turma relê na hora.
 */
export const ENDERECO_DO_SALAO = import.meta.env.BASE_URL + 'salao-novo/';
const ENDERECO = ENDERECO_DO_SALAO + '?app';

/** Uma pessoa no salão: transmitindo fica na frente da TV; numa partida, no fliperama; o resto senta. */
export interface PessoaNoSalao {
  id: number;
  nome: string;
  papel: 'call' | 'transmitindo' | 'jogando';
}

export function SalaoNovo({
  community,
  acoes,
  naCall,
  aoVivo,
  recado,
  podeEditar,
  noite,
  socket,
  aoFalhar,
}: {
  community: Pick<Community, 'id' | 'iconVersion' | 'bannerVersion' | 'name'>;
  acoes: AcoesDoSalao;
  naCall: PessoaNoSalao[];
  /** Alguém transmitindo: a TV mostra o Ao vivo e quem é. */
  aoVivo: {
    nome: string;
    sub: string;
    canal: number;
    total: number;
    aoTrocar: (passo: 1 | -1) => void;
  } | null;
  recado: { titulo: string; texto: string } | null;
  podeEditar: boolean;
  noite: boolean;
  socket: Socket | null;
  /** A cena não disse "pronto" a tempo: quem mostra volta ao salão antigo. */
  aoFalhar?: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLIFrameElement>(null);
  const acoesRef = useRef(acoes);
  acoesRef.current = acoes;
  const trocarRef = useRef(aoVivo?.aoTrocar);
  trocarRef.current = aoVivo?.aoTrocar;
  // Se é noite vai no endereço, e não só na mensagem que segue o "pronto": senão o primeiro quadro sai de dia. Só o da
  // abertura (trocar o endereço recarregaria a cena; depois, a troca vai por mensagem).
  const [endereco] = useState(() => ENDERECO + (noite ? '&noite' : ''));
  const [pronto, setPronto] = useState(false);
  const [figuras, setFiguras] = useState<Figuras | null>(null);
  const [arrumacao, setArrumacao] = useState<Arrumacao | null>(null);
  const [peca, setPeca] = useState<PecaClicada | null>(null);

  const enviar = (msg: Record<string, unknown>) =>
    ref.current?.contentWindow?.postMessage({ syden: 'quarto', ...msg }, location.origin);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== ref.current?.contentWindow || e.data?.syden !== 'quarto') return;
      if (e.data.pronto) {
        setPronto(true);
        if (e.data.figuras) setFiguras(e.data.figuras);
      }
      if (e.data.arrumacao) setArrumacao(e.data.arrumacao);
      if (e.data.detalhe && typeof e.data.detalhe.id === 'string') setPeca(e.data.detalhe);
      if (typeof e.data.acao === 'string') acoesRef.current[e.data.acao as keyof AcoesDoSalao]?.onClick();
      if (e.data.canal === 1 || e.data.canal === -1) trocarRef.current?.(e.data.canal);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, []);

  // Sem o "pronto" da cena a tempo (a página não carregou, ou foi barrada): volta o salão antigo (ver cenaNova.ts).
  useEffect(() => {
    if (pronto || !aoFalhar) return;
    const prazo = setTimeout(aoFalhar, 20_000);
    return () => clearTimeout(prazo);
  }, [pronto, aoFalhar]);

  // Só o que se mostra de cada função (o clique volta para cá, onde mora a ação).
  const funcoes = JSON.stringify(
    Object.fromEntries(Object.entries(acoes).map(([id, a]) => [id, { rotulo: a?.rotulo, sub: a?.sub }])),
  );
  useEffect(() => {
    if (pronto) enviar({ funcoes: JSON.parse(funcoes), noite });
  }, [pronto, funcoes, noite]);

  const pessoas = JSON.stringify(naCall.slice(0, 12));
  useEffect(() => {
    if (pronto) enviar({ pessoas: JSON.parse(pessoas) });
  }, [pronto, pessoas]);

  const tv =
    aoVivo &&
    JSON.stringify({
      rotulo: t('Ao vivo'),
      nome: aoVivo.nome,
      sub: aoVivo.sub,
      canal: aoVivo.canal,
      total: aoVivo.total,
    });
  useEffect(() => {
    if (pronto) enviar({ aoVivo: tv ? JSON.parse(tv) : null });
  }, [pronto, tv]);

  // O quadro: a CAPA (larga, enche o quadro) se houver; senão o ícone, inteiro no meio; sem nenhuma, as fotos dos coelhos.
  const imagem = community.bannerVersion
    ? {
        url: `${API_URL}/api/communities/${community.id}/capa?v=${community.bannerVersion}`,
        encaixe: 'cobrir',
      }
    : community.iconVersion !== null
      ? {
          url: mediaUrl.communityIcon(community.id, community.iconVersion),
          encaixe: 'conter',
        }
      : null;
  const imagemJson = JSON.stringify(imagem);
  useEffect(() => {
    if (pronto) enviar({ imagem: JSON.parse(imagemJson) });
  }, [pronto, imagemJson]);

  const recadoJson = JSON.stringify(recado);
  useEffect(() => {
    if (pronto) enviar({ recado: JSON.parse(recadoJson) });
  }, [pronto, recadoJson]);

  useEffect(() => {
    const token = loadToken();
    if (pronto && token)
      enviar({
        conta: {
          api: API_URL,
          token,
          nome: '',
          id: 0,
          rota: `/api/communities/${community.id}/salao`,
          podeEditar,
        },
      });
  }, [pronto]);

  // Quem administra mudou o salão: a página relê do servidor.
  useEffect(() => {
    if (!socket || !pronto) return;
    const aoMudar = (d: { communityId: number }) => d.communityId === community.id && enviar({ recarregar: true });
    socket.on('salao:mudou', aoMudar);
    return () => {
      socket.off('salao:mudou', aoMudar);
    };
  }, [socket, pronto, community.id]);

  return (
    <EditorDaCena titulo={community.name} figuras={figuras} arrumacao={arrumacao} enviar={enviar} podeEditar={pronto && podeEditar} carregando={!pronto} noite={noite} peca={peca} aoFecharPeca={() => setPeca(null)}>
      <div className="quarto-novo-caixa salao-novo">
        <div className="quarto-novo">
          <iframe ref={ref} src={endereco} title={t('Início')} />
        </div>
      </div>
    </EditorDaCena>
  );
}
