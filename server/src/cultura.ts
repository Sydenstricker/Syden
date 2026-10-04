/**
 * A FAIXA DE CULTURA DA HOME: imagens do país da pessoa e livros na língua dela.
 *
 * Decidido em 03/10/2026 (ver CLAUDE.md, "Culturas na home"). Três regras que este arquivo cumpre:
 *
 *   1. QUEM ESCOLHE O CONTEÚDO SÃO AS FONTES, não o Syden. As imagens vêm de "Quality images of <país>",
 *      no Wikimedia Commons — fotos e obras que a comunidade de lá avaliou e aprovou, cada uma com
 *      licença livre e autor. Os livros vêm do Gutendex (o Projeto Gutenberg), domínio público.
 *   2. O NAVEGADOR DE NINGUÉM FALA COM ELAS. É o SERVIDOR que busca a lista e as imagens, e as entrega
 *      a partir de api.syden.chat — a mesma regra da capa por endereço: uma escolha do Syden não pode
 *      fazer o navegador de todo mundo contactar um terceiro. O que sai daqui para fora é só o país e a
 *      língua ("BR", "pt"), nada de quem pediu.
 *   3. O TOM VEM DE QUAIS SEÇÕES SE LIGAM, e não de nenhuma fonte sozinha. Medido no dia em que isto
 *      foi desenhado: o "Você sabia?" da Wikipédia trazia o dono de um site pornográfico, e o "neste
 *      dia" abria com política. Ficaram de fora. E mesmo nas imagens de qualidade há um filtro pelas
 *      categorias de cada arquivo (ver FORA_DO_TOM), porque "qualidade" é fotográfica, não de assunto.
 */

import { createHash } from 'node:crypto';
import { sniffMime } from './media.js';

const UA = 'Syden/1.0 (https://syden.chat; contato@syden.chat)';
const PRAZO_MS = 12_000;
/** Seis de cada: uma faixa, não um catálogo. */
const QUANTOS = 6;
/** A seleção muda uma vez por dia; dentro do dia, todo mundo do mesmo país vê a mesma. */
const UM_DIA = 24 * 60 * 60 * 1000;

/**
 * Assuntos que não entram, lidos nas CATEGORIAS do arquivo no Commons. É uma rede grossa de propósito:
 * deixar de mostrar uma boa foto de museu custa nada, mostrar um cadáver na home custa a confiança.
 */
const FORA_DO_TOM = /nud|naked|topless|erotic|sexual|corpse|dead bod|death|war\b|wars\b|battle|weapon|firearm|military|massacre|violence|protest|riot|police|prison|blood|hunting|slaughter|politic|election/i;

export interface ImagemDaCultura {
  id: string;
  titulo: string;
  autor: string;
  licenca: string;
  /** A página do arquivo no Commons: crédito e licença completos, como a licença pede. */
  pagina: string;
}

export interface LivroDaCultura {
  id: string;
  titulo: string;
  autor: string;
  /** A página do livro no Projeto Gutenberg, onde se lê de graça. */
  pagina: string;
  temCapa: boolean;
}

export interface Cultura {
  pais: string;
  lingua: string;
  imagens: ImagemDaCultura[];
  livros: LivroDaCultura[];
}

// ---------- os guardados ----------

/** A resposta pronta de cada país+língua, por um dia. */
const respostas = new Map<string, { quando: number; cultura: Promise<Cultura> }>();

/**
 * Os arquivos (miniaturas e capas), por id. Teto de 300: são ~6+6 por país, e país novo empurra o mais
 * velho para fora. Reiniciar o servidor esvazia — o próximo pedido busca de novo, e é só isso.
 */
const arquivos = new Map<string, { origem: string; dados?: Promise<{ tipo: string; bytes: Buffer } | null> }>();
const TETO_DE_ARQUIVOS = 300;

function guardarOrigem(id: string, origem: string) {
  arquivos.delete(id);
  arquivos.set(id, { origem });
  while (arquivos.size > TETO_DE_ARQUIVOS) arquivos.delete(arquivos.keys().next().value!);
}

// ---------- utilidades ----------

/** Embaralha com uma semente: o mesmo dia dá a mesma ordem, sem guardar nada. */
function embaralhar<T>(lista: T[], semente: string): T[] {
  let h = 2166136261;
  for (const c of semente) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const semTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

async function json(url: string): Promise<unknown> {
  const resposta = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(PRAZO_MS) });
  if (!resposta.ok) throw new Error(`${resposta.status} em ${new URL(url).host}`);
  return resposta.json();
}

// ---------- imagens: Wikimedia Commons ----------

/**
 * Os nomes possíveis da categoria do país. O inglês do Commons pede artigo em alguns ("the United
 * States", "the Netherlands") e não em outros, e o nome que o Node dá às vezes traz um parêntese
 * ("Myanmar (Burma)"). Medido em 20 países; os quatro que faltavam caíram nestas duas variações.
 */
export function categoriasDoPais(pais: string): string[] {
  const nome = new Intl.DisplayNames(['en'], { type: 'region' }).of(pais) ?? pais;
  const limpo = nome.replace(/\s*\(.*\)$/, '');
  const nomes = [limpo, `the ${limpo}`];
  return [...new Set(nomes)].map((n) => `Category:Quality images of ${n}`);
}

interface PaginaDoCommons {
  title: string;
  imageinfo?: {
    thumburl?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }[];
}

async function imagensDoPais(pais: string, semente: string): Promise<ImagemDaCultura[]> {
  const api = 'https://commons.wikimedia.org/w/api.php?format=json&formatversion=2&action=query';
  for (const categoria of categoriasDoPais(pais)) {
    // Primeiro só os nomes (até 500), para sortear do conjunto inteiro e não sempre dos primeiros.
    const lista = (await json(
      `${api}&list=categorymembers&cmtype=file&cmlimit=500&cmtitle=${encodeURIComponent(categoria)}`,
    )) as { query?: { categorymembers?: { title: string }[] } };
    const titulos = (lista.query?.categorymembers ?? []).map((m) => m.title);
    if (titulos.length === 0) continue;

    // Sorteia o dobro do necessário: parte cai no filtro de tom.
    const candidatos = embaralhar(titulos, semente).slice(0, QUANTOS * 3);
    const detalhes = (await json(
      `${api}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640` +
        `&iiextmetadatafilter=LicenseShortName|Artist|ObjectName|Categories&titles=${encodeURIComponent(candidatos.join('|'))}`,
    )) as { query?: { pages?: PaginaDoCommons[] } };

    const imagens: ImagemDaCultura[] = [];
    for (const pagina of detalhes.query?.pages ?? []) {
      const info = pagina.imageinfo?.[0];
      const meta = info?.extmetadata ?? {};
      const categorias = meta.Categories?.value ?? '';
      if (!info?.thumburl || !info.descriptionurl || FORA_DO_TOM.test(categorias) || FORA_DO_TOM.test(pagina.title)) continue;
      // Só miniaturas do próprio Wikimedia (medido: hoje saem de thumb., e já saíram de upload.). O
      // endereço vem da resposta deles, mas é o servidor que vai buscá-lo, e ordem de rede vinda de
      // fora se confere.
      if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(new URL(info.thumburl).hostname)) continue;
      // Resumo do título INTEIRO: um pedaço do começo dava o mesmo id a "Igreja X 03" e "Igreja X 22".
      const id = `c-${createHash('sha256').update(pagina.title).digest('base64url').slice(0, 22)}`;
      guardarOrigem(id, info.thumburl);
      imagens.push({
        id,
        titulo: semTags(meta.ObjectName?.value ?? '') || pagina.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        autor: semTags(meta.Artist?.value ?? '') || '—',
        licenca: semTags(meta.LicenseShortName?.value ?? ''),
        pagina: info.descriptionurl,
      });
      if (imagens.length === QUANTOS) break;
    }
    return imagens;
  }
  return [];
}

// ---------- livros: Gutendex ----------

interface LivroDoGutendex {
  id: number;
  title: string;
  authors: { name: string }[];
  subjects: string[];
  copyright: boolean | null;
  formats: Record<string, string>;
}

/** "Assis, Machado de" → "Machado de Assis", que é como a capa do livro escreve. */
function autorPorExtenso(nome: string): string {
  const [sobrenome, resto] = nome.split(', ');
  return resto ? `${resto} ${sobrenome}` : nome;
}

async function livrosDaLingua(lingua: string, semente: string): Promise<LivroDaCultura[]> {
  const dados = (await json(`https://gutendex.com/books/?languages=${lingua}&sort=popular`)) as {
    results?: LivroDoGutendex[];
  };
  // Os 32 mais lidos naquela língua, sorteados por dia. Fora: o que tem direito autoral (o Gutendex
  // marca), o que não tem autor (bíblias, coletâneas anônimas) e dicionário, que não é leitura.
  const bons = (dados.results ?? []).filter(
    (l) => l.copyright === false && l.authors.length > 0 && !l.subjects.some((s) => /dictionar|grammar/i.test(s)),
  );
  return embaralhar(bons, semente)
    .slice(0, QUANTOS)
    .map((l) => {
      const id = `g-${l.id}`;
      const capa = l.formats['image/jpeg'];
      const temCapa = Boolean(capa && new URL(capa).hostname === 'www.gutenberg.org');
      if (temCapa) guardarOrigem(id, capa);
      return {
        id,
        titulo: l.title.split(/[:;]/)[0].trim(),
        autor: l.authors.map((a) => autorPorExtenso(a.name)).join(', '),
        pagina: `https://www.gutenberg.org/ebooks/${l.id}`,
        temCapa,
      };
    });
}

// ---------- o que as rotas chamam ----------

export async function culturaDe(pais: string, lingua: string): Promise<Cultura> {
  const chave = `${pais}:${lingua}`;
  const agora = Date.now();
  const guardada = respostas.get(chave);
  if (guardada && agora - guardada.quando < UM_DIA) return guardada.cultura;

  const semente = `${chave}:${new Date().toISOString().slice(0, 10)}`;
  // Uma fonte fora do ar não leva a outra junto: cada uma falha sozinha, para uma lista vazia.
  const cultura = Promise.all([
    imagensDoPais(pais, semente).catch(() => []),
    livrosDaLingua(lingua, semente).catch(() => []),
  ]).then(([imagens, livros]) => ({ pais, lingua, imagens, livros }));
  respostas.set(chave, { quando: agora, cultura });
  // Resposta VAZIA não fica guardada o dia inteiro: costuma ser fonte fora do ar, e amanhã é tarde.
  void cultura.then((c) => {
    if (c.imagens.length === 0 && c.livros.length === 0) respostas.delete(chave);
  });
  return cultura;
}

/** Uma miniatura ou capa, buscada uma vez e servida daqui. null quando não existe ou não veio. */
export async function arquivoDaCultura(id: string): Promise<{ tipo: string; bytes: Buffer } | null> {
  const guardado = arquivos.get(id);
  if (!guardado) return null;
  guardado.dados ??= (async () => {
    try {
      const resposta = await fetch(guardado.origem, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(PRAZO_MS) });
      if (!resposta.ok) return null;
      const bytes = Buffer.from(await resposta.arrayBuffer());
      // O tipo sai dos primeiros bytes, como em todo envio do Syden: o content-type é palavra de terceiro.
      const tipo = sniffMime(bytes);
      return tipo?.startsWith('image/') && bytes.length <= 2 * 1024 * 1024 ? { tipo, bytes } : null;
    } catch {
      return null;
    }
  })();
  const dados = await guardado.dados;
  if (!dados) guardado.dados = undefined; // falhou: a próxima vez tenta de novo
  return dados;
}
