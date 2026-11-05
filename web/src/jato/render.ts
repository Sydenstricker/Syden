import { sorteio } from './util';
import { folhaGuardada, LADO, PE_X, PE_Y, vistaDaNave, type CoresDaNave } from './nave';
import { Chao, MUNDO, RES, type Fundo, type PistaDoJato, type TemaDoJato } from './pista';

/**
 * O DESENHO DOS COELHOS A JATO (05/11/2026): a mesma câmera do "Mode 7" da Corrida dos coelhos (corrida/render.ts, de onde a
 * forma foi copiada), com o que muda na corrida antigravidade:
 * - fora da pista não há chão: cada linha da tela tem DOIS planos, a pista e, bem mais fundo, o que fica lá embaixo (a cidade
 *   acesa, as estrelas, o mar de nuvens). O de baixo anda mais devagar que a pista: é a altura que se vê;
 * - a câmera é mais baixa, mais perto e de lente mais aberta que a do kart, e abre mais no turbo; as faixas de luz da pista,
 *   os postes da borda e os riscos de vento nas beiradas da tela são o que faz a velocidade PARECER alta.
 * Tudo numa tela de 320 × 180 que o navegador amplia com os pixels nítidos.
 */

export const W = 320;
export const H = 180;
export const HORIZONTE = 56;
const ALTURA = 17;
export const ATRAS = 40;
export const FOCO = 150;
const K = RES / MUNDO;
/** A que profundidade fica o plano de baixo, e quantos pontos da textura dele há por unidade do mundo. */
const PROFUNDIDADE: Record<Fundo, number> = { cidade: 160, espaco: 900, nuvens: 70 };
const FUNDO_LADO = 512;

export interface Camera {
  x: number;
  y: number;
  angulo: number;
  /** A lente (o turbo abre). */
  foco: number;
}

export function cameraAtras(x: number, y: number, angulo: number, foco = FOCO, atras = ATRAS): Camera {
  return { x: x - Math.cos(angulo) * atras, y: y - Math.sin(angulo) * atras, angulo, foco };
}

export interface Desenho {
  ctx: CanvasRenderingContext2D;
  imagem: ImageData;
  pontos: Uint32Array;
  ceu: Uint32Array;
  fundo: Uint32Array;
  tema: TemaDoJato;
  poste: HTMLCanvasElement;
}

const rgb = (r: number, g: number, b: number) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

export function prepararDesenho(canvas: HTMLCanvasElement, tema: TemaDoJato): Desenho {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const imagem = ctx.createImageData(W, H);
  return { ctx, imagem, pontos: new Uint32Array(imagem.data.buffer), ceu: desenharCeu(tema), fundo: desenharFundo(tema.fundo), tema, poste: poste(tema) };
}

/** O CÉU, numa faixa de 4 telas que dá a volta inteira: o degradê em degraus, as estrelas, e o horizonte de cada tema. */
const CEU_W = W * 4;
function desenharCeu(tema: TemaDoJato): Uint32Array {
  const ceu = new Uint32Array(CEU_W * HORIZONTE);
  const { topo, meio, baixo } = tema.ceu;
  for (let y = 0; y < HORIZONTE; y++) {
    const t = y / (HORIZONTE - 1);
    const a = t < 0.55 ? topo : meio, b = t < 0.55 ? meio : baixo, u = t < 0.55 ? t / 0.55 : (t - 0.55) / 0.45;
    const uq = Math.floor(u * 6) / 6;
    ceu.fill(rgb(...(a.map((c, i) => Math.round(c + (b[i] - c) * uq)) as [number, number, number])), y * CEU_W, (y + 1) * CEU_W);
  }
  const sorte = sorteio(41);
  const pinta = (x: number, y: number, cor: number) => {
    if (y < 0 || y >= HORIZONTE) return;
    ceu[y * CEU_W + (((Math.round(x) % CEU_W) + CEU_W) % CEU_W)] = cor;
  };
  // as estrelas (no fim de tarde, poucas e só lá em cima)
  const estrelas = tema.fundo === 'nuvens' ? 30 : tema.fundo === 'espaco' ? 420 : 160;
  for (let i = 0; i < estrelas; i++) {
    const y = Math.floor(sorte() * sorte() * (HORIZONTE - (tema.fundo === 'espaco' ? 4 : 18)));
    const q = sorte();
    pinta(sorte() * CEU_W, y, q < 0.1 ? rgb(255, 220, 160) : q < 0.2 ? rgb(170, 200, 255) : rgb(236, 232, 250));
  }
  if (tema.fundo === 'cidade') {
    // a lua, e duas fileiras de prédios com as janelas acesas
    disco(ceu, 900, 14, 7, rgb(244, 236, 214), rgb(214, 204, 184));
    for (const [base, cor, janela, alto] of [
      [HORIZONTE - 4, rgb(52, 36, 74), rgb(150, 110, 170), 22],
      [HORIZONTE, rgb(30, 22, 46), rgb(255, 214, 130), 16],
    ] as const) {
      let x = 0;
      while (x < CEU_W) {
        const larg = 6 + Math.floor(sorte() * 14), alt = 4 + Math.floor(sorte() * alto);
        for (let xx = x; xx < Math.min(CEU_W, x + larg); xx++) {
          for (let y = base - alt; y < HORIZONTE; y++) {
            const j = (xx - x) % 3 === 1 && (y - (base - alt)) % 3 === 1 && sorte() < 0.45;
            pinta(xx, y, j ? janela : cor);
          }
        }
        // a antena no alto de alguns, com a luz vermelha
        if (alt > alto * 0.7) {
          for (let y = base - alt - 4; y < base - alt; y++) pinta(x + (larg >> 1), y, cor);
          pinta(x + (larg >> 1), base - alt - 5, rgb(255, 80, 90));
        }
        x += larg + Math.floor(sorte() * 3);
      }
    }
  } else if (tema.fundo === 'espaco') {
    // o planeta grande no horizonte, com as faixas, e uma lua pequena
    const cx = 300, cy = HORIZONTE + 30, r = 64;
    for (let y = 0; y < HORIZONTE; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.1);
        if (d > r) continue;
        const faixa = Math.floor((y + (x - cx) * 0.18) / 5) % 3;
        const borda = d > r - 3;
        pinta(x, y, borda ? rgb(210, 170, 250) : faixa === 0 ? rgb(170, 96, 150) : faixa === 1 ? rgb(196, 120, 140) : rgb(140, 80, 140));
      }
    }
    disco(ceu, 760, 16, 5, rgb(200, 210, 230), rgb(150, 160, 190));
    // a nebulosa: manchas leves
    for (let i = 0; i < 900; i++) {
      const x = 1000 + (sorte() - 0.5) * 160, y = 10 + (sorte() - 0.5) * 20;
      if (sorte() < 0.5) pinta(x, y, rgb(70, 50, 110));
    }
  } else {
    // o sol baixo, e as nuvens do horizonte em camadas
    disco(ceu, 640, HORIZONTE - 14, 11, rgb(255, 236, 190), rgb(255, 210, 160));
    for (let camada = 0; camada < 3; camada++) {
      const base = HORIZONTE - 12 + camada * 5;
      const cor = [rgb(240, 186, 186), rgb(250, 214, 200), rgb(255, 236, 222)][camada];
      for (let x = 0; x < CEU_W; x++) {
        const h = 3 + Math.sin((x / CEU_W) * Math.PI * 2 * (5 + camada * 3) + camada) * 2 + Math.sin((x / CEU_W) * Math.PI * 2 * 17) * 1.2;
        for (let y = Math.floor(base - h); y < HORIZONTE; y++) pinta(x, y, cor);
      }
    }
  }
  return ceu;
}

function disco(ceu: Uint32Array, cx: number, cy: number, r: number, claro: number, escuro: number) {
  for (let y = Math.max(0, cy - r); y <= cy + r && y < HORIZONTE; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r) ceu[y * CEU_W + ((x + CEU_W) % CEU_W)] = d > r * 0.6 && x > cx ? escuro : claro;
    }
  }
}

/**
 * O QUE FICA LÁ EMBAIXO, numa textura de 512 × 512 que se repete: a cidade (ruas acesas, telhados com janelas), as estrelas,
 * ou o mar de nuvens. Desenhada uma vez, ponto a ponto.
 */
function desenharFundo(fundo: Fundo): Uint32Array {
  const L = FUNDO_LADO;
  const t = new Uint32Array(L * L);
  const sorte = sorteio(fundo === 'cidade' ? 5 : fundo === 'espaco' ? 9 : 13);
  if (fundo === 'cidade') {
    t.fill(rgb(22, 18, 36));
    // os quarteirões: telhados de tons diferentes, com janelas acesas em pontos
    for (let by = 0; by < L; by += 64) {
      for (let bx = 0; bx < L; bx += 64) {
        const tom = [rgb(40, 34, 60), rgb(34, 30, 52), rgb(48, 38, 66)][Math.floor(sorte() * 3)];
        for (let y = by + 10; y < by + 56; y++) for (let x = bx + 10; x < bx + 56; x++) t[y * L + x] = tom;
        for (let i = 0; i < 26; i++) {
          const x = bx + 12 + Math.floor(sorte() * 42), y = by + 12 + Math.floor(sorte() * 42);
          const cor = sorte() < 0.7 ? rgb(255, 210, 120) : rgb(140, 220, 255);
          t[y * L + x] = cor;
          t[y * L + x + 1] = cor;
        }
      }
    }
    // as ruas: as faixas com os postes de luz laranja e os faróis
    for (let i = 0; i < L; i++) {
      for (const r of [0, 64, 128, 192, 256, 320, 384, 448]) {
        for (const d of [2, 3, 4, 5, 6, 7]) {
          t[(r + d) * L + i] = rgb(30, 26, 44);
          t[i * L + r + d] = rgb(30, 26, 44);
        }
        if (i % 16 === 0) {
          t[(r + 1) * L + i] = rgb(255, 170, 70);
          t[i * L + r + 1] = rgb(255, 170, 70);
        }
        if (sorte() < 0.03) t[(r + 4) * L + i] = rgb(255, 250, 220);
        if (sorte() < 0.03) t[i * L + r + 5] = rgb(255, 90, 90);
      }
    }
  } else if (fundo === 'espaco') {
    t.fill(rgb(8, 8, 22));
    for (let i = 0; i < 2600; i++) {
      const x = Math.floor(sorte() * L), y = Math.floor(sorte() * L);
      const q = sorte();
      t[y * L + x] = q < 0.6 ? rgb(90, 90, 140) : q < 0.9 ? rgb(200, 200, 240) : rgb(255, 230, 170);
    }
    // a poeira colorida: manchas fracas
    for (let i = 0; i < 9000; i++) {
      const cx = (Math.floor(i / 1500) * 97) % L, cy = (Math.floor(i / 1500) * 211) % L;
      const x = (cx + Math.floor((sorte() - 0.5) * 120) + L) % L, y = (cy + Math.floor((sorte() - 0.5) * 80) + L) % L;
      if (t[y * L + x] === rgb(8, 8, 22)) t[y * L + x] = rgb(28, 18, 52);
    }
  } else {
    // as nuvens: uma soma de ondas (sem emenda), em quatro tons, com o azul fundo entre elas
    const ondas = Array.from({ length: 6 }, () => [1 + Math.floor(sorte() * 4), 1 + Math.floor(sorte() * 4), sorte() * 6] as const);
    for (let y = 0; y < L; y++) {
      for (let x = 0; x < L; x++) {
        let v = 0;
        for (const [a, b, f] of ondas) v += Math.sin(((x * a + y * b) / L) * Math.PI * 2 + f);
        v += Math.sin((x / L) * Math.PI * 2 * 7 + Math.sin((y / L) * Math.PI * 2 * 3) * 2) * 0.7;
        const n = (((x * 73856093) ^ (y * 19349663)) >>> 8) & 3;
        const q = v + n * 0.15;
        t[y * L + x] = q > 1.6 ? rgb(255, 240, 232) : q > 0.8 ? rgb(246, 210, 206) : q > 0 ? rgb(214, 170, 190) : q > -0.8 ? rgb(160, 140, 190) : rgb(110, 110, 170);
      }
    }
  }
  return t;
}

/** O poste da borda de energia: a haste e a luz em cima. */
function poste(tema: TemaDoJato) {
  const c = document.createElement('canvas');
  c.width = 5;
  c.height = 16;
  const g = c.getContext('2d')!;
  const cor = (n: number) => `rgb(${n & 0xff}, ${(n >> 8) & 0xff}, ${(n >> 16) & 0xff})`;
  g.fillStyle = '#1e1828';
  g.fillRect(1, 3, 3, 13);
  g.fillStyle = '#4a4460';
  g.fillRect(2, 4, 1, 12);
  g.fillStyle = cor(tema.borda[0]);
  g.fillRect(0, 0, 5, 4);
  g.fillStyle = '#ffffff';
  g.fillRect(1, 1, 2, 1);
  return c;
}

function misturar(cor: number, t: number, n: [number, number, number]) {
  const r = cor & 0xff, g = (cor >> 8) & 0xff, b = (cor >> 16) & 0xff;
  return rgb(Math.round(r + (n[0] - r) * t), Math.round(g + (n[1] - g) * t), Math.round(b + (n[2] - b) * t));
}

/** O céu, a pista e o que fica lá embaixo. */
export function desenharChao(d: Desenho, p: PistaDoJato, cam: Camera): void {
  const { pontos, ceu, fundo } = d;
  const tex = p.textura;
  const desloc = Math.floor((((cam.angulo / (Math.PI * 2)) * CEU_W) % CEU_W + CEU_W) % CEU_W);
  for (let y = 0; y < HORIZONTE; y++) {
    const base = y * CEU_W;
    for (let x = 0; x < W; x++) pontos[y * W + x] = ceu[base + ((x + desloc) % CEU_W)];
  }
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const rx = -fy, ry = fx;
  const prof = PROFUNDIDADE[d.tema.fundo];
  const nevoa = d.tema.nevoa;
  const L = FUNDO_LADO, M = L - 1;
  for (let y = HORIZONTE; y < H; y++) {
    const dy = y - HORIZONTE + 0.5;
    // a pista
    const z = (ALTURA * cam.foco) / dy;
    const sx = (rx * z) / cam.foco, sy = (ry * z) / cam.foco;
    let wx = (cam.x + fx * z - sx * (W / 2)) * K, wy = (cam.y + fy * z - sy * (W / 2)) * K;
    const px = sx * K, py = sy * K;
    // o plano de baixo, mais fundo: o mesmo raio da câmera, que só o encontra mais longe
    const z2 = ((ALTURA + prof) * cam.foco) / dy;
    const sx2 = (rx * z2) / cam.foco, sy2 = (ry * z2) / cam.foco;
    let ux = cam.x + fx * z2 - sx2 * (W / 2), uy = cam.y + fy * z2 - sy2 * (W / 2);
    const nev = Math.min(5, Math.max(0, Math.floor((z - 200) / 90)));
    const nev2 = Math.min(5, Math.max(0, Math.floor((z2 - 260 - prof) / 260)));
    const linha = y * W;
    for (let x = 0; x < W; x++) {
      const tx = wx | 0, ty = wy | 0;
      let cor = tx >= 0 && ty >= 0 && tx < RES && ty < RES ? tex[ty * RES + tx] : 0;
      if (cor === 0) {
        cor = fundo[((uy | 0) & M) * L + ((ux | 0) & M)];
        if (nev2 > 0) cor = misturar(cor, nev2 / 6, nevoa);
      } else if (nev > 0) cor = misturar(cor, nev / 6, nevoa);
      pontos[linha + x] = cor;
      wx += px;
      wy += py;
      ux += sx2;
      uy += sy2;
    }
  }
  d.ctx.putImageData(d.imagem, 0, 0);
}

/** Onde um ponto da pista aparece na tela: x, y e a escala (1 = do tamanho da nave de quem joga). */
export function projetar(cam: Camera, x: number, y: number): { sx: number; sy: number; escala: number; z: number } | null {
  const dx = x - cam.x, dy = y - cam.y;
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const z = dx * fx + dy * fy;
  if (z < 6) return null;
  const lado = -dx * fy + dy * fx;
  return { sx: W / 2 + (lado * cam.foco) / z, sy: HORIZONTE + (ALTURA * cam.foco) / z, escala: (ATRAS * cam.foco) / (FOCO * z), z };
}

export interface Figura {
  z: number;
  desenhar: (ctx: CanvasRenderingContext2D) => void;
}

/** Os postes da borda, de pé (só os da frente da câmera, e não longe demais). */
export function postesNaTela(d: Desenho, p: PistaDoJato, cam: Camera, figuras: Figura[]) {
  for (const o of p.postes) {
    const dx = o.x - cam.x, dy = o.y - cam.y;
    if (dx * dx + dy * dy > 520 * 520) continue;
    const pr = projetar(cam, o.x, o.y);
    if (!pr) continue;
    const w = Math.max(1, Math.round(5 * pr.escala * 1.4)), h = Math.max(1, Math.round(16 * pr.escala * 1.4));
    if (pr.sx + w < 0 || pr.sx - w > W) continue;
    figuras.push({ z: pr.z, desenhar: (ctx) => ctx.drawImage(d.poste, Math.round(pr.sx - w / 2), Math.round(pr.sy - h), w, h) });
  }
}

/**
 * Uma nave na tela: a sombra no chão (só sobre a pista: no vazio não há chão), a nave flutuando, inclinada pelo `banco`, a
 * chama do motor, e o nome em cima (os da turma).
 */
export function naveNaTela(
  d: Desenho,
  p: PistaDoJato,
  cam: Camera,
  x: number,
  y: number,
  angulo: number,
  cores: CoresDaNave,
  o: { banco?: number; fantasma?: boolean; nome?: string; queda?: number; turbo?: boolean; tremor?: number; tempo: number },
): Figura | null {
  const pr = projetar(cam, x, y);
  if (!pr) return null;
  const e = pr.escala;
  const w = LADO * e;
  if (w < 2 || pr.sx + w < 0 || pr.sx - w > W) return null;
  const folha = folhaGuardada(cores);
  const k = vistaDaNave(angulo, cam.x, cam.y, x, y);
  const linha = (o.banco ?? 0) < -0.35 ? 0 : (o.banco ?? 0) > 0.35 ? 2 : 1;
  const queda = o.queda ?? 0;
  // flutua: uns pontos acima do chão, balançando devagar; caindo, desce e encolhe
  const flutua = (5 + Math.sin(o.tempo * 5 + x * 0.1) * 0.8) * e - queda * 60 * e;
  const encolhe = Math.max(0.15, 1 - queda * 0.9);
  const ww = w * encolhe;
  const nx = pr.sx - PE_X * e * encolhe, ny = pr.sy - PE_Y * e * encolhe - flutua + (o.tremor ?? 0);
  const sobreAPista = (() => {
    const c = p.chao[Math.floor(y * K) * RES + Math.floor(x * K)];
    return c !== undefined && c !== Chao.Vazio;
  })();
  const motor = folha.motores[linha * 24 + k];
  return {
    z: pr.z,
    desenhar: (ctx) => {
      if (sobreAPista && queda === 0) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = '#0a0612';
        ctx.beginPath();
        ctx.ellipse(pr.sx, pr.sy - e, 15 * e, 4 * e, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (o.fantasma) ctx.globalAlpha = 0.45;
      if (queda > 0) ctx.filter = `brightness(${Math.max(0.3, 1 - queda)})`;
      // a chama do motor, atrás da nave (de trás, só): pisca, e cresce no turbo
      if (motor.visivel && queda === 0) {
        const mx = nx + motor.x * e * encolhe, my = ny + motor.y * e * encolhe;
        const tam = (o.turbo ? 5.5 : 3.2) * e * (0.85 + 0.3 * Math.abs(Math.sin(o.tempo * 41 + x)));
        ctx.fillStyle = o.turbo ? '#ffe9a0' : '#7ae8ff';
        ctx.fillRect(Math.round(mx - tam / 2), Math.round(my - tam / 2), Math.max(1, Math.round(tam)), Math.max(1, Math.round(tam)));
        ctx.fillStyle = o.turbo ? '#ff8a3a' : '#3a8cff';
        const t2 = tam * 0.5;
        ctx.fillRect(Math.round(mx - t2 / 2), Math.round(my + tam / 2), Math.max(1, Math.round(t2)), Math.max(1, Math.round(t2 * 1.4)));
      }
      ctx.drawImage(folha.canvas, k * LADO, linha * LADO, LADO, LADO, Math.round(nx), Math.round(ny), Math.round(ww), Math.round(ww));
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      if (o.nome && e > 0.28) {
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'center';
        const tx = Math.round(pr.sx), ty = Math.round(ny + 6 * e);
        ctx.fillStyle = '#140e1c';
        ctx.fillText(o.nome, tx + 1, ty + 1);
        ctx.fillStyle = '#f6f0ff';
        ctx.fillText(o.nome, tx, ty);
      }
    },
  };
}

/** OS RISCOS DE VENTO nas beiradas da tela, quanto mais rápido, mais (e mais compridos). Saem do ponto de fuga. */
export function riscosDeVento(ctx: CanvasRenderingContext2D, v: number, turbo: boolean, tempo: number) {
  const forca = Math.max(0, (v - 170) / 260);
  if (forca <= 0) return;
  const cx = W / 2, cy = HORIZONTE + 8;
  const quantos = Math.round(6 + forca * 22);
  ctx.fillStyle = turbo ? '#fff2c8' : '#e4ecff';
  for (let i = 0; i < quantos; i++) {
    // cada risco tem um rumo fixo e anda para fora, recomeçando
    const ang = (i * 2.399) % (Math.PI * 2);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const fase = (tempo * (2.4 + forca * 3) + i * 0.37) % 1;
    const r0 = 95 + fase * 150, comp = 6 + forca * 26;
    ctx.globalAlpha = 0.18 + 0.35 * forca * (1 - fase * 0.5);
    for (let s = 0; s < comp; s += 1.5) {
      const px = cx + ca * (r0 + s) * 1.25, py = cy + sa * (r0 + s) * 0.62;
      if (px < 0 || px >= W || py < 0 || py >= H) break;
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

/** As faíscas da batida na borda, do lado em que bateu. */
export function faiscas(ctx: CanvasRenderingContext2D, lado: number, tempo: number) {
  const x = W / 2 + lado * 18, y = 150;
  for (let i = 0; i < 10; i++) {
    const s = Math.sin(tempo * 53 + i * 1.7), c = Math.cos(tempo * 31 + i * 2.3);
    ctx.fillStyle = i % 2 ? '#ffe28a' : '#9af0ff';
    ctx.fillRect(Math.round(x + lado * (3 + Math.abs(s) * 12)), Math.round(y - Math.abs(c) * 14), 2, 2);
  }
}

/**
 * O PAINEL: a barra de energia no alto à esquerda (verde, amarela e vermelha, piscando quando acaba), o turbo pronto (o raio)
 * e a posição no canto direito ("3/12"); embaixo, a velocidade numa barra. Tudo desenho e número: nenhuma palavra.
 */
export function painel(ctx: CanvasRenderingContext2D, o: { energia: number; turboPronto: boolean; turboVisto: boolean; posicao: number; total: number; v: number; vmax: number; tempo: number; recarga: boolean }) {
  // a energia
  const x = 8, y = 22, w = 74, h = 7;
  ctx.fillStyle = '#140e1c';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#3a2e48';
  ctx.fillRect(x, y, w, h);
  const f = Math.max(0, Math.min(1, o.energia / 100));
  const pisca = f < 0.25 && Math.floor(o.tempo * 6) % 2 === 0;
  ctx.fillStyle = pisca ? '#ffffff' : f > 0.5 ? '#6ee07a' : f > 0.25 ? '#f6d04a' : '#f0545a';
  ctx.fillRect(x, y, Math.round(w * f), h);
  ctx.fillStyle = '#ffffff55';
  ctx.fillRect(x, y, Math.round(w * f), 2);
  if (o.recarga) {
    ctx.fillStyle = '#ffb0e0';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + w + 6 + i * 4, y + 1 + ((Math.floor(o.tempo * 10) + i) % 3), 2, 2);
  }
  // o raio do turbo: aceso quando dá para usar (da segunda volta em diante)
  if (o.turboVisto) {
    const rx = x + 2, ry = y + 11;
    ctx.fillStyle = o.turboPronto ? (Math.floor(o.tempo * 3) % 2 ? '#ffe680' : '#ffd040') : '#5a4c6a';
    const raio = ['...##', '..##.', '.####', '..##.', '.##..', '##...'];
    raio.forEach((l, i) => [...l].forEach((ch, j) => ch === '#' && ctx.fillRect(rx + j * 2, ry + i * 2, 2, 2)));
  }
  // a posição
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#140e1c';
  ctx.fillText(String(o.posicao), W - 30, 46);
  ctx.fillStyle = o.posicao === 1 ? '#ffd860' : '#f6f0ff';
  ctx.fillText(String(o.posicao), W - 31, 45);
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#140e1c';
  ctx.fillText(`/${o.total}`, W - 28, 46);
  ctx.fillStyle = '#d8cce8';
  ctx.fillText(`/${o.total}`, W - 29, 45);
  // a velocidade
  const vx = 8, vy = H - 12, vw = 60;
  ctx.fillStyle = '#140e1c';
  ctx.fillRect(vx - 1, vy - 1, vw + 2, 5);
  const fv = Math.max(0, Math.min(1, o.v / o.vmax));
  for (let i = 0; i < vw; i += 3) {
    if (i / vw > fv) break;
    ctx.fillStyle = i / vw > 0.85 ? '#ff8a5a' : '#9ad8ff';
    ctx.fillRect(vx + i, vy, 2, 3);
  }
}

/** O semáforo: três luzes vermelhas, uma a uma, e as três verdes na saída. */
export function semaforo(ctx: CanvasRenderingContext2D, contagem: number) {
  const acesas = contagem > 0 ? Math.min(3, Math.max(0, 3 - Math.floor((contagem - 1) / 60))) : 3;
  const verde = contagem === 0;
  const x0 = W / 2 - 27, y0 = 14;
  ctx.fillStyle = '#140e1c';
  ctx.fillRect(x0 - 4, y0 - 4, 62, 22);
  ctx.fillStyle = '#2e2640';
  ctx.fillRect(x0 - 3, y0 - 3, 60, 20);
  for (let i = 0; i < 3; i++) {
    const cx = x0 + 7 + i * 20;
    ctx.fillStyle = verde ? '#7ee070' : i < acesas ? '#ff5a6a' : '#4a2232';
    ctx.fillRect(cx - 6, y0 + 1, 12, 12);
    ctx.fillStyle = verde ? '#d0ffc0' : i < acesas ? '#ffc0c8' : '#5a3040';
    ctx.fillRect(cx - 4, y0 + 3, 4, 4);
  }
}

/** O mapa pequeno: a pista vista de cima (a borda em cor, os trechos abertos em amarelo). */
export function mapaDaPista(p: PistaDoJato, lado: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const g = c.getContext('2d')!;
  const img = g.createImageData(lado, lado);
  const px = new Uint32Array(img.data.buffer);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const tx = Math.floor(((x + 0.5) / lado) * RES), ty = Math.floor(((y + 0.5) / lado) * RES);
      const tipo = p.chao[ty * RES + tx];
      px[y * lado + x] = tipo === Chao.Vazio ? 0 : tipo === Chao.Borda ? rgb(120, 220, 255) : tipo === Chao.Aviso ? rgb(250, 200, 60) : tipo === Chao.Recarga ? rgb(232, 96, 168) : rgb(226, 220, 240);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function pontoNoMapa(ctx: CanvasRenderingContext2D, x0: number, y0: number, lado: number, x: number, y: number, cor: string, tam = 3) {
  const px = Math.round(x0 + (x / MUNDO) * lado), py = Math.round(y0 + (y / MUNDO) * lado);
  ctx.fillStyle = '#140e1c';
  ctx.fillRect(px - (tam >> 1) - 1, py - (tam >> 1) - 1, tam + 2, tam + 2);
  ctx.fillStyle = cor;
  ctx.fillRect(px - (tam >> 1), py - (tam >> 1), tam, tam);
}
