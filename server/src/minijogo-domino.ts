/**
 * O DOMINÓ (04/11/2026, pedido dele, com Truco, Damas e Batalha naval): o dominó de sempre, duplo-seis, como se joga no
 * Brasil. Regra pública, sem conteúdo para manter; as pedras são desenhadas por código no site (JogoDomino.tsx).
 *
 * DE 2 A 4. Cada um recebe 7 pedras. Com 2 ou 3, cada um por si, e o que sobra DORME: quem não tem pedra que sirva compra,
 * uma de cada vez, até poder jogar; sem nada para comprar, passa. Com 4, em DUPLAS (os lugares 0 e 2 contra 1 e 3, sorteados
 * na largada), as 28 pedras são distribuídas e não há o que comprar: quem não pode jogar passa.
 *
 * QUEM COMEÇA: na primeira mão, quem tem a dupla de seis, e com ela; com 2 ou 3, se ninguém a tem, a dupla mais alta, e sem
 * dupla nenhuma, a pedra mais alta (a soma, e depois a metade maior). Nas outras, quem ganhou a mão anterior, com qualquer
 * pedra (no trancado empatado, quem começou a anterior). Depois, a vez anda pelos lugares.
 *
 * A MÃO ACABA pela BATIDA (alguém fica sem pedras: ele, ou a dupla dele, leva a soma dos pontos das mãos dos adversários) ou
 * TRANCADA (ninguém pode jogar e não há o que comprar: quem tem menos pontos na mão — na dupla, a soma das duas mãos — leva a
 * soma dos adversários; empatado, ninguém marca). O trancado é reconhecido NA HORA, sem esperar cada um passar. Ganha a
 * partida quem chegar a PONTOS_PARA_VENCER.
 *
 * O SYDEN DECIDE, QUEM JOGA NÃO ADMINISTRA: quem não pode jogar nem comprar PASSA SOZINHO (a ação 'passar' existe, mas só vale
 * nesse caso, que o servidor já resolve); comprar é com a pessoa, pedra a pedra, porque é o que se faz na mesa.
 *
 * NINGUÉM SEGURA A TURMA: a vez tem 30 s (cada compra devolve o prazo), e acabou o tempo, o Syden joga pela pessoa (compra o
 * que precisar e joga a pedra mais pesada que serve). Quem saiu da sala tem a vez jogada em 2 s; em duplas, a partida segue
 * enquanto 2 jogadores estiverem na sala. Com menos de 2, acaba sem vencedor.
 *
 * O QUE O CONSOLE CONSEGUE: nada além de jogar na própria vez. A mão de cada um só vai a ele (as dos outros só na revelação
 * do fim da mão), a compra é do servidor, e cada jogada confere a vez, a pedra na mão e a ponta.
 *
 * NO SOLO, CONTRA O COMPUTADOR (pedido dele, 05/11/2026): de 1 a 3 robôs (minijogo-robos.ts); com 3 a mesa é de quatro, em
 * duplas, com um robô de parceiro. O robô joga na vez dele depois de uma pausa curta, pela mesma `acao` de quem joga: compra
 * pedra a pedra quando precisa, e escolhe a pedra que livra mais pontos sem deixar na mesa uma ponta que ele não tem.
 */
import { embaralhar, type Definicao, type Jogo } from './minijogo-motor.js';
import { comRobos, ehRobo, idsDosRobos, PAUSA_DO_ROBO, quantosRobos } from './minijogo-robos.js';
import { JOGADA_SOLO_MS } from './minijogo-tabuleiro.js';

/** Uma pedra: as duas metades, a menor primeiro (na mesa, a ordem é a do encaixe). */
export type Pedra = [number, number];
export type Ponta = 'esquerda' | 'direita';

export const PONTOS_PARA_VENCER = 50;
/** No dominó de pontos (21/11/2026), a partida vai mais longe: os pontos das pontas somam rápido. */
export const PONTOS_PARA_VENCER_NOS_PONTOS = 150;
export const PEDRAS_NA_MAO = 7;
export const TEMPO_DA_VEZ = 30_000;
/** A vez de quem saiu da sala: jogada pelo Syden nesse tempo. */
export const TEMPO_DO_AUSENTE = 2_000;
/** O fim da mão: as mãos de todos à mostra e quem marcou, antes da próxima. */
export const TEMPO_DO_RESULTADO = 6_000;
export const MAXIMO_DO_DOMINO = 4;

/** As 28 pedras, de 0-0 a 6-6. */
export function todasAsPedras(): Pedra[] {
  const lista: Pedra[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) lista.push([a, b]);
  return lista;
}

export const somaDe = (pedras: Pedra[]) => pedras.reduce((n, p) => n + p[0] + p[1], 0);
const mesma = (p: Pedra, q: Pedra) => (p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]);
/** A pedra "mais alta": a soma, e depois a metade maior. */
const maisAlta = (p: Pedra, q: Pedra) => p[0] + p[1] - (q[0] + q[1]) || Math.max(...p) - Math.max(...q);

export type Lance =
  | { id: number; tipo: 'jogou'; userId: number; pedra: Pedra; ponta: Ponta | null; sozinho: boolean; pontos?: number }
  | { id: number; tipo: 'comprou'; userId: number; sozinho: boolean }
  | { id: number; tipo: 'passou'; userId: number }
  | { id: number; tipo: 'bateu'; userId: number }
  | { id: number; tipo: 'trancado' };

type SemId<T> = T extends unknown ? Omit<T, 'id'> : never;

export interface ResultadoDaMao {
  tipo: 'batida' | 'trancado';
  /** Quem bateu, ou (no trancado) quem tinha menos pontos do lado vencedor; null no empate. */
  userId: number | null;
  /** O lado que marcou (o lugar, ou a dupla 0/1), ou null no empate. */
  lado: number | null;
  pontos: number;
  maos: { userId: number; pedras: Pedra[]; soma: number }[];
  /** A batida especial (só com `especiais` ligado): a tela põe o selo dela. */
  especial?: BatidaEspecial | null;
}

/**
 * AS BATIDAS ESPECIAIS DA MESA BRASILEIRA (20/11/2026, o lote C da segunda auditoria), uma opção da largada; desligada, a
 * batida vale como sempre. Bater com CARROÇA (a dupla) vale o dobro; LÁ-E-LÓ (a pedra que serve nas duas pontas, de números
 * diferentes) também; e a carroça do número que está nas DUAS pontas (a CRUZADA) vale o quádruplo.
 */
export type BatidaEspecial = 'carroca' | 'la-e-lo' | 'cruzada';
export const MULTIPLO_DA_BATIDA: Record<BatidaEspecial, number> = { carroca: 2, 'la-e-lo': 2, cruzada: 4 };

/** A batida especial da última pedra, pelas pontas da mesa ANTES dela (null: batida comum). */
export function batidaEspecial(pedra: Pedra, pontas: { esquerda: number; direita: number } | null): BatidaEspecial | null {
  const carroca = pedra[0] === pedra[1];
  if (!pontas) return carroca ? 'carroca' : null;
  if (carroca) return pontas.esquerda === pedra[0] && pontas.direita === pedra[0] ? 'cruzada' : 'carroca';
  const naEsquerda = pedra[0] === pontas.esquerda || pedra[1] === pontas.esquerda;
  const naDireita = pedra[0] === pontas.direita || pedra[1] === pontas.direita;
  return pontas.esquerda !== pontas.direita && naEsquerda && naDireita ? 'la-e-lo' : null;
}

/**
 * O DOMINÓ DE PONTOS (21/11/2026, o lote D da segunda auditoria), uma opção da largada: depois de cada pedra, se a soma das
 * pontas da mesa é múltiplo de 5, quem jogou (ou a dupla dele) marca essa soma na hora. A carroça na ponta conta as DUAS metades
 * (o 6-6 na ponta vale 12), e a primeira pedra sozinha conta inteira. Na batida e no trancado, os pontos das mãos dos outros
 * entram arredondados para baixo, de 5 em 5. A partida vai até PONTOS_PARA_VENCER_NOS_PONTOS, e quem chega no meio da mão já
 * ganha. A regra de fábrica continua a de sempre.
 */
export function somaDasPontas(mesa: Pedra[]): number {
  if (!mesa.length) return 0;
  if (mesa.length === 1) return mesa[0][0] + mesa[0][1];
  const ponta = (p: Pedra, n: number) => (p[0] === p[1] ? 2 * n : n);
  const primeira = mesa[0];
  const ultima = mesa[mesa.length - 1];
  return ponta(primeira, primeira[0]) + ponta(ultima, ultima[1]);
}
/** O que a mesa marca no dominó de pontos (0: não marca). */
export const pontosDaMesa = (mesa: Pedra[]) => {
  const soma = somaDasPontas(mesa);
  return soma > 0 && soma % 5 === 0 ? soma : 0;
};
/** Os pontos das mãos, no dominó de pontos: para baixo, de 5 em 5. */
export const arredondarACinco = (n: number) => Math.floor(n / 5) * 5;

/** O nível dos robôs do Solo (21/11/2026): o normal é o robô de antes; o difícil CONTA as pedras. */
export type NivelDoDomino = 'facil' | 'normal' | 'dificil';
export const NIVEIS_DO_DOMINO: readonly NivelDoDomino[] = ['facil', 'normal', 'dificil'];

/** O que o robô sabe na hora de jogar: só o que uma pessoa naquele lugar saberia. */
export interface VisaoDoRobo {
  mao: Pedra[];
  mesa: Pedra[];
  /** As jogadas possíveis (a pedra e as pontas onde serve). */
  jogaveis: { pedra: Pedra; pontas: (Ponta | null)[] }[];
  /** Os números que cada ADVERSÁRIO mostrou não ter (passou com eles nas pontas). */
  faltaAosOutros: Set<number>[];
  /** Os números que o PARCEIRO mostrou não ter (só em duplas). */
  faltaAoParceiro: Set<number> | null;
  pontos: boolean;
  especiais: boolean;
}

/** A mesa depois da jogada (para a conta das pontas). */
export function mesaDepois(mesa: Pedra[], p: Pedra, ponta: Ponta | null): Pedra[] {
  if (!mesa.length) return [[p[0], p[1]]];
  const esquerda = mesa[0][0];
  const direita = mesa[mesa.length - 1][1];
  if (ponta === 'esquerda') return [p[1] === esquerda ? [p[0], p[1]] : [p[1], p[0]], ...mesa];
  return [...mesa, p[0] === direita ? [p[0], p[1]] : [p[1], p[0]]];
}

/**
 * A ESCOLHA DO ROBÔ, por nível. FÁCIL: quase ao acaso (só prefere um pouco a pedra pesada). NORMAL (o de antes): a pedra que
 * livra mais pontos, a carroça, e a que deixa na mesa uma ponta que ele ainda tem; no dominó de pontos, o que marca. DIFÍCIL, O
 * ROBÔ QUE CONTA: tudo isso, e mais o que viu — as pedras na mesa e na mão dele dizem quantas de cada número ainda faltam
 * aparecer, e quem passou mostrou os números que não tem. Ele prefere deixar nas pontas o que os adversários não têm (eles
 * passam ou compram), evita fechar o parceiro, e prefere a ponta de número que já saiu quase todo.
 */
export function jogadaDoRoboNoDomino(v: VisaoDoRobo, nivel: NivelDoDomino, aleatorio: () => number): { pedra: Pedra; ponta: Ponta | null } {
  let melhor: { pedra: Pedra; ponta: Ponta | null; valor: number } | null = null;
  /** Quantas das 7 pedras com o número n eu já vejo (na mesa e na minha mão). */
  const vistas = (n: number) => {
    let k = 0;
    for (const q of v.mesa) if (q[0] === n || q[1] === n) k++;
    for (const q of v.mao) if (q[0] === n || q[1] === n) k++;
    return k;
  };
  for (const { pedra: p, pontas } of v.jogaveis) {
    for (const ponta of pontas) {
      const resto = v.mao.filter((q) => !(q[0] === p[0] && q[1] === p[1]));
      const depois = mesaDepois(v.mesa, p, ponta);
      const fica = depois.length === 1 ? [p[0], p[1]] : [depois[0][0], depois[depois.length - 1][1]];
      const tenho = resto.filter((q) => fica.some((n) => q[0] === n || q[1] === n)).length;
      const marca = v.pontos ? pontosDaMesa(depois) : 0;
      let valor: number;
      if (nivel === 'facil') valor = (p[0] + p[1]) * 0.3 + marca * 0.2 + aleatorio() * 8;
      else {
        // com as batidas especiais, guardar uma carroça para bater com ela vale um pouco
        const guardaCarroca = v.especiais && resto.length === 1 && resto[0][0] === resto[0][1] ? 3 : 0;
        valor = p[0] + p[1] + (p[0] === p[1] ? 4 : 0) + Math.min(tenho, 2) * 3 + guardaCarroca + marca * 1.5;
        if (nivel === 'dificil') {
          const numeros = [...new Set(fica)];
          // os adversários que ficam sem jogo nas pontas
          for (const falta of v.faltaAosOutros) {
            const presos = numeros.filter((n) => falta.has(n)).length;
            valor += presos === numeros.length ? 6 : presos * 1.5;
          }
          if (v.faltaAoParceiro && numeros.every((n) => v.faltaAoParceiro!.has(n))) valor -= 4;
          // a ponta de número que já saiu quase todo é difícil para quem vem depois
          for (const n of numeros) valor += vistas(n) * 0.6;
          // no dominó de pontos, o que o próximo pode marcar com as pedras que ainda não apareceram (a média, por pedra)
          if (v.pontos) {
            const vi = (q: Pedra) => v.mesa.some((m) => mesma(m, q)) || v.mao.some((m) => mesma(m, q));
            const ocultas = todasAsPedras().filter((q) => !vi(q));
            const e0 = depois[0][0];
            const e1 = depois[depois.length - 1][1];
            let risco = 0;
            for (const q of ocultas) {
              let maior = 0;
              if (q[0] === e0 || q[1] === e0) maior = Math.max(maior, pontosDaMesa(mesaDepois(depois, q, 'esquerda')));
              if (q[0] === e1 || q[1] === e1) maior = Math.max(maior, pontosDaMesa(mesaDepois(depois, q, 'direita')));
              risco += maior;
            }
            if (ocultas.length) valor -= (risco / ocultas.length) * 3;
          }
          valor += aleatorio() * 0.3;
        } else valor += aleatorio();
      }
      if (!melhor || valor > melhor.valor) melhor = { pedra: p, ponta, valor };
    }
  }
  return { pedra: melhor!.pedra, ponta: melhor!.ponta };
}

export interface OpcoesDoDomino {
  agora?: () => number;
  aleatorio?: () => number;
  /** Para o teste: as mãos (pelo lugar) e o que dorme em cada mão da partida. */
  distribuir?: (numeroDaMao: number) => { maos: Pedra[][]; dorme: Pedra[] } | undefined;
}

export const domino: Definicao = criarDomino();

export function criarDomino({ agora = Date.now, aleatorio = Math.random, distribuir }: OpcoesDoDomino = {}): Definicao {
  return {
    minimo: 2,
    maximo: MAXIMO_DO_DOMINO,
    comecar(ctxDaSala, { naSala: naSalaDaSala, corpo }) {
      // no Solo, a vez de quem joga não corre em 30 s (revisão independente, 05/11/2026): pensar sozinho não segura ninguém, e o
      // Syden jogava (no Truco, corria) pela pessoa, como faz pela turma. O relógio longo é o das mesas (JOGADA_SOLO_MS).
      const tempoDaVez = ctxDaSala.solo ? JOGADA_SOLO_MS : TEMPO_DA_VEZ;
      // os robôs só no Solo, e estão sempre na sala
      const robos = idsDosRobos(quantosRobos(ctxDaSala, corpo, MAXIMO_DO_DOMINO - 1));
      const ctx = comRobos(ctxDaSala, robos);
      const naSala = [...naSalaDaSala.slice(0, MAXIMO_DO_DOMINO - robos.length), ...robos];
      if (naSala.length < 2) return 'Ainda falta gente para começar.';
      const ordem = embaralhar(naSala.slice(0, MAXIMO_DO_DOMINO), aleatorio);
      const duplas = ordem.length === 4;
      const ladoDe = (lugar: number) => (duplas ? lugar % 2 : lugar);
      const lados = duplas ? 2 : ordem.length;
      // o dominó de pontos (21/11/2026) e o nível dos robôs do Solo
      const dePontos = corpo?.pontos === true;
      const alvo = dePontos ? PONTOS_PARA_VENCER_NOS_PONTOS : PONTOS_PARA_VENCER;
      const nivel: NivelDoDomino = robos.length && NIVEIS_DO_DOMINO.includes(corpo?.nivel as NivelDoDomino) ? (corpo.nivel as NivelDoDomino) : 'normal';
      const membros = (lado: number) => ordem.filter((_, i) => ladoDe(i) === lado);
      const pontos = new Array<number>(lados).fill(0);
      const partidaId = `domino-${ctx.comunidade ?? 0}-${agora()}`;
      // as batidas especiais da mesa brasileira (20/11/2026): uma opção da largada
      const especiais = corpo?.especiais === true;

      let fase: 'jogando' | 'resultado' | 'fim' = 'jogando';
      let numeroDaMao = 0;
      let maos: Pedra[][] = [];
      let dorme: Pedra[] = [];
      let mesa: Pedra[] = [];
      let vez = 0;
      /** Quem começou a mão: no trancado empatado, começa a próxima de novo. */
      let iniciador = 0;
      /** A pedra com que a primeira mão tem de começar (a dupla de seis, ou a mais alta). */
      let obrigatoria: Pedra | null = null;
      let resultado: ResultadoDaMao | null = null;
      let vencedor: number | null = null;
      let interrompida = false;
      /** O relógio de agora é o de quem saiu da sala (2 s)? */
      let relogioDoAusente = false;
      /** Os números que cada lugar mostrou não ter nesta mão (passou com eles nas pontas): o robô difícil conta. */
      let faltas: Set<number>[] = [];
      const historico: Lance[] = [];
      let idDoLance = 0;
      const contar = (l: SemId<Lance>) => {
        historico.push({ ...l, id: ++idDoLance } as Lance);
        if (historico.length > 8) historico.shift();
      };

      const pontas = (): { esquerda: number; direita: number } | null =>
        mesa.length ? { esquerda: mesa[0][0], direita: mesa[mesa.length - 1][1] } : null;

      /** Onde a pedra serve: [] não serve; na mesa vazia, [null]; duas pontas só quando o resultado muda. */
      const ondeServe = (p: Pedra): (Ponta | null)[] => {
        if (obrigatoria) return mesa.length === 0 && mesma(p, obrigatoria) ? [null] : [];
        const e = pontas();
        if (!e) return [null];
        const naEsquerda = p[0] === e.esquerda || p[1] === e.esquerda;
        const naDireita = p[0] === e.direita || p[1] === e.direita;
        if (naEsquerda && naDireita) return e.esquerda === e.direita ? ['direita'] : ['esquerda', 'direita'];
        if (naEsquerda) return ['esquerda'];
        if (naDireita) return ['direita'];
        return [];
      };
      const podeJogar = (lugar: number) => maos[lugar].some((p) => ondeServe(p).length > 0);
      const podeComprar = () => !duplas && dorme.length > 0;
      const presentes = () => {
        const sala = new Set(ctx.naSala());
        return ordem.filter((id) => sala.has(id));
      };

      const novaMao = () => {
        numeroDaMao++;
        const dado = distribuir?.(numeroDaMao);
        if (dado) {
          maos = dado.maos.map((m) => m.map((p) => [...p] as Pedra));
          dorme = dado.dorme.map((p) => [...p] as Pedra);
        } else {
          const pedras = embaralhar(todasAsPedras(), aleatorio);
          maos = ordem.map((_, i) => pedras.slice(i * PEDRAS_NA_MAO, (i + 1) * PEDRAS_NA_MAO));
          dorme = pedras.slice(ordem.length * PEDRAS_NA_MAO);
        }
        mesa = [];
        faltas = ordem.map(() => new Set<number>());
        resultado = null;
        obrigatoria = null;
        if (numeroDaMao === 1) {
          // a dupla de seis; sem ela, a dupla mais alta; sem dupla, a pedra mais alta
          const todas = maos.flatMap((m, lugar) => m.map((p) => ({ p, lugar })));
          const duplasNaMao = todas.filter(({ p }) => p[0] === p[1]);
          const candidatas = duplasNaMao.length ? duplasNaMao : todas;
          const melhor = candidatas.sort((a, b) => maisAlta(b.p, a.p))[0];
          if (melhor) {
            iniciador = melhor.lugar;
            obrigatoria = melhor.p;
          }
        }
        vez = iniciador;
        fase = 'jogando';
        comecarVez();
      };

      const fimDaMao = (r: ResultadoDaMao) => {
        resultado = r;
        if (r.lado !== null) {
          pontos[r.lado] += r.pontos;
          if (r.userId !== null) iniciador = ordem.indexOf(r.userId);
        }
        if (chegou()) return;
        fase = 'resultado';
        ctx.agendar(TEMPO_DO_RESULTADO, novaMao);
        ctx.avisar();
      };

      /** Alguém chegou ao alvo: a partida acaba (no dominó de pontos, pode ser no meio da mão). */
      function chegou() {
        const campeao = pontos.findIndex((n) => n >= alvo && n === Math.max(...pontos));
        if (campeao < 0) return false;
        vencedor = campeao;
        fase = 'fim';
        ctx.terminar(true);
        return true;
      }

      const maosAbertas = () => ordem.map((userId, i) => ({ userId, pedras: maos[i].map((p) => [...p] as Pedra), soma: somaDe(maos[i]) }));
      /** A soma dos adversários de um lado. */
      const somaDosOutros = (lado: number) => {
        const soma = ordem.reduce((n, _, i) => (ladoDe(i) === lado ? n : n + somaDe(maos[i])), 0);
        return dePontos ? arredondarACinco(soma) : soma;
      };

      const bater = (lugar: number, pedra: Pedra, antes: { esquerda: number; direita: number } | null) => {
        contar({ tipo: 'bateu', userId: ordem[lugar] });
        const lado = ladoDe(lugar);
        const especial = especiais ? batidaEspecial(pedra, antes) : null;
        const multiplo = especial ? MULTIPLO_DA_BATIDA[especial] : 1;
        fimDaMao({ tipo: 'batida', userId: ordem[lugar], lado, pontos: somaDosOutros(lado) * multiplo, maos: maosAbertas(), especial });
      };

      const trancar = () => {
        contar({ tipo: 'trancado' });
        const somas = Array.from({ length: lados }, (_, lado) => membros(lado).reduce((n, id) => n + somaDe(maos[ordem.indexOf(id)]), 0));
        const menor = Math.min(...somas);
        const ganhadores = somas.map((s, lado) => (s === menor ? lado : -1)).filter((l) => l >= 0);
        if (ganhadores.length !== 1) {
          fimDaMao({ tipo: 'trancado', userId: null, lado: null, pontos: 0, maos: maosAbertas() });
          return;
        }
        const lado = ganhadores[0];
        // quem começa a próxima: da dupla, quem tem menos na mão (empatados, o primeiro a partir de quem começou esta)
        const daDupla = [...ordem.keys()]
          .map((k) => (iniciador + k) % ordem.length)
          .filter((i) => ladoDe(i) === lado)
          .sort((a, b) => somaDe(maos[a]) - somaDe(maos[b]))[0];
        fimDaMao({ tipo: 'trancado', userId: ordem[daDupla], lado, pontos: somaDosOutros(lado), maos: maosAbertas() });
      };

      /** Ninguém pode jogar e não há o que comprar. */
      const estaTrancado = () => !podeComprar() && !maos.some((_, i) => podeJogar(i));

      /** A vez de quem está em `vez`: quem não pode jogar nem comprar passa sozinho; quem saiu da sala joga em 2 s. */
      const comecarVez = () => {
        for (let guarda = 0; guarda <= ordem.length; guarda++) {
          if (fase !== 'jogando') return;
          if (estaTrancado()) return trancar();
          if (!podeJogar(vez) && !podeComprar()) {
            passou(vez);
            vez = (vez + 1) % ordem.length;
            continue;
          }
          if (ehRobo(ordem[vez])) {
            const robo = ordem[vez];
            relogioDoAusente = true;
            ctx.agendar(PAUSA_DO_ROBO, () => vezDoRobo(robo));
            ctx.avisar();
            return;
          }
          relogioDoAusente = !ctx.naSala().includes(ordem[vez]);
          ctx.agendar(relogioDoAusente ? TEMPO_DO_AUSENTE : tempoDaVez, jogarSozinho);
          ctx.avisar();
          return;
        }
        trancar();
      };

      /** Quem passa mostra que não tem os números das pontas. */
      function passou(lugar: number) {
        const e = pontas();
        if (e) faltas[lugar].add(e.esquerda).add(e.direita);
        contar({ tipo: 'passou', userId: ordem[lugar] });
      }

      const proximaVez = () => {
        vez = (vez + 1) % ordem.length;
        comecarVez();
      };

      const jogar = (lugar: number, pedra: Pedra, ponta: Ponta | null, sozinho: boolean) => {
        const mao = maos[lugar];
        const k = mao.findIndex((p) => mesma(p, pedra));
        const [a, b] = mao[k];
        mao.splice(k, 1);
        const e = pontas();
        if (!e) mesa.push([a, b]);
        else if (ponta === 'esquerda') mesa.unshift(b === e.esquerda ? [a, b] : [b, a]);
        else mesa.push(a === e.direita ? [a, b] : [b, a]);
        obrigatoria = null;
        const marcou = dePontos ? pontosDaMesa(mesa) : 0;
        contar({ tipo: 'jogou', userId: ordem[lugar], pedra: [a, b], ponta: e ? ponta : null, sozinho, ...(marcou ? { pontos: marcou } : {}) });
        if (marcou) {
          pontos[ladoDe(lugar)] += marcou;
          if (chegou()) return;
        }
        if (mao.length === 0) return bater(lugar, [a, b], e);
        proximaVez();
      };

      const comprar = (lugar: number, sozinho: boolean) => {
        maos[lugar].push(dorme.pop()!);
        // a pedra comprada ninguém viu: o que se sabia do que falta a ele não vale mais
        faltas[lugar].clear();
        contar({ tipo: 'comprou', userId: ordem[lugar], sozinho });
      };

      /** O tempo acabou (ou a pessoa saiu): compra o que precisar e joga a pedra mais pesada que serve, ou passa. */
      function jogarSozinho() {
        if (fase !== 'jogando') return;
        const lugar = vez;
        while (!podeJogar(lugar) && podeComprar()) comprar(lugar, true);
        const jogaveis = maos[lugar].filter((p) => ondeServe(p).length > 0).sort((p, q) => maisAlta(q, p));
        if (!jogaveis.length) {
          passou(lugar);
          return proximaVez();
        }
        jogar(lugar, jogaveis[0], ondeServe(jogaveis[0])[0], true);
      }

      const terminarSemVencedor = () => {
        if (fase === 'fim') return;
        fase = 'fim';
        interrompida = true;
        ctx.terminar(false);
      };

      const lerPedra = (v: unknown): Pedra | null => {
        if (!Array.isArray(v) || v.length !== 2) return null;
        const [a, b] = v.map(Number);
        if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 6)) return null;
        return [Math.min(a, b), Math.max(a, b)];
      };

      /**
       * A VEZ DO ROBÔ: compra (uma pedra por pausa, como na mesa) até ter o que jogar, e joga a pedra que vale mais para ele:
       * a mais pesada (livra pontos se a mão trancar ou alguém bater), a dupla (difícil de encaixar depois), e a que deixa na
       * mesa uma ponta que ele ainda tem na mão (para não ficar sem jogo na próxima).
       */
      function vezDoRobo(quem: number) {
        if (fase !== 'jogando' || ordem[vez] !== quem) return;
        const lugar = vez;
        if (!podeJogar(lugar)) {
          if (!podeComprar()) return void jogo.acao(quem, { tipo: 'passar' });
          jogo.acao(quem, { tipo: 'comprar' });
          ctx.agendar(PAUSA_DO_ROBO / 2, () => vezDoRobo(quem));
          return;
        }
        const lado = ladoDe(lugar);
        const escolha = jogadaDoRoboNoDomino(
          {
            mao: maos[lugar],
            mesa,
            jogaveis: maos[lugar].map((p) => ({ pedra: p, pontas: ondeServe(p) })).filter((j) => j.pontas.length > 0),
            faltaAosOutros: ordem.flatMap((_, i) => (ladoDe(i) !== lado ? [faltas[i]] : [])),
            faltaAoParceiro: duplas ? faltas[(lugar + 2) % 4] : null,
            pontos: dePontos,
            especiais,
          },
          nivel,
          aleatorio,
        );
        jogo.acao(quem, { tipo: 'jogar', pedra: escolha.pedra, ponta: escolha.ponta });
      }

      novaMao();

      const jogo: Jogo = {
        publico(quem) {
          const sala = new Set(ctx.naSala());
          const meuLugar = ordem.indexOf(quem);
          const minhaVez = fase === 'jogando' && meuLugar === vez;
          const aberto = fase !== 'jogando';
          return {
            fase,
            partidaId,
            duplas,
            alvo,
            pontos: dePontos,
            somaDasPontas: dePontos ? somaDasPontas(mesa) : null,
            nivel: robos.length ? nivel : null,
            mao: numeroDaMao,
            lugares: ordem.map((userId, i) => ({
              userId,
              username: ctx.nome(userId),
              lado: ladoDe(i),
              pedras: maos[i]?.length ?? 0,
              presente: sala.has(userId),
            })),
            minhaMao: meuLugar >= 0 ? maos[meuLugar].map((p) => [...p]) : [],
            mesa: mesa.map((p) => [...p]),
            pontas: pontas(),
            dorme: dorme.length,
            vez: fase === 'jogando' ? ordem[vez] : null,
            obrigatoria: fase === 'jogando' ? obrigatoria : null,
            jogaveis: minhaVez ? maos[meuLugar].filter((p) => ondeServe(p).length > 0).map((p) => ({ pedra: [...p], pontas: ondeServe(p) })) : [],
            devoComprar: minhaVez && !podeJogar(meuLugar) && podeComprar(),
            possoPassar: minhaVez && !podeJogar(meuLugar) && !podeComprar(),
            placar: pontos.map((n, lado) => ({ lado, membros: membros(lado), pontos: n })),
            ultimo: historico[historico.length - 1] ?? null,
            historico,
            resultado: aberto ? resultado : null,
            vencedor: fase === 'fim' && vencedor !== null ? { lado: vencedor, membros: membros(vencedor) } : null,
            interrompida,
            // quantos robôs (o "Jogar de novo" do Solo pede os mesmos)
            robos: robos.length,
            especiais,
          };
        },
        acao(quem, corpo) {
          const lugar = ordem.indexOf(quem);
          if (lugar < 0) return 'Você está assistindo esta partida.';
          if (fase === 'fim') return 'A partida acabou.';
          if (fase !== 'jogando') return 'Espere a próxima mão.';
          if (lugar !== vez) return 'Espere a sua vez.';
          const tipo = String(corpo.tipo ?? '');
          if (tipo === 'comprar') {
            if (podeJogar(lugar)) return 'Você tem uma pedra que serve.';
            if (!podeComprar()) return 'Não há pedras para comprar.';
            comprar(lugar, false);
            relogioDoAusente = false;
            ctx.agendar(tempoDaVez, jogarSozinho);
            ctx.avisar();
            return null;
          }
          if (tipo === 'passar') {
            if (podeJogar(lugar)) return 'Você tem uma pedra que serve.';
            if (podeComprar()) return 'Compre uma pedra antes de passar.';
            passou(lugar);
            proximaVez();
            return null;
          }
          if (tipo !== 'jogar') return 'Ação desconhecida.';
          const pedra = lerPedra(corpo.pedra);
          if (!pedra || !maos[lugar].some((p) => mesma(p, pedra))) return 'Essa pedra não está na sua mão.';
          const onde = ondeServe(pedra);
          if (!onde.length) return obrigatoria ? 'A primeira pedra é outra.' : 'Essa pedra não encaixa na mesa.';
          let ponta: Ponta | null = onde[0];
          if (onde.length === 2) {
            if (corpo.ponta !== 'esquerda' && corpo.ponta !== 'direita') return 'Escolha a ponta.';
            ponta = corpo.ponta;
          } else if (onde[0] !== null && (corpo.ponta === 'esquerda' || corpo.ponta === 'direita') && corpo.ponta !== onde[0]) {
            // se as duas pontas têm o mesmo número, qualquer uma serve
            const e = pontas()!;
            if (e.esquerda !== e.direita) return 'Essa pedra não encaixa nessa ponta.';
            ponta = corpo.ponta;
          }
          jogar(lugar, pedra, ponta, false);
          return null;
        },
        conferir() {
          if (fase === 'fim') return;
          if (presentes().length < 2) return terminarSemVencedor();
          // quem está na vez saiu da sala: o Syden joga por ele logo
          if (fase === 'jogando' && !relogioDoAusente && !ctx.naSala().includes(ordem[vez])) {
            relogioDoAusente = true;
            ctx.agendar(TEMPO_DO_AUSENTE, jogarSozinho);
          }
        },
      };
      return jogo;
    },
  };
}
