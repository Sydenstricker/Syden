/**
 * Uma tarefa de cada vez, e vale a última pedida.
 *
 * Existe por causa dos modificadores de voz, mas o problema é geral: trocar o efeito desmonta o caminho
 * do microfone e monta outro. Se duas trocas correm ao mesmo tempo, elas se atropelam — a segunda monta
 * o caminho novo e a primeira, que ainda estava terminando, o desmonta logo depois. O microfone fica
 * mudo para os outros, e sem erro nenhum na tela.
 *
 * Além de enfileirar, as tarefas do meio são PULADAS: se a pessoa passa por cinco efeitos em dois
 * segundos, não faz sentido montar e desmontar os cinco — só o último interessa.
 */
export function filaUltimaVale() {
  let corrente: Promise<void> = Promise.resolve();
  let ultima = 0;

  return function enfileirar(tarefa: () => Promise<void>): Promise<void> {
    const minhaVez = ++ultima;
    const resultado = corrente.then(async () => {
      // Alguém pediu depois de mim enquanto eu esperava: quem manda é a escolha mais nova.
      if (minhaVez !== ultima) return;
      await tarefa();
    });

    // A fila NUNCA guarda uma falha. Se guardasse, bastaria um efeito dar errado uma vez para todas as
    // trocas seguintes serem puladas em silêncio — a pessoa clicaria nos efeitos e nada mais aconteceria.
    // Quem chamou continua recebendo o erro, pelo `resultado`.
    corrente = resultado.catch(() => {});
    return resultado;
  };
}
