/**
 * O VIGIA DE PICOTE da supressão de ruído (15/10/2026, pedido dele).
 *
 * Um amigo disse que a voz dele estava "robotizada"; no Discord, ficou normal. A suspeita mais forte é nossa: a
 * supressão de ruído roda no processador de quem fala, e quando ela atrasa (um jogo aberto, o computador carregado), a
 * ponte (web/public/ruido/ponte.worklet.js) põe um bloco de SILÊNCIO no lugar do que faltou — a voz sai picotada, e
 * isso soa robótico. O Syden já contava essas faltas, mas não fazia nada com a conta: ela só ficava à vista de um
 * teste. Era uma falha silenciosa.
 *
 * Agora, quando o atraso passa do limite, vira uma linha no DIÁRIO DE SAÚDE do painel, com o motor e o custo por
 * quadro. Nada muda na tela de quem fala (decisão dele: primeiro saber; o aviso para a pessoa é outra conversa), e a
 * supressão não é desligada sozinha ("não quero iludir o usuário": sem reserva).
 *
 * - No app (DPDFNet), a medida chega a cada ~5 s com as FALTAS (blocos de 128 amostras, ~3 ms cada). Mais de 20 em
 *   5 s é picote que se ouve.
 * - No site (GTCRN), o modelo roda dentro da linha de áudio do navegador e não há faltas para contar: quando ele
 *   atrasa, quem picota é o próprio navegador. O sinal é o CUSTO: acima de 80% do tempo do quadro (16 ms), ele já não
 *   tem folga.
 * - A primeira medida não conta (o começo sempre tem umas faltas, enquanto a folga se forma), e no máximo um relato a
 *   cada 10 minutos, para não encher o diário.
 */
export interface MedidaDoRuido {
  motor: 'dpdfnet' | 'gtcrn';
  msPorQuadro: number;
  quadroMs: number;
  faltas?: number;
}

export const LIMITE_DE_FALTAS = 20;
export const LIMITE_DO_CUSTO = 0.8;
const INTERVALO_MS = 10 * 60_000;

const NOMES = { dpdfnet: 'DPDFNet', gtcrn: 'GTCRN' } as const;

export function criarVigiaDePicote(relatar: (mensagem: string) => void, agora: () => number = () => Date.now()) {
  let medidas = 0;
  let ultimoRelato = -Infinity;
  return (m: MedidaDoRuido) => {
    medidas++;
    if (medidas === 1) return;
    const faltas = m.faltas ?? 0;
    const lento = m.msPorQuadro > m.quadroMs * LIMITE_DO_CUSTO;
    if (faltas <= LIMITE_DE_FALTAS && !lento) return;
    if (agora() - ultimoRelato < INTERVALO_MS) return;
    ultimoRelato = agora();
    const custo = `${m.msPorQuadro.toFixed(1)} ms por quadro de ${m.quadroMs} ms`;
    relatar(
      faltas > LIMITE_DE_FALTAS
        ? `Voz picotando: ${faltas} faltas em ~5 s (${NOMES[m.motor]}, ${custo}). O computador não deu conta da supressão.`
        : `Supressão no limite: ${NOMES[m.motor]} a ${custo}. Sem folga, a voz pode picotar.`,
    );
  };
}
