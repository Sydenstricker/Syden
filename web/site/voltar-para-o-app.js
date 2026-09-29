// A página que a pessoa vê depois de autorizar no provedor, quando a entrada começou no app de desktop.
// O porquê inteiro está em voltar-para-o-app.html.
//
// ESTA PÁGINA NÃO ABRE MAIS O APLICATIVO SOZINHA, e isso é o conserto de 28/09/2026.
//
// Ela tentava, e o Windows então perguntava "permitir que este site abra o link syden com Syden?".
// Essa pergunta é do sistema, não nossa, e não tem como ser removida — mas ela só existia porque
// alguém de FORA precisava abrir o app. Agora não precisa: o Syden, que já está aberto do outro lado,
// pergunta ao servidor de tempos em tempos se a entrada terminou, e entra sozinho (ver
// web/src/entradaSocial.ts e a rota /api/auth/social/esperar). Depois do "ok" no provedor não sobra
// pergunta nenhuma, que é o que se espera de um login.
//
// O BOTÃO CONTINUA AQUI, escondido, como rede. Ele aparece depois de alguns segundos, para o caso de a
// conversa do app com o servidor não estar acontecendo — internet caída no meio do caminho, app
// fechado sem querer. Aí ele volta a ser o que era: um jeito de abrir o Syden, com a pergunta do
// Windows junto. Escondido no começo porque, visível, ele disputava a atenção com uma coisa que já
// estava acontecendo sozinha — e pedia à pessoa que resolvesse algo que não era problema dela.

/**
 * O DICIONÁRIO PRÓPRIO, como na tela de sem conexão (desktop/src/offline.js).
 *
 * Esta página é site estático servido fora do Syden; o i18n do app não existe aqui. São poucas frases,
 * e traduzi-las nos mesmos três idiomas da tela de sem conexão é mais honesto do que mostrar português
 * para quem escolheu outra língua bem no fim de uma entrada.
 */
const TEXTOS = {
  pt: {
    titulo: 'Pronto, autorizado',
    explicacao: 'O Syden já está entrando com a sua conta. Pode voltar para ele — e fechar esta aba.',
    botao: 'Abrir o Syden',
    miudo: 'O Syden não entrou sozinho? Abra por aqui.',
  },
  en: {
    titulo: 'All set',
    explicacao: 'Syden is signing you in right now. You can go back to it — and close this tab.',
    botao: 'Open Syden',
    miudo: "Syden didn't sign in by itself? Open it here.",
  },
  es: {
    titulo: 'Listo, autorizado',
    explicacao: 'Syden ya está entrando con tu cuenta. Puedes volver a él — y cerrar esta pestaña.',
    botao: 'Abrir Syden',
    miudo: '¿Syden no entró solo? Ábrelo por aquí.',
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
abrir.href = 'syden://entrada' + (window.location.search || '');

/** A rede aparece depois — tempo de o app perceber sozinho, que é o que acontece quase sempre. */
const rede = document.getElementById('rede');
setTimeout(() => rede.removeAttribute('hidden'), 6000);
