import logoUrl from './assets/logo.png';

/** O coelho na estrela do Syden (o mesmo desenho do ícone do app): silhueta com fundo transparente. */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return <img className={className} src={logoUrl} width={size} height={size} alt="" />;
}
