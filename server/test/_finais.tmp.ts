import { Chess } from 'chess.js';
import { lanceDoMotor } from '../src/xadrez-motor.ts';
const nomeDe = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
const F: Record<string,string> = {
  dama: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
  torre: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
  bispos: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1',
  peao: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
};
for (const [id, fen] of Object.entries(F)) {
  for (const branco of ['dificil','mestre'] as const) {
  const j = new Chess(fen);
  let k = 0;
  const t0 = performance.now();
  while (!j.isGameOver() && k < 200) {
    const hist = j.history({verbose:true}).map((m:any)=>m.before);
    const l = lanceDoMotor(j.fen(), j.turn()==='w'? branco : 'dificil', hist, k+1).lance!;
    j.move({ from: nomeDe(l.de), to: nomeDe(l.para), promotion: l.promocao ?? 'q' });
    k++;
  }
  console.log(id, branco, 'mate', j.isCheckmate(), 'empate', j.isDraw(), 'lances brancos', Math.ceil(k/2), ((performance.now()-t0)/1000).toFixed(1)+'s');
  }
}
