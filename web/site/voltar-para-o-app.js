// Devolve ao aplicativo o que o provedor mandou de volta. O porquê inteiro está em voltar-para-o-app.html.
//
// São duas tentativas, de propósito:
//
//   1. sozinha, assim que a página abre — para quem já marcou "sempre permitir", isto é instantâneo e a
//      página nem chega a ser vista;
//   2. pelo link, que espera o clique — porque o navegador BARRA a primeira em várias situações (abrir
//      um programa sem clique é coisa que ele trata como suspeita) e, quando barra, não avisa nada.
//
// A segunda existir é o que impede a aba vazia: sem ela, um navegador mais rígido deixa a pessoa parada
// numa página que parece pronta e não faz nada.

/**
 * O DICIONÁRIO PRÓPRIO, como na tela de sem conexão (desktop/src/offline.js).
 *
 * Esta página é site estático servido antes do Syden; o i18n do app não existe aqui. São quatro frases,
 * e traduzi-las nos mesmos três idiomas da tela de sem conexão é mais honesto do que mostrar português
 * para quem escolheu outra língua no meio de uma pergunta sobre permissão.
 */
const TEXTOS = {
  pt: {
    titulo: 'Voltando para o Syden',
    explicacao: 'O navegador vai perguntar se pode abrir o Syden. Pode permitir: é assim que a sua entrada volta para o aplicativo.',
    botao: 'Abrir o Syden',
    miudo: 'Marcando “sempre permitir”, esta pergunta não aparece mais. Depois, pode fechar esta aba.',
  },
  en: {
    titulo: 'Taking you back to Syden',
    explicacao: 'Your browser will ask whether it may open Syden. You can allow it: this is how your sign-in gets back to the app.',
    botao: 'Open Syden',
    miudo: 'Tick “always allow” and this question stops showing up. You can close this tab afterwards.',
  },
  es: {
    titulo: 'Volviendo a Syden',
    explicacao: 'El navegador preguntará si puede abrir Syden. Puedes permitirlo: así vuelve tu inicio de sesión a la aplicación.',
    botao: 'Abrir Syden',
    miudo: 'Si marcas “permitir siempre”, esta pregunta no vuelve a aparecer. Después puedes cerrar esta pestaña.',
  },
};

/** Só a raiz do idioma ("pt" de "pt-BR"): aqui não há variantes, e o que não está na lista cai no português. */
function idioma() {
  for (const pedido of navigator.languages || [navigator.language || 'pt']) {
    const raiz = String(pedido).toLowerCase().split('-')[0];
    if (raiz in TEXTOS) return raiz;
  }
  return 'pt';
}

const codigo = idioma();
const texto = TEXTOS[codigo];
document.documentElement.lang = codigo;
document.getElementById('titulo').textContent = texto.titulo;
document.getElementById('explicacao').textContent = texto.explicacao;
document.getElementById('miudo').textContent = texto.miudo;

const abrir = document.getElementById('abrir');
abrir.textContent = texto.botao;

/**
 * O endereço vai INTEIRO, do jeito que chegou.
 *
 * O que está na busca é `entrada=ok&comprovante=...` quando deu certo, e `entrada=cancelado` (ou
 * expirado, ou provedor) quando não deu. Esta página não lê nada disso e não decide nada: quem sabe o
 * que cada caso significa é o Syden, que tem a mensagem certa e o idioma da pessoa. Repassar sem
 * interpretar é o que mantém os dois lados falando a mesma língua sem combinar nada.
 */
const destino = 'syden://entrada' + (window.location.search || '');
abrir.href = destino;

/**
 * A tentativa automática — DEPOIS de a página estar pronta na tela, e não durante o carregamento.
 *
 * Abrir um programa é uma navegação, e uma navegação começada no meio do carregamento INTERROMPE o que
 * estava sendo carregado. Medido: com a tentativa solta no fim do script, a página nunca terminava de
 * carregar. Quem tivesse que responder à pergunta do Windows a responderia olhando para uma tela em
 * branco — que é exatamente o problema que esta página existe para resolver.
 *
 * Os 250 ms são para o navegador chegar a DESENHAR o que já carregou. Sem eles, a página está pronta
 * mas ainda não apareceu, e a pergunta chega primeiro na mesma.
 *
 * Se o navegador barrar a tentativa — vários barram, por ela não vir de um clique —, o link continua
 * ali. É por isso que ele existe.
 */
window.addEventListener('load', () => {
  setTimeout(() => window.location.assign(destino), 250);
});
