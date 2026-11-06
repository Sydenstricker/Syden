/** A ponte do riacho (festa/ponteriacho.ts): o servidor refaz cada passo; as quedas e as entregas são as dele. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { CARGA, inicial, LARGURA, PASSO_MINIMO_MS, passo, PONTE_MS, type Coelho, type Riacho } from '../src/festa/ponteriacho-sim.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

test('ponteriacho: a regra do site é a mesma do servidor, byte a byte', () => {
  const doServidor = readFileSync(new URL('../src/festa/ponteriacho-sim.ts', import.meta.url));
  const doSite = readFileSync(new URL('../../web/src/festa/ponteriacho-sim.ts', import.meta.url));
  assert.ok(doServidor.equals(doSite), 'as duas cópias de ponteriacho-sim.ts são diferentes');
});

/**
 * Quem joga com cuidado: procura, de 150 em 150 ms (esperando ou dando um passo), o caminho até a margem que interessa, sem
 * nunca cair. Devolve os passos (x, y, t).
 */
function planejar(r: Riacho, c0: Coelho, ritmo = 150): { x: number; y: number; t: number }[] {
  const alvo = c0.tabua ? LARGURA + 1 : 0;
  type No = { c: Coelho; passos: { x: number; y: number; t: number }[] };
  let fila: No[] = [{ c: c0, passos: [] }];
  const visto = new Set<string>();
  for (let t = c0.t + ritmo; t <= PONTE_MS; t += ritmo) {
    const prox: No[] = [];
    for (const no of fila) {
      const opcoes: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of opcoes) {
        let c: Coelho | null;
        if (dx === 0 && dy === 0) {
          // esperar: só se a pedra de agora não afunda até lá
          if (!ateSemCair(r, no.c, t)) continue;
          c = no.c;
        } else {
          c = passo(r, no.c, no.c.x + dx, no.c.y + dy, t);
          if (!c || c.quedas > no.c.quedas) continue;
        }
        const chave = `${c.x},${c.y},${c.tabua},${c.entregues}`;
        if (visto.has(`${chave},${t}`)) continue;
        visto.add(`${chave},${t}`);
        const passos = dx === 0 && dy === 0 ? no.passos : [...no.passos, { x: c.x, y: c.y, t }];
        if (c.x === alvo) return passos;
        prox.push({ c, passos });
      }
    }
    fila = prox;
  }
  throw new Error('sem caminho');
}

/** Ficar parado até t não derruba (a pedra de agora não afunda até lá). */
function ateSemCair(r: Riacho, c: Coelho, t: number) {
  // um passo de ida e volta no mesmo lugar não existe; a conta é a do ate(), pelo passo que ele daria
  const p = r.pedras[c.y * LARGURA + c.x - 1];
  if (c.x === 0 || c.x === LARGURA + 1 || !p || p.p === 0) return true;
  const fase = (c.t + p.f) % p.p;
  return fase < p.s && c.t + (p.s - fase) > t;
}

/** Joga honestamente: cada passo é dito no instante da tela e chega `rede` ms depois. */
function jogar(r: ReturnType<typeof rodadaDeTeste>, quem: number, rede: number, riacho: Riacho, tabuas: number, ritmo = 150) {
  let c = inicial();
  const enviados: { x: number; y: number; t: number }[] = [];
  while (c.entregues < tabuas) {
    for (const p of planejar(riacho, c, ritmo)) {
      const novo = passo(riacho, c, p.x, p.y, p.t)!;
      c = novo;
      enviados.push(p);
    }
  }
  return { fim: c, enviados: enviados.map((p) => ({ ...p, chega: p.t + rede, quem })) };
}

test('ponteriacho: quem pula com cuidado leva as três tábuas (200 e 300 ms de rede), e o mais rápido ganha', () => {
  const r = rodadaDeTeste('ponteriacho', { aleatorio: sorteioFixo(4) });
  const riacho = r.rodada.publico(ANA).dados as Riacho;
  const ana = jogar(r, ANA, 200, riacho, CARGA, 150);
  const bia = jogar(r, BIA, 300, riacho, CARGA, 250);
  assert.ok(ana.fim.ultima < PONTE_MS, `a Ana termina em ${ana.fim.ultima} ms`);
  const todos = [...ana.enviados, ...bia.enviados].sort((a, b) => a.chega - b.chega);
  for (const p of todos) {
    if (p.chega > PONTE_MS + 1000) break;
    r.em(p.chega);
    r.rodada.acao(p.quem, { tipo: 'acerto', x: p.x, y: p.y, t: p.t });
  }
  r.ateRevelar();
  assert.equal(r.linhaDe(ANA).valor, CARGA);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.ok((r.linhaDe(BIA).valor ?? 0) >= 1, `a Bia levou ${r.linhaDe(BIA).valor}`);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('ponteriacho: pular casas, atravessar de uma vez ou dizer um instante que não cabe não vale', () => {
  const r = rodadaDeTeste('ponteriacho', { aleatorio: sorteioFixo(4) });
  // a Bia salta direto para a outra margem
  r.em(500);
  r.rodada.acao(BIA, { tipo: 'acerto', x: LARGURA + 1, y: 2, t: 300 });
  // a Ana atravessa tudo no mesmo instante, passo a passo pelo console
  r.em(2000);
  for (let x = 1; x <= LARGURA + 1; x++) r.rodada.acao(ANA, { tipo: 'acerto', x, y: 2, t: 1800 + x });
  // e diz um passo de 5 s atrás
  r.rodada.acao(ANA, { tipo: 'acerto', x: 1, y: 2, t: 2000 - 5000 });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).motivo, 'errou');
  assert.equal(r.linhaDe(BIA).motivo, 'errou');
  assert.ok(PASSO_MINIMO_MS >= 80);
});

test('ponteriacho: quem pisa na pedra afundada cai e volta à margem, e a tábua volta à pilha', () => {
  const r = rodadaDeTeste('ponteriacho', { aleatorio: sorteioFixo(4) });
  const riacho = r.rodada.publico(ANA).dados as Riacho;
  // uma pedra da primeira coluna que afunda
  const y = [0, 1, 2, 3, 4].find((k) => riacho.pedras[k * LARGURA].p !== 0)!;
  const pedra = riacho.pedras[y * LARGURA];
  let c = inicial();
  // anda pela margem até a linha dela
  let t = 200;
  while (c.y !== y) {
    c = passo(riacho, c, 0, c.y + Math.sign(y - c.y), t)!;
    r.em(t + 200);
    r.rodada.acao(ANA, { tipo: 'acerto', x: 0, y: c.y, t });
    t += 150;
  }
  // espera ela afundar, e pisa
  while ((t + pedra.f) % pedra.p < pedra.s) t += 50;
  const caiu = passo(riacho, c, 1, y, t);
  r.em(t + 200);
  r.rodada.acao(ANA, { tipo: 'acerto', x: 1, y, t });
  assert.ok(caiu && caiu.x === 0 && caiu.quedas === 1 && caiu.tabua, 'na água: de volta à margem, com a tábua da pilha');
  // e o servidor viu a mesma queda: o próximo passo que vale é o da margem
  r.rodada.acao(ANA, { tipo: 'acerto', x: 2, y, t: t + 150 });
  r.ateRevelar();
  assert.equal(r.linhaDe(ANA).motivo, 'errou');
});

test('ponteriacho: o robô não leva tábua antes da hora', () => {
  const r = rodadaDeTeste('ponteriacho');
  const d = r.rodada.publico(ANA).dados;
  for (let s = 1; s < 30; s++) {
    const rob = resultadoDoRobo('ponteriacho', d, sorteioFixo(s), 7000);
    assert.equal(rob.motivo, 'errou');
    const cheio = resultadoDoRobo('ponteriacho', d, sorteioFixo(s), PONTE_MS);
    assert.ok(cheio.chave.length === 0 || cheio.chave[1] <= PONTE_MS);
  }
});
