import { RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

/** O zoom do cartão: de 1× (a figura inteira na caixa) a 4×, em passos de 1,25. */
const ZOOM_MAXIMO = 4;
/** Quantos pixels de arraste giram a peça uma vista. */
const PASSO_DO_ARRASTE = 28;

/**
 * O CARTÃO DE UMA PEÇA DO QUARTO OU DO SALÃO (pedido dele, 17/10/2026): clicar numa peça sem função abre a figura grande,
 * o nome e uma frase sobre ela. A página da cena só diz qual peça foi; o nome e a frase são traduzidos aqui
 * (nomesDaCena.ts). Fecha no X, no Esc ou clicando fora.
 *
 * INSPECIONAR, COMO NO RESIDENT EVIL (pedido dele, 18/10/2026): a peça GIRA e AMPLIA. As vistas são as mesmas que giram a
 * peça na cena (4 nos móveis e nos objetos de cima, 8 na cadeira do computador), pedidas à página só quando o cartão abre
 * (`vistasDe`); a peça da parede tem uma vista só e só amplia. Girar: arrastar para os lados, as setas do teclado ou os
 * botões. Ampliar: a roda do mouse, a pinça, + e −, ou os botões; sempre com os pixels nítidos.
 */
export function CartaoDaPeca({
  peca,
  figuras,
  aoFechar,
  enviar,
}: {
  peca: PecaClicada;
  figuras: Figuras | null;
  aoFechar: () => void;
  /** Fala com a página da cena (para pedir as vistas da peça). Sem ele, o cartão mostra só a figura, sem girar. */
  enviar?: (msg: Record<string, unknown>) => void;
}) {
  const t = useT();
  const [vistas, setVistas] = useState<string[]>([]);
  const [vista, setVista] = useState(0);
  const [zoom, setZoom] = useState(1);
  const caixa = useRef<HTMLDivElement>(null);
  const figura = figuraDe(figuras, peca);
  const giraveis = !figura?.original && vistas.length > 1;
  const src = !figura?.original && vistas.length ? vistas[vista % vistas.length] : figura?.src;

  const girar = (passo: number) => giraveis && setVista((v) => (v + passo + vistas.length) % vistas.length);
  const ampliar = (fator: number) => setZoom((z) => Math.min(ZOOM_MAXIMO, Math.max(1, Math.round(z * fator * 100) / 100)));

  // as vistas da peça, pedidas à página assim que o cartão abre
  useEffect(() => {
    setVistas([]);
    setVista(0);
    setZoom(1);
    if (!enviar) return;
    const ouvir = (e: MessageEvent) => {
      const v = e.data?.syden === 'quarto' ? e.data.vistas : null;
      if (e.origin !== location.origin || !v || v.grupo !== peca.grupo || v.id !== peca.id || !Array.isArray(v.imagens)) return;
      setVistas(v.imagens.filter((i: unknown) => typeof i === 'string' && i.startsWith('data:image/')));
    };
    window.addEventListener('message', ouvir);
    enviar({ vistasDe: { grupo: peca.grupo, id: peca.id } });
    return () => window.removeEventListener('message', ouvir);
  }, [peca.grupo, peca.id]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
      else if (e.key === 'ArrowLeft') girar(-1);
      else if (e.key === 'ArrowRight') girar(1);
      else if (e.key === '+' || e.key === '=') ampliar(1.25);
      else if (e.key === '-') ampliar(1 / 1.25);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar, giraveis, vistas.length]);

  // a roda do mouse amplia (fora do React: o onWheel dele é passivo, e a página rolaria junto)
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      ampliar(e.deltaY < 0 ? 1.25 : 1 / 1.25);
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, [src]);

  // arrastar gira; dois dedos ampliam (a pinça)
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const arraste = useRef<{ x: number; distancia: number } | null>(null);
  const distancia = () => {
    const [a, b] = [...dedos.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const apertar = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    arraste.current = { x: e.clientX, distancia: distancia() };
  };
  const mover = (e: React.PointerEvent) => {
    if (!dedos.current.has(e.pointerId) || !arraste.current) return;
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.current.size >= 2) {
      const d = distancia();
      if (arraste.current.distancia > 0 && Math.abs(d / arraste.current.distancia - 1) > 0.15) {
        ampliar(d / arraste.current.distancia);
        arraste.current.distancia = d;
      } else if (!arraste.current.distancia) arraste.current.distancia = d;
      return;
    }
    const dx = e.clientX - arraste.current.x;
    if (Math.abs(dx) >= PASSO_DO_ARRASTE) {
      girar(dx > 0 ? -1 : 1); // arrastar para a direita vira a frente da peça para a direita
      arraste.current.x = e.clientX;
    }
  };
  const soltar = (e: React.PointerEvent) => {
    dedos.current.delete(e.pointerId);
    arraste.current = dedos.current.size ? { x: [...dedos.current.values()][0].x, distancia: distancia() } : null;
  };

  const nome = nomeDaPeca(t, peca.grupo, peca.id);
  const frase = descricaoDaPeca(t, peca.grupo, peca.id);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog cartao-da-peca" role="dialog" aria-modal="true" aria-labelledby="cartao-da-peca-nome">
        {/* o foco vem para cá: o clique deixou o teclado dentro da cena (o iframe), e o Esc não chegaria */}
        <button type="button" className="cartao-da-peca-fechar" onClick={aoFechar} aria-label={t('Fechar')} title={t('Fechar')} autoFocus>
          <X size={18} aria-hidden="true" />
        </button>
        {src && (
          <>
            <div
              ref={caixa}
              className={`cartao-da-peca-figura${figura?.original ? ' original' : ''}${giraveis ? ' giravel' : ''}`}
              onPointerDown={apertar}
              onPointerMove={mover}
              onPointerUp={soltar}
              onPointerCancel={soltar}
            >
              <img src={src} alt="" draggable={false} style={{ transform: `scale(${zoom})` }} />
            </div>
            <div className="cartao-da-peca-controles">
              {giraveis && (
                <button type="button" className="icon-plain" onClick={() => girar(-1)} aria-label={t('Girar')} title={t('Girar')}>
                  <RotateCcw size={18} aria-hidden="true" />
                </button>
              )}
              <button type="button" className="icon-plain" onClick={() => ampliar(1 / 1.25)} disabled={zoom <= 1} aria-label={t('Reduzir')} title={t('Reduzir')}>
                <ZoomOut size={18} aria-hidden="true" />
              </button>
              <button type="button" className="icon-plain" onClick={() => ampliar(1.25)} disabled={zoom >= ZOOM_MAXIMO} aria-label={t('Ampliar')} title={t('Ampliar')}>
                <ZoomIn size={18} aria-hidden="true" />
              </button>
              {giraveis && (
                <button type="button" className="icon-plain" onClick={() => girar(1)} aria-label={t('Girar')} title={t('Girar')}>
                  <RotateCw size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        )}
        <h2 id="cartao-da-peca-nome">{nome}</h2>
        {frase && <p>{frase}</p>}
      </div>
    </div>
  );
}
