import { useSyncExternalStore } from 'react';

/**
 * SEM FOCO, NADA SE MEXE (06/11/2026, medido comparando com o Discord). Com a janela do Syden atrás de um jogo ou de outro
 * programa, as animações de CSS e as dos avatares do mascote continuavam rodando: o brilho da capa custava ~17% de um núcleo
 * na placa, e as dezenas de avatares animados da lista de membros ~13% na página, com ninguém olhando. O Discord, parado,
 * fica perto de zero.
 *
 * A marca `janela-sem-foco` no <html> pausa as animações de CSS (styles.css), e `useJanelaComFoco` deixa um componente
 * trocar o que a página não consegue pausar (o SVG animado dentro de um <img>, em Avatar.tsx). O quarto, o salão e os jogos
 * já paravam por conta própria.
 *
 * O hasFocus vale também com o foco num iframe (o quarto, o salão), mas no instante do blur ele ainda não mudou, e sair do
 * app a partir do iframe não avisa esta página: por isso a conferência logo depois do evento e uma vez por segundo (ela só
 * lê duas propriedades).
 */
let comFoco = true;
const ouvintes = new Set<() => void>();

function conferir() {
  const agora = !document.hidden && document.hasFocus();
  if (agora === comFoco) return;
  comFoco = agora;
  document.documentElement.classList.toggle('janela-sem-foco', !agora);
  for (const f of ouvintes) f();
}

/** Liga a conferência (uma vez, em main.tsx). */
export function vigiarFocoDaJanela() {
  comFoco = !document.hidden && document.hasFocus();
  document.documentElement.classList.toggle('janela-sem-foco', !comFoco);
  window.addEventListener('focus', conferir);
  window.addEventListener('blur', () => setTimeout(conferir, 0));
  document.addEventListener('visibilitychange', conferir);
  setInterval(conferir, 1000);
}

/** A janela está com foco e à vista? Muda quando ela perde ou ganha o foco. */
export function useJanelaComFoco() {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => comFoco,
  );
}
