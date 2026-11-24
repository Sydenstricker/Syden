import type { Comandos, Kart } from '../corrida/fisica';
import { naParede, type Arena, type ItemDoBalao } from './sim';

/**
 * OS COELHOS DO COMPUTADOR DO ESTOURA-BALÃO (05/11/2026): regras, não modelo de linguagem, como os robôs do resto do Solo
 * (server/src/minijogo-robos.ts). Sem item, vão à caixa mais perto; com item, atrás de quem está mais perto. Desviam das
 * paredes olhando à frente, dão ré quando empacam, e usam o item quando faz sentido: o repolho com o alvo na mira, a lama
 * com alguém atrás, a alface logo, e a cenoura para BATER (com alguém perto e na frente: o turbo estoura o balão de quem é
 * alcançado). Cada um tem o seu "jeito" (a mira mais ou menos cuidadosa), e eles veem só o
 * que uma pessoa no lugar deles veria.
 *
 * O mesmo cérebro é o PILOTO AUTOMÁTICO dos testes (window.balaoPilotoAutomatico, só no site de desenvolvimento).
 */

/**
 * A DIFICULDADE DOS COELHOS DO COMPUTADOR (20/11/2026, a segunda auditoria), só no Solo e só no site:
 * - fácil: a mira solta (o jeito de 0 a 0,35), REAGE a cada 20 passos (1/3 s: entre uma decisão e outra, repete a anterior) e
 *   não passa de 95 de velocidade (o kart vai a 140), e espera o dobro para usar o item;
 * - médio: o de antes (o jeito sorteado de 0 a 0,9, reação a cada passo, sem teto) — a sala e os testes de antes usam este;
 * - difícil: a mira caprichada (o jeito de 0,7 a 1), reação a cada passo, o item usado com 30% da espera, e o repolho e a cenoura arriscados de 1,6× mais longe.
 */
export type DificuldadeDoBalao = 'facil' | 'medio' | 'dificil';
export const DIFICULDADES_DO_BALAO: DificuldadeDoBalao[] = ['facil', 'medio', 'dificil'];
const NIVEL: Record<DificuldadeDoBalao, { jeito: [number, number]; reacao: number; vmax: number; pressa: number; alcance: number }> = {
  facil: { jeito: [0, 0.35], reacao: 20, vmax: 95, pressa: 2, alcance: 1 },
  medio: { jeito: [0, 1], reacao: 1, vmax: Infinity, pressa: 1, alcance: 1 },
  dificil: { jeito: [0.7, 1], reacao: 1, vmax: Infinity, pressa: 0.3, alcance: 1.6 },
};

export interface MemoriaDoRobo {
  /** Quantos passos seguidos quase parado (para saber que empacou), e quantos de ré ainda faltam. */
  parado: number;
  re: number;
  /** De 0 a 1: o quanto o robô capricha na mira e demora para usar o item. */
  jeito: number;
  /** Há quantos passos está com o item na mão. */
  segurando: number;
  /** De quantos em quantos passos decide de novo (1 = todo passo), quantos faltam, e a última decisão. */
  reacao: number;
  falta: number;
  ultimo: Comandos | null;
  /** A velocidade que ele não passa, e o quanto da espera do item ele espera (1 = toda). */
  vmax: number;
  pressa: number;
  /** O quanto mais longe ele arrisca o repolho e a cenoura (1 = o de antes). */
  alcance: number;
}

/** `jeito` de 0 a 1 (o sorteio de cada robô); a dificuldade o leva à faixa dela. O médio é o robô de antes, igual. */
export const novaMemoria = (jeito: number, dificuldade: DificuldadeDoBalao = 'medio'): MemoriaDoRobo => {
  const nv = NIVEL[dificuldade];
  return {
    parado: 0,
    re: 0,
    jeito: nv.jeito[0] + (nv.jeito[1] - nv.jeito[0]) * jeito,
    segurando: 0,
    reacao: nv.reacao,
    falta: 0,
    ultimo: null,
    vmax: nv.vmax,
    pressa: nv.pressa,
    alcance: nv.alcance,
  };
};

export interface VisaoDoRobo {
  arena: Arena;
  item: ItemDoBalao | null;
  /** Os outros karts com balão (onde estão agora). */
  rivais: { x: number; y: number }[];
  /** As caixas que estão lá para este robô. */
  caixas: { x: number; y: number }[];
  /** O MODO CENOURA DOURADA (24/11/2026): para onde ir buscá-la (no chão, ou quem a segura); null: nada a buscar. */
  dourada?: { x: number; y: number } | null;
  /** Está com a cenoura: foge dos outros, juntando itens. */
  fugindo?: boolean;
}

const diferenca = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

/** O caminho à frente, no ângulo `a`, está livre por `ate` unidades? */
function livreAFrente(arena: Arena, k: Kart, a: number, ate: number) {
  for (let d = 8; d <= ate; d += 8) {
    if (naParede(arena, k.x + Math.cos(a) * d, k.y + Math.sin(a) * d, -7)) return false;
  }
  return true;
}

export function comandoDoRobo(k: Kart, v: VisaoDoRobo, m: MemoriaDoRobo): Comandos {
  // A REAÇÃO: entre uma decisão e outra, repete a anterior (sem usar o item de novo)
  if (m.reacao > 1 && m.ultimo && m.falta > 0) {
    m.falta--;
    if (v.item) m.segurando++;
    return { ...m.ultimo, usa: false };
  }
  const c = decidir(k, v, m);
  m.ultimo = c;
  m.falta = m.reacao - 1;
  return c;
}

function decidir(k: Kart, v: VisaoDoRobo, m: MemoriaDoRobo): Comandos {
  // EMPACOU (encostado numa parede, ou atrás de um obstáculo): ré virando, por um tempo
  if (m.re > 0) {
    m.re--;
    return { acelera: false, freia: true, vira: m.jeito > 0.5 ? 1 : -1, derrapa: false, usa: false };
  }
  if (Math.abs(k.v) < 12 && k.rodando === 0) m.parado++;
  else m.parado = 0;
  if (m.parado > 50) {
    m.parado = 0;
    m.re = 40;
  }
  if (v.item) m.segurando++;
  else m.segurando = 0;

  const maisPerto = (lista: { x: number; y: number }[]) => {
    let melhor: { x: number; y: number } | null = null, md = Infinity;
    for (const p of lista) {
      const d = Math.hypot(p.x - k.x, p.y - k.y);
      if (d < md) {
        md = d;
        melhor = p;
      }
    }
    return { alvo: melhor, distancia: md };
  };
  const rival = maisPerto(v.rivais);
  const caixa = maisPerto(v.caixas);
  let alvo = (v.item ? rival.alvo : caixa.alvo) ?? rival.alvo ?? caixa.alvo;
  if (v.dourada) alvo = v.dourada;
  else if (v.fugindo) {
    // com a cenoura: a caixa mais longe do rival mais perto (andar sem parar, e longe de quem vem tomar)
    let melhor: { x: number; y: number } | null = null, md = -1;
    for (const c of v.caixas.length ? v.caixas : v.arena.caixas.map(([x, y]) => ({ x, y }))) {
      const d = rival.alvo ? Math.hypot(c.x - rival.alvo.x, c.y - rival.alvo.y) : 0;
      if (d > md && Math.hypot(c.x - k.x, c.y - k.y) > 30) {
        md = d;
        melhor = c;
      }
    }
    alvo = melhor ?? alvo;
  }
  let quer = k.angulo;
  if (alvo) quer = Math.atan2(alvo.y - k.y, alvo.x - k.x);

  // DESVIAR: se a parede está logo à frente no rumo que quer, tenta os lados, primeiro o do alvo
  let rumo = quer;
  if (!livreAFrente(v.arena, k, quer, 36)) {
    const lado = diferenca(quer, k.angulo) >= 0 ? 1 : -1;
    for (const tentativa of [0.5, 1, 1.5, 2.2]) {
      if (livreAFrente(v.arena, k, quer + lado * tentativa, 36)) {
        rumo = quer + lado * tentativa;
        break;
      }
      if (livreAFrente(v.arena, k, quer - lado * tentativa, 36)) {
        rumo = quer - lado * tentativa;
        break;
      }
    }
  }
  const dif = diferenca(rumo, k.angulo);
  const vira = Math.abs(dif) < 0.06 ? 0 : Math.sign(dif);

  // O ITEM
  let usa = false;
  const mira = 0.1 + 0.25 * (1 - m.jeito);
  const espera = Math.round((20 + Math.round(60 * m.jeito)) * m.pressa);
  if (v.item && m.segurando > espera) {
    if (v.item === 'alface') usa = true;
    else if (v.item === 'cenoura' && rival.alvo) {
      // a cenoura é para BATER (o turbo estoura o balão de quem é alcançado): com alguém perto e na frente
      const a = Math.atan2(rival.alvo.y - k.y, rival.alvo.x - k.x);
      usa = (rival.distancia < 110 * m.alcance && Math.abs(diferenca(a, k.angulo)) < mira * 2) || m.segurando > 300;
    } else if (v.item === 'cenoura') usa = m.segurando > 300;
    else if (v.item === 'repolho' && rival.alvo) {
      const a = Math.atan2(rival.alvo.y - k.y, rival.alvo.x - k.x);
      usa = rival.distancia < 220 * m.alcance && Math.abs(diferenca(a, k.angulo)) < mira;
    } else if (v.item === 'lama') {
      // alguém atrás e perto: a lama fica no caminho
      usa = v.rivais.some((r) => {
        const dx = r.x - k.x, dy = r.y - k.y;
        return Math.hypot(dx, dy) < 90 && dx * Math.cos(k.angulo) + dy * Math.sin(k.angulo) < 0;
      }) || m.segurando > 480;
    }
    if (usa) m.segurando = 0;
  }
  // devagar nas curvas fechadas, para não bater
  const freia = Math.abs(dif) > 1.6 && k.v > 60;
  return { acelera: !freia && k.v < m.vmax, freia, vira, derrapa: false, usa };
}
