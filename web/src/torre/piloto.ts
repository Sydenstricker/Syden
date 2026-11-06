import type { Torre } from './fases';
import { passo, type Coelho, type Comandos } from './fisica';

/**
 * O PILOTO AUTOMÁTICO da Torre do celeiro (o do Pulo do coelho, web/src/plataforma/piloto.ts, virado para cima): uma busca
 * em feixe sobre a própria física, que é determinística. Serve aos testes (web/test/torre.test.ts: toda torre se termina, e
 * o fantasma honesto passa no servidor) e ao e2e (window.torrePilotoAutomatico, só no site de desenvolvimento), nunca a
 * quem joga. Quem leva uma pancada é descartado; quem espera a viga ou a ferramenta passar sobrevive no feixe até a hora.
 */

const ACOES: Comandos[] = [
  { esquerda: false, direita: true, pula: false },
  { esquerda: false, direita: true, pula: true },
  { esquerda: true, direita: false, pula: false },
  { esquerda: true, direita: false, pula: true },
  { esquerda: false, direita: false, pula: true },
  { esquerda: false, direita: false, pula: false },
];

interface No {
  k: Coelho;
  pai: No | null;
  acao: number;
}

export function planejar(f: Torre, inicio: Coelho, largura = 400, bloco = 5, limite = 60 * 150): Comandos[] | null {
  let feixe: No[] = [{ k: { ...inicio }, pai: null, acao: -1 }];
  for (let t = 0; t * bloco < limite; t++) {
    const vistos = new Map<string, No>();
    for (const no of feixe) {
      for (let a = 0; a < ACOES.length; a++) {
        const k = { ...no.k };
        let caiu = false;
        for (let i = 0; i < bloco; i++) {
          passo(k, ACOES[a], f);
          if (k.quedas > no.k.quedas) {
            caiu = true;
            break;
          }
          if (k.terminou) break;
        }
        if (caiu) continue;
        const filho = { k, pai: no, acao: a };
        if (k.terminou) return desenrolar(filho, bloco, k.chegouEm - inicio.passos);
        const chave = `${Math.round(k.x / 4)},${Math.round(k.y / 3)},${Math.round(k.vy / 80)},${k.noChao ? 1 : 0},${k.sobre},${k.pulaAntes ? 1 : 0}`;
        if (!vistos.has(chave)) vistos.set(chave, filho);
      }
    }
    // os mais altos, e também os mais altos PISANDO EM ALGO (quem espera a viga não pode ser empurrado para fora do feixe
    // por quem pulou e ainda está no ar)
    const todos = [...vistos.values()].sort((a, b) => a.k.y - b.k.y);
    const frente = todos.slice(0, Math.round(largura * 0.5));
    const pisando = todos.slice(frente.length).filter((n) => n.k.noChao).slice(0, largura - frente.length);
    feixe = [...frente, ...pisando];
    if (feixe.length === 0) return null;
  }
  return null;
}

function desenrolar(no: No, bloco: number, total: number): Comandos[] {
  const acoes: number[] = [];
  for (let n: No | null = no; n && n.acao >= 0; n = n.pai) acoes.push(n.acao);
  acoes.reverse();
  const plano: Comandos[] = [];
  for (const a of acoes) for (let i = 0; i < bloco; i++) plano.push(ACOES[a]);
  return plano.slice(0, Math.max(total, 0) + 1);
}
