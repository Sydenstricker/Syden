// Letra com marcação de tempo, no formato LRC — o mesmo que os programas de karaokê usam há décadas.
// Cada linha começa com o instante em que ela deve ser cantada:
//
//   [00:12.50] Primeira linha
//   [00:16.20] Segunda linha
//
// Uma linha pode trazer várias marcas (o mesmo refrão em vários momentos), e o arquivo às vezes começa
// com informações soltas ([ar:...], [ti:...]) que não são letra nenhuma e ficam de fora.

export interface LinhaDaLetra {
  /** Em que segundo do áudio esta linha entra. */
  em: number;
  texto: string;
}

const MARCA = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
/** Cabeçalhos do formato ([ti:...], [ar:...]): não são letra. */
const CABECALHO = /^(ti|ar|al|au|by|offset|re|ve|length|id|tool):/i;

/** Lê um arquivo .lrc. Devolve as linhas em ordem; texto sem marca nenhuma vira uma lista vazia. */
export function lerLetra(bruto: string): LinhaDaLetra[] {
  const linhas: LinhaDaLetra[] = [];
  for (const crua of bruto.split(/\r?\n/)) {
    MARCA.lastIndex = 0;
    const marcas: number[] = [];
    let encontrada: RegExpExecArray | null;
    let fimDasMarcas = 0;
    while ((encontrada = MARCA.exec(crua)) !== null) {
      // Só conta como marca o que está no começo da linha, sem texto antes.
      if (encontrada.index !== fimDasMarcas) break;
      fimDasMarcas = encontrada.index + encontrada[0].length;
      const centesimos = encontrada[3] ? Number(encontrada[3].padEnd(3, '0')) / 1000 : 0;
      marcas.push(Number(encontrada[1]) * 60 + Number(encontrada[2]) + centesimos);
    }
    const texto = crua.slice(fimDasMarcas).trim();
    if (marcas.length === 0) continue;
    if (CABECALHO.test(texto)) continue;
    for (const em of marcas) linhas.push({ em, texto });
  }
  return linhas.sort((a, b) => a.em - b.em);
}

/**
 * Qual linha está sendo cantada neste instante. Devolve -1 antes da primeira — é o intervalinho de
 * introdução, em que a tela mostra a letra esperando começar.
 */
export function linhaAtual(linhas: LinhaDaLetra[], segundos: number): number {
  let atual = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].em <= segundos) atual = i;
    else break;
  }
  return atual;
}

/** Texto simples, sem marca de tempo nenhuma: ainda serve para acompanhar, só não acende sozinho. */
export function letraSemTempo(bruto: string): string[] {
  return bruto
    .split(/\r?\n/)
    .map((l) => l.replace(MARCA, '').trim())
    // Fora as marcas de tempo, o arquivo ainda traz [ti:...] e [ar:...] ocupando a linha inteira.
    .filter((l) => l.length > 0 && !CABECALHO.test(l) && !/^\[[a-z]+:.*\]$/i.test(l));
}

/** "3:05" a partir de segundos. */
export function relogio(segundos: number): string {
  const inteiros = Math.max(0, Math.floor(segundos));
  return `${Math.floor(inteiros / 60)}:${String(inteiros % 60).padStart(2, '0')}`;
}
