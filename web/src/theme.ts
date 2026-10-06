import { getSettings, updateSettings } from './settings';
import { desktopBridge } from './desktop';
import { chave } from './i18n';

// Tema do app: escuro (o de sempre) ou claro. Tudo o que muda são as variáveis de cor do CSS, então
// ligar e desligar é só marcar o documento — nenhuma tela precisa saber que existe tema.

export type Theme = 'dark' | 'light';

/**
 * A PALETA DO TEMA ESCURO, escolhida em Aparência. Pedido do Sydenstricker em 05/10/2026, logo depois
 * do rebrand: poder voltar à paleta antiga, e ter outras. Cada uma é um bloco de variáveis em
 * styles.css (`:root[data-paleta=…]`); a D4 é o próprio :root, sem atributo.
 *
 * O tema claro não tem paleta: com o sol ligado vale o claro, qualquer que seja a escolha aqui.
 */
export type Paleta = 'd4' | 'classica' | 'grafite' | 'contraste';

/** As opções, na ordem da tela, com as cores da amostra (fundo, lateral, texto, destaque). */
export const PALETAS: { valor: Paleta; nome: string; descricao: string; amostra: [string, string, string, string] }[] = [
  { valor: 'd4', nome: chave('D4'), descricao: chave('Azul-noite, creme e âmbar. A do Syden.'), amostra: ['#1c212b', '#11141a', '#e8eaf0', '#f5b83d'] },
  { valor: 'classica', nome: chave('Clássica'), descricao: chave('Cinza e azul, a de antes do coelho novo.'), amostra: ['#313338', '#1e1f22', '#dbdee1', '#5865f2'] },
  { valor: 'grafite', nome: chave('Grafite'), descricao: chave('Cinza neutro, quase preto, com verde-água.'), amostra: ['#18191c', '#0c0d0f', '#e4e5e7', '#3ccfb8'] },
  { valor: 'contraste', nome: chave('Alto contraste'), descricao: chave('Preto, branco e amarelo, para ler sem esforço.'), amostra: ['#0a0a0a', '#000000', '#ffffff', '#ffd400'] },
];

/**
 * A barra de título do app de desktop é desenhada pelo Windows, não pelo site: ela precisa ser
 * avisada. As cores saem das MESMAS variáveis que a tela usa, lidas depois de marcar o documento —
 * antes eram uma tabela à parte, que o rebrand esqueceu, e o app abria com a barra cinza antiga
 * sobre a paleta nova.
 */
function avisarBarraDeTitulo() {
  if (!desktopBridge?.setTitleBarTheme) return;
  const estilo = getComputedStyle(document.documentElement);
  desktopBridge.setTitleBarTheme({
    color: estilo.getPropertyValue('--bg-darkest').trim(),
    symbolColor: estilo.getPropertyValue('--text').trim(),
  });
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  avisarBarraDeTitulo();
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

export function aplicarPaleta(paleta: Paleta) {
  const raiz = document.documentElement;
  if (paleta === 'd4' || !PALETAS.some((p) => p.valor === paleta)) delete raiz.dataset.paleta;
  else raiz.dataset.paleta = paleta;
  avisarBarraDeTitulo();
}

export function escolherPaleta(paleta: Paleta) {
  updateSettings({ paleta });
  aplicarPaleta(paleta);
}
