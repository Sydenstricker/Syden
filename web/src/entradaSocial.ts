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

import { api, ApiError } from './api';
import { desktopBridge } from './desktop';
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

/** O fim da linha: ou uma sessão nova, ou um provedor pendurado na conta que já existia. */
export interface Entrada {
  token?: string;
  user?: User;
  ligado?: Provedor;
}

/**
 * Começa a entrada: sorteia o segredo, pede o endereço ao servidor e leva a pessoa até o provedor.
 *
 * NO NAVEGADOR não volta nunca dando certo: a página sai do ar ao ir para o Google, e quem termina o
 * serviço é a página que recebe a volta.
 *
 * NO APP resolve com a entrada pronta, porque lá o caminho é outro (ver `comecar`).
 */
export async function entrarCom(provedor: Provedor): Promise<Entrada | null> {
  return comecar(provedor, '/api/auth/social/inicio', null);
}

/**
 * Liga este provedor à conta em que a pessoa JÁ ESTÁ.
 *
 * A diferença para o entrarCom é uma rota e um token: o pedido vai autenticado, e é ele que decide em
 * qual conta a ligação vai cair. Nada que venha do provedor depois muda isso — se a conta viesse da
 * volta, quem plantasse o link escolheria a conta.
 */
export async function ligarCom(provedor: Provedor): Promise<Entrada | null> {
  return comecar(provedor, '/api/me/social/inicio', undefined);
}

/**
 * NO APP, O CAMINHO É OUTRO — e é a correção de uma coisa que simplesmente não funcionava.
 *
 * No navegador a página sai para o Google e volta sozinha. No app instalado, navegar para fora é
 * bloqueado de propósito, então o endereço do Google era aberto no navegador do sistema — e a volta
 * caía lá, num navegador que NÃO TEM o segredo guardado aqui. O app ficava esperando para sempre.
 *
 * Agora o app avisa o servidor de onde o fluxo começou (`doApp`), e o servidor devolve a pessoa por
 * `syden://`, que o Windows entrega de volta a esta janela. O Google continua abrindo num navegador
 * de verdade, que é o que ele exige — embutir a página dele numa janela nossa é contra a política.
 *
 * As DUAS funções, e não uma: sem o abrirFora não há como mandar a pessoa ao Google, e sem o
 * aoVoltarDaEntrada não há como receber a volta. Meia ponte é um beco sem saída.
 *
 * Fica exportado porque a tela de entrada precisa da mesma resposta: é ela que espera a volta, e o que
 * ela mostra enquanto espera depende de por onde a volta vem.
 */
export const voltaPeloApp = Boolean(desktopBridge?.abrirFora && desktopBridge?.aoVoltarDaEntrada);

async function comecar(provedor: Provedor, rota: string, token: null | undefined): Promise<Entrada | null> {
  const segredo = sortear();
  const noApp = voltaPeloApp;

  // token: null = sem autenticação (entrar); undefined = usa o token guardado (ligar).
  const { url, estado } = await api<{ url: string; estado: string }>(rota, {
    method: 'POST',
    ...(token === null ? { token: null } : {}),
    body: { provedor, desafio: await resumir(segredo), doApp: noApp },
  });
  // Guarda DEPOIS de o servidor aceitar: se o pedido falhar, não fica lixo esperando na aba.
  sessionStorage.setItem(CHAVE, segredo);

  if (!noApp) {
    window.location.assign(url);
    return null;
  }

  const minhaVez = ++esperaAtual;
  desktopBridge!.abrirFora!(url);
  return esperarOFim(estado, segredo, minhaVez);
}

/**
 * De quantas em quantas vezes o app pergunta se já terminou, e por quanto tempo.
 *
 * Dois segundos é rápido o bastante para a janela do Syden aparecer "no mesmo instante" em que a pessoa
 * autoriza, e devagar o bastante para não ser nada: são poucos pedidos, cada um uma consulta por chave
 * primária. Meia hora é o mesmo prazo que o servidor dá à entrada — perguntar depois disso é perguntar
 * por algo que já não existe.
 */
const DE_QUANTO_EM_QUANTO_MS = 2000;
const DESISTE_DEPOIS_DE_MS = 30 * 60_000;
/** Falhas de rede seguidas antes de desistir. Uma internet que oscila não pode derrubar a entrada. */
const ERROS_SEGUIDOS_ATE_DESISTIR = 10;

/**
 * Quem está esperando agora. Clicar em "Google" e depois em "Discord" deixaria duas esperas correndo,
 * e a primeira ainda poderia entrar numa conta que a pessoa já desistiu de usar.
 */
let esperaAtual = 0;

const pausa = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));

interface Espera extends Entrada {
  situacao: VoltaSocial['situacao'] | 'esperando';
}

/**
 * NO APP, QUEM PERGUNTA É O APP — e é isso que faz a entrada terminar sem mais nenhuma pergunta.
 *
 * O caminho antigo dependia de o NAVEGADOR abrir o aplicativo (`syden://`), e por isso o Windows
 * perguntava se podia. A pergunta é do sistema e não tem como ser removida; o que dá para remover é a
 * necessidade dela. Aqui o app já está aberto, já tem o segredo, e só quer saber se terminou. Nada
 * precisa abrir nada.
 *
 * O caminho por `syden://` continua existindo como rede: a página de volta tem um botão para ele, para
 * o caso de a conversa com o servidor não acontecer. Se os dois chegarem, o segundo encontra a entrada
 * já usada — e o App ignora uma volta que chega com a sessão já aberta.
 */
async function esperarOFim(estado: string, segredo: string, minhaVez: number): Promise<Entrada | null> {
  const ate = Date.now() + DESISTE_DEPOIS_DE_MS;
  let errosSeguidos = 0;

  while (Date.now() < ate) {
    await pausa(DE_QUANTO_EM_QUANTO_MS);
    // Outra entrada começou no meio do caminho: esta perdeu a vez e some sem dizer nada.
    if (minhaVez !== esperaAtual) return null;

    let resposta: Espera;
    try {
      resposta = await api<Espera>('/api/auth/social/esperar', { method: 'POST', token: null, body: { estado, segredo } });
      errosSeguidos = 0;
    } catch (erro) {
      // Segredo recusado não melhora tentando de novo: é a única recusa que encerra na hora.
      if (erro instanceof ApiError && erro.status === 403) throw erro;
      if (++errosSeguidos >= ERROS_SEGUIDOS_ATE_DESISTIR) throw erro;
      continue;
    }

    if (resposta.situacao === 'esperando') continue;

    sessionStorage.removeItem(CHAVE);
    if (resposta.situacao === 'ok' || resposta.situacao === 'ligar') {
      // A JANELA VEM PARA FRENTE SOZINHA. Sem isto, a pessoa autoriza no navegador e continua olhando
      // para o navegador, sem sinal nenhum de que o Syden já entrou atrás dele.
      desktopBridge?.focus?.();
      return resposta;
    }
    throw new Error(RECADOS[resposta.situacao]);
  }

  sessionStorage.removeItem(CHAVE);
  throw new Error(RECADOS.expirado);
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
export function lerVolta(endereco?: string): VoltaSocial | null {
  // Com endereço, veio pela ponte do app (syden://entrada?...) e não há barra de endereço para limpar.
  const url = new URL(endereco ?? window.location.href);
  const entrada = url.searchParams.get('entrada');
  if (!entrada) return null;
  const comprovante = url.searchParams.get('comprovante');
  if (!endereco) {
    url.searchParams.delete('entrada');
    url.searchParams.delete('comprovante');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

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

/**
 * Escuta a volta que chega pela ponte do app, em vez de pela barra de endereço.
 *
 * No navegador não faz nada e devolve uma função vazia: a ponte só existe dentro do app de desktop, e
 * quem chama não precisa saber em qual dos dois está.
 */
export function aoVoltarPeloApp(callback: (volta: VoltaSocial) => void): () => void {
  const parar = desktopBridge?.aoVoltarDaEntrada?.((url) => {
    const volta = lerVolta(url);
    if (volta) callback(volta);
  });
  return parar ?? (() => {});
}
