/**
 * O PILOTO AUTOMÁTICO DO CHEFE DA TURMA (só para os testes: web/test/chefe.test.ts e a tela, por
 * window.chefePilotoAutomatico no site de desenvolvimento). Olha a mesma vista que a pessoa vê: foge de toda marca no chão
 * que vai cair logo, pega o torrão frio mais perto, fica a uma distância da toupeira e atira; a bomba, quando ela está tonta.
 */
import { ARENA, BOMBA, CORPO_CHEFE, CORPO_COELHO, distancia, distSegmento, naArena, vulneravel } from './conta';
import type { Comandos, Meu, Vista } from './regras';

const DIRECOES: [number, number][] = [];
for (let k = 0; k < 16; k++) {
  const a = (k / 16) * Math.PI * 2;
  DIRECOES.push([Math.cos(a), Math.sin(a)]);
}

/** O perigo de estar em (x, y): as marcas que caem logo, pesando mais as que estão para cair. */
function perigo(x: number, y: number, v: Vista): number {
  let p = 0;
  for (const m of v.marcas) {
    if (m.resta < -150 || m.resta > 2200) continue;
    const peso = 1000 / (1 + Math.max(0, m.resta) / 300);
    const margem = CORPO_COELHO + 10;
    if (m.tipo === 'investida') {
      if (distSegmento(x, y, m.x, m.y, m.x2, m.y2) <= m.r + margem) p += peso;
    } else {
      const cx = m.tipo === 'torrao' ? m.x2 : m.x;
      const cy = m.tipo === 'torrao' ? m.y2 : m.y;
      if (distancia(x, y, cx, cy) <= m.r + margem) p += peso;
    }
  }
  const c = v.chefe;
  if (c && (c.estado === 'investida' || c.estado === 'prep-investida')) {
    // o caminho da investida já está nas marcas; o corpo dela, perto, também
    if (distancia(x, y, c.x, c.y) < CORPO_CHEFE + 20) p += 400;
  } else if (c && distancia(x, y, c.x, c.y) < CORPO_CHEFE + 8) p += 50;
  return p;
}

/** O lugar escolhido fica escolhido por um tempo (sem isso o piloto treme entre dois lugares e não sai de nenhum). */
const escolhas = new WeakMap<Meu, { x: number; y: number; ate: number; perigo: number }>();

export function pilotoAutomatico(eu: Meu, v: Vista, cmd: Comandos) {
  cmd.esquerda = cmd.direita = cmd.cima = cmd.baixo = false;
  const c = v.chefe;
  const antes = escolhas.get(eu);
  const vale = !!antes && antes.ate > eu.relogio && distancia(eu.x, eu.y, antes.x, antes.y) > 3 && perigo(antes.x, antes.y, v) <= antes.perigo + 1;
  // o objetivo: o torrão frio mais perto (de mãos vazias), ou a ~110 px da toupeira
  let alvo: [number, number] = [240, 230];
  const livres = v.noChao.filter((t) => t.resta > 300);
  if (!eu.segura && livres.length) {
    const t = livres.sort((a, b) => distancia(eu.x, eu.y, a.x, a.y) - distancia(eu.x, eu.y, b.x, b.y))[0];
    alvo = [t.x, t.y];
  } else if (c) {
    const d = distancia(eu.x, eu.y, c.x, c.y) || 1;
    alvo = naArena(c.x + ((eu.x - c.x) / d) * 110, c.y + ((eu.y - c.y) / d) * 110);
  }
  let melhor: [number, number] = vale ? [antes!.x, antes!.y] : [eu.x, eu.y];
  let nota = vale ? -Infinity : perigo(eu.x, eu.y, v) * 4 + distancia(eu.x, eu.y, alvo[0], alvo[1]);
  for (const passo of vale ? [] : [14, 30, 60, 90]) {
    for (const [dx, dy] of DIRECOES) {
      const [x, y] = naArena(eu.x + dx * passo, eu.y + dy * passo);
      // fora da arena por pouco não vale: preso na borda, o coelho não chega lá
      if (x <= ARENA.x0 + 1 || x >= ARENA.x1 - 1 || y <= ARENA.y0 + 1 || y >= ARENA.y1 - 1) continue;
      const n = perigo(x, y, v) * 4 + distancia(x, y, alvo[0], alvo[1]) + passo * 0.2;
      if (n < nota) {
        nota = n;
        melhor = [x, y];
      }
    }
  }
  if (!vale) escolhas.set(eu, { x: melhor[0], y: melhor[1], ate: eu.relogio + 300, perigo: perigo(melhor[0], melhor[1], v) });
  const dx = melhor[0] - eu.x;
  const dy = melhor[1] - eu.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 2) {
    if (dx / d > 0.38) cmd.direita = true;
    if (dx / d < -0.38) cmd.esquerda = true;
    if (dy / d > 0.38) cmd.baixo = true;
    if (dy / d < -0.38) cmd.cima = true;
  }
  if (c && vulneravel(c.estado)) {
    if (eu.segura && distancia(eu.x, eu.y, c.x, c.y) < 300) cmd.atirar = true;
    if (eu.bomba && (c.estado === 'tonta' || c.estado === 'parada' || c.estado === 'prep-torroes') && distancia(eu.x, eu.y, c.x, c.y) < BOMBA.alcance) cmd.bomba = true;
  }
}
