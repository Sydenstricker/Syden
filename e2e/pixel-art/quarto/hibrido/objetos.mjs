// O que se clica no quarto, e onde. As caixas estão em pixels do quarto (313 px), lidas da foto da página
// (quarto a 3×, começando em 31,70). Cada objeto tem uma MÁSCARA (mascaras/<id>.png), tirada do próprio
// quadro pela remoção de fundo do PixelLab: é ela que dá o contorno em volta do desenho e decide onde o
// clique acerta.
export const OBJETOS = [
  { id: 'prateleira', nome: 'Novidades', oque: 'prateleira de livros', caixa: [21, 60, 81, 145], dica: 'wooden wall shelf with books, potted plants with hanging leaves and a small rabbit figurine' },
  { id: 'abajur', nome: 'Dia e noite', oque: 'abajur', caixa: [46, 127, 68, 161], dica: 'table lamp' },
  { id: 'poster', nome: 'Coelhos', oque: 'pôster do coelho', caixa: [110, 35, 134, 87], dica: 'the whole rectangular dark frame hanging on the wall, including its border and the picture inside', modo: 'remove_simple_background' },
  { id: 'quadro', nome: 'Amigos', oque: 'quadro de paisagem', caixa: [83, 53, 109, 100], dica: 'framed landscape picture' },
  { id: 'janela', nome: 'Explorar', oque: 'janela', caixa: [146, 22, 239, 145], dica: 'the window with its wooden frame, the rolled blinds at the top and BOTH dark grey curtains, the left one and the right one, complete' },
  { id: 'cortica', nome: 'Caixa de ideias', oque: 'quadro de cortiça', caixa: [237, 73, 265, 113], dica: 'the whole rectangular board hanging on the wall, including its frame and the notes pinned on it', modo: 'remove_simple_background' },
  { id: 'computador', nome: 'Mini-games', oque: 'computador', caixa: [211, 115, 268, 173], dica: 'computer monitor and keyboard on a desk' },
  { id: 'fone', nome: 'Salas de voz', oque: 'fone de ouvido', caixa: [271, 129, 291, 153], dica: 'headphones' },
  { id: 'armario', nome: 'Guarda-roupa', oque: 'armarinho com o coelho', caixa: [266, 193, 298, 240], dica: 'small dark cabinet with a rabbit logo' },
  { id: 'vaso', nome: 'Plantar cenoura', oque: 'vaso', caixa: [25, 178, 56, 212], dica: 'potted plant' },
];

// As peças vivas, recortadas do conceito (onde ainda estão na cama) e postas sobre o quarto sem elas.
export const VIVOS = [
  { id: 'coelho', nome: 'Coelho', caixa: [88, 98, 137, 162], dica: 'rabbit in a dark hoodie reading a green book' },
  { id: 'gato', nome: 'Gato', caixa: [135, 125, 162, 142], dica: 'small grey cat sleeping curled up' },
];
