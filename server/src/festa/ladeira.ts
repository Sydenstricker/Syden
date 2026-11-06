/**
 * ABÓBORAS LADEIRA ABAIXO (lote 6, 05/11/2026; do Boulder Ball em docs/mario-party-3.md, só a mecânica do um contra três): o
 * grupo sobe a ladeira da horta, cada um na sua faixa (são três), sozinho, sem parar; o solitário, lá em cima, ergue e solta
 * abóboras numa faixa. A abóbora que pega alguém o derruba ladeira abaixo, tonto. Se alguém do grupo chega lá em cima antes do
 * tempo, o grupo inteiro ganha; se ninguém chega, ganha o solitário.
 *
 * A REDE: a abóbora fica ERGUIDA meio segundo antes de rolar, e sai de bem acima da chegada: é essa folga que paga a internet
 * (o pedido vai ao servidor, é carimbado ali, e o quadro seguinte o leva a todos ainda erguido). Trocar de faixa vai pelo canal
 * ao vivo com o instante da tela de quem trocou, conferido pelo `cabe`. Ninguém diz quem a abóbora pegou: a conta é
 * ./ladeira-sim.ts, a mesma nos dois lados, e o servidor a refaz com as abóboras e as trocas que recebeu.
 */
import { invalido, inteiro, microjogo, numero, type Conferencia, type Resultado } from './comum.js';
import { acaso, elencoDa, memoriaDe, papelDe, prender, umContraTodos, type Elenco } from './lote6-elenco.js';
import { alturaDaAbobora, DESCIDA, ERGUIDA_MS, FAIXAS, faixaInicial, META, PASSO_MS, rolaEm, subir, SUBIDA, type Abobora, type Troca } from './ladeira-sim.js';

export const LADEIRA_MS = 20000;
/** Entre duas abóboras, no mínimo; e nenhuma antes disto. */
export const ENTRE_ABOBORAS = 350;
export const PRIMEIRA_ABOBORA = 600;
/** Quantas abóboras o solitário tem, pelo tamanho do grupo: ele escolhe onde gastar. */
export const aboborasPara = (grupo: number) => (grupo <= 1 ? 20 : grupo === 2 ? 22 : 26);
/** Quanto o robô do grupo vê adiante (ms) e a chance de ele não ver uma abóbora. */
const OLHO_DO_ROBO = 650;
const DISTRAIDO = 0.18;

export interface DadosLadeira extends Elenco {
  semente: number;
}
export interface VistaLadeira extends DadosLadeira {
  aboboras: Abobora[];
  trocas: Record<string, Troca[]>;
}
export type QuadroLadeira = Pick<VistaLadeira, 'aboboras' | 'trocas'>;

interface Mem {
  aboboras: Abobora[];
  trocas: Map<number, Troca[]>;
  mudou: boolean;
  saiuAbobora: boolean;
  proximaDoRobo: number;
  vezDoRobo: number;
}

const subidaDe = (d: DadosLadeira, mem: Mem, id: number, ate: number) =>
  subir(mem.aboboras, mem.trocas.get(id) ?? [], ate, faixaInicial(d.grupo.indexOf(id)), d.grupo.length);

function placar(d: DadosLadeira, mem: Mem) {
  const chegaram = d.grupo.filter((id) => {
    const c = subidaDe(d, mem, id, LADEIRA_MS).chegou;
    return c !== null && c <= LADEIRA_MS;
  }).length;
  return { chegaram, grupoGanha: chegaram > 0 };
}

function resultadoDe(d: DadosLadeira, mem: Mem, quem: number): Resultado {
  const papel = papelDe(d, quem);
  if (!papel) return invalido();
  const { chegaram, grupoGanha } = placar(d, mem);
  const ganhou = papel === 'grupo' ? grupoGanha : !grupoGanha;
  return ganhou ? { motivo: null, valor: chegaram, chave: [0] } : { motivo: 'errou', valor: chegaram, chave: [] };
}

function soltar(d: DadosLadeira, mem: Mem, passou: number, faixa: number) {
  const ultima = mem.aboboras[mem.aboboras.length - 1];
  if (mem.aboboras.length >= aboborasPara(d.grupo.length)) return false;
  if (passou < PRIMEIRA_ABOBORA || passou + ERGUIDA_MS > LADEIRA_MS - 800) return false;
  if (ultima && passou - ultima.l < ENTRE_ABOBORAS) return false;
  mem.aboboras.push({ l: passou, faixa });
  mem.mudou = mem.saiuAbobora = true;
  return true;
}

function trocar(mem: Mem, quem: number, t: number, faixa: number) {
  const meus = mem.trocas.get(quem) ?? [];
  if (meus.length && t < meus[meus.length - 1].t) return;
  meus.push({ t, faixa });
  mem.trocas.set(quem, meus);
  mem.mudou = true;
}

function receber({ dados, mem, quem, corpo, passou, cabe }: Conferencia<DadosLadeira, Mem>) {
  const papel = papelDe(dados, quem);
  const faixa = corpo.faixa;
  if (!inteiro(faixa) || faixa < 0 || faixa >= FAIXAS) return;
  if (papel === 'solo') soltar(dados, mem, passou, faixa);
  else if (papel === 'grupo' && numero(corpo.t)) {
    const t = Math.round(corpo.t);
    if (t >= 0 && cabe(t)) trocar(mem, quem, t, faixa);
  }
}

const quadro = (mem: Mem): QuadroLadeira => ({ aboboras: mem.aboboras, trocas: Object.fromEntries(mem.trocas) });

export default microjogo<DadosLadeira, Mem>({
  id: 'ladeira',
  minimo: 2,
  equipes: umContraTodos,
  gerar: (aleatorio, turma) => ({ ...elencoDa(turma), semente: Math.floor(aleatorio() * 1_000_000) }),
  duracao: () => LADEIRA_MS + 1500,
  memoria: (dados) => prender(dados, { aboboras: [], trocas: new Map(), mudou: false, saiuAbobora: false, proximaDoRobo: 1200, vezDoRobo: 0 }),
  vista: ({ dados, mem }): { dados: VistaLadeira } => ({ dados: { ...dados, ...quadro(mem) } }),
  aoVivo: {
    passoMs: 50,
    receber,
    passo({ dados, mem, passou, avisar }) {
      const robo = (id: number) => dados.robos.includes(id);
      // o robô lá em cima: mira a faixa de quem está mais alto (às vezes, outra), num ritmo variado
      if (robo(dados.solo) && passou >= mem.proximaDoRobo) {
        const k = mem.aboboras.length;
        const subidas = dados.grupo.map((id) => subidaDe(dados, mem, id, passou)).filter((c) => c.chegou === null);
        subidas.sort((a, b) => b.y - a.y);
        const alvo = subidas[0]?.faixa ?? 1;
        // aos pares: a faixa de quem está mais alto, e logo depois a do lado, para onde ele fugiria
        const segunda = k % 2 === 1;
        const lado = alvo === 0 ? 1 : alvo === 2 ? 1 : acaso(dados.semente, k, 6) < 0.5 ? 0 : 2;
        soltar(dados, mem, passou, segunda ? lado : alvo);
        mem.proximaDoRobo = passou + (segunda ? 700 + Math.floor(acaso(dados.semente, k, 8) * 700) : 380);
      }
      // os robôs subindo: desviam da abóbora que vem na faixa deles (quase sempre), para a faixa mais livre
      for (const id of dados.grupo) {
        if (!robo(id)) continue;
        const c = subidaDe(dados, mem, id, passou);
        if (c.chegou !== null || passou < c.tonto) continue;
        const s = Math.floor(passou / PASSO_MS);
        // quanto falta (ms) para a próxima abóbora de cada faixa chegar à altura dele (a erguida conta o tempo de erguida)
        const falta = (faixa: number) => {
          let menor = Infinity;
          mem.aboboras.forEach((a, i) => {
            if (a.faixa !== faixa) return;
            const passos = (alturaDaAbobora(a, s) - c.y) / (DESCIDA + SUBIDA) + Math.max(0, rolaEm(a) - s);
            // a que ele não viu (distraído) não conta, na faixa dele
            if (passos < -1 || (faixa === c.faixa && acaso(dados.semente, id, i) < DISTRAIDO)) return;
            menor = Math.min(menor, Math.max(0, passos) * PASSO_MS);
          });
          return menor;
        };
        if (falta(c.faixa) >= OLHO_DO_ROBO || passou < c.trocaAte) continue;
        // vai, uma faixa de cada vez, para a faixa onde a próxima abóbora demora mais (a do lado, no empate)
        const tempos = [0, 1, 2].map(falta);
        const destino = [0, 1, 2].sort((x, y) => tempos[y] - tempos[x] || Math.abs(x - c.faixa) - Math.abs(y - c.faixa))[0];
        if (destino !== c.faixa) trocar(mem, id, passou, c.faixa + Math.sign(destino - c.faixa));
      }
      if (!mem.mudou) return null;
      mem.mudou = false;
      // a abóbora nova também vai pelo estado, para quem está sem o canal ao vivo; a troca de faixa, só pelo quadro
      if (mem.saiuAbobora) avisar();
      mem.saiuAbobora = false;
      return quadro(mem);
    },
  },
  avaliar({ dados, mem, quem, passou, abaixo }) {
    if (passou < LADEIRA_MS - abaixo) return invalido();
    return resultadoDe(dados, mem, quem);
  },
  *noFim({ dados, mem }) {
    for (const quem of [dados.solo, ...dados.grupo]) {
      if (dados.robos.includes(quem)) continue;
      if (papelDe(dados, quem) === 'solo' ? mem.aboboras.length > 0 : mem.trocas.has(quem)) yield [quem, resultadoDe(dados, mem, quem)] as [number, Resultado];
    }
  },
  robo(dados, aleatorio, passouMs) {
    const mem = memoriaDe<Mem>(dados);
    if (mem && dados.robos.length) return resultadoDe(dados, mem, dados.robos[mem.vezDoRobo++ % dados.robos.length]);
    const chegaram = passouMs >= (META / SUBIDA) * PASSO_MS && aleatorio() < 0.6 ? 1 : 0;
    return chegaram ? { motivo: null, valor: 1, chave: [0] } : { motivo: 'errou', valor: 0, chave: [] };
  },
});
