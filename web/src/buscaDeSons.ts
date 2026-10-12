// A busca do soundboard, em ordem do mais provável para o menos provável.
//
// POR QUE ELA DEIXOU DE SER UM `includes` (11/10/2026, relato: "a recomendação me parece limitada, só aparece
// um som; o correto é aparecer a lista sequencial de sons prováveis"). O filtro antigo exigia o texto exato,
// na ordem exata, com o acento exato: "musica" não achava "Música", "ajuda me" não achava "Me ajuda", e um
// "ajdua" não achava nada. Numa chamada, a pessoa digita rápido e quer o som AGORA — a busca tem de perdoar.
//
// A REGRA: cada palavra digitada procura a melhor palavra do nome do som. Palavra inteira vale mais que
// começo de palavra, que vale mais que pedaço no meio, que vale mais que um erro de digitação. O nome do
// pacote conta pouco, mas conta ("meme" traz os sons do pacote de memes). Som que não casa com nada some;
// o resto vem ordenado pela nota, e no empate pelo nome.

/** Sem acento, sem maiúscula, sem pontuação: "Me ajuda (de novo)!" → "me ajuda de novo". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Distância de edição até 1, sem calcular a matriz inteira: só se responde "difere em no máximo uma letra?". */
function quaseIgual(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let erros = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    erros += 1;
    if (erros > 1) return false;
    // Duas letras trocadas de lugar ("ajdua") contam como um erro só.
    if (a[i] === b[j + 1] && a[i + 1] === b[j]) {
      i += 2;
      j += 2;
    } else if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return erros + (a.length - i) + (b.length - j) <= 1;
}

/** Quanto uma palavra digitada casa com uma palavra do nome. 0 = não casa. */
function notaDaPalavra(digitada: string, doNome: string): number {
  if (doNome === digitada) return 100;
  if (doNome.startsWith(digitada)) return 70;
  // Pedaço no MEIO da palavra só a partir de 3 letras: "ai" acharia "papai", "bonsai", "vai"…
  if (digitada.length >= 3 && doNome.includes(digitada)) return 45;
  // Erro de digitação só a partir de 4 letras: "oi" com uma letra trocada casaria com metade do soundboard.
  if (digitada.length >= 4) {
    if (quaseIgual(digitada, doNome)) return 40;
    if (doNome.length > digitada.length && quaseIgual(digitada, doNome.slice(0, digitada.length))) return 30;
  }
  return 0;
}

/** A nota de um som para o que foi digitado. 0 = não aparece. */
export function notaDoSom(busca: string, nome: string, pacote: string | null = null): number {
  const digitado = normalizar(busca);
  if (!digitado) return 0;
  const doNome = normalizar(nome);
  const palavrasDoNome = doNome.split(' ');
  const palavrasDoPacote = pacote ? normalizar(pacote).split(' ') : [];

  let nota = 0;
  let casadas = 0;
  for (const palavra of digitado.split(' ')) {
    const noNome = Math.max(0, ...palavrasDoNome.map((p) => notaDaPalavra(palavra, p)));
    const noPacote = Math.max(0, ...palavrasDoPacote.map((p) => notaDaPalavra(palavra, p))) * 0.3;
    const melhor = Math.max(noNome, noPacote);
    if (melhor > 0) casadas += 1;
    nota += melhor;
  }
  if (casadas === 0) return 0;
  // Casar TODAS as palavras digitadas pesa mais que casar uma muito bem: "me ajuda" quer os dois.
  nota += casadas * 50;
  // O texto inteiro, como foi digitado, dentro do nome: é o sinal mais forte de todos.
  if (doNome.includes(digitado)) nota += 60;
  if (doNome === digitado) nota += 100;
  return nota;
}

/** Os sons que casam com a busca, do mais provável para o menos provável. */
export function buscarSons<T extends { name: string; packName?: string | null }>(sons: T[], busca: string): T[] {
  return sons
    .map((som) => ({ som, nota: notaDoSom(busca, som.name, som.packName ?? null) }))
    .filter((r) => r.nota > 0)
    .sort((a, b) => b.nota - a.nota || a.som.name.localeCompare(b.som.name))
    .map((r) => r.som);
}
