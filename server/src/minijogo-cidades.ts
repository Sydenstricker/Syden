/**
 * CIDADES À VENDA (04/11/2026, pedido dele: "eu queria um monopoly para jogarmos"): o jogo de comprar terrenos e cobrar
 * aluguel, SÓ A MECÂNICA (que é de domínio público desde o jogo de 1904 que a originou). Nada do nome, das ruas, das cartas,
 * dos cantos ou do visual de ninguém: o tabuleiro é nosso, com capitais do Brasil agrupadas por região, transportes no lugar
 * das companhias, notícias no lugar das cartas, e o desenho é feito por código no site (JogoCidades.tsx).
 *
 * O QUE ELE DECIDIU (04/11/2026): quem começa escolhe entre RODADAS FIXAS (10, 20 ou 30; ganha o maior patrimônio) e ATÉ
 * SOBRAR UM; quem fica sem dinheiro SAI E ASSISTE; há TROCA entre jogadores e LEILÃO quando quem parou não compra; o tema são
 * cidades do Brasil.
 *
 * POR TURNOS, e por isso a rede não pesa. Na vez, a pessoa pede os dados (QUEM SORTEIA É O SERVIDOR), a peça anda, e a casa
 * age quando a peça CHEGA (a fase 'andando' segura o dinheiro até lá: a tela não mostra o aluguel pago antes de a peça parar).
 * Cidade sem dono: comprar, ou vai a leilão para todos. Cidade de outro: paga o aluguel, sozinho. Depois, a fase das AÇÕES: na
 * própria vez, construir, vender prédio, hipotecar, resgatar, propor uma troca, e terminar a vez.
 *
 * O SYDEN DECIDE, QUEM JOGA NÃO ADMINISTRA: quem deve mais do que tem não ganha uma tela de "levante o dinheiro". O servidor
 * vende os prédios (pela metade) e hipoteca as cidades (as mais baratas primeiro) até cobrir; não cobrindo, a pessoa FALE, o
 * que tinha vai para quem ela devia (ou volta ao banco), e ela assiste.
 *
 * NINGUÉM SEGURA A TURMA: os dados saem sozinhos em 20 s, a compra não respondida vai a leilão, as ações acabam em 30 s, a troca
 * não respondida é recusada. Quem saiu da sala é pulado; com menos de 2 que ainda jogam na sala, a partida acaba sem troféu.
 *
 * O QUE O CONSOLE CONSEGUE: nada além de jogar na própria vez. Os dados, as cartas, o aluguel e a falência são do servidor;
 * cada ação confere a vez, a posse, o dinheiro e a regra do grupo.
 *
 * OS TROFÉUS: o pódio (até o 3º) de quem ficou até o fim (ou faliu sem sair antes), com 2 ou mais, vai para a estante do
 * quarto (corrida_trofeus, "pista" 'cidades', os pontos são o patrimônio).
 */
import * as db from './db.js';
import { embaralhar, type Definicao } from './minijogo-motor.js';
import { ehRobo, MAXIMO_DE_ROBOS, NOMES_DOS_ROBOS, PAUSA_DO_ROBO } from './minijogo-robos.js';

export type TipoDaCasa = 'largada' | 'cidade' | 'transporte' | 'noticia' | 'pedagio' | 'engarrafamento' | 'feriado';

export interface Casa {
  tipo: TipoDaCasa;
  /** O nome da cidade (nome próprio: não passa pela tradução), ou o id do transporte ('rodoviaria', 'porto'…). */
  nome?: string;
  uf?: string;
  /** O grupo da cidade (0 a 6, do mais barato ao mais caro), pela região. */
  grupo?: number;
  preco?: number;
  /** O aluguel sem prédio. */
  aluguel?: number;
  /** O preço de cada prédio. */
  custo?: number;
  /** O pedágio. */
  valor?: number;
}

const cidade = (nome: string, uf: string, grupo: number, preco: number): Casa => ({
  tipo: 'cidade',
  nome,
  uf,
  grupo,
  preco,
  aluguel: Math.max(5, Math.round((preco * 0.08) / 5) * 5),
  custo: CUSTO_DO_PREDIO[grupo],
});

/** O prédio custa pelo grupo. */
export const CUSTO_DO_PREDIO = [60, 80, 100, 120, 150, 180, 200];
export const PRECO_DO_TRANSPORTE = 200;

/**
 * AS 32 CASAS, na ordem da volta. Os grupos seguem as regiões (Norte, Nordeste, Centro-Oeste, Sul, Sudeste), do mais barato
 * ao mais caro. Os transportes são quatro diferentes, e o aluguel deles depende de quantos o dono tem.
 */
export const CASAS: Casa[] = [
  { tipo: 'largada' },
  cidade('Boa Vista', 'RR', 0, 100),
  { tipo: 'noticia' },
  cidade('Macapá', 'AP', 0, 120),
  { tipo: 'pedagio', valor: 100 },
  { tipo: 'transporte', nome: 'rodoviaria', preco: PRECO_DO_TRANSPORTE },
  cidade('Porto Velho', 'RO', 1, 160),
  cidade('Manaus', 'AM', 1, 160),
  cidade('Belém', 'PA', 1, 180),
  { tipo: 'engarrafamento' },
  cidade('Teresina', 'PI', 2, 220),
  cidade('São Luís', 'MA', 2, 220),
  { tipo: 'transporte', nome: 'porto', preco: PRECO_DO_TRANSPORTE },
  cidade('João Pessoa', 'PB', 2, 240),
  cidade('Fortaleza', 'CE', 3, 280),
  { tipo: 'noticia' },
  { tipo: 'feriado' },
  cidade('Recife', 'PE', 3, 280),
  cidade('Salvador', 'BA', 3, 300),
  { tipo: 'transporte', nome: 'aeroporto', preco: PRECO_DO_TRANSPORTE },
  cidade('Cuiabá', 'MT', 4, 340),
  cidade('Goiânia', 'GO', 4, 340),
  { tipo: 'pedagio', valor: 150 },
  cidade('Brasília', 'DF', 4, 360),
  { tipo: 'noticia' },
  { tipo: 'transporte', nome: 'ferrovia', preco: PRECO_DO_TRANSPORTE },
  cidade('Porto Alegre', 'RS', 5, 400),
  cidade('Florianópolis', 'SC', 5, 400),
  cidade('Curitiba', 'PR', 5, 420),
  cidade('Belo Horizonte', 'MG', 6, 460),
  cidade('Rio de Janeiro', 'RJ', 6, 480),
  cidade('São Paulo', 'SP', 6, 520),
];

export const ENGARRAFAMENTO = CASAS.findIndex((c) => c.tipo === 'engarrafamento');
export const DINHEIRO_INICIAL = 1500;
export const SALARIO = 200;
/** O aluguel com 0, 1, 2, 3 e 4 prédios, em vezes o aluguel sem prédio. O grupo inteiro sem prédio dobra. */
export const MULTIPLICADOR = [1, 5, 13, 28, 40];
export const MAXIMO_DE_PREDIOS = MULTIPLICADOR.length - 1;
/** O transporte: com 1, 2, 3 e 4 do mesmo dono. */
export const ALUGUEL_DO_TRANSPORTE = [25, 50, 100, 200];
/** Resgatar a hipoteca custa o que ela deu, mais 10%. */
export const JUROS_DO_RESGATE = 1.1;
export const LANCE_MINIMO = 10;
export const RODADAS_DAS_CIDADES = [10, 20, 30];
export const MAXIMO_DAS_CIDADES = 6;
/**
 * OS ADVERSÁRIOS DO COMPUTADOR (pedido dele, 05/11/2026: "opção de jogar sozinho, contra IA"). Só no Solo: a pessoa escolhe
 * de 1 a 5, e eles entram na ordem como jogadores de id NEGATIVO. As constantes são as de todos os jogos com robôs
 * (minijogo-robos.ts).
 */
export { NOMES_DOS_ROBOS, MAXIMO_DE_ROBOS, PAUSA_DO_ROBO };
/** Trocas propostas por vez: cada uma dá um relógio novo, e sem limite uma pessoa seguraria a turma. */
export const TROCAS_POR_VEZ = 3;

export const TEMPO_DA_VEZ = 20_000;
export const TEMPO_DA_COMPRA = 15_000;
export const TEMPO_DAS_ACOES = 30_000;
export const TEMPO_DA_TROCA = 20_000;
/** O leilão: o primeiro prazo, e o que cada lance novo devolve ("dou-lhe uma"). */
export const TEMPO_DO_LEILAO = 12_000;
export const TEMPO_APOS_LANCE = 8_000;
/** O andar na tela: cada casa, e uma folga no fim. */
export const PASSO_MS = 220;
export const CHEGADA_MS = 400;

/** As notícias (nossas): o id é o que o site traduz. */
export const CARTAS = [
  'quadrilha', // receba 100
  'bolso', // receba 50
  'feira', // receba 150
  'carro', // pague 100
  'multa', // pague 50
  'largada', // vá até a Largada
  'carona', // avance 3 casas
  'onibus-errado', // volte 3 casas
  'chuva', // vá para o Engarrafamento
  'reforma', // pague 25 por prédio
  'aniversario', // cada um te dá 10
  'festa', // pague 15 a cada um
  'passagem', // avance até o próximo transporte
] as const;
export type Carta = (typeof CARTAS)[number];
export const VALOR_DA_CARTA: Partial<Record<Carta, number>> = {
  quadrilha: 100,
  bolso: 50,
  feira: 150,
  carro: 100,
  multa: 50,
  reforma: 25,
  aniversario: 10,
  festa: 15,
};

/** O que aconteceu, para a tela contar (o site monta a frase traduzida). */
export type Ocorrido =
  | { tipo: 'salario'; userId: number; valor: number }
  | { tipo: 'aluguel'; de: number; para: number; casa: number; valor: number }
  | { tipo: 'comprou'; userId: number; casa: number; valor: number }
  | { tipo: 'leilao'; userId: number | null; casa: number; valor: number }
  | { tipo: 'carta'; userId: number; carta: Carta; valor: number | null }
  | { tipo: 'pedagio'; userId: number; valor: number }
  | { tipo: 'engarrafado'; userId: number }
  | { tipo: 'perdeu-vez'; userId: number }
  | { tipo: 'vendeu-para-pagar'; userId: number; valor: number }
  | { tipo: 'faliu'; userId: number; credor: number | null }
  | { tipo: 'troca'; de: number; para: number; aceita: boolean }
  | { tipo: 'construiu' | 'vendeu-predio' | 'hipotecou' | 'resgatou'; userId: number; casa: number };

interface Jogador {
  userId: number;
  pos: number;
  dinheiro: number;
  falido: boolean;
  /** Vezes a perder (o engarrafamento). */
  parado: number;
}

interface Posse {
  dono: number;
  predios: number;
  hipotecada: boolean;
}

export interface Proposta {
  de: number;
  para: number;
  darCasas: number[];
  darDinheiro: number;
  pedirCasas: number[];
  pedirDinheiro: number;
}

export interface OpcoesDasCidades {
  agora?: () => number;
  aleatorio?: () => number;
  /** Para o teste: o dinheiro de cada um no começo e a ordem das cartas. */
  dinheiroInicial?: number;
  cartas?: Carta[];
  /** Para o teste: cidades que já começam com dono ([casa, dono, prédios]). */
  posses?: [number, number, number?][];
}

export const cidades: Definicao = criarCidades();

export function criarCidades({ agora = Date.now, aleatorio = Math.random, dinheiroInicial = DINHEIRO_INICIAL, cartas, posses: possesDoTeste = [] }: OpcoesDasCidades = {}): Definicao {
  return {
    minimo: 2,
    maximo: MAXIMO_DAS_CIDADES,
    comecar(ctx, { naSala, corpo }) {
      // os robôs só no Solo: na sala, a turma é a graça (e o troféu é de gente contra gente)
      const robos = ctx.solo ? Math.min(MAXIMO_DE_ROBOS, Math.max(0, Math.floor(Number(corpo.robos) || 0))) : 0;
      if (naSala.length + robos < 2) return 'Ainda falta gente para começar.';
      const modo: 'rodadas' | 'falencia' = corpo.modo === 'falencia' ? 'falencia' : 'rodadas';
      const rodadas = modo === 'rodadas' ? (RODADAS_DAS_CIDADES.includes(Number(corpo.rodadas)) ? Number(corpo.rodadas) : 20) : null;
      const inteiro = (n: number) => Math.floor(aleatorio() * n);
      const idsDosRobos = Array.from({ length: robos }, (_, k) => -(k + 1));
      const ordem = embaralhar([...naSala.slice(0, MAXIMO_DAS_CIDADES - robos), ...idsDosRobos], aleatorio);
      const jogadores = new Map<number, Jogador>(ordem.map((userId) => [userId, { userId, pos: 0, dinheiro: dinheiroInicial, falido: false, parado: 0 }]));
      const avatares = new Map(ordem.map((id) => [id, ehRobo(id) ? null : (db.findUserById(id)?.avatarPronto ?? null)]));
      const nome = (id: number) => (ehRobo(id) ? `🤖 ${NOMES_DOS_ROBOS[-id - 1]}` : ctx.nome(id));
      /** O jeito de cada robô: uns pagam mais caro que outros no leilão (de 0,8 a 1,15 do preço). */
      const jeito = new Map(idsDosRobos.map((id) => [id, 0.8 + aleatorio() * 0.35]));
      const posses = new Map<number, Posse>(
        possesDoTeste.filter(([, dono]) => jogadores.has(dono)).map(([casa, dono, predios = 0]) => [casa, { dono, predios, hipotecada: false }]),
      );
      const evento = `cidades-${ctx.comunidade ?? 0}-${agora()}`;
      let fase: 'vez' | 'andando' | 'compra' | 'leilao' | 'acoes' | 'troca' | 'fim' = 'vez';
      let rodada = 1;
      let indice = 0;
      let trocasNaVez = 0;
      /** A ordem em que faliram: quem faliu depois fica na frente de quem faliu antes. */
      const falencias: number[] = [];
      /** Quem esteve na sala até o fim (ou até falir): só eles levam troféu. */
      const ficaram = new Set(ordem);
      let interrompida = false;
      let saco: Carta[] = cartas ? [...cartas] : [];
      let ultimo: { id: number; userId: number; dados: [number, number] | null; caminho: number[] } | null = null;
      let idDoUltimo = 0;
      /** Para onde a peça vai quando chegar (o salário de quem passou pela largada só cai na chegada). */
      let chegada: { userId: number; salario: boolean; preso: boolean } | null = null;
      let leilao: { casa: number; lance: number; lider: number | null } | null = null;
      let troca: Proposta | null = null;
      const historico: (Ocorrido & { id: number })[] = [];
      let idDoOcorrido = 0;
      const contar = (o: Ocorrido) => {
        historico.push({ ...o, id: ++idDoOcorrido });
        if (historico.length > 12) historico.shift();
      };

      const daVez = () => ordem[indice];
      const presentes = () => {
        const sala = new Set(ctx.naSala());
        return ordem.filter((id) => ehRobo(id) || sala.has(id));
      };
      const anotarAusentes = (aqui: number[]) => {
        for (const id of [...ficaram]) if (!aqui.includes(id) && !jogadores.get(id)!.falido) ficaram.delete(id);
      };
      const ativos = () => ordem.filter((id) => !jogadores.get(id)!.falido);

      /** O valor de tudo o que a pessoa tem: o dinheiro, as cidades (a hipotecada vale a metade) e os prédios. */
      const patrimonio = (userId: number) => {
        let total = jogadores.get(userId)!.dinheiro;
        for (const [i, p] of posses) {
          if (p.dono !== userId) continue;
          const casa = CASAS[i];
          total += p.hipotecada ? Math.floor(casa.preco! / 2) : casa.preco!;
          total += p.predios * (casa.custo ?? 0);
        }
        return total;
      };

      /** Acabou? Sobrou um que não faliu (fim de verdade), ou menos de 2 que jogam na sala (interrompida). */
      const conferirFim = (aqui = presentes()) => {
        if (fase === 'fim') return true;
        // contra o computador, a pessoa que faliu não fica assistindo os robôs jogarem entre si
        if (ativos().length <= 1 || (robos > 0 && !ativos().some((id) => !ehRobo(id)))) {
          terminar();
          return true;
        }
        if (aqui.filter((id) => !jogadores.get(id)!.falido).length < 2) {
          interrompida = true;
          terminar();
          return true;
        }
        return false;
      };

      const grupoInteiro = (grupo: number) => CASAS.map((c, i) => ({ c, i })).filter(({ c }) => c.tipo === 'cidade' && c.grupo === grupo).map(({ i }) => i);
      const temOGrupo = (dono: number, grupo: number) => grupoInteiro(grupo).every((i) => posses.get(i)?.dono === dono);
      const prediosNoGrupo = (grupo: number) => grupoInteiro(grupo).reduce((n, i) => n + (posses.get(i)?.predios ?? 0), 0);

      const aluguelDe = (i: number): number => {
        const casa = CASAS[i];
        const p = posses.get(i);
        if (!p || p.hipotecada) return 0;
        if (casa.tipo === 'transporte') {
          const n = CASAS.filter((c, k) => c.tipo === 'transporte' && posses.get(k)?.dono === p.dono).length;
          return ALUGUEL_DO_TRANSPORTE[Math.max(0, n - 1)];
        }
        if (p.predios > 0) return casa.aluguel! * MULTIPLICADOR[p.predios];
        return casa.aluguel! * (temOGrupo(p.dono, casa.grupo!) ? 2 : 1);
      };

      /**
       * QUEM DEVE PAGA, e o Syden levanta o dinheiro se faltar: vende os prédios (pela metade, dos mais caros primeiro) e
       * hipoteca as cidades (as mais baratas primeiro). Não cobrindo, a pessoa fale: o que tinha vai para quem ela devia, ou
       * volta ao banco. Devolve false se ela faliu.
       */
      const cobrar = (devedor: number, credor: number | null, valor: number): boolean => {
        const j = jogadores.get(devedor)!;
        if (j.falido || valor <= 0) return !j.falido;
        if (j.dinheiro < valor) {
          let levantou = 0;
          const minhas = () => [...posses.entries()].filter(([, p]) => p.dono === devedor);
          // os prédios: um de cada vez, sempre do mais caro que ainda tem
          while (j.dinheiro < valor) {
            const com = minhas().filter(([, p]) => p.predios > 0).sort((a, b) => CASAS[b[0]].custo! - CASAS[a[0]].custo!);
            if (!com.length) break;
            const [i, p] = com[0];
            p.predios--;
            const ganho = Math.floor(CASAS[i].custo! / 2);
            j.dinheiro += ganho;
            levantou += ganho;
          }
          // as hipotecas: das mais baratas
          while (j.dinheiro < valor) {
            const livres = minhas().filter(([, p]) => !p.hipotecada).sort((a, b) => CASAS[a[0]].preco! - CASAS[b[0]].preco!);
            if (!livres.length) break;
            const [i, p] = livres[0];
            p.hipotecada = true;
            const ganho = Math.floor(CASAS[i].preco! / 2);
            j.dinheiro += ganho;
            levantou += ganho;
          }
          if (levantou) contar({ tipo: 'vendeu-para-pagar', userId: devedor, valor: levantou });
        }
        if (j.dinheiro < valor) {
          falir(devedor, credor);
          return false;
        }
        j.dinheiro -= valor;
        if (credor !== null) jogadores.get(credor)!.dinheiro += valor;
        return true;
      };

      const falir = (userId: number, credor: number | null) => {
        const j = jogadores.get(userId)!;
        const herdeiro = credor !== null && !jogadores.get(credor)!.falido ? credor : null;
        if (herdeiro !== null) jogadores.get(herdeiro)!.dinheiro += j.dinheiro;
        j.dinheiro = 0;
        for (const [i, p] of [...posses]) {
          if (p.dono !== userId) continue;
          // os prédios já foram vendidos para pagar; a hipoteca vai junto para o herdeiro (o banco recebe a cidade limpa)
          if (herdeiro !== null) posses.set(i, { dono: herdeiro, predios: 0, hipotecada: p.hipotecada });
          else posses.delete(i);
        }
        j.falido = true;
        falencias.push(userId);
        contar({ tipo: 'faliu', userId, credor: herdeiro });
      };

      /** A vez de alguém: quem saiu da sala, faliu ou está no engarrafamento é pulado. */
      const comecarVez = () => {
        for (let guarda = 0; guarda < ordem.length * 4 + 4; guarda++) {
          const aqui = presentes();
          anotarAusentes(aqui);
          if (conferirFim(aqui)) return;
          if (indice >= ordem.length) {
            if (rodadas !== null && rodada >= rodadas) return terminar();
            rodada++;
            indice = 0;
          }
          const j = jogadores.get(daVez())!;
          if (j.falido || !aqui.includes(j.userId)) {
            indice++;
            continue;
          }
          if (j.parado > 0) {
            j.parado--;
            contar({ tipo: 'perdeu-vez', userId: j.userId });
            indice++;
            continue;
          }
          fase = 'vez';
          trocasNaVez = 0;
          troca = null;
          leilao = null;
          ctx.agendar(ehRobo(j.userId) ? PAUSA_DO_ROBO : TEMPO_DA_VEZ, () => jogarDados(j.userId));
          ctx.avisar();
          return;
        }
        terminar();
      };

      const proximaVez = () => {
        indice++;
        comecarVez();
      };

      /** A peça anda (pelos dados ou por uma carta); a casa só age quando ela chegar. */
      const mover = (userId: number, caminho: number[], dados: [number, number] | null, { salario = false, preso = false } = {}) => {
        const j = jogadores.get(userId)!;
        j.pos = caminho[caminho.length - 1];
        ultimo = { id: ++idDoUltimo, userId, dados, caminho };
        chegada = { userId, salario, preso };
        fase = 'andando';
        ctx.agendar(Math.max(0, caminho.length - 1) * PASSO_MS + CHEGADA_MS, chegar);
        ctx.avisar();
      };

      /** O caminho de `de` andando `passos` (negativo volta), e se passou pela largada indo para a frente. */
      const caminhoDe = (de: number, passos: number) => {
        const caminho = [de];
        let pos = de;
        let passou = false;
        for (let k = 0; k < Math.abs(passos); k++) {
          pos = (pos + (passos > 0 ? 1 : -1) + CASAS.length) % CASAS.length;
          if (passos > 0 && pos === 0) passou = true;
          caminho.push(pos);
        }
        return { caminho, passou };
      };

      const jogarDados = (quem: number) => {
        if (fase !== 'vez' || quem !== daVez()) return;
        const dados: [number, number] = [1 + inteiro(6), 1 + inteiro(6)];
        const { caminho, passou } = caminhoDe(jogadores.get(quem)!.pos, dados[0] + dados[1]);
        mover(quem, caminho, dados, { salario: passou });
      };

      const abrirAcoes = () => {
        const quem = daVez();
        if (conferirFim()) return;
        if (jogadores.get(quem)!.falido) return proximaVez();
        fase = 'acoes';
        if (ehRobo(quem))
          ctx.agendar(PAUSA_DO_ROBO, () => {
            if (fase !== 'acoes' || daVez() !== quem) return;
            roboAdministra(quem);
            proximaVez();
          });
        else ctx.agendar(TEMPO_DAS_ACOES, proximaVez);
        ctx.avisar();
      };

      const chegar = () => {
        if (fase !== 'andando' || !chegada) return;
        const { userId, salario, preso } = chegada;
        chegada = null;
        const j = jogadores.get(userId)!;
        if (salario) {
          j.dinheiro += SALARIO;
          contar({ tipo: 'salario', userId, valor: SALARIO });
        }
        if (preso) {
          j.parado = 1;
          contar({ tipo: 'engarrafado', userId });
          return abrirAcoes();
        }
        const casa = CASAS[j.pos];
        switch (casa.tipo) {
          case 'cidade':
          case 'transporte': {
            const p = posses.get(j.pos);
            if (!p) {
              fase = 'compra';
              const casaDaCompra = j.pos;
              if (ehRobo(userId))
                ctx.agendar(PAUSA_DO_ROBO, () => {
                  if (fase !== 'compra') return;
                  if (!roboCompra(userId, casaDaCompra) || comprar(userId) !== null) abrirLeilao(casaDaCompra);
                });
              else ctx.agendar(TEMPO_DA_COMPRA, () => abrirLeilao(casaDaCompra));
              ctx.avisar();
              return;
            }
            if (p.dono !== userId && !p.hipotecada) {
              const valor = aluguelDe(j.pos);
              const dono = p.dono;
              if (cobrar(userId, dono, valor)) contar({ tipo: 'aluguel', de: userId, para: dono, casa: j.pos, valor });
            }
            return abrirAcoes();
          }
          case 'pedagio':
            if (cobrar(userId, null, casa.valor!)) contar({ tipo: 'pedagio', userId, valor: casa.valor! });
            return abrirAcoes();
          case 'engarrafamento':
            j.parado = 1;
            contar({ tipo: 'engarrafado', userId });
            return abrirAcoes();
          case 'noticia':
            return tirarCarta(userId);
          default:
            return abrirAcoes();
        }
      };

      const tirarCarta = (userId: number) => {
        if (!saco.length) saco = embaralhar([...CARTAS], aleatorio);
        const carta = saco.shift()!;
        const j = jogadores.get(userId)!;
        const valor = VALOR_DA_CARTA[carta] ?? null;
        contar({ tipo: 'carta', userId, carta, valor });
        const outros = ativos().filter((id) => id !== userId);
        switch (carta) {
          case 'quadrilha':
          case 'bolso':
          case 'feira':
            j.dinheiro += valor!;
            break;
          case 'carro':
          case 'multa':
            cobrar(userId, null, valor!);
            break;
          case 'reforma': {
            const predios = [...posses.values()].filter((p) => p.dono === userId).reduce((n, p) => n + p.predios, 0);
            cobrar(userId, null, predios * valor!);
            break;
          }
          case 'aniversario':
            for (const o of outros) cobrar(o, userId, valor!);
            break;
          case 'festa':
            for (const o of outros) if (!cobrar(userId, o, valor!)) break;
            break;
          case 'largada': {
            const { caminho } = caminhoDe(j.pos, (CASAS.length - j.pos) % CASAS.length || CASAS.length);
            return mover(userId, caminho, null, { salario: true });
          }
          case 'carona': {
            const { caminho, passou } = caminhoDe(j.pos, 3);
            return mover(userId, caminho, null, { salario: passou });
          }
          case 'onibus-errado':
            return mover(userId, caminhoDe(j.pos, -3).caminho, null);
          case 'passagem': {
            let passos = 1;
            while (CASAS[(j.pos + passos) % CASAS.length].tipo !== 'transporte') passos++;
            const { caminho, passou } = caminhoDe(j.pos, passos);
            return mover(userId, caminho, null, { salario: passou });
          }
          case 'chuva':
            // direto, sem passar pela largada (nem pelo salário)
            return mover(userId, [j.pos, ENGARRAFAMENTO], null, { preso: true });
        }
        abrirAcoes();
      };

      const comprar = (quem: number) => {
        const j = jogadores.get(quem)!;
        const casa = CASAS[j.pos];
        if (j.dinheiro < casa.preco!) return 'Dinheiro insuficiente.';
        j.dinheiro -= casa.preco!;
        posses.set(j.pos, { dono: quem, predios: 0, hipotecada: false });
        contar({ tipo: 'comprou', userId: quem, casa: j.pos, valor: casa.preco! });
        abrirAcoes();
        return null;
      };

      /** Quem pode dar lance: quem joga, não faliu e está na sala. */
      const podeDarLance = (quem: number) => jogadores.has(quem) && !jogadores.get(quem)!.falido && (ehRobo(quem) || ctx.naSala().includes(quem));

      /** Quando o leilão fecha, se ninguém mais der lance (hora do relógio da partida). */
      let leilaoFechaEm = 0;

      /**
       * O relógio do leilão. Se algum robô quer cobrir o lance, ele dá o lance depois de uma pausa; senão, o relógio vai até
       * o fechamento. Um lance de gente (ou de robô) chama de novo, e é assim que os robôs disputam entre si e com a pessoa.
       */
      const agendarLeilao = () => {
        if (fase !== 'leilao' || !leilao) return;
        const falta = Math.max(0, leilaoFechaEm - agora());
        if (roboQueCobre() && falta > PAUSA_DO_ROBO) {
          ctx.agendar(PAUSA_DO_ROBO, () => {
            if (fase !== 'leilao' || !leilao) return;
            const quem = roboQueCobre();
            if (quem) darLance(quem.id, quem.valor);
            else agendarLeilao();
          });
        } else ctx.agendar(falta, fecharLeilao);
      };

      const darLance = (quem: number, valor: number) => {
        leilao!.lance = valor;
        leilao!.lider = quem;
        leilaoFechaEm = agora() + TEMPO_APOS_LANCE;
        agendarLeilao();
        ctx.avisar();
      };

      const abrirLeilao = (casa: number) => {
        if (fase !== 'compra') return;
        fase = 'leilao';
        leilao = { casa, lance: 0, lider: null };
        leilaoFechaEm = agora() + TEMPO_DO_LEILAO;
        agendarLeilao();
        ctx.avisar();
      };

      const fecharLeilao = () => {
        if (fase !== 'leilao' || !leilao) return;
        const { casa, lance, lider } = leilao;
        leilao = null;
        if (lider !== null && !jogadores.get(lider)!.falido && jogadores.get(lider)!.dinheiro >= lance) {
          jogadores.get(lider)!.dinheiro -= lance;
          posses.set(casa, { dono: lider, predios: 0, hipotecada: false });
          contar({ tipo: 'leilao', userId: lider, casa, valor: lance });
        } else {
          contar({ tipo: 'leilao', userId: null, casa, valor: 0 });
        }
        abrirAcoes();
      };

      /** Confere uma proposta de troca com o tabuleiro de agora. Devolve o erro, ou null. */
      const conferirProposta = (t: Proposta): string | null => {
        const de = jogadores.get(t.de);
        const para = jogadores.get(t.para);
        if (!de || !para || t.de === t.para || de.falido || para.falido) return 'Escolha alguém que ainda está no jogo.';
        if (!ehRobo(t.para) && !ctx.naSala().includes(t.para)) return 'Escolha alguém que ainda está no jogo.';
        if (!t.darCasas.length && !t.pedirCasas.length && !t.darDinheiro && !t.pedirDinheiro) return 'A troca está vazia.';
        if (t.darDinheiro > de.dinheiro || t.pedirDinheiro > para.dinheiro) return 'Dinheiro insuficiente.';
        for (const [casas, dono] of [[t.darCasas, t.de], [t.pedirCasas, t.para]] as const) {
          for (const i of casas) {
            const p = posses.get(i);
            if (!p || p.dono !== dono) return 'Essa cidade não é de quem a troca diz.';
            // com prédio no grupo, vende-se o prédio antes (senão o prédio iria junto, e o grupo ficaria partido com prédios)
            if (CASAS[i].tipo === 'cidade' && prediosNoGrupo(CASAS[i].grupo!) > 0) return 'Venda os prédios do grupo antes de trocar.';
          }
        }
        return null;
      };

      const lerProposta = (quem: number, corpo: Record<string, unknown>): Proposta => {
        const casas = (v: unknown) =>
          Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < CASAS.length))].slice(0, CASAS.length) : [];
        const dinheiro = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Math.min(Number(v), 1_000_000) : 0);
        return {
          de: quem,
          para: Number(corpo.para),
          darCasas: casas(corpo.darCasas),
          darDinheiro: dinheiro(corpo.darDinheiro),
          pedirCasas: casas(corpo.pedirCasas),
          pedirDinheiro: dinheiro(corpo.pedirDinheiro),
        };
      };

      const fecharTroca = (aceita: boolean) => {
        if (fase !== 'troca' || !troca) return;
        const t = troca;
        troca = null;
        if (aceita && conferirProposta(t) === null) {
          const de = jogadores.get(t.de)!;
          const para = jogadores.get(t.para)!;
          de.dinheiro += t.pedirDinheiro - t.darDinheiro;
          para.dinheiro += t.darDinheiro - t.pedirDinheiro;
          for (const i of t.darCasas) posses.get(i)!.dono = t.para;
          for (const i of t.pedirCasas) posses.get(i)!.dono = t.de;
          contar({ tipo: 'troca', de: t.de, para: t.para, aceita: true });
        } else {
          contar({ tipo: 'troca', de: t.de, para: t.para, aceita: false });
        }
        // as ações voltam com o prazo inteiro (o limite de trocas por vez é o que segura isso)
        abrirAcoes();
      };

      /** As ações da própria vez sobre uma cidade. Devolve o erro, ou null. */
      const mexer = (quem: number, tipo: string, i: number): string | null => {
        const casa = CASAS[i];
        const p = posses.get(i);
        const j = jogadores.get(quem)!;
        if (!casa || !p || p.dono !== quem) return 'Essa cidade não é sua.';
        if (tipo === 'construir') {
          if (casa.tipo !== 'cidade') return 'Só se constrói em cidade.';
          if (!temOGrupo(quem, casa.grupo!)) return 'Para construir, é preciso ter todas as cidades do grupo.';
          if (grupoInteiro(casa.grupo!).some((k) => posses.get(k)!.hipotecada)) return 'Resgate as cidades hipotecadas do grupo antes de construir.';
          if (p.predios >= MAXIMO_DE_PREDIOS) return 'Essa cidade já tem o máximo de prédios.';
          if (j.dinheiro < casa.custo!) return 'Dinheiro insuficiente.';
          j.dinheiro -= casa.custo!;
          p.predios++;
          contar({ tipo: 'construiu', userId: quem, casa: i });
          return null;
        }
        if (tipo === 'vender') {
          if (p.predios <= 0) return 'Essa cidade não tem prédio.';
          p.predios--;
          j.dinheiro += Math.floor(casa.custo! / 2);
          contar({ tipo: 'vendeu-predio', userId: quem, casa: i });
          return null;
        }
        if (tipo === 'hipotecar') {
          if (p.hipotecada) return 'Essa cidade já está hipotecada.';
          if (casa.tipo === 'cidade' && prediosNoGrupo(casa.grupo!) > 0) return 'Venda os prédios do grupo antes de hipotecar.';
          p.hipotecada = true;
          j.dinheiro += Math.floor(casa.preco! / 2);
          contar({ tipo: 'hipotecou', userId: quem, casa: i });
          return null;
        }
        if (tipo === 'resgatar') {
          if (!p.hipotecada) return 'Essa cidade não está hipotecada.';
          const preco = Math.ceil(Math.floor(casa.preco! / 2) * JUROS_DO_RESGATE);
          if (j.dinheiro < preco) return 'Dinheiro insuficiente.';
          j.dinheiro -= preco;
          p.hipotecada = false;
          contar({ tipo: 'resgatou', userId: quem, casa: i });
          return null;
        }
        return 'Ação desconhecida.';
      };

      // ---- A CABEÇA DOS ROBÔS: regras simples, de quem joga com cuidado, sem trapaça (eles veem só o que a pessoa vê). ----

      /** O dinheiro que o robô guarda para não falir no primeiro aluguel. */
      const RESERVA = 150;
      const arred10 = (n: number) => Math.floor(n / 10) * 10;

      /** Com esta casa (e as que vão chegar junto), `dono` fecha o grupo inteiro? */
      const fechaGrupo = (dono: number, casa: number, chegando: number[] = []) => {
        const c = CASAS[casa];
        if (c.tipo !== 'cidade') return false;
        const vem = new Set([casa, ...chegando]);
        return grupoInteiro(c.grupo!).every((k) => vem.has(k) || posses.get(k)?.dono === dono);
      };
      /** Alguém que não é `quem` fecharia o grupo com esta casa? (o robô compra para atrapalhar) */
      const fechariaDeOutro = (quem: number, casa: number) => ativos().some((o) => o !== quem && fechaGrupo(o, casa));
      const transportesDe = (dono: number) => CASAS.filter((c, k) => c.tipo === 'transporte' && posses.get(k)?.dono === dono).length;

      /** Quanto a casa vale para o robô: o preço, mais se fecha o grupo dele, se atrapalha o de outro, ou se junta transportes. */
      const valorPara = (quem: number, casa: number) => {
        const c = CASAS[casa];
        let v = c.preco!;
        if (c.tipo === 'transporte') v *= 1 + 0.25 * transportesDe(quem);
        else if (fechaGrupo(quem, casa)) v *= 1.6;
        else if (fechariaDeOutro(quem, casa)) v *= 1.3;
        else if (grupoInteiro(c.grupo!).some((k) => posses.get(k)?.dono === quem)) v *= 1.15;
        return v;
      };

      const roboCompra = (quem: number, casa: number) => {
        const j = jogadores.get(quem)!;
        const preco = CASAS[casa].preco!;
        if (j.dinheiro < preco) return false;
        // o que fecha um grupo (o dele ou de outro) compra mesmo apertado; o resto, só sobrando a reserva
        if (fechaGrupo(quem, casa) || fechariaDeOutro(quem, casa)) return true;
        return j.dinheiro - preco >= RESERVA;
      };

      /** O robô que cobre o lance de agora, e com quanto; ou null. O que paga mais é o primeiro a cobrir. */
      const roboQueCobre = (): { id: number; valor: number } | null => {
        if (!leilao) return null;
        const minimo = Math.max(LANCE_MINIMO, leilao.lance + LANCE_MINIMO);
        let melhor: { id: number; valor: number; teto: number } | null = null;
        for (const id of idsDosRobos) {
          const j = jogadores.get(id)!;
          if (j.falido || leilao.lider === id) continue;
          const teto = Math.min(arred10(valorPara(id, leilao.casa) * jeito.get(id)!), arred10(j.dinheiro - RESERVA / 3));
          if (teto < minimo || (melhor && melhor.teto >= teto)) continue;
          // sobe aos saltos (metade do que falta até o teto), para a disputa não levar um lance de cada vez
          const valor = Math.min(teto, Math.max(minimo, arred10(leilao.lance + (teto - leilao.lance) / 2)));
          melhor = { id, valor, teto };
        }
        return melhor && { id: melhor.id, valor: melhor.valor };
      };

      /** Na vez dele, depois de andar: resgata o que hipotecou, e constrói nos grupos inteiros, por igual. */
      const roboAdministra = (quem: number) => {
        const j = jogadores.get(quem)!;
        const minhas = () => [...posses.entries()].filter(([, p]) => p.dono === quem);
        for (const [i, p] of minhas()) {
          if (!p.hipotecada) continue;
          const preco = Math.ceil(Math.floor(CASAS[i].preco! / 2) * JUROS_DO_RESGATE);
          if (j.dinheiro - preco >= RESERVA * 2) mexer(quem, 'resgatar', i);
        }
        for (let guarda = 0; guarda < 40; guarda++) {
          const podem = minhas()
            .filter(([i, p]) => CASAS[i].tipo === 'cidade' && p.predios < MAXIMO_DE_PREDIOS && temOGrupo(quem, CASAS[i].grupo!))
            .filter(([i]) => !grupoInteiro(CASAS[i].grupo!).some((k) => posses.get(k)!.hipotecada))
            .filter(([i]) => j.dinheiro - CASAS[i].custo! >= RESERVA)
            .sort((a, b) => a[1].predios - b[1].predios || CASAS[a[0]].custo! - CASAS[b[0]].custo!);
          if (!podem.length || mexer(quem, 'construir', podem[0][0]) !== null) break;
        }
      };

      /**
       * A troca que a pessoa propõe ao robô: ele aceita se sai ganhando uns 15%. Cidade que fecha o grupo de quem propõe
       * vale bem mais (é dela que vem o aluguel alto); a que fecha o dele, também. A hipotecada vale a metade.
       */
      const roboAceita = (t: Proposta) => {
        const preco = (i: number) => (posses.get(i)?.hipotecada ? CASAS[i].preco! / 2 : CASAS[i].preco!);
        const recebe = t.darDinheiro + t.darCasas.reduce((s, i) => s + preco(i) * (fechaGrupo(t.para, i, t.darCasas) ? 2 : 1), 0);
        const da = t.pedirDinheiro + t.pedirCasas.reduce((s, i) => s + preco(i) * (fechaGrupo(t.de, i, t.pedirCasas) ? 2.5 : 1), 0);
        return recebe > 0 && recebe >= da * 1.15;
      };

      /**
       * A ordem final. Quem não faliu, pelo patrimônio (empatados dividem); depois quem faliu, de quem faliu por último para
       * quem faliu primeiro.
       */
      const classificacao = (ids: number[]) => {
        const vivos = ids.filter((id) => !jogadores.get(id)!.falido).map((id) => ({ userId: id, patrimonio: patrimonio(id) }));
        const linhas = vivos
          .map((v) => ({ ...v, falido: false, posicao: 1 + vivos.filter((o) => o.patrimonio > v.patrimonio).length }))
          .sort((a, b) => a.posicao - b.posicao || nome(a.userId).localeCompare(nome(b.userId)));
        const caidos = [...falencias].reverse().filter((id) => ids.includes(id));
        caidos.forEach((id, k) => linhas.push({ userId: id, patrimonio: 0, falido: true, posicao: vivos.length + k + 1 }));
        return linhas;
      };

      const classificacaoPublica = () => {
        const linha = (l: { userId: number; patrimonio: number; falido: boolean }, posicao: number | null) => ({
          userId: l.userId,
          username: nome(l.userId),
          patrimonio: l.patrimonio,
          falido: l.falido,
          posicao,
          saiu: fase === 'fim' && !interrompida && !ficaram.has(l.userId),
        });
        if (fase !== 'fim') return classificacao(ordem).map((l) => linha(l, l.posicao));
        const turma = interrompida ? [] : ordem.filter((id) => ficaram.has(id));
        const comPosicao = turma.length >= 2 ? turma : [];
        const ranking = comPosicao.length ? classificacao(comPosicao).map((l) => linha(l, l.posicao)) : [];
        const resto = classificacao(ordem.filter((id) => !comPosicao.includes(id))).map((l) => linha(l, null));
        return [...ranking, ...resto];
      };

      const terminar = () => {
        if (fase === 'fim') return;
        fase = 'fim';
        leilao = null;
        troca = null;
        chegada = null;
        // contra o computador não há troféu: o troféu é um registro de um momento entre amigos
        if (!interrompida && !robos) {
          anotarAusentes(presentes());
          const turma = ordem.filter((id) => ficaram.has(id));
          if (turma.length >= 2) {
            for (const l of classificacao(turma)) {
              if (l.posicao > 3) continue;
              db.guardarTrofeu({
                userId: l.userId,
                evento,
                communityId: ctx.comunidade ?? 0,
                pista: 'cidades',
                posicao: l.posicao,
                tempoMs: null,
                pontos: l.patrimonio,
                rivais: turma.filter((id) => id !== l.userId),
              });
            }
          }
        }
        ctx.terminar(!interrompida);
      };

      comecarVez();

      return {
        publico() {
          const sala = new Set(ctx.naSala());
          return {
            fase,
            modo,
            rodada,
            rodadas,
            casas: CASAS,
            salario: SALARIO,
            multiplicador: MULTIPLICADOR,
            aluguelDoTransporte: ALUGUEL_DO_TRANSPORTE,
            jurosDoResgate: JUROS_DO_RESGATE,
            lanceMinimo: LANCE_MINIMO,
            vez: fase === 'fim' ? null : daVez(),
            jogadores: ordem.map((userId) => {
              const j = jogadores.get(userId)!;
              return {
                userId,
                username: nome(userId),
                avatar: avatares.get(userId) ?? null,
                pos: j.pos,
                dinheiro: j.dinheiro,
                patrimonio: patrimonio(userId),
                falido: j.falido,
                parado: j.parado,
                presente: ehRobo(userId) || sala.has(userId),
                robo: ehRobo(userId),
              };
            }),
            posses: [...posses.entries()].map(([casa, p]) => ({ casa, ...p, aluguel: aluguelDe(casa) })),
            ultimo,
            leilao,
            troca,
            trocasRestantes: TROCAS_POR_VEZ - trocasNaVez,
            historico,
            classificacao: classificacaoPublica(),
            interrompida,
            partidaId: evento,
            robos,
          };
        },
        acao(quem, corpo) {
          if (!ordem.includes(quem)) return 'Você está assistindo esta partida.';
          if (fase === 'fim') return 'A partida acabou.';
          if (jogadores.get(quem)!.falido) return 'Quem saiu do jogo só assiste.';
          const tipo = String(corpo.tipo ?? '');
          if (tipo === 'lance') {
            if (fase !== 'leilao' || !leilao) return 'Não há leilão agora.';
            if (!podeDarLance(quem)) return 'Você está assistindo esta partida.';
            const valor = Number(corpo.valor);
            if (!Number.isInteger(valor) || valor < Math.max(LANCE_MINIMO, leilao.lance + LANCE_MINIMO)) return 'O lance precisa ser maior que o atual.';
            if (valor > jogadores.get(quem)!.dinheiro) return 'Dinheiro insuficiente.';
            darLance(quem, valor);
            return null;
          }
          if (tipo === 'responder') {
            if (fase !== 'troca' || !troca) return 'Não há troca agora.';
            if (quem !== troca.para) return 'Essa troca não é com você.';
            fecharTroca(corpo.sim === true);
            return null;
          }
          if (quem !== daVez()) return 'Espere a sua vez.';
          if (tipo === 'dados') {
            if (fase !== 'vez') return 'A partida não está em andamento.';
            jogarDados(quem);
            return null;
          }
          if (tipo === 'comprar') {
            if (fase !== 'compra') return 'A partida não está em andamento.';
            if (corpo.sim !== true) {
              abrirLeilao(jogadores.get(quem)!.pos);
              return null;
            }
            const erro = comprar(quem);
            return erro;
          }
          if (tipo === 'cancelar') {
            if (fase !== 'troca' || !troca) return 'Não há troca agora.';
            fecharTroca(false);
            return null;
          }
          if (fase !== 'acoes') return 'A partida não está em andamento.';
          if (tipo === 'terminar') {
            proximaVez();
            return null;
          }
          if (tipo === 'propor') {
            if (trocasNaVez >= TROCAS_POR_VEZ) return 'Chega de trocas nesta vez.';
            const proposta = lerProposta(quem, corpo);
            const erro = conferirProposta(proposta);
            if (erro) return erro;
            trocasNaVez++;
            troca = proposta;
            fase = 'troca';
            if (ehRobo(proposta.para)) ctx.agendar(PAUSA_DO_ROBO, () => fecharTroca(roboAceita(proposta)));
            else ctx.agendar(TEMPO_DA_TROCA, () => fecharTroca(false));
            ctx.avisar();
            return null;
          }
          if (tipo === 'construir' || tipo === 'vender' || tipo === 'hipotecar' || tipo === 'resgatar') {
            const erro = mexer(quem, tipo, Number(corpo.casa));
            if (!erro) ctx.avisar();
            return erro;
          }
          return 'Ação desconhecida.';
        },
        conferir() {
          if (fase === 'fim') return;
          const aqui = presentes();
          anotarAusentes(aqui);
          if (conferirFim(aqui)) return;
          // quem está na vez saiu da sala: a vez passa (a compra vai a leilão, para não gastar o dinheiro de quem não está)
          const saiu = !aqui.includes(daVez());
          if (fase === 'troca' && troca && (saiu || !aqui.includes(troca.para))) return fecharTroca(false);
          if (!saiu) return;
          if (fase === 'vez' || fase === 'acoes') proximaVez();
          else if (fase === 'compra') abrirLeilao(jogadores.get(daVez())!.pos);
        },
      };
    },
  };
}
