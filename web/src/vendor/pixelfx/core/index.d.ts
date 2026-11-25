// Tipos mínimos do pixelfx (nossos): só o que o Syden chama.
export interface FramePixelfx {
  w: number;
  h: number;
  ox: number;
  oy: number;
  color: Uint32Array;
  light: Uint32Array;
}
export interface ModuloDeEfeito {
  meta: { name: string; duration?: number; loop?: boolean; options?: Record<string, unknown> };
}
export interface EfeitoVivo {
  update(dt: number): void;
  draw(frame: FramePixelfx, layer?: 'back' | 'front'): void;
  stop(): void;
  done(): boolean;
}
export function createFrame(w: number, h: number, ox?: number, oy?: number): FramePixelfx;
export function clearFrame(f: FramePixelfx): FramePixelfx;
export function createFx(mod: ModuloDeEfeito, o?: Record<string, unknown>): EfeitoVivo;
export function composite(f: FramePixelfx, out: Uint8ClampedArray, bg?: number | Uint32Array | null, lightK?: number): Uint8ClampedArray;
