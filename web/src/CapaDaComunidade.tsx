import { API_URL } from './api';
import { acharArte } from './boasVindas';
import type { Community } from './types';

// A CAPA DA COMUNIDADE: a faixa larga no alto da lista de canais.
//
// "A comunidade do Midjourney tem um fundo bem interessante. Isso torna as comunidades únicas e
// facilita ao usuário identificar rapidamente uma comunidade." É disso que se trata: o olho acha a
// cor antes de achar o nome, e cada comunidade passa a ter cara em vez de ser mais uma linha.
//
// DUAS CAMADAS, E ELAS NÃO SÃO ALTERNATIVAS:
//
//   1. O FUNDO. Uma foto, se o dono mandou uma; senão a arte que ele já escolheu para as boas-vindas
//      (um degradê, ver boasVindas.ts). Nunca há faixa vazia — pôr foto é melhorar o que já existe,
//      e não preencher um buraco. É também o que permite esta faixa nascer ligada para todo mundo.
//
//   2. O BRILHO. Uma faixa de luz que atravessa a capa devagar, por cima do fundo. É o elemento com
//      movimento que ele pediu ("não apenas imagem, mas elementos gráficos com movimento, como no
//      Call of Duty"), e é CSS puro: não pesa, não pede arquivo nenhum e não precisa de moderação.
//      GIF animado também vale como fundo, para quem quiser movimento de verdade.
//
// POR QUE NÃO VÍDEO. Uma capa em vídeo por comunidade significaria transcodificação, banda a cada
// abertura de tela e um caminho novo de moderação. O GIF cobre o caso de "quero que se mexa" com o
// que o navegador já sabe fazer, e o brilho cobre o resto sem custar byte nenhum.

export function CapaDaComunidade({
  community,
  arte: codigoDaArte,
  className,
}: {
  community: Community;
  /** O código da arte das boas-vindas, usado quando não há foto. */
  arte?: string | null;
  className?: string;
}) {
  const arte = acharArte(codigoDaArte);
  const temFoto = Boolean(community.bannerVersion);
  // A versão entra no endereço para o navegador buscar a nova quando ela troca — a mesma conta do
  // ícone. Sem isso, trocar a capa não mudaria nada na tela de quem já estava com o Syden aberto.
  const fundo = temFoto ? `url(${API_URL}/api/communities/${community.id}/capa?v=${community.bannerVersion})` : arte.fundo;

  return (
    <div
      className={`capa${temFoto ? ' com-foto' : ''}${className ? ` ${className}` : ''}`}
      // Sobre foto o texto vai sempre claro, com sombra: não dá para saber se a imagem é clara ou
      // escura sem lê-la pixel a pixel, e errar deixa o nome ilegível. Sobre degradê o tom vem junto
      // da arte, que é escolhida de uma lista conhecida.
      data-tom={temFoto ? 'escuro' : arte.tom}
      style={{ background: fundo }}
    />
  );
}
