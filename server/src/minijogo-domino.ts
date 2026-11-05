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
 */
import { embaralhar, type Definicao } from './minijogo-motor.js';

/** Uma pedra: as duas metades, a menor primeiro (na mesa, a ordem é a do encaixe). */
export type Pedra = [number, number];
export type Ponta = 'esquerda' | 'direita';

export const PONTOS_PARA_VENCER = 50;
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
  | { id: number; tipo: 'jogou'; userId: number; pedra: Pedra; ponta: Ponta | null; sozinho: boolean }
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
    comecar(ctx, { naSala }) {
      if (naSala.length < 2) return 'Ainda falta gente para começar.';
      const ordem = embaralhar(naSala.slice(0, MAXIMO_DO_DOMINO), aleatorio);
      const duplas = ordem.length === 4;
      const ladoDe = (lugar: number) => (duplas ? lugar % 2 : lugar);
      const lados = duplas ? 2 : ordem.length;
      const membros = (lado: number) => ordem.filter((_, i) => ladoDe(i) === lado);
      const pontos = new Array<number>(lados).fill(0);
      const partidaId = `domino-${ctx.comunidade ?? 0}-${agora()}`;

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
        const campeao = pontos.findIndex((n) => n >= PONTOS_PARA_VENCER && n === Math.max(...pontos));
        if (campeao >= 0) {
          vencedor = campeao;
          fase = 'fim';
          ctx.terminar(true);
          return;
        }
        fase = 'resultado';
        ctx.agendar(TEMPO_DO_RESULTADO, novaMao);
        ctx.avisar();
      };

      const maosAbertas = () => ordem.map((userId, i) => ({ userId, pedras: maos[i].map((p) => [...p] as Pedra), soma: somaDe(maos[i]) }));
      /** A soma dos adversários de um lado. */
      const somaDosOutros = (lado: number) => ordem.reduce((n, _, i) => (ladoDe(i) === lado ? n : n + somaDe(maos[i])), 0);

      const bater = (lugar: number) => {
        contar({ tipo: 'bateu', userId: ordem[lugar] });
        const lado = ladoDe(lugar);
        fimDaMao({ tipo: 'batida', userId: ordem[lugar], lado, pontos: somaDosOutros(lado), maos: maosAbertas() });
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
            contar({ tipo: 'passou', userId: ordem[vez] });
            vez = (vez + 1) % ordem.length;
            continue;
          }
          relogioDoAusente = !ctx.naSala().includes(ordem[vez]);
          ctx.agendar(relogioDoAusente ? TEMPO_DO_AUSENTE : TEMPO_DA_VEZ, jogarSozinho);
          ctx.avisar();
          return;
        }
        trancar();
      };

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
        contar({ tipo: 'jogou', userId: ordem[lugar], pedra: [a, b], ponta: e ? ponta : null, sozinho });
        if (mao.length === 0) return bater(lugar);
        proximaVez();
      };

      const comprar = (lugar: number, sozinho: boolean) => {
        maos[lugar].push(dorme.pop()!);
        contar({ tipo: 'comprou', userId: ordem[lugar], sozinho });
      };

      /** O tempo acabou (ou a pessoa saiu): compra o que precisar e joga a pedra mais pesada que serve, ou passa. */
      function jogarSozinho() {
        if (fase !== 'jogando') return;
        const lugar = vez;
        while (!podeJogar(lugar) && podeComprar()) comprar(lugar, true);
        const jogaveis = maos[lugar].filter((p) => ondeServe(p).length > 0).sort((p, q) => maisAlta(q, p));
        if (!jogaveis.length) {
          contar({ tipo: 'passou', userId: ordem[lugar] });
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

      novaMao();

      return {
        publico(quem) {
          const sala = new Set(ctx.naSala());
          const meuLugar = ordem.indexOf(quem);
          const minhaVez = fase === 'jogando' && meuLugar === vez;
          const aberto = fase !== 'jogando';
          return {
            fase,
            partidaId,
            duplas,
            alvo: PONTOS_PARA_VENCER,
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
            ctx.agendar(TEMPO_DA_VEZ, jogarSozinho);
            ctx.avisar();
            return null;
          }
          if (tipo === 'passar') {
            if (podeJogar(lugar)) return 'Você tem uma pedra que serve.';
            if (podeComprar()) return 'Compre uma pedra antes de passar.';
            contar({ tipo: 'passou', userId: quem });
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
    },
  };
}
