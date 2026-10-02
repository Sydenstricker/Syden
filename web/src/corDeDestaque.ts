// A cor de destaque do Syden, escolhida por quem usa.
//
// ===================================================================================================
// A ESCOLHA É DA PESSOA; A LEGIBILIDADE É NOSSA.
//
// O `--accent` aparece 63 vezes na folha de estilo, e em quase todas elas há TEXTO BRANCO por cima —
// e o branco está cravado em cada uma dessas regras, não numa variável. Um amarelo escolhido com
// gosto deixaria "Mandar na conversa" ilegível em dezenas de lugares de uma vez.
//
// Havia dois caminhos:
//
//   1. trocar o branco por uma variável e calcular, para cada cor, se o texto fica branco ou preto;
//   2. ACEITAR A MATIZ QUE A PESSOA ESCOLHER E ESCURECÊ-LA ATÉ O BRANCO CABER.
//
// O segundo é o daqui, e não é preguiça: o primeiro faria o Syden mudar de cara duas vezes — a cor E
// a cor do texto —, e botão com letra preta num app escuro parece outro produto. Escurecendo, o rosa
// continua rosa, o verde continua verde, e nada na tela deixa de ser legível.
//
// O limite é 4,5:1, que é o mínimo da WCAG AA para texto normal. Não é enfeite de acessibilidade: é
// o número abaixo do qual gente com visão comum já começa a errar a leitura em tela de celular.
// ===================================================================================================

/** O azul do Syden. É o que vale quando ninguém escolheu nada. */
export const COR_PADRAO = '#5865f2';

/**
 * 4,5:1 é o mínimo da WCAG AA. O ALVO É UM FIO ACIMA DISSO de propósito: parando exatamente na
 * linha, o arredondamento decide de que lado a cor cai, e três matizes saíam com 4,49 — reprovadas
 * por um centésimo. A margem custa um tom quase imperceptível e tira o acaso da conta.
 */
const MINIMO_DE_CONTRASTE = 4.6;

export function corValida(valor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(valor);
}

function paraRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function paraHex([r, g, b]: [number, number, number]): string {
  const dois = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${dois(r)}${dois(g)}${dois(b)}`;
}

/** Luminância relativa, como a WCAG a define — não é a média dos canais. */
function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Quantas vezes o branco é mais claro que esta cor. 1 = igual, 21 = branco contra preto. */
export function contrasteComBranco(hex: string): number {
  return 1.05 / (luminancia(paraRgb(hex)) + 0.05);
}

const escurecer = (rgb: [number, number, number], quanto: number): [number, number, number] =>
  rgb.map((c) => c * (1 - quanto)) as [number, number, number];

/**
 * A cor que de fato vai para a tela: a escolhida, escurecida só o quanto for preciso para o texto
 * branco caber em cima dela.
 *
 * Desce de 4% em 4%, e não de uma vez, para a cor mudar o mínimo necessário — quem escolheu um
 * amarelo-ouro recebe um mostarda, não um marrom.
 */
export function corLegivel(hex: string): string {
  if (!corValida(hex)) return COR_PADRAO;
  let rgb = paraRgb(hex);
  for (let i = 0; i < 25 && 1.05 / (luminancia(rgb) + 0.05) < MINIMO_DE_CONTRASTE; i += 1) {
    rgb = escurecer(rgb, 0.04);
  }
  return paraHex(rgb);
}

/** O tom de quando o mouse está em cima: o mesmo, um pouco mais escuro. */
export function corDeHover(hex: string): string {
  return paraHex(escurecer(paraRgb(hex), 0.18));
}

/**
 * Põe a cor na tela.
 *
 * Escreve nas MESMAS duas variáveis que a folha de estilo já usava, em vez de criar outras: com isso
 * as 63 regras continuam como estão, e tirar a escolha é só apagar as duas — a folha volta a mandar
 * sozinha, sem nenhum código precisar saber o que era o padrão.
 */
export function aplicarCorDeDestaque(hex: string | null) {
  const raiz = document.documentElement;
  if (!hex || !corValida(hex)) {
    raiz.style.removeProperty('--accent');
    raiz.style.removeProperty('--accent-hover');
    return;
  }
  const cor = corLegivel(hex);
  raiz.style.setProperty('--accent', cor);
  raiz.style.setProperty('--accent-hover', corDeHover(cor));
}
