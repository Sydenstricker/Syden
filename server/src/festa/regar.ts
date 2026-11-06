/**
 * REGAR A HORTA (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica de levar a nuvem de chuva até a planta):
 * cinco canteiros, e um de cada vez fica com sede (a folha murcha e o balde vazio em cima); cada um sopra A SUA nuvem até ele,
 * contra o vento. A sede e o vento saem do sorteio, iguais para todos; cada um na própria tela, sem empurrar ninguém.
 *
 * O SERVIDOR REFAZ A PARTIDA: cada mudança de direção vai na hora (ação 'acerto', com o passo dela), conferida no relógio do
 * servidor, e a água é a da simulação dele (./lote2sim.ts, a mesma conta da tela). A mudança que chega atrasada além da rede da
 * pessoa vale no primeiro passo que ainda caberia (a tela e o servidor se afastam um pouco; acontece só com a internet engasgando).
 */
import { inteiro, microjogo, type Resultado } from './comum.js';
import { CANTEIROS, PASSO_MS, RAJADA_MS, REGAR_MS, REGAR_PASSOS, regar, SEDE_MS, type DadosRegar, type Entrada } from './lote2sim.js';

/** Mais mudanças que isto numa rodada é programa, não gente (são ~25 por segundo no máximo, se mudasse a cada passo). */
export const ENTRADAS_MAX = 600;

type Mem = Map<number, Entrada[]>;

const pelaAgua = (agua: number): Resultado =>
  agua === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: agua * PASSO_MS, chave: [-agua] };

/** Junta uma mudança de direção às de quem mandou: o passo nunca volta atrás, e o atrasado vale no primeiro que ainda cabe. */
export function juntarEntrada(lista: Entrada[], corpo: Record<string, unknown>, passou: number, abaixo: number, passos: number, max = ENTRADAS_MAX) {
  const { p, dx, dy } = corpo;
  if (!inteiro(p) || !inteiro(dx) || !inteiro(dy) || Math.abs(dx) > 1 || Math.abs(dy) > 1) return;
  if (lista.length >= max || p < 0 || p >= passos) return;
  // nunca no futuro do relógio do servidor (com a folga de um passo e do arredondamento)
  if (p * PASSO_MS > passou + PASSO_MS + 50) return;
  const cedo = Math.ceil((passou - abaixo) / PASSO_MS);
  const ultimo = lista.length ? lista[lista.length - 1][0] : 0;
  lista.push([Math.max(p, cedo, ultimo), dx, dy]);
}

export default microjogo<DadosRegar, Mem>({
  id: 'regar',
  gerar(aleatorio) {
    const sede: number[] = [];
    for (let k = 0; k * SEDE_MS < REGAR_MS; k++) {
      // nunca o mesmo canteiro duas vezes seguidas, e o primeiro nunca o do meio (onde a nuvem já está)
      let c = Math.floor(aleatorio() * CANTEIROS.length);
      if (c === sede[k - 1] || (k === 0 && c === 2)) c = (c + 1 + Math.floor(aleatorio() * (CANTEIROS.length - 1))) % CANTEIROS.length;
      if (c === sede[k - 1] || (k === 0 && c === 2)) c = (c + 1) % CANTEIROS.length;
      if (c === sede[k - 1]) c = (c + 1) % CANTEIROS.length;
      sede.push(c);
    }
    const ventos: [number, number][] = [];
    for (let k = 0; k * RAJADA_MS < REGAR_MS; k++) {
      // a direção sorteada, com força de 40% a 100%; a primeira rajada é calma
      let x = aleatorio() * 2 - 1;
      let y = aleatorio() * 2 - 1;
      const m = Math.sqrt(x * x + y * y) || 1;
      const forca = k === 0 ? 0.2 : 0.4 + aleatorio() * 0.6;
      x = Math.round((x / m) * forca * 1000) / 1000;
      y = Math.round((y / m) * forca * 1000) / 1000;
      ventos.push([x, y]);
    }
    return { sede, ventos };
  },
  duracao: () => REGAR_MS + 1500,
  memoria: () => new Map(),
  acerto({ mem, quem, corpo, passou, abaixo }) {
    const lista = mem.get(quem) ?? [];
    juntarEntrada(lista, corpo, passou, abaixo, REGAR_PASSOS);
    mem.set(quem, lista);
  },
  // a água é a da simulação do servidor, até o fim (quem manda o fim antes só para de soprar)
  avaliar: ({ dados, mem, quem }) => {
    const e = mem.get(quem);
    return e?.length ? pelaAgua(regar(dados, e).agua) : pelaAgua(0);
  },
  *noFim({ dados, mem }) {
    for (const [quem, e] of mem) if (e.length) yield [quem, pelaAgua(regar(dados, e).agua)] as [number, Resultado];
  },
  robo(_dados, aleatorio, passouMs) {
    // quem joga bem molha o canteiro com sede uns 35% a 55% do tempo (o caminho entre um e outro não molha)
    const passos = Math.floor(Math.min(passouMs, REGAR_MS) / PASSO_MS);
    return pelaAgua(Math.floor(passos * (0.35 + aleatorio() * 0.2)));
  },
});
