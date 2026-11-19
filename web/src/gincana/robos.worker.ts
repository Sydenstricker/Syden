import { correrRobo } from './piloto';
import { PERCURSOS } from './sim';

/**
 * Um COELHO-ROBÔ do Solo da Gincana (19/11/2026), planejado fora da página: a busca do piloto leva segundos, e na página
 * travaria a corrida. Recebe o percurso e a semente; manda os comandos de cada trecho assim que ficam prontos, e "fim".
 */
self.onmessage = (ev: MessageEvent<{ percurso: string; semente: number; erro: number }>) => {
  const { percurso, semente, erro } = ev.data;
  const p = PERCURSOS[percurso];
  if (!p) {
    self.postMessage({ fim: true });
    return;
  }
  correrRobo(p, semente, (comandos) => self.postMessage({ comandos }), erro);
  self.postMessage({ fim: true });
};
