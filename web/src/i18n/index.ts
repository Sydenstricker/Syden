import { useSyncExternalStore } from 'react';
import { FONTE_DA_ESCRITA, IDIOMAS, PADRAO, TRADUCOES, idiomaPorCodigo } from './idiomas';
import { desktopBridge } from '../desktop';

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

/**
 * Os idiomas que esta pessoa prefere, em ordem.
 *
 * NO APP DE DESKTOP A LISTA VEM DE OUTRO LUGAR, e foi preciso medir para descobrir. No navegador,
 * `navigator.languages` traz a preferência inteira e ordenada: ["ja","en-US","en","pt"]. Dentro do
 * Electron ela vem com UM item só — medido, ["pt-BR"] — e a cadeia de reserva desaparece. Alguém com o
 * sistema em japonês e inglês como segunda escolha acharia inglês no navegador e cairia no português
 * dentro do app, sem ninguém entender por quê. Com 74 idiomas na lista, isso aparece.
 *
 * A ponte do app expõe a lista de verdade do sistema (ver desktop/src/preload.js). O navegador não tem
 * ponte nenhuma, e aí `navigator.languages` já é a resposta certa.
 */
function preferenciasDeIdioma(): readonly string[] {
  try {
    const doApp = desktopBridge?.idiomasDoSistema?.();
    if (Array.isArray(doApp) && doApp.length > 0) return doApp;
  } catch {
    // ponte de versão antiga do app: cai no navegador, como sempre foi
  }
  return navigator.languages ?? [];
}

/** O idioma escolhido, ou o do sistema se ele estiver na lista, ou português. */
function escolhaInicial(): string {
  try {
    const guardado = localStorage.getItem(CHAVE);
    if (guardado && (guardado === PADRAO || TRADUCOES[guardado])) return guardado;
  } catch {
    // sem armazenamento: segue com o do sistema
  }
  for (const preferido of preferenciasDeIdioma()) {
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
  void import('../preferencias').then((m) => m.guardarEmBreve());
  dicionario = carregar ? (await carregar()).default : {};
  atual = codigo;
  prepararFonte(codigo);
  marcarPagina(codigo);
  avisar();
}

/**
 * Traduz um texto. Sem tradução para ele, devolve o próprio português — nunca uma tela vazia.
 *
 * O `|| texto` É PROPOSITAL, E NÃO `??`. Os dois se comportam igual para chave ausente; a diferença é a
 * STRING VAZIA. O esqueleto de um idioma novo (node scripts/idiomas.mjs --novo xx) nasce com todas as
 * chaves presentes e todos os valores vazios, justamente para dar uma lista de trabalho — e com `??`
 * cada uma dessas chaves devolveria "" e apagaria o texto da tela. Escolher um idioma recém-criado
 * mostraria botões sem rótulo e títulos invisíveis, em vez de português.
 *
 * Também cobre a tradução deixada pela metade à mão, que é o caso comum de quem traduz aos poucos.
 */
export function t(texto: string, valores?: Record<string, string | number>): string {
  const traduzido = dicionario[texto] || texto;
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

/**
 * Marca um texto que vai ser traduzido MAIS TARDE, por `t(variável)`.
 *
 * Em tempo de execução ela não faz nada: devolve o mesmo texto. Ela existe para as FERRAMENTAS.
 *
 * O problema que resolve, e que quase custou caro: os rótulos das abas de configurações moram numa
 * lista no topo do arquivo, e a tela desenha `t(s.label)`. A tradução funciona perfeitamente — mas
 * `scripts/idiomas.mjs` só encontra chave escrita como `t('texto')`, com o texto ali. Ele concluiu que
 * nove traduções boas eram lixo e mandou apagá-las. Uma ferramenta que manda apagar o que funciona é
 * pior do que ferramenta nenhuma, porque ela tem autoridade.
 *
 * Então onde o texto se separa do `t()`, ele vai marcado:
 *
 *   const ABAS = [{ id: 'account', label: chave('Minha conta') }];
 *   …
 *   {t(aba.label)}
 *
 * Duas linhas, e a chave volta a ser visível para quem conta.
 */
export const chave = (texto: string) => texto;

/** Chamado uma vez, ao abrir o app. */
export function iniciarIdioma() {
  void trocarIdioma(escolhaInicial());
}

export { IDIOMAS, PADRAO, TRADUCOES, idiomaPorCodigo } from './idiomas';
export { paisesCobertos } from './idiomas';
