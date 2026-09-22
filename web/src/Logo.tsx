import logoUrl from './assets/logo.png';

/** O coelho vermelho do Syden (o mesmo desenho do ícone do app). */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return <img className={className} src={logoUrl} width={size} height={size} alt="" style={{ borderRadius: '22%' }} />;
}
