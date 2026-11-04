import { PictureInPicture2 } from 'lucide-react';
import type { RemoteVideoTrack } from 'livekit-client';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from './i18n';
import { type JanelaAberta, destacarVideo, janelaDestacadaDisponivel } from './janelaDestacada';

// O botão que põe um vídeo (a câmera de alguém ou uma transmissão de tela) numa janela à parte (ver janelaDestacada.ts).
//
// ELE NÃO APARECE ONDE NÃO FUNCIONA. Firefox e Safari não têm a Document Picture-in-Picture API, e um
// botão que some ao ser clicado ensina a desconfiar dos outros botões.
//
// AS JANELAS ABERTAS SÃO DO PALCO, NÃO DO BOTÃO (04/11/2026). O botão mora dentro do quadro, e o quadro é
// desmontado e montado de novo a cada troca de lugar: fixar outra pessoa, abrir o "todos do mesmo tamanho",
// a transmissão indo para a faixa de baixo. Com a janela guardada no botão, cada uma dessas trocas FECHAVA a
// janela destacada — justamente quando a pessoa mexia no palco por ter o vídeo na outra tela. Agora quem
// guarda é o palco (`JanelasDestacadas`), e a janela só fecha quando a pessoa pede, quando o vídeo deixa de
// existir ou quando ela sai da chamada.

interface Janelas {
  aberta(chave: string): boolean;
  alternar(chave: string, nome: string, video: HTMLVideoElement, faixa?: RemoteVideoTrack): void;
}

const Contexto = createContext<Janelas | null>(null);

/**
 * Guarda as janelas destacadas da chamada. `chavesQueExistem` são os vídeos que ainda podem ser vistos: a
 * janela de um vídeo que saiu (a pessoa desligou a câmera, parou de transmitir, ou você parou de assistir)
 * fecha sozinha, em vez de ficar mostrando uma imagem parada.
 */
export function JanelasDestacadas({ chavesQueExistem, children }: { chavesQueExistem: string[]; children: ReactNode }) {
  const [abertas, setAbertas] = useState<ReadonlyMap<string, JanelaAberta>>(new Map());
  const atuais = useRef(abertas);
  atuais.current = abertas;

  const tirar = useCallback((chave: string) => {
    setAbertas((antes) => {
      if (!antes.has(chave)) return antes;
      const depois = new Map(antes);
      depois.delete(chave);
      return depois;
    });
  }, []);

  const alternar = useCallback(
    (chave: string, nome: string, video: HTMLVideoElement, faixa?: RemoteVideoTrack) => {
      const aberta = atuais.current.get(chave);
      if (aberta) {
        aberta.fechar();
        tirar(chave);
        return;
      }
      void destacarVideo(video, nome, () => tirar(chave), faixa).then((janela) => {
        if (janela) setAbertas((antes) => new Map(antes).set(chave, janela));
      });
    },
    [tirar],
  );

  // O vídeo que deixou de existir leva a janela dele.
  const existem = chavesQueExistem.join('|');
  useEffect(() => {
    const validas = new Set(existem.split('|'));
    for (const [chave, janela] of atuais.current) {
      if (!validas.has(chave)) {
        janela.fechar();
        tirar(chave);
      }
    }
  }, [existem, tirar]);

  // Sair da chamada com uma janela aberta deixaria uma janela órfã mostrando uma imagem congelada.
  useEffect(() => () => atuais.current.forEach((janela) => janela.fechar()), []);

  const valor = useMemo<Janelas>(() => ({ aberta: (chave) => abertas.has(chave), alternar }), [abertas, alternar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * O botão. Ele procura o <video> subindo pelo próprio lugar onde está, em vez de receber uma referência de
 * fora: o <video> é desenhado pelo componente do LiveKit, que pode trocá-lo quando a faixa muda de qualidade.
 * A faixa vem junto para a janela nova ser ligada a ela pelo próprio LiveKit (ver destacarVideo).
 */
export function BotaoDestacar({
  nome,
  chave,
  faixa,
  classe = 'tile-destacar',
}: {
  nome: string;
  /** O mesmo `trackKey` do palco: é por ele que a janela sobrevive às trocas de lugar do quadro. */
  chave: string;
  faixa?: RemoteVideoTrack;
  /** No quadro grande da transmissão o botão entra na fileira dos controles dela, com o desenho deles. */
  classe?: string;
}) {
  const t = useT();
  const botao = useRef<HTMLButtonElement>(null);
  const janelas = useContext(Contexto);

  if (!janelas || !janelaDestacadaDisponivel()) return null;
  const aberta = janelas.aberta(chave);

  function alternar(evento: React.MouseEvent) {
    // O quadro inteiro é clicável (fixa no destaque); sem isto, destacar também trocaria o que está grande.
    evento.stopPropagation();
    const quadro = botao.current?.closest('.lk-participant-tile, .stage-main');
    const video = quadro?.querySelector('video');
    if (!video) return;
    janelas!.alternar(chave, nome, video, faixa);
  }

  const rotulo = aberta ? t('Trazer de volta para esta janela') : t('Abrir em outra janela');
  return (
    <button
      ref={botao}
      type="button"
      className={`${classe}${aberta ? ' ativo' : ''}`}
      onClick={alternar}
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={aberta}
    >
      <PictureInPicture2 size={16} />
    </button>
  );
}
