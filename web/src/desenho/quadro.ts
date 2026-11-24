import { CORES_DO_DESENHO, ESPESSURAS_DO_DESENHO } from '../minijogos';
import { areasDosBaldes, BALDE, imagemDaArea } from './balde';

/**
 * PINTAR UM DESENHO NUM QUADRO (24/11/2026, o telefone sem fio): a mesma conta do quadro do Desenha e adivinha (JogoDesenho.tsx),
 * à parte para servir aos quadros do telefone — o que se desenha, o que se recebe para adivinhar e os da revelação. O quadro tem
 * 1000 × 750 em qualquer tela; os baldes saem da grade própria (balde.ts), guardados enquanto nada antes deles muda.
 */
export const LARGURA_DO_QUADRO = 1000;
export const ALTURA_DO_QUADRO = 750;

export type TracosDoQuadro = Map<number, { c: number; e: number; partes: Map<number, number[]> }>;
export type CacheDosBaldes = { chave: string; imagens: Map<number, HTMLCanvasElement> };

/** Os traços como o servidor manda (as partes numa lista) viram o mapa do quadro. */
export function tracosDe(lista: { t: number; c: number; e: number; partes: [number, number[]][] }[]): TracosDoQuadro {
  return new Map(lista.map((tr) => [tr.t, { c: tr.c, e: tr.e, partes: new Map(tr.partes) }]));
}

export function pintarQuadro(tela: HTMLCanvasElement, tracos: TracosDoQuadro, cache: CacheDosBaldes): void {
  const ctx = tela.getContext('2d');
  if (!ctx) return;
  const largura = Math.max(1, tela.clientWidth) * devicePixelRatio;
  if (tela.width !== Math.round(largura)) {
    tela.width = Math.round(largura);
    tela.height = Math.round(largura * (ALTURA_DO_QUADRO / LARGURA_DO_QUADRO));
  }
  const escala = tela.width / LARGURA_DO_QUADRO;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tela.width, tela.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const emOrdem = [...tracos.entries()].sort(([a], [b]) => a - b);
  const pontosDe = (traco: { partes: Map<number, number[]> }) => [...traco.partes.entries()].sort(([a], [b]) => a - b).flatMap(([, p]) => p);
  const ultimoBalde = Math.max(-1, ...emOrdem.filter(([, tr]) => tr.e === BALDE).map(([k]) => k));
  if (ultimoBalde >= 0) {
    const antes = emOrdem.filter(([k]) => k <= ultimoBalde);
    const chave = antes.map(([k, tr]) => `${k}.${tr.c}.${tr.e}.${pontosDe(tr).length}`).join(',');
    if (chave !== cache.chave) {
      const areas = areasDosBaldes(
        antes.map(([k, tr]) => ({ t: k, c: tr.c, e: tr.e, pontos: pontosDe(tr) })),
        ESPESSURAS_DO_DESENHO,
      );
      const imagens = new Map<number, HTMLCanvasElement>();
      for (const [k, area] of areas) imagens.set(k, imagemDaArea(area, CORES_DO_DESENHO[tracos.get(k)?.c ?? 0] ?? '#000000'));
      cache.chave = chave;
      cache.imagens = imagens;
    }
  }
  for (const [k, traco] of emOrdem) {
    if (traco.e === BALDE) {
      const imagem = cache.imagens.get(k);
      if (imagem) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(imagem, 0, 0, tela.width, tela.height);
      }
      continue;
    }
    const pontos = pontosDe(traco);
    if (pontos.length < 2) continue;
    ctx.strokeStyle = CORES_DO_DESENHO[traco.c] ?? '#000';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = (ESPESSURAS_DO_DESENHO[traco.e] ?? 8) * escala;
    if (pontos.length === 2) {
      ctx.beginPath();
      ctx.arc(pontos[0] * escala, pontos[1] * escala, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(pontos[0] * escala, pontos[1] * escala);
    for (let i = 2; i < pontos.length; i += 2) ctx.lineTo(pontos[i] * escala, pontos[i + 1] * escala);
    ctx.stroke();
  }
}
