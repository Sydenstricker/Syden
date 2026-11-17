/**
 * A TRANSMISSÃO PERSONALIZADA (16/11/2026, sugestão de quem usa e decisão dele: "é uma forma manual de corrigir eventual leitura
 * equivocada do Syden"). É a exceção, escolhida por ele, à regra de 11/10/2026 ("o Syden decide, quem usa não administra"):
 * Padrão e Fluido continuam decidindo sozinhos, e o Personalizado é para quando a decisão errar. O caso que a motivou: a turma
 * transmitindo a gravação do Mundial de LoL, em que o Padrão encolhia a imagem para segurar os quadros de um vídeo.
 *
 * Quem transmite escolhe a resolução (HD 720p, Full HD 1080p ou a Nativa da tela) e os quadros (15, 30 ou 60), e DURANTE A
 * TRANSMISSÃO O SYDEN NÃO MUDA NADA (nem os degraus de tamanho, nem o leve, nem a nitidez da tela parada, nem a queda do
 * Fluido para 30). Sob aperto, o navegador ainda tem de sacrificar alguma coisa; o desempate segue a escolha: a 15 quadros
 * (coisa calma: slide, vídeo, conversa) ele segura a nitidez, a 60 (jogo) segura os quadros, a 30 equilibra os dois.
 */

export type ResolucaoDaTela = '720' | '1080' | 'nativa';
export type QuadrosDaTela = 15 | 30 | 60;

export interface PresetPersonalizado {
  largura: number;
  altura: number;
  quadros: QuadrosDaTela;
  /** em bits por segundo */
  taxa: number;
  degradacao: RTCDegradationPreference;
  conteudo: 'motion' | 'detail';
  /** a versão menor (960 × 540) para quem tem internet fraca, ou null quando a escolhida já é pequena */
  menor: { largura: number; altura: number; quadros: number; taxa: number } | null;
}

/** A taxa de 1080p em cada quadro: a do Padrão a 30 (5 Mbps) e a do Fluido a 60 (8 Mbps). */
const TAXA_1080: Record<QuadrosDaTela, number> = { 15: 3_000_000, 30: 5_000_000, 60: 8_000_000 };
const TAXA_720: Record<QuadrosDaTela, number> = { 15: 1_500_000, 30: 2_500_000, 60: 4_000_000 };
/** O teto da Nativa: um monitor 4K a 60 não passa disto (o envio de quem transmite também é de alguém). */
const TETO_DA_NATIVA = 16_000_000;

/**
 * O tamanho da tela em pixels de verdade (o CSS conta pixels lógicos: num Windows a 150%, 1920 lógicos são 2880). Até 4K, e
 * sempre par (o codificador pede).
 */
export function tamanhoNativo(larguraCss: number, alturaCss: number, densidade: number): { largura: number; altura: number } {
  let largura = Math.round(larguraCss * (densidade || 1));
  let altura = Math.round(alturaCss * (densidade || 1));
  const reducao = Math.max(1, largura / 3840, altura / 2160);
  largura = Math.round(largura / reducao / 2) * 2;
  altura = Math.round(altura / reducao / 2) * 2;
  return { largura, altura };
}

export function presetPersonalizado(resolucao: ResolucaoDaTela, quadros: QuadrosDaTela, nativo: { largura: number; altura: number }): PresetPersonalizado {
  let largura = 1920;
  let altura = 1080;
  let taxa = TAXA_1080[quadros];
  if (resolucao === '720') {
    largura = 1280;
    altura = 720;
    taxa = TAXA_720[quadros];
  } else if (resolucao === 'nativa') {
    largura = nativo.largura;
    altura = nativo.altura;
    // os codificadores ganham com o tamanho: o dobro dos pixels não pede o dobro da taxa (expoente 0,75)
    const pixels = (largura * altura) / (1920 * 1080);
    taxa = Math.min(TETO_DA_NATIVA, Math.round(TAXA_1080[quadros] * Math.pow(Math.max(pixels, 0.25), 0.75)));
  }
  const degradacao: RTCDegradationPreference = quadros === 15 ? 'maintain-resolution' : quadros === 60 ? 'maintain-framerate' : 'balanced';
  return {
    largura,
    altura,
    quadros,
    taxa,
    degradacao,
    conteudo: quadros === 15 ? 'detail' : 'motion',
    // a versão menor só existe quando a escolhida é bem maior que ela; e nunca com mais quadros que a escolhida
    menor: altura > 720 ? { largura: 960, altura: 540, quadros: Math.min(30, quadros), taxa: quadros === 15 ? 1_000_000 : 1_800_000 } : null,
  };
}
