import '@livekit/components-styles';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { iniciarIdioma } from './i18n';
import { aplicarLarguras, lerLarguras } from './larguras';
import { applyTheme, getTheme } from './theme';
import { aplicarCorDeDestaque } from './corDeDestaque';
import { aplicarEscalaDoTexto } from './escalaDoTexto';
import { aoMudarAjustes, getSettings } from './settings';

// O tema e o idioma vêm antes de qualquer tela: assim ninguém vê o app piscar do escuro para o claro,
// nem em português para depois virar inglês.
applyTheme(getTheme());
// A cor escolhida entra ANTES do primeiro desenho: aplicada depois, a tela piscaria no azul padrão.
aplicarCorDeDestaque(getSettings().corDeDestaque);
// O tamanho do texto também antes, e de novo a cada mudança — inclusive quando as preferências descem
// do servidor, que é quando alguém abre o Syden numa máquina nova e espera a letra do jeito dela.
aplicarEscalaDoTexto(getSettings().escalaDoTexto);
aoMudarAjustes(() => aplicarEscalaDoTexto(getSettings().escalaDoTexto));
iniciarIdioma();
// Antes de desenhar: se as larguras fossem aplicadas depois, a tela apareceria no tamanho padrão
// e pularia para o escolhido na frente da pessoa.
aplicarLarguras(lerLarguras());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Arquivo solto fora da conversa (na barra lateral, por exemplo): o padrão do navegador seria abrir o arquivo
// no lugar do Syden. Aqui ele é ignorado; quem trata o arrastar é a área de mensagens.
for (const event of ['dragover', 'drop'] as const) {
  window.addEventListener(event, (e) => e.preventDefault());
}

// Registra o service worker para o navegador oferecer "Instalar" (o Syden vira um programa com janela própria).
// Só no site publicado: em desenvolvimento ele atrapalharia a atualização automática das telas.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI), { scope: './' }).catch(console.error);
  });
}
