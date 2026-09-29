// A página que a pessoa vê depois de autorizar no provedor, quando a entrada começou no app de desktop.
// O porquê inteiro está em voltar-para-o-app.html.
//
// ELA NÃO FAZ NADA ALÉM DE FALAR A LÍNGUA DE QUEM ESTÁ LENDO, e isso é o ponto.
//
// Ela já tentou abrir o aplicativo sozinha (o Windows perguntava se podia, logo depois de a pessoa já
// ter autorizado no Google) e já teve um botão de reserva (que contradizia o próprio texto: "pode
// fechar esta aba" com um botão vermelho embaixo pedindo mais uma ação). As duas coisas saíram.
//
// Quem conclui a entrada é o Syden, do outro lado, perguntando ao servidor se terminou — ver a rota
// /api/auth/social/esperar e web/src/entradaSocial.ts. Aqui só resta dizer que deu certo.

/**
 * O DICIONÁRIO PRÓPRIO, como na tela de sem conexão (desktop/src/offline.js).
 *
 * Esta página é site estático servido fora do Syden; o i18n do app não existe aqui. São duas frases,
 * e traduzi-las nos mesmos três idiomas da tela de sem conexão é mais honesto do que mostrar português
 * para quem escolheu outra língua bem no fim de uma entrada.
 */
const TEXTOS = {
  pt: {
    titulo: 'Pronto, autorizado',
    explicacao: 'O Syden já está entrando com a sua conta. Pode voltar para ele — e fechar esta aba.',
  },
  en: {
    titulo: 'All set',
    explicacao: 'Syden is signing you in right now. You can go back to it — and close this tab.',
  },
  es: {
    titulo: 'Listo, autorizado',
    explicacao: 'Syden ya está entrando con tu cuenta. Puedes volver a él — y cerrar esta pestaña.',
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
