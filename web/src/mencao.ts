// "Mencionar" no menu do botão direito: o nome da pessoa cai no campo de escrever da conversa aberta.
//
// Quem clica está na lista de pessoas (ou na barra lateral), e o campo de escrever está do outro lado da
// tela, em outro componente. Em vez de passar função por meia dúzia de camadas, o pedido é anunciado
// aqui e o campo de escrever escuta — quem estiver montado atende.

type Ouvinte = (nome: string) => void;

const ouvintes = new Set<Ouvinte>();

/** Pede para o campo de escrever aberto colocar "@fulano " no fim do texto. */
export function pedirMencao(nome: string) {
  for (const ouvinte of ouvintes) ouvinte(nome);
}

/** O campo de escrever avisa que está pronto para atender; devolve a função que desliga. */
export function aoPedirMencao(ouvinte: Ouvinte) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}
