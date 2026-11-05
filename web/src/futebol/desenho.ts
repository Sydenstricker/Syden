/**
 * O DESENHO DO FUTEBOL DOS COELHOS (05/11/2026): o campo por código (as faixas de grama e as linhas nas cores do Sports Pack da
 * Kenney), os jogadores da Kenney (CC0, web/public/futebol/, com a licença ao lado) e, por cima da cabeça de cada um, a cabeça
 * de coelho e as duas orelhas desenhadas aqui — é isso que faz do jogador um coelho. Os ângulos (o jogador virado para onde
 * corre, a bola rolando) são só do desenho: a simulação (sim.ts) não usa seno nem cosseno.
 */
import { CX, CY, GOL_FUNDO, GOL_MEIA, H, R_BOLA, RAIO_DO_CENTRO, W, X0, X1, Y0, Y1 } from './sim';

export interface Folhas {
  jogador: [HTMLImageElement, HTMLImageElement];
  braco: [HTMLImageElement, HTMLImageElement];
  bola: HTMLImageElement;
}

export function carregarFolhas(): Folhas {
  const img = (nome: string) => {
    const i = new Image();
    i.src = `${import.meta.env.BASE_URL}futebol/${nome}.png`;
    return i;
  };
  return {
    jogador: [img('jogador-azul'), img('jogador-laranja')],
    braco: [img('braco-azul'), img('braco-laranja')],
    bola: img('bola'),
  };
}

/** As cores dos times (as camisas da Kenney: azul e laranja), para o placar e o "Gol!". */
export const COR_DO_TIME = ['#3d9be0', '#ee7a26'] as const;

const GRAMA_CLARA = '#35cf6c';
const GRAMA_ESCURA = '#2ec463';
const FORA = '#23a352';
const LINHA = 'rgba(255,255,255,0.92)';

/** O campo, desenhado uma vez numa tela à parte. */
export function desenharCampo(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = FORA;
  g.fillRect(0, 0, W, H);
  // as faixas de grama cortada
  const faixa = 40;
  for (let x = X0, k = 0; x < X1; x += faixa, k++) {
    g.fillStyle = k % 2 === 0 ? GRAMA_CLARA : GRAMA_ESCURA;
    g.fillRect(x, Y0, Math.min(faixa, X1 - x), Y1 - Y0);
  }
  // as redes, dentro do gol
  for (const lado of [-1, 1]) {
    const gx = lado < 0 ? X0 - GOL_FUNDO : X1;
    g.fillStyle = '#dfe8ef';
    g.fillRect(gx, CY - GOL_MEIA, GOL_FUNDO, GOL_MEIA * 2);
    g.fillStyle = '#b9c6d2';
    for (let y = 0; y < GOL_MEIA * 2; y += 4) for (let x = 0; x < GOL_FUNDO; x += 4) if ((x / 4 + y / 4) % 2 === 0) g.fillRect(gx + x, CY - GOL_MEIA + y, 2, 2);
  }
  // a mureta baixa em volta do campo
  g.fillStyle = '#f4efe2';
  g.fillRect(X0 - 6, Y0 - 6, X1 - X0 + 12, 4);
  g.fillRect(X0 - 6, Y1 + 2, X1 - X0 + 12, 4);
  g.fillRect(X0 - 6, Y0 - 6, 4, CY - GOL_MEIA - Y0 + 6);
  g.fillRect(X0 - 6, CY + GOL_MEIA, 4, Y1 + 6 - CY - GOL_MEIA);
  g.fillRect(X1 + 2, Y0 - 6, 4, CY - GOL_MEIA - Y0 + 6);
  g.fillRect(X1 + 2, CY + GOL_MEIA, 4, Y1 + 6 - CY - GOL_MEIA);
  // as linhas
  g.strokeStyle = LINHA;
  g.lineWidth = 2;
  g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
  g.beginPath();
  g.moveTo(CX, Y0);
  g.lineTo(CX, Y1);
  g.stroke();
  g.beginPath();
  g.arc(CX, CY, RAIO_DO_CENTRO, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = LINHA;
  g.beginPath();
  g.arc(CX, CY, 3, 0, Math.PI * 2);
  g.fill();
  for (const lado of [-1, 1]) {
    const linha = lado < 0 ? X0 : X1;
    const area = 70;
    const pequena = 26;
    g.strokeRect(lado < 0 ? linha : linha - area, CY - 90, area, 180);
    g.strokeRect(lado < 0 ? linha : linha - pequena, CY - 50, pequena, 100);
    g.beginPath();
    g.arc(linha - lado * 52, CY, 2.5, 0, Math.PI * 2);
    g.fill();
    // a meia-lua da área
    g.beginPath();
    if (lado < 0) g.arc(linha + 52, CY, 36, -0.93, 0.93);
    else g.arc(linha - 52, CY, 36, Math.PI - 0.93, Math.PI + 0.93);
    g.stroke();
    // as traves
    g.fillStyle = '#ffffff';
    const tx = lado < 0 ? X0 - GOL_FUNDO : X1;
    g.fillRect(tx, CY - GOL_MEIA - 2, GOL_FUNDO, 3);
    g.fillRect(tx, CY + GOL_MEIA - 1, GOL_FUNDO, 3);
    g.fillRect(lado < 0 ? X0 - GOL_FUNDO - 2 : X1 + GOL_FUNDO - 1, CY - GOL_MEIA - 2, 3, GOL_MEIA * 2 + 4);
    g.fillStyle = LINHA;
  }
  return c;
}

export interface JogadorNaTela {
  id: number;
  time: 0 | 1;
  x: number;
  y: number;
  fx: number;
  fy: number;
  /** A corrida (para o balanço dos braços): a velocidade em px por passo. */
  vel: number;
  carga: number;
  tonto: number;
  nome: string;
  /** A cor do pelo (do avatar pronto da pessoa, ou o creme do mascote). */
  pelo: [number, number, number];
  eu: boolean;
}

/** O balanço dos braços e das orelhas, pelo relógio da tela. */
export function desenharJogador(g: CanvasRenderingContext2D, f: Folhas, j: JogadorNaTela, ms: number) {
  const ang = Math.atan2(j.fy, j.fx);
  const correndo = Math.min(1, j.vel / 1.6);
  const balanco = Math.sin(ms / 80 + j.id) * 0.45 * correndo;
  // a sombra e, para mim, o anel no chão
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(j.x + 2, j.y + 3, 11, 9, 0, 0, Math.PI * 2);
  g.fill();
  if (j.eu) {
    g.strokeStyle = '#ffe066';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(j.x, j.y, 15, 15, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.save();
  g.translate(Math.round(j.x), Math.round(j.y));
  g.rotate(ang);
  // os braços (a peça da Kenney, de cada lado do ombro), balançando ao correr
  const braco = f.braco[j.time];
  if (braco.complete && braco.naturalWidth) {
    for (const lado of [-1, 1]) {
      g.save();
      g.translate(-3, lado * 10);
      g.rotate(lado * (0.25 + balanco * lado));
      g.drawImage(braco, -2, -4, 13, 9);
      g.restore();
    }
  }
  const corpo = f.jogador[j.time];
  if (corpo.complete && corpo.naturalWidth) g.drawImage(corpo, -10.5, -15.5);
  // A CABEÇA DE COELHO: as orelhas para trás (o coelho corre de orelhas deitadas), e a cabeça por cima do cabelo da Kenney
  const [r, gg, b] = j.pelo;
  const pelo = `rgb(${r},${gg},${b})`;
  const sombraDoPelo = `rgb(${Math.round(r * 0.8)},${Math.round(gg * 0.8)},${Math.round(b * 0.8)})`;
  const orelha = Math.sin(ms / 120 + j.id) * 0.12 * correndo;
  for (const lado of [-1, 1]) {
    g.save();
    g.translate(-5, lado * 4.6);
    g.rotate(Math.PI + lado * (0.62 + orelha));
    g.fillStyle = sombraDoPelo;
    g.beginPath();
    g.ellipse(7, 0, 8, 3.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = pelo;
    g.beginPath();
    g.ellipse(7, -0.3, 7.2, 2.8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f2a7b5';
    g.beginPath();
    g.ellipse(7.5, -0.3, 4.6, 1.3, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.fillStyle = sombraDoPelo;
  g.beginPath();
  g.arc(-2, 0, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = pelo;
  g.beginPath();
  g.arc(-1.4, -0.4, 6.2, 0, Math.PI * 2);
  g.fill();
  // o focinho, na frente da cabeça
  g.fillStyle = '#f08a9c';
  g.beginPath();
  g.arc(4.2, 0, 1.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // tonto (perdeu a bola num roubo): estrelinhas em volta da cabeça
  if (j.tonto > 0) {
    g.fillStyle = '#ffe066';
    for (let k = 0; k < 3; k++) {
      const a = ms / 150 + (k * Math.PI * 2) / 3;
      g.fillRect(Math.round(j.x + Math.cos(a) * 10) - 1, Math.round(j.y - 4 + Math.sin(a) * 5) - 1, 3, 3);
    }
  }
  // a força do chute carregando
  if (j.carga > 0) {
    const k = Math.min(1, j.carga / 45);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(Math.round(j.x - 12), Math.round(j.y + 15), 24, 4);
    g.fillStyle = k < 0.5 ? '#ffe066' : k < 0.9 ? '#ffae42' : '#ff5a4f';
    g.fillRect(Math.round(j.x - 11), Math.round(j.y + 16), Math.round(22 * k), 2);
  }
}

export function desenharNome(g: CanvasRenderingContext2D, j: JogadorNaTela) {
  g.font = '9px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  const y = Math.round(j.y - 17);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillText(j.nome, Math.round(j.x) + 1, y + 1);
  g.fillStyle = j.eu ? '#ffe066' : '#ffffff';
  g.fillText(j.nome, Math.round(j.x), y);
}

/** A bola, girando pela distância andada (`giro`, do laço). */
export function desenharBola(g: CanvasRenderingContext2D, f: Folhas, x: number, y: number, giro: number) {
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath();
  g.ellipse(x + 2, y + 3, R_BOLA + 1, R_BOLA - 1, 0, 0, Math.PI * 2);
  g.fill();
  if (!f.bola.complete || !f.bola.naturalWidth) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x, y, R_BOLA, 0, Math.PI * 2);
    g.fill();
    return;
  }
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.rotate(giro);
  g.drawImage(f.bola, -R_BOLA - 1, -R_BOLA - 1, R_BOLA * 2 + 2, R_BOLA * 2 + 2);
  g.restore();
}
