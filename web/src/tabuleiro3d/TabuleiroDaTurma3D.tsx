import { useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { useCena3D, type CriarCena } from '../mesa3d/useCena3D';
import type { DadosDoTabuleiro3D } from './cena';
import './tabuleiro3d.css';

/** O three.js e a cena vêm num pedaço à parte, só quando o tabuleiro abre. */
const importar = (): Promise<CriarCena<DadosDoTabuleiro3D>> => import('./cena').then((m) => m.criarCenaDoTabuleiro);

/**
 * A caixa do Tabuleiro da turma em 3D (cena.ts), pelo gancho comum das cenas (mesa3d/useCena3D.ts): enquanto carrega, a cor do
 * céu; pronta, o desenho em SVG fica só para o leitor de tela; no estilo 2D, sem WebGL ou se a cena falhar, ele é o tabuleiro.
 * A câmera é de cada um: "Ver tudo" aparece quando ela saiu da vista geral (seguindo quem anda, girada ou aproximada).
 */
export function TabuleiroDaTurma3D({ dados, reserva }: { dados: Omit<DadosDoTabuleiro3D, 'verTudo'>; reserva: ReactNode }) {
  const t = useT();
  const [verTudo, setVerTudo] = useState(0);
  const [livre, setLivre] = useState(false);
  const { caixa, estado } = useCena3D(importar, { ...dados, verTudo }, (a) => setLivre(a === 1));
  if (estado === 'falhou') return <>{reserva}</>;
  return (
    <div className="tab3d">
      <div ref={caixa} className={`tab3d-caixa${estado === 'pronta' ? '' : ' escondida'}`} />
      <div className="mesa3d-so-leitor">{reserva}</div>
      {estado === 'pronta' && livre && (
        <button type="button" className="tab3d-ver-tudo" onClick={() => setVerTudo((n) => n + 1)}>
          {t('Ver tudo')}
        </button>
      )}
    </div>
  );
}
