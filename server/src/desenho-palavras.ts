/**
 * AS PALAVRAS NOVAS E OS NÍVEIS DO DESENHA E ADIVINHA (19/11/2026, a auditoria dos mini-games). Eram 263; com estas, 627.
 * Todas NOSSAS, escritas para o Syden (nada de lista de terceiro), e o nome de cada uma mora no site, traduzido
 * (web/src/desenhoPalavras.ts; um teste confere que as listas batem).
 *
 * O NÍVEL decide as três opções de quem desenha (uma fácil, uma média, uma difícil) e o BÔNUS: o acerto de uma média vale 25% a
 * mais, o de uma difícil 50% a mais, para quem chuta e para quem desenha. Difícil é o que pede ideia para desenhar: verbos,
 * lugares, coisas abstratas, objetos de muitos detalhes.
 */

/** As que entraram em 19/11/2026 (as de antes continuam em minijogo-desenho.ts). */
export const PALAVRAS_NOVAS_DO_DESENHO = [
  'galo', 'pombo', 'foca', 'panda', 'gorila', 'burro', 'cabra', 'cisne', 'tucano', 'mosca', 'onca', 'hipopotamo',
  'rinoceronte', 'camarao', 'estrela-do-mar', 'agua-viva', 'tatu', 'coala', 'arara', 'pavao', 'lagosta', 'vagalume',
  'cervo', 'castor', 'lontra', 'morsa', 'hamster', 'lesma', 'lagarta', 'mosquito', 'grilo', 'peru', 'avestruz', 'pelicano',
  'bicho-preguica', 'lagartixa', 'escorpiao', 'libelula', 'pastel', 'biscoito', 'leite', 'suco', 'melao', 'coco',
  'abacate', 'tomate', 'batata', 'manga', 'salsicha', 'rosquinha', 'bolinho', 'picole', 'bala', 'mel', 'cebola', 'pimenta',
  'brocolis', 'alface', 'ervilha', 'azeitona', 'kiwi', 'pessego', 'caju', 'mamao', 'goiaba', 'ameixa', 'presunto',
  'brigadeiro', 'coxinha', 'pao-de-queijo', 'pudim', 'gelatina', 'algodao-doce', 'chiclete', 'cereal', 'refrigerante',
  'cha', 'salada', 'sopa', 'arroz', 'feijao', 'churrasco', 'espetinho', 'omelete', 'panqueca', 'torta', 'maracuja',
  'framboesa', 'tapioca', 'acai', 'sal', 'acucar', 'manteiga', 'iogurte', 'prato', 'caneca', 'tigela', 'travesseiro',
  'tapete', 'quadro', 'vaso', 'radio', 'caixa', 'bolsa', 'mala', 'botao', 'borracha', 'regua', 'caderno', 'cerca',
  'escorregador', 'balanco', 'piscina', 'boia', 'concha', 'bone', 'gorro', 'bota', 'chinelo', 'saia', 'vestido', 'calca',
  'bermuda', 'cinto', 'colar', 'lixeira', 'prego', 'corda', 'boneca', 'triangulo', 'lingua', 'cabelo', 'barba', 'lago',
  'girassol', 'grama', 'gota', 'patinete', 'taxi', 'canoa', 'rei', 'bule', 'chaleira', 'frigideira', 'poltrona',
  'cobertor', 'cortina', 'abajur', 'despertador', 'carteira', 'sacola', 'clipe', 'apontador', 'cola', 'giz', 'globo',
  'calculadora', 'teclado', 'controle-remoto', 'fosforo', 'portao', 'telhado', 'chamine', 'gangorra', 'guarda-sol',
  'castelo-de-areia', 'prancha-de-surfe', 'pijama', 'jaqueta', 'brinco', 'pulseira', 'batom', 'perfume', 'esponja', 'rodo',
  'pa', 'regador', 'serrote', 'parafuso', 'rede', 'carroca', 'carro-de-bombeiro', 'jangada', 'veleiro', 'lancha',
  'triciclo', 'floco-de-neve', 'caverna', 'pinheiro', 'tulipa', 'trevo', 'tronco', 'galho', 'bruxa', 'mago', 'cavaleiro',
  'bombeiro', 'cozinheiro', 'pintor', 'cauboi', 'super-heroi', 'vampiro', 'lobisomem', 'fada', 'anjo', 'espantalho',
  'aniversario', 'fogos-de-artificio', 'tempestade', 'hospital', 'estadio', 'parque', 'circo', 'cinema', 'tunel', 'cidade',
  'torre', 'floresta', 'horta', 'gol', 'basquete', 'volei', 'xadrez', 'boliche', 'golfe', 'boxe', 'dardo', 'peteca',
  'piao', 'ioio', 'domino', 'baralho', 'apito', 'surfe', 'guitarra', 'bateria', 'flauta', 'violino', 'pandeiro',
  'caixa-de-som', 'disco', 'sobrancelha', 'unha', 'umbigo', 'tatuagem', 'tesouro', 'bau', 'varinha-magica', 'caldeirao',
  'cofre', 'binoculo', 'curativo', 'bengala', 'carrinho-de-bebe', 'berco', 'chocalho', 'urso-de-pelucia', 'cubo-magico',
  'aviao-de-papel', 'bumerangue', 'estilingue', 'canhao', 'alfinete', 'impressora', 'campainha', 'elevador',
  'chave-de-fenda', 'alicate', 'furadeira', 'viatura', 'metro', 'bonde', 'dirigivel', 'asa-delta', 'monociclo', 'semente',
  'raiz', 'areia', 'terremoto', 'eclipse', 'meteoro', 'constelacao', 'galaxia', 'buraco-negro', 'viking', 'estetoscopio',
  'mergulhador', 'detetive', 'duende', 'gigante', 'dormir', 'nadar', 'pular', 'dancar', 'cantar', 'chorar', 'sorrir',
  'pescar', 'cozinhar', 'voar', 'escrever', 'pintar', 'espirrar', 'bocejar', 'mergulhar', 'acampar', 'patinar', 'abracar',
  'tropecar', 'roncar', 'casamento', 'ferias', 'carnaval', 'festa-junina', 'pesadelo', 'sonho', 'segredo', 'sombra',
  'reflexo', 'gravidade', 'eletricidade', 'internet', 'senha', 'selfie', 'engarrafamento', 'fila', 'neblina', 'piquenique',
  'museu', 'biblioteca', 'aeroporto', 'zoologico', 'padaria', 'supermercado', 'farmacia', 'posto-de-gasolina', 'muralha',
  'labirinto', 'oasis', 'pantano', 'sinuca', 'bolinha-de-gude', 'amarelinha', 'cronometro', 'sanfona', 'harpa', 'saxofone',
  'joelho', 'cotovelo', 'pulmao', 'estomago', 'musculo', 'pergaminho', 'bola-de-cristal', 'telescopio', 'microscopio',
  'termometro', 'cadeira-de-rodas', 'muleta', 'origami', 'catapulta', 'lampiao', 'balanca', 'paraquedista',
];

/** 1 = fácil. */
export const FACEIS = new Set([
  'gato', 'cachorro', 'peixe', 'passaro', 'cavalo', 'vaca', 'porco', 'galinha', 'pato', 'coelho', 'rato', 'elefante',
  'girafa', 'leao', 'macaco', 'urso', 'cobra', 'tartaruga', 'sapo', 'borboleta', 'abelha', 'aranha', 'formiga', 'caracol',
  'polvo', 'baleia', 'pinguim', 'coruja', 'zebra', 'minhoca', 'ovelha', 'joaninha', 'maca', 'banana', 'uva', 'morango',
  'abacaxi', 'melancia', 'laranja', 'limao', 'cenoura', 'cogumelo', 'pizza', 'sorvete', 'bolo', 'pao', 'queijo', 'ovo',
  'pirulito', 'cereja', 'pera', 'cadeira', 'mesa', 'cama', 'lampada', 'relogio', 'oculos', 'chapeu', 'sapato', 'meia',
  'camiseta', 'guarda-chuva', 'chave', 'tesoura', 'lapis', 'livro', 'celular', 'televisao', 'bola', 'balao', 'pipa',
  'presente', 'vela', 'copo', 'garfo', 'colher', 'faca', 'escada', 'porta', 'janela', 'balde', 'anel', 'coroa', 'bandeira',
  'dado', 'envelope', 'robo', 'foguete', 'sino', 'carro', 'onibus', 'bicicleta', 'aviao', 'barco', 'trem', 'sol', 'lua',
  'estrela', 'nuvem', 'chuva', 'arco-iris', 'arvore', 'flor', 'cacto', 'folha', 'montanha', 'casa', 'olho', 'nariz',
  'boca', 'orelha', 'mao', 'pe', 'dente', 'coracao', 'osso', 'fantasma', 'moeda', 'galo', 'pombo', 'foca', 'panda',
  'gorila', 'burro', 'cabra', 'cisne', 'tucano', 'mosca', 'pastel', 'biscoito', 'leite', 'suco', 'melao', 'coco',
  'abacate', 'tomate', 'batata', 'manga', 'salsicha', 'rosquinha', 'bolinho', 'picole', 'bala', 'prato', 'caneca',
  'tigela', 'travesseiro', 'tapete', 'quadro', 'vaso', 'radio', 'caixa', 'bolsa', 'mala', 'botao', 'borracha', 'regua',
  'caderno', 'cerca', 'escorregador', 'balanco', 'piscina', 'boia', 'concha', 'bone', 'gorro', 'bota', 'chinelo', 'saia',
  'vestido', 'calca', 'bermuda', 'cinto', 'colar', 'lixeira', 'prego', 'corda', 'boneca', 'triangulo', 'lingua', 'cabelo',
  'barba', 'lago', 'girassol', 'grama', 'gota', 'patinete', 'taxi', 'canoa', 'rei',
]);

/** 3 = difícil. As outras (as de nível 2) são médias. */
export const DIFICEIS = new Set([
  'cavalo-marinho', 'ancora', 'ima', 'controle-de-videogame', 'quebra-cabeca', 'ampulheta', 'paraquedas', 'bussola',
  'submarino', 'balao-de-ar-quente', 'disco-voador', 'cometa', 'tornado', 'piramide', 'iglu', 'moinho', 'cerebro',
  'alienigena', 'esqueleto', 'mumia', 'arco-e-flecha', 'teia-de-aranha', 'chupeta', 'mamadeira', 'carrinho-de-mao',
  'cata-vento', 'semaforo', 'hidrante', 'escova-de-cabelo', 'pasta-de-dente', 'torradeira', 'liquidificador',
  'ar-condicionado', 'tomada', 'vagalume', 'lontra', 'morsa', 'grilo', 'pelicano', 'bicho-preguica', 'libelula',
  'maracuja', 'framboesa', 'tapioca', 'acai', 'sal', 'acucar', 'manteiga', 'iogurte', 'alfinete', 'impressora',
  'campainha', 'elevador', 'chave-de-fenda', 'alicate', 'furadeira', 'viatura', 'metro', 'bonde', 'dirigivel', 'asa-delta',
  'monociclo', 'semente', 'raiz', 'areia', 'terremoto', 'eclipse', 'meteoro', 'constelacao', 'galaxia', 'buraco-negro',
  'viking', 'estetoscopio', 'mergulhador', 'detetive', 'duende', 'gigante', 'dormir', 'nadar', 'pular', 'dancar', 'cantar',
  'chorar', 'sorrir', 'pescar', 'cozinhar', 'voar', 'escrever', 'pintar', 'espirrar', 'bocejar', 'mergulhar', 'acampar',
  'patinar', 'abracar', 'tropecar', 'roncar', 'casamento', 'ferias', 'carnaval', 'festa-junina', 'pesadelo', 'sonho',
  'segredo', 'sombra', 'reflexo', 'gravidade', 'eletricidade', 'internet', 'senha', 'selfie', 'engarrafamento', 'fila',
  'neblina', 'piquenique', 'museu', 'biblioteca', 'aeroporto', 'zoologico', 'padaria', 'supermercado', 'farmacia',
  'posto-de-gasolina', 'muralha', 'labirinto', 'oasis', 'pantano', 'sinuca', 'bolinha-de-gude', 'amarelinha', 'cronometro',
  'sanfona', 'harpa', 'saxofone', 'joelho', 'cotovelo', 'pulmao', 'estomago', 'musculo', 'pergaminho', 'bola-de-cristal',
  'telescopio', 'microscopio', 'termometro', 'cadeira-de-rodas', 'muleta', 'origami', 'catapulta', 'lampiao', 'balanca',
  'paraquedista',
]);

export type NivelDoDesenho = 1 | 2 | 3;
export const nivelDoDesenho = (id: string): NivelDoDesenho => (FACEIS.has(id) ? 1 : DIFICEIS.has(id) ? 3 : 2);
/** O bônus de cada nível, que multiplica os pontos do acerto. */
export const BONUS_DO_NIVEL: Record<NivelDoDesenho, number> = { 1: 1, 2: 1.25, 3: 1.5 };
