/**
 * Quem ganha o quê, e quando.
 *
 * O desenho de cada insígnia mora no app (web/src/insignias.ts). Aqui fica só a REGRA — o servidor é
 * quem decide quem tem direito, porque isso não pode depender do que o navegador diz.
 *
 * A conferência roda toda vez que a pessoa entra. `darItem` recusa repetido, então rodar de novo não
 * custa nada nem dá presente duas vezes; e quem ganhou enquanto estava fora recebe na próxima vez que
 * abrir o Syden.
 */
import * as db from './db.js';

/** Quantas insígnias cabem no perfil ao mesmo tempo. A pessoa escolhe quais, até este total. */
export const LIMITE_DA_VITRINE = 5;

/** As insígnias que o Syden sabe dar. Código igual ao do catálogo do app. */
export const INSIGNIAS = {
  /** Os 25 primeiros cadastros do Syden. Quem chegou no começo, quando ainda era só entre amigos. */
  PRIMEIROS: 'primeiros-25',
  /** Teve uma ideia acolhida no Syden. Esta é dada pelo fluxo das sugestões, não pela conferência. */
  IDEIA: 'ideia-acolhida',
  /**
   * Achou o código secreto: ↑↑↓↓←→←→BA no teclado do app (no celular não há setas, e ficou de fora).
   *
   * É a única insígnia que se ganha por um pedido do app, e isso foi pesado: qualquer um que leia o código
   * do site pode chamar a rota à mão. Não tem problema, e é por isso que ela pode ser assim — o "segredo" é
   * a sequência mais famosa dos videogames, e a graça é a pessoa tentar. Ela não dá vantagem nenhuma, não
   * é contada para nada e sai uma vez por conta. Uma insígnia que significasse esforço ou tempo nunca
   * poderia nascer de um pedido do navegador.
   */
  SEGREDO: 'codigo-secreto',
  /**
   * O fliperama com a turma (19/11/2026, decisão dele: "traga as duas coisas"): 5, 15 e 30 mini-games DIFERENTES jogados
   * na sala com 2 ou mais pessoas (db.jogosDiferentesComGente). Três insígnias separadas, e não níveis com barra: quem
   * não tem vê só a frase de como se ganha, sem "faltam". É a primeira conquista INDIVIDUAL fora do troféu do kart, e
   * mede variedade, não horas nem vitórias: jogar com gente coisas diferentes.
   */
  FLIPERAMA_5: 'fliperama-5',
  FLIPERAMA_15: 'fliperama-15',
  FLIPERAMA_30: 'fliperama-30',
} as const;

/** Quantos jogos diferentes com a turma cada insígnia do fliperama pede (de 49 na estante do Coletivo). */
export const DEGRAUS_DO_FLIPERAMA = [
  { code: INSIGNIAS.FLIPERAMA_5, jogos: 5 },
  { code: INSIGNIAS.FLIPERAMA_15, jogos: 15 },
  { code: INSIGNIAS.FLIPERAMA_30, jogos: 30 },
] as const;

/** Até qual número de cadastro a insígnia dos primeiros vale. */
export const QUANTOS_PRIMEIROS = 25;

type Regra = {
  code: string;
  motivo: string;
  vale: (user: db.User) => boolean;
};

const REGRAS: Regra[] = [
  {
    code: INSIGNIAS.PRIMEIROS,
    motivo: 'Entre os 25 primeiros do Syden',
    // Por ordem de cadastro: o número da conta é sequencial, então os 25 primeiros são os de número <= 25.
    vale: (user) => user.id <= QUANTOS_PRIMEIROS,
  },
];

/**
 * Confere se esta pessoa passou a ter direito a alguma insígnia nova e a entrega.
 * Devolve os códigos entregues agora — que é o que vai virar tela de destaque na próxima vez que ela abrir.
 */
export function conferirPresentes(user: db.User): string[] {
  const novos: string[] = [];
  for (const regra of REGRAS) {
    if (!regra.vale(user)) continue;
    if (db.darItem(user.id, regra.code, regra.motivo)) novos.push(regra.code);
  }
  novos.push(...conferirFliperama(user.id));
  return novos;
}

/**
 * As insígnias do fliperama desta pessoa. Roda ao entrar (quem jogou antes de elas existirem recebe na próxima vez que
 * abrir o Syden: as partidas e quem estava nelas já eram guardadas) e no fim de cada partida da sala, para chegar na hora.
 * A consulta só roda se ainda falta alguma: quem tem as três não paga nada.
 */
export function conferirFliperama(userId: number): string[] {
  const faltam = DEGRAUS_DO_FLIPERAMA.filter((d) => !db.temItem(userId, d.code));
  if (faltam.length === 0) return [];
  const jogos = db.jogosDiferentesComGente(userId);
  const novos: string[] = [];
  for (const degrau of faltam) {
    if (jogos >= degrau.jogos && db.darItem(userId, degrau.code, `${degrau.jogos} mini-games diferentes com a turma`)) {
      novos.push(degrau.code);
    }
  }
  return novos;
}

/**
 * O catálogo das insígnias para a pessoa: TODAS as que existem, com o "tem/não tem" e desde quando. Sem progresso, sem
 * "faltam", sem raridade: a frase de como se ganha mora no app (web/src/insignias.ts), e isto só diz o que ela já tem.
 */
export function catalogoDeInsignias(userId: number, codigos: readonly string[]) {
  const tem = new Map(db.itensDaPessoa(userId).map((item) => [item.code, item.grantedAt]));
  return codigos.map((codigo) => ({ codigo, tenho: tem.has(codigo), desde: tem.get(codigo) ?? null }));
}

/**
 * Entrega uma insígnia fora das regras automáticas (hoje, a de ideia acolhida) e já a põe na vitrine se
 * houver espaço — para ela aparecer no perfil sem a pessoa precisar configurar nada.
 */
export function entregar(userId: number, code: string, motivo: string): boolean {
  const deu = db.darItem(userId, code, motivo);
  if (deu) db.exibirSeCouber(userId, code, LIMITE_DA_VITRINE);
  return deu;
}
