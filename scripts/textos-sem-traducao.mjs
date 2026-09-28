// Onde ainda há texto em português cravado no código, impossível de traduzir.
//
// POR QUE ISTO EXISTE. O Syden listava 74 idiomas e traduzia 11% da tela. Não porque as traduções
// estavam incompletas — porque a maior parte dos textos nunca foi marcada com t(), e texto não marcado
// nenhum dicionário alcança. O sintoma era cruel: a pessoa escolhia English, via metade da tela mudar,
// e concluía que o app estava quebrado.
//
// A detecção mora em scripts/lib/textos-cravados.mjs, para web/test/traducao.test.ts usar a MESMA — a
// guarda e o relatório precisam contar a mesma coisa, senão um passa e o outro reclama.
//
//   node scripts/textos-sem-traducao.mjs           só a contagem por arquivo
//   node scripts/textos-sem-traducao.mjs --tudo    cada texto, com a linha
import { porArquivo, varrerTextos } from './lib/textos-cravados.mjs';

const tudo = process.argv.includes('--tudo');
const { cravados, chaves } = varrerTextos('web/src');
const ordenados = porArquivo(cravados);

console.log(`${cravados.length} textos em português cravados no código, em ${ordenados.length} arquivos.`);
console.log(`${chaves.size} textos já marcados com t().\n`);

for (const [arquivo, quantos] of ordenados) {
  console.log(`  ${String(quantos).padStart(3)}  ${arquivo}`);
  if (tudo) {
    for (const c of cravados.filter((x) => x.arquivo === arquivo)) {
      console.log(`       ${String(c.linha).padStart(4)} [${c.tipo}] ${c.conteudo}`);
    }
  }
}

if (!tudo) console.log('\nPara ver cada um: node scripts/textos-sem-traducao.mjs --tudo');
console.log('Para o estado dos dicionários: node scripts/idiomas.mjs');
