import { PartyPopper } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Medalha } from './Medalha';

// A comemoração de quando uma ideia é acolhida no Syden: confete caindo na tela inteira e um cartão
// dizendo o que foi aceito. É o momento em que a pessoa descobre que a sugestão dela virou app de
// verdade — e ganha a medalha de contribuição no perfil.

const CORES = ['#c8102e', '#e8762c', '#f2c744', '#5f9a4a', '#4a8fd8', '#f7f1e6'];
const QUANTOS = 140;
const SEGUNDOS = 6;

interface Papel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  giro: number;
  giroPasso: number;
  largura: number;
  altura: number;
  cor: string;
}

/**
 * O confete é desenhado num canvas, e não com elementos na tela: são mais de cem papeizinhos girando ao
 * mesmo tempo, e cada um como elemento faria o navegador recalcular a página toda a cada quadro.
 */
function Confete() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Quem prefere menos movimento na tela (Windows: "mostrar animações") não leva confete na cara.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ajustar = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    window.addEventListener('resize', ajustar);

    const largura = () => window.innerWidth;
    const papeis: Papel[] = Array.from({ length: QUANTOS }, () => ({
      x: Math.random() * largura(),
      y: -20 - Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 60,
      vy: 120 + Math.random() * 160,
      giro: Math.random() * Math.PI,
      giroPasso: (Math.random() - 0.5) * 6,
      largura: 6 + Math.random() * 6,
      altura: 9 + Math.random() * 8,
      cor: CORES[Math.floor(Math.random() * CORES.length)],
    }));

    let anterior = performance.now();
    const fim = anterior + SEGUNDOS * 1000;
    let quadro = 0;

    const passo = (agora: number) => {
      const dt = Math.min((agora - anterior) / 1000, 0.05);
      anterior = agora;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      // No fim, os papéis somem devagar em vez de piscar de uma vez.
      ctx.globalAlpha = Math.max(0, Math.min(1, (fim - agora) / 1200));
      for (const papel of papeis) {
        papel.x += papel.vx * dt;
        papel.y += papel.vy * dt;
        papel.giro += papel.giroPasso * dt;
        if (papel.y > window.innerHeight + 20) {
          papel.y = -20;
          papel.x = Math.random() * largura();
        }
        ctx.save();
        ctx.translate(papel.x, papel.y);
        ctx.rotate(papel.giro);
        ctx.fillStyle = papel.cor;
        // O "amassado" do papel: a largura oscila, como se ele girasse de lado.
        ctx.fillRect(-papel.largura / 2, -papel.altura / 2, papel.largura * Math.abs(Math.cos(papel.giro)), papel.altura);
        ctx.restore();
      }
      if (agora < fim) quadro = requestAnimationFrame(passo);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    quadro = requestAnimationFrame(passo);

    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('resize', ajustar);
    };
  }, []);

  return <canvas ref={ref} className="confete" aria-hidden="true" />;
}

/** O cartão que explica a festa, com a ideia que foi acolhida. */
export function Comemoracao({ ideia, aoFechar }: { ideia: string; aoFechar: () => void }) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  return createPortal(
    <div className="comemoracao-fundo" onClick={aoFechar}>
      <Confete />
      <div className="comemoracao" role="dialog" aria-label="Sua ideia foi acolhida" onClick={(e) => e.stopPropagation()}>
        <span className="comemoracao-icone" aria-hidden="true">
          <PartyPopper size={40} />
        </span>
        <h2>Sua ideia entrou no Syden!</h2>
        <blockquote className="comemoracao-ideia">{ideia}</blockquote>
        <p>
          Obrigado de verdade. Fique de olho nas novidades da tela inicial para ver a sua ideia funcionando — e a
          medalha de contribuição já está no seu perfil.
        </p>
        <Medalha tamanho={132} />
        <button className="btn-primary" onClick={aoFechar}>
          Que legal!
        </button>
      </div>
    </div>,
    document.body,
  );
}
