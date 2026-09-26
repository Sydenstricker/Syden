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
} as const;

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
  return novos;
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
