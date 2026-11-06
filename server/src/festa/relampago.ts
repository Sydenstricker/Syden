/**
 * QUIZ RELÂMPAGO (05/11/2026; do M.P.I.Q. do levantamento em docs/mario-party-3.md, só a mecânica): cinco perguntas NOSSAS, sobre
 * o próprio Syden e a horta, com três respostas cada. Todos veem a mesma pergunta ao mesmo tempo, cada um na própria tela, e
 * responde UMA vez; quando o tempo dela acaba, a certa aparece para todos, e vem a seguinte. Vale quantas acertou, e no empate a
 * soma do tempo das certas.
 *
 * O TEXTO mora só no site (web/src/festa/relampago.tsx, traduzido como o resto). Aqui fica só QUAL das três é a certa, na ordem
 * da lista de lá (o teste confere que as duas listas têm o mesmo tamanho). A ordem na tela é sorteada por pergunta, e a certa só
 * vai ao site quando o tempo dela acaba. Cada resposta vai na hora ('acerto'), com o tempo medido na tela desde que a pergunta
 * apareceu; o servidor confere que ela cabe no relógio dele e na janela da pergunta.
 */
import { FOLGA_ACIMA, inteiro, microjogo, numero, REACAO_MINIMA, sortear, type Resultado } from './comum.js';

/** A resposta certa de cada pergunta, na ordem da lista do site (o índice das três opções de lá). */
export const CERTAS = [1, 0, 2, 1, 0, 2, 1, 0, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2] as const;
export const PERGUNTAS_POR_RODADA = 5;
/** Quanto cada pergunta fica valendo na tela. */
export const PERGUNTA_MS = 4000;
/**
 * Depois de fechar, a certa ainda espera isto para ir à sala: a resposta honesta mais atrasada (a folga máxima da rede) chega
 * antes, e a que chega depois de a certa ter saído não vale. Quem viu a certa não tem mais como responder.
 */
export const ESPERA_MS = 900;
/** Quanto a certa fica na tela antes da seguinte. */
export const MOSTRA_MS = 1000;
export const PASSO_MS = PERGUNTA_MS + ESPERA_MS + MOSTRA_MS;

export interface DadosRelampago {
  /** Cada pergunta: o número dela na lista e a ordem das três opções na tela (ordem[k] é a opção da lista na posição k). */
  perguntas: { q: number; ordem: number[] }[];
  /** A posição certa na tela de cada pergunta cujo tempo já acabou (só pela `vista`; nunca antes). */
  certas?: (number | null)[];
}

interface Resposta {
  certa: boolean;
  ms: number;
}
type Mem = Map<number, Map<number, Resposta>>;

/** A posição da certa na tela, para a pergunta k. */
const certaNaTela = (d: DadosRelampago, k: number) => d.perguntas[k].ordem.indexOf(CERTAS[d.perguntas[k].q]);

const pelasRespostas = (r: Map<number, Resposta> | undefined): Resultado => {
  const certas = [...(r?.values() ?? [])].filter((x) => x.certa);
  if (certas.length === 0) return { motivo: 'errou', valor: 0, chave: [] };
  return { motivo: null, valor: certas.length, chave: [-certas.length, certas.reduce((a, x) => a + x.ms, 0)] };
};

export default microjogo<DadosRelampago, Mem>({
  id: 'relampago',
  gerar(aleatorio) {
    const perguntas: { q: number; ordem: number[] }[] = [];
    const usadas = new Set<number>();
    while (perguntas.length < PERGUNTAS_POR_RODADA) {
      let q = sortear(aleatorio, CERTAS.length);
      while (usadas.has(q)) q = (q + 1) % CERTAS.length;
      usadas.add(q);
      const ordem = [0, 1, 2];
      for (let i = 2; i > 0; i--) {
        const j = sortear(aleatorio, i + 1);
        [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
      }
      perguntas.push({ q, ordem });
    }
    return { perguntas };
  },
  duracao: (d) => d.perguntas.length * PASSO_MS + 800,
  memoria: () => new Map(),
  iniciar({ dados, agendar, avisar, revelar }) {
    // a cada pergunta que fecha, a sala relê (a certa aparece); depois da última, a revelação
    let k = 0;
    const proxima = () => {
      k++;
      avisar();
      if (k >= dados.perguntas.length) agendar(MOSTRA_MS + 800, revelar);
      else agendar(PASSO_MS, proxima);
    };
    agendar(PERGUNTA_MS + ESPERA_MS, proxima);
  },
  vista({ dados, fase, passou }) {
    const fechadas = fase === 'revelando' ? dados.perguntas.length : fase === 'jogando' ? Math.floor((passou + MOSTRA_MS) / PASSO_MS) : 0;
    return { dados: { perguntas: dados.perguntas, certas: dados.perguntas.map((_, k) => (k < fechadas ? certaNaTela(dados, k) : null)) } };
  },
  acerto({ dados, mem, quem, corpo, cabe, passou }) {
    const { k, opcao, ms } = corpo;
    if (!inteiro(k) || k < 0 || k >= dados.perguntas.length || !inteiro(opcao) || opcao < 0 || opcao > 2 || !numero(ms)) return;
    // dentro da janela da pergunta, e no relógio do servidor
    if (ms < 0 || ms > PERGUNTA_MS + FOLGA_ACIMA || !cabe(k * PASSO_MS + ms)) return;
    // e chegou antes de a certa sair para a sala
    if (passou > k * PASSO_MS + PERGUNTA_MS + ESPERA_MS) return;
    const minhas = mem.get(quem) ?? new Map<number, Resposta>();
    if (minhas.has(k)) return;
    // abaixo do mínimo não deu tempo de ler: é chute, e conta como errada
    minhas.set(k, { certa: ms >= REACAO_MINIMA && opcao === certaNaTela(dados, k), ms: Math.round(ms) });
    mem.set(quem, minhas);
  },
  avaliar: ({ mem, quem }) => pelasRespostas(mem.get(quem)),
  *noFim({ mem }) {
    for (const [quem, r] of mem) yield [quem, pelasRespostas(r)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    let n = 0;
    let soma = 0;
    dados.perguntas.forEach((_, k) => {
      const ms = Math.round(1300 + aleatorio() * 2000);
      if (k * PASSO_MS + ms > passouMs) return;
      if (aleatorio() < 0.7) {
        n++;
        soma += ms;
      }
    });
    return n === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: n, chave: [-n, soma] };
  },
});
