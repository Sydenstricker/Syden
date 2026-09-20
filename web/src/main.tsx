import '@livekit/components-styles';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registra o service worker para o navegador oferecer "Instalar" (o Syden vira um programa com janela própria).
// Só no site publicado: em desenvolvimento ele atrapalharia a atualização automática das telas.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI), { scope: './' }).catch(console.error);
  });
}
