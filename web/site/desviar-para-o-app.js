// Manda o app de desktop direto para o Syden, em vez de deixá-lo na página de apresentação.
//
// POR QUE ISTO EXISTE, E POR QUE É A PEÇA MAIS IMPORTANTE DA MUDANÇA DE ENDEREÇO.
//
// O Syden saiu da raiz de syden.chat e foi para /app/. Só que TODO APP JÁ INSTALADO carrega a raiz —
// inclusive o pacote que está em certificação na Microsoft Store, que não pode ser trocado agora. Sem
// este desvio, cada pessoa que abrisse o app instalado veria a página de apresentação e não teria como
// entrar; e o revisor da Microsoft reprovaria o envio por não conseguir avaliar o aplicativo.
//
// Com ele, a mudança de endereço deixa de depender de build nova: o app antigo abre a raiz, esta página
// percebe que é o app, e o leva para /app/ antes de desenhar qualquer coisa.
//
// POR QUE É UM ARQUIVO SEPARADO, E NÃO UM <script> DENTRO DA PÁGINA. A política de segurança do site
// (ver e2e/csp.mjs) usa `script-src 'self'`, sem 'unsafe-inline'. Um script escrito dentro do HTML
// seria bloqueado pelo navegador EM SILÊNCIO — sem erro na tela, sem nada no servidor. O app abriria a
// apresentação e ficaria lá, e o sintoma não apontaria para a causa.
//
// POR QUE replace, E NÃO href. `location.href` empilha a apresentação no histórico, e o botão de voltar
// do app cairia nela de novo. `replace` troca a página sem deixar rastro.

/**
 * A ponte só existe dentro do app de desktop (ver desktop/src/preload.js). No navegador ela não existe,
 * e a pessoa fica na apresentação — que é o certo: é para ela que a página foi escrita.
 */
if (window.sydenDesktop) {
  window.location.replace('/app/');
}
