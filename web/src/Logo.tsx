import { urlDoCoelho, useCoelho } from './coelho';

/**
 * O coelho na estrela do Syden: o mesmo desenho do ícone do app, com fundo transparente. Qual dos dois
 * aparece é escolha de cada um, na aba dos coelhos da tela inicial (ver coelho.ts).
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  const coelho = useCoelho();
  return <img className={className} src={urlDoCoelho(coelho)} width={size} height={size} alt="" />;
}
