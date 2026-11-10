import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useT } from './i18n';

/**
 * PIXEL ART NA FOLHA: ampliada (ou reduzida) por um número INTEIRO, a maior que cabe na altura, sem suavizar (escala quebrada borra). A largura é
 * posta ao carregar, quando se sabe o tamanho do desenho.
 */
export function PixelGrande({ src, altura, className }: { src: string; altura: number; className?: string }) {
  return (
    <img
      className={`pixel-grande${className ? ' ' + className : ''}`}
      src={src}
      alt=""
      draggable={false}
      onLoad={(e) => {
        const img = e.currentTarget;
        // o desenho já ampliado (o busto do 16 tem 256 px) desce por um divisor inteiro, que também não borra
        const escala = img.naturalHeight <= altura ? Math.floor(altura / img.naturalHeight) : 1 / Math.ceil(img.naturalHeight / altura);
        img.style.width = `${img.naturalWidth * escala}px`;
        img.style.height = `${img.naturalHeight * escala}px`;
      }}
    />
  );
}

/**
 * UMA LINHA DO PERSONAGEM: um atributo com as setas ‹ › dos dois lados, como nos jogos de criar personagem (o desenho
 * dele). Hoje só existem as linhas que têm opções de verdade: o coelho pronto e o bicho. QUANDO A CUSTOMIZAÇÃO CHEGAR (o
 * personagem montado: cores, acessórios), cada atributo é mais uma <LinhaDoPersonagem> embaixo da do coelho; linha sem
 * opção não aparece — a tela não afirma o que não é.
 */
export function LinhaDoPersonagem({ rotulo, valor, anterior, proximo, ocupado }: { rotulo: string; valor: string; anterior: () => void; proximo: () => void; ocupado?: boolean }) {
  const t = useT();
  return (
    <div className="personagem-linha" role="group" aria-label={rotulo}>
      <button type="button" className="personagem-seta" onClick={anterior} disabled={ocupado} aria-label={`${t('Anterior')}: ${rotulo}`} title={t('Anterior')}>
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <span className="personagem-valor" aria-live="polite">
        <small>{rotulo}</small>
        <strong>{valor}</strong>
      </span>
      <button type="button" className="personagem-seta" onClick={proximo} disabled={ocupado} aria-label={`${t('Próximo')}: ${rotulo}`} title={t('Próximo')}>
        <ChevronRight size={22} aria-hidden="true" />
      </button>
    </div>
  );
}

