import { useEffect, useMemo, useRef, useState } from 'react';
import { useJanelaComFoco } from '../janelaComFoco';
import { bustoDoCoelho, quadroDoCoelho, quadrosDe, type Direcao } from './montar';
import type { Receita } from './receita';

/** A mesma receita (pelo conteúdo) é o mesmo objeto: quem chama costuma montar um objeto novo a cada desenho. */
function useReceitaEstavel(r: Receita): Receita {
  const chave = JSON.stringify(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => r, [chave]);
}

/** O coração do quarto, em pixels (7 × 6), que sobe em cima da cabeça enquanto ele acena. */
const CORACAO = ['.XX.XX.', 'XooXXXX', 'XoXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const PASSO_MS = 125;

/**
 * O PALCO DO CRIADOR: o coelho da receita, parado e respirando, na direção pedida. Clicar faz ele ACENAR com o coração em
 * cima (como no quarto); de costas, ele se vira de frente para acenar. Sem foco ou com "menos movimento", fica parado no
 * quadro 0 (o aceno ainda acontece: foi pedido).
 */
export function PalcoDoCoelho({ receita: dada, dir, rotulo, escala = 3 }: { receita: Receita; dir: Direcao; rotulo: string; escala?: number }) {
  const receita = useReceitaEstavel(dada);
  const tela = useRef<HTMLCanvasElement>(null);
  const comFoco = useJanelaComFoco();
  const [aceno, setAceno] = useState<{ dir: Direcao; inicio: number } | null>(null);
  const [falhou, setFalhou] = useState(false);
  const menosMovimento = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    let vivo = true;
    let k = 0;
    let tempo: ReturnType<typeof setTimeout> | undefined;
    const desenhar = async () => {
      const c = tela.current;
      if (!vivo || !c) return;
      const acenando = aceno !== null;
      const d = aceno?.dir ?? dir;
      const anim = acenando ? 'acenando' : 'parado';
      try {
        const n = await quadrosDe(receita.corpo, anim, d);
        if (!vivo) return;
        if (acenando && k >= n * 2) {
          setAceno(null);
          return;
        }
        const q = await quadroDoCoelho(receita, anim, d, k);
        if (!vivo) return;
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, c.width, c.height);
        g.drawImage(q, 0, 0);
        if (acenando) desenharCoracao(g, q, k);
        setFalhou(false);
      } catch {
        if (vivo) setFalhou(true);
        return;
      }
      const anda = acenando || (comFoco && !menosMovimento);
      if (anda) {
        k++;
        tempo = setTimeout(() => void desenhar(), PASSO_MS);
      }
    };
    void desenhar();
    return () => {
      vivo = false;
      clearTimeout(tempo);
    };
  }, [receita, dir, aceno, comFoco, menosMovimento]);

  return (
    <canvas
      ref={tela}
      width={144}
      height={144}
      className="coelho-palco"
      data-falhou={falhou || undefined}
      style={{ width: 144 * escala, height: 144 * escala }}
      role="img"
      aria-label={rotulo}
      onClick={() => setAceno({ dir: dir.startsWith('south') ? dir : dir === 'north-west' ? 'south-west' : 'south-east', inicio: Date.now() })}
    />
  );
}

function desenharCoracao(g: CanvasRenderingContext2D, q: HTMLCanvasElement, k: number) {
  // o alto do desenho neste quadro: o coração nasce acima dele e sobe devagar
  const d = q.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, q.width, q.height).data;
  let topo = 40;
  achar: for (let y = 0; y < q.height; y++) for (let x = 0; x < q.width; x++) if (d[(y * q.width + x) * 4 + 3] > 20) { topo = y; break achar; }
  const y0 = Math.max(0, topo - 10 - Math.min(6, k >> 1));
  CORACAO.forEach((linha, y) =>
    [...linha].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = ch === 'o' ? '#ffd6e2' : '#e5455f';
      g.fillRect(68 + x, y0 + y, 1, 1);
    }),
  );
}

/**
 * O AVATAR DE QUEM MONTOU O PRÓPRIO COELHO: o busto (bustoDoCoelho), com os estados da foto (pula falando, cochila ausente,
 * balança ocupado: .avatar-foto em styles.css), porque o busto não tem quadros próprios para isso.
 */
export function BustoDoCoelho({ receita: dada, estado }: { receita: Receita; estado: 'falando' | 'ausente' | 'ocupado' | null }) {
  const receita = useReceitaEstavel(dada);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    bustoDoCoelho(receita).then(
      (s) => vivo && setSrc(s),
      () => {},
    );
    return () => {
      vivo = false;
    };
  }, [receita]);
  if (!src) return <span className="avatar-foto avatar-coelho-montado" aria-hidden="true" />;
  return <img className="avatar-foto avatar-coelho-montado" data-estado={estado ?? undefined} src={src} alt="" draggable={false} />;
}
