import { embaralhar, placar, type Definicao } from './minijogo-motor.js';
import { normalizar } from './minijogo-stop.js';
import { BONUS_DO_NIVEL, nivelDoDesenho, PALAVRAS_NOVAS_DO_DESENHO, type NivelDoDesenho } from './desenho-palavras.js';

/**
 * O DESENHA E ADIVINHA (o Gartic do Syden). Três rodadas, e em cada uma cada pessoa desenha uma vez: escolhe uma de três
 * palavras, desenha, e o resto chuta digitando. Quem acerta mais rápido ganha mais; quem desenha ganha a
 * cada acerto. O chute errado aparece para todo mundo, que é metade da graça.
 *
 * AS PALAVRAS SÃO NOSSAS (uma lista escrita para o Syden, de coisas fáceis de desenhar), e o nome de cada
 * uma mora no site, traduzido nos 71 idiomas (web/src/minijogos.ts; um teste confere que as listas batem).
 * Quem desenha manda, ao escolher, a palavra NA LÍNGUA DELE — é contra ela que os chutes são conferidos,
 * sem acento e sem maiúscula. O nome em português também vale.
 *
 * O TRAÇO VAI PELO SOCKET, não pela rota: ele precisa chegar enquanto a mão ainda está se mexendo. O
 * servidor guarda os traços da rodada (para quem entra no meio ou recarrega a página) e repassa cada pedaço
 * a quem está na sala (ver `tempoReal`, em minijogos-routes.ts).
 */

export const PALAVRAS_DO_DESENHO = [
  'gato', 'cachorro', 'peixe', 'passaro', 'cavalo', 'vaca', 'porco', 'galinha', 'pato', 'coelho', 'rato', 'elefante',
  'girafa', 'leao', 'tigre', 'macaco', 'urso', 'cobra', 'tartaruga', 'sapo', 'borboleta', 'abelha', 'aranha',
  'formiga', 'caracol', 'polvo', 'tubarao', 'baleia', 'golfinho', 'pinguim', 'coruja', 'camelo', 'zebra', 'jacare',
  'canguru', 'caranguejo', 'minhoca', 'morcego', 'ovelha', 'dinossauro', 'joaninha', 'cavalo-marinho', 'papagaio',
  'flamingo', 'esquilo', 'raposa', 'lobo', 'maca', 'banana', 'uva', 'morango', 'abacaxi', 'melancia', 'laranja',
  'limao', 'cenoura', 'milho', 'cogumelo', 'pizza', 'hamburguer', 'sorvete', 'bolo', 'pao', 'queijo', 'ovo',
  'cachorro-quente', 'pipoca', 'chocolate', 'pirulito', 'sanduiche', 'sushi', 'macarrao', 'batata-frita', 'cafe',
  'cereja', 'pera', 'abobora', 'cadeira', 'mesa', 'cama', 'sofa', 'lampada', 'relogio', 'oculos', 'chapeu', 'sapato',
  'meia', 'camiseta', 'guarda-chuva', 'chave', 'cadeado', 'tesoura', 'lapis', 'livro', 'mochila', 'celular',
  'computador', 'televisao', 'camera', 'fone-de-ouvido', 'violao', 'piano', 'tambor', 'bola', 'balao', 'pipa',
  'presente', 'vela', 'espelho', 'escova-de-dentes', 'garrafa', 'copo', 'xicara', 'garfo', 'colher', 'faca',
  'panela', 'martelo', 'escada', 'porta', 'janela', 'vassoura', 'balde', 'anel', 'coroa', 'espada', 'escudo',
  'bandeira', 'ancora', 'ima', 'lupa', 'microfone', 'controle-de-videogame', 'dado', 'quebra-cabeca', 'envelope',
  'ampulheta', 'boneco-de-neve', 'robo', 'foguete', 'paraquedas', 'mapa', 'bussola', 'barraca', 'cesta', 'sino',
  'trompete', 'carro', 'onibus', 'bicicleta', 'moto', 'aviao', 'helicoptero', 'barco', 'navio', 'trem', 'caminhao',
  'submarino', 'skate', 'patins', 'trator', 'ambulancia', 'balao-de-ar-quente', 'disco-voador', 'sol', 'lua',
  'estrela', 'nuvem', 'chuva', 'arco-iris', 'raio', 'neve', 'arvore', 'flor', 'cacto', 'folha', 'montanha', 'vulcao',
  'ilha', 'praia', 'onda', 'rio', 'cachoeira', 'fogo', 'planeta', 'cometa', 'tornado', 'palmeira', 'pedra',
  'deserto', 'casa', 'castelo', 'ponte', 'farol', 'piramide', 'escola', 'predio', 'fazenda', 'iglu', 'moinho',
  'olho', 'nariz', 'boca', 'orelha', 'mao', 'pe', 'dente', 'coracao', 'cerebro', 'osso', 'bigode', 'fantasma',
  'alienigena', 'zumbi', 'ninja', 'esqueleto', 'mumia', 'dragao', 'unicornio', 'monstro', 'trofeu', 'medalha',
  'raquete', 'moeda', 'cofrinho', 'oculos-de-sol', 'nota-musical', 'arco-e-flecha', 'teia-de-aranha', 'ninho',
  'arvore-de-natal', 'chupeta', 'mamadeira', 'sereia', 'pirata', 'palhaco', 'astronauta', 'carrinho-de-mao',
  'cata-vento', 'semaforo', 'hidrante', 'caixa-de-correio', 'tenis', 'gravata', 'luva', 'cachecol',
  'escova-de-cabelo', 'pente', 'pasta-de-dente', 'sabonete', 'toalha', 'banheira', 'chuveiro', 'privada',
  'geladeira', 'fogao', 'torradeira', 'liquidificador', 'ventilador', 'ar-condicionado', 'tomada', 'pilha',
  'lanterna',
  // as 364 de 19/11/2026, com os níveis (desenho-palavras.ts)
  ...PALAVRAS_NOVAS_DO_DESENHO,
];

export const ESCOLHENDO_MS = 15_000;
export const DESENHANDO_MS = 80_000;
export const REVELANDO_DESENHO_MS = 5_000;
/** Quantas pessoas desenham em cada rodada (as outras chutam o tempo todo). */
// 6, e não 10, desde as 3 rodadas (revisão de 02/11/2026): com 10 pessoas, 30 desenhos davam uns 50 minutos de partida.
export const MAXIMO_DE_VEZES = 6;
export const RODADAS_DO_DESENHO = 3;
/**
 * A LARGADA (20/11/2026, a segunda auditoria): quem começa escolhe as rodadas (1 a 3) e o tempo de cada desenho, como no Stop.
 * Fora da lista, vale o de fábrica (3 rodadas, 80 s).
 */
export const RODADAS_POSSIVEIS_DO_DESENHO = [1, 2, 3];
export const TEMPOS_POSSIVEIS_DO_DESENHO = [45_000, 60_000, 80_000, 120_000];
/** As cores e as espessuras que o site oferece (o índice é o que viaja). */
export const CORES = 12;
export const ESPESSURAS = 3;
/**
 * O BALDE (19/11/2026): pintar uma área fechada. Viaja como um traço de UM ponto com esta "espessura", na mesma sequência dos
 * outros traços; quem pinta é cada tela, numa grade própria, igual em todas (ver web/src/desenho/balde.ts).
 */
export const BALDE = 9;
export const BALDES_POR_DESENHO = 60;
/**
 * A LISTA PRÓPRIA DA SALA (19/11/2026): quem começa escreve as palavras. São conteúdo de quem cria (como o nome de um canal),
 * aparecem como foram escritas e NÃO passam pela tradução; no estado vão com um "#" na frente. Valem como médias no bônus.
 */
export const MAXIMO_NA_LISTA = 200;
export const TAMANHO_NA_LISTA = 30;

/** Teto de pontos por desenho: um rabisco que nunca termina não enche a memória do servidor. */
export const PONTOS_POR_DESENHO = 30_000;

/** Para conferir o chute: sem acento, sem maiúscula, e hífen vale espaço ("água viva" = "água-viva"). */
const comparavel = (texto: string) => normalizar(texto.replace(/[-‐]/g, ' '));

/** Distância de edição entre duas palavras (para o "quase!"), parando cedo quando passa de 1. */
function quaseIgual(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const restoA = a.slice(i + 1);
  const restoB = b.slice(i + 1);
  return restoA === restoB || a.slice(i) === restoB || a.slice(i + 1) === b.slice(i);
}

interface Traco {
  c: number;
  e: number;
  /** Os pedaços do traço, pelo número de ordem: chegar repetido ou fora de ordem não estraga nada. */
  partes: Map<number, number[]>;
}

type Fase = 'escolhendo' | 'desenhando' | 'revelando' | 'fim';

/** O nível de uma palavra: as da lista da turma contam como médias. */
const nivelDe = (id: string): NivelDoDesenho => (id.startsWith('#') ? 2 : nivelDoDesenho(id));

export const desenho: Definicao = {
  minimo: 2,
  comecar(ctx, { naSala, corpo }) {
    if (naSala.length < 2) return 'O desenho precisa de pelo menos 2 pessoas na sala.';
    const daTurma = [
      ...new Set(
        (Array.isArray(corpo.lista) ? corpo.lista : [])
          .slice(0, MAXIMO_NA_LISTA * 2)
          .map((x) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, TAMANHO_NA_LISTA))
          .filter(Boolean),
      ),
    ]
      .slice(0, MAXIMO_NA_LISTA)
      .map((x) => `#${x}`);
    const soDaTurma = corpo.soLista === true && daTurma.length > 0;
    if (soDaTurma && daTurma.length < 3) return 'A lista precisa de pelo menos 3 palavras.';
    const rodadas = RODADAS_POSSIVEIS_DO_DESENHO.includes(Number(corpo.rodadas)) ? Number(corpo.rodadas) : RODADAS_DO_DESENHO;
    const desenhandoMs = TEMPOS_POSSIVEIS_DO_DESENHO.includes(Number(corpo.tempoMs)) ? Number(corpo.tempoMs) : DESENHANDO_MS;
    const largada = { rodadas, tempoMs: desenhandoMs, ...(daTurma.length ? { lista: daTurma.map((x) => x.slice(1)), soLista: soDaTurma } : {}) };
    // TRÊS RODADAS, e em cada uma todo mundo desenha uma vez, na mesma ordem (pedido dele, 02/11/2026: "pelo menos uns
    // 3 rounds"; antes cada um desenhava uma vez só, e com duas pessoas a partida acabava em dois desenhos).
    const pessoas = embaralhar([...naSala]).slice(0, MAXIMO_DE_VEZES);
    const ordem = Array.from({ length: rodadas }, () => pessoas).flat();
    const usadas = new Set<string>();
    const pontos = new Map(naSala.map((id) => [id, 0]));

    let vez = 0;
    let fase: Fase = 'escolhendo';
    let quemDesenha = ordem[0];
    let opcoes: string[] = [];
    /** A palavra da vez: a forma que aparece na tela e as outras que também valem como chute. */
    let palavra: { id: string; texto: string; outras: string[] } | null = null;
    let inicio = 0;
    const acertaram: number[] = [];
    const chutes: { userId: number; texto: string; perto: boolean }[] = [];
    let tracos = new Map<number, Traco>();
    let pontosNoDesenho = 0;
    /** Sobe quando o desenho é apagado ou desfeito: o site troca os traços em vez de juntar. */
    let versao = 0;
    let dicas: number[] = [];
    let dicaRelogio: ReturnType<typeof setTimeout> | null = null;
    /** Quem votou para pular o desenho da vez (19/11/2026): com mais da metade de quem chuta, a palavra aparece e a vez passa. */
    const pular = new Set<number>();

    /** Uma palavra de cada nível (fácil, média, difícil), ou da lista da turma. Sem repetir na partida, enquanto der. */
    function sortearOpcoes() {
      const livres = (lista: string[]) => {
        const sobra = lista.filter((id) => !usadas.has(id));
        return embaralhar(sobra.length ? sobra : [...lista]);
      };
      if (soDaTurma) {
        const sobra = daTurma.filter((id) => !usadas.has(id));
        return embaralhar(sobra.length >= 3 ? sobra : [...daTurma]).slice(0, 3);
      }
      const nivel = (n: NivelDoDesenho) => livres(PALAVRAS_DO_DESENHO.filter((id) => nivelDoDesenho(id) === n))[0];
      // com a lista da turma junto, uma das três é dela (no lugar da média)
      return [nivel(1), daTurma.length ? livres(daTurma)[0] : nivel(2), nivel(3)];
    }

    function proximaVez() {
      // Quem saiu da sala perde a vez de desenhar.
      const naSalaAgora = ctx.naSala();
      while (vez < ordem.length && !naSalaAgora.includes(ordem[vez])) vez++;
      // Sozinho na sala não há quem chute: a partida acaba, em vez de uma pessoa desenhar para ninguém até o relógio vencer.
      if (vez >= ordem.length || naSalaAgora.length < 2) {
        fase = 'fim';
        return ctx.terminar();
      }
      quemDesenha = ordem[vez];
      opcoes = sortearOpcoes();
      palavra = null;
      acertaram.length = 0;
      chutes.length = 0;
      tracos = new Map();
      pontosNoDesenho = 0;
      versao++;
      dicas = [];
      pular.clear();
      fase = 'escolhendo';
      ctx.agendar(ESCOLHENDO_MS, () => escolher(opcoes[0], null));
      ctx.avisar();
    }

    function escolher(id: string, texto: string | null) {
      if (fase !== 'escolhendo') return;
      usadas.add(id);
      // MAIS DE UMA FORMA VALE: a tradução pode trazer alternativas separadas por "|" ("Computadora|Ordenador",
      // "犬|いぬ"). A primeira é a que aparece; todas valem no chute.
      const formas = (texto ?? '')
        .split('|')
        .map((f) => f.trim())
        .filter(Boolean);
      // a palavra da lista da turma é ela mesma (não tem tradução: o que quem desenha mandou não conta)
      palavra = id.startsWith('#') ? { id, texto: id.slice(1), outras: [] } : { id, texto: formas[0] ?? id, outras: formas.slice(1) };
      fase = 'desenhando';
      inicio = Date.now();
      ctx.agendar(desenhandoMs, revelar);
      // As dicas: uma letra aparece na metade do tempo, outra aos três quartos (nunca o espaço).
      const letras = Array.from(palavra.texto)
        .map((ch, i) => (ch.trim() ? i : -1))
        .filter((i) => i >= 0);
      const sorteadas = embaralhar(letras).slice(0, letras.length > 3 ? 2 : letras.length > 1 ? 1 : 0);
      const turno = vez;
      const darDica = (n: number) => {
        if (fase !== 'desenhando' || vez !== turno || sorteadas[n] === undefined) return;
        dicas.push(sorteadas[n]);
        ctx.avisar();
        if (n === 0) dicaRelogio = setTimeout(() => darDica(1), desenhandoMs / 4);
        dicaRelogio?.unref?.();
      };
      if (dicaRelogio) clearTimeout(dicaRelogio);
      dicaRelogio = setTimeout(() => darDica(0), desenhandoMs / 2);
      dicaRelogio.unref?.();
      ctx.avisar();
    }

    function revelar() {
      if (fase !== 'desenhando') return;
      fase = 'revelando';
      ctx.agendar(REVELANDO_DESENHO_MS, () => {
        vez++;
        proximaVez();
      });
      ctx.avisar();
    }

    /** Quem chuta agora: os da sala menos quem desenha. */
    function quemChuta() {
      return ctx.naSala().filter((id) => id !== quemDesenha);
    }

    proximaVez();
    return {
      publico(quem) {
        const desenhando = quem === quemDesenha;
        const aberta = fase === 'revelando' || fase === 'fim' || desenhando || acertaram.includes(quem);
        const texto = palavra?.texto ?? '';
        return {
          fase,
          vez: vez + 1,
          vezes: ordem.length,
          rodada: Math.floor(vez / pessoas.length) + 1,
          rodadas,
          tempoMs: desenhandoMs,
          quemDesenha,
          opcoes: desenhando && fase === 'escolhendo' ? opcoes : null,
          niveis: desenhando && fase === 'escolhendo' ? opcoes.map(nivelDe) : null,
          // o nível da palavra da vez: todo mundo vê (é o que diz quanto o acerto vale)
          nivel: palavra ? nivelDe(palavra.id) : null,
          pular: { votos: pular.size, precisa: Math.floor(quemChuta().length / 2) + 1, votei: pular.has(quem) },
          largada,
          palavra: aberta && palavra ? palavra : null,
          // Para quem chuta: o tamanho da palavra, com as letras de dica já abertas.
          mascara: palavra && !aberta ? Array.from(texto).map((ch, i) => (!ch.trim() ? ' ' : dicas.includes(i) ? ch : '_')) : null,
          acertaram: [...acertaram],
          // O chute "quase certo" aparece só para quem chutou.
          chutes: chutes.filter((c) => !c.perto || c.userId === quem).slice(-40),
          versao,
          tracos: [...tracos.entries()].map(([t, tr]) => ({ t, c: tr.c, e: tr.e, partes: [...tr.partes.entries()] })),
          placar: placar(pontos, ctx.nome),
        };
      },
      acao(quem, corpo) {
        if (corpo.tipo === 'escolher') {
          if (fase !== 'escolhendo') return 'Agora não é hora de escolher.';
          if (quem !== quemDesenha) return 'Quem escolhe a palavra é quem vai desenhar.';
          const id = String(corpo.id ?? '');
          if (!opcoes.includes(id)) return 'Escolha uma das três palavras.';
          escolher(id, String(corpo.texto ?? '').slice(0, 120));
          return null;
        }
        if (corpo.tipo === 'chute') {
          if (fase !== 'desenhando' || !palavra) return 'Agora não é hora de chutar.';
          if (quem === quemDesenha) return 'Quem desenha não chuta.';
          if (acertaram.includes(quem)) return null;
          const texto = String(corpo.texto ?? '').trim().slice(0, 40);
          if (!texto) return null;
          if (!pontos.has(quem)) pontos.set(quem, 0);
          const chute = comparavel(texto);
          const certas = [palavra.texto, ...palavra.outras, palavra.id].map(comparavel);
          if (certas.includes(chute)) {
            acertaram.push(quem);
            // Quanto antes, mais: de 100 (na hora) a 40 (no fim), e quem desenha ganha 25 por acerto. Vezes o bônus do nível
            // (19/11/2026): a média vale 25% a mais, a difícil 50% a mais.
            const fracao = Math.max(0, 1 - (Date.now() - inicio) / desenhandoMs);
            const bonus = BONUS_DO_NIVEL[nivelDe(palavra.id)];
            pontos.set(quem, (pontos.get(quem) ?? 0) + Math.round((40 + 60 * fracao) * bonus));
            pontos.set(quemDesenha, (pontos.get(quemDesenha) ?? 0) + Math.round(25 * bonus));
            chutes.push({ userId: quem, texto: '', perto: false });
            // Todo mundo da sala acertou: revela sem esperar o relógio.
            if (ctx.naSala().every((id) => id === quemDesenha || acertaram.includes(id))) revelar();
            else ctx.avisar();
            return null;
          }
          chutes.push({ userId: quem, texto, perto: certas.some((c) => quaseIgual(chute, c)) });
          ctx.avisar();
          return null;
        }
        if (corpo.tipo === 'pular') {
          if (fase !== 'desenhando') return 'Agora não é hora de pular.';
          if (quem === quemDesenha) return 'Quem desenha não vota para pular.';
          if (pular.has(quem)) pular.delete(quem);
          else pular.add(quem);
          // Mais da metade de quem chuta (e está na sala) quer pular: a palavra aparece, e quem desenha não ganha nada a mais.
          const naSala = quemChuta();
          if ([...pular].filter((id) => naSala.includes(id)).length * 2 > naSala.length) revelar();
          else ctx.avisar();
          return null;
        }
        if (corpo.tipo === 'limpar' || corpo.tipo === 'desfazer') {
          if (fase !== 'desenhando' || quem !== quemDesenha) return 'Só quem desenha mexe no desenho.';
          if (corpo.tipo === 'limpar') {
            tracos = new Map();
            pontosNoDesenho = 0;
          } else {
            // O orçamento volta com o traço desfeito: quem apaga e refaz não fica sem tinta no meio do desenho.
            const ultimo = Math.max(-1, ...tracos.keys());
            for (const parte of tracos.get(ultimo)?.partes.values() ?? []) pontosNoDesenho -= parte.length / 2;
            tracos.delete(ultimo);
          }
          versao++;
          ctx.avisar();
          return null;
        }
        return 'Ação desconhecida.';
      },
      tempoReal(quem, dados) {
        if (fase !== 'desenhando' || quem !== quemDesenha || typeof dados !== 'object' || dados === null) return null;
        const { t, i, c, e, p } = dados as Record<string, unknown>;
        const inteiro = (x: unknown, max: number) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max;
        // (o balde é um traço de um ponto só, com a "espessura" BALDE)
        const balde = e === BALDE;
        if (!inteiro(t, 100_000) || !inteiro(i, 5_000) || !inteiro(c, CORES - 1) || (!balde && !inteiro(e, ESPESSURAS - 1))) return null;
        if (!Array.isArray(p) || p.length === 0 || p.length > 400 || p.length % 2 !== 0 || !p.every((x) => inteiro(x, 1000))) return null;
        if (balde && (p.length !== 2 || i !== 0)) return null;
        // cada balde custa a cada tela refazer a grade inteira: um desenho tem no máximo BALDES_POR_DESENHO
        if (balde && !tracos.has(t as number) && [...tracos.values()].filter((tr) => tr.e === BALDE).length >= BALDES_POR_DESENHO) return null;
        // A conta é do que FICA GUARDADO: reenviar uma parte que já existe troca os pontos dela pelos novos. Antes só a parte
        // nova contava, e um programa reenviando o mesmo pedaço com 200 pontos enchia o servidor (auditoria de 12/11/2026).
        const traco = tracos.get(t as number) ?? { c: c as number, e: e as number, partes: new Map() };
        const antes = (traco.partes.get(i as number)?.length ?? 0) / 2;
        if (pontosNoDesenho - antes + p.length / 2 > PONTOS_POR_DESENHO) return null;
        pontosNoDesenho += p.length / 2 - antes;
        traco.partes.set(i as number, p as number[]);
        tracos.set(t as number, traco);
        return { t, i, c, e, p };
      },
    };
  },
};
