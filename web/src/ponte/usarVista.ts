import { useEffect, useRef, useState } from 'react';
import { DesenhoDaPonte } from './desenho';
import type { Fase } from './sim';
import type { VistaDaPonte } from './vista';

/**
 * A VISTA DA PONTE de uma tela (a montagem ou a reprise do fim): ABRE DIRETO NO 3D (cena3d.ts, num pedaço à parte, com o three.js);
 * enquanto carrega, a caixa fica com a cor do céu dela, e nada é desenhado. Sem WebGL, se a cena não carregar ou se o contexto se
 * perder, o 2D de reserva (desenho.ts), no mesmo lugar. Quem chama desenha um quadro por vez pela `vista` (que é null enquanto
 * carrega).
 */
export function useVistaDaPonte(fase: Fase) {
  const caixa3d = useRef<HTMLDivElement>(null);
  const tela2d = useRef<HTMLCanvasElement>(null);
  const vista = useRef<VistaDaPonte | null>(null);
  const [modo, setModo] = useState<'carregando' | '3d' | '2d'>(() => (temWebGL() ? 'carregando' : '2d'));
  const naReserva = modo === '2d';

  useEffect(() => {
    if (naReserva || !caixa3d.current) return;
    let viva = true;
    let criada: { destruir(): void } | null = null;
    const cair = () => {
      if (!viva) return;
      vista.current = null;
      criada?.destruir();
      criada = null;
      setModo('2d');
    };
    import('./cena3d')
      .then(async ({ CenaDaPonte }) => {
        if (!viva || !caixa3d.current) return;
        const cena = new CenaDaPonte(caixa3d.current, fase, cair);
        criada = cena;
        await cena.montar();
        if (!viva) return;
        vista.current = cena;
        if (import.meta.env.DEV) window.ponteCena = cena;
        setModo('3d');
      })
      .catch(cair);
    return () => {
      viva = false;
      criada?.destruir();
      criada = null;
      vista.current = null;
    };
  }, [fase, naReserva]);

  useEffect(() => {
    if (!naReserva) return;
    const ctx = tela2d.current?.getContext('2d');
    if (!ctx) return;
    const d = new DesenhoDaPonte(ctx, fase);
    vista.current = d;
    return () => {
      d.destruir();
      if (vista.current === d) vista.current = null;
    };
  }, [fase, naReserva]);

  return { caixa3d, tela2d, vista, modo };
}

declare global {
  interface Window {
    /** Só no site de desenvolvimento: a cena 3D aberta (a medida do quadro, nas fotos de conferência). */
    ponteCena?: { ms: number };
  }
}

function temWebGL(): boolean {
  // só no site de desenvolvimento: o e2e confere o 2D de reserva (localStorage 'ponte2d')
  if (import.meta.env.DEV) {
    try {
      if (localStorage.getItem('ponte2d')) return false;
    } catch {
      /* sem */
    }
  }
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
