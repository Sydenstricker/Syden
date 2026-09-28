// Dois Sydens instalados no mesmo computador — e como o app conta isso em vez de esconder.
//
// O DEFEITO QUE ISTO CORRIGE custou uma hora de investigação no dia 28/09/2026, e o pior dele é que
// falsifica teste. A sequência foi esta: o Syden 0.1.3 foi instalado e aberto pelo atalho; a versão
// 0.1.2, vinda da Microsoft Store, estava aberta na bandeja. O Windows só deixa um Syden por vez (ver
// requestSingleInstanceLock em main.js), então o 0.1.3 SAIU CALADO e o Windows trouxe para frente a
// janela do 0.1.2. O que apareceu na tela foi a versão antiga com o ícone antigo, e quem clicou tinha
// todo motivo para acreditar que era a nova.
//
// A consequência não é só confusão: os dois defeitos relatados naquele dia — o logo do Electron no
// ícone e a entrada pelo Google que nunca concluía — eram os defeitos da 0.1.2, já corrigidos na
// 0.1.3 que estava ali do lado sem abrir. Um app que mostra outra versão sem avisar transforma
// qualquer teste numa medição do programa errado.
//
// QUEM AVISA É QUEM SABE, e são os dois lados em situações diferentes:
//
//   - o que NÃO ABRIU sabe a própria identidade e lê no disco quem ficou com a janela (anotarQuemAbriu);
//   - o que JÁ ESTAVA ABERTO só descobre o outro quando ele é antigo demais para avisar sozinho — e aí
//     descobre pelos argumentos, que trazem o caminho de quem tentou abrir.
//
// A regra de quem fala evita dois avisos para o mesmo fato: quando o segundo manda a identidade dele
// (additionalData), ele avisa e o primeiro fica quieto.
//
// O TEXTO NÃO PASSA PELO i18n do Syden, pelo mesmo motivo da tela de sem conexão (ver offline.js): isto
// acontece no processo principal, antes e fora do site, onde a tradução do Syden não existe. São três
// idiomas e cinco frases, como lá.
const { readFileSync, writeFileSync } = require('node:fs');

/** Caminho comparável: o Windows não diferencia maiúsculas nem a direção da barra, e nós também não. */
const normalizar = (caminho) => String(caminho ?? '').replace(/\\/g, '/').toLowerCase();

/**
 * Anota quem está com a janela, para quem chegar depois poder se comparar.
 *
 * Síncrono e chamado NO INSTANTE em que a trava é obtida, e não no whenReady: entre uma coisa e outra
 * passam centenas de milissegundos, e um segundo Syden aberto nesse meio leria a anotação de um dono
 * anterior e acusaria uma diferença que não existe. Falhar em escrever não é motivo para não abrir: o
 * app segue igual, só sem o aviso.
 */
function anotarQuemAbriu(arquivo, instalacao) {
  try {
    writeFileSync(arquivo, JSON.stringify(instalacao));
    return true;
  } catch {
    return false;
  }
}

/** Lê a anotação. Devolve null quando não existe, está ilegível ou veio sem os dois campos. */
function lerQuemAbriu(arquivo) {
  try {
    const lido = JSON.parse(readFileSync(arquivo, 'utf8'));
    if (typeof lido?.versao !== 'string' || typeof lido?.caminho !== 'string') return null;
    return { versao: lido.versao, caminho: lido.caminho };
  } catch {
    return null;
  }
}

/**
 * É o mesmo Syden?
 *
 * Compara versão E caminho, porque as duas diferenças importam e por motivos diferentes: caminhos
 * diferentes com a mesma versão são duas instalações que se comportam igual (a pessoa só precisa saber
 * que existem duas); versões diferentes se comportam DIFERENTE, e é isso que falsifica teste.
 *
 * Não saber quem é o outro (null) conta como diferente. É o caso do Syden anterior a esta conferência,
 * que não deixa anotação nenhuma — e um Syden que não anota é, por definição, de outra versão.
 */
function mesmaInstalacao(daqui, outro) {
  if (!daqui || !outro) return false;
  return daqui.versao === outro.versao && normalizar(daqui.caminho) === normalizar(outro.caminho);
}

const TEXTOS = {
  pt: {
    titulo: 'Dois Sydens instalados',
    naoAbriu: 'Este Syden não abriu, porque outro já estava aberto.',
    jaEstavaAberto: 'Você abriu outro Syden, e ele não apareceu.',
    rodando: 'Aberto agora',
    tentou: 'O que você abriu',
    desconhecido: 'uma versão anterior a esta',
    umPorVez:
      'O Windows deixa um Syden aberto por vez, e a janela na tela é a do outro. Para ver este, saia do que está aberto pelo ícone na bandeja e abra de novo.',
    entrada: 'A resposta da entrada pelo Google foi entregue ao Syden que já estava aberto. Se ela não concluir, saia dele e comece de novo.',
    entendi: 'Entendi',
    sair: 'Sair deste Syden',
    continuar: 'Continuar neste',
  },
  en: {
    titulo: 'Two Sydens installed',
    naoAbriu: "This Syden didn't open, because another one was already running.",
    jaEstavaAberto: "You opened another Syden, and it didn't show up.",
    rodando: 'Running now',
    tentou: 'What you opened',
    desconhecido: 'a version older than this one',
    umPorVez:
      'Windows allows one Syden at a time, and the window on screen belongs to the other one. To see this one, quit the open one from the tray icon and open it again.',
    entrada: 'The Google sign-in response went to the Syden that was already running. If it never finishes, quit that one and start again.',
    entendi: 'Got it',
    sair: 'Quit this Syden',
    continuar: 'Stay in this one',
  },
  es: {
    titulo: 'Dos Sydens instalados',
    naoAbriu: 'Este Syden no abrió, porque otro ya estaba abierto.',
    jaEstavaAberto: 'Abriste otro Syden, y no apareció.',
    rodando: 'Abierto ahora',
    tentou: 'Lo que abriste',
    desconhecido: 'una versión anterior a esta',
    umPorVez:
      'Windows deja un Syden abierto a la vez, y la ventana en pantalla es la del otro. Para ver este, sal del que está abierto desde el icono de la bandeja y ábrelo de nuevo.',
    entrada: 'La respuesta del inicio de sesión con Google llegó al Syden que ya estaba abierto. Si no concluye, sal de él y empieza de nuevo.',
    entendi: 'Entendido',
    sair: 'Salir de este Syden',
    continuar: 'Seguir en este',
  },
};

/** Só a raiz do idioma ("pt" de "pt-BR"), como na tela de sem conexão. O que não está na lista cai no português. */
function textos(idiomas) {
  for (const pedido of idiomas ?? []) {
    const raiz = String(pedido).toLowerCase().split('-')[0];
    if (raiz in TEXTOS) return TEXTOS[raiz];
  }
  return TEXTOS.pt;
}

/** Como descrever uma instalação em uma linha. Sem versão conhecida, diz o que se sabe e não inventa. */
function descrever(instalacao, texto) {
  if (!instalacao) return texto.desconhecido;
  if (!instalacao.versao) return instalacao.caminho || texto.desconhecido;
  return `${instalacao.versao} — ${instalacao.caminho}`;
}

/**
 * Monta o recado, pronto para o dialog do Electron.
 *
 * `papel` diz de que lado está quem fala: 'naoAbriu' é o Syden que está saindo de cena, 'jaEstavaAberto'
 * é o que está com a janela. O primeiro tem um botão só — ele vai fechar de qualquer forma. O segundo
 * ganha o atalho de sair, porque é justamente o que a pessoa precisa fazer para ver o outro, e caçar o
 * ícone na bandeja é o passo em que se desiste.
 */
function recadoDeDoisSydens({ papel, daqui, outro, comEntrada = false, idiomas = [] }) {
  const texto = textos(idiomas);
  const euNaoAbri = papel === 'naoAbriu';
  const aberto = euNaoAbri ? outro : daqui;
  const oOutro = euNaoAbri ? daqui : outro;

  const linhas = [
    `${texto.rodando}: ${descrever(aberto, texto)}`,
    `${texto.tentou}: ${descrever(oOutro, texto)}`,
    '',
    texto.umPorVez,
  ];
  if (comEntrada) linhas.push('', texto.entrada);

  return {
    // As opções vão separadas porque é o objeto que o dialog do Electron recebe, e ele não é lugar de
    // pôr campo nosso: opção que ele não conhece é opção que ele pode recusar numa versão futura.
    opcoes: {
      type: 'info',
      title: texto.titulo,
      message: euNaoAbri ? texto.naoAbriu : texto.jaEstavaAberto,
      detail: linhas.join('\n'),
      buttons: euNaoAbri ? [texto.entendi] : [texto.continuar, texto.sair],
      defaultId: 0,
      cancelId: 0,
    },
    /** Qual botão significa "sair", para quem chamou não precisar comparar texto traduzido. */
    botaoDeSair: euNaoAbri ? -1 : 1,
  };
}

module.exports = { anotarQuemAbriu, lerQuemAbriu, mesmaInstalacao, recadoDeDoisSydens };
