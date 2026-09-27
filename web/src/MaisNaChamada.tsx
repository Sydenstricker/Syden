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
      {aberto && (
        <div className="mais-menu" role="menu" onClick={() => setAberto(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
