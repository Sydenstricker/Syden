/**
 * TRUCO PAULISTA (04/11/2026, pedido dele: os clássicos de mesa, junto com o dominó, as damas e a batalha naval). O truco é
 * jogo de domínio público, e o que vale aqui é a variante mais jogada no Brasil: baralho de 40 (sem 8, 9 e 10), a VIRA e as
 * MANILHAS, um contra um ou em duplas de quatro, até 12 tentos. A turma joga conversando na voz, que é onde o truco mora.
 *
 * AS REGRAS, como o código as entende:
 * - A força, do mais fraco ao mais forte: 4, 5, 6, 7, Q, J, K, A, 2, 3. Duas cartas comuns do mesmo valor EMPATAM.
 * - A manilha é o valor SEGUINTE ao da vira (em roda: vira 3 → manilha 4). Ganha de tudo; entre elas, ouros < espadas <
 *   copas < paus (o zap). Por terem naipes diferentes, duas manilhas nunca empatam.
 * - Até 3 rodadas por mão; leva a mão quem fizer duas. Empates: a 1ª empatada, decide a 2ª; a 1ª e a 2ª empatadas, decide a
 *   3ª; as três empatadas, ninguém marca. Quem fez a 1ª ganha se uma rodada seguinte empatar, e também se a 3ª empatar depois
 *   de 1 × 1. Quem ganha a rodada abre a próxima; empatada, abre de novo quem abriu a empatada.
 * - A carta COBERTA (de face para baixo) só da 2ª rodada em diante: não ganha nem empata, e só o dono a vê (nem no fim).
 * - O TRUCO: na própria vez, antes de jogar, pede-se truco (1 → 3). A outra dupla aceita, corre (quem pediu marca o valor de
 *   ANTES do pedido e a mão acaba) ou aumenta (6, 9, 12), e aí quem pediu responde. Aceito um valor, só a dupla que ACEITOU
 *   pode aumentar depois, numa vez dela. Em quatro, qualquer um da dupla responde, e vale a primeira resposta.
 * - MÃO DE ONZE: uma dupla com 11 (e a outra não) vê as cartas (em quatro, também as do parceiro) e decide antes de jogar:
 *   jogar, valendo 3, ou correr, dando 1 ao adversário. Sem truco. MÃO DE FERRO (as duas com 11): uma mão comum valendo 1, sem
 *   truco. A variante das cartas às cegas ficou de fora de propósito: jogar sem ver numa tela não tem graça nenhuma.
 *
 * NINGUÉM SEGURA A TURMA: 30 s por decisão. Acabou o tempo na vez, o servidor joga a carta MAIS FRACA da pessoa; no truco,
 * corre; na mão de onze, joga. Quem saiu da sala tem a vez jogada em 2 s. Com menos de 2 na sala, ou uma dupla inteira fora,
 * a partida acaba sem vencedor.
 *
 * O CONSOLE NÃO CONSEGUE NADA: as cartas são do servidor, e cada um recebe só a própria mão (o teste confere).
 */
import { embaralhar, type Definicao } from './minijogo-motor.js';

export const VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
/** Na ordem das manilhas: ouros, espadas, copas, paus (o zap). */
export const NAIPES = ['o', 'e', 'c', 'p'] as const;
/** O que a mão vale: o normal, o truco, o seis, o nove e o doze. */
export const VALORES_DA_MAO = [1, 3, 6, 9, 12];
export const PONTOS_PARA_VENCER = 12;
export const TEMPO_DA_DECISAO = 30_000;
export const TEMPO_DO_AUSENTE = 2_000;
/** A rodada fechada fica na mesa um pouco, para todos verem a última carta. */
export const PAUSA_DA_RODADA = 1_600;
export const PAUSA_DA_MAO = 3_500;

/** A carta é o valor e o naipe juntos: '4o', 'Qe', 'Ap', '3c'. */
export type Carta = string;

export function baralho(): Carta[] {
  return VALORES.flatMap((v) => NAIPES.map((n) => `${v}${n}`));
}

const valorDe = (c: Carta) => c.slice(0, -1);
const naipeDe = (c: Carta) => c.slice(-1);

/** A manilha que a vira pede: o valor seguinte, em roda. */
export function manilhaDa(vira: Carta): string {
  const i = VALORES.indexOf(valorDe(vira) as (typeof VALORES)[number]);
  return VALORES[(i + 1) % VALORES.length];
}

/** A força da carta: 0 a 9 pelo valor, e as manilhas de 100 a 103 pelo naipe. */
export function forca(carta: Carta, manilha: string): number {
  if (valorDe(carta) === manilha) return 100 + NAIPES.indexOf(naipeDe(carta) as (typeof NAIPES)[number]);
  return VALORES.indexOf(valorDe(carta) as (typeof VALORES)[number]);
}

/** O resultado de uma rodada: o time (0 ou 1) ou 'empate'. */
export type Resultado = 0 | 1 | 'empate';

/**
 * Quem leva a mão pelos resultados até aqui: o time, 'ninguem' (as três empatadas), ou null (ainda não se sabe).
 */
export function quemLevaAMao(r: Resultado[]): 0 | 1 | 'ninguem' | null {
  if (r.length < 2) return null;
  const [a, b, c] = r;
  if (r.length === 2) {
    if (a !== 'empate' && (b === a || b === 'empate')) return a;
    if (a === 'empate' && b !== 'empate') return b;
    return null;
  }
  if (c !== 'empate') return c;
  if (a !== 'empate') return a;
  return 'ninguem';
}

interface NaMesa {
  lugar: number;
  carta: Carta;
  coberta: boolean;
}

/**
 * Quem ganha a rodada: o time e o lugar da carta mais forte (o primeiro que a jogou, se o parceiro empatou com ele), ou o
 * empate, quando os dois times chegam à mesma força. A coberta não conta.
 */
export function quemGanhaARodada(mesa: NaMesa[], manilha: string): { resultado: Resultado; lugar: number | null } {
  const forcas = mesa.map((m) => (m.coberta ? -1 : forca(m.carta, manilha)));
  const maior = Math.max(...forcas);
  if (maior < 0) return { resultado: 'empate', lugar: null };
  const no = mesa.filter((_, i) => forcas[i] === maior);
  const times = new Set(no.map((m) => m.lugar % 2));
  if (times.size > 1) return { resultado: 'empate', lugar: null };
  return { resultado: (no[0].lugar % 2) as 0 | 1, lugar: no[0].lugar };
}

export type Fase = 'mao-de-onze' | 'jogando' | 'truco' | 'rodada' | 'resultado' | 'fim';

export type Ocorrido =
  | { tipo: 'rodada'; resultado: Resultado; lugar: number | null }
  | { tipo: 'mao'; time: 0 | 1 | null; pontos: number }
  | { tipo: 'correu'; lugar: number; time: 0 | 1; pontos: number }
  | { tipo: 'onze-jogar'; lugar: number | null }
  | { tipo: 'onze-correu'; lugar: number | null; time: 0 | 1; pontos: number };

export interface OpcoesDoTruco {
  agora?: () => number;
  aleatorio?: () => number;
  /** Para o teste: o baralho de cada mão, na ordem. O lugar s recebe as cartas s*3 a s*3+2, e a vira vem depois. */
  baralhos?: Carta[][];
  /** Para o teste: os pontos no começo. */
  pontos?: [number, number];
}

export const truco: Definicao = criarTruco();

export function criarTruco({ agora = Date.now, aleatorio = Math.random, baralhos = [], pontos: pontosDoTeste }: OpcoesDoTruco = {}): Definicao {
  return {
    minimo: 2,
    maximo: 4,
    comecar(ctx, { naSala }) {
      if (naSala.length !== 2 && naSala.length !== 4) return 'O truco é jogado em 2 ou em 4.';
      const n = naSala.length;
      /** Os lugares em roda: os pares (0 e 2) contra os ímpares (1 e 3); em quatro, o parceiro fica em frente. */
      const lugares = embaralhar([...naSala], aleatorio);
      const timeDe = (lugar: number) => (lugar % 2) as 0 | 1;
      const lugarDe = (userId: number) => lugares.indexOf(userId);
      const membros = (time: 0 | 1) => lugares.filter((_, i) => timeDe(i) === time);
      const evento = `truco-${ctx.comunidade ?? 0}-${agora()}`;
      const fila = baralhos.map((b) => [...b]);

      let fase: Fase = 'jogando';
      const pontos: [number, number] = pontosDoTeste ? [...pontosDoTeste] : [0, 0];
      let numeroDaMao = 0;
      /** Quem é "mão" (joga primeiro) nesta mão: anda um lugar a cada mão. */
      let quemComeca = 0;
      let maos: Carta[][] = [];
      let vira: Carta = '4o';
      let manilha = '5';
      let resultados: Resultado[] = [];
      let mesa: NaMesa[] = [];
      let lider = 0;
      let vez = 0;
      let valor = 1;
      /** Quem pode pedir o próximo aumento: null antes do primeiro truco (qualquer um, na vez). */
      let podeAumentar: 0 | 1 | null = null;
      let semTruco = false;
      /** A dupla que decide a mão de onze. */
      let onze: 0 | 1 | null = null;
      let pedido: { lugar: number; time: 0 | 1; valor: number; anterior: number } | null = null;
      let vencedor: 0 | 1 | null = null;
      let interrompida = false;
      let ultimo: (Ocorrido & { id: number }) | null = null;
      let idDoOcorrido = 0;
      const contar = (o: Ocorrido) => {
        ultimo = { ...o, id: ++idDoOcorrido };
      };

      const presentes = () => {
        const sala = new Set(ctx.naSala());
        return lugares.filter((id) => sala.has(id));
      };
      const presente = (lugar: number) => ctx.naSala().includes(lugares[lugar]);

      /** Faltou gente: menos de 2 na sala, ou uma dupla inteira fora. */
      const conferirFim = () => {
        if (fase === 'fim') return true;
        const aqui = new Set(presentes());
        if (aqui.size < 2 || ([0, 1] as const).some((t) => !membros(t).some((id) => aqui.has(id)))) {
          interrompida = true;
          fase = 'fim';
          pedido = null;
          ctx.terminar(false);
          ctx.avisar();
          return true;
        }
        return false;
      };

      const proximoValor = (v: number) => VALORES_DA_MAO[VALORES_DA_MAO.indexOf(v) + 1] ?? null;

      /** O relógio da vez de jogar: 30 s, ou 2 s para quem saiu da sala. */
      let prazoCurto = false;
      const marcarVez = () => {
        prazoCurto = !presente(vez);
        ctx.agendar(prazoCurto ? TEMPO_DO_AUSENTE : TEMPO_DA_DECISAO, () => {
          if (conferirFim()) return;
          if (fase !== 'jogando') return;
          // o tempo acabou: a carta mais fraca, aberta
          const mao = maos[vez];
          const fraca = [...mao].sort((a, b) => forca(a, manilha) - forca(b, manilha))[0];
          jogar(vez, fraca, false);
        });
      };

      const darAsCartas = () => {
        numeroDaMao++;
        const cartas = fila.shift() ?? embaralhar(baralho(), aleatorio);
        maos = lugares.map((_, s) => cartas.slice(s * 3, s * 3 + 3));
        vira = cartas[n * 3];
        manilha = manilhaDa(vira);
        resultados = [];
        mesa = [];
        lider = quemComeca;
        vez = quemComeca;
        valor = 1;
        podeAumentar = null;
        pedido = null;
        onze = null;
        semTruco = false;
        const com11 = ([0, 1] as const).filter((t) => pontos[t] === PONTOS_PARA_VENCER - 1);
        if (com11.length === 2) {
          // mão de ferro: uma mão comum, valendo 1, sem truco
          semTruco = true;
          fase = 'jogando';
          marcarVez();
        } else if (com11.length === 1) {
          onze = com11[0];
          semTruco = true;
          fase = 'mao-de-onze';
          ctx.agendar(TEMPO_DA_DECISAO, () => {
            if (conferirFim()) return;
            decidirOnze(null, true);
          });
        } else {
          fase = 'jogando';
          marcarVez();
        }
        ctx.avisar();
      };

      const proximaMao = () => {
        quemComeca = (quemComeca + 1) % n;
        darAsCartas();
      };

      /** A mão acabou: marca, e vê se a partida acabou. */
      const fecharMao = (time: 0 | 1 | null, valendo: number) => {
        if (time !== null) pontos[time] = Math.min(PONTOS_PARA_VENCER, pontos[time] + valendo);
        pedido = null;
        if (time !== null && pontos[time] >= PONTOS_PARA_VENCER) {
          vencedor = time;
          fase = 'fim';
          ctx.terminar(true);
          ctx.avisar();
          return;
        }
        fase = 'resultado';
        ctx.agendar(PAUSA_DA_MAO, () => {
          if (conferirFim()) return;
          proximaMao();
        });
        ctx.avisar();
      };

      const decidirOnze = (lugar: number | null, jogarAMao: boolean) => {
        if (jogarAMao) {
          valor = 3;
          contar({ tipo: 'onze-jogar', lugar });
          fase = 'jogando';
          onze = null;
          marcarVez();
          ctx.avisar();
          return;
        }
        const outro = (1 - onze!) as 0 | 1;
        contar({ tipo: 'onze-correu', lugar, time: onze!, pontos: 1 });
        onze = null;
        fecharMao(outro, 1);
      };

      const jogar = (lugar: number, carta: Carta, coberta: boolean) => {
        maos[lugar] = maos[lugar].filter((c) => c !== carta);
        mesa.push({ lugar, carta, coberta });
        if (mesa.length < n) {
          vez = (vez + 1) % n;
          marcarVez();
          ctx.avisar();
          return;
        }
        // a rodada fechou
        const { resultado, lugar: ganhou } = quemGanhaARodada(mesa, manilha);
        resultados.push(resultado);
        contar({ tipo: 'rodada', resultado, lugar: ganhou });
        lider = ganhou ?? lider;
        const mao = quemLevaAMao(resultados);
        if (mao !== null) {
          // a mesa fica à vista durante o resultado
          if (mao === 'ninguem') {
            contar({ tipo: 'mao', time: null, pontos: 0 });
            fecharMao(null, 0);
          } else {
            contar({ tipo: 'mao', time: mao, pontos: valor });
            fecharMao(mao, valor);
          }
          return;
        }
        fase = 'rodada';
        ctx.agendar(PAUSA_DA_RODADA, () => {
          if (conferirFim()) return;
          mesa = [];
          vez = lider;
          fase = 'jogando';
          marcarVez();
          ctx.avisar();
        });
        ctx.avisar();
      };

      const marcarResposta = () => {
        ctx.agendar(TEMPO_DA_DECISAO, () => {
          if (conferirFim()) return;
          if (fase === 'truco' && pedido) correr(null);
        });
      };

      const correr = (lugar: number | null) => {
        const p = pedido!;
        const quemCorreu = lugar ?? lugares.findIndex((_, s) => timeDe(s) !== p.time && presente(s));
        contar({ tipo: 'correu', lugar: quemCorreu < 0 ? (p.lugar + 1) % n : quemCorreu, time: (1 - p.time) as 0 | 1, pontos: p.anterior });
        fecharMao(p.time, p.anterior);
      };

      darAsCartas();

      return {
        publico(quem) {
          const meu = lugarDe(quem);
          const meuTime = meu >= 0 ? timeDe(meu) : null;
          const sala = new Set(ctx.naSala());
          const naVez = fase === 'jogando' && meu === vez;
          const proximo = valor < PONTOS_PARA_VENCER ? proximoValor(valor) : null;
          const possoPedir =
            naVez && !semTruco && pedido === null && proximo !== null && (podeAumentar === null || podeAumentar === meuTime);
          const respondo = fase === 'truco' && pedido !== null && meuTime !== null && meuTime !== pedido.time;
          const parceiro = n === 4 && meu >= 0 ? (meu + 2) % 4 : -1;
          return {
            fase,
            partidaId: evento,
            lugares: lugares.map((userId, s) => ({
              userId,
              username: ctx.nome(userId),
              lugar: s,
              time: timeDe(s),
              cartas: fase === 'fim' ? 0 : maos[s]?.length ?? 0,
              presente: sala.has(userId),
            })),
            meuLugar: meu >= 0 ? meu : null,
            meuTime,
            mao: meu >= 0 && fase !== 'fim' ? maos[meu] : [],
            maoDoParceiro: fase === 'mao-de-onze' && onze !== null && meuTime === onze && parceiro >= 0 ? maos[parceiro] : null,
            vira,
            manilha,
            numeroDaMao,
            quemComeca,
            mesa: mesa.map((m) => ({ lugar: m.lugar, carta: m.coberta && m.lugar !== meu ? null : m.carta, coberta: m.coberta })),
            rodadas: resultados,
            valor,
            pedido: pedido ? { lugar: pedido.lugar, userId: lugares[pedido.lugar], time: pedido.time, valor: pedido.valor } : null,
            vez: fase === 'jogando' ? lugares[vez] : null,
            vezLugar: fase === 'jogando' ? vez : null,
            possoPedir,
            proximoValor: possoPedir ? proximo : null,
            possoResponder: respondo,
            possoAumentar: respondo && pedido!.valor < PONTOS_PARA_VENCER ? proximoValor(pedido!.valor) : null,
            possoCobrir: naVez && resultados.length >= 1,
            semTruco,
            onze,
            decidoOnze: fase === 'mao-de-onze' && meuTime !== null && meuTime === onze,
            pontos,
            vencedor,
            interrompida,
            ultimo,
          };
        },
        acao(quem, corpo) {
          const meu = lugarDe(quem);
          if (meu < 0) return 'Você está assistindo esta partida.';
          if (fase === 'fim') return 'A partida acabou.';
          const meuTime = timeDe(meu);
          const tipo = String(corpo.tipo ?? '');
          if (tipo === 'onze') {
            if (fase !== 'mao-de-onze' || onze === null) return 'Não há mão de onze agora.';
            if (meuTime !== onze) return 'Quem decide a mão de onze é quem tem 11.';
            decidirOnze(meu, corpo.jogar !== false);
            return null;
          }
          if (tipo === 'aceitar' || tipo === 'correr' || tipo === 'aumentar') {
            if (fase !== 'truco' || !pedido) return 'Não há pedido de truco agora.';
            if (meuTime === pedido.time) return 'Quem responde é o outro lado.';
            if (tipo === 'correr') {
              correr(meu);
              return null;
            }
            if (tipo === 'aceitar') {
              valor = pedido.valor;
              podeAumentar = meuTime;
              pedido = null;
              fase = 'jogando';
              marcarVez();
              ctx.avisar();
              return null;
            }
            const mais = proximoValor(pedido.valor);
            if (mais === null) return 'Não dá para aumentar mais.';
            pedido = { lugar: meu, time: meuTime, valor: mais, anterior: pedido.valor };
            marcarResposta();
            ctx.avisar();
            return null;
          }
          if (fase === 'truco') return 'Espere a resposta do truco.';
          if (fase !== 'jogando') return 'A partida não está em andamento.';
          if (meu !== vez) return 'Espere a sua vez.';
          if (tipo === 'truco') {
            const mais = proximoValor(valor);
            if (semTruco || mais === null || (podeAumentar !== null && podeAumentar !== meuTime)) return 'Agora não dá para pedir truco.';
            pedido = { lugar: meu, time: meuTime, valor: mais, anterior: valor };
            fase = 'truco';
            marcarResposta();
            ctx.avisar();
            return null;
          }
          if (tipo === 'jogar') {
            const carta = String(corpo.carta ?? '');
            if (!maos[meu].includes(carta)) return 'Essa carta não está na sua mão.';
            const coberta = corpo.coberta === true;
            if (coberta && resultados.length < 1) return 'A carta coberta só vale da segunda rodada em diante.';
            jogar(meu, carta, coberta);
            return null;
          }
          return 'Ação desconhecida.';
        },
        conferir() {
          if (conferirFim()) return;
          // quem está na vez saiu: a vez dele vai em 2 s
          if (fase === 'jogando' && !prazoCurto && !presente(vez)) marcarVez();
        },
      };
    },
  };
}
