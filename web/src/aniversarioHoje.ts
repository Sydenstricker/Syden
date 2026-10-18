// A regra do dia da festa de aniversário (ParabensDoSyden.tsx), à parte do componente para o teste não puxar imagens.
/**
 * Hoje é o aniversário? Pelo calendário do aparelho de quem usa (o dia dela é o dia no fuso dela). Quem nasceu em 29 de
 * fevereiro festeja no dia 28 nos anos que não são bissextos.
 */
export function ehAniversarioHoje(mes: number | null, dia: number | null, hoje = new Date()): boolean {
  if (!mes || !dia) return false;
  const ano = hoje.getFullYear(), bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const diaDeVerdade = mes === 2 && dia === 29 && !bissexto ? 28 : dia;
  return hoje.getMonth() + 1 === mes && hoje.getDate() === diaDeVerdade;
}
