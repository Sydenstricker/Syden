import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// ===================================================================================================
// A DATA DAS PÁGINAS LEGAIS ATRASA SOZINHA, E JÁ ATRASOU DUAS VEZES.
//
// Os termos diziam "27 de setembro" depois de mudarem no dia 2 de outubro (os 90 dias da caixa-preta).
// A privacidade dizia "28 de setembro" depois de o GIPHY entrar nela no dia 29. Em nenhum dos dois
// casos houve erro, teste vermelho ou sintoma: o texto novo publicou normalmente, com a data velha
// por cima dele.
//
// É um defeito de um tipo específico — o arquivo continua CORRETO em tudo, menos na linha que diz
// quando ele passou a ser aquilo. E é justamente a linha em que alguém de fora confia para saber se
// o que aceitou ainda vale.
//
// COMO ESTE TESTE PEGA: ele guarda o resumo (sha-256) do arquivo inteiro. Mexeu no arquivo, o resumo
// muda e o teste cai. Para fazê-lo passar é preciso vir aqui e escrever o resumo novo — e a linha de
// baixo, que fica colada nele, pergunta pela data. Não é à prova de má-fé; é à prova de esquecimento,
// que é o que de fato aconteceu as duas vezes.
// ===================================================================================================

/** O que cada página deve dizer HOJE. As duas linhas se editam juntas, sempre. */
const PAGINAS = [
  {
    arquivo: 'termos.html',
    data: '2 de outubro de 2026',
    resumo: '359407c499219984',
  },
  {
    arquivo: 'privacidade.html',
    data: '2 de outubro de 2026',
    resumo: 'deda3bdc825bcc16',
  },
];

const ler = (arquivo: string) => readFileSync(new URL(`../site/${arquivo}`, import.meta.url), 'utf8');

describe('páginas legais', () => {
  for (const pagina of PAGINAS) {
    it(`${pagina.arquivo}: a data no alto é a da última mudança`, () => {
      const texto = ler(pagina.arquivo);
      const achado = /<p class="updated">Atualizad[ao]s? em ([^<]+)<\/p>/.exec(texto);
      assert.ok(achado, `não achei a linha da data em ${pagina.arquivo}`);
      assert.equal(achado[1], pagina.data);
    });

    it(`${pagina.arquivo}: a data também aparece na lista do que mudou`, () => {
      const texto = ler(pagina.arquivo);
      const lista = texto.slice(texto.indexOf('O que mudou, e quando'));
      assert.ok(
        lista.includes(`<strong>${pagina.data}</strong>`),
        `a data do alto (${pagina.data}) não tem item na lista do fim de ${pagina.arquivo} — ` +
          'mudança sem item na lista é mudança que ninguém consegue conferir.',
      );
    });

    it(`${pagina.arquivo}: não mudou sem a data mudar junto`, () => {
      const resumo = createHash('sha256').update(ler(pagina.arquivo)).digest('hex').slice(0, 16);
      assert.equal(
        resumo,
        pagina.resumo,
        `\n\n  ${pagina.arquivo} mudou.\n\n` +
          '  ANTES de atualizar o resumo aqui, faça as duas coisas:\n' +
          '    1. troque a data no alto do arquivo pela data de hoje;\n' +
          '    2. escreva na lista "O que mudou, e quando", no fim, uma linha dizendo o que mudou.\n\n' +
          `  Depois escreva aqui: resumo: '${resumo}'\n`,
      );
    });
  }
});
