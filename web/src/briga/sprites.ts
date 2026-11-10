/**
 * OS BICHOS DAS FASES (06/11/2026): as folhas renderizadas pelo Blender dos monstros da Quaternius (CC0;
 * e2e/pixel-art/personagem/blender/meshy/briga-monstros.py e briga-monstros-pos.py → web/public/briga/<fase>/<bicho>.png),
 * com a mesma câmera e a mesma luz do coelho. Desde 09/11/2026 (pedido dele: "não temos assets para substituir os
 * inimigos?") a horta também: a raposa é o gato malhado, o corvo o pombo e o texugo a galinha gigante, com os ids de antes.
 * O desenho por código deles (desenho.ts) ficou só de reserva, enquanto a folha não chega ou se ela falhar.
 * O ritmo é "em dois", 12 desenhos por segundo, como o do coelho.
 *
 * Levar golpe pisca BRANCO (uma cópia branca da folha, feita uma vez); a preparação treme 1 px, como a do texugo.
 */
import { bicho, type TipoDeInimigo } from './fases';
import { FOLHAS_DOS_BICHOS } from './folhasDosBichos';
import type { EstadoDoInimigo } from './regras';

/** A ordem dos desenhos na folha (o briga-monstros.py e o -pos.py têm a mesma). */
const ANIMS_DOS_BICHOS = [['parado', 4], ['andando', 6], ['prep', 2], ['golpe', 2], ['dor', 2], ['caido', 3], ['pulo', 2]] as const;
type Anim = (typeof ANIMS_DOS_BICHOS)[number][0];
const INICIO = {} as Record<Anim, number>;
{
  let k = 0;
  for (const [nome, n] of ANIMS_DOS_BICHOS) {
    INICIO[nome] = k;
    k += n;
  }
}

/** Este bicho tem folha? */
export const temFolha = (tipo: TipoDeInimigo) => tipo in FOLHAS_DOS_BICHOS;

/** Os da horta têm também o desenho por código, de reserva: sem a folha ainda, eles aparecem assim, e não somem. */
const DE_RESERVA: ReadonlySet<TipoDeInimigo> = new Set<TipoDeInimigo>(['raposa', 'corvo', 'texugo']);

/** Desenha pela folha? Os que têm reserva, só com ela já carregada; os outros, sempre (sem ela, a sombra diz que estão ali). */
export const desenhaPelaFolha = (tipo: TipoDeInimigo) => temFolha(tipo) && (!DE_RESERVA.has(tipo) || folha(tipo) !== null);

const folhas = new Map<string, { img: HTMLImageElement; branca: HTMLCanvasElement | null }>();
function folha(tipo: string) {
  const f = FOLHAS_DOS_BICHOS[tipo];
  if (!f || typeof Image === 'undefined') return null;
  let x = folhas.get(tipo);
  if (!x) {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}briga/${f.fase}/${tipo}.png`;
    x = { img, branca: null };
    folhas.set(tipo, x);
  }
  if (!x.img.complete || !x.img.naturalWidth) return null;
  if (!x.branca) {
    const c = document.createElement('canvas');
    c.width = x.img.naturalWidth;
    c.height = x.img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(x.img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#fff8ec';
    g.fillRect(0, 0, c.width, c.height);
    x.branca = c;
  }
  return x;
}

/** Carrega de antemão as folhas de uma fase (a escolha da fase já as pede, para a primeira onda não aparecer vazia). */
export function carregarFolhas(tipos: TipoDeInimigo[]) {
  for (const t of tipos) folha(t);
}

/** Qual desenho, pelo estado e há quanto tempo (ms) o bicho está nele. */
export function desenhoDoBicho(tipo: TipoDeInimigo, estado: EstadoDoInimigo, ms: number, tempo: number): number {
  const q = (n: number, cada: number) => Math.floor(tempo / cada) % n;
  switch (estado) {
    case 'entrando':
    case 'andando':
    case 'rondando':
    case 'subindo':
      return INICIO.andando + q(6, 83);
    case 'investida':
      return INICIO.andando + q(6, 50);
    case 'preparando':
    case 'mirando':
    case 'prep-investida':
    case 'prep-pancada':
    case 'prep-sopro':
      return INICIO.prep + (ms < 300 ? 0 : 1);
    case 'atacando':
    case 'pancada':
    case 'sopro':
    case 'mergulhando':
      return INICIO.golpe + (ms < 100 ? 0 : 1);
    case 'saltando':
      return bicho(tipo).comp === 'pulo' ? INICIO.pulo + (ms < 330 ? 0 : 1) : INICIO.golpe;
    case 'dor':
      return INICIO.dor + (ms < 150 ? 0 : 1);
    case 'caido':
      return INICIO.caido + Math.min(2, Math.floor(ms / 150));
    case 'morto':
      return INICIO.caido + 2;
    case 'levantando':
      return ms < 220 ? INICIO.caido + 1 : INICIO.caido;
    default:
      return INICIO.parado + q(4, 160);
  }
}

/** A altura do bicho na tela (para a barra de vida em cima dele). */
export const alturaDoBicho = (tipo: TipoDeInimigo) => FOLHAS_DOS_BICHOS[tipo]?.alto ?? 40;

/** Desenha o bicho com o pé em (sx, sy). Sem a folha ainda carregada, não desenha nada (a sombra já diz que ele está ali). */
export function desenharBichoDaFolha(
  g: CanvasRenderingContext2D,
  b: { tipo: TipoDeInimigo; estado: EstadoDoInimigo; lado: number; ms: number; piscando: boolean },
  sx: number,
  sy: number,
  tempo: number,
) {
  if (b.estado === 'morto' && Math.floor(tempo / 90) % 2 === 0) return;
  const f = FOLHAS_DOS_BICHOS[b.tipo];
  const x = folha(b.tipo);
  if (!f || !x) return;
  const prep = b.estado === 'preparando' || b.estado === 'mirando' || b.estado === 'prep-investida' || b.estado === 'prep-pancada' || b.estado === 'prep-sopro';
  const treme = prep && Math.floor(tempo / 50) % 2 ? 1 : 0;
  const quadro = desenhoDoBicho(b.tipo, b.estado, b.ms, tempo);
  const L = f.lado;
  g.save();
  g.translate(sx + treme, sy);
  if (b.lado < 0) g.scale(-1, 1);
  g.drawImage(b.piscando && x.branca ? x.branca : x.img, quadro * L, 0, L, L, -f.peX, -f.peY, L, L);
  g.restore();
}

// ---------------- OS TIROS ----------------
/** As cores de cada tiro, pelo bicho que atirou: [o miolo, a borda, o rastro]. */
const CORES_DO_TIRO: Partial<Record<TipoDeInimigo, [string, string, string]>> = {
  dino: ['#b8e070', '#5a8a2a', '#d8f0a0'],
  golem: ['#e8f4ff', '#7a9ab8', '#c4dcf0'],
  'rei-cogumelo': ['#f0a0d0', '#8a3a6a', '#f8d0e8'],
  'alpaca-rei': ['#fff0c8', '#c89a5a', '#fff8e0'],
  yeti: ['#ffffff', '#9ab4cc', '#e0ecf8'],
  dragao: ['#ffd060', '#d0501c', '#ff9a3a'],
};

export function desenharTiro(g: CanvasRenderingContext2D, tipo: TipoDeInimigo, sx: number, sy: number, lado: number, tempo: number) {
  const [miolo, borda, rastro] = CORES_DO_TIRO[tipo] ?? ['#ffd060', '#d0501c', '#ff9a3a'];
  // o rastro atrás, e a bola que pulsa
  g.fillStyle = rastro;
  g.fillRect(Math.round(sx - lado * 9), sy - 1, 2, 2);
  g.fillRect(Math.round(sx - lado * 6), sy - 2, 3, 3);
  const r = Math.floor(tempo / 80) % 2;
  g.fillStyle = borda;
  g.fillRect(sx - 3 - r, sy - 3 - r, 6 + 2 * r, 6 + 2 * r);
  g.fillStyle = miolo;
  g.fillRect(sx - 2, sy - 2, 4, 4);
}
