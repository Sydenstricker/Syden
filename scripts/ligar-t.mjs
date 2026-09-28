// Põe `const t = useT()` nos componentes que passaram a usar t(), e o import de quem não tinha.
//
// É a segunda metade de scripts/marcar-textos.mjs. Aquele envolve os textos; este faz o t() existir.
//
// POR QUE SÃO DUAS FERRAMENTAS. Porque a lista de onde falta não é adivinhada: ela vem do `tsc`, que
// aponta linha por linha cada "Cannot find name 't'". Adivinhar em qual das cinco funções de um arquivo
// cada texto mora exige entender o código; ler o compilador, não.
//
// A REGRA DO HOOK É RESPEITADA, e é o único cuidado que importa aqui. `useT()` é um hook do React: só
// pode ser chamado dentro de um componente. Então o script só mexe em função com Nome Maiúsculo — que é
// como componente se escreve — e RECUSA o resto, listando para a mão. Enfiar hook numa função auxiliar
// não dá erro de compilação: dá erro em tempo de execução, na cara da pessoa, e só naquela tela.
//
//   cd web && npx tsc --noEmit > ../erros.txt ; cd ..
//   node scripts/ligar-t.mjs erros.txt
import { readFileSync, writeFileSync } from 'node:fs';

const arquivoDeErros = process.argv[2];
if (!arquivoDeErros) {
  console.error('Uso: node scripts/ligar-t.mjs <saída do tsc>');
  process.exit(1);
}

/** src/Algo.tsx(114,62): error TS2304: Cannot find name 't'. */
const ERRO = /^(src[/\\][^(]+)\((\d+),\d+\): error TS2304: Cannot find name 't'\./;

const porArquivo = new Map();
for (const linha of readFileSync(arquivoDeErros, 'utf8').split('\n')) {
  const m = linha.match(ERRO);
  if (!m) continue;
  const caminho = 'web/' + m[1].replace(/\\/g, '/');
  if (!porArquivo.has(caminho)) porArquivo.set(caminho, new Set());
  porArquivo.get(caminho).add(Number(m[2]));
}

/** Onde cada função começa: número da linha -> { nome, indentacao }. */
function acharFuncoes(linhas) {
  const inicios = [];
  const padroes = [
    /^(\s*)export function ([A-Za-z_$][\w$]*)\s*\(/,
    /^(\s*)function ([A-Za-z_$][\w$]*)\s*\(/,
    /^(\s*)export const ([A-Za-z_$][\w$]*)\s*=\s*\(/,
    /^(\s*)const ([A-Za-z_$][\w$]*)\s*=\s*\(/,
  ];
  linhas.forEach((linha, i) => {
    for (const p of padroes) {
      const m = linha.match(p);
      if (m) {
        inicios.push({ linha: i + 1, nome: m[2], indentacao: m[1].length });
        break;
      }
    }
  });
  return inicios;
}

/**
 * Qual COMPONENTE contém esta linha.
 *
 * Não é a função mais interna, e essa distinção é o miolo desta ferramenta. Um texto muitas vezes está
 * dentro de uma função aninhada — `grid()` dentro do VoiceStage, `load()` dentro do UsageDashboard — e o
 * hook não pode ir ali: hook só vive em componente. Mas nem precisa. Basta o componente de fora ter
 * `const t = useT()`, e o `t` chega ao aninhado por fechamento, de graça.
 *
 * Então a busca anda de baixo para cima e pega a primeira função com Nome Maiúsculo. Na primeira versão
 * eu pegava a mais interna e o script recusava 102 casos que não tinham nada de errado.
 */
function componenteDe(inicios, linha) {
  const antes = inicios.filter((f) => f.linha <= linha);
  for (let i = antes.length - 1; i >= 0; i--) {
    if (/^[A-Z]/.test(antes[i].nome)) return antes[i];
  }
  return null;
}

/**
 * Onde acaba a lista de parâmetros e começa o corpo.
 *
 * Um componente React tem assinatura longa, com objeto desestruturado e tipo, quebrada em muitas linhas.
 * Contar chaves é o único jeito confiável de achar o `{` que abre o corpo — procurar por "{" na primeira
 * linha pegaria a chave do parâmetro desestruturado, e o hook entraria no meio da assinatura.
 */
function inicioDoCorpo(linhas, daLinha) {
  let parenteses = 0;
  let viParentese = false;
  for (let i = daLinha - 1; i < Math.min(linhas.length, daLinha + 80); i++) {
    const linha = linhas[i];
    for (let j = 0; j < linha.length; j++) {
      const c = linha[j];
      if (c === '(') {
        parenteses++;
        viParentese = true;
      } else if (c === ')') {
        parenteses--;
      } else if (c === '{' && viParentese && parenteses === 0) {
        // A chave depois de os parênteses fecharem é a do corpo — desde que a linha acabe aqui perto.
        if (linha.slice(j + 1).trim() === '') return i + 1;
      }
    }
  }
  return null;
}

let mexidos = 0;
const recusados = [];

for (const [caminho, linhasComErro] of porArquivo) {
  let texto = readFileSync(caminho, 'utf8');
  let linhas = texto.split('\n');
  const inicios = acharFuncoes(linhas);

  // Quais componentes precisam do hook, sem repetir.
  const precisam = new Map();
  for (const linha of [...linhasComErro].sort((a, b) => a - b)) {
    const f = componenteDe(inicios, linha);
    if (!f) {
      recusados.push(`${caminho}:${linha} — não achei nenhum componente em volta desta linha. Precisa de mão.`);
      continue;
    }
    precisam.set(f.nome, f);
  }

  // De baixo para cima: inserir linha muda a numeração do que está abaixo.
  const ordenados = [...precisam.values()].sort((a, b) => b.linha - a.linha);
  for (const f of ordenados) {
    const corpo = inicioDoCorpo(linhas, f.linha);
    if (corpo === null) {
      recusados.push(`${caminho}: não achei o começo do corpo de ${f.nome}()`);
      continue;
    }
    // Já tem?
    const trecho = linhas.slice(corpo, corpo + 6).join('\n');
    if (/const t = useT\(\)/.test(trecho)) continue;
    linhas.splice(corpo, 0, ' '.repeat(f.indentacao + 2) + 'const t = useT();');
    mexidos++;
  }

  texto = linhas.join('\n');

  // O import, se faltar. Vai depois do último import, para não cair no meio de um bloco de tipos.
  if (!/from '\.\/i18n'|from '\.\.\/i18n'/.test(texto)) {
    const profundidade = caminho.split('/').length - 3; // web/src/X.tsx = 0
    const de = profundidade > 0 ? '../'.repeat(profundidade) + 'i18n' : './i18n';
    const imports = [...texto.matchAll(/^import .*;$/gm)];
    if (imports.length === 0) {
      recusados.push(`${caminho}: não achei nenhum import para pôr o useT ao lado`);
    } else {
      const ultimo = imports[imports.length - 1];
      const fim = ultimo.index + ultimo[0].length;
      texto = texto.slice(0, fim) + `\nimport { useT } from '${de}';` + texto.slice(fim);
    }
  } else if (!/\buseT\b/.test(texto.split('\n').filter((l) => l.startsWith('import')).join('\n'))) {
    // Já importa algo do i18n, mas não o useT.
    texto = texto.replace(/^import \{([^}]*)\} from ('(?:\.\.?\/)*i18n');$/m, (inteiro, dentro, onde) => {
      const nomes = dentro.split(',').map((s) => s.trim()).filter(Boolean);
      if (!nomes.includes('useT')) nomes.push('useT');
      return `import { ${nomes.sort().join(', ')} } from ${onde};`;
    });
  }

  writeFileSync(caminho, texto);
}

console.log(`${mexidos} componentes ganharam o const t = useT().`);
if (recusados.length) {
  console.log('\nRECUSADOS de propósito — hook fora de componente é erro de execução, não de compilação:');
  for (const r of recusados) console.log('  ' + r);
}
console.log('\nRode o tsc de novo: o que sobrar é o que precisa de mão.');
