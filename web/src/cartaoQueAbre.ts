// Um cartãozinho que abre num botão e fecha ao clicar fora.
//
// POR QUE ISTO PRECISOU EXISTIR. Os cartões da transmissão abriam ao passar o mouse e fechavam ao
// sair — e quem tentava usar o que havia dentro deles não conseguia. Duas razões, as duas invisíveis
// para quem escreveu e óbvias para quem usou:
//
//   1. o cartão abre alguns pixels ABAIXO do botão, e no caminho o ponteiro passa por esse vazio. Ali
//      ele não está nem no botão nem no cartão, o "saiu" dispara, e o cartão some antes de a pessoa
//      chegar nele. Foi o relato: "o botão fica sumindo".
//   2. uma listinha de opções (<select>) abre FORA da página, como janela do sistema. Enquanto ela
//      está aberta o ponteiro está, tecnicamente, fora do cartão — que então se fecha, levando a
//      listinha junto. Não existe conserto de geometria para este: enquanto for por passar o mouse,
//      escolher numa lista é impossível.
//
// Por isso: cartão com coisa para MEXER abre no clique. Cartão que só informa pode continuar no
// passar do mouse — ninguém precisa alcançá-lo.
import { useEffect, useRef, useState } from 'react';

export function useCartaoQueAbre<T extends HTMLElement = HTMLDivElement>() {
  const [aberto, setAberto] = useState(false);
  const area = useRef<T>(null);

  useEffect(() => {
    if (!aberto) return;
    /**
     * 'mousedown' e não 'click': o clique só termina quando o botão do mouse sobe, e nesse meio tempo
     * um clique na listinha de opções já teria trocado o que está debaixo do ponteiro.
     */
    const foraDaqui = (evento: MouseEvent) => {
      if (!area.current?.contains(evento.target as Node)) setAberto(false);
    };
    const escapou = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', foraDaqui);
    document.addEventListener('keydown', escapou);
    return () => {
      document.removeEventListener('mousedown', foraDaqui);
      document.removeEventListener('keydown', escapou);
    };
  }, [aberto]);

  return { aberto, area, alternar: () => setAberto((estava) => !estava), fechar: () => setAberto(false) };
}
