// O QR do Buy Me a Coffee da página de contribuir (web/site/contribuir.html), ao lado do QR do Pix.
//
// Serve a quem está no computador e prefere pagar no celular, onde a carteira já está configurada. É
// feito aqui pelo mesmo motivo do Pix (ver qr-do-pix.mjs): SVG fixo, nas mesmas cores, sem gerador de
// terceiro nem biblioteca rodando na página. O QR do painel do Buy Me a Coffee (com a xícara no meio)
// destoaria do Pix ao lado.
//
//   node scripts/qr-do-buy-me-a-coffee.mjs
//
// Escreve web/site/buy-me-a-coffee-qr.svg.
import { writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const ENDERECO = 'https://buymeacoffee.com/syden';

const svg = await QRCode.toString(ENDERECO, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 4,
  color: { dark: '#14161b', light: '#f5f1e6' },
});

writeFileSync('web/site/buy-me-a-coffee-qr.svg', svg);
console.log(`web/site/buy-me-a-coffee-qr.svg escrito, apontando para ${ENDERECO}.`);
