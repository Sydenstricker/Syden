import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useT } from './i18n';
import { descricaoDaPeca, type GrupoDaCena, nomeDaPeca } from './nomesDaCena';
import type { Figuras } from './QuartoNovo';

export interface PecaClicada {
  grupo: GrupoDaCena;
  id: string;
}

/** A figura da peça no catálogo do Editar (as cópias "cama~2" e os iguais com número usam a do tipo). */
function figuraDe(figuras: Figuras | null, { grupo, id }: PecaClicada): string | undefined {
  if (!figuras) return undefined;
  const tipo = id.split('~')[0];
  const tabela = grupo === 'm' ? figuras.moveis : grupo === 'p' ? figuras.miniaturas : grupo === 'o' ? figuras.deCima : undefined;
  return tabela?.[tipo] ?? tabela?.[tipo.replace(/-\d+$/, '')];
}

/**
 * O CARTÃO DE UMA PEÇA DO QUARTO OU DO SALÃO (pedido dele, 17/10/2026): clicar numa peça sem função abre a figura grande,
 * o nome e uma frase sobre ela. A página da cena só diz qual peça foi; o nome e a frase são traduzidos aqui
 * (nomesDaCena.ts). Fecha no X, no Esc ou clicando fora.
 */
export function CartaoDaPeca({ peca, figuras, aoFechar }: { peca: PecaClicada; figuras: Figuras | null; aoFechar: () => void }) {
  const t = useT();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  const figura = figuraDe(figuras, peca);
  const nome = nomeDaPeca(t, peca.grupo, peca.id);
  const frase = descricaoDaPeca(t, peca.grupo, peca.id);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog cartao-da-peca" role="dialog" aria-modal="true" aria-labelledby="cartao-da-peca-nome">
        {/* o foco vem para cá: o clique deixou o teclado dentro da cena (o iframe), e o Esc não chegaria */}
        <button type="button" className="cartao-da-peca-fechar" onClick={aoFechar} aria-label={t('Fechar')} title={t('Fechar')} autoFocus>
          <X size={18} aria-hidden="true" />
        </button>
        {figura && (
          <div className="cartao-da-peca-figura">
            <img src={figura} alt="" />
          </div>
        )}
        <h2 id="cartao-da-peca-nome">{nome}</h2>
        {frase && <p>{frase}</p>}
      </div>
    </div>
  );
}
