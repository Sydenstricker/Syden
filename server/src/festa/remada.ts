/**
 * BALSA A DOIS (lote 5, 05/11/2026; a mecânica da "dupla rema junto uma balsa, pegando o que boia", 2 contra 2, classe C do
 * levantamento em docs/mario-party-3.md): cada dupla desce o SEU riacho (as mesmas cenouras boiando, no mesmo lugar, para todas)
 * numa balsa com um remo de cada lado. A remada da esquerda empurra a balsa para a direita, a da direita para a esquerda, e as
 * duas juntas dão um impulso para a frente. Ganha a dupla que pegar mais cenouras. Na dupla de um só, a pessoa rema dos dois
 * lados.
 *
 * A REDE: a balsa é de dois, então é do SERVIDOR (o passo dele anda a balsa, como a bola do futebol): cada remada é um pedido, e
 * a balsa responde no quadro seguinte, igual nas duas telas. Com 200 ms, a remada aparece uns 250 ms depois; por isso a balsa é
 * pesada (escorrega devagar, como balsa de verdade) e o riacho mostra três segundos à frente. As duplas não se tocam.
 */
import { invalido, microjogo, type Conferencia, type PassoAoVivo, type Resultado, type Turma } from './comum.js';
import { duplas } from './colheita.js';

export const REMADA_MS = 22000;
/** O riacho: as margens em X, e quanto a balsa anda por segundo. */
export const MARGEM_ESQ = 40;
export const MARGEM_DIR = 260;
export const CORRENTEZA = 70;
/** A remada: quanto empurra de lado, e o impulso das duas juntas (dentro de JUNTAS_MS). */
export const EMPURRA = 34;
export const IMPULSO = 40;
export const JUNTAS_MS = 260;
/** Entre uma remada e outra do mesmo lado. */
export const ESPERA_REMADA = 220;
/** Quão perto a balsa passa da cenoura para pegar. */
export const PEGA = 20;

export interface DadosRemada {
  /** As cenouras: [quanto riacho abaixo, x]. */
  cenouras: [number, number][];
  /** Em cada dupla, quem rema na esquerda e na direita (o mesmo, na dupla de um). */
  lados: { esq: number; dir: number }[];
}
interface Balsa {
  x: number;
  vx: number;
  /** Quanto já desceu. */
  y: number;
  impulso: number;
  ultimaEsq: number;
  ultimaDir: number;
  pegas: Set<number>;
  pontos: number;
}
interface Mem {
  balsas: Balsa[];
  /** A última remada de cada pessoa (relógio do servidor), por lado. */
  remou: Map<string, number>;
  agiu: Set<number>;
  ultimoPasso: number;
  pensaEm: Map<number, number>;
}

const PADRAO: Turma = { jogadores: [1, 2], robos: [], equipes: [[1], [2]], equipeDe: (q) => (q === 1 ? 0 : 1) };

/** Uma remada: de lado, e para a frente se a do outro lado veio junto. */
function remar(b: Balsa, lado: 'esq' | 'dir', agora: number) {
  b.vx += lado === 'esq' ? EMPURRA : -EMPURRA;
  if (lado === 'esq') b.ultimaEsq = agora;
  else b.ultimaDir = agora;
  if (Math.abs(b.ultimaEsq - b.ultimaDir) <= JUNTAS_MS) {
    b.impulso = IMPULSO;
    // juntas, o lado se anula: a balsa vai reta
    b.vx *= 0.5;
  }
}

export default microjogo<DadosRemada, Mem>({
  id: 'remada',
  minimo: 2,
  equipes: duplas,
  gerar(aleatorio, turma = PADRAO) {
    const cenouras: [number, number][] = [];
    for (let y = 160; y < (REMADA_MS / 1000) * CORRENTEZA * 1.15; y += 45 + Math.floor(aleatorio() * 40)) {
      cenouras.push([y, Math.round(MARGEM_ESQ + 18 + aleatorio() * (MARGEM_DIR - MARGEM_ESQ - 36))]);
    }
    const lados = (turma.equipes ?? turma.jogadores.map((id) => [id])).map((e) => ({ esq: e[0], dir: e[1] ?? e[0] }));
    return { cenouras, lados };
  },
  duracao: () => REMADA_MS + 1000,
  memoria(dados) {
    return {
      balsas: dados.lados.map(() => ({ x: 150, vx: 0, y: 0, impulso: 0, ultimaEsq: -1e9, ultimaDir: -1e9, pegas: new Set<number>(), pontos: 0 })),
      remou: new Map(),
      agiu: new Set(),
      ultimoPasso: 0,
      pensaEm: new Map(),
    };
  },
  aoVivo: {
    passoMs: 50,
    passo(p: PassoAoVivo<DadosRemada, Mem>) {
      const { dados, mem, passou, agora, turma } = p;
      const dt = Math.min(0.2, Math.max(0, (passou - mem.ultimoPasso) / 1000));
      mem.ultimoPasso = passou;
      dados.lados.forEach((lados, eq) => {
        const b = mem.balsas[eq];
        // os robôs remam para a próxima cenoura (com o tempo de reação de gente)
        for (const lado of ['esq', 'dir'] as const) {
          const id = lados[lado];
          if (!turma.robos.includes(id) || agora < (mem.pensaEm.get(id) ?? 0)) continue;
          const alvo = dados.cenouras.find(([y], i) => y > b.y + 30 && !b.pegas.has(i));
          if (!alvo) continue;
          // onde a balsa vai estar quando chegar lá, pela velocidade de lado
          const chega = b.x + b.vx * Math.min(1.2, (alvo[0] - b.y) / CORRENTEZA);
          const quer = alvo[1] - chega;
          const so = lados.esq === lados.dir;
          if ((lado === 'esq' && quer > 10) || (lado === 'dir' && quer < -10) || (!so && Math.abs(quer) <= 10 && p.aleatorio() < 0.3)) {
            remar(b, lado, agora);
            mem.pensaEm.set(id, agora + 260 + p.aleatorio() * 220);
          } else mem.pensaEm.set(id, agora + 120);
        }
        // a balsa: escorrega de lado com atrito, desce com a correnteza (e o impulso), e bate nas margens
        b.vx *= Math.max(0, 1 - 1.6 * dt);
        b.x += b.vx * dt;
        if (b.x < MARGEM_ESQ + 14) [b.x, b.vx] = [MARGEM_ESQ + 14, Math.abs(b.vx) * 0.3];
        if (b.x > MARGEM_DIR - 14) [b.x, b.vx] = [MARGEM_DIR - 14, -Math.abs(b.vx) * 0.3];
        b.y += (CORRENTEZA + b.impulso) * dt;
        b.impulso = Math.max(0, b.impulso - 60 * dt);
        for (const [i, [y, x]] of dados.cenouras.entries()) {
          if (b.pegas.has(i) || Math.abs(y - b.y) > 10 || Math.abs(x - b.x) > PEGA) continue;
          b.pegas.add(i);
          b.pontos++;
        }
      });
      return {
        b: mem.balsas.map((b) => [Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, Math.round(b.vx), b.pontos, b.ultimaEsq - (agora - passou), b.ultimaDir - (agora - passou)]),
        c: mem.balsas.map((b) => [...b.pegas]),
      };
    },
    receber(c: Conferencia<DadosRemada, Mem>) {
      const { dados, mem, quem, corpo, agora } = c;
      const eq = c.turma?.equipeDe(quem) ?? -1;
      const lados = dados.lados[eq];
      if (!lados) return;
      mem.agiu.add(quem);
      if (corpo.tipo !== 'rema') return;
      // o lado: o dele (na dupla de um, o que a pessoa pediu)
      const lado = lados.esq === lados.dir ? (corpo.lado === 'dir' ? 'dir' : 'esq') : lados.esq === quem ? 'esq' : 'dir';
      const chave = `${quem}:${lado}`;
      if (agora - (mem.remou.get(chave) ?? -Infinity) < ESPERA_REMADA) return;
      mem.remou.set(chave, agora);
      remar(mem.balsas[eq], lado, agora);
    },
  },
  avaliar: () => invalido(),
  *noFim({ dados, mem, turma }) {
    for (const [eq, lados] of dados.lados.entries()) {
      const r: Resultado = { motivo: null, valor: mem.balsas[eq].pontos, chave: [-mem.balsas[eq].pontos] };
      for (const id of new Set([lados.esq, lados.dir])) if (mem.agiu.has(id) || turma?.robos.includes(id)) yield [id, r] as [number, Resultado];
    }
  },
  robo(dados, aleatorio, passouMs) {
    const passaram = dados.cenouras.filter(([y]) => y <= (passouMs / 1000) * CORRENTEZA).length;
    const n = Math.round(passaram * (0.35 + aleatorio() * 0.35));
    return { motivo: null, valor: n, chave: [-n] };
  },
});
