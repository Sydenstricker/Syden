// As faixas que o app toca: para cada coelho pronto e cada estado, QUADROS_DO_PRONTO quadros (Avatar.tsx) lado a
// lado, ampliados 4× pelo vizinho mais próximo, como o coelho parado de web/public/avatares/ (256 px: nítido em
// qualquer tamanho de avatar).
//
//   node e2e/pixel-art/avatares/folhas.mjs  → web/public/avatares/coelho-<nn>-<estado>.png
//
// O PixelLab devolve 9 quadros (o 1º é o desenho original). A ORDEM escolhe quais entram e em que sequência, para
// o laço fechar sem salto. O PRIMEIRO da ordem é também o que fica parado para quem pediu menos movimento — por
// isso o "ausente" começa num quadro de olho fechado, e não no original de olho aberto.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const DESTINO = path.join(AQUI, '..', '..', '..', 'web', 'public', 'avatares');
const QUADROS = 8;
const AMPLIAR = 4;

const ORDEM = {
  falando: [1, 2, 3, 4, 5, 6, 7, 8],
  ausente: [6, 7, 8, 7, 6, 5, 5, 6],
  ocupado: [1, 2, 3, 4, 5, 6, 7, 8],
};
/** Onde a ordem comum não serve para um coelho (conferido quadro a quadro, nos 16, em 10/10/2026). */
const EXCECOES = {
  // O 1 abre a boca e mostra a língua no fim do cochilo: fica nos quadros de olho fechado.
  'ausente-1': [3, 4, 5, 4, 3, 4, 5, 4],
  // Concentrado, o 15 perde os óculos de estrela do quadro 4 em diante, e o 5 os troca de cor: só os fiéis.
  'ocupado-15': [1, 2, 3, 3, 2, 1, 1, 1],
  'ocupado-5': [1, 9, 8, 9, 1, 9, 8, 1],
};

const faltando = [];
for (let n = 1; n <= 16; n++) {
  for (const estado of Object.keys(ORDEM)) {
    const ordem = EXCECOES[`${estado}-${n}`] ?? ORDEM[estado];
    const arquivos = ordem.map((q) => path.join(AQUI, `${estado}-${n}-${q}.png`));
    if (!arquivos.every((a) => fs.existsSync(a))) {
      faltando.push(`${estado}-${n}`);
      continue;
    }
    const quadros = arquivos.map((a) => PNG.sync.read(fs.readFileSync(a)));
    const [w, h] = [quadros[0].width, quadros[0].height];
    const faixa = new PNG({ width: w * AMPLIAR * QUADROS, height: h * AMPLIAR });
    quadros.forEach((q, i) => {
      for (let y = 0; y < h * AMPLIAR; y++)
        for (let x = 0; x < w * AMPLIAR; x++) {
          const de = ((Math.floor(y / AMPLIAR) * w + Math.floor(x / AMPLIAR)) * 4);
          const para = (y * faixa.width + i * w * AMPLIAR + x) * 4;
          q.data.copy(faixa.data, para, de, de + 4);
        }
    });
    fs.writeFileSync(path.join(DESTINO, `coelho-${String(n).padStart(2, '0')}-${estado}.png`), PNG.sync.write(faixa));
  }
}
console.log(faltando.length ? `faltam: ${faltando.join(' ')}` : 'as 48 faixas prontas');
