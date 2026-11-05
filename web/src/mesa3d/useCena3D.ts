import { useEffect, useRef, useState } from 'react';
import { estiloVisual } from '../Graficos';
import './mesa3d.css';

/** O que a página precisa de uma cena de mesa (base.ts): nascer numa caixa, receber o estado e ir embora. */
export interface CenaDeMesa<D> {
  atualizar(d: D): void;
  montar(): Promise<void>;
  destruir(): void;
}
export type CriarCena<D> = (caixa: HTMLElement, aoClicar: (alvo: number) => void) => CenaDeMesa<D>;

/**
 * A cena 3D de uma mesa (Damas, Truco, Dominó), com o three.js num pedaço à parte (`importar` é o `import()` da cena). O
 * estado é 'falhou' de saída no estilo 2D (Gráficos) ou sem WebGL, e também se a cena não carregar: aí a página mostra o 2D.
 * Enquanto carrega, a página mostra o 2D também; pronta, o 2D fica só para o teclado e o leitor de tela.
 */
export function useCena3D<D>(importar: () => Promise<CriarCena<D>>, dados: D, aoClicar: (alvo: number) => void) {
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaDeMesa<D> | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (estiloVisual() === '3d' && temWebGL() ? 'carregando' : 'falhou'));
  const clicar = useRef(aoClicar);
  clicar.current = aoClicar;
  const ultimo = useRef(dados);
  ultimo.current = dados;
  useEffect(() => {
    if (estado === 'falhou' || !caixa.current) return;
    let viva = true;
    let criada: CenaDeMesa<D> | null = null;
    importar()
      .then(async (criar) => {
        if (!viva || !caixa.current) return;
        criada = criar(caixa.current, (a) => clicar.current(a));
        criada.atualizar(ultimo.current);
        await criada.montar();
        if (!viva) return;
        cena.current = criada;
        // o que mudou enquanto os modelos vinham
        criada.atualizar(ultimo.current);
        setEstado('pronta');
      })
      .catch(() => {
        criada?.destruir();
        criada = null;
        if (viva) setEstado('falhou');
      });
    return () => {
      viva = false;
      criada?.destruir();
      cena.current = null;
    };
    // a cena nasce uma vez por mesa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado === 'falhou']);
  const chave = JSON.stringify(dados);
  useEffect(() => {
    cena.current?.atualizar(ultimo.current);
  }, [chave]);
  return { caixa, estado };
}

function temWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
