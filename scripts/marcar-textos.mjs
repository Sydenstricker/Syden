// Envolve com t() os textos em português que um arquivo tem cravados.
//
// POR QUE UMA FERRAMENTA, E NÃO À MÃO. São 200 e tantas substituições em 44 arquivos. À mão, a taxa de
// erro não é zero, e os erros são do tipo silencioso: um apóstrofo sem escape quebra o arquivo (isso o
// compilador pega), mas trocar o texto errado, ou trocar metade de uma frase, passa direto — e só
// aparece quando alguém escolhe outro idioma e vê meia frase traduzida.
//
// O QUE ELA NÃO FAZ, de propósito: não acrescenta `const t = useT()` nos componentes. Descobrir em qual
// das cinco funções de um arquivo cada texto está exige entender o código, e adivinhar isso escreveria
// hook em lugar errado — que é erro de execução, não de compilação. Depois de rodar, o `tsc` aponta cada
// lugar onde falta, e aí é uma linha em cada.
//
//   node scripts/marcar-textos.mjs web/src/SettingsModal.tsx
//   node scripts/marcar-textos.mjs web/src/SettingsModal.tsx --ver   (mostra e não escreve)
import { readFileSync, writeFileSync } from 'node:fs';
import { varrerTextos } from './lib/textos-cravados.mjs';

const alvo = process.argv[2];
const sóVer = process.argv.includes('--ver');
if (!alvo) {
  console.error('Diga o arquivo: node scripts/marcar-textos.mjs web/src/Algo.tsx');
  process.exit(1);
}

const normal = alvo.replace(/\\/g, '/');
const { cravados } = varrerTextos('web/src');
const meus = cravados.filter((c) => c.arquivo.replace(/\\/g, '/').endsWith(normal.replace(/^.*web\/src/, 'web/src')));

if (meus.length === 0) {
  console.log(`Nada cravado em ${normal}. Ou já está marcado, ou o caminho está diferente.`);
  process.exit(0);
}

let texto = readFileSync(normal, 'utf8');

/** Escapa para caber dentro de t('...'). Um apóstrofo sem isto quebra o arquivo. */
const paraChave = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const paraRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let trocadas = 0;
const naoDeu = [];

/**
 * A substituição é no ARQUIVO INTEIRO, e não linha por linha.
 *
 * A primeira versão trabalhava na linha onde o texto foi achado, e falhava em dezesseis dos trinta e oito
 * casos do SettingsModal — todos do formato mais comum que existe num formulário:
 *
 *   <label>
 *     Nome
 *     <input … />
 *   </label>
 *
 * Aqui o texto está numa linha, o `>` que o abre está na anterior e o `<` que o fecha na seguinte.
 * Procurando dentro de uma linha só, nada casa. O `[\s\S]*?` atravessa a quebra de linha e resolve.
 */
const jaFeitos = new Set();
for (const c of meus) {
  if (jaFeitos.has(c.tipo + '\u0000' + c.conteudo)) continue;
  jaFeitos.add(c.tipo + '\u0000' + c.conteudo);

  const chave = paraChave(c.conteudo);
  const antes = texto;

  if (c.tipo === 'atributo') {
    // title="Texto"  ->  title={t('Texto')}
    texto = texto.replace(
      new RegExp(`((?:title|aria-label|placeholder|alt)=)"${paraRegex(c.conteudo)}"`, 'g'),
      `$1{t('${chave}')}`,
    );
  } else {
    // Texto solto entre tags. O espaçamento em volta é preservado: mexer nele mudaria o desenho.
    texto = texto.replace(new RegExp(`(>[\\s]*)${paraRegex(c.conteudo)}([\\s]*<)`, 'g'), `$1{t('${chave}')}$2`);
  }

  if (texto === antes) naoDeu.push(c);
  else trocadas++;
}

console.log(`${normal}: ${trocadas} de ${jaFeitos.size} textos distintos marcados.`);
if (naoDeu.length) {
  console.log('\nEstes precisam de mão (dentro de expressão, ou partidos por outra tag no meio):');
  for (const c of naoDeu) console.log(`  ${String(c.linha).padStart(4)} [${c.tipo}] ${c.conteudo}`);
}

if (sóVer) {
  console.log('\n--ver: nada foi escrito.');
  process.exit(0);
}

if (trocadas > 0) {
  writeFileSync(normal, texto);
  console.log('\nEscrito. Agora rode `npx tsc --noEmit` em web/ — ele aponta onde falta `const t = useT()`.');
}
