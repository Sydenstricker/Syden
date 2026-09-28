import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Variável de CSS que nunca foi definida NÃO DÁ ERRO: o navegador descarta a regra inteira, em silêncio.
// A tela continua abrindo, só que sem borda, sem fundo — ou transparente, com o texto por cima do que
// estiver atrás. Foi assim que o painel do karaokê virou letra flutuando sobre o rosto das pessoas, e
// assim que os cartões da loja ficaram sem fundo sem ninguém notar por dias.
//
// Nenhuma ferramenta reclama disso, então o teste reclama.

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

/** Variáveis que não são definidas no CSS porque chegam prontas do React, em `style={{...}}`. */
const VINDAS_DO_APP = new Set(['--card-width']);

function definidasEm(trecho: string): Set<string> {
  return new Set([...trecho.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));
}

test('toda variável usada no CSS existe de verdade', () => {
  const definidas = definidasEm(css);
  const usadas = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  const fantasmas = [...usadas].filter((v) => !definidas.has(v) && !VINDAS_DO_APP.has(v));
  assert.deepEqual(fantasmas, [], 'usadas e nunca definidas: ' + fantasmas.join(', '));
});

// Cor definida só no tema escuro fica com o valor do escuro no tema claro — um painel preto no meio de
// uma tela branca. As exceções são de propósito e estão listadas abaixo.
test('toda cor do tema escuro tem o par dela no tema claro', () => {
  const inicioClaro = css.indexOf(":root[data-theme='light']");
  assert.ok(inicioClaro > 0, 'não achei o bloco do tema claro');

  const noEscuro = definidasEm(css.slice(css.indexOf(':root {'), inicioClaro));
  const noClaro = definidasEm(css.slice(inicioClaro));

  // Estas valem nos dois temas de propósito: medidas não têm cor, e o escurecido fica por cima de
  // VÍDEO, que é escuro nos dois casos.
  //
  // As larguras das barras entram aqui pelo mesmo motivo das outras medidas — e por um a mais: elas são
  // ajuste de ACESSIBILIDADE (ver larguras.ts). Quem alargou a barra de canais porque enxerga melhor
  // assim alargou-a para sempre, não para o tema escuro.
  const IGUAIS_NOS_DOIS = new Set([
    '--radius',
    '--overlay',
    '--overlay-strong',
    '--shadow',
    '--largura-sidebar',
    '--largura-membros',
  ]);

  const soNoEscuro = [...noEscuro].filter((v) => !noClaro.has(v) && !IGUAIS_NOS_DOIS.has(v));
  assert.deepEqual(soNoEscuro, [], 'sem par no tema claro: ' + soNoEscuro.join(', '));
});
