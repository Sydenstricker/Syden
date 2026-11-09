/**
 * A IMAGEM SE MEXE? Decidido pelos BYTES, e não pelo tipo (relato de 09/11/2026: "o GIF fica em loop, até no celular").
 * A marca do avatar animado (`users.avatar_animado`) olhava só se o tipo era GIF, e o avatar por LINK guarda o arquivo como
 * veio: o "copiar endereço da imagem" do GIPHY no Chrome dá um WEBP animado (media.giphy.com/media/v1.…/giphy.webp), que o
 * arquivoDoGiphy não reescreve. Sem a marca, o site o punha num <img> comum, e ele tocava em laço em toda lista e mensagem.
 *
 * - GIF: sempre (era a regra, e um GIF de um quadro parado no canvas é o mesmo desenho).
 * - WEBP: o cabeçalho estendido (VP8X) com o bit de animação.
 * - PNG: o APNG tem o pedaço `acTL` antes do primeiro `IDAT`.
 */
export function imagemAnimada(mime: string, dados: Uint8Array): boolean {
  const b = Buffer.from(dados.buffer, dados.byteOffset, dados.byteLength);
  if (mime === 'image/gif') return true;
  if (mime === 'image/webp') {
    return b.length >= 21 && b.subarray(12, 16).toString('latin1') === 'VP8X' && (b[20] & 0x02) !== 0;
  }
  if (mime === 'image/png') {
    let em = 8;
    while (em + 8 <= b.length) {
      const tamanho = b.readUInt32BE(em);
      const tipo = b.subarray(em + 4, em + 8).toString('latin1');
      if (tipo === 'acTL') return true;
      if (tipo === 'IDAT' || tipo === 'IEND') return false;
      em += 12 + tamanho;
    }
  }
  return false;
}
