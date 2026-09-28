import { PictureInPicture2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { type JanelaAberta, destacarVideo, janelaDestacadaDisponivel } from './janelaDestacada';

// O botão que põe o vídeo numa janela à parte (ver janelaDestacada.ts).
//
// ELE NÃO APARECE ONDE NÃO FUNCIONA. Firefox e Safari não têm a Document Picture-in-Picture API, e um
// botão que some ao ser clicado ensina a desconfiar dos outros botões.
//
// Ele procura o <video> subindo pelo próprio lugar onde está, em vez de receber uma referência de fora.
// É menos elegante e é mais robusto: o <video> é desenhado pelo componente do LiveKit, que pode trocá-lo
// quando a faixa muda de qualidade, e uma referência guardada apontaria para um elemento que já saiu da
// tela.

export function BotaoDestacar({ nome }: { nome: string }) {
  const t = useT();
  const botao = useRef<HTMLButtonElement>(null);
  const [aberta, setAberta] = useState<JanelaAberta | null>(null);

  // Sair da chamada com a janela aberta deixaria uma janela órfã mostrando uma imagem congelada.
  useEffect(() => {
    return () => aberta?.fechar();
  }, [aberta]);

  if (!janelaDestacadaDisponivel()) return null;

  async function alternar(evento: React.MouseEvent) {
    // O quadro inteiro é clicável (abre a transmissão); sem isto, destacar também trocaria a tela.
    evento.stopPropagation();

    if (aberta) {
      aberta.fechar();
      setAberta(null);
      return;
    }

    const quadro = botao.current?.closest('.lk-participant-tile') ?? botao.current?.parentElement;
    const video = quadro?.querySelector('video');
    if (!video) return;

    const janela = await destacarVideo(video, nome, () => setAberta(null));
    setAberta(janela);
  }

  return (
    <button
      ref={botao}
      type="button"
      className={`tile-destacar${aberta ? ' ativo' : ''}`}
      onClick={(e) => void alternar(e)}
      title={aberta ? t('Trazer de volta para esta janela') : t('Abrir em outra janela')}
      aria-label={aberta ? t('Trazer de volta para esta janela') : t('Abrir em outra janela')}
      aria-pressed={aberta !== null}
    >
      <PictureInPicture2 size={16} />
    </button>
  );
}
