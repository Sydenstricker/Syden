// O QR do Pix da página de contribuir (web/site/contribuir.html).
//
// POR QUE UM SCRIPT, e não um gerador de QR da internet: o QR É a chave Pix, e colar a chave num site
// de terceiro para fazer a imagem é entregar a ele o que vai receber o dinheiro — e confiar que a
// imagem devolvida aponta para a mesma chave. Aqui o código é montado na máquina, e a imagem sai em
// SVG fixo: quem visita o site não roda biblioteca nenhuma, nem fala com ninguém.
//
// USE A CHAVE ALEATÓRIA, nunca CPF nem telefone: a chave vai escrita dentro do QR e do "copia e cola",
// e qualquer pessoa que escanear lê qual é.
//
//   node scripts/qr-do-pix.mjs --codigo "00020126..."   (o "Pix copia e cola" do app do banco: o preferido)
//   node scripts/qr-do-pix.mjs --chave 1234abcd-... --cidade "RIO DE JANEIRO"
//
// Escreve web/site/pix.svg e põe o "copia e cola" dentro de web/site/contribuir.html.
//
// O formato é o BR Code do Banco Central (o EMV-QRCPS com o arranjo br.gov.bcb.pix): campos
// "id + tamanho em 2 dígitos + valor", fechados por um CRC16. Sem o campo 54 (valor), quem paga
// digita quanto quer — é o QR estático de doação.
import { readFileSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pares, arg, i, todos) => (arg.startsWith('--') ? [...pares, [arg.slice(2), todos[i + 1]]] : pares), []),
);

const campo = (id, valor) => id + String(valor.length).padStart(2, '0') + valor;

/** CRC16-CCITT (polinômio 0x1021, começo 0xFFFF), o que o BR Code exige no campo 63. */
function crc16(texto) {
  let crc = 0xffff;
  for (const byte of Buffer.from(texto, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Lê "id + tamanho + valor" em sequência. Devolve null se o texto não fecha certinho. */
function campos(texto) {
  const lidos = {};
  for (let i = 0; i < texto.length; ) {
    const id = texto.slice(i, i + 2);
    const tamanho = Number(texto.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || Number.isNaN(tamanho) || i + 4 + tamanho > texto.length) return null;
    lidos[id] = texto.slice(i + 4, i + 4 + tamanho);
    i += 4 + tamanho;
  }
  return lidos;
}

const pareceCpfOuTelefone = (chave) => /^\d{11}$|^\+?\d{12,13}$/.test(chave.replace(/[.\-\s()]/g, ''));

let copiaECola;

if (args.codigo) {
  // O "Pix copia e cola" que o APP DO BANCO gerou (Receber / Cobrar, sem valor). É o caminho preferido:
  // o banco já conferiu a chave e o nome, e aqui só se desenha o mesmo código em SVG. Mas ele é
  // conferido antes, porque o banco também gera tipos que NÃO servem para uma página fixa.
  copiaECola = args.codigo.trim();
  const topo = campos(copiaECola);
  const conta = topo?.['26'] && campos(topo['26']);
  const erro =
    !topo || !copiaECola.endsWith(topo['63'] ?? '-') || crc16(copiaECola.slice(0, -4)) !== topo['63']
      ? 'O código não fecha (o CRC do fim não confere). Copie de novo do app do banco, inteiro.'
      : !conta || conta['00']?.toLowerCase() !== 'br.gov.bcb.pix'
        ? 'Isso não parece um Pix.'
        : conta['25']
          ? 'Este é um Pix DINÂMICO (aponta para um endereço do banco e costuma vencer). Gere um QR de recebimento fixo, sem valor.'
          : !conta['01']
            ? 'O código não traz chave Pix.'
            : pareceCpfOuTelefone(conta['01'])
              ? 'A chave deste código é CPF ou telefone, e ela fica legível no QR. Gere no app com a chave aleatória.'
              : null;
  if (erro) {
    console.error(erro);
    process.exit(1);
  }
  if (topo['54']) console.log(`Atenção: este código tem valor fixo (R$ ${topo['54']}). Para doação, o comum é sem valor.`);
  console.log(`Recebedor no código: ${topo['59']} (${topo['60']})`);
} else {
  const chave = args.chave?.trim();
  if (!chave) {
    console.error('Passe --codigo "..." (o Pix copia e cola do app do banco) ou --chave (a chave ALEATÓRIA).');
    process.exit(1);
  }
  if (pareceCpfOuTelefone(chave)) {
    console.error('Isso parece CPF ou telefone. A chave fica legível dentro do QR: use a chave aleatória.');
    process.exit(1);
  }

  /** O banco pede só letras sem acento no nome e na cidade, em maiúsculas. */
  const limpo = (texto, max) =>
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .toUpperCase()
      .slice(0, max);

  const semCrc =
    campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave)) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('58', 'BR') +
    campo('59', limpo(args.nome ?? 'SYDEN', 25)) +
    campo('60', limpo(args.cidade ?? 'BRASIL', 15)) +
    campo('62', campo('05', '***')) +
    '6304';
  copiaECola = semCrc + crc16(semCrc);
}

// As cores do site: o QR escuro sobre creme lê em qualquer câmera (o contraste é o que conta, não o
// preto puro), e a margem de 4 módulos é a que a norma do QR pede.
const svg = await QRCode.toString(copiaECola, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 4,
  color: { dark: '#14161b', light: '#f5f1e6' },
});

writeFileSync('web/site/pix.svg', svg);

// O "copia e cola" vai escrito na própria página, entre as marcas: é o que o botão copia, e o que
// quem está no computador (sem câmera apontável para a própria tela) seleciona à mão.
const PAGINA = 'web/site/contribuir.html';
const html = readFileSync(PAGINA, 'utf8');
const marcas = /(<!-- pix:inicio[^>]*-->\s*<code class="copia-e-cola" id="copia-e-cola">)[^<]*(<\/code>)/;
if (!marcas.test(html)) {
  console.error(`Não achei as marcas pix:inicio / copia-e-cola em ${PAGINA}.`);
  process.exit(1);
}
writeFileSync(PAGINA, html.replace(marcas, (_, antes, depois) => antes + copiaECola + depois));

console.log(`web/site/pix.svg escrito, e o copia e cola em ${PAGINA}.`);
console.log('Confira ANTES de publicar: escaneie com o app do seu banco e veja se o nome que aparece é o seu.');
console.log(copiaECola);
