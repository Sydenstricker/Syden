/**
 * QUEM DANÇOU EM TERCEIRO? (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica do "decore a ordem do palco"):
 * a cortina abre, os bichos da horta (o coelho, a raposa, o corvo, o sapo, o ouriço e a toupeira) entram um de cada vez, dançam
 * e saem, e a cada um acende mais uma lâmpada em cima do palco. A cortina fecha, uma das lâmpadas ganha o "?", e escolhe-se quem
 * dançou naquela vez. Acertar mais rápido vale mais. Memória, sem reflexo.
 *
 * A PERGUNTA SÓ VAI QUANDO A CORTINA FECHA (como o sinal do saque): sabendo antes qual lâmpada seria perguntada, bastaria
 * decorar um bicho. O resto (quem dança e em que ordem) vai pronto, igual para todos. O tempo da resposta conta da cortina
 * fechada, e o instante dito precisa caber no relógio do servidor.
 */
import { invalido, inteiro, microjogo, numero, type Resultado } from './comum.js';

/** Quantos bichos existem (a tela desenha cada um) e quantos dançam. */
export const TIPOS_DE_BICHO = 6;
export const DANCARINOS = 5;
export const ABERTURA_MS = 600;
export const FECHAR_MS = 700;
export const RESPOSTA_MS = 6000;

export interface DadosDanca {
  /** Os bichos, na ordem em que dançam. */
  ordem: number[];
  /** Quanto cada um fica no palco (todos iguais numa rodada; mais curto, mais difícil). */
  porDancarino: number;
  /** Qual vez é perguntada (0 é o primeiro), ou −1 enquanto a cortina não fechou. */
  pergunta: number;
}

/** Quando a cortina termina de fechar e a pergunta aparece. */
export const fimDaDanca = (d: Pick<DadosDanca, 'porDancarino' | 'ordem'>) => ABERTURA_MS + d.ordem.length * d.porDancarino + FECHAR_MS;

interface Mem {
  perguntou: boolean;
}

export default microjogo<DadosDanca, Mem>({
  id: 'danca',
  gerar(aleatorio) {
    const tipos = Array.from({ length: TIPOS_DE_BICHO }, (_, i) => i);
    for (let i = tipos.length - 1; i > 0; i--) {
      const j = Math.floor(aleatorio() * (i + 1));
      [tipos[i], tipos[j]] = [tipos[j], tipos[i]];
    }
    // a primeira vez é a mais fácil de lembrar: pergunta-se da segunda em diante
    return { ordem: tipos.slice(0, DANCARINOS), porDancarino: 950 + Math.floor(aleatorio() * 4) * 50, pergunta: 1 + Math.floor(aleatorio() * (DANCARINOS - 1)) };
  },
  duracao: (d) => fimDaDanca(d) + RESPOSTA_MS + 1000,
  memoria: () => ({ perguntou: false }),
  iniciar({ dados, mem, agendar, avisar, revelar }) {
    agendar(fimDaDanca(dados), () => {
      mem.perguntou = true;
      avisar();
      agendar(RESPOSTA_MS + 1000, revelar);
    });
  },
  vista({ dados, mem, fase }) {
    if (fase === 'revelando') return { dados, resposta: dados.ordem[dados.pergunta] };
    return { dados: mem.perguntou ? dados : { ...dados, pergunta: -1 }, resposta: null };
  },
  avaliar({ dados, mem, corpo, cabe }) {
    const { bicho, t } = corpo;
    // a resposta vem depois de a pergunta sair, no instante que o servidor viu (com a rede da pessoa)
    if (!mem.perguntou || !inteiro(bicho) || !numero(t) || t < fimDaDanca(dados) || !cabe(t)) return invalido();
    if (bicho !== dados.ordem[dados.pergunta]) return { motivo: 'errou', valor: null, chave: [] };
    const ms = Math.round(t - fimDaDanca(dados));
    return { motivo: null, valor: ms, chave: [ms] };
  },
  robo(_d, aleatorio): Resultado {
    if (aleatorio() < 0.25) return { motivo: 'errou', valor: null, chave: [] };
    const ms = Math.round(900 + aleatorio() * 1800);
    return { motivo: null, valor: ms, chave: [ms] };
  },
});
