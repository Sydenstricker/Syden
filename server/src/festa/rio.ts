/**
 * FUGA DO RIO (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica de nadar apertando sem parar e mergulhar na
 * hora certa): o coelho nada rio acima com um peixe grande atrás, cada vez mais rápido. Cada braçada (apertar) afasta; os
 * troncos descem o rio e só se escapa deles mergulhando, mas mergulhado não se nada. Quem o peixe alcança, sai. Os troncos são os
 * mesmos para todos; cada um na própria tela.
 *
 * O SERVIDOR REFAZ A FUGA: as braçadas vão em pacotes curtos e os mergulhos na hora (ação 'acerto'), cada instante conferido no
 * relógio do servidor, e a distância do peixe é a da conta dele (`fuga`, em ./lote2sim.ts, a mesma da tela). Um programa que
 * aperte por alguém continua possível: mais de 14 braçadas por segundo não contam.
 */
import { numero, microjogo, type Resultado } from './comum.js';
import { BRACADA_MIN_MS, fuga, podeMergulhar, RIO_MS, type DadosRio } from './lote2sim.js';

interface Nado {
  bracadas: number[];
  mergulhos: number[];
}
type Mem = Map<number, Nado>;

/** Num pacote, no máximo isto (um pacote a cada ~150 ms). */
const POR_PACOTE = 12;

/** Quem aguentou até o fim, pela folga; quem foi pego, pelo tempo. O valor é o tempo aguentado (ms). */
const pelaFuga = (n: Nado | undefined, dados: DadosRio): Resultado => {
  if (!n || n.bracadas.length === 0) return { motivo: 'errou', valor: 0, chave: [] };
  const f = fuga(dados, n.bracadas, n.mergulhos);
  const vivo = f.pegoEm ?? RIO_MS;
  return { motivo: null, valor: Math.round(vivo), chave: [-Math.round(vivo), -Math.round(f.folga)] };
};

export default microjogo<DadosRio, Mem>({
  id: 'rio',
  gerar(aleatorio) {
    const troncos: number[] = [];
    let t = 2200 + Math.floor(aleatorio() * 600);
    while (t < RIO_MS - 600) {
      troncos.push(t);
      t += 1900 + Math.floor(aleatorio() * 1300);
    }
    return { troncos };
  },
  duracao: () => RIO_MS + 1500,
  memoria: () => new Map(),
  acerto({ mem, quem, corpo, cabe }) {
    const n = mem.get(quem) ?? { bracadas: [], mergulhos: [] };
    mem.set(quem, n);
    // as braçadas: um pacote de instantes, cada um conferido no relógio (o que já passou da rede da pessoa não conta)
    if (Array.isArray(corpo.b)) {
      for (const t of corpo.b.slice(0, POR_PACOTE)) {
        if (!numero(t) || t < 0 || t > RIO_MS || !cabe(t)) continue;
        const ultima = n.bracadas[n.bracadas.length - 1];
        if (ultima !== undefined && t - ultima < BRACADA_MIN_MS) continue;
        n.bracadas.push(t);
      }
    }
    // o mergulho vai na hora, um de cada vez
    const m = corpo.m;
    if (numero(m) && m >= 0 && m <= RIO_MS && cabe(m) && podeMergulhar(n.mergulhos[n.mergulhos.length - 1], m)) n.mergulhos.push(m);
  },
  avaliar: ({ dados, mem, quem }) => pelaFuga(mem.get(quem), dados),
  *noFim({ dados, mem }) {
    for (const [quem, n] of mem) if (n.bracadas.length) yield [quem, pelaFuga(n, dados)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    // o robô bate de 6 a 9 vezes por segundo e mergulha em quase todos os troncos: a fuga dele é a mesma conta
    const ate = Math.min(passouMs, RIO_MS);
    const ritmo = 1000 / (6 + aleatorio() * 3);
    const mergulhos: number[] = [];
    for (const t of dados.troncos) if (t <= ate && aleatorio() < 0.8) mergulhos.push(t - 150 - Math.floor(aleatorio() * 250));
    const bracadas: number[] = [];
    for (let t = 300; t <= ate; t += ritmo) bracadas.push(Math.round(t));
    const f = fuga(dados, bracadas, mergulhos, ate);
    const vivo = Math.round(f.pegoEm ?? ate);
    return { motivo: null, valor: vivo, chave: [-vivo, -Math.round(f.folga)] };
  },
});
