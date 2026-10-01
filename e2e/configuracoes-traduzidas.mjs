// Abre a tela de Configurações em quatro idiomas e MEDE: sobrou português, estourou a largura,
// ficou campo {assim} cru na tela.
//
// POR QUE ELE EXISTE. O CLAUDE.md é explícito: "conferir idioma que ninguém da dupla lê é medir, não
// confiar". Nós lemos português, inglês e espanhol. As outras treze línguas só se conferem assim.
//
// AS QUATRO ESCOLHIDAS NÃO SÃO AO ACASO, e cada uma mede um risco diferente:
//   alemão   — palavra composta longa, o maior risco de estourar a caixa;
//   russo    — frase longa em outro alfabeto;
//   árabe    — a página inteira vira de lado;
//   coreano  — escrita sem espaço entre palavras, onde a quebra de linha se comporta diferente.
//
// O QUE ELE NÃO MEDE, de propósito: se a tradução está BOA. Isso nenhum teste mede. Ele mede o que é
// mecânico e passa despercebido — e é justamente o que escapa quando se traduzem cem frases de uma vez.
//
//   node e2e/configuracoes-traduzidas.mjs
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

const IDIOMAS = [
  { codigo: 'de', nome: 'Deutsch', rtl: false },
  { codigo: 'ru', nome: 'Русский', rtl: false },
  { codigo: 'ar', nome: 'العربية', rtl: true },
  { codigo: 'ko', nome: '한국어', rtl: false },
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
      const largos = [...painel.querySelectorAll('*')]
        .filter((e) => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0)
        .map((e) => `${e.tagName.toLowerCase()}.${e.className}`.slice(0, 60));
      return { textos, largos: [...new Set(largos)] };
    });

    for (const texto of medido.textos) {
      // O nome da comunidade e o nome de usuário são de gente, e não se traduzem.
      if (/^[A-Za-z0-9_@.+-]+$/.test(texto)) continue;
      if (CHEIRO_DE_PORTUGUES.test(texto)) sobrou.push(`${aba}: ${texto.slice(0, 70)}`);
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
resumo('Configurações nas quatro línguas');
