// Abre a tela de Configurações em treze idiomas e MEDE: sobrou português, estourou a largura,
// ficou campo {assim} cru na tela.
//
// POR QUE ELE EXISTE. O CLAUDE.md é explícito: "conferir idioma que ninguém da dupla lê é medir, não
// confiar". Nós lemos português, inglês e espanhol. As outras treze línguas só se conferem assim.
//
// AS TREZE ESCOLHIDAS NÃO SÃO AO ACASO, e cada uma mede um risco diferente:
//   alemão   — palavra composta longa, o maior risco de estourar a caixa;
//   russo    — frase longa em outro alfabeto;
//   árabe    — a página inteira vira de lado;
//   coreano  — escrita sem espaço entre palavras, onde a quebra de linha se comporta diferente;
//   vietnamita — alfabeto latino com os MESMOS acentos do português, onde o detector de língua
//                tem de ser outro (ver abaixo) e a marca de diacríticos empilhados testa a fonte;
//   urdu      — escrita árabe DA DIREITA PARA A ESQUERDA numa língua que não é o árabe: a mesma
//                virada de página, outro vocabulário e outra forma de tratamento;
//   persa     — a MESMA escrita do urdu e numeração OPOSTA: aqui o Intl desenha ۰۱۲۳, e lá 0123;
//   japonês   — três sistemas de escrita na mesma frase e NENHUM espaço entre palavras, que é onde
//               a quebra de linha se comporta diferente de tudo o que veio antes;
//   télugo    — escrita própria, com fonte baixada sob demanda: é o caso em que a tela vira
//               quadradinho se a reserva não chegar;
//   tâmil     — língua aglutinante: a frase mais longa da lista inteira, e o maior risco de a
//               palavra não caber no botão;
//   hauçá     — alfabeto latino SEM os acentos do português, onde a armadilha é o contrário da do
//               vietnamita: o detector por letra quase funciona, e erra só em nome próprio e em
///               endereço de exemplo — erro raro é pior que erro óbvio, porque ninguém desconfia;
//   tailandês — O ESPAÇO NÃO SEPARA PALAVRA. Quem decide onde quebrar a linha é o dicionário de
//               tailandês do navegador, não o texto: é a primeira vez que o estouro de caixa
///               depende de o <html lang> estar certo;
//   amárico   — escrita etíope, com fonte de reserva baixada sob demanda: é o caso em que a tela
//               vira quadradinho se a Noto Sans Ethiopic não chegar, e só a foto mostra isso.
//
// O QUE ELE NÃO MEDE, de propósito: se a tradução está BOA. Isso nenhum teste mede. Ele mede o que é
// mecânico e passa despercebido — e é justamente o que escapa quando se traduzem cem frases de uma vez.
//
//   node e2e/configuracoes-traduzidas.mjs
import { readFileSync } from 'node:fs';
import { abrirNavegador, criarConta, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

/**
 * O que denuncia português numa tela que devia estar em alemão, russo, árabe ou coreano.
 *
 * DUAS COISAS DERAM ERRADO NA PRIMEIRA VERSÃO, e as duas valem para qualquer busca por palavra.
 *
 * A primeira: `\bvocê\b` NUNCA CASA. Em JavaScript `\w` é `[A-Za-z0-9_]`, então `ê` é caractere de
 * NÃO-palavra — e a fronteira `\b` depois dele exige a transição que não existe quando vem um espaço
 * ou um parêntese. A tela dizia "Volume do soundboard (só para você)" e o teste passava. Palavra
 * acentuada não leva `\b` no fim.
 *
 * A segunda: uma lista de vinte palavras não cobre uma língua. "toca estes sons para todos na sala"
 * não tem nenhuma delas e é português inteiro. A saída é a mesma que o resto do projeto já usou: as
 * LETRAS. ã, õ, ç, á, é, í, ó, ú só aparecem em português entre as quatro línguas deste teste — o
 * alemão tem ä, ö, ü e ß, que não estão aqui, e russo, árabe e coreano não têm acento latino nenhum.
 * As palavrinhas sem acento entram como reforço, para o caso raro de uma frase inteira sem acento.
 */
const CHEIRO_DE_PORTUGUES =
  /[ãõçáéíóúâêô]|\b(para|com|que|uma|seu|sua|seus|suas|pelo|pela|aqui|todos|todas|quem|mais|sem|ainda|cada|pode|podem|fica|ficam|sala|sons|senha|conta|mensagem|mensagens)\b/i;

/**
 * ESCRITA LATINA QUEBRA O DETECTOR DE CIMA, e o vietnamita foi o primeiro a quebrá-lo.
 *
 * A busca por letras acentuadas funciona porque alemão, russo, árabe e coreano não escrevem ã, á, ê
 * nem ô. O vietnamita escreve TODOS: "bạn", "cộng đồng", "đổi mật khẩu", "giọng nói". Procurar
 * `[ãõáéíóúâêô]` numa tela em vietnamita acusa a tela inteira — a tradução certa seria reprovada
 * por estar certa.
 *
 * O HAUÇÁ MOSTROU A OUTRA METADE DO PROBLEMA, e ela é mais perigosa. Ele não escreve acento nenhum,
 * então o detector por letra quase funciona: medindo o dicionário inteiro, ele acusa 4 linhas em
 * 702. E as quatro são certas por construção — `{quem}` é nome de campo e fica em português de
 * propósito, `mc.misali.com` casa com a palavra "com", e "Léo" é nome de pessoa. Detector que
 * erra pouco é pior que detector que erra muito: ninguém desconfia dele, e os quatro ruídos ficam
 * para sempre na saída, treinando a gente a ignorar o que ele diz.
 *
 * A saída é não adivinhar. As frases em português são CONHECIDAS: são as chaves do dicionário.
 * Então, para estas línguas, a pergunta deixa de ser "isto parece português?" e passa a ser "isto é
 * uma das frases que deveriam ter sido traduzidas?" — comparação exata, sem heurística e sem falso
 * positivo.
 *
 * UMA RESSALVA, e ela apareceu na primeira medição do vietnamita: tem chave cuja tradução É o
 * próprio texto, de direito. "1080p · 60 fps" se escreve igual em vietnamita e em hauçá, e acusá-la
 * seria reprovar a tradução certa. Por isso a comparação é com o VALOR: só conta como português quem
 * apareceu na tela com o texto da chave E tem tradução diferente dela. No hauçá são seis assim —
 * 1080p · 60 fps, Aurora, ESC, GIF, Jade e ZECA.
 *
 * O REFORÇO POR LETRA NÃO É MAIS ESCRITO À MÃO, ELE É MEDIDO. Para o vietnamita, a letra escolhida
 * à mão havia sido o `ç`, a única do português que ele não tem; a conta abaixo — acento do
 * português que não aparece em NENHUM valor do dicionário daquela língua — redescobre exatamente o
 * `ç`, e para o hauçá descobre sozinha que o `é` não serve, porque o próprio dicionário o usa em
 * "Survival na Léo". O reforço pega texto cravado que não passou por chave nenhuma.
 */
function dicionarioDe(codigo) {
  const texto = readFileSync(new URL(`../web/src/i18n/${codigo}.ts`, import.meta.url), 'utf8');
  const mapa = new Map();
  // O `\\.` DOS DOIS GRUPOS É O QUE FAZ O HAUÇÁ ENTRAR INTEIRO. Sem ele, `(?!\1)` recusa a aspa
  // escapada `\'` e a leitura para no meio do valor: a linha não casa e o par sai do mapa CALADO.
  // O hauçá escreve o hiato com apóstrofo (na'ura, ma'ana, ko'ina) e entrava com 702 das 733.
  // Medindo os outros 22 dicionários com a mesma régua: o francês perdia 8 pares, o inglês 7, o
  // italiano 3, e suaíli, neerlandês, espanhol e turco 1 cada. O buraco já estava lá.
  for (const m of texto.matchAll(/^\s{2}(['"])((?:\\.|(?!\1).)+)\1\s*:\s*(['"])((?:\\.|(?!\3).)*)\3,?\s*$/gm)) {
    mapa.set(m[2], m[4]);
  }
  return mapa;
}

const ACENTOS_DO_PORTUGUES = [...'ãõçáéíóúâêô'];

function detectorPorChaves(codigo) {
  const mapa = dicionarioDe(codigo);
  const escritas = new Set([...mapa.values()].join('').toLowerCase());
  const reforco = ACENTOS_DO_PORTUGUES.filter((letra) => !escritas.has(letra));
  return { mapa, reforco: reforco.length ? new RegExp(`[${reforco.join('')}]`) : null };
}

/** As línguas de escrita latina deste teste, cada uma com o seu dicionário e o seu reforço medido. */
const POR_CHAVES = new Map(['vi', 'ha', 'yo', 'ro', 'pl', 'om', 'az', 'uz', 'zu', 'mg', 'so', 'af', 'sv', 'hu', 'cs', 'sq', 'hr', 'da', 'sk', 'fi', 'no', 'sl', 'lt'].map((codigo) => [codigo, detectorPorChaves(codigo)]));

/** O detector da vez. Cada idioma mede o que ele próprio consegue distinguir. */
function sobrouPortugues(codigo, texto) {
  const porChaves = POR_CHAVES.get(codigo);
  if (!porChaves) return CHEIRO_DE_PORTUGUES.test(texto);
  if (porChaves.reforco && porChaves.reforco.test(texto)) return true;
  const traduzido = porChaves.mapa.get(texto);
  return traduzido !== undefined && traduzido !== texto;
}

const IDIOMAS = [
  { codigo: 'de', nome: 'Deutsch', rtl: false },
  { codigo: 'ru', nome: 'Русский', rtl: false },
  { codigo: 'ar', nome: 'العربية', rtl: true },
  { codigo: 'ko', nome: '한국어', rtl: false },
  { codigo: 'vi', nome: 'Tiếng Việt', rtl: false },
  { codigo: 'ur', nome: 'اردو', rtl: true },
  { codigo: 'fa', nome: 'فارسی', rtl: true },
  { codigo: 'ja', nome: '日本語', rtl: false },
  { codigo: 'te', nome: 'తెలుగు', rtl: false },
  { codigo: 'ta', nome: 'தமிழ்', rtl: false },
  { codigo: 'ha', nome: 'Hausa', rtl: false },
  { codigo: 'th', nome: 'ไทย', rtl: false },
  { codigo: 'am', nome: 'አማርኛ', rtl: false },
  { codigo: 'yo', nome: 'Yorùbá', rtl: false },
  { codigo: 'el', nome: 'Ελληνικά', rtl: false },
  { codigo: 'ro', nome: 'Română', rtl: false },
  { codigo: 'pl', nome: 'Polski', rtl: false },
  { codigo: 'my', nome: 'မြန်မာ', rtl: false },
  { codigo: 'uk', nome: 'Українська', rtl: false },
  { codigo: 'he', nome: 'עברית', rtl: true },
  { codigo: 'om', nome: 'Afaan Oromoo', rtl: false },
  { codigo: 'az', nome: 'Azərbaycan', rtl: false },
  { codigo: 'uz', nome: 'Oʻzbek', rtl: false },
  { codigo: 'ne', nome: 'नेपाली', rtl: false },
  { codigo: 'lo', nome: 'ລາວ', rtl: false },
  { codigo: 'zu', nome: 'isiZulu', rtl: false },
  { codigo: 'mg', nome: 'Malagasy', rtl: false },
  { codigo: 'so', nome: 'Soomaali', rtl: false },
  { codigo: 'af', nome: 'Afrikaans', rtl: false },
  { codigo: 'si', nome: 'සිංහල', rtl: false },
  { codigo: 'km', nome: 'ខ្មែរ', rtl: false },
  { codigo: 'kk', nome: 'Қазақша', rtl: false },
  { codigo: 'sv', nome: 'Svenska', rtl: false },
  { codigo: 'hu', nome: 'Magyar', rtl: false },
  { codigo: 'sr', nome: 'Српски', rtl: false },
  { codigo: 'cs', nome: 'Čeština', rtl: false },
  { codigo: 'bg', nome: 'Български', rtl: false },
  { codigo: 'sq', nome: 'Shqip', rtl: false },
  { codigo: 'hr', nome: 'Hrvatski', rtl: false },
  { codigo: 'da', nome: 'Dansk', rtl: false },
  { codigo: 'sk', nome: 'Slovenčina', rtl: false },
  { codigo: 'fi', nome: 'Suomi', rtl: false },
  { codigo: 'no', nome: 'Norsk', rtl: false },
  { codigo: 'sl', nome: 'Slovenščina', rtl: false },
  { codigo: 'lt', nome: 'Lietuvių', rtl: false },
];

// Todas as abas, e não uma lista escrita à mão. A primeira versão deste teste listava quatro por
// índice e, por azar, nenhuma delas era a de Comunidade — justamente a que tinha "Apagar comunidade"
// em português. Um teste que escolhe onde olhar encontra o que foi escolhido.

const { browser } = await abrirNavegador({ viewport: { width: 1400, height: 950 } });
const page = await browser.newPage();
vigiar(page);

await criarConta(page, 'cfg');
await dispensarPresentes(page);

// Uma comunidade precisa existir para a aba Comunidade ter o que mostrar. A primeira conta de um banco
// novo já nasce dentro da comunidade inicial do Syden; se não nasceu, o teste segue sem essa aba.
const temComunidade = (await page.locator('.rail-list .rail-item').count()) > 0;
if (temComunidade) await page.locator('.rail-list .rail-item').first().click();

await page.locator('button[aria-label="Configurações"]').first().click();
await page.locator('.settings-tab').first().waitFor({ timeout: 10000 });
ok('entrou em Configurações, em português');

// A ABA SE ACHA PELA POSIÇÃO, E NÃO PELO TEXTO, e a razão é o próprio assunto deste teste: depois da
// primeira troca o rótulo não está mais em português. Procurar "Idioma" funciona uma vez e trava na
// segunda volta, esperando oito segundos por uma aba que está ali na frente escrita "Sprache".
const ondeFicaOIdioma = await page.locator('.settings-tab').evaluateAll((abas) =>
  abas.findIndex((a) => /idioma/i.test(a.textContent ?? '')),
);
if (ondeFicaOIdioma < 0) falhou('não achei a aba de Idioma');

// "Sair" tem a mesma classe das abas e NÃO é uma aba: clicar nela desconecta a conta, as
// Configurações fecham, e a volta seguinte estoura esperando uma aba que já não existe. O índice se
// acha enquanto a tela ainda está em português, como o do Idioma.
const ondeFicaOSair = await page.locator('.settings-tab').evaluateAll((abas) =>
  abas.findIndex((a) => /^\s*sair\b/i.test(a.textContent ?? '')),
);

for (const idioma of IDIOMAS) {
  await page.locator('.settings-tab').nth(ondeFicaOIdioma).click();
  await page.locator('.idiomas').waitFor({ timeout: 8000 });
  await page.locator('.idioma', { hasText: idioma.nome }).first().click();
  await page.waitForTimeout(600);

  const sentido = await page.evaluate(() => document.documentElement.dir);
  const esperado = idioma.rtl ? 'rtl' : 'ltr';
  sentido === esperado ? ok(`${idioma.codigo}: a página está em ${sentido}`) : falhou(`${idioma.codigo}: dir=${sentido}, esperava ${esperado}`);

  const sobrou = [];
  const campos = [];
  const estourou = [];

  const quantasAbas = await page.locator('.settings-tab').count();
  for (let aba = 0; aba < quantasAbas; aba++) {
    if (aba === ondeFicaOSair) continue;
    await page.locator('.settings-tab').nth(aba).click().catch(() => {});
    await page.waitForTimeout(350);

    const medido = await page.evaluate(() => {
      const painel = document.querySelector('.settings-content-inner') ?? document.body;
      const textos = [];
      // Só os nós de TEXTO, e não o innerText do painel inteiro: assim cada frase vem separada, e dá
      // para dizer qual delas ficou em português em vez de só "tem português em algum lugar".
      const anda = document.createTreeWalker(painel, NodeFilter.SHOW_TEXT);
      for (let n = anda.nextNode(); n; n = anda.nextNode()) {
        const v = (n.textContent ?? '').trim();
        if (v.length <= 3) continue;
        // A LISTA DE IDIOMAS ESTÁ FORA, e não por preguiça: ela mostra de propósito o nome de cada
        // língua escrito NELA MESMA — Français, Türkçe, Română, Íslenska. É a única tela do Syden
        // onde texto noutra língua é o certo, e acusá-la encheria o relatório de ruído.
        if (n.parentElement?.closest('.idiomas, .idioma-futuro')) continue;
        textos.push(v);
      }
      // Estouro horizontal: o conteúdo é mais largo do que a caixa que o guarda.
      //
      // ENFEITE QUE JÁ ESTÁ RECORTADO NÃO CONTA, e isto apareceu no árabe. A capa da comunidade é um
      // div VAZIO com `overflow: hidden`, e por cima dela passa uma faixa de luz que entra pela
      // esquerda e sai pela direita — de propósito, é o movimento que ele pediu. Em escrita da
      // esquerda para a direita o que passa da borda esquerda não entra na conta do `scrollWidth`;
      // em árabe entra, e a mesma capa certa era acusada só por a página ter virado de lado.
      //
      // O corte é preciso: só escapa quem RECORTA o próprio conteúdo e não tem texto nenhum dentro.
      // Texto cortado continua sendo pego, que é o estouro que importa — ninguém lê meia frase.
      const largos = [...painel.querySelectorAll('*')]
        .filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0)
        .filter((e) => (e.textContent ?? '').trim() !== '' || getComputedStyle(e).overflowX !== 'hidden')
        .map((e) => `${e.tagName.toLowerCase()}.${e.className}`.slice(0, 60));
      return { textos, largos: [...new Set(largos)] };
    });

    for (const texto of medido.textos) {
      // O nome da comunidade e o nome de usuário são de gente, e não se traduzem.
      if (/^[A-Za-z0-9_@.+-]+$/.test(texto)) continue;
      if (sobrouPortugues(idioma.codigo, texto)) sobrou.push(`${aba}: ${texto.slice(0, 70)}`);
      if (/\{\w+\}/.test(texto)) campos.push(`${aba}: ${texto.slice(0, 70)}`);
    }
    estourou.push(...medido.largos.map((l) => `${aba}: ${l}`));
  }

  // O QUE SOBROU EM PORTUGUÊS É UMA CATRACA, e não um sim-ou-não, porque a dívida é grande demais
  // para caber numa tarde: são quatrocentas frases espalhadas pelo app, e esta tela é uma das
  // dezenas. Reprovar por existir dívida deixaria o teste vermelho para sempre, e teste vermelho
  // para sempre é teste que ninguém mais lê. Reprovar quando ela CRESCE é o que serve.
  //
  // Para baixar a marca: traduza, rode de novo, e escreva aqui o número novo.
  const CATRACA_DE_PORTUGUES = 0;
  if (sobrou.length === 0) ok(`${idioma.codigo}: nenhuma frase em português sobrou nas ${quantasAbas} abas`);
  else if (sobrou.length <= CATRACA_DE_PORTUGUES)
    ok(`${idioma.codigo}: ${sobrou.length} frases ainda em português (a marca é ${CATRACA_DE_PORTUGUES})`);
  else falhou(`${idioma.codigo}: subiu para ${sobrou.length}, a marca é ${CATRACA_DE_PORTUGUES}\n     ` + sobrou.slice(0, 8).join('\n     '));
  if (idioma.codigo === IDIOMAS[0].codigo) {
    console.log('  o que ainda falta nesta tela:');
    for (const s of [...new Set(sobrou)]) console.log(`     ${s}`);
  }

  campos.length === 0
    ? ok(`${idioma.codigo}: nenhum campo {assim} ficou cru na tela`)
    : falhou(`${idioma.codigo}: ${campos.length} campo(s) crus\n     ` + campos.slice(0, 6).join('\n     '));

  estourou.length === 0
    ? ok(`${idioma.codigo}: nada estourou a largura da caixa`)
    : falhou(`${idioma.codigo}: ${estourou.length} estouro(s)\n     ` + [...new Set(estourou)].slice(0, 6).join('\n     '));

  await page.screenshot({ path: `e2e/fotos/configuracoes-${idioma.codigo}.png`, fullPage: true });
}

await browser.close();
resumo(`Configurações nas ${IDIOMAS.length} línguas`);
