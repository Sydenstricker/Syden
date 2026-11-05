import type { Comandos, Kart } from '../corrida/fisica';
import { naParede, type Arena, type ItemDoBalao } from './sim';

/**
 * OS COELHOS DO COMPUTADOR DO ESTOURA-BALÃO (05/11/2026): regras, não modelo de linguagem, como os robôs do resto do Solo
 * (server/src/minijogo-robos.ts). Sem item, vão à caixa mais perto; com item, atrás de quem está mais perto. Desviam das
 * paredes olhando à frente, dão ré quando empacam, e usam o item quando faz sentido: o repolho com o alvo na mira, a lama
 * com alguém atrás, a alface e a cenoura logo. Cada um tem o seu "jeito" (a mira mais ou menos cuidadosa), e eles veem só o
 * que uma pessoa no lugar deles veria.
 *
 * O mesmo cérebro é o PILOTO AUTOMÁTICO dos testes (window.balaoPilotoAutomatico, só no site de desenvolvimento).
 */

export interface MemoriaDoRobo {
  /** Quantos passos seguidos quase parado (para saber que empacou), e quantos de ré ainda faltam. */
  parado: number;
  re: number;
  /** De 0 a 1: o quanto o robô capricha na mira e demora para usar o item. */
  jeito: number;
  /** Há quantos passos está com o item na mão. */
  segurando: number;
}

export const novaMemoria = (jeito: number): MemoriaDoRobo => ({ parado: 0, re: 0, jeito, segurando: 0 });

export interface VisaoDoRobo {
  arena: Arena;
  item: ItemDoBalao | null;
  /** Os outros karts com balão (onde estão agora). */
  rivais: { x: number; y: number }[];
  /** As caixas que estão lá para este robô. */
  caixas: { x: number; y: number }[];
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
  const alvo = (v.item ? rival.alvo : caixa.alvo) ?? rival.alvo ?? caixa.alvo;
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
  const espera = 20 + Math.round(60 * m.jeito);
  if (v.item && m.segurando > espera) {
    if (v.item === 'alface' || v.item === 'cenoura') usa = v.item === 'alface' || rival.distancia > 140 || m.segurando > 300;
    else if (v.item === 'repolho' && rival.alvo) {
      const a = Math.atan2(rival.alvo.y - k.y, rival.alvo.x - k.x);
      usa = rival.distancia < 220 && Math.abs(diferenca(a, k.angulo)) < mira;
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
  return { acelera: !freia, freia, vira, derrapa: false, usa };
}
