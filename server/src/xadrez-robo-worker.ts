/**
 * O WORKER DO ROBÔ DE XADREZ (20/11/2026): roda o motor (xadrez-motor.ts) numa thread à parte, para a busca de até ~2 s nunca
 * segurar o servidor. Recebe { id, fen, historico, nivel, semente } e devolve { id, resultado }. Quem fala com ele é
 * xadrez-robo.ts (a fila, o tempo máximo e a reserva).
 */
import { parentPort } from 'node:worker_threads';
import { lanceDoMotor, type NivelDoMotor } from './xadrez-motor.js';

parentPort?.on('message', (msg: { id: number; fen: string; historico: string[]; nivel: NivelDoMotor; semente: number }) => {
  try {
    parentPort!.postMessage({ id: msg.id, resultado: lanceDoMotor(msg.fen, msg.nivel, msg.historico, msg.semente) });
  } catch (e) {
    parentPort!.postMessage({ id: msg.id, erro: e instanceof Error ? e.message : String(e) });
  }
});
