/**
 * O CABO DE GUERRA DE TECLAS (05/11/2026; do Thwomp Pull do levantamento em docs/mario-party-3.md, só a mecânica): a turma se
 * divide em duas equipes, uma de cada lado da corda. Na tela de cada um aparece uma seta de cada vez: apertar a seta certa puxa
 * a corda; a errada atrapalha (a tela trava um instante). Cada lado soma os puxões de quem está nele, pela MÉDIA (uma equipe
 * menor não perde por ser menor). Ganha a equipe que trouxer a fita para o seu lado até a marca, ou que estiver na frente quando
 * o tempo acabar. Sozinho, o outro lado são as raposas, que puxam num ritmo fixo.
 *
 * NO FORMATO DE SEMPRE (ver ./lote4-turma.ts): cada tela manda `{ entrar: 1 }`, e as equipes saem da ordem de chegada (uma para
 * cada lado, alternando). Os puxões vão ao vivo como um total ('acerto' `{ n, t }`), conferido contra o ritmo de quem aperta
 * muito (`contar`). O servidor não sabe QUAL tecla foi apertada (o "certo" é da tela), só que ninguém puxa mais rápido que isso.
 * As duas equipes dividem a mesma chave: todos os do lado que ganhou ficam juntos em primeiro.
 */
import { microjogo, sortear, type Largada, type Resultado } from './comum.js';
import { avisarComFreio, contar, entrar, type Contagem } from './lote4-turma.js';

export const CABO_MS = 15000;
/** O ritmo de quem aperta muito (setas certas por segundo); acima disso não é gente. */
export const RITMO_MAXIMO = 9;
/** As raposas (o outro lado, sozinho): puxões por segundo, a partir de quando começam. */
export const RITMO_DA_RAPOSA = 4;
export const RAPOSA_COMECA_MS = 1200;
/** A marca: com esta diferença de puxões (pela média), a corda chegou ao lado de alguém. */
export const MARCA = 28;
/** O passo do relógio do servidor: confere a marca (as raposas puxam sozinhas) e atualiza a sala. */
export const PASSO_MS = 500;

export interface DadosCabo {
  /** As setas, na ordem em que aparecem em cada tela (0 ↑, 1 →, 2 ↓, 3 ←). */
  setas: number[];
}

export interface VistaCabo {
  setas: number[];
  /** As equipes: quantos de cada lado (o lado 1 sem ninguém são as raposas). */
  lados: [number, number];
  /** A posição da fita: positiva puxa para o lado 0. */
  fita: number;
  /** O meu lado (-1: não estou). */
  lado: number;
  /** O lado que ganhou (ao chegar à marca), ou null. */
  venceu: number | null;
}

interface Mem {
  l: Largada<DadosCabo, Mem> | null;
  membros: number[];
  placar: Map<number, Contagem>;
  venceu: number | null;
  avisadoEm?: number;
  comeco: number;
}

const ladoDe = (mem: Mem, id: number) => mem.membros.indexOf(id) % 2;

/** A posição da fita agora: a média do lado 0 menos a do lado 1 (ou das raposas). */
function fita(mem: Mem, passou: number) {
  const soma = [0, 0];
  const quantos = [0, 0];
  for (const id of mem.membros) {
    const lado = ladoDe(mem, id);
    soma[lado] += mem.placar.get(id)?.n ?? 0;
    quantos[lado]++;
  }
  const a = quantos[0] ? soma[0] / quantos[0] : 0;
  const b = quantos[1] ? soma[1] / quantos[1] : (RITMO_DA_RAPOSA * Math.max(0, Math.min(passou, CABO_MS) - RAPOSA_COMECA_MS)) / 1000;
  return Math.max(-MARCA, Math.min(MARCA, a - b));
}

function conferirMarca(mem: Mem, passou: number) {
  if (mem.venceu !== null || mem.membros.length === 0) return;
  const f = fita(mem, passou);
  if (f >= MARCA) mem.venceu = 0;
  else if (f <= -MARCA) mem.venceu = 1;
  if (mem.venceu !== null) mem.l?.revelar();
}

function resultadoDe(mem: Mem, id: number): Resultado {
  const n = mem.placar.get(id)?.n ?? 0;
  const lado = ladoDe(mem, id);
  // quem ganhou: o lado que chegou à marca, ou o que estava na frente no fim (empate: os dois juntos)
  const f = fita(mem, CABO_MS);
  const ganhou = mem.venceu !== null ? mem.venceu === lado : lado === 0 ? f >= 0 : f <= 0;
  if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
  // sozinho contra as raposas, a chave é da pessoa (os puxões desempatam contra os robôs); em equipe, é do lado
  const sozinho = mem.membros.length === 1;
  return { motivo: null, valor: n, chave: sozinho ? [ganhou ? 0 : 1, -n] : [ganhou ? 0 : 1] };
}

export default microjogo<DadosCabo, Mem>({
  id: 'cabo',
  gerar(aleatorio) {
    // nunca a mesma seta duas vezes seguidas (a tela não mostraria a troca)
    const setas: number[] = [];
    for (let i = 0; i < 160; i++) {
      let s = sortear(aleatorio, 4);
      if (i > 0 && s === setas[i - 1]) s = (s + 1 + sortear(aleatorio, 3)) % 4;
      setas.push(s);
    }
    return { setas };
  },
  duracao: () => CABO_MS + 1000,
  memoria: () => ({ l: null, membros: [], placar: new Map(), venceu: null, comeco: 0 }),
  iniciar(l) {
    const { mem } = l;
    mem.l = l;
    mem.comeco = l.agora();
    // o passo do relógio: a marca (as raposas puxam sozinhas), a sala relida, e o fim
    const passo = () => {
      const passou = l.agora() - mem.comeco;
      if (passou >= CABO_MS) return l.agendar(1000, l.revelar);
      conferirMarca(mem, passou);
      if (mem.venceu !== null) return;
      l.avisar();
      l.agendar(Math.min(PASSO_MS, CABO_MS - passou), passo);
    };
    l.agendar(PASSO_MS, passo);
  },
  vista({ dados, mem, quem, passou, fase }) {
    const quantos: [number, number] = [0, 0];
    for (const id of mem.membros) quantos[ladoDe(mem, id)]++;
    const v: VistaCabo = {
      setas: dados.setas,
      lados: quantos,
      fita: fita(mem, fase === 'revelando' ? CABO_MS : passou),
      lado: mem.membros.includes(quem) ? ladoDe(mem, quem) : -1,
      venceu: mem.venceu,
    };
    return { dados: v };
  },
  acerto(c) {
    const { mem, quem, corpo, passou, agora } = c;
    if (corpo.entrar === 1) {
      entrar(mem.membros, quem);
      return;
    }
    if (!mem.membros.includes(quem) || mem.venceu !== null || passou > CABO_MS + 1000) return;
    if (contar(mem.placar, c as never, RITMO_MAXIMO)) {
      conferirMarca(mem, passou);
      if (mem.venceu === null) avisarComFreio(mem, agora);
    }
  },
  avaliar: ({ mem, quem }) => (mem.membros.includes(quem) ? resultadoDe(mem, quem) : { motivo: 'invalido', valor: null, chave: [] }),
  *noFim({ mem }) {
    for (const id of mem.membros) yield [id, resultadoDe(mem, id)] as [number, Resultado];
  },
  robo(_dados, aleatorio, passouMs) {
    const n = Math.max(1, Math.floor((Math.min(passouMs, CABO_MS) * (4 + aleatorio() * 2.5)) / 1000));
    return { motivo: null, valor: n, chave: [aleatorio() < 0.5 ? 0 : 1, -n] };
  },
});
