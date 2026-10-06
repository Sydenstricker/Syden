// Põe um vídeo da chamada numa janela separada, para quem tem dois monitores.
//
// A IDEIA VEIO NO LUGAR DE UM LAYOUT ARRASTÁVEL, e é melhor por uma razão simples: quem tem duas telas
// não quer reorganizar painéis, quer ver duas coisas ao mesmo tempo. Uma janela de verdade resolve isso
// sem pedir que ninguém projete a própria interface — e ninguém pode se perder, porque fechar a janela
// devolve tudo ao normal.
//
// USA A Document Picture-in-Picture API, e não o PiP comum de vídeo. O PiP comum só sabe mostrar um
// <video> nu: sem nome de quem transmite, sem botão nenhum, e com os controles do navegador por cima. O
// Document PiP abre uma JANELA COM UM DOCUMENTO DENTRO, onde cabe o que a gente quiser desenhar.
//
// Existe no Chrome, no Edge e no app de desktop (Electron 44). Não existe no Firefox nem no Safari — daí
// `janelaDestacadaDisponivel()`: o botão só aparece onde funciona, em vez de aparecer e falhar.

interface JanelaPiP extends Window {
  document: Document;
}

interface DocumentPiP {
  requestWindow(opcoes?: { width?: number; height?: number }): Promise<JanelaPiP>;
  window: JanelaPiP | null;
}

const api = (): DocumentPiP | undefined =>
  (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture;

export const janelaDestacadaDisponivel = () => typeof api()?.requestWindow === 'function';

/**
 * Leva o CSS do Syden para dentro da janela nova.
 *
 * A janela nasce com um documento VAZIO — sem folha de estilo nenhuma. Sem isto, o vídeo apareceria
 * cru, encostado no canto, com a letra padrão do navegador.
 *
 * As folhas de outro domínio (a fonte do Google) estouram ao ler `cssRules`, por regra do navegador, e
 * por isso entram como <link> em vez de texto copiado.
 */
function levarOsEstilos(destino: Document) {
  for (const folha of Array.from(document.styleSheets)) {
    try {
      const texto = Array.from(folha.cssRules)
        .map((regra) => regra.cssText)
        .join('\n');
      const estilo = destino.createElement('style');
      estilo.textContent = texto;
      destino.head.append(estilo);
    } catch {
      if (!folha.href) continue;
      const link = destino.createElement('link');
      link.rel = 'stylesheet';
      link.href = folha.href;
      destino.head.append(link);
    }
  }
  // O tema é um atributo no <html>, e não uma folha de estilo: sem copiá-lo, a janela nova abriria no
  // tema escuro mesmo para quem usa o claro.
  const tema = document.documentElement.getAttribute('data-theme');
  if (tema) destino.documentElement.setAttribute('data-theme', tema);
  // A paleta e a cor escolhida, pelo mesmo motivo: sem elas a janela abriria na D4 e no âmbar.
  const paleta = document.documentElement.getAttribute('data-paleta');
  if (paleta) destino.documentElement.setAttribute('data-paleta', paleta);
  const proprio = document.documentElement.style;
  for (const nome of ['--accent', '--accent-hover', '--accent-texto']) {
    const valor = proprio.getPropertyValue(nome);
    if (valor) destino.documentElement.style.setProperty(nome, valor);
  }
}

export interface JanelaAberta {
  fechar(): void;
}

/**
 * Abre a janela com o vídeo de alguém dentro.
 *
 * O VÍDEO É COPIADO, E NÃO MOVIDO, e essa é a decisão que faz isto ser seguro. Mover o elemento de
 * verdade para outro documento funciona — a Document PiP existe para isso — mas o elemento é gerenciado
 * pelo React, e React que vai remover um nó de um pai que não é mais o dele estoura com
 * "node to be removed is not a child". Aconteceria quando alguém saísse da chamada com a janela aberta.
 *
 * Copiar custa uma decodificação de vídeo a mais e não custa nenhuma reconexão: o MediaStream pode
 * alimentar dois <video> ao mesmo tempo, e os dois mostram a mesma imagem ao vivo.
 */
export async function destacarVideo(
  origem: HTMLVideoElement,
  titulo: string,
  aoFechar?: () => void,
): Promise<JanelaAberta | null> {
  const pip = api();
  if (!pip?.requestWindow) return null;

  // Abre com a proporção do vídeo, para não nascer com tarjas pretas dos dois lados.
  const largura = origem.videoWidth || 960;
  const altura = origem.videoHeight || 540;
  const escala = Math.min(1, 720 / Math.max(largura, 1));

  const janela = await pip.requestWindow({
    width: Math.round(largura * escala),
    height: Math.round(altura * escala),
  });

  levarOsEstilos(janela.document);
  janela.document.title = titulo;
  janela.document.body.classList.add('janela-destacada');

  const video = janela.document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  // Mudo de propósito: o som continua saindo pela janela principal, onde o volume de cada pessoa já é
  // ajustável. Dois elementos tocando o mesmo áudio dariam eco.
  video.muted = true;
  video.srcObject = origem.srcObject;

  const rotulo = janela.document.createElement('span');
  rotulo.className = 'janela-destacada-nome';
  rotulo.textContent = titulo;

  janela.document.body.append(video, rotulo);
  void video.play().catch(() => {
    // Alguns navegadores recusam tocar sem gesto; o autoplay de vídeo mudo costuma passar, e se não
    // passar a pessoa clica no vídeo. Travar a abertura por causa disso seria pior.
  });

  janela.addEventListener('pagehide', () => {
    video.srcObject = null;
    aoFechar?.();
  });

  return {
    fechar() {
      janela.close();
    },
  };
}
