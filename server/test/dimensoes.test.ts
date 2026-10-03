/**
 * A BOMBA DE DESCOMPRESSÃO, que o limite de tamanho não pega.
 *
 * "Fiquei um pouco apreensivo de o usuário conseguir subir arquivo para o plano de fundo." A
 * apreensão estava certa, e achou um buraco de verdade — mas não o que parecia.
 *
 * O limite de 4 MB é de arquivo COMPRIMIDO. Uma imagem de uma cor só comprime a quase nada, e um PNG
 * de 20.000 por 20.000 cabe em poucos kilobytes. Para DESENHÁ-LA o navegador precisa de quatro bytes
 * por pixel — 1,6 GB —, e isso acontece na máquina de cada pessoa que abrir a comunidade, não na
 * nossa. O sintoma seria a aba travando para todo mundo, sem erro em lugar nenhum.
 *
 * Os cabeçalhos abaixo são montados à mão, byte a byte, porque é exatamente isso que um atacante
 * faria: o arquivo nem precisa ser uma imagem válida inteira para o navegador começar a alocar.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PIXELS_DEMAIS, dimensoesDaImagem, imagemGrandeDemais } from '../src/dimensoes.js';

/** GIF: "GIF89a" e, em seguida, largura e altura em 16 bits little-endian. */
function gif(largura: number, altura: number): Buffer {
  const b = Buffer.alloc(14);
  b.write('GIF89a', 0, 'latin1');
  b.writeUInt16LE(largura, 6);
  b.writeUInt16LE(altura, 8);
  return b;
}

/** PNG: assinatura, tamanho do bloco, "IHDR" e os dois números em 32 bits big-endian. */
function png(largura: number, altura: number): Buffer {
  const b = Buffer.alloc(32);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(largura, 16);
  b.writeUInt32BE(altura, 20);
  return b;
}

/** WEBP estendido (VP8X): é o dos animados, e guarda os tamanhos menos um, em 24 bits. */
function webpX(largura: number, altura: number): Buffer {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'latin1');
  b.write('WEBP', 8, 'latin1');
  b.write('VP8X', 12, 'latin1');
  const por24 = (valor: number, em: number) => {
    b[em] = valor & 0xff;
    b[em + 1] = (valor >> 8) & 0xff;
    b[em + 2] = (valor >> 16) & 0xff;
  };
  por24(largura - 1, 24);
  por24(altura - 1, 27);
  return b;
}

describe('medir a imagem pelo cabeçalho', () => {
  it('lê GIF, PNG e WEBP', () => {
    assert.deepEqual(dimensoesDaImagem('image/gif', gif(1200, 300)), { largura: 1200, altura: 300 });
    assert.deepEqual(dimensoesDaImagem('image/png', png(1920, 1080)), { largura: 1920, altura: 1080 });
    assert.deepEqual(dimensoesDaImagem('image/webp', webpX(800, 600)), { largura: 800, altura: 600 });
  });

  // Cabeçalho cortado não pode virar "medi e deu zero": zero passaria por qualquer limite.
  it('cabeçalho truncado não vira medida', () => {
    assert.equal(dimensoesDaImagem('image/png', Buffer.alloc(8)), null);
    assert.equal(dimensoesDaImagem('image/gif', Buffer.from('GIF8', 'latin1')), null);
  });

  it('tamanho zero não é tamanho', () => {
    assert.equal(dimensoesDaImagem('image/gif', gif(0, 500)), null);
  });
});

describe('o teto de pixels', () => {
  it('capa, foto de câmera e avatar passam', () => {
    assert.equal(imagemGrandeDemais('image/gif', gif(1200, 300)), null);
    assert.equal(imagemGrandeDemais('image/png', png(6000, 4000)), null, 'uma foto de 24 MP tem de caber');
    assert.equal(imagemGrandeDemais('image/png', png(128, 128)), null);
  });

  // O CASO QUE MOTIVOU TUDO: comprime a quase nada, e derruba a aba de quem abrir.
  it('a bomba é recusada', () => {
    const recusa = imagemGrandeDemais('image/png', png(20_000, 20_000));
    assert.equal(recusa, 'Essa imagem tem pixels demais. Use uma menor.');
  });

  it('a conta é de ÁREA, não do lado maior', () => {
    // Uma faixa muito larga é leve e tem de passar; um quadrado bem menor de lado é mais pesado.
    assert.equal(imagemGrandeDemais('image/png', png(20_000, 200)), null, '4 MP numa faixa: leve');
    assert.notEqual(imagemGrandeDemais('image/png', png(7000, 7000)), null, '49 MP num quadrado: pesado');
  });

  it('a fronteira é fechada em cima do limite', () => {
    const lado = Math.floor(Math.sqrt(PIXELS_DEMAIS));
    assert.equal(imagemGrandeDemais('image/png', png(lado, lado)), null);
    assert.notEqual(imagemGrandeDemais('image/png', png(lado + 200, lado + 200)), null);
  });

  // Formato que não sabemos medir segue o caminho de sempre: recusar o que não se entende
  // transformaria um formato novo numa recusa misteriosa.
  it('o que não dá para medir passa', () => {
    assert.equal(imagemGrandeDemais('image/jpeg', Buffer.from([0xff, 0xd8, 0xff])), null);
    assert.equal(imagemGrandeDemais('image/avif', Buffer.alloc(40)), null);
  });
});
