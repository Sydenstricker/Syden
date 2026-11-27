/**
 * Os dados do chat (27/11/2026; o porquê no CLAUDE.md, "O bot de dados"): a notação, a rolagem e os sorteios.
 *
 * Tudo aqui é conta pura, sem banco nem rede: o sorteador entra por parâmetro (o de verdade é o `crypto.randomInt`, sem viés;
 * os testes passam um fixo). Quem sorteia é SEMPRE o servidor, e o resultado guarda a conta inteira ("[4, 5] + 3 = 12"):
 * o site só encena o que já foi decidido.
 *
 * A notação é a de sempre da mesa de RPG, que é pública (`NdM`, `kh`/`kl`/`dh`/`dl`, `!`, `>=N`, `dF`); "vantagem" e
 * "desvantagem" são palavras comuns do meio. Nada de nome de sistema nem de regra de livro.
 */
import { randomInt } from 'node:crypto';

/** Sorteia um inteiro de 1 a `faces`. */
export type Sorteador = (faces: number) => number;

export const sorteadorDeVerdade: Sorteador = (faces) => randomInt(1, faces + 1);

export const LIMITES = {
  expressao: 100,
  dadosPorTermo: 100,
  dadosNoTotal: 200,
  faces: 1000,
  termos: 10,
  explosoesPorDado: 20,
  opcoes: 50,
  texto: 60,
  times: 8,
  iniciativa: 30,
  rotulo: 60,
  numeroMaximo: 1_000_000_000,
} as const;

export class ErroDeDados extends Error {}

// ---------- A notação ----------

export interface TermoDeDados {
  tipo: 'dados';
  /** 1 soma, -1 subtrai. */
  sinal: 1 | -1;
  n: number;
  /** O número de faces; 'F' é o dado de dois resultados mais/menos/vazio. */
  faces: number | 'F';
  /** O que veio escrito depois do dado (`kh1`, `!`, `>=8`), para mostrar. */
  mods: string;
  /** Tudo o que saiu, na ordem, inclusive os extras dos dados que explodem. */
  rolados: number[];
  /** Quais dos rolados entram na conta (os outros foram descartados por `kh`, `dl`…). */
  usados: boolean[];
  /** A conta deste termo, já com o sinal. */
  subtotal: number;
  /** Quando o termo conta sucessos em vez de somar. */
  sucessos: boolean;
}

export interface TermoFixo {
  tipo: 'num';
  sinal: 1 | -1;
  valor: number;
}

export type Termo = TermoDeDados | TermoFixo;

export interface RolagemDeDados {
  tipo: 'dados';
  expressao: string;
  termos: Termo[];
  total: number;
  modo: 'vantagem' | 'desvantagem' | null;
  /** O d20 sozinho que tirou o máximo ou o 1 (a tela dá o destaque). */
  destaque: 'critico' | 'falha' | null;
}

interface CondicaoDeSucesso {
  op: '>=' | '<=' | '>' | '<';
  valor: number;
}

interface DadoLido {
  sinal: 1 | -1;
  n: number;
  faces: number | 'F';
  manter: { qual: 'h' | 'l'; quantos: number } | null;
  descartar: { qual: 'h' | 'l'; quantos: number } | null;
  explode: boolean;
  sucesso: CondicaoDeSucesso | null;
  mods: string;
  texto: string;
}

type Lido = DadoLido | TermoFixo;

const PALAVRAS_DE_VANTAGEM = ['vantagem', 'vant', 'adv', 'advantage'];
const PALAVRAS_DE_DESVANTAGEM = ['desvantagem', 'desv', 'dis', 'disadvantage'];

function inteiro(texto: string, o_que: string): number {
  const n = Number(texto);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new ErroDeDados(`Número inválido em ${o_que}.`);
  return n;
}

/** Lê a expressão. Erra com mensagem em português quando não é uma notação que a gente entenda. */
export function lerExpressao(entrada: string): { termos: Lido[]; modo: 'vantagem' | 'desvantagem' | null } {
  let texto = String(entrada ?? '')
    .trim()
    .toLowerCase()
    .replace(/×/g, '*')
    .replace(/[−–]/g, '-');
  if (!texto) throw new ErroDeDados('Escreva o que rolar, por exemplo 2d6+3.');
  if (texto.length > LIMITES.expressao) throw new ErroDeDados(`A expressão pode ter até ${LIMITES.expressao} caracteres.`);

  // "d20+5 vantagem": a palavra vem no fim.
  let modo: 'vantagem' | 'desvantagem' | null = null;
  const palavra = texto.match(/(?:^|\s+)([a-z]+)$/);
  if (palavra) {
    if (PALAVRAS_DE_VANTAGEM.includes(palavra[1])) modo = 'vantagem';
    else if (PALAVRAS_DE_DESVANTAGEM.includes(palavra[1])) modo = 'desvantagem';
    if (modo) texto = texto.slice(0, palavra.index).trim();
  }
  // "vantagem" sozinha vale um d20.
  if (!texto && modo) texto = 'd20';
  if (/\d\s+\d/.test(texto)) throw new ErroDeDados('Separe os termos com + ou -.');
  texto = texto.replace(/\s+/g, '');
  if (!texto) throw new ErroDeDados('Escreva o que rolar, por exemplo 2d6+3.');

  const termos: Lido[] = [];
  const parte = /([+-]?)(\d*)d(%|f|\d+)((?:kh\d*|kl\d*|k\d+|dh\d*|dl\d*|!|>=\d+|<=\d+|>\d+|<\d+)*)|([+-]?)(\d+)/y;
  let resto = 0;
  while (resto < texto.length) {
    parte.lastIndex = resto;
    const m = parte.exec(texto);
    if (!m || m.index !== resto) throw new ErroDeDados(`Não entendi "${texto.slice(resto, resto + 12)}". Use algo como 2d6+3.`);
    resto = parte.lastIndex;
    if (termos.length >= LIMITES.termos) throw new ErroDeDados(`Use até ${LIMITES.termos} termos por rolagem.`);
    if (termos.length > 0 && !(m[1] || m[5])) throw new ErroDeDados('Separe os termos com + ou -.');

    if (m[6] !== undefined) {
      const valor = inteiro(m[6], 'um número');
      termos.push({ tipo: 'num', sinal: m[5] === '-' ? -1 : 1, valor });
      continue;
    }

    const n = m[2] === '' ? 1 : inteiro(m[2], 'a quantidade de dados');
    if (n < 1 || n > LIMITES.dadosPorTermo) throw new ErroDeDados(`Use de 1 a ${LIMITES.dadosPorTermo} dados por termo.`);
    const facesTexto = m[3];
    const faces: number | 'F' = facesTexto === 'f' ? 'F' : facesTexto === '%' ? 100 : inteiro(facesTexto, 'as faces');
    if (faces !== 'F' && (faces < 2 || faces > LIMITES.faces)) throw new ErroDeDados(`O dado precisa ter de 2 a ${LIMITES.faces} faces.`);

    const mods = m[4] ?? '';
    const lido: DadoLido = { sinal: m[1] === '-' ? -1 : 1, n, faces, manter: null, descartar: null, explode: false, sucesso: null, mods, texto: `${n}d${facesTexto === '%' ? '%' : facesTexto === 'f' ? 'F' : faces}${mods}` };
    const modPartes = /kh\d*|kl\d*|k\d+|dh\d*|dl\d*|!|>=\d+|<=\d+|>\d+|<\d+/g;
    for (const mod of mods.match(modPartes) ?? []) {
      if (mod === '!') {
        if (faces === 'F') throw new ErroDeDados('O dado de dois resultados não explode.');
        lido.explode = true;
      } else if (mod[0] === 'k') {
        const qual = mod[1] === 'l' ? 'l' : 'h';
        const numero = mod.replace(/^k[hl]?/, '');
        lido.manter = { qual, quantos: numero === '' ? 1 : inteiro(numero, 'quantos manter') };
      } else if (mod[0] === 'd') {
        const numero = mod.slice(2);
        lido.descartar = { qual: mod[1] as 'h' | 'l', quantos: numero === '' ? 1 : inteiro(numero, 'quantos descartar') };
      } else {
        const op = mod.match(/^(>=|<=|>|<)/)![1] as CondicaoDeSucesso['op'];
        lido.sucesso = { op, valor: Number(mod.slice(op.length)) };
      }
    }
    if (lido.manter && lido.descartar) throw new ErroDeDados('Use manter ou descartar, não os dois no mesmo dado.');
    termos.push(lido);
  }

  const totalDeDados = termos.reduce((soma, t) => soma + ('n' in t ? t.n : 0), 0);
  if (totalDeDados > LIMITES.dadosNoTotal) throw new ErroDeDados(`Use no máximo ${LIMITES.dadosNoTotal} dados por rolagem.`);
  if (!termos.some((t) => 'n' in t)) throw new ErroDeDados('Falta um dado na rolagem. Use algo como 1d20.');

  if (modo) {
    // A vantagem vale para o primeiro d20 sozinho: troca por 2d20 ficando com o maior (ou o menor).
    const alvo = termos.find((t): t is DadoLido => 'n' in t && t.faces === 20 && t.n === 1 && !t.manter && !t.descartar && !t.explode && !t.sucesso);
    if (!alvo) throw new ErroDeDados('Vantagem e desvantagem valem para um d20 sozinho, como d20+5.');
    alvo.n = 2;
    alvo.manter = { qual: modo === 'vantagem' ? 'h' : 'l', quantos: 1 };
    alvo.mods = modo === 'vantagem' ? 'kh1' : 'kl1';
    alvo.texto = `2d20${alvo.mods}`;
  }
  return { termos, modo };
}

function passa(valor: number, c: CondicaoDeSucesso): boolean {
  return c.op === '>=' ? valor >= c.valor : c.op === '<=' ? valor <= c.valor : c.op === '>' ? valor > c.valor : valor < c.valor;
}

/** Rola a expressão. */
export function rolar(expressao: string, sorteio: Sorteador = sorteadorDeVerdade): RolagemDeDados {
  const { termos: lidos, modo } = lerExpressao(expressao);
  const termos: Termo[] = [];
  let total = 0;

  for (const lido of lidos) {
    if (!('n' in lido)) {
      termos.push(lido);
      total += lido.sinal * lido.valor;
      continue;
    }
    const rolados: number[] = [];
    const maximo = lido.faces === 'F' ? 3 : lido.faces;
    for (let i = 0; i < lido.n; i++) {
      let extras = 0;
      let valor = sorteio(maximo);
      rolados.push(lido.faces === 'F' ? valor - 2 : valor);
      while (lido.explode && valor === maximo && extras < LIMITES.explosoesPorDado) {
        valor = sorteio(maximo);
        rolados.push(valor);
        extras++;
      }
    }

    // Quais entram na conta: `kh2` fica com os dois maiores, `dl1` descarta o menor.
    const usados = rolados.map(() => true);
    const ordem = rolados.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
    const tirar = (quantos: number, doFim: boolean) => {
      const lista = doFim ? [...ordem].reverse() : ordem;
      for (const { i } of lista.slice(0, Math.max(0, quantos))) usados[i] = false;
    };
    if (lido.manter) tirar(rolados.length - lido.manter.quantos, lido.manter.qual === 'l');
    if (lido.descartar) tirar(lido.descartar.quantos, lido.descartar.qual === 'h');

    const sucessos = lido.sucesso !== null;
    const valores = rolados.filter((_, i) => usados[i]);
    const soma = sucessos ? valores.filter((v) => passa(v, lido.sucesso!)).length : valores.reduce((a, b) => a + b, 0);
    const subtotal = lido.sinal * soma;
    termos.push({ tipo: 'dados', sinal: lido.sinal, n: lido.n, faces: lido.faces, mods: lido.mods, rolados, usados, subtotal, sucessos });
    total += subtotal;
  }

  let destaque: RolagemDeDados['destaque'] = null;
  const dadosDoTotal = termos.filter((t): t is TermoDeDados => t.tipo === 'dados');
  if (dadosDoTotal.length === 1 && dadosDoTotal[0].faces === 20 && !dadosDoTotal[0].sucessos && !dadosDoTotal[0].mods.includes('!')) {
    const usado = dadosDoTotal[0].rolados.filter((_, i) => dadosDoTotal[0].usados[i]);
    if (usado.length === 1) destaque = usado[0] === 20 ? 'critico' : usado[0] === 1 ? 'falha' : null;
  }

  return { tipo: 'dados', expressao: formaDaExpressao(lidos), termos, total, modo, destaque };
}

/** A expressão do jeito que aparece no cartão: sem espaços, com o sinal só onde precisa. */
function formaDaExpressao(lidos: Lido[]): string {
  return lidos
    .map((t, i) => {
      const sinal = t.sinal === -1 ? '-' : i === 0 ? '' : '+';
      return sinal + ('n' in t ? t.texto : String(t.valor));
    })
    .join('');
}

// ---------- Os outros sorteios ----------

export interface Moeda {
  tipo: 'moeda';
  resultado: 'cara' | 'coroa';
}
export interface NumeroSorteado {
  tipo: 'numero';
  min: number;
  max: number;
  valor: number;
}
export interface Escolha {
  tipo: 'escolha';
  opcoes: string[];
  escolhida: number;
}
export interface Ordem {
  tipo: 'ordem';
  itens: string[];
}
export interface Equipes {
  tipo: 'times';
  times: string[][];
}
export interface Iniciativa {
  tipo: 'iniciativa';
  entradas: { nome: string; mod: number; dado: number; total: number }[];
}

export type Dado = RolagemDeDados | Moeda | NumeroSorteado | Escolha | Ordem | Equipes | Iniciativa;

/** Inteiro de `min` a `max`, sem viés, a partir do sorteador de 1..faces. */
function inteiroEntre(min: number, max: number, sorteio: Sorteador): number {
  const faixa = max - min + 1;
  if (faixa <= LIMITES.faces) return min + sorteio(faixa) - 1;
  // faixa grande: o sorteador de 1..faces só vai até 1000, então monta o número em pedaços (rejeitando o que passa).
  while (true) {
    let n = 0;
    let base = 1;
    while (base < faixa) {
      n = n * 1000 + (sorteio(1000) - 1);
      base *= 1000;
    }
    if (n < faixa * Math.floor(base / faixa)) return min + (n % faixa);
  }
}

export function moeda(sorteio: Sorteador = sorteadorDeVerdade): Moeda {
  return { tipo: 'moeda', resultado: sorteio(2) === 1 ? 'cara' : 'coroa' };
}

export function numero(min: unknown, max: unknown, sorteio: Sorteador = sorteadorDeVerdade): NumeroSorteado {
  const a = Number(min);
  const b = Number(max);
  const limite = LIMITES.numeroMaximo;
  if (!Number.isInteger(a) || !Number.isInteger(b) || Math.abs(a) > limite || Math.abs(b) > limite) throw new ErroDeDados('Use números inteiros, até um bilhão.');
  if (a >= b) throw new ErroDeDados('O primeiro número precisa ser menor que o segundo.');
  return { tipo: 'numero', min: a, max: b, valor: inteiroEntre(a, b, sorteio) };
}

/** Limpa uma lista de nomes ou opções: sem vazios, sem repetidos, cada um com no máximo 60 caracteres. */
export function limparLista(lista: unknown, minimo: number, maximo: number, o_que: string): string[] {
  const itens = (Array.isArray(lista) ? lista : []).map((i) => String(i ?? '').trim().slice(0, LIMITES.texto)).filter((i) => i.length > 0);
  const unicos = [...new Set(itens)];
  if (unicos.length < minimo) throw new ErroDeDados(`Preciso de pelo menos ${minimo} ${o_que}.`);
  if (unicos.length > maximo) throw new ErroDeDados(`Use até ${maximo} ${o_que}.`);
  return unicos;
}

function embaralhada<T>(lista: T[], sorteio: Sorteador): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = sorteio(i + 1) - 1;
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function escolher(opcoes: unknown, sorteio: Sorteador = sorteadorDeVerdade): Escolha {
  const lista = limparLista(opcoes, 2, LIMITES.opcoes, 'opções');
  return { tipo: 'escolha', opcoes: lista, escolhida: sorteio(lista.length) - 1 };
}

export function embaralhar(itens: unknown, sorteio: Sorteador = sorteadorDeVerdade): Ordem {
  return { tipo: 'ordem', itens: embaralhada(limparLista(itens, 2, LIMITES.opcoes, 'itens'), sorteio) };
}

/** Divide as pessoas em `quantos` times do mesmo tamanho (ou com no máximo uma pessoa de diferença). */
export function dividirEmTimes(nomes: unknown, quantos: unknown, sorteio: Sorteador = sorteadorDeVerdade): Equipes {
  const lista = limparLista(nomes, 2, LIMITES.opcoes, 'nomes');
  const q = Number(quantos);
  if (!Number.isInteger(q) || q < 2 || q > LIMITES.times) throw new ErroDeDados(`Escolha de 2 a ${LIMITES.times} times.`);
  if (lista.length < q) throw new ErroDeDados('Precisa de pelo menos uma pessoa por time.');
  const times: string[][] = Array.from({ length: q }, () => []);
  embaralhada(lista, sorteio).forEach((nome, i) => times[i % q].push(nome));
  return { tipo: 'times', times };
}

/** A iniciativa: um d20 mais o modificador de cada um, do maior para o menor (empate: o maior modificador, depois sorteio). */
export function iniciativa(entradas: unknown, sorteio: Sorteador = sorteadorDeVerdade): Iniciativa {
  const bruto = Array.isArray(entradas) ? entradas : [];
  if (bruto.length < 1) throw new ErroDeDados('Preciso de pelo menos um nome.');
  if (bruto.length > LIMITES.iniciativa) throw new ErroDeDados(`Use até ${LIMITES.iniciativa} nomes.`);
  const vistos = new Set<string>();
  const lista = bruto.map((e: { nome?: unknown; mod?: unknown }) => {
    const nome = String(e?.nome ?? '').trim().slice(0, 40);
    const mod = Number(e?.mod ?? 0);
    if (!nome) throw new ErroDeDados('Todo mundo precisa de um nome.');
    if (!Number.isInteger(mod) || Math.abs(mod) > 50) throw new ErroDeDados('O modificador vai de -50 a 50.');
    if (vistos.has(nome)) throw new ErroDeDados(`O nome "${nome}" aparece duas vezes.`);
    vistos.add(nome);
    const dado = sorteio(20);
    return { nome, mod, dado, total: dado + mod, desempate: sorteio(1000) };
  });
  lista.sort((a, b) => b.total - a.total || b.mod - a.mod || b.desempate - a.desempate);
  return { tipo: 'iniciativa', entradas: lista.map(({ desempate: _d, ...resto }) => resto) };
}

// ---------- O resumo em texto ----------

/**
 * O texto da mensagem: o que aparece nas prévias, nas notificações e na busca, e o que um site antigo mostra. Para a
 * rolagem secreta ainda escondida, só diz que existe uma.
 */
export function resumoDoDado(dado: Dado): string {
  switch (dado.tipo) {
    case 'dados':
      return `🎲 ${dado.expressao} = ${dado.total}`;
    case 'moeda':
      return `🪙 ${dado.resultado === 'cara' ? 'Cara' : 'Coroa'}`;
    case 'numero':
      return `🔢 ${dado.min} a ${dado.max}: ${dado.valor}`;
    case 'escolha':
      return `🎯 ${dado.opcoes[dado.escolhida]}`;
    case 'ordem':
      return `🔀 ${dado.itens.join(', ')}`;
    case 'times':
      return `👥 ${dado.times.map((t, i) => `Time ${i + 1}: ${t.join(', ')}`).join(' · ')}`;
    case 'iniciativa':
      return `⚔️ ${dado.entradas.map((e) => `${e.nome} ${e.total}`).join(', ')}`;
  }
}

export const RESUMO_DO_SECRETO = '🎲 Rolagem secreta';

/** Todo texto que quem rola escreveu e que os outros vão ler (para a moderação da comunidade conferir). */
export function textosDoPedido(corpo: { rotulo?: unknown; opcoes?: unknown; nomes?: unknown; entradas?: unknown }): string {
  const lista = (v: unknown) => (Array.isArray(v) ? v : []).map((i) => (typeof i === 'object' && i !== null ? String((i as { nome?: unknown }).nome ?? '') : String(i ?? '')));
  return [String(corpo.rotulo ?? ''), ...lista(corpo.opcoes), ...lista(corpo.nomes), ...lista(corpo.entradas)].join(' ').trim();
}
