import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CenaDasCidades, DadosDaCena } from './cena';

/**
 * A caixa do tabuleiro 3D (cena.ts). O three.js vem num pedaço à parte, só quando o Cidades abre. Enquanto a cena não
 * está pronta — ou se não puder existir (sem WebGL, modelo que não carregou) — fica a `reserva`, o tabuleiro desenhado
 * em SVG: a tela nunca fica vazia nem finge um estado.
 */
export function Tabuleiro3D({ dados, aoEscolher, reserva, meio, rotulo }: { dados: DadosDaCena; aoEscolher: (i: number) => void; reserva: ReactNode; meio?: ReactNode; rotulo: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaDasCidades | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronta' | 'falhou'>(() => (temWebGL() ? 'carregando' : 'falhou'));
  const escolher = useRef(aoEscolher);
  escolher.current = aoEscolher;
  const ultimo = useRef(dados);
  ultimo.current = dados;

  useEffect(() => {
    if (estado === 'falhou' || !caixa.current) return;
    let viva = true;
    let criada: CenaDasCidades | null = null;
    import('./cena')
      .then(async ({ CenaDasCidades }) => {
        if (!viva || !caixa.current) return;
        criada = new CenaDasCidades(caixa.current, (i) => escolher.current(i));
        await criada.montar();
        if (!viva) return;
        cena.current = criada;
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
    // a cena nasce uma vez por tabuleiro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado === 'falhou']);

  useEffect(() => {
    cena.current?.atualizar(dados);
  }, [dados]);

  if (estado === 'falhou') return <>{reserva}</>;
  return (
    <div className="cid-tabuleiro-3d" role="img" aria-label={rotulo}>
      {estado !== 'pronta' && <div className="cid-tabuleiro-3d-reserva">{reserva}</div>}
      <div ref={caixa} className={`cid-tabuleiro-3d-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
      {estado === 'pronta' && meio && <div className="cid-tabuleiro-3d-meio">{meio}</div>}
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
