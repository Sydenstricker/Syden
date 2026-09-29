// Ligar a codificação por alguns segundos, para quem transmite SOZINHO conseguir testar.
//
// O PROBLEMA QUE ISTO RESOLVE. O Syden não codifica a imagem enquanto ninguém está assistindo: as
// camadas de vídeo ficam pausadas, e camada pausada não gasta processador nem internet. É uma das
// economias que fazem uma sala com três transmissões caber num computador comum.
//
// Só que isso deixa de fora um caso legítimo e bem comum: a pessoa entra sozinha, compartilha a tela e
// quer saber se está funcionando — se a imagem sai no tamanho certo, se o computador dá conta, se o
// H.264 pegou a placa de vídeo. Não há como medir nada disso, porque nada está acontecendo. E o que
// ela vê é um cartão que nunca sai de "medindo".
//
// COMO FUNCIONA: as camadas são ligadas à mão, por um tempo curto, direto no transmissor do navegador.
// Isso faz o computador codificar de verdade — que é justamente o que se quer medir — e depois volta
// ao que era. É um gasto deliberado e com hora para acabar, não um desperdício silencioso.
//
// SE ALGUÉM COMEÇAR A ASSISTIR NO MEIO DO TESTE, o servidor manda a lista de camadas que ele quer, e
// ela vence o que foi feito aqui. Pode haver um instante com a camada errada ligada; o próprio
// servidor corrige no aviso seguinte. É o preço certo a pagar: o caso comum (alguém chega) conserta
// sozinho, e o caso raro (o teste sozinho) fica possível.
import type { LocalTrackPublication } from 'livekit-client';

/** Quanto tempo o teste dura. Dois ciclos de medição (3s cada) com folga para o primeiro quadro. */
export const DURACAO_DO_TESTE_MS = 15_000;

/**
 * Liga as camadas, devolve como desligar.
 *
 * Devolve uma função de desfazer mesmo quando não há nada a fazer (navegador sem o transmissor à
 * vista), para quem chama não precisar saber a diferença.
 */
export function ligarCodificacaoParaTestar(publicacao: LocalTrackPublication | undefined): () => void {
  const transmissor = publicacao?.videoTrack?.sender;
  if (!transmissor) return () => {};

  let jaDesfez = false;
  let comoEstava: boolean[] = [];

  try {
    const parametros = transmissor.getParameters();
    comoEstava = parametros.encodings.map((camada) => camada.active !== false);
    for (const camada of parametros.encodings) camada.active = true;
    void transmissor.setParameters(parametros);
  } catch (erro) {
    // Um navegador que recuse mexer nas camadas simplesmente não tem este teste. A transmissão em si
    // continua intacta — não se toca em mais nada aqui.
    console.error(erro);
    return () => {};
  }

  return () => {
    if (jaDesfez) return;
    jaDesfez = true;
    try {
      // Pede os parâmetros DE NOVO em vez de guardar o objeto: entre ligar e desligar o LiveKit pode
      // ter reescrito a lista (alguém entrou para assistir), e escrever por cima de um objeto velho
      // desfaria essa decisão junto.
      const parametros = transmissor.getParameters();
      parametros.encodings.forEach((camada, i) => {
        if (i < comoEstava.length) camada.active = comoEstava[i];
      });
      void transmissor.setParameters(parametros);
    } catch (erro) {
      console.error(erro);
    }
  };
}
