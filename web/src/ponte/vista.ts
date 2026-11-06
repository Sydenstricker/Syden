import type { Sim } from './sim';

/**
 * O QUE A TELA DA PONTE PRECISA DE UM DESENHO, seja o 3D (cena3d.ts, o de saída) ou o 2D de reserva (desenho.ts, sem WebGL ou se o
 * 3D falhar). As coordenadas da tela são as LÓGICAS, 960 × 540 sobre a caixa do jogo (16:9), as mesmas do mouse e do e2e.
 */
export const LARGURA = 960;
export const ALTURA = 540;
/** O céu do 3D: é também a cor da caixa enquanto a cena carrega. */
export const COR_DO_FUNDO = '#9fd3ec';
/** Os modelos dos veículos em web/public/ponte/ (o Car Kit da Kenney e a carroça do Halloween Bits da KayKit; o teste confere). */
export const MODELOS_DA_PONTE = ['sedan.glb', 'delivery.glb', 'wagon.gltf'] as const;

export interface OpcoesDaMontagem {
  agora: number;
  /** A peça que vai entrar (do nó de origem até o alvo), e se ela pode. */
  fantasma?: { ax: number; ay: number; bx: number; by: number; tipo: number; valida: boolean } | null;
  origem?: [number, number] | null;
  /** O cursor do teclado. */
  cursor?: [number, number] | null;
  /** O ponto da grade debaixo do mouse (o encaixe). */
  sobre?: [number, number] | null;
  /** A peça que o "Apagar" tiraria (índice), ou −1. */
  apagando?: number;
}

export interface VistaDaPonte {
  montagem(pecas: readonly number[], o: OpcoesDaMontagem): void;
  /** Os estilhaços e os respingos dos eventos do último passo (chamado a cada passo). */
  ouvir(s: Sim): void;
  simulacao(s: Sim, agora: number): void;
  /** Do ponto da tela (lógico) para o plano da ponte, em casas. */
  paraMundo(px: number, py: number): [number, number] | null;
  /** Do plano da ponte para a tela (lógico). */
  paraTela(x: number, y: number): [number, number];
  destruir(): void;
}
