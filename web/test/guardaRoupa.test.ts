import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// O CATÁLOGO DO SERVIDOR E A ARTE DO SITE TÊM DE BATER.
//
// O defeito que trouxe este arquivo: sete itens — as cores cobre, jade, ametista e prisma, e os
// fundos nebulosa, vitral e cosmos — estavam no catálogo do servidor, apareciam listados no guarda-roupa, e
// NÃO EXISTIAM em lugar nenhum da folha de estilo. Quem clicasse em "Usar" não via diferença
// nenhuma, porque a tela não tinha o que desenhar.
//
// É o preço de uma decisão boa: a arte mora no site e a lista mora no servidor, para acrescentar um
// degradê ser publicar o site em vez de migrar banco (ver web/src/guardaRoupa.ts). O que faltava era a
// conferência de que os dois lados continuam falando da mesma coisa.
//
// A busca é por TEXTO, nos arquivos, e não por import: server/src/guardaRoupa.ts é do outro workspace e
// traz consigo meia dúzia de módulos de servidor que não sobem num teste de site.

const raiz = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ler = (caminho: string) => readFileSync(`${raiz}${caminho}`, 'utf8');

const catalogoDoServidor = ler('../server/src/guardaRoupa.ts');
const guardaRoupaDoSite = ler('src/guardaRoupa.ts');
const estilos = ler('src/styles.css');
const perfil = ler('src/profileStyles.ts');

/** Os códigos que o servidor oferece, por tipo: ...livres('cor', ['a', 'b']) */
function doServidor(tipo: string): string[] {
  const codigos: string[] = [];
  for (const m of catalogoDoServidor.matchAll(/\.\.\.livres\('(\w+)',\s*\[([^\]]*)\]\)/g)) {
    if (m[1] !== tipo) continue;
    for (const c of m[2].matchAll(/'([\w-]+)'/g)) codigos.push(c[1]);
  }
  return codigos;
}

describe('o guarda-roupa oferece só o que a tela sabe desenhar', () => {
  for (const [tipo, registro] of [
    ['cor', 'CORES'],
    ['fundo', 'FUNDOS_DO_PERFIL'],
    ['moldura', 'MOLDURAS'],
  ] as const) {
    it(`${tipo}: todo código do servidor tem nome e descrição no site`, () => {
      const bloco = guardaRoupaDoSite.slice(guardaRoupaDoSite.indexOf(`export const ${registro}`));
      const faltando = doServidor(tipo).filter((codigo) => !new RegExp(`['"]?${codigo}['"]?\\s*:`).test(bloco.slice(0, bloco.indexOf('\n};'))));
      assert.deepEqual(faltando, [], `sem entrada em ${registro}: ${faltando.join(', ')}`);
    });
  }

  it('cor: toda cor tem regra no CSS', () => {
    // O prisma não é uma cor e sim uma sequência delas: ele tem bloco próprio, com gradiente
    // recortado pelo texto, então a busca aceita as duas formas.
    const faltando = doServidor('cor')
      .filter((c) => c !== 'padrao')
      .filter((c) => !estilos.includes(`[data-cor='${c}']`));
    assert.deepEqual(faltando, [], `cores sem CSS: ${faltando.join(', ')}`);
  });

  it('fundo: todo fundo tem regra no CSS', () => {
    const faltando = doServidor('fundo').filter((c) => !estilos.includes(`.fundo-${c}`));
    assert.deepEqual(faltando, [], `fundos sem CSS: ${faltando.join(', ')}`);
  });

  it('moldura: toda moldura tem o anel no CSS', () => {
    const faltando = doServidor('moldura')
      .filter((c) => c !== 'nenhuma')
      .filter((c) => !estilos.includes(`.avatar[data-moldura='${c}']`));
    assert.deepEqual(faltando, [], `molduras sem anel: ${faltando.join(', ')}`);
  });

  // O GUARDA-ROUPA NÃO É O ÚNICO LUGAR ONDE SE VESTE. As Configurações têm as mesmas listas, e elas vinham
  // de outro arquivo — dava para escolher no guarda-roupa o que não existia nas Configurações, e vice-versa.
  it('cor: a lista das Configurações cobre o catálogo', () => {
    const faltando = doServidor('cor').filter((c) => !new RegExp(`id: '${c}'`).test(perfil));
    assert.deepEqual(faltando, [], `fora de CORES_DE_NOME: ${faltando.join(', ')}`);
  });

  it('fundo: a lista das Configurações cobre o catálogo', () => {
    const faltando = doServidor('fundo').filter((c) => !new RegExp(`id: '${c}'`).test(perfil));
    assert.deepEqual(faltando, [], `fora de FUNDOS: ${faltando.join(', ')}`);
  });

  it('e o catálogo não está vazio — uma busca que não acha nada passaria calada', () => {
    assert.ok(doServidor('cor').length >= 10, `só ${doServidor('cor').length} cores lidas do servidor`);
    assert.ok(doServidor('fundo').length >= 8, `só ${doServidor('fundo').length} fundos lidos`);
    assert.ok(doServidor('moldura').length >= 6, `só ${doServidor('moldura').length} molduras lidas`);
  });
});
