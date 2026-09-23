import { getSettings, updateSettings } from './settings';
import { desktopBridge } from './desktop';

// Tema do app: escuro (o de sempre) ou claro. Tudo o que muda são as variáveis de cor do CSS, então
// ligar e desligar é só marcar o documento — nenhuma tela precisa saber que existe tema.

export type Theme = 'dark' | 'light';

/** Cores da barra de título do app de desktop, que é desenhada pelo Windows, não pelo site. */
const TITLE_BAR: Record<Theme, { color: string; symbolColor: string }> = {
  dark: { color: '#1e1f22', symbolColor: '#dbdee1' },
  light: { color: '#e3e5e8', symbolColor: '#2e3338' },
};

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  desktopBridge?.setTitleBarTheme?.(TITLE_BAR[theme]);
}

export function getTheme(): Theme {
  return getSettings().theme;
}

export function setTheme(theme: Theme) {
  updateSettings({ theme });
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
