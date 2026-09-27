// Onde ainda há texto em português cravado no código, impossível de traduzir.
//
// POR QUE ISTO EXISTE. O Syden listava 74 idiomas e traduzia 11% da tela. Não porque as traduções
// estavam incompletas — porque a maior parte dos textos nunca foi marcada com t(), e texto não
// marcado nenhum dicionário alcança. O sintoma era cruel: a pessoa escolhia English, via metade da
// tela mudar, e concluía que o app estava quebrado.
//
// Este script acha o que falta e serve para duas coisas: como lista de trabalho enquanto se traduz,
// e como guarda depois — web/test/traducao.test.ts falha se o número voltar a subir.
//
//   node scripts/textos-sem-traducao.mjs           só a contagem por arquivo
//   node scripts/textos-sem-traducao.mjs --tudo    cada texto, com a linha
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = 'web/src';

/**
 * Parece português?
 *
 * Serve para não acusar o que já é neutro — "OK", "id", um nome de classe CSS. Falso negativo aqui
 * é melhor que falso positivo: um texto em português sem acento que escape da lista aparece depois,
 * quando alguém olhar a tela em inglês. Já uma enxurrada de acusações falsas faria esta ferramenta
 * ser ignorada, que é o pior desfecho possível para uma guarda.
 */
const PARECE_PORTUGUES =
  /[áàâãéêíóôõúüç]|\b(você|voce|não|nao|para|com|uma|que|sua|seu|está|sao|são|nome|senha|mensagem|canal|sala|conta|nada|ainda|sem|dos|das|pelo|pela)\b/i;

/** Atributos que viram texto na tela: dica do mouse, rótulo de leitor de tela, exemplo no campo. */
const ATRIBUTOS = /(?:title|aria-label|placeholder|alt)="([^"]{3,})"/g;

/** Texto solto entre tags: <span>Alguma coisa</span>. */
const SOLTOS = />\s*([A-ZÀ-Ú][^<>{}\n]{3,80}?)\s*</g;

const tudo = process.argv.includes('--tudo');
const achados = [];

function varrer(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, f.name);
    if (f.isDirectory()) {
      // O próprio i18n guarda os textos em português como CHAVE: acusá-los seria acusar o dicionário.
      if (f.name !== 'i18n') varrer(caminho);
      continue;
    }
    if (!f.name.endsWith('.tsx')) continue;

    const texto = readFileSync(caminho, 'utf8');
    const linhas = texto.split('\n');
    const linhaDe = (indice) => texto.slice(0, indice).split('\n').length;

    for (const [regex, tipo] of [
      [ATRIBUTOS, 'atributo'],
      [SOLTOS, 'solto'],
    ]) {
      for (const m of texto.matchAll(regex)) {
        const conteudo = m[1].trim();
        if (!PARECE_PORTUGUES.test(conteudo)) continue;
        const linha = linhaDe(m.index);
        // Comentário não vai para a tela.
        const bruta = linhas[linha - 1] ?? '';
        if (/^\s*(\/\/|\*|\/\*)/.test(bruta)) continue;
        achados.push({ arquivo: caminho.replace(/\\/g, '/'), linha, tipo, conteudo });
      }
    }
  }
}

varrer(RAIZ);

const porArquivo = new Map();
for (const a of achados) porArquivo.set(a.arquivo, (porArquivo.get(a.arquivo) ?? 0) + 1);

const ordenados = [...porArquivo.entries()].sort((a, b) => b[1] - a[1]);

console.log(`${achados.length} textos em português cravados no código, em ${porArquivo.size} arquivos.\n`);
for (const [arquivo, quantos] of ordenados) {
  console.log(`  ${String(quantos).padStart(3)}  ${arquivo}`);
  if (tudo) {
    for (const a of achados.filter((x) => x.arquivo === arquivo)) {
      console.log(`       ${String(a.linha).padStart(4)} [${a.tipo}] ${a.conteudo}`);
    }
  }
}

if (!tudo) console.log('\nPara ver cada um: node scripts/textos-sem-traducao.mjs --tudo');

export { achados };
