import { type CSSProperties, useEffect, useRef, useState } from 'react';
import diaUrl from './assets/quarto/dia.png';
import noiteUrl from './assets/quarto/noite.png';
import coelhoUrl from './assets/quarto/coelho.png';
import gatoUrl from './assets/quarto/gato.png';
import mascaraAbajur from './assets/quarto/mascara-abajur.png';
import mascaraArmario from './assets/quarto/mascara-armario.png';
import mascaraComputador from './assets/quarto/mascara-computador.png';
import mascaraCortica from './assets/quarto/mascara-cortica.png';
import mascaraFone from './assets/quarto/mascara-fone.png';
import mascaraJanela from './assets/quarto/mascara-janela.png';
import mascaraPoster from './assets/quarto/mascara-poster.png';
import mascaraPrateleira from './assets/quarto/mascara-prateleira.png';
import mascaraQuadro from './assets/quarto/mascara-quadro.png';
import mascaraVaso from './assets/quarto/mascara-vaso.png';

/**
 * A HOME É O QUARTO DO COELHO (decidido em 08/10/2026): a pintura do conceito convertida para pixel art de verdade,
 * com os objetos clicáveis — cada função da home mora num objeto. A arte e o porquê de cada escolha estão em
 * e2e/pixel-art/quarto/hibrido/ (a página de teste é o quarto.html de lá; as imagens vêm de exportar.mjs).
 *
 * O quarto é FIXO: é uma pintura, e os objetos são áreas de clique sobre ela. O quarto de móveis soltos, que a pessoa
 * arruma, ainda está sendo feito em e2e/pixel-art/quarto/novo/ e substitui este quando ficar pronto.
 *
 * Três coisas que vêm da página de teste e não são enfeite:
 * - O CLIQUE ACERTA O DESENHO, NÃO A CAIXA: cada objeto tem uma máscara, e o pixel sob o ponteiro decide. As caixas se
 *   sobrepõem (o pôster dentro da caixa do quadro, o abajur dentro da da prateleira).
 * - O CONTORNO É DE UM PIXEL DO QUARTO, por fora da forma, como nos jogos: a sombra projetada de um recorte da própria
 *   pintura. O filtro fica no elemento de fora, porque a máscara cortaria o que o próprio elemento desenha.
 * - QUEM USA O TECLADO TAMBÉM CHEGA: cada objeto com função tem um botão invisível na caixa dele, e o foco acende o
 *   mesmo contorno.
 */

const W = 313;
const H = 314;

type Caixa = [number, number, number, number];
/** Os objetos da pintura, em pixels do quarto (as caixas de e2e/pixel-art/quarto/hibrido/objetos.mjs). */
const OBJETOS: { id: string; caixa: Caixa; mascara: string }[] = [
  { id: 'prateleira', caixa: [21, 60, 81, 145], mascara: mascaraPrateleira },
  { id: 'abajur', caixa: [46, 127, 68, 161], mascara: mascaraAbajur },
  { id: 'poster', caixa: [110, 35, 134, 87], mascara: mascaraPoster },
  { id: 'quadro', caixa: [83, 53, 109, 100], mascara: mascaraQuadro },
  { id: 'janela', caixa: [146, 22, 239, 145], mascara: mascaraJanela },
  { id: 'cortica', caixa: [237, 73, 265, 113], mascara: mascaraCortica },
  { id: 'computador', caixa: [211, 115, 268, 173], mascara: mascaraComputador },
  { id: 'fone', caixa: [271, 129, 291, 153], mascara: mascaraFone },
  { id: 'armario', caixa: [266, 193, 298, 240], mascara: mascaraArmario },
  { id: 'vaso', caixa: [25, 178, 56, 212], mascara: mascaraVaso },
];
const VIVOS: { id: 'coelho' | 'gato'; caixa: Caixa; src: string }[] = [
  { id: 'coelho', caixa: [88, 98, 137, 162], src: coelhoUrl },
  { id: 'gato', caixa: [135, 125, 162, 142], src: gatoUrl },
];

/** O que cada objeto faz. Objeto sem ação é só desenho: não acende nem responde ao clique. */
export type AcoesDoQuarto = Partial<Record<string, { rotulo: string; sub?: string; onClick: () => void }>>;

const posicao = ([x0, y0, x1, y1]: Caixa): CSSProperties => ({
  left: `${(x0 / W) * 100}%`,
  top: `${(y0 / H) * 100}%`,
  width: `${((x1 - x0) / W) * 100}%`,
  height: `${((y1 - y0) / H) * 100}%`,
});

/** Um pedaço da pintura (`url`) do tamanho da caixa: o fundo é a pintura inteira, deslocada até a caixa. */
const recorte = ([x0, y0, x1, y1]: Caixa, url: string): CSSProperties => {
  const w = x1 - x0;
  const h = y1 - y0;
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: `${(W / w) * 100}% ${(H / h) * 100}%`,
    backgroundPosition: `${(x0 / (W - w)) * 100}% ${(y0 / (H - h)) * 100}%`,
  };
};

export function Quarto({ noite, acoes }: { noite: boolean; acoes: AcoesDoQuarto }) {
  const ref = useRef<HTMLDivElement>(null);
  const [aceso, setAceso] = useState<string | null>(null);
  const [cutucado, setCutucado] = useState<string | null>(null);
  // O tamanho de um pixel do quarto na tela: o contorno e a respiração andam de um em um.
  const [px, setPx] = useState(2);
  // As máscaras viram matrizes de "tem objeto aqui?", para o clique acertar o desenho e não a caixa.
  const cheio = useRef(new Map<string, { w: number; a: Uint8ClampedArray }>());

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setPx(el.clientWidth / W);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let vivo = true;
    for (const o of OBJETOS) {
      const im = new Image();
      im.onload = () => {
        if (!vivo) return;
        const c = document.createElement('canvas');
        c.width = im.width;
        c.height = im.height;
        const g = c.getContext('2d');
        if (!g) return;
        g.drawImage(im, 0, 0);
        cheio.current.set(o.id, { w: im.width, a: g.getImageData(0, 0, im.width, im.height).data });
      };
      im.src = o.mascara;
    }
    return () => {
      vivo = false;
    };
  }, []);

  /** O objeto com ação sob o pixel (x, y) do quarto; os vivos não contam (são só cutucáveis). */
  const sob = (x: number, y: number) => {
    for (const o of OBJETOS) {
      if (!acoes[o.id]) continue;
      const [x0, y0, x1, y1] = o.caixa;
      const m = cheio.current.get(o.id);
      if (!m || x < x0 || y < y0 || x >= x1 || y >= y1) continue;
      if (m.a[((y - y0) * m.w + (x - x0)) * 4 + 3]) return o.id;
    }
    return null;
  };
  const vivoSob = (x: number, y: number) =>
    VIVOS.find(({ caixa: [x0, y0, x1, y1] }) => x >= x0 && y >= y0 && x < x1 && y < y1)?.id ?? null;
  const ponto = (e: React.PointerEvent | React.MouseEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * W), Math.floor(((e.clientY - r.top) / r.height) * H)];
  };

  const cutucar = (id: string) => {
    setCutucado(null);
    requestAnimationFrame(() => setCutucado(id));
  };

  const contorno = `drop-shadow(${px}px 0 0 var(--quarto-contorno)) drop-shadow(-${px}px 0 0 var(--quarto-contorno)) drop-shadow(0 ${px}px 0 var(--quarto-contorno)) drop-shadow(0 -${px}px 0 var(--quarto-contorno))`;

  return (
    <div
      ref={ref}
      className={`quarto${noite ? '' : ' de-dia'}${aceso ? ' na-mira' : ''}`}
      style={{ '--quarto-px': `${px}px` } as CSSProperties}
      onPointerMove={(e) => setAceso(sob(...ponto(e)))}
      onPointerLeave={() => setAceso(null)}
      onClick={(e) => {
        // O clique de teclado (detail 0) já foi tratado pelo botão invisível.
        if (e.detail === 0) return;
        const [x, y] = ponto(e);
        const id = sob(x, y);
        if (id) acoes[id]?.onClick();
        else {
          const vivo = vivoSob(x, y);
          if (vivo) cutucar(vivo);
        }
      }}
    >
      <img className="quarto-cena noite" src={noiteUrl} alt="" draggable={false} />
      <img className="quarto-cena dia" src={diaUrl} alt="" draggable={false} />
      {OBJETOS.filter((o) => acoes[o.id]).map((o) => (
        <div key={o.id} className={`quarto-destaque${aceso === o.id ? ' aceso' : ''}`} style={{ ...posicao(o.caixa), filter: contorno }}>
          {(['noite', 'dia'] as const).map((cena) => (
            <div
              key={cena}
              className={`quarto-corte ${cena}`}
              style={{ ...recorte(o.caixa, cena === 'noite' ? noiteUrl : diaUrl), maskImage: `url(${o.mascara})`, WebkitMaskImage: `url(${o.mascara})` }}
            />
          ))}
        </div>
      ))}
      {VIVOS.map((v) => (
        <div
          key={v.id}
          className={`quarto-vivo ${v.id}${cutucado === v.id ? ' cutucado' : ''}`}
          style={posicao(v.caixa)}
          onAnimationEnd={() => setCutucado(null)}
          aria-hidden="true"
        >
          {/* Respira da cintura para cima: a metade de cima desce um pixel, a de baixo fica parada. */}
          <span className="quarto-parte baixo">
            <img src={v.src} alt="" draggable={false} />
          </span>
          <span className="quarto-parte cima">
            <img src={v.src} alt="" draggable={false} />
          </span>
        </div>
      ))}
      {OBJETOS.filter((o) => acoes[o.id]).map((o) => {
        const acao = acoes[o.id]!;
        return (
          <button
            key={o.id}
            type="button"
            className="quarto-alvo"
            style={posicao(o.caixa)}
            aria-label={acao.sub ? `${acao.rotulo} — ${acao.sub}` : acao.rotulo}
            onFocus={() => setAceso(o.id)}
            onBlur={() => setAceso(null)}
            onClick={(e) => {
              if (e.detail === 0) acao.onClick();
            }}
          />
        );
      })}
      {aceso && acoes[aceso] && (
        <span
          className="quarto-rotulo"
          style={(() => {
            const [x0, y0, x1] = OBJETOS.find((o) => o.id === aceso)!.caixa;
            return { left: `${(((x0 + x1) / 2) / W) * 100}%`, top: `${(y0 / H) * 100}%` };
          })()}
          aria-hidden="true"
        >
          <strong>{acoes[aceso]!.rotulo}</strong>
          {acoes[aceso]!.sub && <small>{acoes[aceso]!.sub}</small>}
        </span>
      )}
    </div>
  );
}
