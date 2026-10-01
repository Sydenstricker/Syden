// Mede, no navegador de verdade, se o `#` fica do lado certo do nome do canal quando a tela está em
// árabe.
//
// POR QUE ESTE TESTE NÃO ABRE O SYDEN. Porque o que está sendo medido não é o Syden: é o algoritmo
// bidirecional do Unicode dentro do Chromium. A pergunta é "um `#` solto antes de um nome latino,
// dentro de um parágrafo árabe, aparece à esquerda ou à direita do nome?" — e ela se responde com uma
// página de dez linhas, sem servidor, sem conta e sem banco. Abrir o app inteiro para medir isto
// custaria um cadastro real e mediria a mesma coisa.
//
// A MEDIDA É A POSIÇÃO HORIZONTAL DO GLIFO, e não o texto. O texto nunca muda de ordem: `#combinados`
// continua `#combinados` em memória, em qualquer idioma. O que muda é onde o navegador DESENHA cada
// caractere, e isso só se descobre perguntando ao navegador onde ele desenhou. É para isso que existe
// Range.getBoundingClientRect.
//
// O teste mede os dois casos de propósito — sem o conserto e com ele. Um teste que só mede o caminho
// certo não prova que ele é diferente do errado: prova só que ele não quebrou.
import { abrirNavegador, falhou, ok, resumo } from './ajuda.mjs';

const ABRE = '⁨'; // FSI
const FECHA = '⁩'; // PDI

const { browser } = await abrirNavegador({ viewport: { width: 800, height: 400 } });
const page = await browser.newPage();

// A frase é a de verdade: a tradução árabe de 'Bem-vindo a {nome}!' que está em web/src/i18n/ar.ts.
const FRASE_ARABE = 'أهلًا بك في ';

await page.setContent(`<!doctype html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8" /><style>body{font-size:24px;font-family:sans-serif;margin:0;padding:20px}</style></head>
  <body>
    <h2 id="sem">${FRASE_ARABE}#combinados!</h2>
    <h2 id="com">${FRASE_ARABE}${ABRE}#combinados${FECHA}!</h2>
  </body>
</html>`);

/**
 * Onde o navegador desenhou um caractere, pelo índice dele no texto.
 *
 * Um Range de um caractere só, e o retângulo que ele ocupa na tela. É a única forma de saber a ordem
 * VISUAL: a ordem lógica do texto não mudou, e é justamente por isso que o defeito existia.
 */
async function xDoCaractere(id, procurado) {
  return page.evaluate(
    ([id, procurado]) => {
      const no = document.getElementById(id).firstChild;
      const i = no.textContent.indexOf(procurado);
      if (i < 0) return null;
      const r = document.createRange();
      r.setStart(no, i);
      r.setEnd(no, i + 1);
      const caixa = r.getBoundingClientRect();
      return caixa.left + caixa.width / 2;
    },
    [id, procurado],
  );
}

for (const [id, rotulo] of [
  ['sem', 'sem o isolamento (como era antes)'],
  ['com', 'com o isolamento (como é agora)'],
]) {
  const cerquilha = await xDoCaractere(id, '#');
  const primeiraLetra = await xDoCaractere(id, 'c');
  const ultimaLetra = await xDoCaractere(id, 's');
  if (cerquilha === null || primeiraLetra === null || ultimaLetra === null) {
    falhou(`${rotulo}: não achei os caracteres na página`);
    continue;
  }

  // O nome é latino, então ele é desenhado da esquerda para a direita: o "c" de "combinados" fica à
  // esquerda do "s" final. O `#` pertence ao começo do nome, logo tem que ficar à esquerda do "c".
  const nomeVaiParaDireita = primeiraLetra < ultimaLetra;
  const cerquilhaAntesDoNome = cerquilha < primeiraLetra;

  console.log(
    `  ${rotulo}:  # em x=${cerquilha.toFixed(0)}  ·  c em x=${primeiraLetra.toFixed(0)}  ·  s em x=${ultimaLetra.toFixed(0)}`,
  );

  if (!nomeVaiParaDireita) {
    falhou(`${rotulo}: o nome latino não está da esquerda para a direita — a medição não serve`);
    continue;
  }

  if (id === 'sem') {
    cerquilhaAntesDoNome
      ? falhou('o defeito não se reproduz: sem o isolamento o # já ficava no lugar certo')
      : ok('o defeito está medido: sem o isolamento, o árabe joga o # para DEPOIS do nome (combinados#)');
  } else {
    cerquilhaAntesDoNome
      ? ok('com o isolamento, o # fica ANTES do nome, como se escreve (#combinados)')
      : falhou('o isolamento não resolveu: o # continua depois do nome');
  }
}

await page.screenshot({ path: 'e2e/fotos/bidi-do-arabe.png' });
await browser.close();
resumo('o # do canal em árabe');
