import { useSyncExternalStore } from 'react';

// O navegador avisa uma única vez que o site pode virar programa (janela própria, ícone no menu iniciar).
// Guardamos esse aviso para oferecer o botão na hora certa; sem ele, não há como abrir a instalação.

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let prompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); // sem isso o Chrome mostra a barra dele, e aí o nosso botão não teria o que fazer
  prompt = event as InstallPrompt;
  announce();
});

// Instalou: o botão some (a janela do programa já abre pelo ícone).
window.addEventListener('appinstalled', () => {
  prompt = null;
  announce();
});

export function useCanInstall() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => prompt !== null,
    () => false,
  );
}

export async function installApp() {
  const current = prompt;
  if (!current) return;
  // Cada aviso só serve para uma tentativa; se a pessoa desistir, o navegador manda outro depois.
  prompt = null;
  announce();
  await current.prompt();
  await current.userChoice;
}
