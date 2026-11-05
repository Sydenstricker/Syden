import { ALTURA, LARGURA, RAIO, RAIO_NAVE, RAIO_TIRO, VEL_NAVE, posicaoInimigo, posicaoItem, posicaoTiro } from './sim';
import type { Comandos, Mundo } from './mundo';

/**
 * O PILOTO AUTOMÁTICO da Esquadrilha (só para os testes e para a página de desenvolvimento: `window.navePilotoAutomatico`).
 * O roteiro é determinístico, então ele OLHA À FRENTE de verdade: para cada uma das 9 direções, a nave seguindo nela pelos
 * próximos passos, e onde estarão os tiros e os inimigos. Fica com a que mais demora a encostar em algo e que mais o leva para
 * baixo do alvo (o item que está caindo, ou o inimigo mais perto). Sem saída, solta a bomba.
 */
const OLHAR = 28;
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
  // o alvo: o item mais perto que dá para pegar, senão o inimigo de pé mais baixo na tela
  let alvoX = LARGURA / 2;
  let alvoY = ALTURA - 40;
  let melhor = -Infinity;
  for (const [i, q] of m.soltos) {
    const p = posicaoItem(m.inimigos[i], q, n0 + 20);
    if (p && p.y < ALTURA - 20 && 1000 - p.y > melhor) {
      melhor = 1000 - p.y;
      alvoX = p.x;
      alvoY = Math.max(ALTURA - 90, Math.min(ALTURA - 20, p.y));
    }
  }
  if (melhor === -Infinity) {
    for (const i of m.ativos) {
      if (f.mortos.has(i)) continue;
      const p = posicaoInimigo(m.inimigos[i], n0 + 8);
      if (p && p.y > 0 && p.y < ALTURA - 60 && p.y > melhor) {
        melhor = p.y;
        alvoX = p.x;
      }
    }
  }
  const futuros = m.tiros.filter((t) => t.t > m.passo && t.t <= m.passo + OLHAR && t.t > m.limpoAte && (m.mortoEm(t.dono) ?? Infinity) > t.t);
  const tiros = [...m.tirosAtivos, ...futuros];
  let escolha: { dx: number; dy: number; nota: number; livre: number } | null = null;
  for (const [dx, dy] of DIRS) {
    const k = dx && dy ? Math.SQRT1_2 : 1;
    let x = m.nave.x;
    let y = m.nave.y;
    let livre = OLHAR + 1;
    for (let s = 1; s <= OLHAR && livre > OLHAR; s++) {
      x = Math.max(6, Math.min(LARGURA - 6, x + dx * VEL_NAVE * k));
      y = Math.max(10, Math.min(ALTURA - 8, y + dy * VEL_NAVE * k));
      const n = m.passo + s;
      for (const t of tiros) {
        const p = posicaoTiro(t, n);
        if (p && (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) <= (RAIO_NAVE + RAIO_TIRO + 3) ** 2) {
          livre = s;
          break;
        }
      }
      if (livre <= OLHAR) break;
      for (const i of m.ativos) {
        if (f.mortos.has(i)) continue;
        const p = posicaoInimigo(m.inimigos[i], n);
        const r = RAIO_NAVE + RAIO[m.inimigos[i].tipo] + 4;
        if (p && (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) <= r * r) {
          livre = s;
          break;
        }
      }
    }
    // depois de alguns passos, ficar parado na direção certa também conta: a nota olha onde ela estaria em 8 passos
    const x8 = Math.max(6, Math.min(LARGURA - 6, m.nave.x + dx * VEL_NAVE * k * 8));
    const y8 = Math.max(10, Math.min(ALTURA - 8, m.nave.y + dy * VEL_NAVE * k * 8));
    const nota = Math.min(livre, OLHAR + 1) * 100 - Math.abs(x8 - alvoX) - Math.abs(y8 - alvoY) * 0.6;
    if (!escolha || nota > escolha.nota) escolha = { dx, dy, nota, livre };
  }
  const e = escolha!;
  const encurralada = e.livre <= 4 && m.passo >= f.invulAte;
  return { dx: e.dx, dy: e.dy, fogo: true, bomba: encurralada && f.bombas > 0 };
}
