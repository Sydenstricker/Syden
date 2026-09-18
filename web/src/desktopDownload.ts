/** Link direto do instalador (GitHub Releases, sempre a versão mais recente). Definido no build do site. */
export const DESKTOP_DOWNLOAD_URL: string = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL || '';

const userAgent = navigator.userAgent;

/** Só oferece o app para quem está no navegador do Windows: o instalador é só para Windows, e dentro do app não faz sentido. */
export const showDesktopDownload =
  DESKTOP_DOWNLOAD_URL !== '' && userAgent.includes('Windows') && !userAgent.includes('Electron');
