/**
 * A GINCANA DA TOCA (06/11/2026, pedido dele: "um minigame para chegar ao final do mapa, com esses assets que já temos"): a
 * corrida de obstáculos em 3D, SÓ A MECÂNICA do gênero (nada de nome, personagem ou arte de jogo existente). O coelho corre,
 * pula e se equilibra por um percurso de plataformas até a bandeira; caiu do mapa (ou levou serra, ou espinho), volta à última
 * bandeira. As peças são do Platformer Pack da KayKit (Kay Lousberg, CC0); a regra é toda daqui.
 *
 * UM ARQUIVO SÓ, EM DOIS LUGARES: server/src/gincana-sim.ts e web/src/gincana/sim.ts são o MESMO texto, byte a byte
 * (web/test/gincana.test.ts confere). Mexeu num, copie no outro.
 *
 * Por que um arquivo só: o servidor não confia no tempo que o site diz. No fim do percurso o site manda os COMANDOS de cada
 * passo (em trechos: "tantos passos com tais teclas"), e o servidor REFAZ o percurso inteiro com este código; o tempo, as
 * bandeiras e as quedas são os dele. Os mesmos comandos são o FANTASMA: refeitos aqui, o coelho do amigo cai nos mesmos lugares.
 *
 * DETERMINISMO: dentro da simulação, só + − × ÷ e raiz (o IEEE 754 obriga o mesmo resultado em qualquer navegador). O giro dos
 * varredores sai de uma TABELA montada por multiplicação (o seno e o cosseno de meio grau são literais), e nunca de Math.sin.
 * Tudo o que se mexe (plataformas, serras, varredores, balas, espinhos) é função do NÚMERO DO PASSO: todos veem igual. Só os
 * blocos que caem dependem de quem pisou, e por isso são de cada um (cada coelho tem a sua cópia deles).
 *
 * O MUNDO: o percurso corre no +z; x é o lado (a DIREITA de quem joga é o −x, porque a câmera fica atrás olhando o +z); y é a
 * altura. O coelho é uma caixa de RAIO × ALTURA. As plataformas são caixas alinhadas aos eixos e as rampas sobem no +z.
 */

export const PASSO = 1 / 60;
/** Um percurso não passa de 10 minutos. */
export const PASSOS_MAXIMOS = 10 * 60 * 60;

// os comandos de um passo, em bits
export const FRENTE = 1;
export const TRAS = 2;
export const ESQUERDA = 4;
export const DIREITA = 8;
export const PULO = 16;
export const COMANDO_MAXIMO = 31;

export const RAIO = 0.3;
export const ALTURA = 0.95;
/** A corrida (unidades por segundo; uma plataforma pequena tem 2). */
export const VELOCIDADE = 6.2;
const ACEL_CHAO = 0.25;
const ACEL_AR = 0.08;
const GRAVIDADE = 32;
/** O pulo: ~2 de altura segurando; soltar subindo corta pela metade. */
export const IMPULSO = 11.5;
const CORTE = 0.5;
const QUEDA_MAXIMA = 26;
/** A folga da beirada (o coelho ainda pula logo depois de sair dela) e o pulo guardado (apertado um tico antes de pousar). */
const COIOTE = 6;
const GUARDA = 7;
/** O degrau que se sobe andando. */
const DEGRAU = 0.4;
/** Abaixo disto, caiu do mapa. */
export const FUNDO = -14;
/** A mola: ~4,8 de altura. */
export const MOLA = 17.5;
/** O empurrão dos varredores e das balas. */
const EMPURRAO = 9;
const DIAGONAL = 0.7071067811865476;
/** Depois de voltar à bandeira, o coelho pisca (só desenho: já dá para correr). */
export const PISCA_PASSOS = 60;
/** O bloco vermelho treme isto depois de pisado, cai, e volta depois de VOLTA_DO_BLOCO. */
export const TREME_PASSOS = 36;
export const VOLTA_DO_BLOCO = 240;
/** Quanto tempo o coelho fica sem levar outro empurrão. */
const GOLPE_PASSOS = 24;
export const RAIO_DA_BALA = 0.7;
/** O braço do varredor: a grossura e a altura dele, acima do chão. */
const GROSSURA_DO_BRACO = 0.35;
const ALTURA_DO_BRACO = 1.4;

/**
 * A CONFERÊNCIA DAS POSIÇÕES AO VIVO (na sala): o mais rápido que um coelho anda, somando tudo o que o leva (a corrida, a
 * esteira, a plataforma que anda, o empurrão, a queda e a mola), com folga. Não é o que um coelho anda: é o que nenhum passa.
 */
export const VMAX_H = 30;
export const VMAX_V = 32;

// =====================================================================================================================
// AS PEÇAS
// =====================================================================================================================

/** O movimento de vaivém: o deslocamento vai de 0 a (ax, ay, az) e volta, suave nas pontas, num `periodo` em passos. */
export interface Mov {
  ax: number;
  ay: number;
  az: number;
  periodo: number;
  fase: number;
}

export type TipoDeCaixa = 'firme' | 'esteira' | 'cai' | 'mola' | 'espinhos' | 'posto' | 'chegada';

export interface Caixa {
  i: number;
  tipo: TipoDeCaixa;
  // a caixa no passo em que o movimento está no 0
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  mov: Mov | null;
  /** A esteira: o quanto ela leva (unidades por segundo). */
  ex: number;
  ez: number;
  /** Os espinhos: o ciclo (em passos), a fase e quantos passos dele ficam de fora. */
  ciclo: number;
  faseDoCiclo: number;
  aberto: number;
  /** O bloco que cai: o índice dele no estado do coelho. */
  k: number;
  /** DESENHO: o modelo da KayKit e o giro (em quartos de volta). */
  modelo: string;
  giro: number;
}

export interface Rampa {
  i: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** A altura em z0 e em z1. */
  yBaixo: number;
  yAlto: number;
  modelo: string;
}

/** A serra: um disco deitado na altura `y`, que anda de vaivém. */
export interface Serra {
  cx: number;
  cz: number;
  y: number;
  raio: number;
  mov: Mov;
}

/** O varredor: os braços giram em volta de (cx, cz), na altura do chão `y`. */
export interface Varredor {
  cx: number;
  cz: number;
  y: number;
  braco: number;
  /** Quantos meios graus por passo (720 é a volta), com o sinal do sentido. */
  giro: number;
  fase: number;
  bracos: 2 | 4;
  modelo: string;
}

/** O canhão: atira balas que rolam no x, de (x, y, z), a `vx`, por `alcance`, uma a cada `periodo`. */
export interface Canhao {
  x: number;
  y: number;
  z: number;
  vx: number;
  alcance: number;
  periodo: number;
  fase: number;
}

/** A bandeira (o posto de controle): passou da linha z pisando no chão, volta-se a ela; o coelho reaparece em (x, y, zVolta). */
export interface Posto {
  z: number;
  x: number;
  y: number;
  zVolta: number;
}

export interface Percurso {
  id: string;
  caixas: Caixa[];
  rampas: Rampa[];
  serras: Serra[];
  varredores: Varredor[];
  canhoes: Canhao[];
  /** O posto 0 é a largada. */
  postos: Posto[];
  /** A linha de chegada. */
  chegada: { z: number; y: number };
  /** Quantos blocos que caem. */
  blocos: number;
  /** O comprimento (da largada à chegada), para o "quanto andou". */
  comprimento: number;
  /** DESENHO: os enfeites (bandeiras, arcos, a placa de chegada, os canhões, as molas), sem efeito na regra. */
  enfeites: { modelo: string; x: number; y: number; z: number; giro: number; escala?: number }[];
  /** As caixas e as rampas por fatia de z (FATIA), para não olhar o percurso inteiro a cada passo. */
  fatias: number[][];
  fatiasDasRampas: number[][];
}

const FATIA = 4;

/** O vaivém no passo `n`, de 0 a 1 e de volta (suave nas pontas: 3t² − 2t³). */
export function onda(m: Mov, n: number): number {
  const u = ((n + m.fase) % m.periodo) / m.periodo;
  const t = u < 0.5 ? u * 2 : 2 - u * 2;
  return t * t * (3 - 2 * t);
}

/** O deslocamento (dx, dy, dz) de quem se move, no passo `n`. */
export function deslocamento(m: Mov | null, n: number): { dx: number; dy: number; dz: number } {
  if (!m) return { dx: 0, dy: 0, dz: 0 };
  const s = onda(m, n);
  return { dx: m.ax * s, dy: m.ay * s, dz: m.az * s };
}

/** Os espinhos estão para fora no passo `n`. */
export function espinhosFora(c: Caixa, n: number): boolean {
  return (n + c.faseDoCiclo) % c.ciclo < c.aberto;
}

// O GIRO SEM SENO: a tabela de 720 meios graus, por multiplicação a partir do primeiro (os dois literais).
const COS_MEIO_GRAU = 0.9999619230641713;
const SEN_MEIO_GRAU = 0.008726535498373935;
export const VOLTA_INTEIRA = 720;
const GIRO_COS: number[] = [];
const GIRO_SEN: number[] = [];
{
  let c = 1, s = 0;
  for (let k = 0; k < VOLTA_INTEIRA; k++) {
    GIRO_COS.push(c);
    GIRO_SEN.push(s);
    const c2 = c * COS_MEIO_GRAU - s * SEN_MEIO_GRAU;
    s = s * COS_MEIO_GRAU + c * SEN_MEIO_GRAU;
    c = c2;
  }
}

/** O índice do giro do varredor no passo `n` (0 a 719). */
export function indiceDoGiro(v: Varredor, n: number): number {
  const k = (v.fase + n * v.giro) % VOLTA_INTEIRA;
  return k < 0 ? k + VOLTA_INTEIRA : k;
}

/** A direção do primeiro braço do varredor no passo `n`. */
export function bracoEm(v: Varredor, n: number): { dx: number; dz: number } {
  const k = indiceDoGiro(v, n);
  return { dx: GIRO_COS[k], dz: GIRO_SEN[k] };
}

/** As balas no ar de um canhão no passo `n`: o x de cada uma. */
export function balasEm(c: Canhao, n: number): number[] {
  const t = n + c.fase;
  const voo = Math.floor((c.alcance * 60) / Math.abs(c.vx));
  const xs: number[] = [];
  for (let q = Math.floor(t / c.periodo); q >= 0; q--) {
    const idade = t - q * c.periodo;
    if (idade > voo) break;
    xs.push(c.x + (c.vx * idade) / 60);
  }
  return xs;
}

// =====================================================================================================================
// OS PERCURSOS, POR ROTEIRO
// =====================================================================================================================

/**
 * O roteiro de um percurso: trechos, um atrás do outro no +z. `larg` muda a largura dali em diante (4 ou 6), `nivel` a altura.
 */
export type Trecho =
  | { t: 'largada' }
  | { t: 'chao'; comp: number }
  | { t: 'vao'; comp: number }
  | { t: 'nivel'; dy: number }
  | { t: 'larg'; w: 4 | 6 }
  | { t: 'pedras'; xs: number[]; vao: number }
  | { t: 'sobe' }
  | { t: 'esteira'; pecas: number; v: number }
  | { t: 'serras'; comp: number; zs: number[]; periodo: number }
  | { t: 'varredor'; bracos: 2 | 4; giro: number }
  | { t: 'caem'; linhas: number }
  | { t: 'andamX'; n: number; periodo: number }
  | { t: 'andamZ'; vao: number; periodo: number }
  | { t: 'espinhos'; n: number }
  | { t: 'canhoes'; comp: number; zs: number[]; periodo: number }
  | { t: 'mola'; sobe: number }
  | { t: 'posto' }
  | { t: 'chegada' };

export function montar(id: string, roteiro: Trecho[]): Percurso {
  const p: Percurso = {
    id,
    caixas: [],
    rampas: [],
    serras: [],
    varredores: [],
    canhoes: [],
    postos: [],
    chegada: { z: 0, y: 0 },
    blocos: 0,
    comprimento: 0,
    enfeites: [],
    fatias: [],
    fatiasDasRampas: [],
  };
  let z = 0;
  let topo = 0;
  let w = 6;
  const caixa = (c: Partial<Caixa> & Pick<Caixa, 'x0' | 'x1' | 'y0' | 'y1' | 'z0' | 'z1' | 'modelo'>): Caixa => {
    const nova: Caixa = { i: p.caixas.length, tipo: 'firme', mov: null, ex: 0, ez: 0, ciclo: 1, faseDoCiclo: 0, aberto: 0, k: -1, giro: 0, ...c };
    p.caixas.push(nova);
    return nova;
  };
  /** O chão de largura w, de z a z + comp, em peças de 6 × 6 (ou 4 × 4) e de 2 de comprimento. */
  const chao = (comp: number, cor = 'blue', tipo: TipoDeCaixa = 'firme') => {
    let feito = 0;
    while (feito < comp) {
      const grande = comp - feito >= w ? w : 2;
      const modelo = grande === 2 ? `platform_${w}x2x1_${cor}` : `platform_${w}x${w}x1_${cor}`;
      caixa({ tipo, x0: -w / 2, x1: w / 2, y0: topo - 1, y1: topo, z0: z + feito, z1: z + feito + grande, modelo });
      feito += grande;
    }
    z += comp;
  };
  /** Os pés de um enfeite (o arco, a placa, o mastro da bandeira): sólidos, para o coelho não atravessar. */
  const poste = (x: number, z: number, meia: number, alto: number) =>
    caixa({ x0: x - meia, x1: x + meia, y0: topo, y1: topo + alto, z0: z - meia, z1: z + meia, modelo: '' });
  for (const tr of roteiro) {
    switch (tr.t) {
      case 'largada':
        chao(6, 'green');
        p.postos.push({ z: 0, x: 0, y: topo, zVolta: 2 });
        p.enfeites.push({ modelo: 'arch_wide_green', x: 0, y: topo, z: 4.6, giro: 0 });
        poste(-2.55, 4.6, 0.3, 3.4);
        poste(2.55, 4.6, 0.3, 3.4);
        break;
      case 'chao':
        chao(tr.comp);
        break;
      case 'vao':
        z += tr.comp;
        break;
      case 'nivel':
        topo += tr.dy;
        break;
      case 'larg':
        w = tr.w;
        break;
      case 'pedras':
        for (const x of tr.xs) {
          z += tr.vao;
          caixa({ x0: x - 1, x1: x + 1, y0: topo - 1, y1: topo, z0: z, z1: z + 2, modelo: 'platform_2x2x1_blue' });
          z += 2;
        }
        z += tr.vao;
        break;
      case 'sobe': {
        const r: Rampa = { i: p.rampas.length, x0: -w / 2, x1: w / 2, z0: z, z1: z + 6, yBaixo: topo, yAlto: topo + 4, modelo: `platform_slope_${w}x6x4_blue` };
        p.rampas.push(r);
        z += 6;
        topo += 4;
        break;
      }
      case 'esteira':
        for (let k = 0; k < tr.pecas; k++) {
          caixa({ tipo: 'esteira', x0: -2, x1: 2, y0: topo - 1, y1: topo, z0: z, z1: z + 8, ez: -tr.v, modelo: 'conveyor_4x8x1_blue' });
          z += 8;
        }
        break;
      case 'serras': {
        const z0 = z;
        chao(tr.comp);
        tr.zs.forEach((dz, k) => {
          const folga = w / 2 - 0.8;
          p.serras.push({ cx: -folga, cz: z0 + dz, y: topo + 0.15, raio: 1.0, mov: { ax: folga * 2, ay: 0, az: 0, periodo: tr.periodo, fase: Math.floor((tr.periodo * k) / 2) } });
        });
        break;
      }
      case 'varredor': {
        const z0 = z;
        caixa({ x0: -3, x1: 3, y0: topo - 1, y1: topo, z0, z1: z0 + 6, modelo: 'platform_6x6x1_blue' });
        p.varredores.push({ cx: 0, cz: z0 + 3, y: topo, braco: 2.75, giro: tr.giro, fase: 0, bracos: tr.bracos, modelo: tr.bracos === 4 ? 'swiper_quad_blue' : 'swiper_double_blue' });
        z += 6;
        break;
      }
      case 'caem':
        for (let l = 0; l < tr.linhas; l++) {
          for (let c = 0; c < w / 2; c++) {
            caixa({ tipo: 'cai', k: p.blocos++, x0: -w / 2 + c * 2, x1: -w / 2 + c * 2 + 2, y0: topo - 1, y1: topo, z0: z, z1: z + 2, modelo: 'platform_2x2x1_red' });
          }
          z += 2;
        }
        break;
      case 'andamX':
        for (let k = 0; k < tr.n; k++) {
          z += 1.5;
          caixa({
            x0: -5,
            x1: -1,
            y0: topo - 1,
            y1: topo,
            z0: z,
            z1: z + 4,
            mov: { ax: 6, ay: 0, az: 0, periodo: tr.periodo, fase: Math.floor((tr.periodo * k) / 3) },
            modelo: 'platform_4x4x1_yellow',
          });
          z += 4;
        }
        z += 1.5;
        break;
      case 'andamZ':
        caixa({ x0: -2, x1: 2, y0: topo - 1, y1: topo, z0: z, z1: z + 4, mov: { ax: 0, ay: 0, az: tr.vao - 4, periodo: tr.periodo, fase: 0 }, modelo: 'platform_4x4x1_yellow' });
        z += tr.vao;
        break;
      case 'espinhos':
        for (let k = 0; k < tr.n; k++) {
          caixa({ tipo: 'espinhos', x0: -2, x1: 2, y0: topo - 1, y1: topo, z0: z, z1: z + 4, ciclo: 150, faseDoCiclo: (600 - k * 40) % 150, aberto: 60, modelo: 'floor_spikes_trap_4x4x1_blue' });
          z += 4;
        }
        break;
      case 'canhoes': {
        const z0 = z;
        chao(tr.comp);
        tr.zs.forEach((dz, k) => {
          const lado = k % 2 === 0 ? 1 : -1;
          const borda = w / 2 + 1;
          p.canhoes.push({ x: lado * borda, y: topo + 0.7, z: z0 + dz, vx: -lado * 7, alcance: borda * 2, periodo: tr.periodo, fase: Math.floor((tr.periodo * k) / 3) });
          p.enfeites.push(
            { modelo: 'platform_2x2x1_blue', x: lado * (borda + 1.2), y: topo - 1.8, z: z0 + dz, giro: 0 },
            { modelo: 'cannon_base_blue', x: lado * (borda + 1.2), y: topo - 0.8, z: z0 + dz, giro: lado > 0 ? 3 : 1, escala: 0.6 },
          );
        });
        break;
      }
      case 'mola': {
        chao(4);
        caixa({ tipo: 'mola', x0: -0.75, x1: 0.75, y0: topo, y1: topo + 0.3, z0: z - 2.75, z1: z - 1.25, modelo: '' });
        p.enfeites.push({ modelo: 'spring_pad_yellow', x: 0, y: topo - 0.6, z: z - 2, giro: 0 });
        topo += tr.sobe;
        // a parede: a peça alta, de 4 de altura, que não se sobe pulando
        caixa({ x0: -w / 2, x1: w / 2, y0: topo - 4, y1: topo, z0: z, z1: z + 6, modelo: `platform_${w}x6x4_blue` });
        z += 6;
        break;
      }
      case 'posto': {
        const z0 = z;
        chao(6, 'green', 'posto');
        p.postos.push({ z: z0 + 0.5, x: 0, y: topo, zVolta: z0 + 3 });
        p.enfeites.push({ modelo: 'flag_A_green', x: w / 2 - 0.4, y: topo, z: z0 + 0.6, giro: 0 }, { modelo: 'flag_A_green', x: -w / 2 + 0.4, y: topo, z: z0 + 0.6, giro: 0 });
        poste(w / 2 - 0.4, z0 + 0.6, 0.15, 2);
        poste(-w / 2 + 0.4, z0 + 0.6, 0.15, 2);
        break;
      }
      case 'chegada': {
        const z0 = z;
        chao(6, 'green', 'chegada');
        p.chegada = { z: z0 + 1, y: topo };
        p.enfeites.push({ modelo: 'signage_finish', x: 0, y: topo, z: z0 + 1, giro: 0 });
        poste(-2.55, z0 + 1, 0.2, 4);
        poste(2.55, z0 + 1, 0.2, 4);
        break;
      }
    }
  }
  p.comprimento = p.chegada.z;
  // as fatias: cada caixa entra em todas as fatias que ela pode tocar, com o movimento inteiro
  const nFatias = Math.floor(z / FATIA) + 2;
  for (let f = 0; f < nFatias; f++) {
    p.fatias.push([]);
    p.fatiasDasRampas.push([]);
  }
  for (const c of p.caixas) {
    const az = c.mov ? c.mov.az : 0;
    const a = Math.max(0, Math.floor((Math.min(c.z0, c.z0 + az) - 1) / FATIA));
    const b = Math.min(nFatias - 1, Math.floor((Math.max(c.z1, c.z1 + az) + 1) / FATIA));
    for (let f = a; f <= b; f++) p.fatias[f].push(c.i);
  }
  for (const r of p.rampas) {
    const a = Math.max(0, Math.floor((r.z0 - 1) / FATIA));
    const b = Math.min(nFatias - 1, Math.floor((r.z1 + 1) / FATIA));
    for (let f = a; f <= b; f++) p.fatiasDasRampas[f].push(r.i);
  }
  return p;
}

/**
 * OS TRÊS PERCURSOS (curtos, de ~40 s a ~80 s). Percurso novo é id novo: mudar um traçado não mistura fantasmas nem recordes.
 */
export const ROTEIROS: Record<string, Trecho[]> = {
  // 1 — o de aprender: pedras, a rampa, um varredor, a esteira, as plataformas que andam de lado e as serras
  'prado-1': [
    { t: 'largada' },
    { t: 'chao', comp: 6 },
    { t: 'pedras', xs: [-1.5, 1.5, -1, 1.5], vao: 1.5 },
    { t: 'chao', comp: 4 },
    { t: 'sobe' },
    { t: 'chao', comp: 4 },
    { t: 'varredor', bracos: 2, giro: 3 },
    { t: 'chao', comp: 4 },
    { t: 'posto' },
    { t: 'larg', w: 4 },
    { t: 'esteira', pecas: 2, v: 2.5 },
    { t: 'larg', w: 6 },
    { t: 'chao', comp: 4 },
    { t: 'andamX', n: 3, periodo: 220 },
    { t: 'chao', comp: 4 },
    { t: 'serras', comp: 12, zs: [4, 8], periodo: 160 },
    { t: 'chao', comp: 4 },
    { t: 'posto' },
    { t: 'caem', linhas: 4 },
    { t: 'chao', comp: 4 },
    { t: 'varredor', bracos: 2, giro: -3 },
    { t: 'chao', comp: 2 },
    { t: 'pedras', xs: [0, 1.5, -1.5, 0], vao: 1.6 },
    { t: 'chao', comp: 4 },
    { t: 'chegada' },
  ],
  // 2 — os blocos que caem, os espinhos, os canhões, a mola, a plataforma que vai e volta e dois varredores
  'ponte-2': [
    { t: 'largada' },
    { t: 'chao', comp: 4 },
    { t: 'caem', linhas: 5 },
    { t: 'chao', comp: 4 },
    { t: 'larg', w: 4 },
    { t: 'espinhos', n: 3 },
    { t: 'larg', w: 6 },
    { t: 'chao', comp: 4 },
    { t: 'posto' },
    { t: 'canhoes', comp: 14, zs: [3, 7, 11], periodo: 110 },
    { t: 'chao', comp: 2 },
    { t: 'mola', sobe: 3 },
    { t: 'chao', comp: 4 },
    { t: 'andamZ', vao: 12, periodo: 300 },
    { t: 'chao', comp: 4 },
    { t: 'serras', comp: 10, zs: [3, 7], periodo: 140 },
    { t: 'chao', comp: 2 },
    { t: 'andamX', n: 2, periodo: 200 },
    { t: 'chao', comp: 4 },
    { t: 'posto' },
    { t: 'varredor', bracos: 4, giro: 3 },
    { t: 'chao', comp: 2 },
    { t: 'varredor', bracos: 2, giro: -4 },
    { t: 'chao', comp: 4 },
    { t: 'pedras', xs: [1.5, -1.5, 1.5, -1.5, 0], vao: 1.8 },
    { t: 'chao', comp: 4 },
    { t: 'chegada' },
  ],
  // 3 — o comprido: tudo um pouco mais apertado, três bandeiras no caminho
  'torre-3': [
    { t: 'largada' },
    { t: 'chao', comp: 4 },
    { t: 'pedras', xs: [0, -2, 0, 2, 0], vao: 2 },
    { t: 'chao', comp: 4 },
    { t: 'serras', comp: 14, zs: [3, 7, 11], periodo: 130 },
    { t: 'chao', comp: 2 },
    { t: 'sobe' },
    { t: 'chao', comp: 4 },
    { t: 'posto' },
    { t: 'andamX', n: 4, periodo: 180 },
    { t: 'chao', comp: 4 },
    { t: 'caem', linhas: 4 },
    { t: 'larg', w: 4 },
    { t: 'esteira', pecas: 2, v: 3 },
    { t: 'larg', w: 6 },
    { t: 'chao', comp: 4 },
    { t: 'posto' },
    { t: 'varredor', bracos: 4, giro: 4 },
    { t: 'chao', comp: 2 },
    { t: 'canhoes', comp: 10, zs: [3, 7], periodo: 90 },
    { t: 'chao', comp: 2 },
    { t: 'mola', sobe: 3 },
    { t: 'chao', comp: 4 },
    { t: 'larg', w: 4 },
    { t: 'espinhos', n: 4 },
    { t: 'larg', w: 6 },
    { t: 'chao', comp: 4 },
    { t: 'posto' },
    { t: 'andamZ', vao: 14, periodo: 280 },
    { t: 'chao', comp: 4 },
    { t: 'varredor', bracos: 2, giro: -5 },
    { t: 'chao', comp: 2 },
    { t: 'varredor', bracos: 2, giro: 5 },
    { t: 'chao', comp: 4 },
    { t: 'sobe' },
    { t: 'chao', comp: 2 },
    { t: 'pedras', xs: [-2, 0, 2, 0, -2, 0], vao: 2 },
    { t: 'chao', comp: 4 },
    { t: 'chegada' },
  ],
};

export const PERCURSOS: Record<string, Percurso> = Object.fromEntries(Object.entries(ROTEIROS).map(([id, r]) => [id, montar(id, r)]));
export const IDS_DOS_PERCURSOS = Object.keys(ROTEIROS);

// =====================================================================================================================
// O COELHO
// =====================================================================================================================

export interface Coelho {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** O empurrão (varredor, bala), que some aos poucos. */
  kx: number;
  kz: number;
  noChao: boolean;
  /** A caixa em que está pisando (−1: nenhuma; −2 − i: a rampa i). */
  sobre: number;
  coiote: number;
  guarda: number;
  /** O pulo estava apertado no passo anterior (o pulo sai na hora de apertar, não segurando). */
  pulouAntes: boolean;
  segurando: boolean;
  golpe: number;
  passo: number;
  /** A última bandeira alcançada (0 é a largada). */
  posto: number;
  quedas: number;
  pisca: number;
  chegou: boolean;
  chegouEm: number;
  /** Os blocos que caem: o passo em que cada um foi pisado (−1: inteiro). */
  cai: number[];
}

export type Evento = null | 'pulo' | 'queda' | 'machucou' | 'empurrao' | 'mola' | 'posto' | 'chegou';

export function novoCoelho(p: Percurso): Coelho {
  const l = p.postos[0];
  return {
    x: l.x,
    y: l.y,
    z: l.zVolta,
    vx: 0,
    vy: 0,
    vz: 0,
    kx: 0,
    kz: 0,
    noChao: true,
    sobre: -1,
    coiote: 0,
    guarda: 0,
    pulouAntes: false,
    segurando: false,
    golpe: 0,
    passo: 0,
    posto: 0,
    quedas: 0,
    pisca: 0,
    chegou: false,
    chegouEm: 0,
    cai: new Array(p.blocos).fill(-1),
  };
}

export function copiarCoelho(c: Coelho): Coelho {
  return { ...c, cai: c.cai.slice() };
}

/** O bloco que caiu não segura ninguém (enquanto não volta). */
export function caixaAtiva(c: Coelho, b: Caixa, n: number): boolean {
  if (b.tipo !== 'cai') return true;
  const t = c.cai[b.k];
  return t < 0 || n - t < TREME_PASSOS;
}

function fatiaDe(p: Percurso, z: number): number {
  const f = Math.floor(z / FATIA);
  return f < 0 ? 0 : f >= p.fatias.length ? p.fatias.length - 1 : f;
}

function alturaDaRampa(r: Rampa, z: number): number {
  const u = z <= r.z0 ? 0 : z >= r.z1 ? 1 : (z - r.z0) / (r.z1 - r.z0);
  return r.yBaixo + (r.yAlto - r.yBaixo) * u;
}

function voltarAoPosto(c: Coelho, p: Percurso) {
  const v = p.postos[c.posto];
  c.x = v.x;
  c.y = v.y + 0.01;
  c.z = v.zVolta;
  c.vx = c.vy = c.vz = c.kx = c.kz = 0;
  c.noChao = false;
  c.sobre = -1;
  c.coiote = c.guarda = 0;
  c.segurando = false;
  c.golpe = 0;
  c.quedas++;
  c.pisca = PISCA_PASSOS;
}

/** Um passo de 1/60 s com os comandos `e` (os bits FRENTE, TRAS, ESQUERDA, DIREITA, PULO). */
export function passo(c: Coelho, e: number, p: Percurso): Evento {
  if (c.chegou) return null;
  const n = c.passo;
  const m = n + 1;
  c.passo = m;
  if (c.pisca > 0) c.pisca--;
  if (c.golpe > 0) c.golpe--;
  let ev: Evento = null;

  // os blocos que caíram voltam
  for (let k = 0; k < c.cai.length; k++) if (c.cai[k] >= 0 && m - c.cai[k] >= TREME_PASSOS + VOLTA_DO_BLOCO) c.cai[k] = -1;

  // 1. o chão leva: a plataforma que anda e a esteira
  if (c.noChao && c.sobre >= 0) {
    const b = p.caixas[c.sobre];
    if (b.mov) {
      const a = deslocamento(b.mov, n), d = deslocamento(b.mov, m);
      c.x += d.dx - a.dx;
      c.y += d.dy - a.dy;
      c.z += d.dz - a.dz;
    }
    if (b.tipo === 'esteira') {
      c.x += b.ex * PASSO;
      c.z += b.ez * PASSO;
    }
  }

  // 2. os comandos
  let dx = (e & ESQUERDA ? 1 : 0) - (e & DIREITA ? 1 : 0);
  let dz = (e & FRENTE ? 1 : 0) - (e & TRAS ? 1 : 0);
  if (dx !== 0 && dz !== 0) {
    dx *= DIAGONAL;
    dz *= DIAGONAL;
  }
  const acel = c.noChao ? ACEL_CHAO : ACEL_AR;
  c.vx += (dx * VELOCIDADE - c.vx) * acel;
  c.vz += (dz * VELOCIDADE - c.vz) * acel;
  const freio = c.noChao ? 0.85 : 0.97;
  c.kx *= freio;
  c.kz *= freio;
  if (c.kx < 0.05 && c.kx > -0.05) c.kx = 0;
  if (c.kz < 0.05 && c.kz > -0.05) c.kz = 0;

  // 3. o pulo: na hora de apertar (guardado um tico), com a folga da beirada; soltar subindo corta
  const aperta = (e & PULO) !== 0;
  if (aperta && !c.pulouAntes) c.guarda = GUARDA;
  c.pulouAntes = aperta;
  if (c.noChao) c.coiote = COIOTE;
  else if (c.coiote > 0) c.coiote--;
  if (c.guarda > 0) {
    c.guarda--;
    if (c.coiote > 0) {
      c.vy = IMPULSO;
      c.noChao = false;
      c.sobre = -1;
      c.coiote = 0;
      c.guarda = 0;
      c.segurando = true;
      ev = 'pulo';
    }
  }
  if (c.segurando && !aperta && c.vy > 0) {
    c.vy *= CORTE;
    c.segurando = false;
  }
  if (c.vy <= 0) c.segurando = false;
  c.vy -= GRAVIDADE * PASSO;
  if (c.vy < -QUEDA_MAXIMA) c.vy = -QUEDA_MAXIMA;

  // 4. andar: x e depois z, batendo nas paredes (o que está acima do pé mais que um degrau)
  const f = fatiaDe(p, c.z);
  const perto = p.fatias[f];
  const rampas = p.fatiasDasRampas[f];
  const mexe = (eixo: 0 | 1, delta: number) => {
    if (eixo === 0) c.x += delta;
    else c.z += delta;
    for (const i of perto) {
      const b = p.caixas[i];
      if (!caixaAtiva(c, b, m)) continue;
      const d = deslocamento(b.mov, m);
      const x0 = b.x0 + d.dx, x1 = b.x1 + d.dx, z0 = b.z0 + d.dz, z1 = b.z1 + d.dz;
      const y0 = b.y0 + d.dy, y1 = b.y1 + d.dy;
      if (c.x + RAIO <= x0 || c.x - RAIO >= x1 || c.z + RAIO <= z0 || c.z - RAIO >= z1) continue;
      if (c.y >= y1 - DEGRAU || c.y + ALTURA <= y0) continue;
      if (eixo === 0) {
        c.x = delta > 0 ? x0 - RAIO : delta < 0 ? x1 + RAIO : c.x < (x0 + x1) / 2 ? x0 - RAIO : x1 + RAIO;
        c.vx = 0;
        c.kx = 0;
      } else {
        c.z = delta > 0 ? z0 - RAIO : delta < 0 ? z1 + RAIO : c.z < (z0 + z1) / 2 ? z0 - RAIO : z1 + RAIO;
        c.vz = 0;
        c.kz = 0;
      }
    }
    for (const i of rampas) {
      const r = p.rampas[i];
      if (c.x + RAIO <= r.x0 || c.x - RAIO >= r.x1 || c.z + RAIO <= r.z0 || c.z - RAIO >= r.z1) continue;
      const topo = alturaDaRampa(r, c.z);
      if (c.y >= topo - DEGRAU || c.y + ALTURA <= r.yBaixo - 1) continue;
      if (eixo === 0) {
        c.x = delta > 0 ? r.x0 - RAIO : r.x1 + RAIO;
        c.vx = 0;
        c.kx = 0;
      } else if (delta < 0) {
        // de costas para a parede alta da rampa
        c.z = r.z1 + RAIO;
        c.vz = 0;
        c.kz = 0;
      }
    }
  };
  mexe(0, (c.vx + c.kx) * PASSO);
  mexe(1, (c.vz + c.kz) * PASSO);

  // 5. cair e pousar
  const yAntes = c.y;
  const naRampaAntes = c.noChao && c.sobre <= -2;
  c.y += c.vy * PASSO;
  c.noChao = false;
  c.sobre = -1;
  const f2 = fatiaDe(p, c.z);
  let chao = -Infinity;
  let sobre = -1;
  for (const i of p.fatias[f2]) {
    const b = p.caixas[i];
    if (!caixaAtiva(c, b, m)) continue;
    const d = deslocamento(b.mov, m);
    if (c.x + RAIO <= b.x0 + d.dx || c.x - RAIO >= b.x1 + d.dx || c.z + RAIO <= b.z0 + d.dz || c.z - RAIO >= b.z1 + d.dz) continue;
    const y0 = b.y0 + d.dy, y1 = b.y1 + d.dy;
    if (c.vy <= 0 && yAntes >= y1 - DEGRAU && c.y <= y1) {
      if (y1 > chao) {
        chao = y1;
        sobre = i;
      }
    } else if (c.vy > 0 && yAntes + ALTURA <= y0 + 0.01 && c.y + ALTURA > y0) {
      c.y = y0 - ALTURA;
      c.vy = 0;
    }
  }
  for (const i of p.fatiasDasRampas[f2]) {
    const r = p.rampas[i];
    if (c.x < r.x0 || c.x > r.x1 || c.z < r.z0 || c.z > r.z1) continue;
    const topo = alturaDaRampa(r, c.z);
    // descendo a rampa andando, o pé acompanha (sem virar uma escada de quedinhas)
    const gruda = naRampaAntes && c.y >= topo - 0.5;
    if (c.vy <= 0 && (yAntes >= topo - DEGRAU || gruda) && c.y <= topo + (gruda ? 0.3 : 0)) {
      if (topo > chao) {
        chao = topo;
        sobre = -2 - i;
      }
    }
  }
  if (sobre !== -1) {
    c.y = chao;
    c.vy = 0;
    c.noChao = true;
    c.sobre = sobre;
  }

  // 6. o que o chão faz
  if (c.noChao && c.sobre >= 0) {
    const b = p.caixas[c.sobre];
    if (b.tipo === 'cai' && c.cai[b.k] < 0) c.cai[b.k] = m;
    else if (b.tipo === 'mola') {
      c.vy = MOLA;
      c.noChao = false;
      c.sobre = -1;
      c.coiote = 0;
      c.segurando = false;
      ev = 'mola';
    } else if (b.tipo === 'espinhos' && espinhosFora(b, m)) {
      voltarAoPosto(c, p);
      return 'machucou';
    }
  }

  // 7. as serras, os varredores e as balas
  for (const s of p.serras) {
    if (s.cz - c.z > 3 || c.z - s.cz > 3) continue;
    const d = deslocamento(s.mov, m);
    const ox = c.x - (s.cx + d.dx), oz = c.z - (s.cz + d.dz);
    const r = s.raio + RAIO;
    if (ox * ox + oz * oz < r * r && c.y < s.y + 0.3 && c.y + ALTURA > s.y - 0.1) {
      voltarAoPosto(c, p);
      return 'machucou';
    }
  }
  if (c.golpe === 0) {
    for (const v of p.varredores) {
      if (v.cz - c.z > 4 || c.z - v.cz > 4) continue;
      if (c.y >= v.y + ALTURA_DO_BRACO || c.y + ALTURA <= v.y) continue;
      const u = bracoEm(v, m);
      const dirs = v.bracos === 4 ? [u.dx, u.dz, -u.dx, -u.dz, -u.dz, u.dx, u.dz, -u.dx] : [u.dx, u.dz, -u.dx, -u.dz];
      for (let j = 0; j < dirs.length; j += 2) {
        const ax = dirs[j], az = dirs[j + 1];
        const ox = c.x - v.cx, oz = c.z - v.cz;
        let t = ox * ax + oz * az;
        if (t < 0) t = 0;
        if (t > v.braco) t = v.braco;
        const px = ox - ax * t, pz = oz - az * t;
        const r = RAIO + GROSSURA_DO_BRACO;
        if (px * px + pz * pz < r * r) {
          // para o lado em que o braço gira, e um tico para fora
          const sentido = v.giro > 0 ? 1 : -1;
          c.kx = -az * sentido * EMPURRAO + ax * 2;
          c.kz = ax * sentido * EMPURRAO + az * 2;
          c.vx = c.vz = 0;
          if (c.vy < 5) c.vy = 5;
          c.noChao = false;
          c.sobre = -1;
          c.golpe = GOLPE_PASSOS;
          ev = 'empurrao';
          break;
        }
      }
      if (c.golpe > 0) break;
    }
  }
  if (c.golpe === 0) {
    for (const k of p.canhoes) {
      if (k.z - c.z > 2 || c.z - k.z > 2) continue;
      const by = k.y;
      if (by < c.y - RAIO_DA_BALA || by > c.y + ALTURA + RAIO_DA_BALA) continue;
      const oz = c.z - k.z;
      const r = RAIO_DA_BALA + RAIO;
      for (const bx of balasEm(k, m)) {
        const ox = c.x - bx;
        if (ox * ox + oz * oz < r * r) {
          c.kx = (k.vx > 0 ? 1 : -1) * EMPURRAO * 1.1;
          c.kz = 0;
          c.vx = 0;
          if (c.vy < 6) c.vy = 6;
          c.noChao = false;
          c.sobre = -1;
          c.golpe = GOLPE_PASSOS;
          ev = 'empurrao';
          break;
        }
      }
      if (c.golpe > 0) break;
    }
  }

  // 8. caiu do mapa
  if (c.y < FUNDO) {
    voltarAoPosto(c, p);
    return 'queda';
  }

  // 9. as bandeiras e a chegada (pisando)
  if (c.noChao) {
    for (let k = c.posto + 1; k < p.postos.length; k++) {
      if (c.z >= p.postos[k].z) {
        c.posto = k;
        ev = 'posto';
      }
    }
  }
  if (c.z >= p.chegada.z && c.y >= p.chegada.y - 0.5) {
    c.chegou = true;
    c.chegouEm = m;
    return 'chegou';
  }
  return ev;
}

// =====================================================================================================================
// OS COMANDOS GRAVADOS (o que vai ao servidor, e o fantasma)
// =====================================================================================================================

/** Os comandos em trechos: [passos, comandos, passos, comandos, …]. */
export type Entradas = number[];

/** Confere a forma das entradas (inteiros, comandos de 0 a 31, o total dentro do máximo). */
export function entradasValidas(e: unknown): e is Entradas {
  if (!Array.isArray(e) || e.length === 0 || e.length % 2 !== 0 || e.length > 40000) return false;
  let total = 0;
  for (let i = 0; i < e.length; i += 2) {
    const n = e[i], g = e[i + 1];
    if (!Number.isInteger(n) || n < 1 || !Number.isInteger(g) || g < 0 || g > COMANDO_MAXIMO) return false;
    total += n;
    if (total > PASSOS_MAXIMOS) return false;
  }
  return true;
}

/** Refaz um percurso inteiro pelas entradas. O coelho do fim diz se chegou, em que passo, e quantas vezes caiu. */
export function refazer(p: Percurso, e: Entradas): Coelho {
  const c = novoCoelho(p);
  for (let i = 0; i < e.length && !c.chegou; i += 2) {
    for (let k = 0; k < e[i] && !c.chegou; k++) passo(c, e[i + 1], p);
  }
  return c;
}

/** Quem grava as entradas: junta os passos iguais seguidos. */
export function gravador() {
  const e: Entradas = [];
  return {
    entradas: e,
    anotar(g: number) {
      const n = e.length;
      if (n && e[n - 1] === g) e[n - 2]++;
      else e.push(1, g);
    },
  };
}

/** Os comandos de um passo, lidos das entradas (o fantasma). */
export function leitor(e: Entradas) {
  let i = 0, usados = 0;
  return () => {
    while (i < e.length && usados >= e[i]) {
      i += 2;
      usados = 0;
    }
    if (i >= e.length) return 0;
    usados++;
    return e[i + 1];
  };
}

/**
 * A CONFERÊNCIA DE UMA POSIÇÃO AO VIVO (na sala), contra a anterior: dentro do percurso, sem andar mais que VMAX_H/VMAX_V
 * permitem, ou então de volta a uma bandeira já alcançada (a queda é um salto). Devolve a bandeira que a posição mostra
 * alcançada (o maior posto cuja linha ficou para trás), ou −1 se a posição não vale.
 */
export function posicaoPossivel(
  p: Percurso,
  antes: { n: number; x: number; y: number; z: number; posto: number },
  agora: { n: number; x: number; y: number; z: number },
): number {
  const { x, y, z } = agora;
  if (![x, y, z].every(Number.isFinite)) return -1;
  if (x < -40 || x > 40 || y < FUNDO - 2 || y > 60 || z < -10 || z > p.comprimento + 20) return -1;
  const dn = agora.n - antes.n;
  if (dn < 1) return -1;
  const alcance = (dn * VMAX_H) / 60 + 0.6;
  const h = alcance * alcance;
  const ox = x - antes.x, oz = z - antes.z, oy = y - antes.y;
  const anda = ox * ox + oz * oz <= h && Math.abs(oy) <= (dn * VMAX_V) / 60 + 0.6;
  let posto = antes.posto;
  if (!anda) {
    // a volta a uma bandeira já alcançada
    let voltou = -1;
    for (let k = 0; k <= antes.posto; k++) {
      const v = p.postos[k];
      const vx = x - v.x, vz = z - v.zVolta;
      if (vx * vx + vz * vz < 4 && Math.abs(y - v.y) < 3) voltou = k;
    }
    if (voltou < 0) return -1;
  }
  for (let k = posto + 1; k < p.postos.length; k++) if (z >= p.postos[k].z) posto = k;
  return posto;
}
