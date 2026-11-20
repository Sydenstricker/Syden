// Mede os níveis do robô de xadrez (server/src/xadrez-motor.ts): cada nível contra o de baixo, N partidas, alternando as cores,
// de aberturas variadas. Rodar: node --import tsx scripts/xadrez-niveis.mjs [partidas=6] [limite=160]
// Sem mate em `limite` meios-lances, o material decide (2 peões ou mais); senão, empate.
import { Chess } from 'chess.js';
import { lanceDoMotor } from '../src/xadrez-motor.ts';

const PARTIDAS = Number(process.argv[2] ?? 6);
const LIMITE = Number(process.argv[3] ?? 160);
const NIVEIS = ['iniciante', 'facil', 'normal', 'dificil', 'mestre'];
const ABERTURAS = ['e4 e5', 'd4 d5', 'e4 c5', 'c4 e5', 'Nf3 d5', 'e4 e6', 'd4 Nf6', 'e4 c6'];
const VALOR = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const nome = (i) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;

function partida(forte, fraco, forteBrancas, abertura, semente) {
  const jogo = new Chess();
  for (const san of abertura.split(' ')) jogo.move(san);
  const fens = [];
  let s = semente;
  for (let k = 0; k < LIMITE && !jogo.isGameOver(); k++) {
    const nivel = (jogo.turn() === 'w') === forteBrancas ? forte : fraco;
    const r = lanceDoMotor(jogo.fen(), nivel, fens.slice(), (s = (s * 1103515245 + 12345) >>> 0));
    fens.push(jogo.fen());
    jogo.move({ from: nome(r.lance.de), to: nome(r.lance.para), promotion: r.lance.promocao ?? 'q' });
  }
  const corForte = forteBrancas ? 'w' : 'b';
  if (jogo.isCheckmate()) return jogo.turn() === corForte ? 'fraco' : 'forte';
  if (jogo.isGameOver()) return 'empate';
  let m = 0;
  for (const linha of jogo.board()) for (const c of linha) if (c) m += (c.color === corForte ? 1 : -1) * VALOR[c.type];
  return m >= 2 ? 'forte' : m <= -2 ? 'fraco' : 'empate';
}

for (let i = 1; i < NIVEIS.length; i++) {
  const forte = NIVEIS[i], fraco = NIVEIS[i - 1];
  const placar = { forte: 0, fraco: 0, empate: 0 };
  const t0 = Date.now();
  for (let g = 0; g < PARTIDAS; g++) placar[partida(forte, fraco, g % 2 === 0, ABERTURAS[g % ABERTURAS.length], g + 11)]++;
  console.log(`${forte} × ${fraco}: ${placar.forte} vitórias, ${placar.fraco} derrotas, ${placar.empate} empates (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
