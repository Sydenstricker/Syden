/**
 * A REGRA DO RINGUE DA TOCA (16/11/2026): o boxe de reflexo visto de trás de quem joga. SÓ A MECÂNICA do gênero: o adversário
 * AVISA cada golpe (o recuo da luva, e um BRILHO na luva no meio do aviso), quem joga esquiva, abaixa ou defende, e bate na
 * BRECHA que o golpe errado deixa. Bater durante o brilho interrompe o golpe; o primeiro soco logo depois de esquivar de um
 * golpe forte é o contra-ataque na hora certa. Os dois enchem a ESTRELA, e o soco forte gasta todas de uma vez. Três
 * adversários do computador em seguida (o circuito), cada um com o seu jeito: o ligeiro, o pesado e o trapaceiro.
 *
 * PASSOS FIXOS DE 1/60 s, e o tempo é o número de passos, não o relógio (a janela sem foco pausa a luta). Só + − × ÷ e raiz, e
 * o "acaso" dos adversários sai de um gerador de inteiros com semente AQUI DENTRO: a mesma semente e os mesmos comandos dão a
 * mesma luta em qualquer computador. Por isso o servidor REFAZ o circuito pelos comandos de cada passo e o resultado é o dele.
 *
 * ESTE ARQUIVO MORA EM DUAS CÓPIAS IGUAIS BYTE A BYTE (web/src/ringue/sim.ts e server/src/ringue-sim.ts; web/test/ringue.test.ts
 * confere). Mudou a regra, copie um sobre o outro: servidor e site sobem juntos. Nada de import aqui.
 */

export const PASSO = 1 / 60;
/** Um round: um minuto de luta (o relógio para enquanto alguém está no chão). */
export const PASSOS_DO_ROUND = 3600;
export const ROUNDS = 3;
export const PASSOS_DO_INTERVALO = 180;
/** O adversário entra no ringue antes do gongo. */
export const PASSOS_DA_APRESENTACAO = 150;
/** O fim de cada luta fica na tela antes da próxima (ou do fim do circuito). */
export const PASSOS_DO_RESULTADO = 150;
/** Cada número da contagem de quem caiu. */
export const PASSOS_DA_CONTAGEM = 45;
/** Nenhum circuito passa disto (três lutas de três rounds, com todas as contagens e intervalos, e sobra). */
export const PASSOS_MAXIMOS = 60000;

// Os comandos de cada passo, em bits. Esquivar, abaixar e os socos valem no APERTAR (a passagem de solto para apertado);
// defender vale enquanto se segura.
export const ESQ = 1;
export const DIR = 2;
export const BAIXO = 4;
export const CIMA = 8;
export const SOCO_E = 16;
export const SOCO_D = 32;
export const FORTE = 64;
export const TODOS_OS_BITS = 127;

// O que livra de cada golpe.
export const LIVRA_ESQ = 1;
export const LIVRA_DIR = 2;
export const LIVRA_BAIXO = 4;

// Os tempos de quem joga, em passos.
export const ESQUIVA = 34;
/** A esquiva e o abaixar só livram nesta faixa (o começo e o fim são o corpo indo e voltando). */
export const LIVRA_DE = 2;
export const LIVRA_ATE = 26;
export const ABAIXADO = 30;
export const SOCO = 14;
export const IMPACTO_DO_SOCO = 5;
export const SOCO_FORTE = 30;
export const IMPACTO_DO_FORTE = 14;
export const ATINGIDO = 24;
export const CANSADO = 150;
export const FOLEGO = 10;
export const ESTRELAS = 3;
/** O adversário atordoado: cada soco que entra renova; sem soco nesse tanto, ele volta à guarda. */
export const ATORDOADO = 22;
/** O golpe saindo (o desenho do braço esticado) quando acertou ou foi defendido. */
export const GOLPE_SAINDO = 12;
export const LEVANTANDO = 40;

export type IdDoGolpe = 'direto' | 'gancho-e' | 'gancho-d' | 'por-cima' | 'de-baixo';

export interface Golpe {
  id: IdDoGolpe;
  /** De que lado da tela ele vem (−1 esquerda, 1 direita, 0 do meio). */
  lado: number;
  /** Quantos passos de aviso antes de sair. */
  aviso: number;
  /** O brilho na luva: um soco APERTADO nesta faixa do aviso interrompe o golpe e ganha uma estrela. null: sem brilho. */
  brilho: [number, number] | null;
  dano: number;
  /** O que livra (LIVRA_*). */
  livra: number;
  /** A defesa: 0 segura tudo, 1 passa um terço, 2 passa metade. */
  guarda: number;
  /** Quanto tempo fica aberto depois de errar numa esquiva. */
  aberto: number;
  /** O primeiro soco logo depois de esquivar dele é contra-ataque, e ganha estrela. */
  estrela: boolean;
}

function golpe(id: IdDoGolpe, aviso: number, brilho: [number, number] | null, dano: number, aberto: number): Golpe {
  switch (id) {
    case 'direto':
      return { id, lado: 0, aviso, brilho, dano, livra: LIVRA_ESQ | LIVRA_DIR | LIVRA_BAIXO, guarda: 0, aberto, estrela: false };
    case 'gancho-e':
      // vem pela esquerda da tela: esquiva para a direita, ou abaixa
      return { id, lado: -1, aviso, brilho, dano, livra: LIVRA_DIR | LIVRA_BAIXO, guarda: 1, aberto, estrela: true };
    case 'gancho-d':
      return { id, lado: 1, aviso, brilho, dano, livra: LIVRA_ESQ | LIVRA_BAIXO, guarda: 1, aberto, estrela: true };
    case 'por-cima':
      // a pancada de cima: abaixar não adianta, só sair de lado
      return { id, lado: 0, aviso, brilho, dano, livra: LIVRA_ESQ | LIVRA_DIR, guarda: 2, aberto, estrela: true };
    default:
      // de baixo: a guarda segura, abaixar é dar o queixo
      return { id, lado: 0, aviso, brilho, dano, livra: LIVRA_ESQ | LIVRA_DIR, guarda: 0, aberto, estrela: true };
  }
}

/** O que o adversário faz quando a espera acaba: uma sequência de golpes, uma finta ou uma provocação. */
interface Acao {
  peso: number;
  golpes?: Golpe[];
  finta?: boolean;
  provoca?: boolean;
}

export interface Adversario {
  /** A folha do bicho (web/public/briga/<fase>/<bicho>.png). */
  bicho: string;
  /** A cor das luvas. */
  luva: string;
  vida: number;
  /** Quantos socos seguidos ele aguenta atordoado antes de fechar a guarda e responder. */
  cadeia: number;
  /** Quantos socos na guarda seguidos antes de ele responder com um direto rápido. */
  paciencia: number;
  espera: [number, number];
  /** Peso de cada guarda: [esquerda, alta, direita]. A guarda de um lado deixa o outro aberto. */
  guardas: [number, number, number];
  acoes: Acao[];
  /** O direto rápido da resposta (sem brilho). */
  resposta: Golpe;
  /** A finta imita o recuo destes dois golpes. */
  fintas: Golpe[];
  /** A vida com que levanta da primeira e da segunda queda. */
  levanta: [number, number];
  /**
   * O ADVERSÁRIO QUE MUDA (20/11/2026): no último round, ou com menos de um terço da vida, ele entra na FÚRIA: soma estas ações
   * às dele (um golpe ou uma cadeia nova) e espera menos entre uma e outra. Até lá, a luta é a de antes, passo a passo.
   */
  furia: { acoes: Acao[]; espera: [number, number] };
  /**
   * A GUARDA QUE DANÇA (21/11/2026, o segundo circuito): parado na guarda, a cada `danca` passos ele troca o lado coberto
   * (esquerda, direita, esquerda...; da guarda alta vai à esquerda). Sem sorteio: é um ritmo para aprender. 0 ou ausente: não dança.
   */
  danca?: number;
}

export const ADVERSARIOS: Adversario[] = [
  {
    // O LIGEIRO: diretos curtos e muitos, ganchos rápidos, a guarda pulando de um lado para o outro.
    bicho: 'macaco',
    luva: '#d8463c',
    vida: 110,
    cadeia: 4,
    paciencia: 2,
    espera: [24, 60],
    guardas: [2, 1, 2],
    acoes: [
      { peso: 5, golpes: [golpe('direto', 34, [8, 26], 11, 30)] },
      { peso: 2, golpes: [golpe('gancho-e', 40, [10, 30], 16, 42)] },
      { peso: 2, golpes: [golpe('gancho-d', 40, [10, 30], 16, 42)] },
      { peso: 2, golpes: [golpe('direto', 30, null, 10, 24), golpe('direto', 30, [8, 22], 10, 34)] },
    ],
    resposta: golpe('direto', 22, null, 12, 24),
    fintas: [],
    levanta: [70, 45],
    // a fúria do ligeiro: a cadeia de três (dois diretos sem brilho e o gancho que brilha), e quase sem respiro
    furia: {
      acoes: [{ peso: 3, golpes: [golpe('direto', 26, null, 10, 20), golpe('direto', 26, null, 10, 20), golpe('gancho-d', 30, [8, 20], 14, 40)] }],
      espera: [16, 40],
    },
  },
  {
    // O PESADO: espera muito, avisa muito, e quando acerta dói; esquivado, fica aberto um tempão. Guarda quase sempre alta.
    bicho: 'yeti',
    luva: '#3c6fd8',
    vida: 160,
    cadeia: 6,
    paciencia: 3,
    espera: [50, 96],
    guardas: [1, 4, 1],
    acoes: [
      { peso: 3, golpes: [golpe('por-cima', 62, [22, 44], 30, 70)] },
      { peso: 2, golpes: [golpe('gancho-e', 52, [18, 38], 24, 64)] },
      { peso: 2, golpes: [golpe('gancho-d', 52, [18, 38], 24, 64)] },
      { peso: 1, golpes: [golpe('direto', 36, [10, 26], 14, 40)] },
      // o pesado de vez em quando emenda os dois ganchos
      { peso: 1, golpes: [golpe('gancho-e', 48, null, 22, 20), golpe('gancho-d', 40, [12, 28], 22, 64)] },
    ],
    resposta: golpe('direto', 24, null, 14, 30),
    fintas: [],
    levanta: [80, 55],
    // a fúria do pesado: a pancada de baixo (a guarda segura, abaixar é dar o queixo), e espera menos
    furia: { acoes: [{ peso: 2, golpes: [golpe('de-baixo', 44, [14, 30], 26, 60)] }], espera: [34, 70] },
  },
  {
    // O TRAPACEIRO: finge golpes (sem o brilho: o brilho nunca mente), provoca de guarda aberta e solta golpes rápidos.
    bicho: 'demonio-azul',
    luva: '#e8a83a',
    vida: 130,
    cadeia: 4,
    paciencia: 2,
    espera: [20, 64],
    guardas: [2, 1, 2],
    acoes: [
      { peso: 3, finta: true },
      { peso: 1, provoca: true },
      { peso: 2, golpes: [golpe('de-baixo', 34, [8, 24], 16, 40)] },
      { peso: 2, golpes: [golpe('gancho-e', 32, [8, 22], 14, 40)] },
      { peso: 2, golpes: [golpe('gancho-d', 32, [8, 22], 14, 40)] },
      { peso: 1, golpes: [golpe('direto', 26, [6, 16], 10, 30)] },
    ],
    resposta: golpe('direto', 22, null, 10, 24),
    fintas: [golpe('gancho-e', 32, null, 14, 40), golpe('gancho-d', 32, null, 14, 40)],
    levanta: [70, 50],
    // a fúria do trapaceiro: o gancho sem brilho emendado na pancada de cima
    furia: {
      acoes: [{ peso: 2, golpes: [golpe('gancho-e', 28, null, 12, 16), golpe('por-cima', 34, [8, 20], 18, 44)] }],
      espera: [14, 44],
    },
  },
];

/**
 * O SEGUNDO CIRCUITO (21/11/2026, o lote D): três adversários novos, cada um com um padrão próprio, escolhido na largada e com
 * recorde à parte. Os bichos são folhas da Briga que já existem (Quaternius, CC0).
 */
export const ADVERSARIOS_DO_SEGUNDO: Adversario[] = [
  {
    // O DANÇARINO: nunca fecha a guarda alta, e a troca de lado no ritmo dele (a brecha anda: bater no lado aberto pede o tempo
    // certo). Golpes rápidos e médios, de todo lado.
    bicho: 'diabinho',
    luva: '#9a4ad8',
    vida: 120,
    cadeia: 3,
    paciencia: 2,
    espera: [30, 70],
    guardas: [3, 0, 3],
    acoes: [
      { peso: 3, golpes: [golpe('direto', 30, [8, 22], 10, 30)] },
      { peso: 2, golpes: [golpe('gancho-e', 36, [10, 26], 14, 40)] },
      { peso: 2, golpes: [golpe('gancho-d', 36, [10, 26], 14, 40)] },
      { peso: 2, golpes: [golpe('de-baixo', 34, [8, 24], 14, 40)] },
    ],
    resposta: golpe('direto', 22, null, 11, 24),
    fintas: [],
    levanta: [70, 45],
    danca: 18,
    // a fúria do dançarino: os dois ganchos emendados, o primeiro sem brilho
    furia: { acoes: [{ peso: 3, golpes: [golpe('gancho-e', 30, null, 12, 18), golpe('gancho-d', 30, [8, 20], 12, 40)] }], espera: [20, 50] },
  },
  {
    // O ESPINHO: o contra-golpe. Guarda quase sempre alta, e cada soco que bate nela é respondido NA HORA com um direto curto; e
    // fecha a guarda depois de dois socos que entram. Quem vence espera o golpe dele e bate na brecha.
    bicho: 'cacto',
    luva: '#4aa85a',
    vida: 140,
    cadeia: 2,
    paciencia: 1,
    espera: [56, 100],
    guardas: [1, 5, 1],
    acoes: [
      { peso: 3, golpes: [golpe('por-cima', 54, [18, 38], 24, 66)] },
      { peso: 2, golpes: [golpe('direto', 30, [8, 22], 12, 30)] },
      { peso: 2, golpes: [golpe('de-baixo', 46, [14, 32], 22, 60)] },
      { peso: 1, provoca: true },
    ],
    resposta: golpe('direto', 18, null, 14, 24),
    fintas: [],
    levanta: [80, 55],
    // a fúria do espinho: o direto sem brilho emendado na pancada de cima
    furia: { acoes: [{ peso: 2, golpes: [golpe('direto', 22, null, 12, 16), golpe('por-cima', 40, [10, 24], 24, 64)] }], espera: [40, 80] },
  },
  {
    // O CAMPEÃO: de tudo um pouco, e as CADEIAS: três golpes seguidos em que só o último brilha; finge também. Na fúria, a cadeia
    // de quatro.
    bicho: 'alpaca-rei',
    luva: '#e8d23a',
    vida: 180,
    cadeia: 5,
    paciencia: 3,
    espera: [26, 64],
    guardas: [2, 2, 2],
    acoes: [
      { peso: 2, finta: true },
      { peso: 2, golpes: [golpe('direto', 28, [6, 18], 12, 30)] },
      { peso: 1, golpes: [golpe('gancho-e', 34, [8, 22], 16, 40)] },
      { peso: 1, golpes: [golpe('gancho-d', 34, [8, 22], 16, 40)] },
      { peso: 2, golpes: [golpe('direto', 26, null, 10, 18), golpe('gancho-e', 28, null, 12, 18), golpe('por-cima', 38, [10, 26], 22, 60)] },
      { peso: 1, golpes: [golpe('de-baixo', 32, [8, 22], 18, 40)] },
    ],
    resposta: golpe('direto', 20, null, 12, 24),
    fintas: [golpe('gancho-e', 30, null, 14, 40), golpe('gancho-d', 30, null, 14, 40)],
    levanta: [90, 60],
    furia: {
      acoes: [
        {
          peso: 2,
          golpes: [golpe('gancho-d', 24, null, 10, 14), golpe('gancho-e', 24, null, 10, 14), golpe('direto', 24, null, 10, 14), golpe('de-baixo', 32, [8, 20], 20, 50)],
        },
      ],
      espera: [16, 40],
    },
  },
];

/** Os circuitos: o primeiro (o de sempre) e o segundo (21/11/2026). Todos de três lutas. */
export const CIRCUITOS: Adversario[][] = [ADVERSARIOS, ADVERSARIOS_DO_SEGUNDO];
export const ehCircuito = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < CIRCUITOS.length;
/** O adversário da luta de agora, no circuito dela. */
export function adversarioDe(l: Luta): Adversario {
  return CIRCUITOS[l.circuito][l.adv];
}

/** O direto que vem depois de uma finta: rápido, e sem brilho. */
const DEPOIS_DA_FINTA = golpe('direto', 24, null, 12, 30);
/** Quantos toques cada queda pede para levantar (a terceira não levanta: nocaute técnico). */
export const TOQUES_PARA_LEVANTAR = [14, 22];

export type EstadoDoJogador = 'pronto' | 'guarda' | 'esquiva' | 'abaixado' | 'socando' | 'forte' | 'atingido' | 'caido';
export type EstadoDoAdversario = 'guarda' | 'aviso' | 'finta' | 'golpe' | 'aberto' | 'atordoado' | 'provoca' | 'caido' | 'levantando';

export interface Jogador {
  estado: EstadoDoJogador;
  t: number;
  /** O lado da esquiva ou do soco (−1 ou 1; 0 no soco forte). */
  lado: number;
  vida: number;
  folego: number;
  /** Passos cansado (sem socar); 0 = descansado. */
  cansado: number;
  estrelas: number;
  quedas: number;
  toques: number;
  /** O soco foi apertado durante o brilho: interrompe se ainda houver o que interromper. */
  aTempo: boolean;
}

export interface Oponente {
  estado: EstadoDoAdversario;
  t: number;
  /** A duração do estado de agora (espera, finta, aberto, provocação). */
  dura: number;
  vida: number;
  quedas: number;
  /** −1 cobre a esquerda da tela, 0 os dois lados, 1 a direita. */
  guarda: number;
  golpe: Golpe | null;
  fila: Golpe[];
  /** O resultado do último golpe (o desenho). */
  resultado: 'esquivou' | 'bloqueou' | 'acertou' | null;
  /** Até que passo do 'aberto' o primeiro soco é contra-ataque (estrela). */
  estrelaAte: number;
  /** Socos que entraram seguidos, e socos na guarda seguidos. */
  cadeia: number;
  bloqueados: number;
  /** Em que número da contagem ele levanta (11: não levanta). */
  levantaEm: number;
  /** Passos desde o último soco que levou (o desenho pisca). */
  levou: number;
  /** Entrou na fúria (o último round ou menos de um terço da vida): não sai mais nesta luta. */
  furia: boolean;
}

export type Evento =
  | { tipo: 'gongo' }
  | { tipo: 'soco'; forte: boolean; lado: number }
  | { tipo: 'bloqueado'; lado: number }
  | { tipo: 'esquivou' }
  | { tipo: 'atingido'; dano: number }
  | { tipo: 'raspou' }
  | { tipo: 'estrela' }
  | { tipo: 'interrompeu' }
  | { tipo: 'cansou' }
  | { tipo: 'queda'; quem: 'jogador' | 'adversario' }
  | { tipo: 'contagem'; n: number }
  | { tipo: 'levantou'; quem: 'jogador' | 'adversario' }
  | { tipo: 'fim-da-luta'; venceu: boolean; nocaute: boolean }
  | { tipo: 'furia' };

export type Fase = 'apresentacao' | 'luta' | 'intervalo' | 'resultado';

export interface Luta {
  semente: number;
  /** Qual circuito (o índice em CIRCUITOS; 0 é o de sempre). */
  circuito: number;
  /** O gerador (MINSTD: o produto cabe inteiro num double). */
  sorte: number;
  passo: number;
  fase: Fase;
  faseT: number;
  /** Qual adversário (0, 1, 2) e quantos já venceu. */
  adv: number;
  vencidas: number;
  round: number;
  /** Passos do round de agora. */
  relogio: number;
  j: Jogador;
  a: Oponente;
  /** Quem está no chão agora, e a contagem. */
  queda: 'jogador' | 'adversario' | null;
  contagem: number;
  contagemT: number;
  /** Nesta luta: o que deu e o que levou (a decisão nos pontos). */
  danoDado: number;
  danoRecebido: number;
  /** O resultado da última luta (o desenho do fim). */
  venceuUltima: boolean | null;
  nocaute: boolean;
  /** Os comandos do passo anterior (o "apertar" é a passagem de solto para apertado). */
  prev: number;
  eventos: Evento[];
  terminou: boolean;
}

function sortear(l: Luta, n: number): number {
  l.sorte = (l.sorte * 48271) % 2147483647;
  return l.sorte % n;
}

function novoJogador(): Jogador {
  return { estado: 'pronto', t: 0, lado: 0, vida: 100, folego: FOLEGO, cansado: 0, estrelas: 0, quedas: 0, toques: 0, aTempo: false };
}

function novoOponente(adv: number, circuito = 0): Oponente {
  return {
    estado: 'guarda',
    t: 0,
    dura: 60,
    vida: CIRCUITOS[circuito][adv].vida,
    quedas: 0,
    guarda: 0,
    golpe: null,
    fila: [],
    resultado: null,
    estrelaAte: 0,
    cadeia: 0,
    bloqueados: 0,
    levantaEm: 11,
    levou: 99,
    furia: false,
  };
}

export function novaLuta(semente: number, circuito = 0): Luta {
  const s = Math.floor(Math.abs(semente)) % 2147483646;
  const c = ehCircuito(circuito) ? circuito : 0;
  return {
    semente,
    circuito: c,
    sorte: s + 1,
    passo: 0,
    fase: 'apresentacao',
    faseT: 0,
    adv: 0,
    vencidas: 0,
    round: 1,
    relogio: 0,
    j: novoJogador(),
    a: novoOponente(0, c),
    queda: null,
    contagem: 0,
    contagemT: 0,
    danoDado: 0,
    danoRecebido: 0,
    venceuUltima: null,
    nocaute: false,
    prev: 0,
    eventos: [],
    terminou: false,
  };
}

// ------------------------------------------------------------------------------------------------------------------
// O ADVERSÁRIO
// ------------------------------------------------------------------------------------------------------------------

/** A fúria (20/11/2026): no último round, ou com menos de um terço da vida, uma vez por luta. */
function conferirFuria(l: Luta) {
  const a = l.a;
  if (a.furia || (l.round < ROUNDS && a.vida * 3 >= adversarioDe(l).vida)) return;
  a.furia = true;
  l.eventos.push({ tipo: 'furia' });
}

/** De volta à guarda, esperando `espera` passos (−1: o sorteio do jeito dele), com a guarda sorteada. */
function voltarAGuarda(l: Luta, espera: number) {
  const a = l.a;
  const A = adversarioDe(l);
  conferirFuria(l);
  a.estado = 'guarda';
  a.t = 0;
  a.golpe = null;
  a.cadeia = 0;
  const de = a.furia ? A.furia.espera : A.espera;
  a.dura = espera >= 0 ? espera : de[0] + sortear(l, de[1] - de[0] + 1);
  const total = A.guardas[0] + A.guardas[1] + A.guardas[2];
  const r = sortear(l, total);
  a.guarda = r < A.guardas[0] ? -1 : r < A.guardas[0] + A.guardas[1] ? 0 : 1;
}

function avisar(l: Luta, g: Golpe) {
  const a = l.a;
  a.estado = 'aviso';
  a.t = 0;
  a.golpe = g;
  a.resultado = null;
}

function proximaAcao(l: Luta) {
  const a = l.a;
  const A = adversarioDe(l);
  if (a.fila.length > 0) {
    avisar(l, a.fila.shift()!);
    return;
  }
  conferirFuria(l);
  const acoes = a.furia ? A.acoes.concat(A.furia.acoes) : A.acoes;
  let total = 0;
  for (const x of acoes) total += x.peso;
  let r = sortear(l, total);
  let escolhida = acoes[0];
  for (const x of acoes) {
    if (r < x.peso) {
      escolhida = x;
      break;
    }
    r -= x.peso;
  }
  if (escolhida.finta && A.fintas.length > 0) {
    a.estado = 'finta';
    a.t = 0;
    a.dura = 16 + sortear(l, 14);
    a.golpe = A.fintas[sortear(l, A.fintas.length)];
    return;
  }
  if (escolhida.provoca) {
    a.estado = 'provoca';
    a.t = 0;
    a.dura = 80;
    a.estrelaAte = 80;
    a.golpe = null;
    return;
  }
  const golpes = escolhida.golpes ?? [A.resposta];
  for (let i = 1; i < golpes.length; i++) a.fila.push(golpes[i]);
  avisar(l, golpes[0]);
}

/** O golpe sai: a defesa de quem joga, AGORA, decide. */
function resolverGolpe(l: Luta) {
  const a = l.a;
  const j = l.j;
  const g = a.golpe!;
  const livrando = j.t >= LIVRA_DE && j.t <= LIVRA_ATE;
  let livrou = false;
  if (j.estado === 'esquiva' && livrando && (g.livra & (j.lado < 0 ? LIVRA_ESQ : LIVRA_DIR)) !== 0) livrou = true;
  if (j.estado === 'abaixado' && livrando && (g.livra & LIVRA_BAIXO) !== 0) livrou = true;
  if (livrou) {
    a.resultado = 'esquivou';
    l.eventos.push({ tipo: 'esquivou' });
    if (a.fila.length > 0) {
      // emendou outro golpe: o segundo já vem
      avisar(l, a.fila.shift()!);
      a.resultado = 'esquivou';
      return;
    }
    a.estado = 'aberto';
    a.t = 0;
    a.dura = g.aberto;
    a.estrelaAte = g.estrela ? 32 : 0;
    a.cadeia = 0;
    return;
  }
  if (j.estado === 'guarda') {
    const passa = g.guarda === 0 ? 0 : g.guarda === 1 ? Math.floor(g.dano / 3) : Math.floor(g.dano / 2);
    a.resultado = 'bloqueou';
    if (passa > 0) {
      j.vida -= passa;
      l.danoRecebido += passa;
      cansar(l, 1);
      l.eventos.push({ tipo: 'raspou' });
    } else l.eventos.push({ tipo: 'bloqueado', lado: 0 });
  } else {
    a.resultado = 'acertou';
    j.vida -= g.dano;
    l.danoRecebido += g.dano;
    j.estado = 'atingido';
    j.t = 0;
    j.estrelas = 0;
    cansar(l, 2);
    l.eventos.push({ tipo: 'atingido', dano: g.dano });
  }
  a.fila.length = 0;
  a.estado = 'golpe';
  a.t = 0;
  if (j.vida <= 0) {
    j.vida = 0;
    derrubar(l, 'jogador');
  }
}

function cansar(l: Luta, n: number) {
  const j = l.j;
  if (j.cansado > 0) return;
  j.folego -= n;
  if (j.folego <= 0) {
    j.folego = 0;
    j.cansado = CANSADO;
    l.eventos.push({ tipo: 'cansou' });
  }
}

function passoDoAdversario(l: Luta) {
  const a = l.a;
  a.t++;
  a.levou++;
  switch (a.estado) {
    case 'guarda': {
      if (a.t >= a.dura) proximaAcao(l);
      else {
        // a guarda que dança (o segundo circuito): troca de lado no ritmo dele
        const danca = adversarioDe(l).danca ?? 0;
        if (danca > 0 && a.t % danca === 0) a.guarda = a.guarda < 0 ? 1 : -1;
      }
      break;
    }
    case 'aviso':
      if (a.t >= a.golpe!.aviso) resolverGolpe(l);
      break;
    case 'finta':
      if (a.t >= a.dura) avisar(l, DEPOIS_DA_FINTA);
      break;
    case 'golpe':
      if (a.t >= GOLPE_SAINDO) {
        if (a.resultado === 'bloqueou') {
          a.estado = 'aberto';
          a.t = 0;
          a.dura = 12;
          a.estrelaAte = 0;
        } else voltarAGuarda(l, 30);
      }
      break;
    case 'aberto':
    case 'provoca':
      if (a.t >= a.dura) voltarAGuarda(l, -1);
      break;
    case 'atordoado':
      if (a.t >= ATORDOADO) voltarAGuarda(l, -1);
      break;
    case 'levantando':
      if (a.t >= LEVANTANDO) voltarAGuarda(l, 40);
      break;
  }
}

// ------------------------------------------------------------------------------------------------------------------
// QUEM JOGA
// ------------------------------------------------------------------------------------------------------------------

/** O soco chega: o que acontece depende do que o adversário está fazendo agora. */
function impacto(l: Luta, lado: number, forte: boolean) {
  const a = l.a;
  const j = l.j;
  const A = adversarioDe(l);
  if (l.queda !== null || a.estado === 'caido' || a.estado === 'levantando') return;
  const aberto = a.estado === 'aberto' || a.estado === 'atordoado' || a.estado === 'provoca';
  const interrompe = (a.estado === 'aviso' || a.estado === 'finta') && j.aTempo;
  const brecha = a.estado === 'guarda' && a.guarda !== 0 && a.guarda !== lado;
  if (forte) {
    const n = j.estrelas;
    j.estrelas = 0;
    // o soco forte só não entra na guarda alta e no golpe saindo
    if (aberto || a.estado === 'aviso' || a.estado === 'finta' || (a.estado === 'guarda' && a.guarda !== 0)) {
      acertar(l, 15 + 15 * n, lado, true);
      if (l.queda === null) atordoar(l);
    } else {
      l.eventos.push({ tipo: 'bloqueado', lado });
      voltarAGuarda(l, 4);
      a.fila.length = 0;
      a.fila.push(A.resposta);
    }
    return;
  }
  if (interrompe) {
    ganharEstrela(l);
    l.eventos.push({ tipo: 'interrompeu' });
    acertar(l, 6, lado, false);
    if (l.queda === null) atordoar(l);
    return;
  }
  if (aberto || brecha) {
    if (a.estado === 'provoca' || (a.estado === 'aberto' && a.t <= a.estrelaAte)) ganharEstrela(l);
    a.estrelaAte = 0;
    acertar(l, aberto ? 6 : 4, lado, false);
    if (l.queda !== null) return;
    const cadeia = a.cadeia + 1;
    if (cadeia >= A.cadeia) {
      // fechou a guarda e responde
      voltarAGuarda(l, 4);
      a.guarda = 0;
      a.fila.length = 0;
      a.fila.push(A.resposta);
      return;
    }
    atordoar(l);
    a.cadeia = cadeia;
    return;
  }
  // na guarda (ou no golpe saindo): bateu na luva
  l.eventos.push({ tipo: 'bloqueado', lado });
  cansar(l, 1);
  a.bloqueados++;
  if (a.estado === 'guarda' && a.bloqueados >= A.paciencia) {
    a.bloqueados = 0;
    a.dura = a.t + 4;
    a.fila.length = 0;
    a.fila.push(A.resposta);
  }
}

function atordoar(l: Luta) {
  const a = l.a;
  a.estado = 'atordoado';
  a.t = 0;
  a.golpe = null;
  a.fila.length = 0;
}

function ganharEstrela(l: Luta) {
  if (l.j.estrelas < ESTRELAS) {
    l.j.estrelas++;
    l.eventos.push({ tipo: 'estrela' });
  }
}

function acertar(l: Luta, dano: number, lado: number, forte: boolean) {
  const a = l.a;
  a.vida -= dano;
  a.levou = 0;
  a.bloqueados = 0;
  l.danoDado += dano;
  l.eventos.push({ tipo: 'soco', forte, lado });
  if (a.vida <= 0) {
    a.vida = 0;
    derrubar(l, 'adversario');
  }
}

function derrubar(l: Luta, quem: 'jogador' | 'adversario') {
  l.queda = quem;
  l.contagem = 0;
  l.contagemT = 0;
  l.eventos.push({ tipo: 'queda', quem });
  if (quem === 'jogador') {
    const j = l.j;
    j.quedas++;
    j.estado = 'caido';
    j.t = 0;
    j.toques = 0;
    j.estrelas = 0;
    // o adversário vai para o canto dele e espera
    l.a.fila.length = 0;
    voltarAGuarda(l, 90);
  } else {
    const a = l.a;
    a.quedas++;
    a.estado = 'caido';
    a.t = 0;
    a.golpe = null;
    a.fila.length = 0;
    // a primeira queda levanta cedo, a segunda tarde (às vezes não), a terceira nunca
    a.levantaEm = a.quedas === 1 ? 3 + sortear(l, 4) : a.quedas === 2 ? 6 + sortear(l, 5) : 11;
  }
}

function comecar(j: Jogador, estado: EstadoDoJogador, lado: number) {
  j.estado = estado;
  j.t = 0;
  j.lado = lado;
  j.aTempo = false;
}

function passoDoJogador(l: Luta, bits: number) {
  const j = l.j;
  const novo = bits & ~l.prev;
  l.prev = bits;
  if (j.cansado > 0) {
    j.cansado--;
    if (j.cansado === 0) j.folego = 4;
  }
  if (j.estado === 'caido') {
    if (novo !== 0) j.toques++;
    return;
  }
  j.t++;
  switch (j.estado) {
    case 'atingido':
      if (j.t >= ATINGIDO) j.estado = 'pronto';
      break;
    case 'esquiva':
      if (j.t >= ESQUIVA) j.estado = 'pronto';
      break;
    case 'abaixado':
      if (j.t >= ABAIXADO) j.estado = 'pronto';
      break;
    case 'socando':
      if (j.t === IMPACTO_DO_SOCO) impacto(l, j.lado, false);
      if (j.t >= SOCO) j.estado = 'pronto';
      break;
    case 'forte':
      if (j.t === IMPACTO_DO_FORTE) impacto(l, 0, true);
      if (j.t >= SOCO_FORTE) j.estado = 'pronto';
      break;
  }
  if (j.estado !== 'pronto' && j.estado !== 'guarda') return;
  // com o adversário no chão, ninguém bate
  if (l.queda !== null) {
    j.estado = 'pronto';
    return;
  }
  const a = l.a;
  const descansado = j.cansado === 0;
  if ((novo & ESQ) !== 0) comecar(j, 'esquiva', -1);
  else if ((novo & DIR) !== 0) comecar(j, 'esquiva', 1);
  else if ((novo & BAIXO) !== 0) comecar(j, 'abaixado', 0);
  else if ((novo & FORTE) !== 0 && j.estrelas > 0 && descansado) comecar(j, 'forte', 0);
  else if ((novo & (SOCO_E | SOCO_D)) !== 0 && descansado) {
    comecar(j, 'socando', (novo & SOCO_E) !== 0 ? -1 : 1);
    // apertou durante o brilho
    const g = a.golpe;
    j.aTempo = a.estado === 'aviso' && g !== null && g.brilho !== null && a.t >= g.brilho[0] && a.t <= g.brilho[1];
  } else j.estado = (bits & CIMA) !== 0 ? 'guarda' : 'pronto';
}

// ------------------------------------------------------------------------------------------------------------------
// A LUTA E O CIRCUITO
// ------------------------------------------------------------------------------------------------------------------

function fimDaLuta(l: Luta, venceu: boolean, nocaute: boolean) {
  l.fase = 'resultado';
  l.faseT = 0;
  l.venceuUltima = venceu;
  l.nocaute = nocaute;
  l.queda = null;
  if (venceu) l.vencidas++;
  l.eventos.push({ tipo: 'fim-da-luta', venceu, nocaute });
}

function passoDaContagem(l: Luta) {
  l.contagemT++;
  if (l.queda === 'jogador') {
    const j = l.j;
    const precisa = j.quedas <= TOQUES_PARA_LEVANTAR.length ? TOQUES_PARA_LEVANTAR[j.quedas - 1] : 1e9;
    if (j.toques >= precisa && l.contagem >= 2) {
      l.queda = null;
      j.estado = 'pronto';
      j.t = 0;
      j.vida = j.quedas === 1 ? 60 : 40;
      l.eventos.push({ tipo: 'levantou', quem: 'jogador' });
      return;
    }
  }
  if (l.contagemT < PASSOS_DA_CONTAGEM) return;
  l.contagemT = 0;
  l.contagem++;
  l.eventos.push({ tipo: 'contagem', n: l.contagem });
  if (l.queda === 'adversario' && l.contagem >= l.a.levantaEm && l.contagem < 10) {
    const a = l.a;
    const A = adversarioDe(l);
    l.queda = null;
    a.estado = 'levantando';
    a.t = 0;
    a.vida = a.quedas === 1 ? A.levanta[0] : A.levanta[1];
    l.eventos.push({ tipo: 'levantou', quem: 'adversario' });
    return;
  }
  if (l.contagem >= 10) fimDaLuta(l, l.queda === 'adversario', true);
}

/** Um passo de 1/60 s com os comandos deste passo. */
export function passo(l: Luta, bits: number) {
  if (l.terminou) return;
  l.eventos.length = 0;
  l.passo++;
  l.faseT++;
  switch (l.fase) {
    case 'apresentacao':
      l.prev = bits;
      if (l.faseT >= PASSOS_DA_APRESENTACAO) {
        l.fase = 'luta';
        l.faseT = 0;
        l.eventos.push({ tipo: 'gongo' });
      }
      return;
    case 'intervalo':
      l.prev = bits;
      if (l.faseT >= PASSOS_DO_INTERVALO) {
        l.fase = 'luta';
        l.faseT = 0;
        l.round++;
        l.relogio = 0;
        l.eventos.push({ tipo: 'gongo' });
      }
      return;
    case 'resultado':
      l.prev = bits;
      if (l.faseT >= PASSOS_DO_RESULTADO) {
        if (!l.venceuUltima || l.vencidas >= ADVERSARIOS.length) {
          l.terminou = true;
          return;
        }
        // o próximo adversário
        l.adv++;
        l.fase = 'apresentacao';
        l.faseT = 0;
        l.round = 1;
        l.relogio = 0;
        l.danoDado = 0;
        l.danoRecebido = 0;
        l.venceuUltima = null;
        l.nocaute = false;
        l.j = novoJogador();
        l.a = novoOponente(l.adv, l.circuito);
      }
      return;
  }
  // a luta
  if (l.queda !== null) {
    passoDoJogador(l, bits);
    // o relógio do round para enquanto alguém está no chão
    passoDaContagem(l);
    return;
  }
  passoDoJogador(l, bits);
  if (l.queda === null) passoDoAdversario(l);
  if (l.queda !== null) return;
  l.relogio++;
  if (l.relogio < PASSOS_DO_ROUND) return;
  if (l.round < ROUNDS) {
    l.fase = 'intervalo';
    l.faseT = 0;
    l.eventos.push({ tipo: 'gongo' });
    const j = l.j;
    j.estado = 'pronto';
    j.t = 0;
    j.vida = Math.min(100, j.vida + 25);
    j.folego = FOLEGO;
    j.cansado = 0;
    const a = l.a;
    a.vida = Math.min(adversarioDe(l).vida, a.vida + 15);
    a.fila.length = 0;
    voltarAGuarda(l, 60);
    return;
  }
  // a decisão: quem caiu menos; empatado, quem bateu mais do que levou
  const venceu = l.a.quedas !== l.j.quedas ? l.a.quedas > l.j.quedas : l.danoDado > l.danoRecebido;
  fimDaLuta(l, venceu, false);
}

// ------------------------------------------------------------------------------------------------------------------
// OS COMANDOS GUARDADOS E A CONFERÊNCIA
// ------------------------------------------------------------------------------------------------------------------

/** Os comandos do circuito em trechos: [quantos passos, os bits], [quantos passos, os bits]… */
export type Entradas = number[];

export function entradasValidas(e: unknown): e is Entradas {
  if (!Array.isArray(e) || e.length === 0 || e.length % 2 !== 0 || e.length > 2 * PASSOS_MAXIMOS) return false;
  let total = 0;
  for (let i = 0; i < e.length; i += 2) {
    const n = e[i];
    const b = e[i + 1];
    if (typeof n !== 'number' || typeof b !== 'number' || !Number.isInteger(n) || !Number.isInteger(b)) return false;
    if (n < 1 || b < 0 || b > TODOS_OS_BITS) return false;
    total += n;
    if (total > PASSOS_MAXIMOS) return false;
  }
  return true;
}

/** Junta os comandos de um passo aos trechos (o mesmo comando seguido só soma no trecho). */
export function anotar(e: Entradas, bits: number) {
  const n = e.length;
  if (n > 0 && e[n - 1] === bits) e[n - 2]++;
  else e.push(1, bits);
}

/** Refaz o circuito inteiro pelos comandos. `passos` é quantos passos os comandos cobrem. */
export function refazer(semente: number, e: Entradas, circuito = 0): { l: Luta; passos: number } {
  const l = novaLuta(semente, circuito);
  let passos = 0;
  for (let i = 0; i < e.length; i += 2) {
    for (let k = 0; k < e[i]; k++) {
      passos++;
      if (!l.terminou) passo(l, e[i + 1]);
    }
  }
  return { l, passos };
}

/** O resultado de um circuito, para comparar: quantas lutas venceu, o tempo, e o que bateu na luta em que parou. */
export interface Resultado {
  vencidas: number;
  passos: number;
  dano: number;
}

export function resultadoDe(l: Luta): Resultado {
  return { vencidas: l.vencidas, passos: l.passo, dano: l.vencidas >= ADVERSARIOS.length ? 0 : l.danoDado };
}

/**
 * Quem foi mais longe: mais lutas vencidas; com o circuito inteiro, o menor tempo; parado na mesma luta, quem bateu mais nela.
 * Negativo: `a` foi melhor.
 */
export function comparar(a: Resultado, b: Resultado): number {
  if (a.vencidas !== b.vencidas) return b.vencidas - a.vencidas;
  if (a.vencidas >= ADVERSARIOS.length) return a.passos - b.passos;
  return b.dano - a.dano;
}
