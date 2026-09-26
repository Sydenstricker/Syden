// Entrar com Google/Discord, do lado do navegador.
//
// O porquê do caminho ser em duas metades está no alto de server/src/social.ts. Do lado de cá o resumo
// é: este navegador sorteia um SEGREDO, guarda só com ele, e manda ao servidor apenas o resumo. Quando
// o Google devolve a pessoa ao site, o que chega na URL é um COMPROVANTE, que só vira token de verdade
// apresentando o segredo. Um link plantado por outra pessoa não tem o segredo, e não entra em lugar
// nenhum.
//
// O segredo mora no sessionStorage, e não no localStorage, de propósito: ele serve para UMA ida ao
// Google, e morre com a aba. Um segredo que sobrevive a reinício de navegador é um segredo esquecido.

import { api } from './api';
import type { User } from './types';

export type Provedor = 'google' | 'discord';

const CHAVE = 'syden.entrada-social';

export const NOMES: Record<Provedor, string> = {
  google: 'Google',
  discord: 'Discord',
};

/** O resumo (sha256, base64url) que o servidor vai guardar no lugar do segredo. */
async function resumir(segredo: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(segredo));
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sortear(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Começa a entrada: sorteia o segredo, pede o endereço ao servidor e leva o navegador para lá.
 *
 * Só volta se der errado — quando dá certo, a página já saiu do ar.
 */
export async function entrarCom(provedor: Provedor): Promise<void> {
  const segredo = sortear();
  const { url } = await api<{ url: string }>('/api/auth/social/inicio', {
    method: 'POST',
    token: null,
    body: { provedor, desafio: await resumir(segredo) },
  });
  // Guarda DEPOIS de o servidor aceitar: se o pedido falhar, não fica lixo esperando na aba.
  sessionStorage.setItem(CHAVE, segredo);
  window.location.assign(url);
}

export interface VoltaSocial {
  /** 'ok' quando há um comprovante para trocar; os outros são recados de por que não deu. */
  situacao: 'ok' | 'cancelado' | 'expirado' | 'provedor' | 'incompleto';
  comprovante: string | null;
}

/**
 * O que veio na URL depois de voltar do provedor, já limpo da barra de endereço.
 *
 * Limpar é importante: sem isso, recarregar a página tentaria usar de novo um comprovante que já foi
 * gasto, e a pessoa veria um erro que não existe mais.
 */
export function lerVolta(): VoltaSocial | null {
  const url = new URL(window.location.href);
  const entrada = url.searchParams.get('entrada');
  if (!entrada) return null;
  const comprovante = url.searchParams.get('comprovante');
  url.searchParams.delete('entrada');
  url.searchParams.delete('comprovante');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);

  const conhecidas: VoltaSocial['situacao'][] = ['ok', 'cancelado', 'expirado', 'provedor', 'incompleto'];
  const situacao = (conhecidas as string[]).includes(entrada) ? (entrada as VoltaSocial['situacao']) : 'incompleto';
  return { situacao, comprovante };
}

export const RECADOS: Record<Exclude<VoltaSocial['situacao'], 'ok'>, string> = {
  cancelado: 'Você cancelou a entrada. Nada foi feito.',
  expirado: 'Essa entrada demorou demais e não vale mais. Tente de novo.',
  provedor: 'Não deu para falar com o provedor agora. Tente de novo, ou entre com a sua senha.',
  incompleto: 'A volta veio incompleta. Tente entrar de novo.',
};

/** Troca o comprovante pelo token de verdade, apresentando o segredo que ficou nesta aba. */
export async function concluir(comprovante: string): Promise<{ token: string; user: User }> {
  const segredo = sessionStorage.getItem(CHAVE);
  sessionStorage.removeItem(CHAVE);
  if (!segredo) {
    // Acontece de verdade quando a pessoa começa num navegador e a volta abre em outro (o link foi
    // parar no aplicativo do e-mail, por exemplo). E é exatamente o que acontece com um link plantado.
    throw new Error('Esta entrada foi começada em outra aba ou em outro navegador. Comece de novo aqui.');
  }
  return api<{ token: string; user: User }>('/api/auth/social/concluir', {
    method: 'POST',
    token: null,
    body: { comprovante, segredo },
  });
}
