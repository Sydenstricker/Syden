// Acha texto em português cravado no código, e as chaves que o t() já usa.
//
// POR QUE ISTO É UMA BIBLIOTECA E NÃO UM SCRIPT. A detecção precisa ser usada por dois lugares: o
// relatório que a gente lê (scripts/textos-sem-traducao.mjs) e a guarda que falha na integração
// (web/test/traducao.test.ts). Quando isto morava dentro do script, importá-lo executava a varredura e
// imprimia o relatório inteiro no meio do teste. É a mesma lição do e2e/csp.mjs: **regra é dado,
// conferir regra é programa.**
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Parece português?
 *
 * Serve para não acusar o que já é neutro — "OK", "id", um nome de classe CSS. Falso negativo aqui é
 * melhor que falso positivo: um texto em português sem acento que escape da lista aparece depois, quando
 * alguém olhar a tela em inglês. Já uma enxurrada de acusações falsas faria esta ferramenta ser
 * ignorada, que é o pior desfecho possível para uma guarda.
 */
export const PARECE_PORTUGUES =
  /[áàâãéêíóôõúüç]|\b(você|voce|não|nao|para|com|uma|que|sua|seu|está|sao|são|nome|senha|mensagem|canal|sala|conta|nada|ainda|sem|dos|das|pelo|pela)\b/i;

/** Atributos que viram texto na tela: dica do mouse, rótulo de leitor de tela, exemplo no campo. */
const ATRIBUTOS = /(?:title|aria-label|placeholder|alt)="([^"]{3,})"/g;

/** Texto solto entre tags: <span>Alguma coisa</span>. */
const SOLTOS = />\s*([A-ZÀ-Ú][^<>{}\n]{3,80}?)\s*</g;

/**
 * UMA PALAVRA SÓ entre tags: <h2>Comunidade</h2>.
 *
 * Precisa de regra própria porque a de cima exige que o texto PAREÇA português — e "Comunidade",
 * "Imagem", "Convite", "Membros" não têm acento nem caem na lista de palavras comuns. Vinte e dois
 * rótulos escaparam por essa fresta, e o sintoma seria o pior possível: a tela em inglês com meia
 * dúzia de títulos em português no meio, parecendo tradução malfeita em vez de tradução faltando.
 *
 * Aqui a suspeita se inverte: um rótulo de uma palavra, com inicial maiúscula, é para traduzir até
 * prova em contrário — e a prova é a lista de exceções logo abaixo.
 */
const PALAVRA_SOLTA = />\s*([A-ZÀ-Ú][A-Za-zÀ-ú]{2,30})\s*</g;

/** O que NÃO se traduz: o nome do produto, e palavras que são as mesmas em toda língua. */
const NAO_TRADUZ = new Set(['Syden', 'Discord', 'Windows', 'GIF', 'PNG', 'JPG', 'WEBP', 'Emojis', 'Soundboard']);

/** Linha de TypeScript, e não de tela: `Promise<T>` casa com a busca de palavra solta, e não é texto. */
const PARECE_TIPO = /\b(Promise|Array|Record|Map|Set|Partial|Pick|Omit)\s*</;

/**
 * Tudo o que já passa por t('...') ou está marcado com chave('...').
 *
 * O `chave()` é obrigatório aqui, e não um luxo. Onde o texto se separa do t() — um rótulo guardado numa
 * lista e desenhado com `t(aba.label)` — a tradução funciona e esta busca não vê nada. A primeira versão
 * desta ferramenta concluiu, por isso, que nove traduções boas eram lixo e mandou apagá-las. Ferramenta
 * que manda apagar o que funciona é pior do que ferramenta nenhuma, porque ela tem autoridade.
 */
const CHAMADAS_T = /\b(?:t|chave)\(\s*(['"`])((?:(?!\1).)+)\1/g;

/**
 * Varre a pasta do site.
 *
 * @param raiz onde começar (normalmente 'web/src')
 * @returns {{ cravados: {arquivo: string, linha: number, tipo: string, conteudo: string}[], chaves: Set<string> }}
 */
export function varrerTextos(raiz = 'web/src') {
  const cravados = [];
  const chaves = new Set();

  const anda = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, f.name);
      if (f.isDirectory()) {
        // O próprio i18n guarda os textos em português como CHAVE: acusá-los seria acusar o dicionário.
        if (f.name !== 'i18n') anda(caminho);
        continue;
      }
      if (!f.name.endsWith('.tsx') && !f.name.endsWith('.ts')) continue;

      const texto = readFileSync(caminho, 'utf8');

      for (const m of texto.matchAll(CHAMADAS_T)) chaves.add(m[2]);

      // Só .tsx tem tela. Um .ts pode ter chave de t(), mas não tem JSX para acusar.
      if (!f.name.endsWith('.tsx')) continue;

      const linhas = texto.split('\n');
      const linhaDe = (indice) => texto.slice(0, indice).split('\n').length;

      const vistos = new Set();
      for (const [regex, tipo] of [
        [ATRIBUTOS, 'atributo'],
        [SOLTOS, 'solto'],
        [PALAVRA_SOLTA, 'palavra'],
      ]) {
        for (const m of texto.matchAll(regex)) {
          const conteudo = m[1].trim();
          // A busca de palavra solta não exige parecer português: ver o comentário dela.
          if (tipo !== 'palavra' && !PARECE_PORTUGUES.test(conteudo)) continue;
          if (tipo === 'palavra' && NAO_TRADUZ.has(conteudo)) continue;
          const linha = linhaDe(m.index);
          const bruta = linhas[linha - 1] ?? '';
          // Comentário não vai para a tela.
          if (/^\s*(\/\/|\*|\/\*)/.test(bruta)) continue;
          if (tipo === 'palavra' && PARECE_TIPO.test(bruta)) continue;
          // A busca de frase e a de palavra se sobrepõem num texto de uma palavra só; contar duas
          // vezes inflaria a dívida e faria a catraca pedir para baixar um número que nunca desce.
          const marca = linha + '\u0000' + conteudo;
          if (vistos.has(marca)) continue;
          vistos.add(marca);
          cravados.push({ arquivo: caminho.replace(/\\/g, '/'), linha, tipo, conteudo });
        }
      }
    }
  };

  anda(raiz);
  return { cravados, chaves };
}

/** Quantos textos cravados por arquivo, do pior para o melhor. */
export function porArquivo(cravados) {
  const conta = new Map();
  for (const c of cravados) conta.set(c.arquivo, (conta.get(c.arquivo) ?? 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1]);
}
