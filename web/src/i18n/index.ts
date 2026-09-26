import { useSyncExternalStore } from 'react';
import { FONTE_DA_ESCRITA, IDIOMAS, PADRAO, TRADUCOES, idiomaPorCodigo } from './idiomas';

// O idioma do Syden, escolhido DENTRO do app (Configurações → Idioma) e não no instalador.
//
// A chave de cada texto é o próprio texto em português. Parece estranho, mas resolve três problemas de
// uma vez: o app funciona sem dicionário nenhum (é só devolver a chave), uma tradução pela metade nunca
// deixa a tela vazia — cai no português — e ninguém precisa inventar e manter nomes de chave.
//
// Trocar de idioma NÃO recarrega a página: o dicionário chega por import dinâmico e quem está na tela se
// redesenha sozinho (ver useT).

const CHAVE = 'syden.idioma';

let atual = PADRAO;
let dicionario: Record<string, string> = {};
const ouvintes = new Set<() => void>();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

/** O idioma escolhido, ou o do sistema se ele estiver na lista, ou português. */
function escolhaInicial(): string {
  try {
    const guardado = localStorage.getItem(CHAVE);
    if (guardado && (guardado === PADRAO || TRADUCOES[guardado])) return guardado;
  } catch {
    // sem armazenamento: segue com o do sistema
  }
  for (const preferido of navigator.languages ?? []) {
    // "en-GB" serve para quem tem "en"; "pt-PT" continua caindo no português do Brasil.
    const raiz = preferido.split('-')[0];
    const achado = IDIOMAS.find((i) => i.codigo === preferido || i.codigo === raiz);
    if (achado && (achado.codigo === PADRAO || TRADUCOES[achado.codigo])) return achado.codigo;
    if (raiz === 'pt') return PADRAO;
  }
  return PADRAO;
}

/**
 * A fonte da escrita da vez. A do Syden desenha o alfabeto latino; quem escreve em árabe, tailandês ou
 * coreano precisa de outra família, senão vê quadradinhos. A Noto é baixada do Google só quando aquela
 * escrita entra em cena — e, se o computador estiver sem internet, o sistema resolve com o que tem.
 */
function prepararFonte(codigo: string) {
  const idioma = idiomaPorCodigo(codigo);
  const familia = FONTE_DA_ESCRITA[idioma?.escrita ?? 'latina'];
  document.documentElement.style.setProperty('--fonte-idioma', `'${familia}'`);

  const id = `fonte-${familia.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${familia.replace(/\s+/g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

/** Põe no <html> o idioma e o sentido da escrita: é o que faz o árabe começar pela direita. */
function marcarPagina(codigo: string) {
  const idioma = idiomaPorCodigo(codigo);
  document.documentElement.lang = codigo;
  document.documentElement.dir = idioma?.rtl ? 'rtl' : 'ltr';
}

export function idiomaAtual(): string {
  return atual;
}

/** Troca o idioma na hora, sem recarregar. Guarda a escolha para as próximas vezes. */
export async function trocarIdioma(codigo: string) {
  const carregar = TRADUCOES[codigo];
  if (codigo !== PADRAO && !carregar) return;
  try {
    localStorage.setItem(CHAVE, codigo);
  } catch {
    // sem armazenamento: vale até fechar
  }
  dicionario = carregar ? (await carregar()).default : {};
  atual = codigo;
  prepararFonte(codigo);
  marcarPagina(codigo);
  avisar();
}

/** Traduz um texto. Sem tradução para ele, devolve o próprio português — nunca uma tela vazia. */
export function t(texto: string, valores?: Record<string, string | number>): string {
  const traduzido = dicionario[texto] ?? texto;
  if (!valores) return traduzido;
  return traduzido.replace(/\{(\w+)\}/g, (inteiro, nome) => String(valores[nome] ?? inteiro));
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/**
 * O que os componentes usam. Devolve a função de traduzir e redesenha a tela quando o idioma muda —
 * por isso a troca acontece na hora, sem recarregar o Syden.
 */
export function useT() {
  useSyncExternalStore(assinar, idiomaAtual);
  return t;
}

/** Chamado uma vez, ao abrir o app. */
export function iniciarIdioma() {
  void trocarIdioma(escolhaInicial());
}

export { IDIOMAS, PADRAO, TRADUCOES, idiomaPorCodigo } from './idiomas';
export { paisesCobertos } from './idiomas';
