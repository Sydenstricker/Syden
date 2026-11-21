/**
 * O REVEZAMENTO DO RIACHO (05/11/2026; do Ridiculous Relay do levantamento em docs/mario-party-3.md, só a mecânica): um da
 * turma, sorteado, desce o riacho SOZINHO, os três trechos; os outros descem em REVEZAMENTO, um trecho cada (com dois, um rema o
 * primeiro e o terceiro). Rema-se alternando duas teclas (◀ ▶), como na Torta; a mesma tecla duas vezes não rema. Chega
 * primeiro quem chega primeiro: a equipe divide a mesma chave. Sozinho, o outro barco é o da raposa.
 *
 * NO FORMATO DE SEMPRE (ver ./lote4-turma.ts): os papéis saem depois de JUNTAR_MS; as remadas vão ao vivo como um total
 * ('acerto' `{ n, t }`), e o servidor só aceita as de quem está remando AGORA, no ritmo de quem rema muito, contado desde que o
 * trecho dele começou. A passagem do remo é do servidor: quando o trecho acaba, ele avisa a sala, e o próximo começa a remar
 * quando a tela dele vê (a ida e volta da internet pesa na equipe, uma vez por passagem; ver o relatório do lote).
 *
 * COM AS EQUIPES IMPOSTAS (20/11/2026: o 1 contra 3 do Tabuleiro da turma; ver ./lote4-turma.ts): quem vai sozinho é a equipe de
 * um, e a de três faz o revezamento (quem não entrou a tempo fica fora da vez). Os robôs remam no ritmo de quem joga bem, pelo
 * passo do relógio. Só o 1 contra 3: num 2 contra 2 não há quem vá sozinho, e as equipes ficam como sempre.
 */
import { FOLGA_ACIMA, inteiro, numero, microjogo, type Largada, type Resultado } from './comum.js';
import { avisarComFreio, entrar, impostas, JUNTAR_MS, toquesDoRobo, type Impostas } from './lote4-turma.js';

export const TRECHOS = 3;
export const REMADAS_POR_TRECHO = 30;
export const REVEZA_MS = 30000;
export const RITMO_MAXIMO = 12;
/** A raposa (sozinho): remadas por segundo. */
export const RITMO_DA_RAPOSA = 5.5;
export const RAPOSA = -1;
export const PASSO_MS = 500;

export interface DadosRevezamento {
  sorteio: number;
}

export interface VistaRevezamento {
  etapa: 'juntando' | 'remando' | 'fim';
  /** O barco de quem vai sozinho e o da equipe: as remadas (0 a TRECHOS × REMADAS_POR_TRECHO) e quando chegou (ms) ou null. */
  sozinho: { remadas: number; chegou: number | null; raposa: boolean };
  equipe: { remadas: number; chegou: number | null; tamanho: number; trecho: number; vez: number };
  /** O meu papel: 'sozinho', 'equipe' (com a minha posição nela) ou null. */
  papel: 'sozinho' | 'equipe' | null;
  /** A minha posição na equipe. */
  posicao: number;
  /** É a minha vez de remar (sozinho, sempre; na equipe, no meu trecho). */
  remando: boolean;
}

interface Remador {
  /** O total dito, e quando. */
  n: number;
  t: number;
  /** Onde estava a contagem quando o trecho dele começou (o ritmo conta desde então). */
  n0: number;
  t0: number;
}
interface Mem {
  l: Largada<DadosRevezamento, Mem> | null;
  membros: number[];
  sozinho: number | null;
  equipe: number[];
  remadores: Map<number, Remador>;
  remadasSozinho: number;
  remadasEquipe: number;
  chegouSozinho: number | null;
  chegouEquipe: number | null;
  avisadoEm?: number;
  comeco: number;
  etapa: VistaRevezamento['etapa'];
  /** As equipes impostas (só o 1 contra 3), ou null. */
  im: Impostas | null;
}

/** As impostas que servem aqui: uma equipe de um (quem vai sozinho) e a outra. */
function umContraOs(im: Impostas | null): Impostas | null {
  if (!im) return null;
  return im.equipes.some((e) => e.length === 1) ? im : null;
}
/** Os robôs remam neste ritmo. */
export const RITMO_DO_ROBO_NO_RIACHO = 7;

const TOTAL = TRECHOS * REMADAS_POR_TRECHO;
const trechoDaEquipe = (mem: Mem) => Math.min(TRECHOS - 1, Math.floor(mem.remadasEquipe / REMADAS_POR_TRECHO));
const vezNaEquipe = (mem: Mem) => (mem.equipe.length ? trechoDaEquipe(mem) % mem.equipe.length : -1);

const remadasDaRaposa = (passou: number) => Math.min(TOTAL, Math.floor((RITMO_DA_RAPOSA * Math.max(0, passou - JUNTAR_MS - 600)) / 1000));

function placar(mem: Mem, passou: number) {
  if (mem.sozinho === RAPOSA) {
    const r = remadasDaRaposa(passou);
    mem.remadasSozinho = r;
    if (r >= TOTAL && mem.chegouSozinho === null) mem.chegouSozinho = JUNTAR_MS + 600 + Math.ceil((TOTAL * 1000) / RITMO_DA_RAPOSA);
  }
}

function resultadoDe(mem: Mem, id: number): Resultado {
  const sozinho = id === mem.sozinho;
  const chegou = sozinho ? mem.chegouSozinho : mem.chegouEquipe;
  const remadas = sozinho ? mem.remadasSozinho : mem.remadasEquipe;
  const minhas = mem.remadores.get(id)?.n ?? 0;
  // na equipe, conta o barco (quem não chegou a pegar o remo divide o resultado com quem remou)
  if (remadas === 0) return { motivo: 'errou', valor: 0, chave: [] };
  const chave = chegou !== null ? [0, chegou] : [1, -remadas];
  // sozinho contra a raposa: a chave é da pessoa, e o barco da raposa só decide quem chegou na frente
  if (mem.sozinho === RAPOSA) {
    const ganhou = chegou !== null && (mem.chegouSozinho === null || chegou <= mem.chegouSozinho);
    return { motivo: null, valor: minhas, chave: [ganhou ? 0 : 1, ...chave] };
  }
  return { motivo: null, valor: minhas, chave };
}

/** Quem rema: os que entraram e, nas equipes impostas, os robôs com papel. */
const quemRema = (mem: Mem) => {
  const robos = (mem.im?.robos ?? []).filter((id) => id === mem.sozinho || mem.equipe.includes(id));
  return [...mem.membros.filter((id) => id === mem.sozinho || mem.equipe.includes(id)), ...robos];
};

/** Os robôs que estão com o remo agora remam no ritmo deles (o passo do relógio chama). */
function remamOsRobos(mem: Mem, passou: number, agora: number) {
  if (!mem.im || mem.etapa !== 'remando') return;
  const robos = mem.im.robos;
  const daVez = mem.equipe[vezNaEquipe(mem)];
  for (const id of [mem.sozinho, daVez]) {
    if (id === null || id === undefined || !robos.includes(id)) continue;
    if (id === mem.sozinho ? mem.chegouSozinho !== null : mem.chegouEquipe !== null) continue;
    const r = mem.remadores.get(id);
    if (!r) continue;
    remar(mem, id, r.n0 + toquesDoRobo(passou, r.t0, RITMO_DO_ROBO_NO_RIACHO), passou, passou, agora);
  }
}

/** Soma as remadas aceitas de `quem` (até `aceito`, o total dele) ao barco dele, e passa o remo no fim do trecho. */
function remar(mem: Mem, quem: number, aceito: number, t: number, passou: number, agora: number) {
  const r = mem.remadores.get(quem);
  if (!r || aceito <= r.n) return;
  const novas = aceito - r.n;
  r.n = aceito;
  r.t = t;
  if (quem === mem.sozinho) {
    mem.remadasSozinho = Math.min(TOTAL, mem.remadasSozinho + novas);
    if (mem.remadasSozinho >= TOTAL) mem.chegouSozinho = passou;
  } else {
    const antes = trechoDaEquipe(mem);
    // o que passou do fim do trecho não vai para o próximo: quem passa o remo é a passagem
    const fimDoTrecho = (antes + 1) * REMADAS_POR_TRECHO;
    mem.remadasEquipe = Math.min(fimDoTrecho, mem.remadasEquipe + novas);
    if (mem.remadasEquipe >= TOTAL) mem.chegouEquipe = passou;
    else if (mem.remadasEquipe >= fimDoTrecho) {
      // a passagem do remo: o próximo rema desde agora (no relógio do servidor)
      const prox = mem.equipe[vezNaEquipe(mem)];
      const p = mem.remadores.get(prox);
      // (o instante da tela dele fica um pouco atrás do relógio do servidor: a folga de 600 ms)
      mem.remadores.set(prox, { n: p?.n ?? 0, t: p?.t ?? 0, n0: p?.n ?? 0, t0: passou - 600 });
      mem.l!.avisar();
    }
  }
  if (mem.chegouEquipe !== null && mem.chegouSozinho !== null && mem.sozinho !== RAPOSA) return mem.l!.revelar();
  if (mem.chegouEquipe !== null && mem.sozinho === RAPOSA) return mem.l!.revelar();
  avisarComFreio(mem, agora);
}

export default microjogo<DadosRevezamento, Mem>({
  id: 'revezamento',
  gerar: (aleatorio) => ({ sorteio: aleatorio() }),
  duracao: () => REVEZA_MS + 800,
  aceitaEquipes: true,
  memoria: (_dados, turma) => ({
    l: null,
    membros: [],
    sozinho: null,
    equipe: [],
    remadores: new Map(),
    remadasSozinho: 0,
    remadasEquipe: 0,
    chegouSozinho: null,
    chegouEquipe: null,
    comeco: 0,
    etapa: 'juntando',
    im: umContraOs(impostas(turma)),
  }),
  iniciar(l) {
    const { dados, mem } = l;
    mem.l = l;
    mem.comeco = l.agora();
    l.agendar(JUNTAR_MS, () => {
      const n = mem.membros.length;
      if (mem.im) {
        // o 1 contra 3: a equipe de um vai sozinha; a outra reveza, só com quem entrou a tempo (e os robôs)
        const im = mem.im;
        const so = im.equipes.find((e) => e.length === 1)!;
        const outra = im.equipes.find((e) => e !== so)!;
        mem.sozinho = so[0];
        mem.equipe = outra.filter((id) => mem.membros.includes(id) || im.robos.includes(id));
      } else {
        if (n === 0) return l.agendar(REVEZA_MS - JUNTAR_MS, l.revelar);
        if (n >= 2) {
          mem.sozinho = mem.membros[Math.floor(dados.sorteio * n)];
          mem.equipe = mem.membros.filter((id) => id !== mem.sozinho);
        } else {
          mem.sozinho = RAPOSA;
          mem.equipe = [...mem.membros];
        }
      }
      const t0 = JUNTAR_MS;
      if (mem.sozinho !== RAPOSA) mem.remadores.set(mem.sozinho, { n: 0, t: t0, n0: 0, t0 });
      if (mem.equipe.length) mem.remadores.set(mem.equipe[0], { n: 0, t: t0, n0: 0, t0 });
      mem.etapa = 'remando';
      // o passo do relógio: a raposa e os robôs remam sozinhos, a sala relê, e o fim
      const passo = () => {
        const passou = l.agora() - mem.comeco;
        placar(mem, passou);
        if (passou >= REVEZA_MS) {
          mem.etapa = 'fim';
          return l.agendar(800, l.revelar);
        }
        remamOsRobos(mem, passou, l.agora());
        if (mem.chegouEquipe !== null && (mem.chegouSozinho !== null || mem.sozinho === RAPOSA)) return;
        l.avisar();
        l.agendar(Math.min(PASSO_MS, REVEZA_MS - passou), passo);
      };
      passo();
    });
  },
  vista({ mem, quem, passou, fase }) {
    placar(mem, fase === 'revelando' ? REVEZA_MS : passou);
    const naEquipe = mem.equipe.indexOf(quem);
    const papel = quem === mem.sozinho ? 'sozinho' : naEquipe >= 0 ? 'equipe' : null;
    const remando =
      mem.etapa === 'remando' &&
      ((papel === 'sozinho' && mem.chegouSozinho === null) || (papel === 'equipe' && mem.chegouEquipe === null && vezNaEquipe(mem) === naEquipe));
    const v: VistaRevezamento = {
      etapa: mem.etapa,
      sozinho: { remadas: mem.remadasSozinho, chegou: mem.chegouSozinho, raposa: mem.sozinho === RAPOSA },
      equipe: { remadas: mem.remadasEquipe, chegou: mem.chegouEquipe, tamanho: mem.equipe.length, trecho: trechoDaEquipe(mem), vez: vezNaEquipe(mem) },
      papel,
      posicao: naEquipe,
      remando,
    };
    return { dados: v };
  },
  acerto({ mem, quem, corpo, passou, agora, cabe }) {
    if (corpo.entrar === 1) {
      if (mem.etapa === 'juntando') entrar(mem.membros, quem);
      return;
    }
    if (mem.etapa !== 'remando') return;
    const { n, t } = corpo;
    if (!inteiro(n) || !numero(t) || !cabe(t)) return;
    // os robôs remam pelo passo do relógio, nunca por mensagem
    if (mem.im?.robos.includes(quem)) return;
    const sozinho = quem === mem.sozinho;
    const naEquipe = mem.equipe.indexOf(quem);
    if (sozinho ? mem.chegouSozinho !== null : naEquipe < 0 || mem.chegouEquipe !== null || vezNaEquipe(mem) !== naEquipe) return;
    const r = mem.remadores.get(quem);
    if (!r || n <= r.n || t < r.t) return;
    // o ritmo de quem rema muito, desde que o trecho desta pessoa começou (mais dois de folga)
    const teto = r.n0 + Math.floor(((Math.max(0, Math.min(t, passou + FOLGA_ACIMA) - r.t0)) * RITMO_MAXIMO) / 1000) + 2;
    remar(mem, quem, Math.min(n, teto), t, passou, agora);
  },
  avaliar: ({ mem, quem }) => (mem.membros.includes(quem) && mem.sozinho !== null ? resultadoDe(mem, quem) : { motivo: 'invalido', valor: null, chave: [] }),
  *noFim({ mem }) {
    if (mem.sozinho === null) return;
    for (const id of quemRema(mem)) yield [id, resultadoDe(mem, id)] as [number, Resultado];
  },
  robo(_dados, aleatorio, passouMs) {
    const ritmo = 6 + aleatorio() * 2;
    const p = Math.min(passouMs, REVEZA_MS) - JUNTAR_MS;
    const n = Math.max(0, Math.min(REMADAS_POR_TRECHO, Math.floor((p * ritmo) / 1000)));
    if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
    const chega = JUNTAR_MS + Math.round((TOTAL * 1000) / ritmo) + 600;
    return chega <= Math.min(passouMs, REVEZA_MS) ? { motivo: null, valor: n, chave: [0, chega] } : { motivo: null, valor: n, chave: [1, -Math.floor((p * ritmo) / 1000)] };
  },
});
