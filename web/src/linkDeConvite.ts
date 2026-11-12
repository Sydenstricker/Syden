/**
 * O LINK DE CONVITE CLICADO DENTRO DO SYDEN (12/11/2026, relato: "você deseja entrar nesse servidor?" ao clicar num link
 * de uma comunidade de que ainda não participa). A pergunta já existia para quem ABRE o link (ConviteParaComunidade.tsx),
 * mas o link numa mensagem abria uma aba nova, e no app jogava a pessoa para o navegador. Agora o clique fica aqui: o
 * Syden mostra a comunidade e pergunta, e quem já participa vai direto para ela (ou para a sala do link).
 */
export type ConviteDoLink = { code: string; canal: number | null };

export const EVENTO_DO_CONVITE = 'syden:convite';

/** O convite de um link do PRÓPRIO Syden (mesma origem e mesma base, com ?convite=), ou null. */
export function conviteDoLink(href: string, origem = window.location.origin, base: string = import.meta.env.BASE_URL): ConviteDoLink | null {
  let url: URL;
  try {
    url = new URL(href, origem);
  } catch {
    return null;
  }
  if (url.origin !== origem) return null;
  const raiz = base.endsWith('/') ? base : base + '/';
  if (url.pathname !== raiz && url.pathname !== raiz.slice(0, -1)) return null;
  const code = url.searchParams.get('convite');
  if (!code) return null;
  const canal = Number(url.searchParams.get('canal'));
  return { code, canal: Number.isInteger(canal) && canal > 0 ? canal : null };
}

/** Para o clique de um link: se for convite do Syden, abre a pergunta aqui mesmo em vez de uma aba nova. */
export function abrirConviteNoSyden(evento: { preventDefault(): void; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }, href: string) {
  if (evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
  const convite = conviteDoLink(href);
  if (!convite) return;
  evento.preventDefault();
  window.dispatchEvent(new CustomEvent<ConviteDoLink>(EVENTO_DO_CONVITE, { detail: convite }));
}
