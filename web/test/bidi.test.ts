import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { isolar, nomeDeCanal, semIsolamento } from '../src/bidi';

const ABRE = '⁨';
const FECHA = '⁩';

// O teste roda com a pasta web/ como ponto de partida, e não a raiz do repositório. Mesma conta de
// web/test/traducao.test.ts: sem isto, a busca procura web/web/src e não acha nada — o que seria pior
// do que falhar, porque uma guarda que não encontra arquivo nenhum PASSA.
const raiz = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

describe('isolar um nome que vem de fora', () => {
  it('abre e fecha — um isolamento sem fecho vaza para o resto da linha', () => {
    assert.equal(isolar('combinados'), `${ABRE}combinados${FECHA}`);
  });

  it('texto vazio não ganha marcas, para não virar dois caracteres invisíveis sozinhos', () => {
    assert.equal(isolar(''), '');
  });

  it('dá para desfazer, porque medir e comparar não é desenhar', () => {
    assert.equal(semIsolamento(isolar('bf6')), 'bf6');
  });
});

describe('o nome de um canal na tela', () => {
  // ESTE É O TESTE DO DEFEITO. Em árabe, `#` fora do isolamento é um neutro que o parágrafo reordena,
  // e a tela mostrava `combinados#`. Dentro, ele acompanha o nome.
  it('o # fica DENTRO do isolamento, nunca antes dele', () => {
    assert.equal(nomeDeCanal('combinados', true), `${ABRE}#combinados${FECHA}`);
    assert.notEqual(nomeDeCanal('combinados', true), `#${ABRE}combinados${FECHA}`);
  });

  it('sala de voz não leva #, mas leva isolamento igual', () => {
    assert.equal(nomeDeCanal('Jogatina', false), `${ABRE}Jogatina${FECHA}`);
  });
});

describe('a guarda que impede o defeito de voltar', () => {
  // O `#` escrito na CHAVE do dicionário é o que criou o problema: 'Conversar em #{nome}' põe o `#`
  // do lado de fora do que o t() substitui, e de lá não há como ele entrar no isolamento. Quem
  // escrever uma frase nova assim precisa descobrir isso aqui, e não em árabe na tela.
  it('nenhuma frase do dicionário tem # grudado num {campo}', () => {
    const culpados: string[] = [];
    for (const arquivo of readdirSync(`${raiz}i18n`)) {
      if (!arquivo.endsWith('.ts')) continue;
      const texto = readFileSync(`${raiz}i18n/${arquivo}`, 'utf8');
      for (const [linha, conteudo] of texto.split('\n').entries()) {
        if (/#\{\w+\}/.test(conteudo)) culpados.push(`i18n/${arquivo}:${linha + 1}`);
      }
    }
    assert.deepEqual(culpados, [], `o # tem que vir de nomeDeCanal(), não da frase:\n${culpados.join('\n')}`);
  });

  it('nenhuma tela monta o #canal à mão', () => {
    const culpados: string[] = [];
    const anda = (dir: string) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const caminho = `${dir}/${f.name}`;
        if (f.isDirectory()) {
          anda(caminho);
          continue;
        }
        if (!f.name.endsWith('.tsx')) continue;
        const texto = readFileSync(caminho, 'utf8');
        for (const [linha, conteudo] of texto.split('\n').entries()) {
          if (/^\s*(\/\/|\*)/.test(conteudo)) continue;
          // `url(#${id}-metal)` é referência a gradiente de SVG: o `#` ali é sintaxe de CSS, não
          // hashtag de canal, e nada disso chega aos olhos de ninguém.
          const limpo = conteudo.replace(/url\(#[^)]*\)/g, '');
          // `#${canal.name}` e `#{canal.name}` — as duas formas que existiam antes do conserto.
          if (/#\$\{|#\{\w+\.\w+\}/.test(limpo)) culpados.push(`${caminho}:${linha + 1}  ${conteudo.trim()}`);
        }
      }
    };
    anda(raiz);
    assert.deepEqual(culpados, [], `passe por nomeDeCanal():\n${culpados.join('\n')}`);
  });
});
