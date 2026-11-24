import { ehChefe, CHEFE_T, LIM_X, LIM_Y, RAIO, RAIO_NAVE, VEL_NAVE, passoDoAnel, posicaoInimigo, posicaoItem, zNave, BIFURCA, SUBCHEFE_T } from './sim';
import { posicaoTiro, type Comandos, type Mundo } from './mundo';

/**
 * O PILOTO AUTOMÁTICO da Rota Estelar (só para os testes e para o site de desenvolvimento: `window.estelarPilotoAutomatico`).
 * Como o da Esquadrilha: para cada uma das 9 direções, a nave seguindo nela pelos próximos passos, e onde estarão os tiros, os
 * inimigos e os obstáculos. Fica com a que mais demora a encostar em algo e que mais o leva para o alvo (o anel, o item, ou o
 * inimigo à frente para alinhar o tiro). Gira quando um tiro vai pegar, e solta a bomba quando está encurralado ou no chefe.
 */
const OLHAR = 30;
const DIRS: [number, number][] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export function pilotar(m: Mundo): Comandos {
  const f = m.ficha;
  const n0 = m.passo + 1;
  const ini = m.r.inimigos;
  // o alvo: o anel que vem, o item que dá para pegar, senão o inimigo de pé mais perto à frente
  let alvo: { x: number; y: number } | null = null;
  // na bifurcação, alterna o lado pela semente (para os testes passarem pelas duas rotas)
  if (n0 > BIFURCA - 300 && n0 <= BIFURCA) alvo = { x: m.semente % 2 ? -6 : 6, y: 0 };
  for (const [k, a] of m.r.aneis.entries()) {
    const q = passoDoAnel(a);
    if (!alvo && q > n0 && q - n0 < 140 && !f.aneis.has(k) && m.doRamo(a.ramo)) alvo = { x: a.x, y: a.y };
  }
  for (const [i, q] of m.soltos) {
    const p = posicaoItem(ini[i], q, n0);
    if (!alvo && p && p.z - zNave(n0) > 4) alvo = { x: p.x, y: p.y };
  }
  if (!alvo) {
    let melhor = Infinity;
    for (const i of m.ativos) {
      if (!m.dePe(i, n0)) continue;
      const p = posicaoInimigo(ini[i], n0 + 10);
      if (!p) continue;
      const dz = p.z - zNave(n0 + 10);
      if (dz < 10 || dz > 120) continue;
      const nota = dz + (ehChefe(ini[i].tipo) ? -200 : 0);
      if (nota < melhor) {
        melhor = nota;
        alvo = { x: Math.max(-LIM_X, Math.min(LIM_X, p.x)), y: Math.max(-LIM_Y, Math.min(LIM_Y, p.y)) };
      }
    }
  }
  const objetivo = alvo ?? { x: 0, y: 0 };
  let escolha: { dx: number; dy: number; nota: number; livre: number } | null = null;
  for (const [dx, dy] of DIRS) {
    const k = dx && dy ? Math.SQRT1_2 : 1;
    let x = m.nave.x;
    let y = m.nave.y;
    let livre = OLHAR + 1;
    for (let s = 1; s <= OLHAR && livre > OLHAR; s++) {
      x = Math.max(-LIM_X, Math.min(LIM_X, x + dx * VEL_NAVE * k));
      y = Math.max(-LIM_Y, Math.min(LIM_Y, y + dy * VEL_NAVE * k));
      const n = m.passo + s;
      const zn = zNave(n);
      for (const t of m.tiros) {
        const p = posicaoTiro(t, n);
        const a = posicaoTiro(t, n - 1);
        const r = RAIO_NAVE + 1.4;
        if (a.z - zNave(n - 1) >= -r && p.z - zn <= r && (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) <= r * r) {
          livre = s;
          break;
        }
      }
      if (livre <= OLHAR) break;
      for (const i of m.ativos) {
        if (f.mortos.has(i) || !f.doMeuRamo(ini[i].ramo)) continue;
        const p = posicaoInimigo(ini[i], n);
        const r = RAIO_NAVE + RAIO[ini[i].tipo] + 1.2;
        if (p && (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) + (p.z - zn) * (p.z - zn) <= r * r) {
          livre = s;
          break;
        }
      }
      if (livre <= OLHAR) break;
      for (const ob of m.r.obstaculos) {
        if (Math.abs(ob.z - zn) > ob.fundo + 1 || !f.doMeuRamo(ob.ramo)) continue;
        if (Math.abs(x - ob.x) <= ob.raio + RAIO_NAVE + 0.8 && y >= ob.y0 - RAIO_NAVE - 0.8 && y <= ob.y1 + RAIO_NAVE + 0.8) {
          livre = s;
          break;
        }
      }
    }
    const x8 = Math.max(-LIM_X, Math.min(LIM_X, m.nave.x + dx * VEL_NAVE * k * 8));
    const y8 = Math.max(-LIM_Y, Math.min(LIM_Y, m.nave.y + dy * VEL_NAVE * k * 8));
    const nota = Math.min(livre, OLHAR + 1) * 100 - Math.abs(x8 - objetivo.x) * 2 - Math.abs(y8 - objetivo.y) * 2;
    if (!escolha || nota > escolha.nota) escolha = { dx, dy, nota, livre };
  }
  const e = escolha!;
  const pronta = n0 >= m.piruetaPronta;
  const pirueta = e.livre <= 6 && pronta && n0 >= f.invulAte;
  const encurralada = e.livre <= 3 && !pronta && n0 >= f.invulAte;
  const noChefe = (n0 > CHEFE_T + 300 && n0 % 600 === 0) || (n0 > SUBCHEFE_T + 300 && n0 < SUBCHEFE_T + 900 && n0 % 300 === 0);
  return { dx: e.dx, dy: e.dy, fogo: n0 % 6 !== 5, bomba: f.bombas > 0 && (encurralada || noChefe), pirueta };
}
