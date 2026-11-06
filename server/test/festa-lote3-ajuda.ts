/** A jogada honesta dos microjogos do LOTE 3 (para a partida aleatória de minijogos-festa.test.ts): true se o id é do lote. */
import { TACADA_ENTRE_MS } from '../src/festa/tacada.js';
import { chegadaDoRabanete, type DadosRebater } from '../src/festa/rebater.js';
import { FOGUETE_PRIMEIRA_MS } from '../src/festa/foguete.js';
import { arremesso, type DadosNabo } from '../src/festa/nabo.js';
import { flechada, type DadosFlecha } from '../src/festa/flecha.js';
import { pulo, type DadosBalanco } from '../src/festa/balanco.js';
import { paradaDaRoda, premioEm, type DadosRoda } from '../src/festa/rodafeira.js';

type Jogo = { publico(quem: number): Record<string, unknown>; acao(quem: number, corpo: Record<string, unknown>): string | null };

export function jogadaHonestaDoLote3(
  micro: string,
  jogo: Jogo,
  quem: number,
  { avancar }: { andar: () => void; avancar: (ms: number) => void },
): boolean {
  const dados = jogo.publico(quem).dados;
  // um aperto ao vivo no instante t (o tempo anda até t + 50: a rede rápida), contando de `ja`
  let ja = 0;
  const apertar = (t: number, corpo: Record<string, unknown> = {}) => {
    avancar(t + 50 - ja);
    ja = t + 50;
    jogo.acao(quem, { tipo: 'acerto', t, ...corpo });
  };
  if (micro === 'tacada') {
    // prende a mira logo, e taca com a força que sair: qualquer tacada vale
    apertar(300);
    avancar(TACADA_ENTRE_MS);
    jogo.acao(quem, { tipo: 'resultado', t: 300 + TACADA_ENTRE_MS + 50 });
  } else if (micro === 'cavalinho') {
    // dez passos no ritmo, um lote a cada dois
    for (let k = 0; k < 10; k += 2) apertar(200 + k * 200 + 200, { p: [[200 + k * 200, 0], [400 + k * 200, 1]] });
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'foguete') {
    apertar(FOGUETE_PRIMEIRA_MS + 10);
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'nabo') {
    // solta na primeira passada pelo campo
    const d = dados as DadosNabo;
    let ms = 0;
    while (arremesso(d.giros[0], ms) === null) ms++;
    apertar(ms + 5);
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'rebater') {
    const d = dados as DadosRebater;
    apertar(chegadaDoRabanete(d.arremessos[0]));
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'flecha') {
    // a primeira hora em que a flecha fura algum balão
    const d = dados as DadosFlecha;
    let t = 0;
    while (!flechada(d, t, []).length) t += 5;
    apertar(t);
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'balanco') {
    const d = dados as DadosBalanco;
    let ms = 0;
    while (pulo(d, 0, ms).valor === 0) ms++;
    apertar(ms + 2);
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'rodafeira') {
    // qualquer aperto dá prêmio; o do 10, se der
    const d = dados as DadosRoda;
    let ms = 0;
    while (ms < 2000 && premioEm(d.giros[0].fatias, paradaDaRoda(d.giros[0].v, ms)) !== 10) ms++;
    apertar(ms);
    jogo.acao(quem, { tipo: 'resultado' });
  } else return false;
  return true;
}
