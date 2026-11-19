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
export function planejar(p: Percurso, inicio: Coelho = novoCoelho(p), largura = 160, bloco = 6, limite = 60 * 150, alvoPosto = Infinity): number[] | null {
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
        // um trecho só: até pisar na bandeira pedida
        if (k.posto >= alvoPosto && k.noChao) return desenrolar(filho, bloco, k.passo - inicio.passo);

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

/** Um sorteio pequeno e sempre igual para a mesma semente (só os robôs do Solo, no computador de quem joga). */
function sorteio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * OS COELHOS-ROBÔ DO SOLO (19/11/2026): correm junto, como fantasmas, mas não são de ninguém e não viram recorde (vivem só no
 * computador de quem joga). Cada um é o piloto planejador COM ERRO, trecho a trecho (de bandeira em bandeira): às vezes espera
 * na bandeira, às vezes tropeça para o lado no meio do trecho (e pode cair, voltando à bandeira). Depois de cada erro, planeja
 * de novo de onde está. `aoTrecho` recebe os comandos de cada trecho assim que ficam prontos (o robô corre enquanto o resto é
 * planejado). Devolve os comandos todos.
 */
export function correrRobo(p: Percurso, semente: number, aoTrecho: (comandos: number[]) => void = () => {}, erro = 0.5): number[] {
  const r = sorteio(semente);
  const k = novoCoelho(p);
  const todos: number[] = [];
  const andar = (lista: number[]) => {
    for (const e of lista) {
      passo(k, e, p);
      todos.push(e);
      if (k.chegou) break;
    }
    aoTrecho(lista);
  };
  const ultimo = p.postos.length;
  let tentativas = 0;
  /** As vezes que o trecho de agora já deu errado: depois de duas, o robô para de errar nele (e planeja com mais calma). */
  let falhas = 0;
  let alvoAntes = 0;
  for (let alvo = 1; alvo <= ultimo && !k.chegou && tentativas < 40; tentativas++) {
    if (alvo !== alvoAntes) falhas = 0;
    else falhas++;
    alvoAntes = alvo;
    const errando = falhas < 2 ? erro : 0;
    // a espera na bandeira (no máximo ~1 s)
    if (r() < errando * 0.6) andar(new Array(10 + Math.floor(r() * 50)).fill(0));
    // planeja só do chão (de dentro de um pulo, a busca pode não achar nada)
    let espera = 0;
    const parado: number[] = [];
    while (!k.noChao && !k.chegou && espera++ < 120) {
      passo(k, 0, p);
      todos.push(0);
      parado.push(0);
    }
    if (parado.length) aoTrecho(parado);
    const plano = planejar(p, k, falhas < 2 ? 50 : 140, 6, 60 * 30, alvo < ultimo ? alvo : Infinity);
    if (!plano) {
      // num lugar sem saída: anda para o lado até cair e volta à bandeira (de lá o plano sempre existe)
      const quedas = k.quedas, saida: number[] = [];
      while (k.quedas === quedas && saida.length < 900) {
        passo(k, ESQUERDA, p);
        todos.push(ESQUERDA);
        saida.push(ESQUERDA);
      }
      aoTrecho(saida);
      continue;
    }


    // o tropeço: no meio do trecho, um tanto de lado (e então planeja de novo de onde ficou)
    const tropeca = r() < errando ? Math.floor(plano.length * (0.2 + r() * 0.6)) : -1;

    if (tropeca > 0) {
      const quedas = k.quedas;
      andar(plano.slice(0, tropeca));
      const lado = r() < 0.5 ? ESQUERDA : DIREITA;
      andar(new Array(8 + Math.floor(r() * 18)).fill(r() < 0.5 ? lado : lado | FRENTE));
      if (k.quedas > quedas) continue; // caiu: o mesmo trecho, da bandeira
      if (k.posto >= alvo) alvo++;
      continue;
    }
    andar(plano);
    alvo = Math.max(alvo + 1, k.posto + 1);
  }
  return todos;
}
