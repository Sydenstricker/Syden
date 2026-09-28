// O estado de cada idioma do Syden, e como acrescentar mais um sem atrito.
//
// O SYDEN LISTA 74 IDIOMAS. Manter isso honesto à mão é impossível: cada texto novo marcado com t() no
// código vira uma linha faltando em setenta e quatro arquivos, e ninguém confere setenta e quatro
// arquivos. Então a conta é feita aqui, lendo o código como fonte da verdade.
//
// A FONTE DA VERDADE É O CÓDIGO, e não um arquivo de chaves. A chave de cada texto é o próprio texto em
// português (ver web/src/i18n/index.ts), então a lista de chaves é o conjunto de t('...') que existe no
// código — não há como ela ficar desatualizada, porque ela é derivada.
//
//   node scripts/idiomas.mjs              o estado de todos
//   node scripts/idiomas.mjs --faltando en   o que falta no inglês, pronto para colar
//   node scripts/idiomas.mjs --novo fr       cria web/src/i18n/fr.ts com todas as chaves
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { varrerTextos } from './lib/textos-cravados.mjs';

const PASTA = 'web/src/i18n';

const opcao = (nome) => {
  const i = process.argv.indexOf('--' + nome);
  return i >= 0 ? process.argv[i + 1] : null;
};

const { chaves, cravados } = varrerTextos('web/src');
const todas = [...chaves].sort((a, b) => a.localeCompare(b, 'pt-BR'));

/**
 * Lê as chaves de um dicionário SEM importá-lo.
 *
 * Importar exigiria compilar TypeScript aqui dentro, e o objetivo é uma ferramenta que rode com `node`
 * puro. As chaves são lidas do texto do arquivo; basta para contar e para dizer o que falta.
 */
function chavesDoArquivo(codigo) {
  const caminho = `${PASTA}/${codigo}.ts`;
  if (!existsSync(caminho)) return null;
  const texto = readFileSync(caminho, 'utf8');
  const achadas = new Set();
  // 'chave': '...'  |  "chave": "..."  |  chave: '...' (identificador sem aspas)
  //
  // O [\wÀ-ú$] do meio é obrigatório, e custou uma investigação. `\w` é só [A-Za-z0-9_] — não inclui
  // acento. Com `[\w$]*`, a chave sem aspas `Configurações:` casava só até o "Configura" e a chave era
  // lida errada, então a ferramenta jurava que faltava traduzir uma palavra que estava ali na frente.
  for (const m of texto.matchAll(/^\s{2}(?:(['"])((?:(?!\1).)+)\1|([A-Za-zÀ-ú_$][\wÀ-ú$]*))\s*:/gm)) {
    achadas.add(m[2] ?? m[3]);
  }
  return achadas;
}

/**
 * Quais idiomas estão ligados, lendo o TRADUCOES em vez de listar a pasta.
 *
 * Ler o TRADUCOES e não a pasta é de propósito: um arquivo de dicionário que existe mas não foi
 * apontado ali não é usado pelo app, e a ferramenta tem de contar o que o app usa.
 *
 * O `=\s*\{` é importante. Com `[^{]*\{` a busca parava na primeira chave que aparece, que é a do TIPO
 * (`Promise<{ default: ... }>`), e o script passava a listar "default" como se fosse um idioma. O corte
 * tem de ser no sinal de igual — é ali que o tipo acaba e o valor começa.
 */
function idiomasLigados() {
  const texto = readFileSync(`${PASTA}/idiomas.ts`, 'utf8');
  const bloco = texto.match(/export const TRADUCOES[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  if (!bloco) return [];
  return [...bloco[1].matchAll(/^\s*([\w-]+):/gm)].map((m) => m[1]);
}

const ligados = idiomasLigados();

// --------------------------------------------------------------------------------------------------
// --novo: cria o arquivo de um idioma com TODAS as chaves, já em ordem
// --------------------------------------------------------------------------------------------------
const novo = opcao('novo');
if (novo) {
  const caminho = `${PASTA}/${novo}.ts`;
  if (existsSync(caminho)) {
    console.error(`${caminho} já existe. Use --faltando ${novo} para ver o que falta nele.`);
    process.exit(1);
  }
  const linhas = todas.map((chave) => {
    // A chave vai entre aspas simples, com escape do que precisa. Sem isto, um texto com apóstrofo
    // ("não há como") geraria arquivo que não compila — e o erro apareceria longe daqui.
    const segura = chave.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `  '${segura}': '',`;
  });
  const conteudo = `// ${novo} — dicionário do Syden.
//
// A chave é o TEXTO EM PORTUGUÊS, exatamente como aparece no código. Isso resolve três coisas de uma
// vez: o app funciona sem dicionário nenhum (é só devolver a chave), uma tradução pela metade nunca
// deixa a tela vazia — cai no português — e ninguém precisa inventar nem manter nomes de chave.
//
// **Deixe vazio o que ainda não souber traduzir.** Valor vazio é tratado como ausente, e ausente cai no
// português. Nunca copie o português para o valor: isso faria o texto parecer traduzido e escondê-lo da
// contagem de scripts/idiomas.mjs.
//
// Gerado por: node scripts/idiomas.mjs --novo ${novo}

export default {
${linhas.join('\n')}
} satisfies Record<string, string>;
`;
  writeFileSync(caminho, conteudo, 'utf8');
  console.log(`Criado ${caminho} com ${todas.length} chaves, todas vazias.`);
  console.log('');
  console.log('Falta um passo, e é uma linha. Em web/src/i18n/idiomas.ts, dentro de TRADUCOES:');
  console.log('');
  console.log(`  ${novo}: () => import('./${novo}'),`);
  console.log('');
  console.log(`E confira que o código "${novo}" está na lista IDIOMAS do mesmo arquivo, com a escrita certa.`);
  process.exit(0);
}

// --------------------------------------------------------------------------------------------------
// --faltando: o que falta num idioma, pronto para colar
// --------------------------------------------------------------------------------------------------
const faltando = opcao('faltando');
if (faltando) {
  const tem = chavesDoArquivo(faltando);
  if (!tem) {
    console.error(`Não existe ${PASTA}/${faltando}.ts. Crie com: node scripts/idiomas.mjs --novo ${faltando}`);
    process.exit(1);
  }
  const ausentes = todas.filter((c) => !tem.has(c));
  const sobrando = [...tem].filter((c) => !chaves.has(c));

  console.log(`${faltando}: ${todas.length - ausentes.length} de ${todas.length} chaves.\n`);
  if (ausentes.length) {
    console.log(`FALTAM ${ausentes.length}, para colar no arquivo:\n`);
    for (const c of ausentes) console.log(`  '${c.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}': '',`);
  }
  if (sobrando.length) {
    console.log(`\nSOBRAM ${sobrando.length} — estão no dicionário e não existem mais no código.`);
    console.log('Estas não fazem nada, e enganam a contagem. Apague:\n');
    for (const c of sobrando) console.log(`  ${c}`);
  }
  process.exit(0);
}

// --------------------------------------------------------------------------------------------------
// o estado de todos
// --------------------------------------------------------------------------------------------------
console.log(`${todas.length} textos marcados com t() no código.`);
console.log(`${cravados.length} textos ainda cravados, que nenhum dicionário alcança.\n`);

const pct = (a, b) => (b === 0 ? '—' : `${Math.round((a / b) * 100)}%`);

console.log('  idioma  traduzidos  vazios  sobrando  cobertura');
for (const codigo of ligados) {
  const tem = chavesDoArquivo(codigo);
  if (!tem) {
    console.log(`  ${codigo.padEnd(7)} SEM ARQUIVO — está em TRADUCOES e o arquivo não existe`);
    continue;
  }
  const texto = readFileSync(`${PASTA}/${codigo}.ts`, 'utf8');
  // Valor vazio conta como não traduzido: é o que o dicionário gerado por --novo escreve.
  const vazios = [...texto.matchAll(/:\s*''\s*,/g)].length;
  const presentes = [...tem].filter((c) => chaves.has(c)).length;
  const traduzidos = presentes - vazios;
  const sobrando = tem.size - presentes;
  console.log(
    `  ${codigo.padEnd(7)} ${String(traduzidos).padStart(10)} ${String(vazios).padStart(7)} ${String(sobrando).padStart(9)}  ${pct(traduzidos, todas.length)}`,
  );
}

console.log('');
console.log('Acrescentar um idioma:   node scripts/idiomas.mjs --novo <codigo>');
console.log('Ver o que falta em um:   node scripts/idiomas.mjs --faltando <codigo>');
console.log('Onde ainda falta marcar: node scripts/textos-sem-traducao.mjs');
