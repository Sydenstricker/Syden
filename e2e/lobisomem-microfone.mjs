// O MICROFONE NO LOBISOMEM (20/11/2026, decisão dele: "Lobisomem pode mutar sim").
//
// - Ana, Beto, Caio e Duda jogam; o Edu está na mesma sala e disse "Agora não" (só assiste).
// - De noite: os quatro com o aviso da lua e o botão "Noite: microfones desligados", e o LiveKit sem a fonte do microfone na
//   permissão deles; o Edu continua com o microfone.
// - No amanhecer: quem saiu do jogo fica "Fora do jogo: só ouvindo"; os outros recebem o microfone de volta (estava ligado).
// - Quem saiu e volta à sala no meio da partida entra sem o microfone.
// - Ana encerra a partida: todos falam de novo.
//
//   node e2e/lobisomem-microfone.mjs   (API de teste na 3099, site na 5174 e LiveKit local na 7880)
//   ESCRITO, NÃO RODADO (20/11/2026: o LiveKit local não estava de pé).
import { createRequire } from 'node:module';
import path from 'node:path';
import { abrirNavegador, cadastrar, dispensarPresentes, falhou, ok, resumo, vigiar } from './ajuda.mjs';

const API = 'http://localhost:3099';
const exigir = createRequire(path.resolve('server', 'package.json'));
const { RoomServiceClient, TrackSource } = exigir('livekit-server-sdk');
const livekit = new RoomServiceClient(
  (process.env.LIVEKIT_URL ?? 'ws://localhost:7880').replace(/^ws/, 'http'),
  process.env.LIVEKIT_API_KEY ?? 'devkey',
  process.env.LIVEKIT_API_SECRET ?? 'secret',
);
const s = Date.now().toString().slice(-5);

const { browser } = await abrirNavegador();
const pessoa = async () =>
  vigiar(await (await browser.newContext({ viewport: { width: 1300, height: 900 }, permissions: ['microphone', 'camera'] })).newPage());

/** Uma chamada à API com o token da página. */
const api = (pagina, metodo, caminho, corpo) =>
  pagina.evaluate(
    async ([api, metodo, caminho, corpo]) => {
      const r = await fetch(api + caminho, {
        method: metodo,
        headers: { authorization: 'Bearer ' + localStorage.getItem('janja.token'), 'content-type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
      return r.json().catch(() => null);
    },
    [API, metodo, caminho, corpo],
  );

/** O que o LiveKit deixa a pessoa publicar agora (lista vazia: tudo). */
async function fontesNoLiveKit(salaId, userId) {
  const p = await livekit.getParticipant(`channel-${salaId}`, String(userId)).catch(() => null);
  return p?.permission?.canPublishSources ?? null;
}
const semMicrofone = (fontes) => Array.isArray(fontes) && fontes.length > 0 && !fontes.includes(TrackSource.MICROPHONE);
const rotuloDoMicrofone = (pagina) => pagina.locator('.stage-controls button').first().getAttribute('aria-label');

try {
  const nomes = ['ana', 'beto', 'caio', 'duda', 'edu'];
  const paginas = [];
  for (const nome of nomes) {
    const p = await pessoa();
    await cadastrar(p, nome + s);
    await dispensarPresentes(p);
    paginas.push(p);
  }
  const [ana, beto, caio, duda, edu] = paginas;
  await ana.getByRole('button', { name: 'Adicionar comunidade' }).click();
  await ana.locator('.community-choice-option').first().click();
  await ana.locator('form.dialog input').first().fill('Vila ' + s);
  await ana.locator('form.dialog .btn-primary').click();
  await ana.locator('.channel-name', { hasText: /^geral$/ }).first().waitFor({ timeout: 20000 });
  const comunidade = (await api(ana, 'GET', '/api/communities')).find((c) => c.name.startsWith('Vila'));
  for (const p of paginas.slice(1)) {
    await api(p, 'POST', '/api/communities/join', { code: comunidade.inviteCode });
    await p.reload();
    await dispensarPresentes(p);
  }
  const sala = (await api(ana, 'GET', `/api/communities/${comunidade.id}/channels`)).find((c) => c.name === 'Sala 1');
  for (const p of paginas) {
    await p.locator('.rail-item', { hasText: /^V/ }).first().click().catch(() => {});
    await p.locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
    await p.locator('.stage-controls').waitFor({ timeout: 30000 });
  }
  ok('as cinco pessoas estão na Sala 1');
  const ids = [];
  for (const p of paginas) ids.push((await api(p, 'GET', '/api/me')).id ?? (await api(p, 'GET', '/api/me')).user?.id);

  // o convite: quatro jogam, o Edu só assiste
  await api(ana, 'POST', `/api/channels/${sala.id}/minijogo`, { jogo: 'lobisomem', convidar: true });
  for (const p of [beto, caio, duda]) await api(p, 'POST', `/api/channels/${sala.id}/minijogo/convite`, { resposta: 'jogar' });
  await api(edu, 'POST', `/api/channels/${sala.id}/minijogo/convite`, { resposta: 'agora-nao' });
  await api(ana, 'POST', `/api/channels/${sala.id}/minijogo/largada`);
  await api(ana, 'POST', `/api/channels/${sala.id}/minijogo/acao`, { tipo: 'ajustes', lobos: 1, especiais: ['vidente'], noiteMs: 30000 });
  // no preparo, ninguém mudo
  (await rotuloDoMicrofone(beto)) === 'Silenciar' ? ok('no preparo, o microfone segue ligado') : falhou(`preparo: ${await rotuloDoMicrofone(beto)}`);
  await api(ana, 'POST', `/api/channels/${sala.id}/minijogo/acao`, { tipo: 'comecar' });

  // A NOITE
  for (const [i, p] of [ana, beto, caio, duda].entries()) {
    await p.locator('.muted-warning', { hasText: 'Noite no Lobisomem' }).waitFor({ timeout: 10000 });
    const rotulo = await rotuloDoMicrofone(p);
    rotulo === 'Noite: microfones desligados' ? ok(`${nomes[i]}: o botão diz a noite`) : falhou(`${nomes[i]}: ${rotulo}`);
    semMicrofone(await fontesNoLiveKit(sala.id, ids[i])) ? ok(`${nomes[i]}: o LiveKit tirou o microfone`) : falhou(`${nomes[i]}: ${JSON.stringify(await fontesNoLiveKit(sala.id, ids[i]))}`);
  }
  (await edu.locator('.muted-warning', { hasText: 'Noite no Lobisomem' }).count()) === 0 && !semMicrofone(await fontesNoLiveKit(sala.id, ids[4]))
    ? ok('o Edu, que só assiste, continua falando')
    : falhou('o Edu foi calado');
  await ana.locator('.lobisomem-microfone').waitFor({ timeout: 5000 });
  ok('o aviso da lua aparece também no painel do jogo');

  // o lobo ataca; a vidente olha; a noite acaba
  const jogadores = [ana, beto, caio, duda];
  const estados = await Promise.all(jogadores.map((p) => api(p, 'GET', `/api/channels/${sala.id}/minijogo`)));
  const lobo = estados.findIndex((e) => e.partida.meuPapel === 'lobisomem');
  const vidente = estados.findIndex((e) => e.partida.meuPapel === 'vidente');
  const vitima = [0, 1, 2, 3].find((i) => i !== lobo && i !== vidente);
  await api(jogadores[lobo], 'POST', `/api/channels/${sala.id}/minijogo/acao`, { tipo: 'noite', alvo: ids[vitima] });
  await api(jogadores[vidente], 'POST', `/api/channels/${sala.id}/minijogo/acao`, { tipo: 'noite', alvo: ids[lobo] });

  // O AMANHECER
  await jogadores[vitima].locator('.muted-warning', { hasText: 'Você saiu do jogo' }).waitFor({ timeout: 15000 });
  (await rotuloDoMicrofone(jogadores[vitima])) === 'Fora do jogo: só ouvindo'
    ? ok(`${nomes[vitima]} saiu do jogo e só ouve`)
    : falhou(`quem saiu: ${await rotuloDoMicrofone(jogadores[vitima])}`);
  for (const i of [0, 1, 2, 3].filter((i) => i !== vitima)) {
    await jogadores[i].locator('.muted-warning', { hasText: 'Noite no Lobisomem' }).waitFor({ state: 'detached', timeout: 10000 });
    await jogadores[i].waitForTimeout(1500);
    const rotulo = await rotuloDoMicrofone(jogadores[i]);
    rotulo === 'Silenciar' && !semMicrofone(await fontesNoLiveKit(sala.id, ids[i]))
      ? ok(`${nomes[i]}: o microfone voltou no amanhecer`)
      : falhou(`${nomes[i]} no amanhecer: ${rotulo}`);
  }

  // quem saiu do jogo sai da sala e volta: o token novo nasce sem o microfone
  await jogadores[vitima].getByRole('button', { name: 'Sair da chamada' }).first().click().catch(() => {});
  await jogadores[vitima].waitForTimeout(1500);
  await jogadores[vitima].locator('.channel-name', { hasText: /^Sala 1$/ }).first().click();
  await jogadores[vitima].locator('.stage-controls').waitFor({ timeout: 30000 });
  await jogadores[vitima].waitForTimeout(1500);
  semMicrofone(await fontesNoLiveKit(sala.id, ids[vitima])) ? ok('voltando à sala, continua sem o microfone') : falhou('voltou com o microfone');

  // O FIM: Ana encerra, todos falam
  await api(ana, 'DELETE', `/api/channels/${sala.id}/minijogo`);
  await jogadores[vitima].locator('.muted-warning', { hasText: 'Você saiu do jogo' }).waitFor({ state: 'detached', timeout: 10000 });
  !semMicrofone(await fontesNoLiveKit(sala.id, ids[vitima])) ? ok('partida encerrada: o microfone voltou a quem tinha saído') : falhou('continuou mudo depois do fim');
} catch (e) {
  falhou(e.stack ?? String(e));
} finally {
  await browser.close();
  resumo('lobisomem-microfone');
}
