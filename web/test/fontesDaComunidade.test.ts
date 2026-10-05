import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { EFEITOS_DA_COMUNIDADE, FONTES_DA_COMUNIDADE, efeitoDaComunidade, fonteCobre, pilhaDaFonte } from '../src/fontesDaComunidade.js';

// ===================================================================================================
// A LETRA DO NOME DA COMUNIDADE.
//
// A regra que este arquivo guarda é uma só, e ela não é de gosto: NENHUMA DESTAS FONTES É BAIXADA.
//
// O caminho fácil seria o Google Fonts, e o Syden até o usa — mas só para a Noto, e só quando a
// PESSOA escolhe um idioma de escrita não latina: escolha dela, sobre o aparelho dela. Uma fonte de
// comunidade inverteria isso: quem administra escolhe, e o navegador de TODO MUNDO vai buscar o
// arquivo. Gente que hoje nunca encosta no Google passaria a encostar por decisão de outra pessoa.
//
// E há o lado que quebraria calado: fonte decorativa costuma ter só o alfabeto latino. O nome de uma
// comunidade grega, tailandesa ou árabe viraria quadradinho PARA TODO MUNDO, porque o nome é o mesmo
// para todos — escrito uma vez por quem criou, não traduzido por leitor.
// ===================================================================================================

describe('as letras da comunidade', () => {
  // A REGRA MUDOU DE FORMA, NÃO DE INTENÇÃO. Antes nenhuma fonte era baixada; agora quatro são, do
  // NOSSO domínio, porque as pilhas de sistema davam resultados diferentes em cada sistema. O que
  // continua proibido é o navegador de alguém ter de falar com um terceiro por causa disto.
  it('nenhuma pilha aponta para fora', () => {
    for (const { id, pilha } of FONTES_DA_COMUNIDADE) {
      assert.ok(!/url\(|@import|https?:/i.test(pilha), `${id} parece buscar uma fonte de fora`);
    }
  });

  it('todo @font-face vem de um caminho nosso, nunca de um endereço', () => {
    const css =
      readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8') +
      readFileSync(new URL('../src/fontes.gerado.css', import.meta.url), 'utf8') +
      readFileSync(new URL('../src/fontesDaMarca.gerado.css', import.meta.url), 'utf8');
    const blocos = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    assert.ok(blocos.length > 0, 'nenhum @font-face encontrado — o teste perdeu o alvo');
    for (const bloco of blocos) {
      for (const [, origem] of bloco.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
        assert.ok(origem.startsWith('/') || origem.startsWith('.'), `um @font-face busca de "${origem}"`);
      }
    }
  });

  // A OFL (e a Apache, de três delas) EXIGE QUE A LICENÇA ACOMPANHE A FONTE. Um .woff2 solto numa
  // pasta não é licença nenhuma, e esquecer o arquivo não daria erro em lugar nenhum.
  it('toda fonte embutida tem a licença ao lado, e ela permite embutir', () => {
    const pasta = new URL('../public/fontes/', import.meta.url);
    const familias = readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory());
    assert.ok(familias.length > 0, 'nenhuma fonte embutida — o teste perdeu o alvo');
    for (const familia of familias) {
      const arquivos = readdirSync(new URL(familia.name + '/', pasta));
      assert.ok(arquivos.some((n) => n.endsWith('.woff2')), `${familia.name} não tem fonte nenhuma`);
      assert.ok(arquivos.includes('LICENCA.txt'), `${familia.name} está sem LICENCA.txt`);
      const licenca = readFileSync(new URL(`${familia.name}/LICENCA.txt`, pasta), 'utf8');
      assert.match(licenca, /SIL Open Font License|Apache License/i, `${familia.name}: licença que não é OFL nem Apache`);
    }
    // E nenhum arquivo solto na raiz, fora das pastas: é o formato antigo, sem licença por família.
    assert.deepEqual(readdirSync(pasta).filter((n) => n.endsWith('.woff2')), []);
  });

  // QUEM DECIDE É O TEXTO, NÃO O IDIOMA DA TELA: a fonte só é oferecida se tem as letras do nome.
  it('fonte só latina não é oferecida para nome em grego, e a de sistema sempre é', () => {
    const satisfy = FONTES_DA_COMUNIDADE.find((f) => f.id === 'satisfy')!;
    const comfortaa = FONTES_DA_COMUNIDADE.find((f) => f.id === 'redonda')!;
    const serifa = FONTES_DA_COMUNIDADE.find((f) => f.id === 'serifa')!;
    assert.equal(fonteCobre(satisfy, 'Ação São João'), true);
    assert.equal(fonteCobre(satisfy, 'Αθήνα'), false);
    assert.equal(fonteCobre(comfortaa, 'Αθήνα'), true);
    assert.equal(fonteCobre(serifa, 'さくら'), true);
    // Emoji e espaço não contam: vêm de outra família de qualquer jeito.
    assert.equal(fonteCobre(satisfy, 'Turma 🎮 do Léo'), true);
  });

  // Pilha que termina num nome próprio deixa o navegador sem saída quando nenhuma das famílias
  // existe — e aí quem decide é o padrão do elemento, que pode não ser nada parecido. Terminar numa
  // família genérica é o que garante um resultado previsível em qualquer sistema.
  it('toda pilha termina numa família genérica', () => {
    const GENERICAS = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'];
    for (const { id, pilha } of FONTES_DA_COMUNIDADE) {
      if (!pilha) continue; // a padrão não tem pilha: ela é a ausência de escolha
      const ultima = pilha.split(',').pop()!.trim();
      assert.ok(GENERICAS.includes(ultima), `${id} termina em "${ultima}", que não é família genérica`);
    }
  });

  it('a padrão é a ausência de escolha, e não uma pilha', () => {
    assert.equal(FONTES_DA_COMUNIDADE[0].id, 'padrao');
    assert.equal(pilhaDaFonte('padrao'), '');
    assert.equal(pilhaDaFonte(null), '');
    assert.equal(pilhaDaFonte(undefined), '');
  });

  // O servidor pode ser mais novo que o site que a pessoa tem aberto. Código que este site não
  // conhece tem de cair na letra de sempre, nunca virar um font-family inventado.
  it('código desconhecido cai na padrão', () => {
    assert.equal(pilhaDaFonte('gotica-futurista'), '');
    assert.equal(pilhaDaFonte(''), '');
  });

  it('as conhecidas devolvem a pilha', () => {
    assert.match(pilhaDaFonte('serifa'), /serif$/);
    assert.match(pilhaDaFonte('mono'), /monospace$/);
  });

  it('nenhum id repetido', () => {
    const ids = FONTES_DA_COMUNIDADE.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

// ===================================================================================================
// O EFEITO DO NOME DA COMUNIDADE.
//
// Ele reusa os códigos dos efeitos de nome de pessoa — e esse reuso é a coisa que pode quebrar em
// silêncio. O desenho mora em `[data-efeito='…']`, no CSS; se um código daqui não existir lá, a
// pessoa escolhe o efeito, o banco guarda, e NADA acontece na tela. Sem erro em lugar nenhum.
// ===================================================================================================

describe('os efeitos da comunidade', () => {
  it('todo efeito oferecido tem desenho no CSS', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    for (const { id } of EFEITOS_DA_COMUNIDADE) {
      if (id === 'sem-efeito') continue; // a ausência de efeito não desenha nada, e está certo
      assert.ok(css.includes(`[data-efeito='${id}']`), `'${id}' não tem regra [data-efeito] no CSS`);
    }
  });

  // OS QUE MEXEM EM COR OU SOMBRA PRECISAM DE REGRA PRÓPRIA SOBRE A CAPA. Ali
  // `.sidebar-header.com-capa .sidebar-brand` força cor e sombra com três classes, e vence um
  // seletor de atributo de longe — sem a regra específica, o efeito escolhido não apareceria.
  it('os que mexem em cor ou sombra têm regra para a capa', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    for (const id of ['arco-iris', 'brilho', 'sombra']) {
      assert.ok(
        css.includes(`.sidebar-header.com-capa .sidebar-brand[data-efeito='${id}']`),
        `'${id}' muda cor ou sombra e sumiria em cima de uma capa com foto`,
      );
    }
  });

  it('não oferece os tipográficos, que brigariam com a escolha de letra', () => {
    const ids = EFEITOS_DA_COMUNIDADE.map((e) => e.id);
    for (const tipografico of ['serifa', 'mono', 'versalete']) {
      assert.ok(!ids.includes(tipografico), `'${tipografico}' faz o mesmo que a escolha de fonte`);
    }
  });

  it('a ausência de efeito não vira atributo', () => {
    assert.equal(efeitoDaComunidade('sem-efeito'), undefined);
    assert.equal(efeitoDaComunidade(null), undefined);
    assert.equal(efeitoDaComunidade('inventado'), undefined);
    assert.equal(efeitoDaComunidade('arco-iris'), 'arco-iris');
  });
});
