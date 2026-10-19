/**
 * "ESTOU JOGANDO NESTE AGORA", na agenda de servidores de jogo (19/10/2026).
 *
 * É o caminho barato que ficou anotado no CLAUDE.md quando a sobreposição saiu ("Saber que alguém está
 * jogando"): em vez de o Syden ADIVINHAR o jogo olhando a máquina (só no app de Windows) ou perguntar à
 * Steam (só quem entra por ela), a pessoa DIZ, com um clique no cartão do servidor, e a turma vê. Funciona
 * no navegador, no celular e no app, não fala com terceiro e não conta nada que ela não escolheu contar.
 *
 * O RISCO ANOTADO LÁ é o oposto do da sobreposição: "status que ninguém atualiza vira enfeite morto". Por
 * isso ele SOME SOZINHO, e é isso que este arquivo decide:
 * - PRAZO_MS depois de marcado (quem continua jogando marca de novo, e o prazo recomeça);
 * - quando a pessoa fica sem o Syden aberto por mais de uma varredura (uns 2 minutos: recarregar a página
 *   não apaga o que ela disse, fechar o Syden apaga).
 *
 * Mora só na memória, de propósito: é o que está acontecendo agora, não histórico. O servidor reiniciar
 * esquece, como esquece quem está em chamada.
 */

export const PRAZO_MS = 4 * 60 * 60 * 1000;

interface Marca {
  servidorId: number;
  desde: number;
  /** Quando a varredura a viu sem o Syden aberto pela primeira vez (null: estava aberto). */
  semSydenDesde: number | null;
}

/** communityId → userId → o servidor onde ela disse que está. Uma pessoa, um servidor por comunidade. */
const marcas = new Map<number, Map<number, Marca>>();

export function marcarJogando(communityId: number, userId: number, servidorId: number, agora = Date.now()) {
  const daComunidade = marcas.get(communityId) ?? new Map<number, Marca>();
  daComunidade.set(userId, { servidorId, desde: agora, semSydenDesde: null });
  marcas.set(communityId, daComunidade);
}

/** Tira a marca da pessoa. Devolve se havia alguma (para só avisar a turma quando algo mudou). */
export function tirarJogando(communityId: number, userId: number): boolean {
  const daComunidade = marcas.get(communityId);
  const tinha = daComunidade?.delete(userId) ?? false;
  if (daComunidade?.size === 0) marcas.delete(communityId);
  return tinha;
}

/** O servidor saiu da agenda: quem estava nele deixa de estar. Devolve se tirou alguém. */
export function esquecerServidor(communityId: number, servidorId: number): boolean {
  let tirou = false;
  for (const [userId, marca] of marcas.get(communityId) ?? []) {
    if (marca.servidorId === servidorId) tirou = tirarJogando(communityId, userId) || tirou;
  }
  return tirou;
}

/** Quem está em cada servidor da comunidade: servidorId → [{ userId, desde }], o mais antigo primeiro. */
export function jogandoNaComunidade(communityId: number): Map<number, { userId: number; desde: string }[]> {
  const porServidor = new Map<number, { userId: number; desde: string }[]>();
  const ordenadas = [...(marcas.get(communityId) ?? [])].sort((a, b) => a[1].desde - b[1].desde);
  for (const [userId, marca] of ordenadas) {
    const lista = porServidor.get(marca.servidorId) ?? [];
    lista.push({ userId, desde: new Date(marca.desde).toISOString() });
    porServidor.set(marca.servidorId, lista);
  }
  return porServidor;
}

/**
 * A varredura de cada minuto: tira o que venceu, quem não é mais da comunidade e quem está sem o Syden
 * aberto pela SEGUNDA varredura seguida. Devolve as comunidades que mudaram, para avisar só elas.
 */
export function varrerJogando(
  aberto: (userId: number) => boolean,
  aindaMembro: (communityId: number, userId: number) => boolean,
  agora = Date.now(),
): number[] {
  const mudaram: number[] = [];
  for (const [communityId, daComunidade] of [...marcas]) {
    let mudou = false;
    for (const [userId, marca] of [...daComunidade]) {
      const venceu = agora - marca.desde >= PRAZO_MS;
      const saiu = !aindaMembro(communityId, userId);
      if (aberto(userId)) marca.semSydenDesde = null;
      else if (marca.semSydenDesde === null) marca.semSydenDesde = agora;
      const fechou = marca.semSydenDesde !== null && marca.semSydenDesde < agora;
      if (venceu || saiu || fechou) {
        tirarJogando(communityId, userId);
        mudou = true;
      }
    }
    if (mudou) mudaram.push(communityId);
  }
  return mudaram;
}

/** Só para os testes: começar do zero. */
export function esquecerTudoDoJogando() {
  marcas.clear();
}
