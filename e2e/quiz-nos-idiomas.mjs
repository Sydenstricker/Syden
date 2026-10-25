// O QUIZ NOS IDIOMAS (24/10/2026): conferir língua que ninguém da dupla lê é medir, não confiar (CLAUDE.md). Para cada
// idioma, os três temas: a capa com o nome traduzido, um chute com o nome NAQUELA língua (o país pelo Intl, a figura da
// mitologia pelo Wikidata), e na tela do jogo nenhum resto em português, a direção do documento certa e nenhum estouro
// lateral. Uma foto por idioma e tema.
//
//   IDIOMAS=ar,ja node e2e/quiz-nos-idiomas.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const IDIOMAS = (process.env.IDIOMAS ?? 'ar,ja,de,ru,hi,th,el,ha').split(',');
const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

/** A tradução de uma chave no dicionário do idioma (a chave com ou sem aspas), ou a própria chave. */
function traduzir(idioma, chave) {
  const texto = fs.readFileSync(`web/src/i18n/${idioma}.ts`, 'utf8');
  const esc = chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = texto.match(new RegExp(`^\\s*(?:'${esc}'|${esc}):\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'm'));
  return m ? m[1].replace(/\\'/g, "'") : chave;
}
const mitologia = JSON.parse(fs.readFileSync('server/assets/quiz/mitologia.json', 'utf8'));
const nomeDaFigura = (idioma, en) => {
  const f = mitologia.find((x) => x.nome.en === en);
  return f.nome[idioma] ?? f.nome[idioma.split('-')[0]] ?? f.nome.en;
};
// O que NÃO pode sobrar em português na tela do jogo (textos do próprio quiz).
const RESTOS = ['Escreva o começo do nome', 'Alinhamento', 'Deslocamento', 'Sub-região', 'População', 'Domínios', 'Seu chute'];

const { browser } = await abrirNavegador();
try {
  const p = vigiar(await (await browser.newContext({ viewport: { width: 1300, height: 950 }, permissions: ['microphone', 'camera'] })).newPage());
  await cadastrar(p, 'lia' + s);
  await dispensarPresentes(p);
  await p.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await p.locator('.community-choice-option').first().click();
  await p.locator('form.dialog input').first().fill('Idiomas ' + s);
  await p.locator('form.dialog .btn-primary').click();
  await p.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });

  for (const idioma of IDIOMAS) {
    await p.evaluate((codigo) => localStorage.setItem('syden.idioma', codigo), idioma);
    await p.reload();
    await dispensarPresentes(p);
    await p.locator('.rail-item', { hasText: /^I/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });

    const temas = [
      ['monstros', 'Monstros de fantasia', 'Adult Red Dragon'],
      ['paises', 'Países', new Intl.DisplayNames([idioma], { type: 'region' }).of('BR')],
      ['mitologia', 'Mitologia', nomeDaFigura(idioma, 'Zeus')],
    ];
    for (const [tema, nome, chute] of temas) {
      await p.getByRole('button', { name: traduzir(idioma, 'Mini-games') }).first().click();
      await p.locator('.minijogo-abas [role=tab]').first().click(); // Solo
      // Pelo nome EXATO: em hauçá, "Tatsuniya" (mitologia) aparece dentro do nome dos monstros de fantasia.
      const capa = p.locator('.minijogo-jogo').filter({ has: p.getByText(traduzir(idioma, nome), { exact: true }) });
      if ((await capa.count()) !== 1) {
        falhou(`${idioma}/${tema}: a capa "${traduzir(idioma, nome)}" não está na estante`);
        await p.keyboard.press('Escape');
        continue;
      }
      await capa.click(); // no Solo, começa na hora (sem convite nem largada)
      const campo = p.locator('.quiz-busca input');
      await campo.waitFor({ timeout: 10000 });
      await campo.fill(chute.slice(0, Math.max(3, Math.ceil(chute.length / 2))));
      const sugestao = p.locator('.quiz-busca li', { hasText: chute });
      if (await sugestao.count().then((n) => n > 0, () => false)) await sugestao.first().click();
      else {
        await p.locator('.quiz-busca li').first().waitFor({ timeout: 5000 });
        await p.locator('.quiz-busca li').first().click();
      }
      await p.locator('.quiz-tabela tbody tr').first().waitFor({ timeout: 5000 });
      await p.waitForTimeout(300);
      const tela = await p.locator('.minijogo').innerText();
      const sobra = RESTOS.filter((r) => tela.includes(r));
      const linha = (await p.locator('.quiz-tabela tbody tr').first().innerText()).replace(/\s+/g, ' ');
      const direcao = await p.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction);
      const estouro = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const esperada = idioma === 'ar' || idioma === 'he' || idioma === 'fa' || idioma === 'ur' || idioma === 'dv' ? 'rtl' : 'ltr';
      if (sobra.length) falhou(`${idioma}/${tema}: sobrou português: ${sobra.join(', ')}`);
      else if (direcao !== esperada) falhou(`${idioma}/${tema}: direção ${direcao}, esperava ${esperada}`);
      else if (estouro > 0) falhou(`${idioma}/${tema}: a página estoura ${estouro} px`);
      else ok(`${idioma}/${tema}: ${linha}`);
      await p.locator('.minijogo').screenshot({ path: path.join(FOTOS, `quiz-${idioma}-${tema}.png`) });
      await p.locator('.minijogo-encerrar').click();
      await p.locator('.minijogo').waitFor({ state: 'detached', timeout: 10000 });
    }
  }
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('Quiz nos idiomas');
}
