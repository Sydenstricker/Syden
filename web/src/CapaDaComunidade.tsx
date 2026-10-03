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
  posicao,
}: {
  community: Community;
  /** O código da arte das boas-vindas, usado quando não há foto. */
  arte?: string | null;
  className?: string;
  /** Altura à vista, só enquanto alguém arrasta a prévia nas Configurações. */
  posicao?: number;
}) {
  const arte = acharArte(codigoDaArte);
  const temFoto = Boolean(community.bannerVersion);
  // A versão entra no endereço para o navegador buscar a nova quando ela troca — a mesma conta do
  // ícone. Sem isso, trocar a capa não mudaria nada na tela de quem já estava com o Syden aberto.
  const fundo = temFoto ? `url(${API_URL}/api/communities/${community.id}/capa?v=${community.bannerVersion})` : arte.fundo;

  /*
   * O ENCAIXE É DE EXIBIÇÃO, e precisa ser.
   *
   * Imagem estática é recortada no envio, no tamanho exato da faixa. GIF animado não pode ser —
   * redesenhá-lo num canvas guardaria só o primeiro quadro —, então ele entra na proporção que
   * tiver. Quando essa proporção é muito diferente da faixa, "preencher" corta demais.
   *
   * "inteira" é `contain`: aparece o GIF todo, com a cor do fundo nas sobras. "preencher" é o de
   * sempre, e aí a régua escolhe que altura fica à vista.
   */
  const inteira = community.capaEncaixe === 'inteira';
  // `posicao` só vem das Configurações, ENQUANTO O DEDO ESTÁ ARRASTANDO: ali a capa precisa seguir o
  // ponteiro antes de haver qualquer coisa guardada. Em todo o resto do app ninguém a passa, e vale
  // o que está no banco.
  const altura = posicao ?? community.capaPosicao ?? 50;

  return (
    <div
      className={`capa${temFoto ? ' com-foto' : ''}${className ? ` ${className}` : ''}`}
      // Sobre foto o texto vai sempre claro, com sombra: não dá para saber se a imagem é clara ou
      // escura sem lê-la pixel a pixel, e errar deixa o nome ilegível. Sobre degradê o tom vem junto
      // da arte, que é escolhida de uma lista conhecida.
      data-tom={temFoto ? 'escuro' : arte.tom}
      /*
       * `backgroundImage`, E NÃO O ATALHO `background` — e é isto que explica os dois `!important`
       * que estavam no CSS. O atalho REESCREVE todas as propriedades de fundo, inclusive as que
       * ninguém mencionou: posto aqui, ele devolvia `background-size` e `background-position` ao
       * valor inicial, e a folha de estilo só vencia gritando. Com a propriedade longa, o CSS vale
       * normalmente e estas duas linhas conseguem ajustá-lo.
       */
      style={{
        backgroundImage: fundo,
        ...(temFoto && {
          backgroundSize: inteira ? 'contain' : 'cover',
          backgroundPosition: inteira ? 'center' : `center ${altura}%`,
          backgroundRepeat: 'no-repeat',
        }),
      }}
    />
  );
}
