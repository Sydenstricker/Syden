import { embaralhar, placar, type Definicao } from './minijogo-motor.js';
import { normalizar } from './minijogo-stop.js';

/**
 * O DESENHA E ADIVINHA (o Gartic do Syden). Cada pessoa da sala desenha uma vez: escolhe uma de três
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
];

export const ESCOLHENDO_MS = 15_000;
export const DESENHANDO_MS = 80_000;
export const REVELANDO_DESENHO_MS = 5_000;
export const MAXIMO_DE_VEZES = 10;
/** As cores e as espessuras que o site oferece (o índice é o que viaja). */
export const CORES = 12;
export const ESPESSURAS = 3;
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

export const desenho: Definicao = {
  minimo: 2,
  comecar(ctx, { naSala }) {
    if (naSala.length < 2) return 'O desenho precisa de pelo menos 2 pessoas na sala.';
    const ordem = embaralhar([...naSala]).slice(0, MAXIMO_DE_VEZES);
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

    function sortearOpcoes() {
      const livres = PALAVRAS_DO_DESENHO.filter((id) => !usadas.has(id));
      return embaralhar(livres.length >= 3 ? livres : [...PALAVRAS_DO_DESENHO]).slice(0, 3);
    }

    function proximaVez() {
      // Quem saiu da sala perde a vez de desenhar.
      const naSalaAgora = ctx.naSala();
      while (vez < ordem.length && !naSalaAgora.includes(ordem[vez])) vez++;
      if (vez >= ordem.length) {
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
      palavra = { id, texto: formas[0] ?? id, outras: formas.slice(1) };
      fase = 'desenhando';
      inicio = Date.now();
      ctx.agendar(DESENHANDO_MS, revelar);
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
        if (n === 0) dicaRelogio = setTimeout(() => darDica(1), DESENHANDO_MS / 4);
        dicaRelogio?.unref?.();
      };
      if (dicaRelogio) clearTimeout(dicaRelogio);
      dicaRelogio = setTimeout(() => darDica(0), DESENHANDO_MS / 2);
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
          quemDesenha,
          opcoes: desenhando && fase === 'escolhendo' ? opcoes : null,
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
            // Quanto antes, mais: de 100 (na hora) a 40 (no fim), e quem desenha ganha 25 por acerto.
            const fracao = Math.max(0, 1 - (Date.now() - inicio) / DESENHANDO_MS);
            pontos.set(quem, (pontos.get(quem) ?? 0) + Math.round(40 + 60 * fracao));
            pontos.set(quemDesenha, (pontos.get(quemDesenha) ?? 0) + 25);
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
        if (corpo.tipo === 'limpar' || corpo.tipo === 'desfazer') {
          if (fase !== 'desenhando' || quem !== quemDesenha) return 'Só quem desenha mexe no desenho.';
          if (corpo.tipo === 'limpar') tracos = new Map();
          else tracos.delete(Math.max(-1, ...tracos.keys()));
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
        if (!inteiro(t, 100_000) || !inteiro(i, 5_000) || !inteiro(c, CORES - 1) || !inteiro(e, ESPESSURAS - 1)) return null;
        if (!Array.isArray(p) || p.length === 0 || p.length > 400 || p.length % 2 !== 0 || !p.every((x) => inteiro(x, 1000))) return null;
        if (pontosNoDesenho + p.length / 2 > PONTOS_POR_DESENHO) return null;
        const traco = tracos.get(t as number) ?? { c: c as number, e: e as number, partes: new Map() };
        if (!traco.partes.has(i as number)) pontosNoDesenho += p.length / 2;
        traco.partes.set(i as number, p as number[]);
        tracos.set(t as number, traco);
        return { t, i, c, e, p };
      },
    };
  },
};
