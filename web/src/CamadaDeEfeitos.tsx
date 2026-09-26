import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { avancar, criarParticulas, juntar, quantasCabem, type EfeitoVisualId, type Particula } from './efeitosVisuais';
import { useSettings } from './settings';

// A camada onde os efeitos da chamada são desenhados: um canvas só, por cima de tudo, que não recebe
// clique nenhum. O confete, os fogos e os corações de TODO MUNDO da sala caem aqui dentro.
//
// Um canvas só, e não um por efeito: cada canvas é uma superfície que a placa de vídeo precisa compor
// em cada quadro, e três pessoas clicando junto criariam três. As partículas de todos os disparos
// vivem na mesma lista, e é por isso que o teto delas vale para a soma.

/** Quantas partículas um clique pede. O que sobrar do teto é cortado na hora de juntar. */
const POR_DISPARO = 130;

export interface DisparoVisual {
  id: EfeitoVisualId;
  /** Muda a cada clique, inclusive do mesmo efeito: é o que faz o segundo clique valer. */
  chave: number;
}

function desenhar(ctx: CanvasRenderingContext2D, p: Particula) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = p.cor;

  if (p.formato === 'papel') {
    ctx.rotate(p.giro);
    // A altura acompanha o giro: é o que dá a impressão de papel virando de lado, sem desenhar em 3D.
    ctx.fillRect(-p.tamanho / 2, -p.tamanho / 2, p.tamanho, p.tamanho * 1.4 * Math.abs(Math.cos(p.giro)));
  } else if (p.formato === 'faisca') {
    // A faísca apaga junto com a vida, em vez de sumir de uma vez.
    ctx.globalAlpha = Math.max(0, Math.min(1, p.vida));
    ctx.beginPath();
    ctx.arc(0, 0, p.tamanho, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const t = p.tamanho;
    ctx.rotate(p.giro * 0.3);
    ctx.beginPath();
    ctx.moveTo(0, t * 0.3);
    ctx.bezierCurveTo(t * 0.8, -t * 0.4, t * 0.4, -t * 0.9, 0, -t * 0.35);
    ctx.bezierCurveTo(-t * 0.4, -t * 0.9, -t * 0.8, -t * 0.4, 0, t * 0.3);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * `disparo` muda toda vez que alguém (você ou outra pessoa da sala) manda um efeito.
 *
 * Quem desligou "efeitos visuais" nas configurações não desenha nada — e quem pediu menos movimento no
 * Windows também não, pela mesma razão do confete da medalha: para algumas pessoas isso passa mal.
 */
export function CamadaDeEfeitos({ disparo }: { disparo: DisparoVisual | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // As partículas sobrevivem entre disparos: um clique enquanto o confete anterior ainda cai entra na
  // mesma lista, em vez de apagar o que estava na tela.
  const particulas = useRef<Particula[]>([]);
  const ligado = useSettings().efeitosVisuais;

  useEffect(() => {
    if (!disparo || !ligado) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ajustar = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();

    particulas.current = juntar(
      particulas.current,
      criarParticulas(disparo.id, window.innerWidth, window.innerHeight, quantasCabem(particulas.current.length, POR_DISPARO)),
    );

    let anterior = performance.now();
    let pedido = 0;
    const passo = (agora: number) => {
      // Teto no dt: voltando de uma aba que ficou minutos em segundo plano, um salto gigante jogaria
      // todas as partículas para fora da tela de uma vez e o efeito piscaria e sumiria.
      const dt = Math.min((agora - anterior) / 1000, 0.05);
      anterior = agora;
      particulas.current = avancar(particulas.current, dt, window.innerWidth, window.innerHeight);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particulas.current) desenhar(ctx, p);

      // Lista vazia: acabou, e o laço para de vez. Sem isto ficaria um requestAnimationFrame por quadro
      // para sempre, limpando um canvas vazio — numa chamada de duas horas, isso é bateria.
      if (particulas.current.length > 0) pedido = requestAnimationFrame(passo);
    };
    pedido = requestAnimationFrame(passo);
    window.addEventListener('resize', ajustar);

    // Um disparo novo desmonta este efeito e monta outro; o laço para aqui e recomeça lá, com as
    // partículas que sobraram na lista.
    return () => {
      cancelAnimationFrame(pedido);
      window.removeEventListener('resize', ajustar);
    };
  }, [disparo, ligado]);

  if (!ligado) return null;
  return createPortal(<canvas ref={canvasRef} className="efeitos-visuais" aria-hidden="true" />, document.body);
}
