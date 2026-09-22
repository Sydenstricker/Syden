import logoUrl from './assets/logo.png';
import fromUrl from './assets/logo2.png';

/**
 * Abertura do app: o brasão antigo se dissolve e o ícone atual do Syden materializa no lugar dele, com um
 * leve zoom — não é um morph vetorial de verdade (os dois desenhos são muito diferentes para isso ficar bem;
 * ponto a ponto ficaria com cara de "derretendo"), mas a dissolução com desfoque lê como uma transformação
 * fluida, do jeito que o Discord abre. Depois da transição, o ícone final respira suavemente enquanto o app
 * confere a sessão — a animação só toca a primeira vez que o app carrega, não se repete.
 */
export function SplashLogo() {
  return (
    <div className="splash-logo-stage">
      <img className="splash-logo-from" src={fromUrl} width={280} height={280} alt="" />
      <img className="splash-logo-to" src={logoUrl} width={280} height={280} alt="" />
    </div>
  );
}
