import { copiarCoelho, DIREITA, ESQUERDA, FRENTE, novoCoelho, passo, PULO, TRAS, type Coelho, type Percurso } from './sim';

/**
 * O PILOTO AUTOMÁTICO da Gincana da toca: serve aos testes (web/test/gincana.test.ts confere que todo percurso se termina e que
 * o servidor aceita o que ele grava) e ao e2e (window.gincanaPilotoAutomatico, só no site de desenvolvimento), nunca a quem joga.
 *
 * Como o do Pulo do coelho (plataforma/piloto.ts): ele PLANEJA, numa busca em feixe sobre a própria regra (determinística), em
 * blocos de alguns passos, guardando os estados mais adiantados e diferentes entre si. Quem caiu ou se machucou é descartado;
 * quem espera a plataforma (ou a serra passar) na beirada sobrevive no feixe até a hora.
 */

const ACOES = [
  FRENTE,
  FRENTE | PULO,
  FRENTE | ESQUERDA,
  FRENTE | DIREITA,
  FRENTE | ESQUERDA | PULO,
  FRENTE | DIREITA | PULO,
  ESQUERDA,
  DIREITA,
  0,
  TRAS,
  ESQUERDA | PULO,
  DIREITA | PULO,
];

interface No {
  k: Coelho;
  pai: No | null;
  acao: number;
}

/**
 * O plano (os comandos de cada passo) de `inicio` (a largada, se não vier) à chegada, ou null se não achou em `limite` passos.
 */
export function planejar(p: Percurso, inicio: Coelho = novoCoelho(p), largura = 160, bloco = 6, limite = 60 * 150): number[] | null {
  let feixe: No[] = [{ k: copiarCoelho(inicio), pai: null, acao: -1 }];
  for (let t = 0; t * bloco < limite; t++) {
    const vistos = new Map<string, No>();
    for (const no of feixe) {
      for (let a = 0; a < ACOES.length; a++) {
        const k = copiarCoelho(no.k);
        let perdeu = false;
        for (let i = 0; i < bloco; i++) {
          passo(k, ACOES[a], p);
          if (k.quedas > no.k.quedas) {
            perdeu = true;
            break;
          }
          if (k.chegou) break;
        }
        if (perdeu) continue;
        const filho = { k, pai: no, acao: a };
        if (k.chegou) return desenrolar(filho, bloco, k.chegouEm - inicio.passo);
        const chave = `${Math.round(k.x * 2)},${Math.round(k.z * 2)},${Math.round(k.y)},${k.noChao ? 1 : 0},${k.posto},${k.golpe > 0 ? 1 : 0}`;
        const ja = vistos.get(chave);
        if (!ja || ja.k.z < k.z) vistos.set(chave, filho);
      }
    }
    // os mais adiantados, e também os mais adiantados PISANDO EM ALGO (sem empurrão): quem espera na beirada não pode ser
    // empurrado para fora do feixe por quem pulou no buraco e ainda está caindo
    const todos = [...vistos.values()].sort((a, b) => b.k.posto - a.k.posto || b.k.z - a.k.z);
    const frente = todos.slice(0, Math.round(largura * 0.5));
    const pisando = todos
      .slice(frente.length)
      .filter((n) => n.k.noChao && n.k.golpe === 0)
      .slice(0, largura - frente.length);
    feixe = [...frente, ...pisando];
    if (feixe.length === 0) return null;
  }
  return null;
}

function desenrolar(no: No, bloco: number, total: number): number[] {
  const acoes: number[] = [];
  for (let n: No | null = no; n && n.acao >= 0; n = n.pai) acoes.push(n.acao);
  acoes.reverse();
  const plano: number[] = [];
  for (const a of acoes) for (let i = 0; i < bloco; i++) plano.push(ACOES[a]);
  return plano.slice(0, total);
}
