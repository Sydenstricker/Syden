import { X } from 'lucide-react';
import { useEffect } from 'react';
import cafeOriginal from './assets/cartao/cafe.webp';
import { useT } from './i18n';
import { descricaoDaPeca, type GrupoDaCena, nomeDaPeca } from './nomesDaCena';
import type { Figuras } from './QuartoNovo';

export interface PecaClicada {
  grupo: GrupoDaCena;
  id: string;
}

/**
 * A IMAGEM ORIGINAL da peça que nasceu de uma imagem de fora (relato dele, 17/10/2026: "a imagem original ficou
 * diferente quando clicado"). Na parede ela é reduzida a pixel art e inclinada (parede/de-imagem.py); no cartão, quem
 * clicou quer ver a arte inteira. A versão leve sai de parede-salao/<peça>/origem.png (1,5 MB lá, ~50 KB aqui).
 */
const ORIGINAIS: Partial<Record<GrupoDaCena, Record<string, string>>> = { p: { cafe: cafeOriginal } };

/** A figura da peça: a original, se houver; senão a do catálogo do Editar (as cópias "cama~2" usam a do tipo). */
function figuraDe(figuras: Figuras | null, { grupo, id }: PecaClicada): { src: string; original: boolean } | undefined {
  const tipo = id.split('~')[0];
  const original = ORIGINAIS[grupo]?.[tipo];
  if (original) return { src: original, original: true };
  if (!figuras) return undefined;
  const tabela = grupo === 'm' ? figuras.moveis : grupo === 'p' ? figuras.miniaturas : grupo === 'o' ? figuras.deCima : undefined;
  const src = tabela?.[tipo] ?? tabela?.[tipo.replace(/-\d+$/, '')];
  return src ? { src, original: false } : undefined;
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
          <div className={`cartao-da-peca-figura${figura.original ? ' original' : ''}`}>
            <img src={figura.src} alt="" />
          </div>
        )}
        <h2 id="cartao-da-peca-nome">{nome}</h2>
        {frase && <p>{frase}</p>}
      </div>
    </div>
  );
}
