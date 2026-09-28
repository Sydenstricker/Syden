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
  window.location.replace('/app/' + window.location.search + window.location.hash);
}

/**
 * O QUE CHEGA AQUI COM UM CÓDIGO NA MÃO NÃO É VISITA: é alguém no meio de uma tarefa.
 *
 * Quatro coisas do Syden mandam a pessoa de volta por um endereço, e todas as quatro apontavam para a
 * RAIZ, porque a raiz era o Syden até a mudança de endereço:
 *
 *   ?entrada=    a volta do Google, Discord, GitHub ou Steam
 *   ?confirmar=  o link do e-mail de confirmação de cadastro
 *   ?recuperar=  o link do e-mail de recuperação de senha
 *   ?convite=    o convite que alguém mandou para um amigo
 *
 * Depois da mudança, esses endereços passaram a cair na página de apresentação — que é bonita e não faz
 * nada com eles. O sintoma é cruel: a pessoa clica no link do e-mail, vê o site do Syden abrir
 * normalmente, e nada acontece. Ela não tem como saber que faltou alguma coisa. Foi o que aconteceu com
 * a entrada pelo Google em 28/09/2026, e valia igual para todo e-mail já enviado antes daquele dia.
 *
 * O servidor também foi corrigido para apontar direto para /app/ (ver SITE_URL), mas isto FICA: links
 * antigos continuam existindo em caixas de entrada, e uma correção que só vale para o que vem depois
 * não é uma correção para quem clicou ontem.
 *
 * A busca vai inteira, e o sessionStorage sobrevive: é o mesmo endereço (syden.chat) na mesma aba, então
 * o segredo guardado no começo da entrada continua lá do outro lado — sem isso, o comprovante do Google
 * chegaria ao Syden sem a metade que o valida.
 */
const PARAMETROS_DE_QUEM_ESTA_NO_MEIO_DE_ALGO = ['entrada', 'confirmar', 'recuperar', 'convite'];
const busca = new URLSearchParams(window.location.search);

if (PARAMETROS_DE_QUEM_ESTA_NO_MEIO_DE_ALGO.some((nome) => busca.has(nome))) {
  window.location.replace('/app/' + window.location.search + window.location.hash);
}
