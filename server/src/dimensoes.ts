/**
 * QUANTOS PIXELS TEM ESTA IMAGEM — lido do cabeçalho, sem decodificá-la.
 *
 * ===================================================================================================
 * A BOMBA DE DESCOMPRESSÃO, que o limite de tamanho NÃO pega.
 *
 * O limite de 4 MB é de arquivo COMPRIMIDO. Uma imagem de uma cor só comprime a quase nada: um PNG
 * de 20.000 por 20.000 pixels cabe em poucos kilobytes e passa folgado. Só que, para desenhá-la, o
 * navegador precisa de quatro bytes por pixel — 1,6 GB de memória — e isso acontece no computador de
 * CADA pessoa que abrir a comunidade, não no servidor.
 *
 * O sintoma não seria "a imagem não carregou". Seria a aba travando ou morrendo para todo mundo, sem
 * erro em lugar nenhum e sem ninguém ligar uma coisa à outra. É por isso que a conferência é de
 * PIXELS e não de bytes: são duas grandezas diferentes, e só uma delas estava sendo olhada.
 * ===================================================================================================
 *
 * A leitura é do CABEÇALHO: os primeiros bytes de cada formato dizem o tamanho antes de qualquer
 * decodificação. Formato que este arquivo não souber ler devolve `null`, e quem chama decide — aqui
 * a decisão é deixar passar, porque recusar o que não se entende transformaria um formato novo numa
 * recusa misteriosa.
 */

export interface Dimensoes {
  largura: number;
  altura: number;
}

/** GIF: largura e altura em 16 bits, little-endian, logo depois de "GIF87a"/"GIF89a". */
function doGif(b: Buffer): Dimensoes | null {
  if (b.length < 10) return null;
  return { largura: b.readUInt16LE(6), altura: b.readUInt16LE(8) };
}

/** PNG: o bloco IHDR é sempre o primeiro, e os dois números vêm em 32 bits big-endian. */
function doPng(b: Buffer): Dimensoes | null {
  if (b.length < 24 || b.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
}

/**
 * WEBP tem três variantes, e cada uma guarda o tamanho num lugar: VP8 (com perda), VP8L (sem perda)
 * e VP8X (o estendido, que é o dos animados). Ler só uma delas deixaria as outras duas passando sem
 * conferência nenhuma — e a animada é justamente a que mais pesa.
 */
function doWebp(b: Buffer): Dimensoes | null {
  if (b.length < 30) return null;
  const tipo = b.subarray(12, 16).toString('latin1');
  if (tipo === 'VP8 ') return { largura: b.readUInt16LE(26) & 0x3fff, altura: b.readUInt16LE(28) & 0x3fff };
  if (tipo === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { largura: (bits & 0x3fff) + 1, altura: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (tipo === 'VP8X') {
    const ler24 = (em: number) => b[em] | (b[em + 1] << 8) | (b[em + 2] << 16);
    return { largura: ler24(24) + 1, altura: ler24(27) + 1 };
  }
  return null;
}

/**
 * JPEG: é preciso andar pelos marcadores até achar um SOF, porque o tamanho não mora num lugar fixo.
 * Os SOF de 0xC4, 0xC8 e 0xCC NÃO são de quadro (são tabelas e extensões) e precisam ser pulados —
 * tratá-los como quadro leria dois números quaisquer como se fossem largura e altura.
 */
function doJpeg(b: Buffer): Dimensoes | null {
  let em = 2;
  while (em + 9 < b.length) {
    if (b[em] !== 0xff) {
      em++;
      continue;
    }
    const marcador = b[em + 1];
    if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
      return { largura: b.readUInt16BE(em + 7), altura: b.readUInt16BE(em + 5) };
    }
    em += 2 + b.readUInt16BE(em + 2);
  }
  return null;
}

/** As dimensões, ou `null` quando o formato não é conhecido ou o cabeçalho está truncado. */
export function dimensoesDaImagem(mime: string, dados: Buffer): Dimensoes | null {
  const lida =
    mime === 'image/gif'
      ? doGif(dados)
      : mime === 'image/png'
        ? doPng(dados)
        : mime === 'image/webp'
          ? doWebp(dados)
          : mime === 'image/jpeg'
            ? doJpeg(dados)
            : null;
  // Zero ou negativo não é tamanho: é cabeçalho quebrado, e deixá-lo passar como "medido" faria a
  // conferência de cima aprovar qualquer coisa.
  if (!lida || lida.largura <= 0 || lida.altura <= 0) return null;
  return lida;
}

/**
 * O TETO É DE ÁREA, e não de lado. O que custa memória é largura × altura: uma faixa de 8000 por 200
 * é leve, e um quadrado de 3000 por 3000 é quatro vezes mais pesado que ela. Limitar o lado maior
 * recusaria a faixa e deixaria passar o quadrado.
 *
 * 40 megapixels dá folga para qualquer foto de câmera (uma de 48 MP é de celular topo de linha) e
 * barra a imagem que só existe para pesar: a 4 bytes por pixel, são 160 MB de memória para desenhar.
 */
export const PIXELS_DEMAIS = 40_000_000;

/** `null` quando serve; uma frase em português quando não serve. */
export function imagemGrandeDemais(mime: string, dados: Buffer): string | null {
  const medida = dimensoesDaImagem(mime, dados);
  if (!medida) return null; // formato que não sabemos medir segue o caminho de sempre
  if (medida.largura * medida.altura <= PIXELS_DEMAIS) return null;
  return 'Essa imagem tem pixels demais. Use uma menor.';
}
