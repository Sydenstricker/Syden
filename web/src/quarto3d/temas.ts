/**
 * OS TEMAS DO QUARTO 3D (06/11/2026, pedido dele: "PRESETS do quarto 3D para o usuário escolher", que viraram, no mesmo dia,
 * CONJUNTOS DE MODELOS: "a POSIÇÃO do item no quarto 2D terá o OBJETO EQUIVALENTE 3D na MESMA POSIÇÃO"). A arrumação é uma só,
 * a do pixel art (arrumacao.ts); o tema diz só QUAL MODELO 3D desenha cada peça de pixel. Trocar de tema não move nada.
 *
 * - "classico": o piloto (KayKit Furniture e Restaurant Bits, Kenney Furniture Kit), o quarto que foi ao app primeiro.
 * - "colorido": o Tiny Treats (Isa Lousberg, CC0): arredondado como o KayKit, mais saturado; quarto (Playful Bedroom), sala
 *   (Lovely Living Room), plantas (House Plants), cozinha (Charming Kitchen), piquenique e doces. Em web/public/quarto3d/tinytreats/.
 * - O TERCEIRO, quando houver material: o Kenney Furniture Kit inteiro (cama, mesa, cadeira, estante, abajur e a parede com
 *   janela), mais anguloso — é só um objeto TEMAS a mais, com as mesmas chaves.
 *
 * Toda peça de pixel tem a sua linha em todo tema (o teste confere): móveis (TAMANHOS de arrumacao.ts), objetos da parede
 * (ITENS_DA_PAREDE), objetos de cima e a janela. O que nenhum pacote tem é feito por código na cena ("codigo:…": o fone, a
 * cortiça, os troféus, o neon, o violão e o relógio do clássico). Os caminhos são relativos a web/public/quarto3d/.
 */

export interface Parte {
  arquivo: string;
  dx?: number;
  dz?: number;
  /** A altura da base da parte; sem ela, em cima da peça (o tampo). */
  dy?: number;
  giro?: number;
  escala?: number;
  cores?: Record<string, string>;
  /** Uma lâmpada: a luz do móvel nasce aqui (o abajur do criado-mudo). */
  luz?: boolean;
}

export interface PecaDoTema {
  arquivo: string;
  /** Multiplica o tamanho do pacote. */
  escala?: number;
  /**
   * Como a peça cabe no pé que ela tem no pixel: 'encolher' (de fábrica) reduz o que passa do pé e deixa o menor como é;
   * 'encher' leva ao tamanho do pé (o tapete); 'livre' não mexe.
   */
  cabe?: 'encolher' | 'encher' | 'livre';
  /** Encostada no fundo do pé (a cabeceira da cama, as costas do guarda-roupa), e não no meio. */
  encostar?: boolean;
  /** Um giro a mais, para a frente do modelo olhar para +z. */
  giro?: number;
  cores?: Record<string, string>;
  partes?: Parte[];
  /** Sentar: a animação do coelho e a altura do assento (fração da altura da peça). Deitar não pede número: a cama é medida no modelo (pontoDeDeitar, em cena.ts). */
  pose?: string;
  assento?: number;
  avanco?: number;
  /** O tampo, para os objetos de cima, em fração da altura da peça (sem ela, o alto da caixa da peça, sem as partes). */
  tampo?: number;
}

export interface PecaDaParede {
  arquivo: string;
  escala?: number;
  partes?: Parte[];
  /** O quadro de Amigos: as fotos desenhadas por código no lugar da imagem do pacote. */
  fotos?: 'kaykit' | 'moldura';
  /** Várias molduras lado a lado (o quadro do colorido): os deslocamentos ao longo da parede e da altura. */
  repetir?: [number, number][];
}

export interface Tema {
  id: string;
  /** O tamanho do pacote (o KayKit e o Tiny Treats medem as casas em 2: com 0,75, a mesa tem a altura de sempre). */
  escala: number;
  chao: { arquivo?: string; casas?: number; cor?: string };
  parede: {
    reta: string;
    /** A largura da peça reta no pacote. */
    largura: number;
    /** A janela: uma peça só, ou a de três (a ponta da esquerda, a do meio repetida, a da direita). */
    janela: string;
    janelaTres?: [string, string, string];
    cortina?: Parte;
    /** A cor média do reboco, contra a qual a cor do Cômodo é tirada. */
    base: [number, number, number];
    topo: string;
  };
  moveis: Record<string, PecaDoTema>;
  cadeira: PecaDoTema;
  naParede: Record<string, PecaDaParede>;
  deCima: Record<string, { arquivo: string; alto: number }>;
  /** Junta as peças paradas de mesma textura numa malha só (o banheiro do salão fez assim). */
  juntar?: boolean;
  /** As luzinhas do alto das paredes. */
  luzinhas?: boolean;
}

const T = 'tinytreats/';

export const TEMAS: Record<string, Tema> = {
  classico: {
    id: 'classico',
    escala: 0.75,
    chao: {},
    parede: { reta: 'restaurante/wall', largura: 4, janela: 'restaurante/wall_window_closed_curtains_green', base: [232, 220, 196], topo: '#5c4a3d' },
    moveis: {
      cama: { arquivo: 'bed_double_B', encostar: true },
      abajur: {
        arquivo: 'cabinet_small',
        encostar: true,
        partes: [
          { arquivo: 'lamp_table', dx: 0, dz: -0.05, luz: true },
          { arquivo: 'pictureframe_standing_A', dx: 0.28, dz: -0.2, escala: 0.6 },
        ],
      },
      'guarda-roupa': { arquivo: 'kenney/bookcaseClosedDoors', encostar: true, escala: 1.15 },
      mesa: {
        arquivo: 'desk_large',
        encostar: true,
        // os três monitores da mesa em L (pedido dele, 06/11/2026), na mesa comprida: o pé dela no pixel é 3 × 1, e o L não cabe
        partes: [
          { arquivo: 'monitor', dx: -1.15, dz: -0.18, giro: 0.35 },
          { arquivo: 'monitor', dx: 0, dz: -0.3 },
          { arquivo: 'monitor', dx: 1.15, dz: -0.18, giro: -0.35 },
          { arquivo: 'keyboard', dx: -0.05, dz: 0.22 },
          { arquivo: 'mousepad_A', dx: 0.62, dz: 0.24 },
          { arquivo: 'mouse', dx: 0.62, dz: 0.24 },
        ],
      },
      poltrona: { arquivo: 'armchair_pillows', pose: 'poltrona', assento: 0.36, avanco: 0.08 },
      pufe: { arquivo: 'kenney/loungeSofaOttoman', escala: 0.9, pose: 'sentado', assento: 0.62 },
      tapete: { arquivo: 'rug_oval_B', cabe: 'encher' },
      'planta-alta': { arquivo: 'kenney/pottedPlant', cores: { wood: '#c9714f' }, escala: 1.1 },
      'planta-baixa': { arquivo: 'cactus_medium_B' },
    },
    cadeira: { arquivo: 'chair_desk_A', pose: 'computador', assento: 0.37, avanco: 0.02 },
    naParede: {
      quadro: { arquivo: 'pictureframe_large_B', fotos: 'kaykit' },
      fone: { arquivo: 'codigo:fone' },
      cortica: { arquivo: 'codigo:cortica' },
      trofeus: {
        arquivo: 'shelf_A_big',
        partes: [
          { arquivo: 'codigo:trofeu', dx: -0.55 },
          { arquivo: 'codigo:trofeu', dx: 0, escala: 1.25 },
          { arquivo: 'codigo:trofeu', dx: 0.55, escala: 0.9 },
        ],
      },
      prateleira: {
        arquivo: 'shelf_A_big',
        partes: [
          { arquivo: 'kenney/books', dx: -0.45 },
          { arquivo: 'kenney/books', dx: -0.15, giro: Math.PI, cores: { carpetDarker: '#6f8fb5' } },
          { arquivo: 'kenney/plantSmall3', dx: 0.5 },
        ],
      },
      pintura: { arquivo: 'pictureframe_small_B', escala: 1.6 },
      'prateleira-bar': {
        arquivo: 'shelf_A_big',
        partes: [
          { arquivo: 'comida/soda-glass', dx: -0.5, escala: 0.5 },
          { arquivo: 'comida/soda-can', dx: 0, escala: 0.55 },
          { arquivo: 'mug_A', dx: 0.5 },
        ],
      },
      'prateleira-snacks': {
        arquivo: 'shelf_A_big',
        partes: [
          { arquivo: 'comida/bag', dx: -0.5, escala: 0.5 },
          { arquivo: 'comida/fries', dx: 0.05, escala: 0.55 },
          { arquivo: 'cup_pencils', dx: 0.55, escala: 0.8 },
        ],
      },
      neon: { arquivo: 'codigo:neon' },
      relogio: { arquivo: 'codigo:relogio' },
      violao: { arquivo: 'codigo:violao' },
      porta: { arquivo: 'restaurante/door_A' },
    },
    deCima: {
      caneca: { arquivo: 'mug_A', alto: 0.2 },
      suco: { arquivo: 'comida/soda-glass', alto: 0.32 },
      refrigerante: { arquivo: 'comida/soda-can', alto: 0.28 },
      plantinha: { arquivo: 'cactus_small_B', alto: 0.38 },
      livros: { arquivo: 'book_set', alto: 0.3 },
      videogame: { arquivo: 'gameconsole_handheld', alto: 0.12 },
      pipoca: { arquivo: 'comida/fries', alto: 0.32 },
      retrato: { arquivo: 'pictureframe_standing_A', alto: 0.36 },
      salgadinho: { arquivo: 'comida/bag', alto: 0.36 },
      bolo: { arquivo: 'comida/cake', alto: 0.22 },
    },
    luzinhas: true,
  },

  colorido: {
    id: 'colorido',
    escala: 0.75,
    // as tábuas do quarto do pacote, uma placa a cada 2 casas (as plantas têm lados de 8, 6 e 4)
    chao: { arquivo: T + 'floor_wood', casas: 2 },
    parede: {
      reta: T + 'wall_panelled_living_room_straight',
      largura: 2,
      janela: T + 'wall_panelled_living_room_window_large',
      janelaTres: [T + 'wall_panelled_living_room_window_full_left', T + 'wall_panelled_living_room_window_full_center', T + 'wall_panelled_living_room_window_full_right'],
      base: [178, 176, 206],
      topo: '#5d5f80',
    },
    moveis: {
      // a cama do pacote é de solteiro (1,2 × 2,25): um tanto maior, ela enche melhor o pé de casal do pixel (2 × 3)
      cama: {
        arquivo: T + 'bed_blue',
        escala: 1.15,
        encostar: true,
        partes: [{ arquivo: T + 'teddy_bear', dx: 0.42, dz: 1.0, dy: 0.5, giro: -0.5, escala: 0.75 }],
      },
      abajur: {
        arquivo: T + 'nightstand_blue',
        encostar: true,
        partes: [
          { arquivo: T + 'lamp_A', dx: 0, dz: -0.1, luz: true },
          { arquivo: T + 'alarm_clock', dx: 0.3, dz: -0.28, giro: -0.4, escala: 0.55 },
        ],
      },
      // o guarda-roupa é a cômoda de gavetas (o pacote não tem armário alto; a função é a das "gavetas" desde a home antiga)
      'guarda-roupa': {
        arquivo: T + 'closet_blue',
        encostar: true,
        escala: 1.1,
        partes: [{ arquivo: T + 'record_player_brown', dx: -0.4, dz: -0.1, escala: 0.75 }],
      },
      mesa: {
        arquivo: T + 'desk_blue',
        encostar: true,
        escala: 1.15,
        partes: [
          { arquivo: T + 'computer', dx: -0.2, dz: -0.2 },
          { arquivo: T + 'keyboard', dx: -0.2, dz: 0.35 },
          { arquivo: T + 'mouse', dx: 0.3, dz: 0.38 },
          { arquivo: T + 'lamp_B', dx: 0.85, dz: -0.2, giro: -0.5 },
        ],
      },
      poltrona: { arquivo: T + 'rocking_chair_brown', escala: 1.3, pose: 'poltrona', assento: 0.33, avanco: 0.05 },
      pufe: { arquivo: T + 'stool_A_orange', escala: 1.4, pose: 'sentado', assento: 1 },
      tapete: { arquivo: T + 'rug_B_large_orange', cabe: 'encher' },
      'planta-alta': { arquivo: T + 'monstera_plant_medium_potted', escala: 0.75, cabe: 'livre' },
      'planta-baixa': { arquivo: T + 'sansevieria_plant_medium_potted', escala: 0.75, cabe: 'livre' },
    },
    cadeira: { arquivo: T + 'desk_chair_blue', pose: 'computador', assento: 0.42, avanco: 0.02 },
    naParede: {
      // três molduras de pendurar, com as fotos desenhadas por código
      quadro: {
        arquivo: T + 'picture_frame_customimage_A_brown',
        fotos: 'moldura',
        escala: 1.9,
        repetir: [
          [-0.72, -0.1],
          [0, 0.12],
          [0.72, -0.06],
        ],
      },
      fone: { arquivo: 'codigo:fone' },
      cortica: { arquivo: 'codigo:cortica' },
      trofeus: {
        arquivo: T + 'wall_shelf_brown',
        partes: [
          { arquivo: 'codigo:trofeu', dx: -0.5 },
          { arquivo: 'codigo:trofeu', dx: 0, escala: 1.25 },
          { arquivo: 'codigo:trofeu', dx: 0.5, escala: 0.9 },
        ],
      },
      prateleira: {
        arquivo: T + 'wall_shelf_blue',
        partes: [
          { arquivo: T + 'rubicks_cube_A', dx: -0.4, giro: 0.3 },
          { arquivo: T + 'piggybank', dx: 0.3, giro: -0.4 },
        ],
      },
      pintura: { arquivo: T + 'poster', escala: 1.3 },
      'prateleira-bar': { arquivo: T + 'wall_shelf_kitchen_hooks_decorated' },
      'prateleira-snacks': {
        arquivo: T + 'wall_shelf_kitchen',
        partes: [
          { arquivo: T + 'container_kitchen_A_red', dx: -0.5 },
          { arquivo: T + 'container_kitchen_B_blue', dx: 0 },
          { arquivo: 'comida/bag', dx: 0.5, escala: 0.5 },
        ],
      },
      neon: { arquivo: 'codigo:neon' },
      relogio: { arquivo: T + 'clock_wall_A' },
      violao: { arquivo: 'codigo:violao' },
      porta: { arquivo: T + 'door_modular_gold' },
    },
    deCima: {
      caneca: { arquivo: T + 'mug_duck', alto: 0.22 },
      suco: { arquivo: 'comida/soda-glass', alto: 0.32 },
      refrigerante: { arquivo: T + 'drink_can', alto: 0.3 },
      plantinha: { arquivo: T + 'succulent_plant_pot_small', alto: 0.26 },
      livros: { arquivo: T + 'book_stacked', alto: 0.34 },
      videogame: { arquivo: 'gameconsole_handheld', alto: 0.12 },
      pipoca: { arquivo: 'comida/fries', alto: 0.32 },
      retrato: { arquivo: T + 'picture_frame_standing_customimage_A_brown', alto: 0.34 },
      salgadinho: { arquivo: 'comida/bag', alto: 0.36 },
      bolo: { arquivo: T + 'doces/cake_strawberry', alto: 0.3 },
    },
    juntar: true,
    luzinhas: true,
  },
};

export const ORDEM_DOS_TEMAS = ['classico', 'colorido'] as const;
const CHAVE = 'syden:quarto3d-tema';

/** O tema escolhido NESTE aparelho (por enquanto: a arrumação mora no servidor, o tema ainda não). */
export function temaEscolhido(): string {
  try {
    const t = localStorage.getItem(CHAVE);
    if (t && TEMAS[t]) return t;
  } catch {
    /* sem guardar: o de fábrica */
  }
  return 'classico';
}

export function escolherTema(id: string) {
  try {
    localStorage.setItem(CHAVE, id);
  } catch {
    /* fica só nesta visita */
  }
  window.dispatchEvent(new Event('syden:quarto3d-tema'));
}
