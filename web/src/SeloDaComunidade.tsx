/**
 * O selo de uma comunidade, do tamanho de uma palavra.
 *
 * Ele aparece colado no nome das pessoas, no chat e na lista de membros — ou seja, MUITAS VEZES na
 * mesma tela. Por isso é desenhado em SVG inline e não por imagem: nenhum pedido à rede, nenhuma
 * espera, e ele acompanha o tamanho da letra em volta.
 *
 * Os ícones são poucos e fechados, e a razão está em selos.ts: deixar subir imagem qualquer num
 * lugar que aparece ao lado do nome de todo mundo criaria um espaço de publicidade e um trabalho de
 * moderação que ninguém pediu.
 */

interface Selo {
  texto: string;
  icone: string;
  cor: string;
}

/** Cada ícone é um caminho SVG numa caixa de 16×16. */
const DESENHOS: Record<string, string> = {
  estrela: 'M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.3 4.2 13.3l.7-4.3-3.1-3 4.3-.6z',
  coelho: 'M5 6C4 3.5 4.3 1.5 5.4 1.5S7 3.5 6.7 6zm6 0C12 3.5 11.7 1.5 10.6 1.5S9 3.5 9.3 6zM8 6c2.5 0 4.2 2 4.2 4.3S10.4 14.5 8 14.5s-4.2-1.9-4.2-4.2S5.5 6 8 6z',
  coroa: 'M2 12h12l1-7-3.5 2.5L8 3 4.5 7.5 1 5z',
  fogo: 'M8 1.5s.8 2.6-1 4.5C5 8 3.5 9 3.5 11a4.5 4.5 0 009 0c0-2.3-1.8-3.4-1.8-3.4s-.3 1.6-1.2 1.6c-.8 0-1-.9-.6-2 .5-1.4.9-3.6-.9-5.7z',
  folha: 'M13.5 2.5C7 2 3 4.5 3 9c0 1.6.5 2.9 1.3 3.9L2.5 14.7l1 1 1.8-1.8c1 .8 2.3 1.3 3.9 1.3 4.5 0 7-4 6.3-12.7z',
  raio: 'M9.5 1.5L3 9h4l-.5 5.5L13 7H9z',
  coracao: 'M8 14S1.5 10 1.5 5.8A3.3 3.3 0 018 4.3a3.3 3.3 0 016.5 1.5C14.5 10 8 14 8 14z',
  escudo: 'M8 1.5l5.5 2v4.8c0 3.3-2.3 5.5-5.5 6.2-3.2-.7-5.5-2.9-5.5-6.2V3.5z',
  lua: 'M13.5 10.2A6 6 0 015.8 2.5a6 6 0 107.7 7.7z',
  trevo: 'M8 15V9m0 0c-1.5 1.5-4 1.7-5-.3-.9-1.8.6-3.3 2-3.2-1-1.1-.7-3 1-3.4 1.2-.3 1.9.6 2 1.4.1-.8.8-1.7 2-1.4 1.7.4 2 2.3 1 3.4 1.4-.1 2.9 1.4 2 3.2-1 2-3.5 1.8-5 .3z',
};

export function SeloDaComunidade({ selo, soIcone = false }: { selo: Selo; soIcone?: boolean }) {
  const caminho = DESENHOS[selo.icone] ?? DESENHOS.estrela;

  return (
    <span
      className={`selo-comunidade${soIcone ? ' so-icone' : ''}`}
      style={{ background: selo.cor }}
      // O título dá o nome por escrito a quem passa o mouse; o aria-label serve a leitor de tela.
      title={selo.texto}
      aria-label={soIcone ? undefined : `Selo ${selo.texto}`}
    >
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
        <path d={caminho} fill="currentColor" />
      </svg>
      {!soIcone && selo.texto}
    </span>
  );
}
