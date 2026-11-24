// OS MODELOS NOSSOS DO QUARTO 3D NO LUGAR (24/11/2026): arrumações de teste que põem na cena o que foi refeito por script no
// Blender (web/scripts/modelos/salao-quarto/) — o fone, a cortiça, os troféus, o violão, o relógio, o ventilador LIGADO (a hélice
// gira), a caminha, a pipoca na mesa, o guarda-roupa e as janelas em arco, redonda, com floreira, com a cortina fechada e aberta —
// nos dois temas, e confere que nenhum modelo de quarto3d/feitos/ deu erro e que a hélice gira. As fotos vão para
// e2e/fotos/modelos/salao-quarto/no-jogo/.
//
//   node e2e/modelos-salao-quarto.mjs   (API de teste na 3099 e site de desenvolvimento na 5174)
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo } from './ajuda.mjs';

const API = process.env.API ?? 'http://localhost:3099';
const FOTOS = process.env.FOTOS ?? path.join('e2e', 'fotos', 'modelos', 'salao-quarto', 'no-jogo');
fs.mkdirSync(FOTOS, { recursive: true });
const s = Date.now().toString().slice(-5);

const PAREDE = {
  quadro: { parede: 'esquerda', v: 0, h: 0 },
  fone: { parede: 'esquerda', v: -2.5, h: -6 },
  cortica: { parede: 'esquerda', v: 3, h: 0 },
  violao: { parede: 'direita', v: -3.4, h: 0 },
  relogio: { parede: 'direita', v: 2.2, h: 40 },
  trofeus: { parede: 'direita', v: 2.4, h: -10 },
};
const CENAS = [
  { nome: 'objetos', arr: { parede: PAREDE, cores: { ventilador: 'oscilando' }, moveis: { ventilador: { c: [5.5, 1.5], lado: 0 } }, guardados: ['poltrona'],
    emCima: { o1: { tipo: 'pipoca', em: 'mesa', s: 0.3, t: 0.8, lado: 0 }, o2: { tipo: 'pipoca', em: 'guarda-roupa', s: 0.5, t: 0.5, lado: 0 } } } },
  { nome: 'arco', arr: { janela: { tipo: 'arco', parede: 'direita', v: 0 }, parede: PAREDE, moveis: { ventilador: { c: [5.5, 1.5], lado: 0 } }, guardados: ['poltrona'] } },
  { nome: 'redonda', arr: { janela: { tipo: 'redonda', parede: 'direita', v: 0 }, parede: PAREDE, moveis: { ventilador: { c: [5.5, 1.5], lado: 0 } }, guardados: ['poltrona'] } },
  { nome: 'floreira', arr: { janela: { tipo: 'floreira', parede: 'direita', v: 0 }, parede: PAREDE, moveis: { ventilador: { c: [5.5, 1.5], lado: 0 } }, guardados: ['poltrona'] } },
  { nome: 'cortina', arr: { janela: { tipo: 'original', parede: 'direita', v: 0 }, cortina: true, parede: PAREDE, moveis: { ventilador: { c: [5.5, 1.5], lado: 0 } }, guardados: ['poltrona'] } },
  { nome: 'aberta', arr: { janela: { tipo: 'original', parede: 'direita', v: 0 }, janelaAberta: true, parede: PAREDE, moveis: { ventilador: { c: [5.5, 1.5], lado: 0 } }, guardados: ['poltrona'] } },
];

const { browser } = await abrirNavegador({ viewport: { width: 1300, height: 950 } });
try {
  const contexto = await browser.newContext({ viewport: { width: 1300, height: 950 }, deviceScaleFactor: 2 });
  const p = await contexto.newPage();
  const erros = [];
  p.on('response', (r) => r.status() >= 400 && /\/(quarto3d|salao3d)\/feitos\//.test(r.url()) && erros.push(`${r.status()} ${r.url()}`));
  p.on('pageerror', (e) => erros.push(String(e).slice(0, 200)));
  await cadastrar(p, 'mod' + s);
  await dispensarPresentes(p);
  // a conta de teste entra numa comunidade: o quarto é o início do Syden
  await p.locator('.rail-logo').click();
  await p.locator('.quarto-estilo-botao').waitFor({ timeout: 30_000 });
  await p.locator('.quarto-estilo-botao').click();
  await p.locator('.quarto3d-caixa:not(.escondida) canvas').waitFor({ timeout: 30_000 });
  const token = await p.evaluate(() => localStorage.getItem('janja.token'));
  for (const tema of ['classico', 'colorido']) {
    await p.evaluate((t) => localStorage.setItem('syden:quarto3d-tema', t), tema);
    for (const c of CENAS) {
      const r = await fetch(API + '/api/quarto', {
        method: 'PUT',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify(c.arr),
      });
      if (!r.ok) falhou(`${c.nome}: não guardou (${r.status})`);
      await p.reload();
      await p.locator('.rail-logo').click();
      await p.locator('.quarto3d-caixa:not(.escondida) canvas').waitFor({ timeout: 30_000 });
      await p.waitForFunction(() => window.quarto3dDoTeste?.desenhados > 3, null, { timeout: 30_000 });
      // de dia (o relógio da máquina pode dar noite)
      await p.evaluate(() => window.quarto3dDoTeste.definirNoite(false));
      await p.waitForTimeout(1500);
      await p.locator('.quarto3d-caixa:not(.escondida) canvas').screenshot({ path: path.join(FOTOS, `${tema}-${c.nome}.png`) });
      if (c.nome === 'objetos') {
        const giro = () => p.evaluate(() => {
          let z = null;
          window.quarto3dDoTeste.cena?.traverse?.((o) => o.name === 'helice' && (z = o.rotation.z));
          return z;
        });
        const a = await giro();
        await p.waitForTimeout(500);
        const b = await giro();
        if (a !== null && a !== b) ok(`${tema}: a hélice do ventilador ligado gira`);
        else falhou(`${tema}: a hélice não gira (${a} → ${b})`);
      }
    }
    ok(`${tema}: ${CENAS.length} arrumações fotografadas`);
  }
  if (erros.length) falhou('erros: ' + erros.slice(0, 5).join(' | '));
  else ok('nenhum modelo nosso deu erro');
} finally {
  await browser.close();
}
resumo('modelos do quarto 3D');
