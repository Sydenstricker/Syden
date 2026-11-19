/**
 * O catálogo das insígnias: arte, nome, cor da moldura e a frase que aparece na tela de destaque.
 *
 * Mora aqui, no app, e não no banco — o servidor guarda só o CÓDIGO de cada item. Assim dá para trocar
 * a arte de uma insígnia, mexer no texto ou mudar a cor da moldura publicando o site, sem tocar no
 * servidor nem migrar banco. É a mesma escolha das cores de nome e dos fundos de perfil.
 */
import { chave, t } from './i18n';
import type { TipoDeMoldura } from './Medalha';
import medalhaUrl from './assets/medalha.png';
import primeirosUrl from './assets/insignia-primeiros-25.png';
import segredoUrl from './assets/insignia-codigo-secreto.png';
import { ARTE_DO_FLIPERAMA } from './arteDoFliperama';

export interface Insignia {
  codigo: string;
  nome: string;
  /** Uma linha, no perfil e na lista de insígnias. */
  descricao: string;
  /** A frase da tela de destaque: é o agradecimento, na voz do Syden. */
  frase: string;
  arte: string;
  moldura: TipoDeMoldura;
  /** A palavra que aparece na etiqueta, no alto do cartão. */
  etiqueta: string;
  /**
   * Como se ganha, numa frase: é o que o catálogo mostra embaixo da que a pessoa ainda não tem (19/11/2026). Sem
   * contagem, sem "faltam", sem prazo: a regra das conquistas.
   */
  comoSeGanha: string;
}

export const INSIGNIAS: Record<string, Insignia> = {
  'primeiros-25': {
    codigo: 'primeiros-25',
    nome: chave('Um dos 25 primeiros'),
    descricao: chave('Estava aqui quando o Syden ainda era só entre amigos'),
    frase: chave('Você chegou no começo de tudo. Obrigado por estar aqui desde quando isto era só uma ideia entre amigos.'),
    arte: primeirosUrl,
    moldura: 'esmeralda',
    etiqueta: chave('Presente'),
    comoSeGanha: chave('Das 25 primeiras contas do Syden'),
  },
  'ideia-acolhida': {
    codigo: 'ideia-acolhida',
    nome: chave('Ideia acolhida'),
    descricao: chave('Uma ideia sua entrou no Syden'),
    frase: chave('A sua ideia virou parte do Syden. Obrigado por ajudar a construir isto.'),
    arte: medalhaUrl,
    moldura: 'ouro',
    etiqueta: chave('Recompensa'),
    comoSeGanha: chave('Mande uma ideia pela caixa de ideias e ela entra no Syden'),
  },
  // O easter egg: ↑↑↓↓←→←→BA no teclado do app (codigoSecreto.ts). A arte é
  // um cartucho com a sequência na etiqueta, feita por ele (10/10/2026).
  'codigo-secreto': {
    codigo: 'codigo-secreto',
    nome: chave('Código secreto'),
    descricao: chave('Achou o código que só quem procura acha'),
    frase: chave('Você achou o código secreto. Os melhores segredos são de quem procura.'),
    arte: segredoUrl,
    moldura: 'prata',
    etiqueta: chave('Segredo'),
    // O segredo continua segredo: a frase diz que existe, não qual é.
    comoSeGanha: chave('Um código escondido no teclado do app. Quem procura acha.'),
  },
  // O FLIPERAMA COM A TURMA (19/11/2026): mini-games DIFERENTES jogados na sala com 2 ou mais pessoas. Quem decide é o
  // servidor (presentes.ts). Três insígnias separadas, e não níveis com barra; a arte é pixel art por código.
  'fliperama-5': {
    codigo: 'fliperama-5',
    nome: chave('Fliperama em turma'),
    descricao: chave('Jogou 5 mini-games diferentes com a turma'),
    frase: chave('Cinco jogos diferentes, todos com gente junto. O fliperama fica melhor assim.'),
    arte: ARTE_DO_FLIPERAMA.controle,
    moldura: 'bronze',
    etiqueta: chave('Conquista'),
    comoSeGanha: chave('Jogar 5 mini-games diferentes na sala, com mais alguém'),
  },
  'fliperama-15': {
    codigo: 'fliperama-15',
    nome: chave('Fliperama de toda noite'),
    descricao: chave('Jogou 15 mini-games diferentes com a turma'),
    frase: chave('Quinze jogos diferentes com a turma. Já dá para escolher o da noite de olhos fechados.'),
    arte: ARTE_DO_FLIPERAMA.alavanca,
    moldura: 'prata',
    etiqueta: chave('Conquista'),
    comoSeGanha: chave('Jogar 15 mini-games diferentes na sala, com mais alguém'),
  },
  'fliperama-30': {
    codigo: 'fliperama-30',
    nome: chave('Lenda do fliperama'),
    descricao: chave('Jogou 30 mini-games diferentes com a turma'),
    frase: chave('Trinta jogos diferentes, sempre com gente junto. O fliperama inteiro tem a sua marca.'),
    arte: ARTE_DO_FLIPERAMA.gabinete,
    moldura: 'ouro',
    etiqueta: chave('Conquista'),
    comoSeGanha: chave('Jogar 30 mini-games diferentes na sala, com mais alguém'),
  },
};

/** A ordem do catálogo: a mesma desta tabela. */
export const ORDEM_DAS_INSIGNIAS = Object.keys(INSIGNIAS);

/**
 * Uma insígnia que o servidor mandou e este app ainda não conhece (site desatualizado) não quebra a tela.
 *
 * DEVOLVE JÁ TRADUZIDA, e é por isso que os textos acima vão em `chave()`. Eles moravam crus nesta
 * tabela e eram mostrados direto em cinco telas — e a primeira delas é a de presente, a primeira coisa
 * que TODA conta nova vê: saía em português em todas as línguas. A contagem de textos sem tradução
 * não os via, porque procura o `t()` (é a armadilha do texto em tabela, longe do t()). Traduzir aqui,
 * num ponto só, impede que um sexto lugar esqueça. Quem chama já está dentro de um componente com
 * useT, que redesenha quando o idioma muda.
 */
export function acharInsignia(codigo: string): Insignia | undefined {
  const insignia = INSIGNIAS[codigo];
  return (
    insignia && {
      ...insignia,
      nome: t(insignia.nome),
      descricao: t(insignia.descricao),
      frase: t(insignia.frase),
      etiqueta: t(insignia.etiqueta),
      comoSeGanha: t(insignia.comoSeGanha),
    }
  );
}
