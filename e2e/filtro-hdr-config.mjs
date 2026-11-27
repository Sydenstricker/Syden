// A CORREÇÃO DE HDR NAS CONFIGURAÇÕES (27/11/2026; web/src/correcaoHdr.ts): Configurações → Voz e vídeo traz "Corrigir HDR na
// transmissão", desligada de fábrica; ligar mostra a régua de intensidade (40% de fábrica), a escolha fica guardada depois de
// recarregar a página, e desligar esconde a régua. Fotografa a seção em e2e/fotos/hdr/.
//
//   node e2e/filtro-hdr-config.mjs   (API de teste na 3099 e site na 5174)
import { mkdirSync } from 'node:fs';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const { browser } = await abrirNavegador();
const s = Date.now().toString().slice(-5);
mkdirSync('e2e/fotos/hdr', { recursive: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = vigiar(await ctx.newPage());
  await cadastrar(page, 'hdr' + s);
  await dispensarPresentes(page);

  const abrir = async () => {
    await page.locator('button[aria-label="Configurações"]').first().click();
    await page.locator('.settings-tab', { hasText: /Voz e vídeo/ }).first().click();
    await page.locator('.filtro-hdr').waitFor({ timeout: 10000 });
    await page.locator('.filtro-hdr').scrollIntoViewIfNeeded();
  };
  const guardado = () => page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      try {
        const v = JSON.parse(localStorage.getItem(k));
        if (v && typeof v === 'object' && 'filtroHdr' in v) return v.filtroHdr;
      } catch {}
    }
    return null;
  });

  await abrir();
  ok('a seção aparece em Voz e vídeo');
  (await page.locator('.filtro-hdr input[type="range"]').count()) === 0 ? ok('desligada de fábrica: sem a régua') : falhou('a régua apareceu com o filtro desligado');
  (await page.locator('.filtro-hdr .toggle-nota').innerText()).includes('HDR') ? ok('a nota diz se o monitor está em HDR') : falhou('sem a nota do monitor');
  await page.locator('.filtro-hdr .toggle-row').click();
  await page.locator('.filtro-hdr input[type="range"]').waitFor({ timeout: 5000 });
  const padrao = await guardado();
  padrao?.ligado === true && Math.abs(padrao.intensidade - 0.4) < 0.001 ? ok('ligada: a régua aparece em 40% e a escolha é guardada') : falhou('estado guardado errado: ' + JSON.stringify(padrao));
  await page.locator('.filtro-hdr input[type="range"]').fill('0.8');
  (await page.locator('.filtro-hdr .ajuste-regua span').innerText()).includes('80%') ? ok('a régua mostra 80%') : falhou('o texto da régua não acompanha');
  await page.locator('.filtro-hdr').screenshot({ path: 'e2e/fotos/hdr/configuracao.png' });

  await page.reload();
  await dispensarPresentes(page);
  await abrir();
  const depois = await guardado();
  depois?.ligado === true && Math.abs(depois.intensidade - 0.8) < 0.001 ? ok('depois de recarregar, continua ligada em 80%') : falhou('não guardou: ' + JSON.stringify(depois));

  await page.locator('.filtro-hdr .toggle-row').click();
  await page.waitForTimeout(300);
  (await page.locator('.filtro-hdr input[type="range"]').count()) === 0 && (await guardado())?.ligado === false ? ok('desligar esconde a régua') : falhou('desligar não funcionou');
} catch (e) {
  falhou('exceção: ' + e.message);
} finally {
  await browser.close();
  resumo();
}
