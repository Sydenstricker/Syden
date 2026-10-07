// O kit do quarto: cada peça, o pedaço do conceito (imagem/Sugestao/home.png) que serve de referência, o
// tamanho na resolução do quarto e a função que ela terá na home. A densidade é uma só para todas as
// peças: o conceito de 1254 px vira um quarto de 256 px, e cada peça é recortada na mesma escala.
export const ESCALA = 256 / 1254;

// recorte: [x, y, largura, altura] no conceito de 1254 px. lado: a tela quadrada da peça, em px do quarto.
export const PECAS = [
  { id: 'casca', nome: 'Quarto vazio', funcao: '—', lado: 256, recorte: [0, 0, 1254, 1254],
    descricao: 'empty isometric cutaway bedroom, only the wooden plank floor and two walls (left and right walls meeting at the back corner), thick wooden wall edges, no furniture, no objects, no window, no decorations' },
  { id: 'cama', nome: 'Cama', funcao: 'onde o coelho fica', lado: 112, recorte: [255, 380, 520, 455],
    descricao: 'isometric wooden single bed with drawers underneath, two cream pillows, blue-grey plaid blanket, empty bed, nobody on it' },
  { id: 'coelho', nome: 'Coelho', funcao: 'cutucar', lado: 64, recorte: [355, 395, 195, 245],
    descricao: 'cute cream white bunny with long pink-inside ears, wearing a dark hoodie, sitting and reading a green book, full body, eyes closed peacefully' },
  { id: 'estante', nome: 'Estante', funcao: 'Novidades', lado: 64, recorte: [100, 520, 235, 270],
    descricao: 'isometric small wooden bookcase with books on its shelves, a warm table lamp and a mug on top' },
  { id: 'mesa', nome: 'Mesa com computador', funcao: 'Mini-games', lado: 96, recorte: [780, 460, 410, 420],
    descricao: 'isometric wooden desk with a computer monitor, keyboard, mouse, a small plant and a pencil cup, and a dark office chair' },
  { id: 'fone', nome: 'Fone de ouvido', funcao: 'Salas de voz', lado: 32, recorte: [1090, 515, 80, 95],
    descricao: 'over-ear headphones, dark grey, resting, small icon-like object' },
  { id: 'janela', nome: 'Janela', funcao: 'dia e noite', lado: 96, recorte: [600, 100, 345, 470],
    descricao: 'window on the right wall of an isometric room, wooden frame, dark grey-blue curtains on both sides, a view of trees and a calm daytime sky outside' },
  { id: 'poster', nome: 'Pôster do coelho', funcao: 'Coelhos (escolher o seu)', lado: 48, recorte: [445, 140, 100, 205],
    descricao: 'framed poster hanging on the left wall of an isometric room, showing a simple bunny face' },
  { id: 'gato', nome: 'Gato', funcao: 'enfeite que reage', lado: 32, recorte: [548, 500, 100, 65],
    descricao: 'small grey cat curled up sleeping' },
  { id: 'tapete', nome: 'Tapete e pufe', funcao: 'onde aparecem os amigos em chamada', lado: 144, recorte: [340, 750, 650, 360],
    descricao: 'isometric soft green rectangular rug lying flat on the floor, with a round dark grey floor pouf on it' },
  { id: 'prateleira', nome: 'Prateleira com plantas', funcao: 'enfeite', lado: 64, recorte: [85, 240, 240, 300],
    descricao: 'wall shelf on the left wall of an isometric room with books and hanging trailing ivy plants in pots' },
  // As que o conceito não tem: o estilo vem das outras peças.
  { id: 'guarda-roupa', nome: 'Guarda-roupa', funcao: 'Guarda-roupa', lado: 96, estilo: ['estante', 'cama'],
    descricao: 'isometric tall wooden wardrobe with two doors and small round knobs, against the left wall' },
  { id: 'porta', nome: 'Porta', funcao: 'Explorar (sair para outra comunidade)', lado: 96, estilo: ['janela', 'estante'],
    descricao: 'closed wooden door with a round brass knob, on the right wall of an isometric room' },
  { id: 'mural', nome: 'Mural de fotos', funcao: 'Amigos', lado: 48, estilo: ['poster', 'prateleira'],
    descricao: 'a few small instant photos pinned on a string with clips, hanging on the left wall of an isometric room' },
  { id: 'cortica', nome: 'Quadro de cortiça', funcao: 'Caixa de ideias', lado: 48, estilo: ['poster', 'estante'],
    descricao: 'small cork board with colored paper notes pinned, hanging on the right wall of an isometric room' },
  { id: 'vaso', nome: 'Vaso de cenouras', funcao: 'plantar cenoura', lado: 32, estilo: ['prateleira', 'estante'],
    descricao: 'small terracotta pot with three carrot plants sprouting, leafy green tops' },
];

// As três da comparação entre as ferramentas.
export const COMPARACAO = ['cama', 'estante', 'coelho'];
