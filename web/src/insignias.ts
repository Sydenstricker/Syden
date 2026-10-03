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
  },
  'ideia-acolhida': {
    codigo: 'ideia-acolhida',
    nome: chave('Ideia acolhida'),
    descricao: chave('Uma ideia sua entrou no Syden'),
    frase: chave('A sua ideia virou parte do Syden. Obrigado por ajudar a construir isto.'),
    arte: medalhaUrl,
    moldura: 'ouro',
    etiqueta: chave('Recompensa'),
  },
};

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
    }
  );
}
