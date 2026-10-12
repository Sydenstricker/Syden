// OS PROBLEMAS DE XADREZ DO MINI-GAME, tirados da base aberta do Lichess (database.lichess.org, licença CC0:
// pode copiar, servir e modificar sem pedir nem creditar — creditamos mesmo assim, na tela do jogo).
//
// A base inteira tem ~300 MB compactada e milhões de problemas; o Syden precisa de algumas centenas. Por
// isso o script lê o arquivo EM FLUXO, descompacta no caminho (zstd, que o Node já sabe) e corta a descarga
// assim que as faixas de dificuldade estão cheias. O navegador de quem joga nunca fala com o Lichess: a
// lista sai daqui para server/assets/ e é servida pelo nosso servidor.
//
// O filtro é de qualidade, não de sorte: problema muito jogado (a nota do Lichess já foi testada por muita
// gente), bem avaliado, curto (de 1 a 3 lances de quem resolve, que é o que cabe num minuto conversando),
// e sem promoção a peça que não seja dama (o tabuleiro do Syden promove sempre a dama).
//
//   node server/scripts/problemas-de-xadrez.mjs
import { writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { createZstdDecompress } from 'node:zlib';

const ENDERECO = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const SAIDA = new URL('../assets/problemas-de-xadrez.json', import.meta.url);
const FAIXAS = [
  [800, 1200],
  [1200, 1500],
  [1500, 1800],
  [1800, 2100],
];
const POR_FAIXA = 250;

const faixas = FAIXAS.map(() => []);
const cheias = () => faixas.every((f) => f.length >= POR_FAIXA);

/**
 * O ARQUIVO É DO pzstd: cada bloco comprimido vem depois de um quadro "pulável" (magia 0x184D2A50, 4 bytes
 * de tamanho e 4 com o tamanho do bloco seguinte). O descompressor do Node não pula esses quadros — ele
 * para calado, sem erro e sem dado nenhum. Então eles saem aqui, e só os blocos de verdade seguem.
 */
async function* semQuadrosPulaveis(entrada) {
  let guardado = Buffer.alloc(0);
  let faltaPassar = 0;
  for await (const pedaco of entrada) {
    guardado = Buffer.concat([guardado, pedaco]);
    for (;;) {
      if (faltaPassar > 0) {
        const n = Math.min(faltaPassar, guardado.length);
        if (n === 0) break;
        yield guardado.subarray(0, n);
        guardado = guardado.subarray(n);
        faltaPassar -= n;
        continue;
      }
      if (guardado.length < 12) break;
      if ((guardado.readUInt32LE(0) & 0xfffffff0) !== 0x184d2a50) throw new Error('esperava um quadro pulável do pzstd');
      // Quadro pulável de 4 bytes: o tamanho do bloco comprimido que vem logo depois.
      const tamanhoDoQuadro = guardado.readUInt32LE(4);
      faltaPassar = guardado.readUInt32LE(8);
      guardado = guardado.subarray(8 + tamanhoDoQuadro);
    }
  }
}

const controle = new AbortController();
const resposta = await fetch(ENDERECO, { signal: controle.signal });
if (!resposta.ok) throw new Error(`O Lichess respondeu ${resposta.status}`);
const fluxo = Readable.from(semQuadrosPulaveis(Readable.fromWeb(resposta.body))).pipe(createZstdDecompress());
fluxo.on('error', () => {}); // o corte da descarga, lá embaixo, chega aqui como erro — é esperado

let resto = '';
let lidas = 0;
try {
  for await (const pedaco of fluxo) {
    const linhas = (resto + pedaco.toString('utf8')).split('\n');
    resto = linhas.pop();
    for (const linha of linhas) {
      lidas++;
      // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
      const [id, fen, lances, nota, desvio, popularidade, partidas] = linha.split(',');
      if (id === 'PuzzleId') continue;
      const lista = lances.split(' ');
      const meus = lista.filter((_, i) => i % 2 === 1);
      if (lista.length < 2 || meus.length > 3) continue;
      if (meus.some((l) => l.length === 5 && l[4] !== 'q')) continue;
      if (Number(popularidade) < 90 || Number(partidas) < 2000 || Number(desvio) > 80) continue;
      const i = FAIXAS.findIndex(([de, ate]) => Number(nota) >= de && Number(nota) < ate);
      if (i < 0 || faixas[i].length >= POR_FAIXA) continue;
      faixas[i].push([id, fen, lances, Number(nota)]);
    }
    if (cheias()) break;
  }
} finally {
  controle.abort();
}

const problemas = faixas.flat();
writeFileSync(SAIDA, JSON.stringify(problemas));
console.log(`${problemas.length} problemas (${faixas.map((f) => f.length).join(' + ')}), de ${lidas} linhas lidas.`);
// A descarga cortada ainda estrebucha no fundo; o arquivo já está escrito.
process.exit(0);
