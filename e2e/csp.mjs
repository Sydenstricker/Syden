// Prova uma Content-Security-Policy contra o Syden DE VERDADE, antes de ela ir para o ar.
//
// Por que isto existe: uma CSP errada não avisa. Ela bloqueia um arquivo em silêncio e o Syden abre em
// branco — para todo mundo ao mesmo tempo, sem erro no servidor, sem nada no registro. É a única
// mudança de configuração do projeto que consegue derrubar o app inteiro sem tocar no código.
//
// Aqui a política é injetada no cabeçalho da PÁGINA, exatamente como a Cloudflare faria, e o navegador
// conta tudo o que ela barrou. Nenhuma violação = pode publicar.
//
//   node e2e/csp.mjs
//   SITE=https://syden.chat node e2e/csp.mjs
import { chromium } from 'playwright-core';

const SITE = process.env.SITE ?? 'https://syden.chat';

/**
 * A política proposta.
 *
 * Cada linha existe por um motivo concreto, e tirar qualquer uma quebra alguma coisa:
 *
 *   connect-src   o site conversa com a API (mensagens) e com o LiveKit (voz), nos dois casos por HTTPS
 *                 E por WebSocket. Faltando o wss:, a voz não conecta e o chat não atualiza sozinho.
 *   img-src       os avatares e emojis vêm da API; `data:` é para o que o app desenha em canvas (o selo
 *                 do ícone, o confete); `blob:` é para a foto do clipe e as miniaturas de transmissão.
 *   media-src     sons do soundboard e karaokê vêm da API; `blob:` é o áudio e o vídeo da chamada.
 *   style-src     'unsafe-inline' é inevitável: o React escreve `style=` direto nos elementos, e o
 *                 LiveKit injeta folhas de estilo próprias. Sem isso a tela abre sem formatação nenhuma.
 *   frame-src     o Turnstile da Cloudflare é um quadro dentro da nossa página.
 *   static.cloudflareinsights.com
 *                 a medição de audiência, que a Cloudflare injeta sozinha nas páginas enquanto o proxy
 *                 está ligado. Ela só pode estar liberada aqui porque está DECLARADA na política de
 *                 privacidade, na seção "Medição do site" — essa é a condição, e se um dia a medição
 *                 for desligada no painel, esta linha sai junto. O envio dela vai para /cdn-cgi/rum,
 *                 no NOSSO domínio, então connect-src 'self' já cobre: não há um segundo endereço.
 *   fonts.*       a letra do Syden vem do Google Fonts (ver web/index.html). Vale saber o preço disso:
 *                 cada pessoa que abre o Syden faz um pedido aos servidores do Google, e o Google vê o
 *                 endereço de rede dela. Hospedar a fonte junto com o site resolveria e tiraria duas
 *                 linhas desta política.
 *   worker-src    o tocador de som cru e o processamento do LiveKit rodam em workers.
 *   frame-ancestors 'none'  ninguém põe o Syden dentro de um quadro. É o que impede clickjacking — e é o
 *                 único item desta lista que NÃO funciona por meta tag, só por cabeçalho.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://api.syden.chat",
  "media-src 'self' blob: https://api.syden.chat",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://api.syden.chat wss://api.syden.chat https://live.syden.chat wss://live.syden.chat",
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean)[0];

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const contexto = await browser.newContext();
const page = await contexto.newPage();

// Injeta a política na resposta da página, que é exatamente onde a Cloudflare vai pô-la.
await page.route('**/*', async (rota) => {
  const resposta = await rota.fetch();
  const tipo = resposta.headers()['content-type'] ?? '';
  // SÓ NAS NOSSAS PÁGINAS. A Cloudflare põe cabeçalho nas respostas do nosso domínio e em mais nada;
  // pôr no quadro do Turnstile, que é de outro site, inventava uma violação que não existe.
  const nossa = rota.request().url().startsWith(SITE);
  if (!nossa || !tipo.includes('text/html')) return rota.fulfill({ response: resposta });
  await rota.fulfill({ response: resposta, headers: { ...resposta.headers(), 'content-security-policy': CSP } });
});

const violacoes = [];
page.on('console', (m) => {
  const texto = m.text();
  if (/Content Security Policy|Refused to/i.test(texto)) violacoes.push(texto);
});
page.on('pageerror', (e) => violacoes.push('erro de página: ' + e.message));

console.log('política em teste:\n  ' + CSP.split('; ').join('\n  ') + '\n');

async function visitar(caminho, oQueEsperar) {
  violacoes.length = 0;
  await page.goto(SITE + caminho, { waitUntil: 'networkidle', timeout: 45_000 });
  await oQueEsperar?.();
  // Um instante a mais: parte do que a CSP barra só é pedido depois que a tela monta.
  await page.waitForTimeout(2500);
  const nome = caminho || '/';

  // A medição da Cloudflare é uma ESCOLHA declarada, não um acidente do proxy: está liberada na
  // política acima e descrita na política de privacidade. Por isso ela deixou de ser tratada como
  // aviso aqui — se o script aparecer como violação, o erro é da nossa política e tem de falhar.
  if (violacoes.length === 0) return console.log(`  OK  ${nome}`);
  console.log(`  BARROU  ${nome}`);
  for (const v of [...new Set(violacoes)].slice(0, 8)) console.log('        ' + v.slice(0, 200));
  process.exitCode = 1;
}

// A tela de entrada é a que mais carrega coisa de fora: o Turnstile, os logos, a chamada à API.
await visitar('/', async () => {
  await page.locator('.auth, .vila').first().waitFor({ timeout: 30_000 });
  // Abre o cadastro, que é onde o Turnstile aparece.
  await page.getByText('Cadastre-se').click().catch(() => {});
});
await visitar('/privacidade.html');
await visitar('/termos.html');
await visitar('/contribuir.html');

await browser.close();
console.log(
  process.exitCode
    ? '\nNÃO publique: a política barra coisa que o Syden precisa.'
    : '\nNada do Syden foi barrado. Pode publicar a política.',
);
