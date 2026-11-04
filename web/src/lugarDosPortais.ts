import { useEffect, useState } from 'react';

/**
 * ONDE UM PORTAL DEVE SER DESENHADO: no elemento em tela cheia, se houver um; senão, no <body>.
 *
 * A tela cheia do navegador só mostra o elemento que foi posto nela e o que estiver DENTRO dele. Um menu,
 * um cartão de perfil ou uma denúncia desenhados no <body> continuam abertos, mas atrás da tela cheia,
 * invisíveis: o botão direito numa câmera parecia não fazer nada. Desde 04/11/2026 a tela cheia é o palco
 * inteiro da chamada (VoiceStage.tsx), com as câmeras e os botões, e por isso o que abre dele precisa vir
 * junto.
 *
 * O lugar acompanha o evento do navegador: entrar e sair da tela cheia leva o portal aberto junto.
 */
export function useLugarDosPortais(): HTMLElement {
  const [lugar, setLugar] = useState<HTMLElement>(() => lugarAgora());
  useEffect(() => {
    const mudou = () => setLugar(lugarAgora());
    document.addEventListener('fullscreenchange', mudou);
    return () => document.removeEventListener('fullscreenchange', mudou);
  }, []);
  return lugar;
}

function lugarAgora(): HTMLElement {
  const cheia = document.fullscreenElement;
  return cheia instanceof HTMLElement ? cheia : document.body;
}
