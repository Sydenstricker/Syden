/**
 * De quem este computador baixa o áudio numa sala grande.
 *
 * ---------------------------------------------------------------------------------------------------
 * O PROBLEMA, EM UMA CONTA.
 *
 * Um SFU não mistura o som: ele repassa. Se todo mundo baixa o áudio de todo mundo, o servidor manda
 * N×(N−1) fluxos. Em dez pessoas são 90, e ninguém sente. Em cinquenta são 2.450, e o servidor cai.
 *
 * O que os aplicativos grandes fazem não é uma arquitetura diferente: é **parar de mandar o silêncio**.
 * Numa sala de cinquenta, três ou quatro pessoas falam ao mesmo tempo — as outras quarenta e seis
 * estão caladas, e o som delas é banda gasta para entregar nada.
 *
 * ---------------------------------------------------------------------------------------------------
 * AS TRÊS REGRAS, e por que cada uma existe.
 *
 * 1. **Sala pequena não muda em nada.** Abaixo do limiar, baixa-se tudo, como sempre foi. Otimização
 *    que só serve para o caso extremo não pode piorar o caso comum — e o caso comum do Syden é uma
 *    roda de amigos, onde qualquer atraso no começo da fala seria pior que o problema resolvido.
 *
 * 2. **Quem falou há pouco continua ouvido.** Não basta seguir quem fala AGORA: a pessoa faz uma
 *    pausa para respirar, sairia da lista, e a próxima sílaba chegaria cortada. A memória dos
 *    últimos falantes é o que dá continuidade à conversa.
 *
 * 3. **Quem você escolheu ouvir vence tudo.** Se alguém subiu o volume de uma pessoa ou fixou a
 *    transmissão dela, essa escolha é mais forte do que qualquer regra automática.
 *
 * O custo, dito com todas as letras: quando alguém que estava calado há muito tempo volta a falar,
 * a primeira fração de segundo pode faltar, porque a inscrição precisa ser refeita. É o preço que
 * Zoom, Meet e Teams pagam em sala grande — e é invisível em sala pequena, onde a regra nem liga.
 */

/**
 * A partir de quantas pessoas a regra começa a valer.
 *
 * Doze é acima do que uma roda de amigos costuma ter e bem abaixo de onde a conta aperta. O
 * comportamento de hoje fica intocado no uso real do Syden, e a proteção aparece quando começa a
 * fazer falta.
 */
export const LIMIAR = 12;

/**
 * Quantas vozes no máximo, em sala grande.
 *
 * Oito é generoso de propósito: numa conversa humana raramente há mais de três ou quatro falando ao
 * mesmo tempo, e a folga cobre a sobreposição de quem entra e sai da fala sem cortar ninguém.
 */
export const TETO_DE_VOZES = 8;

export interface Quem {
  /** O identificador do participante, do jeito que o LiveKit o chama. */
  id: string;
}

/**
 * Quem deve ter o áudio baixado.
 *
 * @param todos        todo mundo na sala, menos você
 * @param falantes     quem falou, do mais recente para o mais antigo
 * @param preferidos   quem esta pessoa escolheu ouvir de qualquer jeito
 */
export function quemOuvir(
  todos: readonly Quem[],
  falantes: readonly string[],
  preferidos: ReadonlySet<string> = new Set(),
  limiar = LIMIAR,
  teto = TETO_DE_VOZES,
): Set<string> {
  // Regra 1: sala pequena não muda em nada.
  if (todos.length < limiar) return new Set(todos.map((p) => p.id));

  const escolhidos = new Set<string>();

  // Regra 3 primeiro: a escolha de quem usa não disputa vaga com a regra automática.
  for (const id of preferidos) {
    if (todos.some((p) => p.id === id)) escolhidos.add(id);
  }

  // Regra 2: os falantes mais recentes, até o teto.
  for (const id of falantes) {
    if (escolhidos.size >= teto) break;
    if (todos.some((p) => p.id === id)) escolhidos.add(id);
  }

  // Sobrando vaga — sala grande e calada —, completa com quem estiver lá. Sem isto, entrar numa sala
  // silenciosa significaria não ouvir a primeira pessoa que abrir a boca.
  for (const p of todos) {
    if (escolhidos.size >= teto) break;
    escolhidos.add(p.id);
  }

  return escolhidos;
}

/**
 * Atualiza a lista de quem falou, do mais recente para o mais antigo.
 *
 * Guarda mais nomes do que o teto de propósito: a memória é o que evita que alguém saia da lista
 * durante uma pausa e volte cortado. Lembrar é barato; recomeçar a inscrição, não.
 */
export function lembrarFalantes(anteriores: readonly string[], agora: readonly string[], memoria = 24): string[] {
  const novos = [...agora];
  for (const id of anteriores) {
    if (novos.length >= memoria) break;
    if (!novos.includes(id)) novos.push(id);
  }
  return novos;
}
