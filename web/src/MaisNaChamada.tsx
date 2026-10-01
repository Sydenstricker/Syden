import { MoreHorizontal } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { IconButton } from './IconButton';

// O "..." da barra da chamada: guarda o que se usa pouco.
//
// A barra tinha dez botões lado a lado, e o preço disso não é só feiúra. Numa fileira de dez ícones
// parecidos, encontrar o do microfone leva o mesmo tempo que encontrar o do karaokê — a barra deixa de
// ter hierarquia, e o que se usa toda hora fica tão escondido quanto o que se usa uma vez por mês.
//
// Fora daqui ficam cinco: microfone, áudio, câmera, tela e desligar. São os que se aperta no meio de uma
// conversa, às vezes com pressa, e que por isso precisam estar sempre a um clique — nunca a dois.
//
// A REGRA PARA ACRESCENTAR COISA: se pode ser apertado com pressa, fica fora; se é uma decisão, entra.

export function MaisNaChamada({ children, quantosAtivos = 0 }: { children: ReactNode; quantosAtivos?: number }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (evento: PointerEvent) => {
      if (!ref.current?.contains(evento.target as Node)) setAberto(false);
    };
    const escape = (evento: KeyboardEvent) => evento.key === 'Escape' && setAberto(false);
    window.addEventListener('pointerdown', fechar);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', fechar);
      window.removeEventListener('keydown', escape);
    };
  }, [aberto]);

  return (
    <div className="mais-anchor" ref={ref}>
      <IconButton label="Mais" active={aberto || quantosAtivos > 0} onClick={() => setAberto(!aberto)}>
        <MoreHorizontal />
      </IconButton>
      {/*
        A bolinha existe para o menu não esconder o que está LIGADO. Sem ela, quem deixou um modificador
        de voz aceso e fechou o menu não tem como saber disso — e vai passar a chamada inteira soando
        como um esquilo achando que é problema do microfone.
      */}
      {quantosAtivos > 0 && !aberto && <span className="mais-aceso" aria-hidden="true" />}
      {/*
        O MENU NÃO SE FECHA MAIS AO CLIQUE DE QUALQUER COISA DENTRO DELE, e aqui estava um defeito que
        derrubava três funções de uma vez.

        Havia um `onClick={() => setAberto(false)}` nesta div. Como clique borbulha, apertar QUALQUER
        botão aqui dentro desmontava o menu inteiro no mesmo instante — e quase tudo o que mora aqui
        ABRE alguma coisa em vez de terminar numa ação:

          - a tesoura começava a fechar o clipe e era desmontada antes de ele existir. Pior: o
            desmonte parava a gravação em rolagem, então cada abertura do menu recomeçava do zero e
            a tesoura voltava a ficar três segundos apagada. "Cliquei na tesoura, não aconteceu
            nada" — e não acontecia mesmo;
          - o modificador de voz e o efeito visual abriam o submenu deles no mesmo clique em que o
            menu de cima sumia, levando o submenu junto.

        Fechar continua acontecendo pelos dois caminhos que sempre funcionaram e não dependem de
        adivinhar o que o filho faz: clicar fora (pointerdown) e Escape.
      */}
      {aberto && (
        <div className="mais-menu" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}
