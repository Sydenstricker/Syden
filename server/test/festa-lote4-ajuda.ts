/**
 * A jogada honesta dos microjogos do LOTE 4 (para a partida aleatória de minijogos-festa.test.ts): true se o id é do lote.
 * Quem joga é uma pessoa só (a Bia não responde): ela entra na turma e faz o mínimo que vale ponto em cada um.
 */
import { CERTAS, PASSO_MS, type DadosRelampago } from '../src/festa/relampago.js';
import { inicial, LARGURA, passo, PONTE_MS, type Coelho, type Riacho } from '../src/festa/ponteriacho-sim.js';
import type { VistaCeleiro } from '../src/festa/celeiro.js';
import type { VistaTambor } from '../src/festa/tambor.js';

type Jogo = { publico(quem: number): Record<string, unknown>; acao(quem: number, corpo: Record<string, unknown>): string | null };

const LOTE4 = new Set(['relampago', 'ponteriacho', 'celeiro', 'esconde', 'cabo', 'torta', 'tambor', 'revezamento']);

/** O caminho mais curto (de 150 em 150 ms, esperando ou andando, sem cair) até a margem que interessa. */
export function caminhoDaPonte(r: Riacho, c0: Coelho, ritmo = 150): { x: number; y: number; t: number }[] {
  const alvo = c0.tabua ? LARGURA + 1 : 0;
  const parado = (c: Coelho, t: number) => {
    const p = r.pedras[c.y * LARGURA + c.x - 1];
    if (c.x === 0 || c.x === LARGURA + 1 || !p || p.p === 0) return true;
    const fase = (c.t + p.f) % p.p;
    return fase < p.s && c.t + (p.s - fase) > t;
  };
  let fila: { c: Coelho; passos: { x: number; y: number; t: number }[] }[] = [{ c: c0, passos: [] }];
  for (let t = c0.t + ritmo; t <= PONTE_MS; t += ritmo) {
    const prox: typeof fila = [];
    const visto = new Set<string>();
    for (const no of fila) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let c: Coelho | null;
        if (!dx && !dy) c = parado(no.c, t) ? no.c : null;
        else {
          c = passo(r, no.c, no.c.x + dx, no.c.y + dy, t);
          if (c && c.quedas > no.c.quedas) c = null;
        }
        if (!c || visto.has(`${c.x},${c.y}`)) continue;
        visto.add(`${c.x},${c.y}`);
        const passos = !dx && !dy ? no.passos : [...no.passos, { x: c.x, y: c.y, t }];
        if (c.x === alvo && (dx || dy)) return passos;
        prox.push({ c, passos });
      }
    }
    fila = prox;
  }
  return [];
}

export function jogadaHonestaDoLote4(
  micro: string,
  jogo: Jogo,
  quem: number,
  { andar, avancar }: { andar: () => void; avancar: (ms: number) => void },
): boolean {
  if (!LOTE4.has(micro)) return false;
  const acerto = (c: Record<string, unknown>) => jogo.acao(quem, { tipo: 'acerto', ...c });
  if (micro === 'relampago') {
    // a primeira pergunta, certa, em 1,5 s (o pedido chega 100 ms depois)
    const d = jogo.publico(quem).dados as DadosRelampago;
    avancar(1600);
    acerto({ k: 0, opcao: d.perguntas[0].ordem.indexOf(CERTAS[d.perguntas[0].q]), ms: 1500 });
    void PASSO_MS;
  } else if (micro === 'ponteriacho') {
    // uma tábua até a ponte, e "terminei"
    const r = jogo.publico(quem).dados as Riacho;
    let c = inicial();
    let ja = 0;
    for (const p of caminhoDaPonte(r, c)) {
      avancar(p.t + 100 - ja);
      ja = p.t + 100;
      c = passo(r, c, p.x, p.y, p.t)!;
      acerto(p);
    }
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'celeiro') {
    // entra, vira uma carta (a primeira nunca é a raposa) e guarda
    avancar(100);
    acerto({ entrar: 1 });
    andar();
    avancar(500);
    let v = jogo.publico(quem).dados as VistaCeleiro;
    acerto({ vira: 0, n: v.n });
    andar();
    avancar(300);
    v = jogo.publico(quem).dados as VistaCeleiro;
    acerto({ guarda: 1, n: v.n });
  } else if (micro === 'esconde') {
    // entra e se esconde na moita (contra a raposa, qualquer resultado vale)
    avancar(100);
    acerto({ entrar: 1 });
    andar();
    avancar(800);
    acerto({ r: 0, lugar: 0 });
  } else if (micro === 'tambor') {
    // entra e toca a primeira batida
    avancar(100);
    acerto({ entrar: 1 });
    andar();
    avancar(600);
    const v = jogo.publico(quem).dados as VistaTambor;
    acerto({ n: v.n, batidas: [{ tambor: 0, ms: 0 }] });
  } else {
    // o cabo, a torta e o revezamento: entra e aperta 8 vezes por segundo, mandando o total a cada 250 ms
    avancar(100);
    acerto({ entrar: 1 });
    if (micro === 'revezamento') andar();
    let t = micro === 'revezamento' ? 1200 : 100;
    let n = 0;
    for (let k = 0; k < 120 && jogo.publico(quem).fase === 'jogando'; k++) {
      avancar(250);
      t += 250;
      n += 2;
      acerto({ n, t: t - 100 });
    }
  }
  return true;
}
