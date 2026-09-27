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

export type Provedor = 'google' | 'discord' | 'github' | 'steam';

const CHAVE = 'syden.entrada-social';

export const NOMES: Record<Provedor, string> = {
  google: 'Google',
  discord: 'Discord',
  github: 'GitHub',
  steam: 'Steam',
};

/**
 * O que dizer embaixo do botão, quando há algo a dizer.
 *
 * A Steam é a única com aviso, e ele é necessário: ela NÃO entrega e-mail nenhum (o protocolo dela nem
 * tem esse campo). Sem e-mail não há recuperação de senha — e a pessoa precisa saber disso antes de
 * escolher esse caminho, não no dia em que perder o acesso.
 */
export const AVISOS: Partial<Record<Provedor, string>> = {
  steam: 'A Steam não informa e-mail. Cadastre um depois, nas configurações, para conseguir recuperar o acesso.',
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
  return comecar(provedor, '/api/auth/social/inicio', null);
}

/**
 * Liga este provedor à conta em que a pessoa JÁ ESTÁ.
 *
 * A diferença para o entrarCom é uma rota e um token: o pedido vai autenticado, e é ele que decide em
 * qual conta a ligação vai cair. Nada que venha do provedor depois muda isso — se a conta viesse da
 * volta, quem plantasse o link escolheria a conta.
 */
export async function ligarCom(provedor: Provedor): Promise<void> {
  return comecar(provedor, '/api/me/social/inicio', undefined);
}

async function comecar(provedor: Provedor, rota: string, token: null | undefined): Promise<void> {
  const segredo = sortear();
  // token: null = sem autenticação (entrar); undefined = usa o token guardado (ligar).
  const { url } = await api<{ url: string }>(rota, {
    method: 'POST',
    ...(token === null ? { token: null } : {}),
    body: { provedor, desafio: await resumir(segredo) },
  });
  // Guarda DEPOIS de o servidor aceitar: se o pedido falhar, não fica lixo esperando na aba.
  sessionStorage.setItem(CHAVE, segredo);
  window.location.assign(url);
}

export interface VoltaSocial {
  /** 'ok' quando há um comprovante para trocar; os outros são recados de por que não deu. */
  /** 'ok' = entrar; 'ligar' = pendurar o provedor na conta de quem já está dentro. */
  situacao: 'ok' | 'ligar' | 'cancelado' | 'expirado' | 'provedor' | 'incompleto' | 'jaligada';
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

  const conhecidas: VoltaSocial['situacao'][] = ['ok', 'ligar', 'cancelado', 'expirado', 'provedor', 'incompleto', 'jaligada'];
  const situacao = (conhecidas as string[]).includes(entrada) ? (entrada as VoltaSocial['situacao']) : 'incompleto';
  return { situacao, comprovante };
}

export const RECADOS: Record<Exclude<VoltaSocial['situacao'], 'ok' | 'ligar'>, string> = {
  cancelado: 'Você cancelou. Nada foi feito.',
  expirado: 'Isso demorou demais e não vale mais. Tente de novo.',
  provedor: 'Não deu para falar com o provedor agora. Tente de novo, ou entre com a sua senha.',
  incompleto: 'A volta veio incompleta. Tente de novo.',
  jaligada: 'Essa conta já está ligada a outro usuário aqui no Syden. Desligue lá antes de ligar aqui.',
};

/**
 * Apresenta o comprovante E o segredo que ficou nesta aba.
 *
 * Volta com o token, quando era para entrar, ou com o nome do provedor, quando era para ligar — a
 * pessoa já estava dentro, e nesse caso não há sessão nova nenhuma para abrir.
 */
export async function concluir(comprovante: string): Promise<{ token?: string; user?: User; ligado?: Provedor }> {
  const segredo = sessionStorage.getItem(CHAVE);
  sessionStorage.removeItem(CHAVE);
  if (!segredo) {
    // Acontece de verdade quando a pessoa começa num navegador e a volta abre em outro (o link foi
    // parar no aplicativo do e-mail, por exemplo). E é exatamente o que acontece com um link plantado.
    throw new Error('Esta entrada foi começada em outra aba ou em outro navegador. Comece de novo aqui.');
  }
  return api<{ token?: string; user?: User; ligado?: Provedor }>('/api/auth/social/concluir', {
    method: 'POST',
    token: null,
    body: { comprovante, segredo },
  });
}
