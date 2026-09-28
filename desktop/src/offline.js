// A tela de sem conexão: texto, idioma e o botão de tentar de novo.
//
// POR QUE ELA TEM UM DICIONÁRIO PRÓPRIO, em vez de usar o do Syden. Porque o i18n mora no site, e esta
// é a única tela do app que aparece justamente quando o site não pode ser buscado. Se houvesse internet
// para carregar a tradução, não haveria tela de sem conexão.
//
// São quatro frases e dois idiomas além do português. Não é a tradução inteira do Syden e não precisa
// ser: quem está sem internet precisa entender o que houve e achar o botão, e nada mais.

const TEXTOS = {
  pt: {
    titulo: 'Não foi possível conectar',
    explicacao: 'Verifique sua internet. O servidor também pode estar fora do ar.',
    botao: 'Tentar de novo',
    tentando: 'Tentando…',
    codigo: 'OFFLINE — Sem conexão',
  },
  en: {
    titulo: "Couldn't connect",
    explicacao: 'Check your internet. The server may also be down.',
    botao: 'Try again',
    tentando: 'Trying…',
    codigo: 'OFFLINE — No connection',
  },
  es: {
    titulo: 'No fue posible conectar',
    explicacao: 'Revisa tu internet. El servidor también puede estar caído.',
    botao: 'Intentar de nuevo',
    tentando: 'Intentando…',
    codigo: 'OFFLINE — Sin conexión',
  },
};

/**
 * O idioma, pela raiz do que o sistema informa.
 *
 * Só a raiz ("pt" de "pt-BR") porque não há variantes aqui: um português é um português. E o que não
 * estiver na lista cai em português, como no resto do Syden.
 */
function idioma() {
  const bruto = (navigator.language || 'pt').toLowerCase().split('-')[0];
  return TEXTOS[bruto] ? bruto : 'pt';
}

const t = TEXTOS[idioma()];
document.documentElement.lang = idioma();
document.getElementById('titulo').textContent = t.titulo;
document.getElementById('explicacao').textContent = t.explicacao;
document.getElementById('codigo').textContent = t.codigo;

const botao = document.getElementById('retry');
botao.textContent = t.botao;

const destino = new URLSearchParams(location.search).get('url');

botao.addEventListener('click', () => {
  if (!destino) return;
  // O botão se desliga durante a tentativa. Sem isto, quem clica três vezes seguidas dispara três
  // navegações, e a terceira cancela a primeira — o que parece que o botão não funciona.
  botao.disabled = true;
  botao.textContent = t.tentando;
  location.href = destino;
});
