// A tela de abertura do Syden: o coelho que aparece antes de tudo (ver web/index.html).
//
// ELA É ÚNICA, e passou a ser. Antes havia duas esperas em fila: este coelho enquanto o pacote
// baixava, e depois a dissolução do brasão enquanto a sessão era conferida. Duas animações seguidas
// para o mesmo ato de abrir o app — a segunda parecia que algo tinha recomeçado.
//
// POR QUE O TEMPO MÍNIMO EXISTE. Em internet boa o pacote chega em menos de meio segundo, e sem um
// piso a abertura viraria um piscar: um borrão que ninguém identifica, e que dá a impressão de falha
// em vez de identidade. Dois segundos é o suficiente para o desenho ser lido como um desenho.
//
// POR QUE ELE É CONTADO DESDE O COMEÇO DA PÁGINA, e não de quando o app montou: quem esperou quatro
// segundos pelo pacote já viu o coelho por quatro segundos, e segurá-lo mais dois seria castigar
// justamente quem tem a internet pior.

/** O piso, contado desde que a página começou a carregar. */
const MINIMO_MS = 2000;

/** Quanto dura o desaparecimento. Some de uma vez é um corte; com o esmaecimento, é uma passagem. */
const SUMICO_MS = 320;

let jaSaiu = false;

/**
 * Tira a abertura da tela, respeitando o tempo mínimo.
 *
 * Chamada quando o Syden tem o que mostrar — não quando o React monta. A diferença importa: o React
 * monta antes de a sessão ser conferida, e sair nesse instante deixaria a pessoa olhando uma tela
 * vazia enquanto o servidor responde.
 *
 * Pode ser chamada mais de uma vez sem problema: só a primeira faz alguma coisa.
 */
export function esconderAbertura() {
  if (jaSaiu) return;
  jaSaiu = true;

  const abertura = document.getElementById('abertura');
  if (!abertura) return;

  // performance.now() conta desde o começo da navegação, que é exatamente quando o coelho apareceu.
  const jaEsperou = performance.now();
  const falta = Math.max(0, MINIMO_MS - jaEsperou);

  setTimeout(() => {
    abertura.classList.add('saindo');
    // Removido do documento depois do esmaecimento. Deixá-lo com opacidade zero manteria um elemento
    // de tela inteira por cima do Syden — invisível, mas presente, e um dia alguém tiraria o
    // pointer-events dele sem saber por que ele estava lá.
    setTimeout(() => abertura.remove(), SUMICO_MS);
  }, falta);
}
