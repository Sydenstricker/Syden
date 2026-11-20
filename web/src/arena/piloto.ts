/**
 * O PILOTO AUTOMÁTICO DA ARENA (só para os testes: server/test/minijogos-bichos-arena.test.ts e a tela, por
 * window.arenaPilotoAutomatico no site de desenvolvimento). Olha a mesma vista que a pessoa vê: sai das marcas no chão, faz a
 * arrancada quando uma bala vem, mira no inimigo mais perto (pelo mouse que ele não tem: o alvo), bate quando ele está no
 * alcance, troca para o bicho que vale mais contra o dele e vai buscar a cura com pouca vida. Sem ninguém à vista (o mato
 * esconde), vai olhar as moitas, uma de cada vez.
 */
import { alcanceLivre, balaPassaPerto, KITS, MATO, RAIO, type Cenario } from './conta';
import { eficacia, ESPECIES, type Elemento } from '../bichos/regras';
import type { Cliente, Comandos, Vista } from './regras';

export function pilotoAutomatico(c: Cliente, v: Vista, cmd: Comandos, agora: number) {
  const eu = c.eu;
  cmd.esquerda = cmd.direita = cmd.cima = cmd.baixo = false;
  cmd.atacar = false;
  const cenario: Cenario = c.cenario;
  const inimigos = v.coelhos.filter((o) => o.id !== c.id && o.time !== eu.time && o.estado === 0 && !o.escondido);
  let vx = 0,
    vy = 0;

  // ---- o perigo: sair das marcas ----
  let fugindo = false;
  for (const z of v.zonas) {
    if (z.dono === c.id || (z.time >= 0 && z.time === eu.time)) continue;
    const dx = eu.x - z.x, dy = eu.y - z.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > z.raio + RAIO + 10) continue;
    fugindo = true;
    vx += d > 0.1 ? dx / d : 1;
    vy += d > 0.1 ? dy / d : 0;
    if (z.resta < 500) cmd.arrancada = true;
  }
  // ---- as balas que vêm: a arrancada de lado ----
  for (const b of v.balas) {
    if (b.dono === c.id) continue;
    const dono = v.coelhos.find((o) => o.id === b.dono);
    if (dono && dono.time === eu.time) continue;
    if (balaPassaPerto(b.x, b.y, b.dx, b.dy, 0, b.golpe.vel * 0.25, eu.x, eu.y, RAIO + b.golpe.raio + 4)) {
      cmd.arrancada = true;
      // de lado da bala
      vx += -b.dy;
      vy += b.dx;
    }
  }

  // ---- o alvo ----
  let alvo: (typeof inimigos)[number] | null = null;
  let melhor = Infinity;
  for (const o of inimigos) {
    const d = Math.hypot(o.x - eu.x, o.y - eu.y) - (o.pv < 30 ? 80 : 0);
    if (d < melhor) {
      melhor = d;
      alvo = o;
    }
  }

  // ---- a cura, com pouca vida ----
  const cura = eu.pv < 50 ? v.suprimentos.find((s) => s.tipo === 'cura') : v.suprimentos.find((s) => Math.hypot(s.x - eu.x, s.y - eu.y) < 140);
  if (!fugindo && cura) {
    const dx = cura.x - eu.x, dy = cura.y - eu.y;
    const d = Math.hypot(dx, dy) || 1;
    vx += dx / d;
    vy += dy / d;
  } else if (!fugindo && alvo) {
    const dx = alvo.x - eu.x, dy = alvo.y - eu.y;
    const d = Math.hypot(dx, dy) || 1;
    const quer = KITS[c.meuElemento()].s.forma === 'roda' ? 60 : 150;
    const vai = d > quer + 20 ? 1 : d < quer - 30 ? -1 : 0;
    // rodando em volta dele, para as balas dele errarem
    const lado = Math.floor(agora / 2500) % 2 ? 1 : -1;
    vx += (dx / d) * vai - (dy / d) * lado * 0.7;
    vy += (dy / d) * vai + (dx / d) * lado * 0.7;
  } else if (!fugindo) {
    // ninguém à vista: olhar uma moita (troca a cada 4 s)
    const moitas = MATO[cenario];
    const [mx, my] = moitas[(Math.floor(agora / 4000) + Math.abs(c.id)) % moitas.length];
    const dx = mx - eu.x, dy = my - eu.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 20) {
      vx += dx / d;
      vy += dy / d;
    }
  }
  if (Math.abs(vx) > 0.2) (vx > 0 ? (cmd.direita = true) : (cmd.esquerda = true));
  if (Math.abs(vy) > 0.2) (vy > 0 ? (cmd.baixo = true) : (cmd.cima = true));

  if (!alvo) {
    cmd.alvoX = cmd.alvoY = null;
    return;
  }
  // ---- a mira e os golpes ----
  cmd.alvoX = alvo.x;
  cmd.alvoY = alvo.y;
  const d = Math.hypot(alvo.x - eu.x, alvo.y - eu.y);
  const [ux, uy] = [(alvo.x - eu.x) / (d || 1), (alvo.y - eu.y) / (d || 1)];
  const kit = KITS[c.meuElemento()];
  const livre = alcanceLivre(cenario, eu.x, eu.y, ux, uy, d) >= d - RAIO - 4;
  if (d < kit.b.alcance * 0.95 && livre) cmd.atacar = true;
  if (c.pronto('e', agora) && d < kit.e.alcance) cmd.especial = true;
  else if (c.pronto('q', agora) && d < kit.q.alcance * 0.9) cmd.forte = true;
  else if (c.pronto('s', agora)) {
    const s = kit.s;
    if ((s.forma === 'roda' && d < s.raio + RAIO) || (s.forma === 'zona' && d < s.alcance) || (s.forma === 'tiro' && d < s.alcance * 0.9 && livre)) cmd.secundario = true;
  }
  // ---- trocar para o bicho que vale mais contra o dele ----
  if (c.cargaDaTroca(agora) >= 1) {
    const def = c.elementoDe(alvo.id, alvo.ativo) as Elemento;
    const minha = c.equipes.get(c.id) ?? [];
    const agoraVale = eficacia(c.meuElemento() as Elemento, def);
    let melhorI = -1;
    let melhorV = agoraVale;
    minha.forEach((e, i) => {
      const val = eficacia(ESPECIES[e]?.elemento ?? 'nenhum', def);
      if (val > melhorV) {
        melhorV = val;
        melhorI = i;
      }
    });
    if (melhorI >= 0) cmd.trocar = melhorI;
  }
}
