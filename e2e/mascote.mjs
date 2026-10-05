// O mascote dentro do Syden (rebrand de 05/10/2026): as animações do estúdio nos lugares do app.
//
// Confere que cada uma APARECE e que a imagem CARREGOU de fato (uma <img> com endereço errado ocupa o
// lugar e não mostra nada — o tipo de falha que não reclama):
//   - a faixa da apresentação, com o mascote apresentando no lugar do ícone;
//   - o karaokê sem música, com o mascote cantando.
// A tela de quem não está em comunidade nenhuma (o ocioso) fica de fora: toda conta nova entra na
// comunidade inicial do servidor, e a dona dela não sai — não há como chegar lá num banco de teste.
// E que nenhum SVG do mascote mudou o estilo do app (eles vão como <img> justamente para isso).
//
//   SITE=http://localhost:5174/app/ node e2e/mascote.mjs   (API de teste na 3099 e LiveKit local)
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, novaAba, ok, resumo } from './ajuda.mjs';

const { browser, contexto } = await abrirNavegador({ permissoes: ['microphone'] });
const page = await novaAba(contexto);
const s = Date.now().toString().slice(-5);
await cadastrar(page, 'masc' + s);
await dispensarPresentes(page);

/** A imagem do mascote está na tela E carregou (largura natural maior que zero). */
async function conferirMascote(seletor, nome, descricao) {
  const img = page.locator(seletor).first();
  await img.waitFor({ timeout: 15000 }).catch(() => {});
  if (!(await img.count())) return falhou(`${descricao}: o mascote não apareceu`);
  const r = await img.evaluate(async (el) => {
    if (!el.complete) await new Promise((ok) => el.addEventListener('load', ok, { once: true }));
    return { src: el.getAttribute('src'), largura: el.naturalWidth };
  });
  r.src.endsWith(`/mascote/${nome}.svg`) && r.largura > 0
    ? ok(`${descricao}: o mascote "${nome}" aparece e carregou`)
    : falhou(`${descricao}: ${JSON.stringify(r)}`);
}

// ---------- apresentação e karaokê: dentro da sala de voz ----------
// UMA COMUNIDADE PRÓPRIA, para ser dona dela: só quem administra vê o "Apresentar", e a dona da
// comunidade inicial é a primeira conta do banco — que só é este teste num banco recém-apagado.
const comunidade = 'Mascote ' + s;
await page.locator('button.rail-action[aria-label="Adicionar comunidade"]').click();
await page.getByText('Criar a minha').click();
await page.getByLabel('Nome da comunidade').fill(comunidade);
await page.locator('.dialog .btn-primary').click();
await page.locator(`.rail-list .rail-item[aria-label="${comunidade}"]`).waitFor({ timeout: 20000 });
await page.locator(`.rail-list .rail-item[aria-label="${comunidade}"]`).click();
await page.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
await page.locator('.stage-controls').waitFor({ timeout: 30000 });
ok('entrou na Sala 1');

await page.locator('button[aria-label="Apresentar"]').click();
await conferirMascote('.palco-faixa img.palco-mascote', 'apresentacao', 'faixa da apresentação');
await page.locator('.palco-faixa').screenshot({ path: 'e2e/fotos/mascote-apresentacao.png' });

await page.locator('.stage-controls button[aria-label="Mais"]').click();
await page.getByRole('button', { name: 'Karaokê' }).click();
await conferirMascote('.karaoke .karaoke-vazio img.mascote', 'karaoke', 'karaokê sem música');
await page.locator('.karaoke').screenshot({ path: 'e2e/fotos/mascote-karaoke.png' });

// Nenhuma regra dos SVGs do mascote vazou para a página: se vazasse, as classes deles estariam na folha.
const vazou = await page.evaluate(() =>
  [...document.styleSheets].some((folha) => {
    try {
      return [...folha.cssRules].some((r) => /\.(cabeca|o-fora|rosto-m)\b/.test(r.cssText));
    } catch {
      return false;
    }
  }),
);
!vazou ? ok('o estilo dos SVGs ficou dentro deles: nada vazou para o app') : falhou('uma regra do SVG do mascote vazou para a página');

await browser.close();
resumo('O mascote no app');
