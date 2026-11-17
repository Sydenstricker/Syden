/**
 * O DESENHO DAS LENDAS DA TOCA (16/11/2026): a luta de lado, numa tela de 320 × 180 ampliada com os pixels nítidos, como a
 * Briga na horta — e com as peças dela: o cenário de cada parada (briga/cenarios.ts), o coelho com as cores do avatar
 * (briga/desenho.ts) e os monstros da Quaternius (briga/sprites.ts). Os inimigos ficam à esquerda olhando para a direita, a
 * turma à direita olhando para a esquerda. O que é das Lendas é feito aqui por código: o objeto de cada classe na mão, os
 * números que sobem, os riscos do golpe, as faíscas, a cura, o sopro do dragão e a marca do alvo.
 *
 * O site não decide nada: ele toca, na ordem, os acontecimentos que o servidor mandou (`eventos`), um a cada EVENTO_MS.
 */
import { desenharCenario } from '../briga/cenarios';
import { CHAO, desenharCoelho, desenhoDoCoelho, H, W } from '../briga/desenho';
import { FASES_DA_BRIGA, type TipoDeInimigo } from '../briga/fases';
import type { Acao } from '../briga/regras';
import { alturaDoBicho, desenharBichoDaFolha } from '../briga/sprites';

export { W, H };
export const EVENTO_MS = 850;
export const ACAO_FOLGA_MS = 700;

export type Classe = 'escudo' | 'faisca' | 'erva' | 'flecha';
export type Ator = { h: number } | { i: number };
export interface Alvo {
  quem: Ator;
  dano?: number;
  cura?: number;
  ko?: boolean;
  volta?: boolean;
}
export interface Evento {
  id: number;
  tipo: 'ataque' | 'habilidade' | 'defender' | 'combo' | 'inimigo' | 'sopro' | 'preparar' | 'tonto';
  de: Ator;
  alvos: Alvo[];
  membros?: number[];
  protegido?: boolean;
}
export interface HeroiNaTela {
  userId: number;
  username: string;
  classe: Classe | null;
  hp: number;
  hpMax: number;
}
export interface InimigoNaTela {
  id: number;
  tipo: string;
  hp: number;
  hpMax: number;
  chefe: boolean;
  tonto: boolean;
  preparando: boolean;
}

/** Os lugares de cada um no chão (o pé). */
// (dois a dois, afastados: em fila, os quatro coelhos viravam um bolo só)
const LUGARES_DA_TURMA = [
  { x: 242, y: CHAO + 14 },
  { x: 290, y: CHAO + 20 },
  { x: 236, y: CHAO + 50 },
  { x: 284, y: CHAO + 56 },
];
export function lugarDoHeroi(k: number) {
  return LUGARES_DA_TURMA[k % 4];
}
export function lugarDoInimigo(i: InimigoNaTela, todos: InimigoNaTela[]) {
  const temChefe = todos.some((x) => x.chefe);
  if (i.chefe) return { x: 98, y: CHAO + 44 };
  if (temChefe) return i.id === 0 ? { x: 40, y: CHAO + 18 } : { x: 44, y: CHAO + 64 };
  return [
    { x: 58, y: CHAO + 14 },
    { x: 104, y: CHAO + 36 },
    { x: 52, y: CHAO + 60 },
  ][i.id % 3];
}
export const letraDoInimigo = (id: number) => String.fromCharCode(65 + id);

const igual = (a: Ator, b: Ator) => ('h' in a && 'h' in b && a.h === b.h) || ('i' in a && 'i' in b && a.i === b.i);

/**
 * A VIDA COMO ESTÁ NA TELA AGORA: o servidor manda a de depois da rodada; a tela mostra a de antes e desconta golpe a golpe,
 * conforme cada acontecimento é tocado.
 */
export function vidaNaTela(quem: Ator, final: number, max: number, eventos: Evento[], tocados: number): number {
  let hp = final;
  for (let k = eventos.length - 1; k >= tocados; k--) {
    for (const a of eventos[k].alvos) {
      if (!igual(a.quem, quem)) continue;
      hp = hp + (a.dano ?? 0) - (a.cura ?? 0);
    }
  }
  return Math.max(0, Math.min(max, Math.round(hp)));
}

// ---------------- O OBJETO DA CLASSE NA MÃO ----------------
function objetoDaClasse(g: CanvasRenderingContext2D, classe: Classe | null, sx: number, sy: number, tempo: number) {
  // a turma olha para a esquerda: a mão da frente fica à esquerda do corpo
  const x = sx - 14;
  const y = sy - 26;
  switch (classe) {
    case 'escudo':
      g.fillStyle = '#5a6a8a';
      g.fillRect(x - 3, y - 6, 8, 12);
      g.fillStyle = '#a8b8d8';
      g.fillRect(x - 2, y - 5, 6, 10);
      g.fillStyle = '#f0c93a';
      g.fillRect(x, y - 2, 2, 4);
      break;
    case 'faisca': {
      g.fillStyle = '#6a4a2a';
      g.fillRect(x, y - 8, 2, 14);
      const b = Math.floor(tempo / 160) % 2;
      g.fillStyle = b ? '#ffe48a' : '#f0a0ff';
      g.fillRect(x - 1, y - 11, 4, 4);
      g.fillStyle = '#fffbe8';
      g.fillRect(x, y - 10, 2, 2);
      break;
    }
    case 'erva':
      g.fillStyle = '#3f7f3a';
      g.fillRect(x + 1, y - 2, 1, 8);
      g.fillStyle = '#7bc86a';
      g.fillRect(x - 2, y - 6, 4, 4);
      g.fillRect(x + 2, y - 4, 3, 3);
      g.fillStyle = '#b8f0a0';
      g.fillRect(x - 1, y - 5, 2, 2);
      break;
    case 'flecha':
      g.fillStyle = '#8a5a2a';
      for (let k = -8; k <= 8; k++) g.fillRect(x - Math.round(3 - (k * k) / 22), y + k, 1, 1);
      g.fillStyle = '#e8e0d0';
      g.fillRect(x + 1, y - 7, 1, 15);
      break;
  }
}

// ---------------- OS EFEITOS ----------------
function numero(g: CanvasRenderingContext2D, texto: string, x: number, y: number, cor: string) {
  g.font = 'bold 9px sans-serif';
  g.textAlign = 'center';
  g.fillStyle = '#1e1822';
  g.fillText(texto, x + 1, y + 1);
  g.fillStyle = cor;
  g.fillText(texto, x, y);
}

function faiscas(g: CanvasRenderingContext2D, x: number, y: number, p: number, cores: string[]) {
  for (let k = 0; k < 10; k++) {
    const ang = k * 2.39996;
    const r = 4 + p * 18 * ((k % 3) + 1) / 3;
    g.fillStyle = cores[k % cores.length];
    g.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(y + Math.sin(ang) * r * 0.7), 2, 2);
  }
}

function risco(g: CanvasRenderingContext2D, x: number, y: number, p: number) {
  g.fillStyle = '#fffbe8';
  for (let k = 0; k < 9; k++) {
    const t = k / 8;
    if (t > p * 1.4) break;
    g.fillRect(Math.round(x - 9 + t * 18), Math.round(y - 12 + t * 16), 2, 2);
  }
}

function anelDeEscudo(g: CanvasRenderingContext2D, x: number, y: number, cor: string) {
  g.strokeStyle = cor;
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(x, y - 22, 15, 26, 0, 0, Math.PI * 2);
  g.stroke();
}

function estrelasDeTonto(g: CanvasRenderingContext2D, x: number, y: number, tempo: number) {
  for (let k = 0; k < 3; k++) {
    const a = tempo / 300 + (k * Math.PI * 2) / 3;
    g.fillStyle = '#ffe48a';
    g.fillRect(Math.round(x + Math.cos(a) * 9), Math.round(y + Math.sin(a) * 3), 2, 2);
  }
}

// ---------------- A CENA ----------------
export interface Cena {
  parada: string;
  herois: HeroiNaTela[];
  inimigos: InimigoNaTela[];
  eventos: Evento[];
  /** Desde quando a rodada está sendo tocada (ms do relógio da página); null = nada a tocar. */
  desde: number | null;
  /** O alvo que eu escolhi (o inimigo), ou o que estou escolhendo. */
  meuAlvo: number | null;
  mirando: boolean;
  eu: number;
}

/** Quantos acontecimentos já foram tocados até `agora`. */
export function tocadosAte(cena: Pick<Cena, 'eventos' | 'desde'>, agora: number) {
  if (cena.desde === null) return cena.eventos.length;
  return Math.max(0, Math.min(cena.eventos.length, Math.floor((agora - cena.desde - 250) / EVENTO_MS) + 1));
}

export function desenharCena(g: CanvasRenderingContext2D, cena: Cena, folhas: Map<number, CanvasImageSource | null>, agora: number) {
  const indice = Math.max(0, FASES_DA_BRIGA.findIndex((f) => f.id === cena.parada));
  desenharCenario(g, indice, 0, 1e6, agora);

  const tocados = tocadosAte(cena, agora);
  // o acontecimento de agora: o índice e o quanto dele já passou (0 a 1)
  const k = cena.desde === null ? -1 : Math.floor((agora - cena.desde - 250) / EVENTO_MS);
  const atual = k >= 0 && k < cena.eventos.length ? cena.eventos[k] : null;
  const p = atual && cena.desde !== null ? (agora - cena.desde - 250 - k * EVENTO_MS) / EVENTO_MS : 0;
  const ehAtor = (a: Ator) => !!atual && (igual(atual.de, a) || ('h' in a && !!atual.membros?.includes(a.h)));
  const alvoDe = (a: Ator) => atual?.alvos.find((x) => igual(x.quem, a));
  // o passo à frente de quem age, e o tranco de quem leva
  const passo = (a: Ator) => (ehAtor(a) ? Math.round(Math.sin(Math.min(1, p * 1.6) * Math.PI) * 14) : 0);
  const levou = (a: Ator) => {
    const al = alvoDe(a);
    return !!al && (al.dano ?? 0) > 0 && p > 0.35 && p < 0.8;
  };

  const coisas: { y: number; desenhar: () => void }[] = [];

  // OS INIMIGOS
  for (const i of cena.inimigos) {
    const quem = { i: i.id };
    const hp = vidaNaTela(quem, i.hp, i.hpMax, cena.eventos, tocados);
    const morreuAgora = hp <= 0 && alvoDe(quem)?.ko && p < 0.9;
    if (hp <= 0 && !morreuAgora) continue;
    const l = lugarDoInimigo(i, cena.inimigos);
    const sx = l.x + passo(quem);
    coisas.push({
      y: l.y,
      desenhar: () => {
        const agindo = ehAtor(quem) && p < 0.6;
        const estado = morreuAgora ? 'morto' : levou(quem) ? 'dor' : agindo ? 'atacando' : i.preparando ? 'preparando' : 'esperando';
        // a sombra no chão
        g.fillStyle = 'rgba(20, 14, 26, 0.35)';
        g.fillRect(sx - (i.chefe ? 20 : 10), l.y - 1, i.chefe ? 40 : 20, 3);
        desenharBichoDaFolha(g, { tipo: i.tipo as TipoDeInimigo, estado, lado: 1, ms: agindo ? p * EVENTO_MS : 0, piscando: levou(quem) && Math.floor(agora / 60) % 2 === 0 }, sx, l.y, agora);
        const alto = alturaDoBicho(i.tipo as TipoDeInimigo);
        // a barra de vida e a letra
        const w = i.chefe ? 40 : 22;
        const topo = l.y - alto - 8;
        g.fillStyle = '#1e1822';
        g.fillRect(sx - w / 2 - 1, topo - 1, w + 2, 4);
        g.fillStyle = '#e5564c';
        g.fillRect(sx - w / 2, topo, Math.round((w * hp) / i.hpMax), 2);
        g.font = 'bold 8px sans-serif';
        g.textAlign = 'center';
        g.fillStyle = '#1e1822';
        g.fillText(letraDoInimigo(i.id), sx - w / 2 - 6, topo + 4);
        g.fillStyle = '#fbf3e4';
        g.fillText(letraDoInimigo(i.id), sx - w / 2 - 7, topo + 3);
        if (i.tonto) estrelasDeTonto(g, sx, topo - 6, agora);
        // o fôlego do dragão: o "!" que avisa o sopro da próxima rodada
        if (i.preparando && Math.floor(agora / 250) % 2 === 0) numero(g, '!', sx + 14, topo - 4, '#ff9a3a');
        // a marca do alvo (o que eu escolhi, ou todos enquanto escolho)
        if (cena.meuAlvo === i.id || cena.mirando) {
          const y = topo - 8 + (Math.floor(agora / 200) % 2);
          g.fillStyle = cena.meuAlvo === i.id ? '#ffe48a' : 'rgba(255, 228, 138, 0.55)';
          g.fillRect(sx - 3, y - 3, 7, 2);
          g.fillRect(sx - 2, y - 1, 5, 1);
          g.fillRect(sx - 1, y, 3, 1);
        }
      },
    });
  }

  // A TURMA
  cena.herois.forEach((h, n) => {
    const quem = { h: h.userId };
    const hp = vidaNaTela(quem, h.hp, h.hpMax, cena.eventos, tocados);
    const l = lugarDoHeroi(n);
    const sx = l.x - passo(quem);
    coisas.push({
      y: l.y,
      desenhar: () => {
        const agindo = ehAtor(quem) && p < 0.7;
        let acao: Acao = 'parado';
        let t = agora % 4000;
        if (hp <= 0) {
          acao = 'caido';
          t = 400;
        } else if (levou(quem)) {
          acao = 'dor';
          t = (p - 0.35) * EVENTO_MS;
        } else if (agindo) {
          const magia = atual!.tipo === 'habilidade' && (h.classe === 'faisca' || h.classe === 'erva');
          acao = magia ? 'especial' : 'soco3';
          t = p * EVENTO_MS;
        }
        g.fillStyle = 'rgba(20, 14, 26, 0.35)';
        g.fillRect(sx - 10, l.y - 1, 20, 3);
        // sem o nome em cima (os quatro nomes se atropelavam): o nome mora na lista da turma, com a classe; aqui, o objeto
        // da classe na mão e a seta em cima do meu
        desenharCoelho(g, folhas.get(h.userId) ?? null, sx, l.y, -1, desenhoDoCoelho(acao, t, false), {});
        if (hp > 0) objetoDaClasse(g, h.classe, sx, l.y, agora);
        g.fillStyle = '#1e1822';
        g.fillRect(sx - 11, l.y - 56, 22, 4);
        g.fillStyle = hp / h.hpMax < 0.3 ? '#e5564c' : '#7bc86a';
        g.fillRect(sx - 10, l.y - 55, Math.round((20 * hp) / h.hpMax), 2);
        if (h.userId === cena.eu) {
          const y = l.y - 63 + (Math.floor(agora / 300) % 2);
          g.fillStyle = '#ffe48a';
          g.fillRect(sx - 3, y, 7, 2);
          g.fillRect(sx - 2, y + 2, 5, 1);
          g.fillRect(sx - 1, y + 3, 3, 1);
        }
      },
    });
  });

  coisas.sort((a, b) => a.y - b.y);
  for (const c of coisas) c.desenhar();

  // O EFEITO do acontecimento de agora, por cima de todos
  if (atual) desenharEfeito(g, atual, p, cena, agora);
}

function posicaoDe(a: Ator, cena: Cena) {
  if ('h' in a) {
    const n = cena.herois.findIndex((h) => h.userId === a.h);
    const l = lugarDoHeroi(Math.max(0, n));
    return { x: l.x, y: l.y - 24 };
  }
  const i = cena.inimigos.find((x) => x.id === a.i);
  if (!i) return { x: 60, y: 120 };
  const l = lugarDoInimigo(i, cena.inimigos);
  return { x: l.x, y: l.y - Math.min(40, alturaDoBicho(i.tipo as TipoDeInimigo) / 2) };
}

function desenharEfeito(g: CanvasRenderingContext2D, e: Evento, p: number, cena: Cena, agora: number) {
  const de = posicaoDe(e.de, cena);
  const classe = 'h' in e.de ? cena.herois.find((h) => h.userId === (e.de as { h: number }).h)?.classe : null;
  if (e.tipo === 'defender') {
    anelDeEscudo(g, de.x, de.y + 24, '#8ab8e0');
  } else if (e.tipo === 'habilidade' && classe === 'escudo') {
    // proteger: a cúpula azul que cobre o Escudo
    anelDeEscudo(g, de.x, de.y + 24, '#f0c93a');
    anelDeEscudo(g, de.x, de.y + 24, Math.floor(agora / 120) % 2 ? '#8ab8e0' : '#f0c93a');
  } else if (e.tipo === 'preparar') {
    g.fillStyle = `rgba(255, 154, 58, ${0.25 + 0.2 * Math.sin(p * Math.PI * 4)})`;
    g.beginPath();
    g.arc(de.x + 10, de.y, 24, 0, Math.PI * 2);
    g.fill();
  } else if (e.tipo === 'sopro') {
    // a onda de fogo que atravessa a turma
    const x = 110 + p * 220;
    for (let k = 0; k < 14; k++) {
      g.fillStyle = k % 3 === 0 ? '#ffd060' : k % 3 === 1 ? '#ff9a3a' : '#d0501c';
      g.fillRect(Math.round(x - k * 6), CHAO + 2 + ((k * 13) % 64), 8, 6);
    }
  } else if (e.tipo === 'tonto') {
    estrelasDeTonto(g, de.x, de.y - 10, agora);
  } else if (e.tipo === 'combo') {
    // o clarão do golpe junto: as cores de cada classe da turma que entrou
    const alvo = e.alvos[0] ? posicaoDe(e.alvos[0].quem, cena) : de;
    const cores = (e.membros ?? []).map((id) => COR_DA_CLASSE[cena.herois.find((h) => h.userId === id)?.classe ?? 'escudo']);
    if (p > 0.2) faiscas(g, alvo.x, alvo.y, Math.min(1, (p - 0.2) * 2), cores.length ? cores : ['#ffe48a']);
    if (p > 0.25 && p < 0.55) {
      g.fillStyle = 'rgba(255, 251, 232, 0.35)';
      g.fillRect(0, 0, W, H);
    }
  } else if (e.tipo === 'habilidade' && classe === 'flecha') {
    const alvo = e.alvos[0] ? posicaoDe(e.alvos[0].quem, cena) : de;
    const t = Math.min(1, p * 2.5);
    const x = de.x + (alvo.x - de.x) * t;
    const y = de.y + (alvo.y - de.y) * t;
    g.fillStyle = '#e8e0d0';
    g.fillRect(Math.round(x), Math.round(y), 8, 1);
    g.fillStyle = '#ffe48a';
    g.fillRect(Math.round(x), Math.round(y) - 1, 2, 3);
  }
  // em cada alvo: o golpe, a faísca, a cura e o número
  for (const a of e.alvos) {
    const o = posicaoDe(a.quem, cena);
    if ((a.dano ?? 0) > 0 && p > 0.3) {
      if (e.tipo === 'habilidade' && classe === 'faisca') faiscas(g, o.x, o.y, Math.min(1, (p - 0.3) * 2), ['#ffe48a', '#f0a0ff', '#fffbe8']);
      else if (e.tipo !== 'sopro' && e.tipo !== 'combo') risco(g, o.x, o.y, (p - 0.3) * 2);
      numero(g, String(a.dano), o.x, o.y - 18 - Math.round(p * 10), '#fbf3e4');
    }
    if ((a.cura ?? 0) > 0 && p > 0.3) {
      g.fillStyle = '#7bc86a';
      for (let k = 0; k < 4; k++) {
        const y = o.y + 10 - ((p * 30 + k * 8) % 30);
        g.fillRect(o.x - 8 + k * 5, Math.round(y), 1, 3);
        g.fillRect(o.x - 9 + k * 5, Math.round(y) + 1, 3, 1);
      }
      numero(g, `+${a.cura}`, o.x, o.y - 18 - Math.round(p * 10), '#b8f0a0');
    }
  }
}

export const COR_DA_CLASSE: Record<Classe, string> = { escudo: '#8ab8e0', faisca: '#f0a0ff', erva: '#7bc86a', flecha: '#f0c93a' };

/** Qual inimigo está debaixo do ponto (na tela de 320 × 180)? */
export function inimigoEm(x: number, y: number, inimigos: InimigoNaTela[]): number | null {
  let melhor: number | null = null;
  let d = Infinity;
  for (const i of inimigos) {
    if (i.hp <= 0) continue;
    const l = lugarDoInimigo(i, inimigos);
    const alto = alturaDoBicho(i.tipo as TipoDeInimigo);
    const meio = l.y - alto / 2;
    const dist = Math.abs(x - l.x) + Math.abs(y - meio) * 0.6;
    if (dist < d && dist < (i.chefe ? 60 : 32)) {
      d = dist;
      melhor = i.id;
    }
  }
  return melhor;
}
