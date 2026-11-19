/**
 * O PILOTO AUTOMÁTICO DO COMANDO CENOURA (só para os testes: server/test/minijogos-comando.test.ts e a tela, por
 * window.comandoPilotoAutomatico no site de desenvolvimento). Olha a mesma vista que a pessoa vê: pula as balas rente ao chão
 * e o golpe do andarilho, sai de baixo da semente marcada e do pisão do chefe, mira no bicho mais perto (para cima no voador)
 * e atira sem parar; a granada, quando um bicho está na distância dela. Sem bicho, anda para a direita (e passa pelas gaiolas).
 */
import { apoiado, BICHOS, GRANADA, ONDAS_X } from './conta';
import type { Comandos, Meu, Vista } from './regras';

export function pilotoAutomatico(eu: Meu, v: Vista, cmd: Comandos) {
  cmd.esquerda = cmd.direita = cmd.cima = cmd.baixo = false;
  cmd.atirar = false;
  const noChao = apoiado(eu.x, eu.h) && eu.vh <= 0;
  const [a0, a1] = v.arena;
  const vivos = v.bichos.filter((b) => b.estado !== 'morto' && b.hp > 0);

  // ---- o perigo: pular ----
  let pula = false;
  for (const b of v.balas) {
    if (b.tipo === 2) continue;
    const dx = eu.x - b.x;
    if (Math.sign(dx) !== Math.sign(b.vx) && Math.abs(dx) > 10) continue;
    const t = (Math.abs(dx) - 12) / Math.abs(b.vx || 1);
    if (t < 0.32 && t > -0.05) pula = true;
  }
  for (const b of vivos) {
    if (BICHOS[b.tipo].comp === 'andarilho' && b.estado === 'preparando' && b.ms > 300 && Math.abs(b.x - eu.x) < 40) pula = true;
  }
  // ---- o perigo: sair de baixo ----
  let foge: number | null = null;
  for (const b of vivos) {
    if (BICHOS[b.tipo].comp === 'voador' && b.estado === 'marcando' && Math.abs(b.alvoX - eu.x) < 24) foge = b.alvoX;
    if (BICHOS[b.tipo].comp === 'chefe' && (b.estado === 'prep-pisao' || b.estado === 'saltando') && Math.abs(b.alvoX - eu.x) < 56) foge = b.alvoX;
  }
  for (const b of v.balas) if (b.tipo === 2 && Math.abs(b.x - eu.x) < 18 && b.h > eu.h) foge = b.x;

  // ---- o alvo ----
  let alvo = null as (typeof vivos)[number] | null;
  let melhor = Infinity;
  for (const b of vivos) {
    if (b.x < a0 - 4 || b.x > a1 + 4) continue;
    const c = BICHOS[b.tipo].comp;
    const d = Math.abs(b.x - eu.x) + (c === 'voador' ? 40 : c === 'capsula' ? 100 : 0);
    if (d < melhor) {
      melhor = d;
      alvo = b;
    }
  }

  let ir = 0;
  let mira: 'frente' | 'cima' | 'diagonal' = 'frente';
  let olhar = eu.lado as number;
  if (foge !== null) {
    // para o lado com mais espaço
    const paraDireita = eu.x >= foge ? eu.x + 60 < a1 : eu.x - 60 < a0;
    ir = paraDireita ? 1 : -1;
  } else if (alvo) {
    const dx = alvo.x - eu.x;
    olhar = dx >= 0 ? 1 : -1;
    if (BICHOS[alvo.tipo].comp === 'voador' || BICHOS[alvo.tipo].comp === 'capsula') {
      // embaixo dele, mirando para cima (ou na diagonal, se já está perto)
      const cimaDe = alvo.h + BICHOS[alvo.tipo].alto / 2 - (eu.h + 20);
      if (Math.abs(dx) < 10) mira = 'cima';
      else if (Math.abs(Math.abs(dx) - cimaDe) < 14) mira = 'diagonal';
      else ir = Math.abs(dx) > cimaDe ? Math.sign(dx) : -Math.sign(dx);
      if (mira === 'diagonal') ir = Math.sign(dx);
    } else {
      // os do chão: a uma distância, olhando para eles
      const longe = BICHOS[alvo.tipo].comp === 'chefe' ? 110 : BICHOS[alvo.tipo].comp === 'andarilho' ? 56 : 80;
      const perto = BICHOS[alvo.tipo].comp === 'chefe' ? 80 : BICHOS[alvo.tipo].comp === 'andarilho' ? 34 : 20;
      if (Math.abs(dx) > longe) ir = Math.sign(dx);
      else if (Math.abs(dx) < perto) {
        // recua, se há espaço; senão fica
        const para = -Math.sign(dx) || -1;
        if ((para < 0 && eu.x - 30 > a0) || (para > 0 && eu.x + 30 < a1)) ir = para;
      }
      if (BICHOS[alvo.tipo].comp === 'chefe' && Math.abs(dx) <= GRANADA.alcance + 20 && Math.abs(dx) >= GRANADA.alcance - 30 && eu.lado === olhar) cmd.granada = true;
      if (BICHOS[alvo.tipo].comp !== 'chefe' && Math.abs(dx) >= 60 && Math.abs(dx) <= 115 && eu.lado === olhar) cmd.granada = true;
    }
  } else if (v.itens.some((it) => it.x > a0 && it.x < a1)) {
    // a arma que a cápsula soltou: vai até ela (o cliente pega ao encostar)
    const it = v.itens.find((i) => i.x > a0 && i.x < a1)!;
    ir = Math.abs(it.x - eu.x) > 4 ? Math.sign(it.x - eu.x) : 0;
  } else if (v.fase === 'avancando') {
    // a onda acabou: para a direita (as gaiolas estão no caminho)
    ir = 1;
    void ONDAS_X;
  }

  // virar para o alvo sem sair do lugar: um toque para o lado
  if (ir === 0 && alvo && olhar !== eu.lado) ir = olhar;
  if (ir > 0) cmd.direita = true;
  if (ir < 0) cmd.esquerda = true;
  if (mira === 'cima' || mira === 'diagonal') cmd.cima = true;
  if (alvo && foge === null) cmd.atirar = true;
  else if (alvo) cmd.atirar = true;
  if (pula && noChao) cmd.pulo = true;
}
