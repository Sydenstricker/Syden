// O ANIVERSÁRIO DO PRÓPRIO SYDEN (decisão dele, 19/10/2026): 19/09, o dia em que o projeto ganhou o nome Syden e virou
// app instalável (a v0.1.0 e o nome são de 19/09/2026; o primeiro commit, ainda como "Janja", é de 18/09). Marcado no
// calendário de toda comunidade e festejado com confete para quem abrir o Syden no dia, a partir do primeiro ano.
// À parte do componente para o teste não puxar imagens.
export const NASCIMENTO_DO_SYDEN = { ano: 2026, mes: 9, dia: 19 };

/** É 19/09 de um ano depois do nascimento, no calendário do aparelho de quem usa? */
export function ehAniversarioDoSyden(hoje = new Date()): boolean {
  const { ano, mes, dia } = NASCIMENTO_DO_SYDEN;
  return hoje.getFullYear() > ano && hoje.getMonth() + 1 === mes && hoje.getDate() === dia;
}
