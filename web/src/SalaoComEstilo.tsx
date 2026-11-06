import { type ReactNode, useState } from 'react';
import { escolherEstiloVisual, useEstiloDoQuarto } from './Graficos';
import { useT } from './i18n';
import { FiguraCubo, FiguraPixel } from './QuartoComEstilo';
import type { AcoesDoSalao } from './Salao';
import { type PessoaNoSalao3DDeFora, Salao3D } from './salao3d/Salao3D';
import './salao3d/salao3d.css';

/**
 * O SALÃO EM DOIS ESTILOS (06/11/2026, pedido dele: o Natal "no salão, em 3D"), como o QuartoComEstilo.tsx: o botão do canto e
 * Configurações → Gráficos → "Estilo visual" mexem na MESMA escolha (uma só para o quarto, o salão e os jogos, decisão dele), e
 * a troca é na hora. O padrão é o do quarto (`estiloDoQuarto`: o pixel art, até ele decidir). Sem WebGL ou com falha, volta o
 * pixel art sozinho. `children` é o salão de pixel art como o início da comunidade já o monta (o isométrico, o de frente ou a
 * espera); no 3D, o Editar não aparece: arrumar o salão é no pixel art.
 */
export function SalaoComEstilo({
  noite,
  acoes,
  pessoas,
  aoVivo,
  recado,
  imagem,
  titulo,
  children,
}: {
  noite: boolean;
  acoes: AcoesDoSalao;
  pessoas: PessoaNoSalao3DDeFora[];
  aoVivo: { nome: string; sub: string; total: number; aoTrocar: (passo: 1 | -1) => void } | null;
  recado: { titulo: string; texto: string } | null;
  imagem: { url: string; encaixe: string } | null;
  titulo: string;
  children: ReactNode;
}) {
  const t = useT();
  const estilo = useEstiloDoQuarto();
  const [falhou, setFalhou] = useState(false);
  const em3d = estilo === '3d' && !falhou;
  const alternar = () => {
    if (em3d) escolherEstiloVisual('2d');
    else {
      setFalhou(false);
      escolherEstiloVisual('3d');
    }
  };
  const nome = `${t('Estilo visual')}: ${em3d ? '3D' : '2D'}`;
  return (
    <div className="salao-com-estilo">
      {em3d ? (
        <Salao3D
          noite={noite}
          acoes={acoes}
          pessoas={pessoas}
          aoVivo={aoVivo}
          recado={recado}
          imagem={imagem}
          titulo={titulo}
          aoFalhar={() => setFalhou(true)}
        />
      ) : (
        children
      )}
      <button type="button" className="quarto-estilo-botao" aria-label={nome} title={nome} onClick={alternar}>
        <span className={em3d ? '' : 'aceso'}>
          <FiguraPixel />
        </span>
        <span className={em3d ? 'aceso' : ''}>
          <FiguraCubo />
        </span>
      </button>
    </div>
  );
}
