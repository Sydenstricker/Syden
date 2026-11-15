import { type RefObject, useEffect, useState } from 'react';
import { elementoAVista } from './CenaGuardada';
import { useJanelaComFoco } from './janelaComFoco';

/**
 * A CENA À VISTA DORME SEM FOCO (15/11/2026, pedido dele: "1,1 GB de RAM é muita coisa, especialmente no contexto brasileiro
 * de PCs mais modestos"). O CenaGuardada solta a cena de onde a pessoa SAIU; faltava a que continua à vista, no segundo
 * monitor, enquanto ela joga no primeiro: o salão segurava ~1,1 GB e o quarto ~450 MB a partida inteira.
 *
 * Sem foco a cena já não se mexe (a página para de desenhar), então ela pode virar uma FOTO sem ninguém notar: depois de
 * DORME_MS sem foco, a parte à vista do canvas da página vira uma imagem (do tamanho da caixa, ~2 a 8 MB), e o iframe sai,
 * levando a página e tudo o que ela segurava. Com o foco de volta, o iframe é montado de novo (~2,5 s), com a foto por cima
 * até a cena dizer que está pronta: a tela não pisca para o vazio nem para o mascote de espera.
 *
 * Não dorme: no Editar (as mudanças pendentes moram na página), com uma peça aberta, nem antes de a cena ficar pronta. O que
 * a foto não traz: os nomes em cima dos coelhos e os balões, que são HTML por cima do canvas (sem foco, ninguém os lê).
 */
export const DORME_MS = 30_000;

/** A parte à vista do canvas da página, como imagem do tamanho da caixa do iframe; null se não deu (a cena volta a acordar). */
function fotografar(iframe: HTMLIFrameElement | null): string | null {
  try {
    const doc = iframe?.contentDocument;
    const tela = doc?.getElementById('tela') as HTMLCanvasElement | null;
    if (!iframe || !doc || !tela || !tela.width) return null;
    const caixa = iframe.getBoundingClientRect();
    const r = tela.getBoundingClientRect(); // na página do iframe, já com a câmera do salão
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const foto = document.createElement('canvas');
    foto.width = Math.max(1, Math.round(caixa.width * dpr));
    foto.height = Math.max(1, Math.round(caixa.height * dpr));
    const g = foto.getContext('2d');
    if (!g) return null;
    g.imageSmoothingEnabled = false; // pixel art
    const fundo = doc.defaultView?.getComputedStyle(doc.body).backgroundColor;
    if (fundo && fundo !== 'rgba(0, 0, 0, 0)') { g.fillStyle = fundo; g.fillRect(0, 0, foto.width, foto.height); }
    g.drawImage(tela, r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr);
    return foto.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * `podeDormir`: a cena está pronta e nada de pendente mora nela. Devolve se o iframe deve estar montado (`montada`) e a foto
 * a mostrar por cima (enquanto dorme e enquanto acorda); quem usa chama `acordou()` quando a cena nova diz "pronto".
 */
export function useCenaDormindo(iframe: RefObject<HTMLIFrameElement | null>, podeDormir: boolean) {
  const comFoco = useJanelaComFoco();
  const [foto, setFoto] = useState<string | null>(null);
  const [montada, setMontada] = useState(true);

  useEffect(() => {
    if (comFoco) {
      if (!montada) setMontada(true); // acorda: o iframe volta; a foto fica até a cena dizer "pronto"
      return;
    }
    if (!montada || !podeDormir) return;
    const prazo = setTimeout(() => {
      // só dorme o que está à vista: guardada pelo CenaGuardada, ela já tem o prazo dela
      const el = iframe.current;
      if (!el || document.hasFocus() || !elementoAVista(el) || el.closest('.editor-cena.editando')) return;
      const imagem = fotografar(el);
      if (!imagem) return;
      setFoto(imagem);
      setMontada(false);
    }, (import.meta.env.DEV && (window as { prazoDaCenaDormir?: number }).prazoDaCenaDormir) || DORME_MS);
    return () => clearTimeout(prazo);
  }, [comFoco, montada, podeDormir, iframe]);

  return { montada, foto, acordou: () => setFoto(null) };
}
