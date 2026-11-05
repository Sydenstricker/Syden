import { useEffect, useRef, useState, type ReactNode } from 'react';
import { estiloVisual } from '../Graficos';
import type { MarDaCena, MarNaval3D } from './cena';

/**
 * Um mar da Batalha naval em 3D (cena.ts), com o three.js num pedaço à parte. A grade de botões do 2D (`grade`) fica sempre
 * na página: à mostra até a cena ficar pronta (ou para sempre, sem WebGL ou no estilo 2D), e depois escondida só dos olhos,
 * para o teclado e o leitor de tela continuarem atirando por ela.
 */
export function Mar3D({ dados, aoAtirar, grade }: { dados: MarDaCena; aoAtirar: (casa: number) => void; grade: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useRef<MarNaval3D | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (estiloVisual() === '3d' && temWebGL() ? 'carregando' : 'falhou'));
  const atirar = useRef(aoAtirar);
  atirar.current = aoAtirar;
  const ultimo = useRef(dados);
  ultimo.current = dados;

  useEffect(() => {
    if (estado === 'falhou' || !caixa.current) return;
    let viva = true;
    let criada: MarNaval3D | null = null;
    import('./cena')
      .then(async ({ MarNaval3D }) => {
        if (!viva || !caixa.current) return;
        criada = new MarNaval3D(caixa.current, (casa) => atirar.current(casa));
        criada.atualizar(ultimo.current);
        await criada.montar();
        if (!viva) return;
        cena.current = criada;
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
    // a cena nasce uma vez por mar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado === 'falhou']);

  useEffect(() => {
    cena.current?.atualizar(dados);
  }, [dados]);

  if (estado === 'falhou') return <>{grade}</>;
  return (
    <div className="naval-3d">
      <div ref={caixa} className={`naval-3d-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
      <div className={estado === 'pronta' ? 'naval-3d-grade-acessivel' : 'naval-3d-grade-reserva'}>{grade}</div>
    </div>
  );
}

function temWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
