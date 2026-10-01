// O que faz `#combinados` não virar `combinados#` quando a tela está em árabe.
//
// O DEFEITO, do jeito que ele aparece. Em árabe o Syden escreve da direita para a esquerda, e o nome de
// um canal quase sempre está em letras latinas — "combinados", "geral", "bf6". O `#` que vai na frente
// dele não é letra de nenhum alfabeto: para o Unicode ele é neutro, e neutro não tem lado. A regra do
// algoritmo bidirecional (UAX #9) manda resolver o neutro pelo sentido do PARÁGRAFO quando ele está
// entre dois sentidos diferentes — e o parágrafo, em árabe, é da direita para a esquerda. Resultado: o
// `#` é empurrado para o outro lado do nome, e a tela mostra `combinados#`.
//
// Não é bug de navegador e não se conserta com CSS: `direction` muda o parágrafo, não o neutro solto
// dentro dele. O conserto é dizer ao algoritmo que aquele pedaço é um texto à parte.
//
// POR QUE FSI, E NÃO LRI. O isolamento de primeiro forte (FSI, U+2068) olha o primeiro caractere com
// sentido próprio dentro do pedaço e adota o sentido dele. Com um nome latino ele dá da esquerda para a
// direita, e o `#` fica à esquerda, como se espera. Com um nome em árabe ele dá da direita para a
// esquerda, e o `#` fica à direita — que é como se escreve uma hashtag em árabe. O LRI (U+2066) daria
// sempre o sentido latino, e erraria o segundo caso. FSI acerta os dois sem perguntar o idioma.
//
// O PAR É OBRIGATÓRIO. Um FSI sem o PDI (U+2069) que o fecha não termina no fim do texto: ele vaza para
// o resto da linha e desalinha o que vier depois, inclusive a pontuação final da frase.

/** Isolamento de primeiro forte: "deste ponto em diante é outro texto, com o sentido dele". */
const ABRE = '⁨';

/** Fecha o isolamento aberto acima. Sem ele, o isolamento vaza para o resto da linha. */
const FECHA = '⁩';

/**
 * Isola um pedaço de texto do sentido da frase em volta.
 *
 * Serve para tudo que vem de fora e vai parar no meio de uma frase traduzida: nome de pessoa, nome de
 * canal, nome de comunidade, nome de arquivo. Em idioma da esquerda para a direita não muda nada —
 * os dois caracteres são invisíveis e sem largura.
 */
export function isolar(texto: string): string {
  if (!texto) return texto;
  return ABRE + texto + FECHA;
}

/**
 * O nome de um canal como ele aparece na tela: com `#` se for de texto, e isolado.
 *
 * O `#` entra ANTES do isolamento fechar, e isso é o ponto todo. Isolar só o nome e deixar o `#` fora
 * não resolve nada: de fora, o pedaço isolado conta como um caractere neutro, então `#` e o nome viram
 * dois neutros em sequência e o parágrafo torna a ordená-los pelo lado dele. O `#` tem que estar DENTRO.
 *
 * É por isso que as frases do dicionário não podem mais trazer o `#` escrito nelas. A chave era
 * 'Conversar em #{nome}', com o `#` do lado de fora do que o `t()` substitui — e daí não havia como
 * pôr o `#` dentro do isolamento. Hoje a chave é 'Conversar em {nome}' e o `#` vem daqui.
 */
export function nomeDeCanal(nome: string, deTexto: boolean): string {
  return isolar(deTexto ? `#${nome}` : nome);
}

/** Sem os caracteres de isolamento. Para medir, comparar e testar — nunca para desenhar. */
export function semIsolamento(texto: string): string {
  return texto.split(ABRE).join('').split(FECHA).join('');
}
