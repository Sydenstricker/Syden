import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
// @ts-expect-error — biblioteca em .mjs, sem tipos; é ferramenta de build, não código do app.
import { porArquivo, varrerTextos } from '../../scripts/lib/textos-cravados.mjs';

/**
 * A GUARDA DA TRADUÇÃO.
 *
 * O Syden lista 74 idiomas. Uma dívida como essa não se paga de uma vez — se paga aos poucos, e o que
 * mata o "aos poucos" é ela crescer enquanto se paga. Cada tela nova escrita em português cravado
 * acrescenta trabalho a setenta e quatro arquivos, e ninguém percebe até alguém escolher English e ver
 * meia tela mudar.
 *
 * Então o número é uma CATRACA: pode descer, nunca subir. Quando desce, este teste falha pedindo para
 * baixar a marca — e isso é de propósito, não é chatice. Catraca que não é apertada volta a folgar.
 */

const raiz = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pastaI18n = `${raiz}i18n/`;
const { cravados, chaves } = varrerTextos(raiz);

/**
 * Quantos textos em português ainda estão cravados no código.
 *
 * **Para baixar este número:** marque textos com t() e rode `node scripts/textos-sem-traducao.mjs` para
 * ver o novo total. Para subi-lo não há motivo legítimo — texto novo já nasce marcado.
 *
 * ELE VOLTOU DE 0 PARA 427 NUM DIA, E A DÍVIDA NÃO CRESCEU: a medição é que passou a enxergar.
 * A catraca marcava zero porque a busca tinha dois buracos, e os dois estavam escritos nela mesma.
 * O primeiro: `[^<>{}\n]` exclui a chave, então tudo que morasse dentro de `{…}` era invisível — e é
 * ali que vive o ternário, que é como metade dos rótulos de tela se escreve. O segundo: entre tags,
 * exigia-se que o texto "parecesse" português, por uma lista de vinte e tantas palavras; "Selo da
 * comunidade" não tem acento e não usa nenhuma delas.
 *
 * O resultado foi uma catraca em zero e uma tradução declarada em 100% com quatrocentas e vinte e
 * sete frases em português na tela de quem escolheu coreano. Guarda que mede a coisa errada é pior
 * do que guarda nenhuma, porque ela tranquiliza.
 */
const CATRACA = 371;

describe('a dívida da tradução não cresce', () => {
  it(`há no máximo ${CATRACA} textos cravados`, () => {
    const piores = porArquivo(cravados)
      .slice(0, 5)
      .map(([a, n]) => `${n} em ${a.replace(/.*web[/\\]src/, 'web/src')}`)
      .join(', ');
    assert.ok(
      cravados.length <= CATRACA,
      `Subiu para ${cravados.length} (a marca é ${CATRACA}). Texto novo tem de nascer marcado com t().\n` +
        `  Onde está pior: ${piores}\n` +
        '  Para ver tudo: node scripts/textos-sem-traducao.mjs --tudo',
    );
  });

  it('e quando cai, a marca acompanha', () => {
    assert.ok(
      cravados.length >= CATRACA,
      `Caiu para ${cravados.length}. Ótimo — agora baixe CATRACA para ${cravados.length} neste arquivo, ` +
        'senão a catraca volta a folgar e o número pode subir de novo sem ninguém ver.',
    );
  });
});

/** Os idiomas que o app realmente carrega, lidos do TRADUCOES e não da pasta. */
function idiomasLigados(): string[] {
  const texto = readFileSync(`${pastaI18n}idiomas.ts`, 'utf8');
  // O corte é no `=`, e não na primeira chave: a primeira chave pertence ao TIPO
  // (Promise<{ default: … }>), e cortar ali fazia "default" aparecer como se fosse idioma.
  const bloco = texto.match(/export const TRADUCOES[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  assert.ok(bloco, 'não achei o TRADUCOES em i18n/idiomas.ts');
  return [...bloco[1].matchAll(/^\s*([\w-]+):/gm)].map((m) => m[1]);
}

function chavesDoDicionario(codigo: string): Set<string> {
  const texto = readFileSync(`${pastaI18n}${codigo}.ts`, 'utf8');
  const achadas = new Set<string>();
  // O [\wÀ-ú$] importa: `\w` não inclui acento, e sem ele a chave sem aspas `Configurações:` era lida
  // como "Configura" — e a ferramenta dizia que faltava traduzir uma palavra que já estava traduzida.
  for (const m of texto.matchAll(/^\s{2}(?:(['"])((?:(?!\1).)+)\1|([A-Za-zÀ-ú_$][\wÀ-ú$]*))\s*:/gm)) {
    achadas.add(m[2] ?? m[3]);
  }
  return achadas;
}

describe('os dicionários batem com o código', () => {
  const ligados = idiomasLigados();

  it('há pelo menos um idioma ligado', () => {
    assert.ok(ligados.length > 0, 'nenhum idioma em TRADUCOES');
  });

  for (const codigo of idiomasLigados()) {
    it(`${codigo}: o arquivo existe`, () => {
      // Um idioma em TRADUCOES sem arquivo não dá erro na hora do build: dá erro no navegador de quem
      // escolher aquele idioma, e a tela fica em português para sempre sem ninguém saber por quê.
      assert.ok(existsSync(`${pastaI18n}${codigo}.ts`), `${codigo} está em TRADUCOES e ${codigo}.ts não existe`);
    });

    it(`${codigo}: não guarda tradução de texto que não existe mais`, () => {
      // Chave órfã não quebra nada — e é justamente por isso que ela fica. O custo aparece depois: ela
      // conta como trabalho feito nos relatórios, e alguém traduz setenta e quatro idiomas de um texto
      // que ninguém mais vê. Onde o texto se separa do t(), ele tem de ir marcado com chave().
      const sobrando = [...chavesDoDicionario(codigo)].filter((c) => !chaves.has(c));
      assert.deepEqual(
        sobrando,
        [],
        `${codigo} tem ${sobrando.length} chave(s) que o código não usa mais. ` +
          `Confira com: node scripts/idiomas.mjs --faltando ${codigo}`,
      );
    });
  }
});

describe('tradução vazia cai no português', () => {
  it('valor vazio no dicionário não apaga o texto da tela', () => {
    // ISTO PEGA UM DEFEITO REAL QUE EXISTIU. O t() usava `dicionario[texto] ?? texto`, e `??` só cobre
    // ausente — string vazia passa direto. O esqueleto de um idioma novo (--novo xx) nasce com todas as
    // chaves presentes e vazias, de propósito, para servir de lista de trabalho. Com `??`, escolher esse
    // idioma apagaria o texto de tudo: botões sem rótulo, títulos invisíveis. A guarda é `||`.
    const fonte = readFileSync(`${pastaI18n}index.ts`, 'utf8');
    assert.ok(
      /dicionario\[texto\]\s*\|\|\s*texto/.test(fonte),
      'o t() precisa usar `dicionario[texto] || texto`. Com `??`, tradução vazia vira tela em branco.',
    );
  });
});

describe('os campos {assim} sobrevivem à tradução', () => {
  /**
   * UM CAMPO ESCRITO ERRADO NUMA TRADUÇÃO APARECE CRU NA TELA, e não quebra nada.
   *
   * O t() substitui `{nome}` pelo valor e deixa intacto o que não reconhece — de propósito, para uma
   * frase mal escrita não virar tela em branco. O preço é que `{comunidad}` em vez de `{comunidade}`
   * passa por toda a cadeia sem um aviso: compila, roda, e escreve a chaveta na cara de quem lê.
   *
   * Em dezesseis idiomas, dos quais a dupla lê três, isso não se acha olhando. Acha-se contando.
   *
   * O conjunto tem de ser IGUAL, não contido: um campo a menos some com a informação (o nome da
   * comunidade não aparece), e um a mais escreve `{quantos}` literal.
   */
  const campos = (texto: string) => new Set([...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

  for (const codigo of idiomasLigados()) {
    it(`${codigo}: os mesmos campos da frase em português`, () => {
      const texto = readFileSync(`${pastaI18n}${codigo}.ts`, 'utf8');
      const erradas: string[] = [];
      // Só as linhas de uma chave com valor na mesma linha. As que quebram em duas ficam de fora, e
      // é um falso negativo aceito: elas são poucas, e a alternativa seria interpretar TypeScript.
      //
      // O `\\.` DOS DOIS GRUPOS NÃO É ENFEITE. Sem ele, `(?!\1)` recusa a aspa escapada `\'` e a
      // leitura para no meio do valor: a linha deixa de casar e sai da conferência CALADA. O hauçá
      // escreve o hiato com apóstrofo (na'ura, ma'ana, ko'ina) e perdia 31 das 733 frases; medindo
      // os outros dicionários depois, o francês perdia 8 e o inglês 7 — o buraco já existia, e foi
      // só o hauçá que o fez grande o bastante para alguém notar.
      for (const m of texto.matchAll(/^\s{2}(['"])((?:\\.|(?!\1).)+)\1\s*:\s*(['"])((?:\\.|(?!\3).)*)\3,?\s*$/gm)) {
        const [, , chaveLida, , valor] = m;
        if (!valor.trim()) continue;
        const naChave = campos(chaveLida);
        const noValor = campos(valor);
        if (naChave.size === 0 && noValor.size === 0) continue;
        const faltando = [...naChave].filter((c) => !noValor.has(c));
        const sobrando = [...noValor].filter((c) => !naChave.has(c));
        if (faltando.length || sobrando.length) {
          erradas.push(`  ${JSON.stringify(chaveLida)}\n    faltando: ${faltando.join(', ') || '—'}  sobrando: ${sobrando.join(', ') || '—'}`);
        }
      }
      assert.deepEqual(erradas, [], `${codigo}: campo trocado em ${erradas.length} frase(s):\n${erradas.join('\n')}`);
    });
  }
});

describe('cada dicionário usa só a escrita da língua dele', () => {
  /**
   * LETRA DE OUTRO ALFABETO NO MEIO DA FRASE, e ela já escapou TRÊS VEZES neste projeto.
   *
   * Uma palavra em cirílico dentro de uma frase em coreano. Uma palavra em coreano dentro de uma
   * frase em japonês. Uma em cirílico, de novo, dentro do japonês. Todas de digitação, todas minhas,
   * e nenhuma dá erro: o TypeScript compila, o teste de campos passa, a cobertura marca 100%. O que
   * sai é uma frase com um pedaço ilegível para quem lê — e justamente nas línguas que ninguém da
   * dupla lê, que são as que não têm revisão humana.
   *
   * O QUE SE PROCURA É O ALFABETO ALHEIO, e não "o alfabeto certo": o latino é sempre permitido
   * (Syden, Windows, GIPHY, H.264, 1080p), e cada língua permite o seu. Uma letra de uma TERCEIRA
   * escrita não tem como ser proposital.
   */
  const ESCRITAS: Record<string, RegExp> = {
    cirilica: /[Ѐ-ӿ]/,
    grega: /[Ͱ-Ͽ]/,
    // A MESMA COISA NO BLOCO ÁRABE, com o divehi: a vírgula (،), o ponto e vírgula (؛) e a
    // interrogação (؟) árabes são a pontuação do thaana também — o MediaWiki e o WordPress em divehi
    // usam as três. Sem o recorte, o teste acusou 117 linhas do dv.ts, e nenhuma letra árabe.
    arabe: /[؀-؋؍-ؚ؜-؞ؠ-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/,
    hebraica: /[֐-׿]/,
    // O BLOCO DO DEVANÁGARI GUARDA PONTUAÇÃO QUE NÃO É DELE. O dandá (।, U+0964) e o dandá duplo
    // (॥) terminam frase em híndi, em bengali, em nepalês e em mais meia dúzia de escritas índicas —
    // eles moram no bloco do devanágari por acidente histórico do Unicode, não por pertencerem a ele.
    // Sem este recorte, o teste acusa 209 linhas do bengali: todas as que terminam em ponto final.
    devanagari: /[ऀ-ॣ०-ॿ]/,
    bengali: /[ঀ-৿]/,
    tamil: /[஀-௿]/,
    telugu: /[ఀ-౿]/,
    sinhala: /[඀-෿]/,
    tailandesa: /[฀-๿]/,
    khmer: /[ក-៿]/,
    lao: /[຀-໿]/,
    birmanesa: /[က-႟]/,
    etiope: /[ሀ-፿]/,
    georgiana: /[Ⴀ-ჿ]/,
    armenia: /[԰-֏]/,
    thaana: /[ހ-޿]/,
    tibetana: /[ༀ-࿿]/,
    // O japonês escreve com kana E com os ideogramas que o chinês usa, então as duas se permitem
    // mutuamente: procurar hanzi dentro do japonês acusaria 日本語 na primeira linha.
    chinesa: /[぀-ヿㇰ-ㇿ]/,
    coreana: /[가-힯ᄀ-ᇿ㄰-㆏]/,
  };

  /** A escrita declarada de cada idioma, lida de idiomas.ts — que é onde ela mora. */
  function escritaDe(codigo: string): string | undefined {
    const texto = readFileSync(`${pastaI18n}idiomas.ts`, 'utf8');
    // O `\\w` precisa das DUAS barras: dentro de um template literal, `\w` sozinho vira só "w", e a
    // busca passa a procurar `escrita: '(w+)'` — que não casa com nada e faz o teste reprovar os
    // dezenove idiomas de uma vez, dizendo que nenhum está na lista.
    const linha = new RegExp(`codigo: '${codigo}'.*?escrita: '(\\w+)'`).exec(texto);
    return linha?.[1];
  }

  for (const codigo of idiomasLigados()) {
    it(`${codigo}: nenhuma letra de um alfabeto que não é o dele`, () => {
      const escrita = escritaDe(codigo);
      assert.ok(escrita, `${codigo} não está na lista IDIOMAS`);
      const texto = readFileSync(`${pastaI18n}${codigo}.ts`, 'utf8');

      const intrusos: string[] = [];
      for (const [nome, busca] of Object.entries(ESCRITAS)) {
        if (nome === escrita) continue;
        // Chinês e japonês dividem os ideogramas, e um escreve o nome do outro: não se acusam.
        if ((escrita === 'japonesa' && nome === 'chinesa') || (escrita === 'chinesa' && nome === 'japonesa')) continue;
        for (const linha of texto.split('\n')) {
          // O cabeçalho é comentário em português e cita outras línguas de propósito.
          if (linha.trimStart().startsWith('//')) continue;
          const achou = busca.exec(linha);
          if (achou) intrusos.push(`  ${nome}: ${JSON.stringify(linha.trim().slice(0, 90))}`);
        }
      }
      assert.deepEqual(
        intrusos,
        [],
        `${codigo} (escrita ${escrita}) tem letra de outro alfabeto em ${intrusos.length} linha(s).\n` +
          'Quase sempre é erro de digitação, e ele não dá erro em lugar nenhum:\n' +
          intrusos.slice(0, 5).join('\n'),
      );
    });
  }
});
