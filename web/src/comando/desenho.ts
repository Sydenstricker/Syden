/**
 * O DESENHO DO COMANDO CENOURA (16/11/2026): numa tela de 320 × 180 ampliada com os pixels nítidos, como a Briga na horta, e
 * com o que ela já tem — o cenário da floresta (as camadas do ansimuz, CC0, briga/cenarios.ts), os bichos das folhas da
 * Quaternius (briga/sprites.ts) e o coelho de lado com as cores do avatar (briga/desenho.ts). O que é só deste jogo é por
 * código: as tábuas, as gaiolas, o lança-cenouras, as balas, a granada, a fumaça e as marcas que avisam o golpe.
 *
 * Nada aqui é de outro jogo, e nada sangra: o bicho derrubado vira uma nuvem de fumaça.
 */
import { desenharCenario } from '../briga/cenarios';
import { desenharCoelho, desenhoDoCoelho } from '../briga/desenho';
import type { EstadoDoInimigo } from '../briga/regras';
import { desenharBichoDaFolha, desenharTiro } from '../briga/sprites';
import { BICHOS, CHAO_TELA, DIRECOES, FIM_DA_FASE, GRANADA, H, PLATAFORMAS, REFENS, W, type Arma, type EstadoDoBicho } from './conta';
import type { BichoNaTela, Efeito } from './regras';

type G = CanvasRenderingContext2D;
export const naTela = (camX: number, x: number, h: number) => ({ sx: Math.round(x - camX), sy: Math.round(CHAO_TELA - h) });

/** O índice da floresta em FASES_DA_BRIGA (o cenário que o Comando usa). */
const FLORESTA = 1;

export function desenharFundo(g: G, camX: number, tempo: number, cenario = FLORESTA) {
  desenharCenario(g, cenario, camX, FIM_DA_FASE, tempo);
  // a trilha onde se corre: uma faixa de terra batida mais clara, com a borda
  g.fillStyle = '#5a4430';
  g.fillRect(0, CHAO_TELA, W, H - CHAO_TELA);
  g.fillStyle = '#6e5538';
  g.fillRect(0, CHAO_TELA, W, 2);
  g.fillStyle = '#4a3828';
  for (let x = -((camX * 1) % 23) - 23; x < W; x += 23) g.fillRect(Math.round(x), CHAO_TELA + 8 + (Math.round(x + camX) % 3), 4, 1);
}

/** As tábuas sobre caixotes. */
export function desenharPlataformas(g: G, camX: number) {
  for (const [x0, x1, h] of PLATAFORMAS) {
    if (x1 - camX < -10 || x0 - camX > W + 10) continue;
    const a = Math.round(x0 - camX), b = Math.round(x1 - camX), y = CHAO_TELA - h;
    // os caixotes embaixo, um em cada ponta
    for (const cx of [a + 2, b - 18]) {
      g.fillStyle = '#7a5234';
      g.fillRect(cx, y + 4, 16, h - 4);
      g.fillStyle = '#9a6c44';
      g.fillRect(cx + 1, y + 5, 14, h - 6);
      g.fillStyle = '#6a4428';
      g.fillRect(cx + 1, y + 5 + Math.floor((h - 6) / 2), 14, 1);
      g.fillRect(cx + 7, y + 5, 1, h - 6);
    }
    // a tábua
    g.fillStyle = '#5a3a22';
    g.fillRect(a - 1, y - 1, b - a + 2, 6);
    g.fillStyle = '#c08a58';
    g.fillRect(a, y, b - a, 3);
    g.fillStyle = '#a87448';
    g.fillRect(a, y + 3, b - a, 1);
    g.fillStyle = '#5a3a22';
    for (let x = a + 12; x < b - 4; x += 14) g.fillRect(x, y, 1, 3);
  }
}

/** As gaiolas: fechada, com o coelhinho dentro; aberta, a porta caída. */
export function desenharGaiolas(g: G, camX: number, gaiolas: number[], folha: CanvasImageSource | null, tempo: number) {
  REFENS.forEach(([x], k) => {
    const sx = Math.round(x - camX);
    if (sx < -30 || sx > W + 30) return;
    const y = CHAO_TELA;
    const aberta = !!gaiolas[k];
    // o chão da gaiola
    g.fillStyle = '#4a3628';
    g.fillRect(sx - 13, y - 3, 26, 3);
    if (!aberta) {
      // o coelhinho, pequeno, pulando de vez em quando (pede ajuda sem texto)
      const pula = Math.floor(tempo / 600) % 3 === 0 ? 2 : 0;
      if (folha) {
        g.save();
        g.translate(sx, y - 3 - pula);
        g.scale(0.5, 0.5);
        g.drawImage(folha, 0, 0, 80, 80, -42, -69, 80, 80);
        g.restore();
      }
    }
    // as grades
    g.fillStyle = '#8a8a96';
    g.fillRect(sx - 13, y - 30, 26, 2);
    for (let b = -12; b <= 12; b += 4) {
      if (aberta && b > -4 && b < 8) continue;
      g.fillRect(sx + b, y - 29, 1, 26);
    }
    g.fillStyle = '#b4b4c0';
    g.fillRect(sx - 2, y - 33, 4, 3);
    if (aberta) {
      // a porta no chão
      g.fillStyle = '#8a8a96';
      g.fillRect(sx - 3, y - 2, 12, 1);
    } else if (Math.floor(tempo / 400) % 2 === 0) {
      // a setinha em cima, piscando: "aqui"
      g.fillStyle = '#ffd36a';
      g.fillRect(sx - 2, y - 42, 5, 2);
      g.fillRect(sx - 1, y - 40, 3, 2);
      g.fillRect(sx, y - 38, 1, 1);
    }
  });
}

/** O estado do Comando no nome que o desenho dos bichos da Briga entende. */
function estadoNaFolha(e: EstadoDoBicho): EstadoDoInimigo {
  switch (e) {
    case 'entrando':
    case 'andando':
      return 'andando';
    case 'rondando':
      return 'rondando';
    case 'preparando':
    case 'mirando':
    case 'marcando':
    case 'prep-fogo':
    case 'prep-pisao':
      return 'preparando';
    case 'atacando':
    case 'fogo':
    case 'chamando':
      return 'atacando';
    case 'saltando':
      return 'saltando';
    case 'dor':
      return 'dor';
    case 'morto':
      return 'morto';
    default:
      return 'esperando';
  }
}

export function desenharBicho(g: G, b: BichoNaTela, camX: number, tempo: number, piscando: boolean) {
  if (b.estado === 'morto') return;
  const { sx, sy } = naTela(camX, b.x, b.h);
  if (BICHOS[b.tipo].comp === 'capsula') return desenharCapsula(g, sx, sy, tempo, piscando);
  // a sombra no chão
  const c = BICHOS[b.tipo];
  g.fillStyle = '#2e2218';
  const w = Math.max(6, c.larg * 2 - b.h * 0.15);
  g.fillRect(Math.round(sx - w / 2), CHAO_TELA - 1, Math.round(w), 2);
  desenharBichoDaFolha(g, { tipo: b.tipo as Exclude<typeof b.tipo, 'capsula'>, estado: estadoNaFolha(b.estado), lado: b.lado, ms: b.ms, piscando }, sx, sy, tempo);
  // a vida dos pequenos, quando já levaram bala
  if (c.comp !== 'chefe' && b.hp < 100) {
    g.fillStyle = '#2a1e1a';
    g.fillRect(sx - 8, sy - c.alto - 6, 16, 3);
    g.fillStyle = '#e2574a';
    g.fillRect(sx - 7, sy - c.alto - 5, Math.max(1, Math.round((14 * b.hp) / 100)), 1);
  }
}

/** Os avisos de golpe, no chão e no ar: a linha do tiro, a marca da semente, a do pisão. Piscam, e apertam perto do fim. */
export function desenharAvisos(g: G, bichos: BichoNaTela[], camX: number, tempo: number) {
  const pisca = (ms: number) => Math.floor(tempo / (ms > 500 ? 120 : 60)) % 2 === 0;
  for (const b of bichos) {
    const { sx } = naTela(camX, b.x, 0);
    if (b.estado === 'mirando' && pisca(b.ms)) {
      g.fillStyle = '#ffd36a';
      const y = CHAO_TELA - 12;
      for (let k = 0; k < 18; k++) g.fillRect(sx + b.lado * (14 + k * 8), y, b.lado * 4, 1);
    } else if (b.estado === 'prep-fogo' && pisca(b.ms)) {
      g.fillStyle = '#ff9a3a';
      const y = CHAO_TELA - 10;
      for (let k = 0; k < 40; k++) g.fillRect(sx - 30 - k * 8, y, 4, 2);
    } else if ((b.estado === 'marcando' || b.estado === 'prep-pisao' || b.estado === 'saltando') && pisca(b.ms)) {
      const ax = Math.round(b.alvoX - camX);
      const chefe = BICHOS[b.tipo].comp === 'chefe';
      const r = chefe ? 40 : 10;
      g.strokeStyle = chefe ? '#ff6a4a' : '#ffd36a';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(ax, CHAO_TELA - 1, r, Math.max(2, r / 4), 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
}

/** As balas dos bichos: o tiro e o fogo (os da Briga), e a semente que cai. */
export function desenharBalasInimigas(g: G, balas: { tipo: number; x: number; h: number; vx: number }[], camX: number, tempo: number) {
  for (const b of balas) {
    const { sx, sy } = naTela(camX, b.x, b.h);
    if (b.tipo === 2) {
      g.fillStyle = '#3a2416';
      g.fillRect(sx - 2, sy - 3, 5, 6);
      g.fillStyle = '#8a5a2a';
      g.fillRect(sx - 1, sy - 2, 3, 4);
      g.fillStyle = '#6f9a4e';
      g.fillRect(sx, sy - 5, 1, 2);
    } else desenharTiro(g, b.tipo === 3 ? 'yeti' : b.tipo === 1 ? 'dragao' : 'dino', sx, sy, b.vx > 0 ? 1 : -1, tempo);
  }
}

/** Uma bala de cenoura (a ponta laranja na frente, o rabinho verde atrás). */
export function desenharBala(g: G, x: number, h: number, dx: number, dh: number, camX: number, minha: boolean, arma: Arma = 'normal', tempo = 0) {
  const { sx, sy } = naTela(camX, x, h);
  if (arma === 'chama') {
    // a CHAMA CURTA (19/11/2026): faíscas que tremem, do amarelo ao vermelho
    const k = Math.floor(tempo / 40 + x) % 3;
    g.fillStyle = ['#fff2a0', '#ffb040', '#ff6a2a'][k];
    g.fillRect(sx - 2, sy - 2, 4, 4);
    g.fillStyle = '#ff8a2a';
    g.fillRect(Math.round(sx - dx * 4) - 1, Math.round(sy + dh * 4) - 1, 2, 2);
    return;
  }
  if (arma === 'teleguiada') {
    // a TELEGUIADA: uma cenoura maior, com o rastro de fumaça
    g.fillStyle = '#c8c0b8';
    g.fillRect(Math.round(sx - dx * 7) - 1, Math.round(sy + dh * 7) - 1, 2, 2);
    g.fillRect(Math.round(sx - dx * 10), Math.round(sy + dh * 10), 1, 1);
    g.fillStyle = '#ff7a1a';
    g.fillRect(sx - 2, sy - 2, 5, 4);
    g.fillStyle = '#7ab04a';
    g.fillRect(Math.round(sx - dx * 4) - 1, Math.round(sy + dh * 4) - 1, 2, 2);
    return;
  }
  g.fillStyle = minha ? '#ff8a2a' : '#e8a060';
  g.fillRect(sx - 1, sy - 1, 3, 3);
  g.fillRect(Math.round(sx - dx * 2) - 1, Math.round(sy + dh * 2) - 1, 2, 2);
  g.fillStyle = '#7ab04a';
  g.fillRect(Math.round(sx - dx * 4), Math.round(sy + dh * 4), 1, 1);
}

/** O coelho com o lança-cenouras na mão, apontado pela mira. */
export function desenharComando(
  g: G,
  folha: CanvasImageSource | null,
  camX: number,
  x: number,
  h: number,
  lado: number,
  acao: string,
  t: number,
  mira: number,
  opcoes: { piscando?: boolean; nome?: string; eu?: boolean; subindo?: boolean; arma?: Arma },
) {
  const { sx, sy } = naTela(camX, x, h);
  // a sombra no chão (no alto da tábua, embaixo dele)
  g.fillStyle = '#2e2218';
  g.fillRect(sx - 6, sy - 1, 12, 2);
  if (opcoes.piscando && Math.floor(performance.now() / 80) % 2 === 0) return;
  const naFolha = acao === 'pulo' ? 'pulo' : acao === 'andando' ? 'andando' : acao === 'dor' ? 'dor' : acao === 'caido' ? 'caido' : 'parado';
  desenharCoelho(g, folha, sx, sy, lado, desenhoDoCoelho(naFolha, t, !!opcoes.subindo), { nome: opcoes.nome, eu: opcoes.eu });
  if (acao === 'caido') return;
  // o lança-cenouras: um tubo laranja com as folhas atrás, saindo da mão
  const [dx, dh] = DIRECOES[mira] ?? DIRECOES[0];
  const mx = sx + lado * 2, my = sy - 20;
  const ponta = 12;
  for (let k = 0; k <= ponta; k++) {
    const px = Math.round(mx + dx * k), py = Math.round(my - dh * k);
    g.fillStyle = k > ponta - 3 ? '#c85a1a' : opcoes.arma === 'rapida' ? '#ffb040' : opcoes.arma === 'leque' ? '#ff7a5a' : '#f08a2a';
    g.fillRect(px - 1, py - 1, 3, 3);
  }
  g.fillStyle = '#5f9a3a';
  g.fillRect(Math.round(mx - dx * 3) - 1, Math.round(my + dh * 3) - 2, 2, 3);
  g.fillRect(Math.round(mx - dx * 4), Math.round(my + dh * 4) - 3, 2, 2);
}

/** A granada (a bola de repolho com o pavio) no arco: `p` de 0 a 1. */
export function desenharGranada(g: G, x0: number, h0: number, x1: number, p: number, camX: number) {
  const x = x0 + (x1 - x0) * p;
  const h = h0 * (1 - p) + 4 * 38 * p * (1 - p);
  const { sx, sy } = naTela(camX, x, h);
  g.fillStyle = '#3a5a2a';
  g.fillRect(sx - 3, sy - 3, 6, 6);
  g.fillStyle = '#8ac060';
  g.fillRect(sx - 2, sy - 2, 4, 4);
  g.fillStyle = '#ffd36a';
  g.fillRect(sx + 1, sy - 5, 1, 2);
  // onde ela vai cair (só uma marquinha no chão)
  g.fillStyle = '#ffd36a80';
  g.fillRect(Math.round(x1 - camX) - 4, CHAO_TELA - 1, 8, 1);
}

/** Um círculo de pixels (sem antisserrilhado). */
function bola(g: G, cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

/** Os efeitos: faísca, fumaça (o bicho derrubado), explosão, pancada, a gaiola aberta. Devolve false quando acabou. */
export function desenharEfeito(g: G, e: Efeito, camX: number, tempo: number): boolean {
  const idade = tempo - e.em;
  if (idade < 0) return true;
  const { sx, sy } = naTela(camX, e.x, e.h);
  if (e.tipo === 'faisca') {
    if (idade > 160) return false;
    g.fillStyle = idade < 70 ? '#fff6c8' : '#ffb04a';
    const r = 2 + idade / 40;
    g.fillRect(sx - r, sy, 2, 1);
    g.fillRect(sx + r, sy, 2, 1);
    g.fillRect(sx, sy - r, 1, 2);
    g.fillRect(sx, sy + r, 1, 2);
    return true;
  }
  if (e.tipo === 'fumaca') {
    const dura = e.grande ? 1100 : 650;
    if (idade > dura) return false;
    const k = idade / dura;
    const r = (e.grande ? 10 : 5) + k * (e.grande ? 22 : 10);
    const cores = ['#f4efe6', '#d8d2c8', '#b8b0a6'];
    for (let i = 0; i < (e.grande ? 6 : 4); i++) {
      g.fillStyle = cores[i % 3];
      const ox = ((i * 37) % 13) - 6, oy = ((i * 23) % 9) - 4;
      bola(g, sx + ox * (1 + k), sy + oy - k * 8, Math.max(1, Math.round(r * (0.5 + 0.12 * i) * (1 - k * 0.6))));
    }
    return true;
  }
  if (e.tipo === 'explosao' && !e.pequena) {
    if (idade > 600) return false;
    const k = idade / 600;
    const r = Math.round(GRANADA.raio * (0.4 + k * 0.6));
    g.fillStyle = k < 0.3 ? '#fff6c8' : k < 0.6 ? '#ffb04a' : '#c8b8a8';
    bola(g, sx, CHAO_TELA - r * 0.5, Math.round(r * (1 - k * 0.4)));
    g.fillStyle = '#ff7a3a';
    if (k < 0.5) bola(g, sx, CHAO_TELA - r * 0.4, Math.round(r * 0.5));
    return true;
  }
  if (e.tipo === 'explosao' && e.pequena) {
    if (idade > 300) return false;
    g.fillStyle = idade < 120 ? '#fff6c8' : '#ffb04a';
    bola(g, sx, sy, Math.round(3 + idade / 40));
    return true;
  }
  if (e.tipo === 'pisao' || e.tipo === 'semente') {
    const dura = e.tipo === 'pisao' ? 450 : 300;
    if (idade > dura) return false;
    g.fillStyle = '#c4a888';
    const r = (e.tipo === 'pisao' ? 12 : 3) + idade / 20;
    g.fillRect(Math.round(sx - r), CHAO_TELA - 3, 3, 2);
    g.fillRect(Math.round(sx + r), CHAO_TELA - 3, 3, 2);
    g.fillRect(Math.round(sx - r / 2), CHAO_TELA - 5, 2, 2);
    g.fillRect(Math.round(sx + r / 2), CHAO_TELA - 5, 2, 2);
    return true;
  }
  if (e.tipo === 'clarao') {
    // O CLARÃO NO CANO (19/11/2026): um instante de luz na ponta do lança-cenouras, na direção da mira
    if (idade > 70) return false;
    const [dx, dh] = DIRECOES[((e.dir ?? 0) % 8 + 8) % 8];
    const r = idade < 35 ? 4 : 2;
    g.fillStyle = idade < 35 ? '#fff6c8' : '#ffb04a';
    bola(g, sx + dx * 3, sy - dh * 3, r);
    g.fillStyle = '#fff6c8';
    g.fillRect(Math.round(sx + dx * (6 + r)), Math.round(sy - dh * (6 + r)), 2, 2);
    return true;
  }
  if (e.tipo === 'solto') {
    // o coelhinho sai pulando para cima, com estrelinhas
    if (idade > 900) return false;
    g.fillStyle = '#ffd36a';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * 6.28 + idade / 200;
      g.fillRect(Math.round(sx + Math.cos(a) * (8 + idade / 40)), Math.round(sy - 20 - idade / 30 + Math.sin(a) * 6), 2, 2);
    }
    return true;
  }
  // a pancada em mim: um clarão branco em volta
  if (idade > 220) return false;
  g.fillStyle = '#fff6c8';
  const r = 4 + idade / 25;
  g.fillRect(Math.round(sx - r), sy, 2, 2);
  g.fillRect(Math.round(sx + r), sy, 2, 2);
  g.fillRect(sx, Math.round(sy - r), 2, 2);
  return true;
}

/** No canto de cima: a arma que tenho (e quanto falta dela) e a granada carregando. */
export function desenharMinhaMao(g: G, arma: Arma, restaArma: number, cargaGranada: number) {
  g.fillStyle = '#1e1822c0';
  g.fillRect(4, 4, 46, 14);
  // a arma: 1, 3 ou a seta dupla, em balas
  g.fillStyle = arma === 'normal' ? '#f08a2a' : '#ffd36a';
  if (arma === 'leque') {
    g.fillRect(8, 7, 3, 2);
    g.fillRect(8, 10, 3, 2);
    g.fillRect(8, 13, 3, 2);
  } else if (arma === 'rapida') {
    g.fillRect(7, 10, 3, 2);
    g.fillRect(11, 10, 3, 2);
  } else if (arma === 'chama') {
    g.fillStyle = '#ff6a2a';
    g.fillRect(7, 9, 4, 4);
    g.fillStyle = '#fff2a0';
    g.fillRect(8, 10, 2, 2);
  } else if (arma === 'teleguiada') {
    g.fillStyle = '#ff7a1a';
    g.fillRect(7, 9, 5, 4);
    g.fillStyle = '#c8c0b8';
    g.fillRect(12, 11, 2, 1);
  } else g.fillRect(8, 10, 3, 2);
  if (arma !== 'normal') {
    g.fillStyle = '#5a4a40';
    g.fillRect(16, 10, 12, 2);
    g.fillStyle = '#ffd36a';
    g.fillRect(16, 10, Math.max(1, Math.round(12 * restaArma)), 2);
  }
  // a granada: a bolinha verde, e o anel enchendo
  g.fillStyle = cargaGranada >= 1 ? '#8ac060' : '#4a5a40';
  g.fillRect(35, 8, 7, 7);
  if (cargaGranada < 1) {
    g.fillStyle = '#8ac060';
    const alto = Math.round(7 * cargaGranada);
    g.fillRect(35, 15 - alto, 7, alto);
  } else {
    g.fillStyle = '#ffd36a';
    g.fillRect(40, 6, 1, 2);
  }
}

/** A CÁPSULA VOADORA (19/11/2026): um casulo de metal com a hélice em cima e a luz piscando; derrubada, solta a arma. */
function desenharCapsula(g: G, sx: number, sy: number, tempo: number, piscando: boolean) {
  const y = sy - 6;
  g.fillStyle = '#2e2218';
  g.fillRect(sx - 8, y - 4, 16, 10);
  g.fillStyle = piscando ? '#ffffff' : '#8aa0b8';
  g.fillRect(sx - 7, y - 3, 14, 8);
  g.fillStyle = piscando ? '#ffffff' : '#c0d0e0';
  g.fillRect(sx - 6, y - 2, 6, 2);
  // a faixa do meio, com a luz
  g.fillStyle = '#4a5a6a';
  g.fillRect(sx - 7, y + 1, 14, 1);
  g.fillStyle = Math.floor(tempo / 250) % 2 === 0 ? '#ffd36a' : '#ff6a3a';
  g.fillRect(sx - 1, y, 2, 2);
  // a hélice girando
  const w = 2 + Math.abs(Math.round(Math.sin(tempo / 40) * 7));
  g.fillStyle = '#3a3a44';
  g.fillRect(sx, y - 7, 1, 3);
  g.fillRect(sx - w, y - 8, w * 2 + 1, 1);
}

/** As armas no chão (a cápsula derrubada): a caixinha com a figura da arma, pulando de leve e com a seta "aqui". */
export function desenharItens(g: G, camX: number, itens: { arma: Arma; x: number }[], tempo: number) {
  for (const it of itens) {
    const sx = Math.round(it.x - camX);
    if (sx < -20 || sx > W + 20) continue;
    const y = CHAO_TELA - 8 - (Math.floor(tempo / 300) % 2);
    g.fillStyle = '#2e2218';
    g.fillRect(sx - 6, y - 1, 12, 9);
    g.fillStyle = '#ffd36a';
    g.fillRect(sx - 5, y, 10, 7);
    g.fillStyle = it.arma === 'chama' ? '#ff6a2a' : '#ff7a1a';
    g.fillRect(sx - 3, y + 2, it.arma === 'chama' ? 4 : 6, 3);
    if (it.arma === 'chama') {
      g.fillStyle = '#fff2a0';
      g.fillRect(sx + 1, y + 2, 2, 2);
    } else {
      g.fillStyle = '#7ab04a';
      g.fillRect(sx + 3, y + 3, 2, 1);
    }
    if (Math.floor(tempo / 400) % 2 === 0) {
      g.fillStyle = '#ffd36a';
      g.fillRect(sx - 2, y - 9, 5, 2);
      g.fillRect(sx - 1, y - 7, 3, 2);
    }
  }
}
