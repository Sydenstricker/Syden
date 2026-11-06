/**
 * QUEM ESTÁ ATRÁS DA TURMA? (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica do "quem está atrás da
 * multidão"): um bicho da horta está escondido atrás de uma turma de coelhos de costas, e os coelhos vão saindo um a um, cada um
 * descobrindo um pedaço dele. Embaixo, quatro bichos; escolhe-se quem é. Quanto antes, mais vale; errar é zero ponto, e uma
 * escolha só. Observação: o chute cedo é a aposta, e a turma que sai dá a resposta para quem espera.
 *
 * QUEM ESTÁ ATRÁS SÓ VAI QUANDO O PRIMEIRO COELHO SAI: antes disso a tela não tem o que desenhar, e o site não sabe a resposta.
 * Depois, a tela precisa saber qual bicho é para desenhar o pedaço descoberto: é o que sobra (um programa leria o bicho logo no
 * primeiro pedaço, que a pessoa também vê). A ordem e a hora em que cada coelho sai vão prontas, iguais para todos.
 */
import { invalido, inteiro, microjogo, numero, type Resultado } from './comum.js';

/** Os bichos que podem estar atrás (a tela desenha cada um, no mesmo índice). */
export const TIPOS_ESCONDIDOS = 8;
export const OPCOES = 4;
/** A turma: 4 colunas × 3 fileiras de coelhos na frente do bicho. */
export const COLUNAS = 4;
export const FILEIRAS = 3;
export const TURMA = COLUNAS * FILEIRAS;
export const PRIMEIRA_SAIDA_MS = 1200;
export const MULTIDAO_MS = 13000;

export interface DadosMultidao {
  /** O bicho escondido, ou −1 enquanto nenhum coelho saiu. */
  bicho: number;
  /** Os quatro bichos para escolher, na ordem da tela (um deles é o escondido). */
  opcoes: number[];
  /** Cada coelho da turma (pela casa, 0 em cima à esquerda): quando sai (ms desde o começo). */
  saidas: number[];
}

interface Mem {
  mostrou: boolean;
}

export default microjogo<DadosMultidao, Mem>({
  id: 'multidao',
  gerar(aleatorio) {
    const tipos = Array.from({ length: TIPOS_ESCONDIDOS }, (_, i) => i);
    for (let i = tipos.length - 1; i > 0; i--) {
      const j = Math.floor(aleatorio() * (i + 1));
      [tipos[i], tipos[j]] = [tipos[j], tipos[i]];
    }
    const opcoes = tipos.slice(0, OPCOES);
    const bicho = opcoes[Math.floor(aleatorio() * OPCOES)];
    // a ordem em que os coelhos saem: os da fileira de cima por último (o rosto do bicho fica escondido mais tempo)
    const casas = Array.from({ length: TURMA }, (_, i) => i);
    const peso = (c: number) => (FILEIRAS - 1 - Math.floor(c / COLUNAS)) * 1.2 + aleatorio() * 2.6;
    const pesos = casas.map(peso);
    const ordem = [...casas].sort((a, b) => pesos[b] - pesos[a]);
    const saidas = new Array<number>(TURMA).fill(0);
    let t = PRIMEIRA_SAIDA_MS;
    for (const c of ordem) {
      saidas[c] = t;
      t += 750 + Math.floor(aleatorio() * 250);
    }
    return { bicho, opcoes, saidas };
  },
  duracao: () => MULTIDAO_MS + 1000,
  memoria: () => ({ mostrou: false }),
  iniciar({ mem, agendar, avisar, revelar }) {
    agendar(PRIMEIRA_SAIDA_MS, () => {
      mem.mostrou = true;
      avisar();
      agendar(MULTIDAO_MS + 1000 - PRIMEIRA_SAIDA_MS, revelar);
    });
  },
  vista({ dados, mem, fase }) {
    if (fase === 'revelando') return { dados, resposta: dados.bicho };
    return { dados: mem.mostrou ? dados : { ...dados, bicho: -1 }, resposta: null };
  },
  avaliar({ dados, mem, corpo, cabe }) {
    const { bicho, t } = corpo;
    // escolhe-se depois de o primeiro coelho sair, no instante que o servidor viu (com a rede da pessoa)
    if (!mem.mostrou || !inteiro(bicho) || !dados.opcoes.includes(bicho) || !numero(t) || t < PRIMEIRA_SAIDA_MS || t > MULTIDAO_MS || !cabe(t)) {
      return invalido();
    }
    if (bicho !== dados.bicho) return { motivo: 'errou', valor: null, chave: [] };
    const ms = Math.round(t);
    return { motivo: null, valor: ms, chave: [ms] };
  },
  robo(dados, aleatorio, passouMs): Resultado {
    // espera de três a sete coelhos saírem; às vezes arrisca cedo demais e erra
    const ordem = [...dados.saidas].sort((a, b) => a - b);
    const k = 2 + Math.floor(aleatorio() * 5);
    if (k <= 2 && aleatorio() < 0.5) return { motivo: 'errou', valor: null, chave: [] };
    if (aleatorio() < 0.08) return { motivo: 'errou', valor: null, chave: [] };
    const ms = Math.round(Math.max(PRIMEIRA_SAIDA_MS + 300, Math.min(passouMs, ordem[k] + 500 + aleatorio() * 600)));
    return { motivo: null, valor: ms, chave: [ms] };
  },
});
