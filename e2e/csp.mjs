// Prova uma Content-Security-Policy contra o Syden DE VERDADE, antes de ela ir para o ar.
//
// Por que isto existe: uma CSP errada não avisa. Ela bloqueia um arquivo em silêncio e o Syden abre em
// branco — para todo mundo ao mesmo tempo, sem erro no servidor, sem nada no registro. É a única
// mudança de configuração do projeto que consegue derrubar o app inteiro sem tocar no código.
//
// Aqui a política é injetada no cabeçalho da PÁGINA, exatamente como a Cloudflare faria, e o navegador
// conta tudo o que ela barrou. Nenhuma violação = pode publicar.
//
//   node e2e/csp.mjs              prova a política CANDIDATA daqui, injetando-a na resposta
//   AO_VIVO=1 node e2e/csp.mjs    não injeta nada: mede a política que JÁ ESTÁ no ar
//   SITE=https://syden.chat node e2e/csp.mjs
//
// O modo AO_VIVO é o de depois de publicar. Injetar por cima de uma política já publicada faria o
// navegador aplicar as DUAS ao mesmo tempo, e o que ele barrasse não diria qual das duas barrou.
import { chromium } from 'playwright-core';
import { CSP } from './politica-de-seguranca.mjs';

const SITE = process.env.SITE ?? 'https://syden.chat';
const AO_VIVO = Boolean(process.env.AO_VIVO);

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
  // No modo AO_VIVO não se injeta nada: quem responde é a política de verdade, já publicada.
  const nossa = rota.request().url().startsWith(SITE);
  if (AO_VIVO || !nossa || !tipo.includes('text/html')) return rota.fulfill({ response: resposta });
  await rota.fulfill({ response: resposta, headers: { ...resposta.headers(), 'content-security-policy': CSP } });
});

const violacoes = [];
page.on('console', (m) => {
  const texto = m.text();
  if (/Content Security Policy|Refused to/i.test(texto)) violacoes.push(texto);
});
page.on('pageerror', (e) => violacoes.push('erro de página: ' + e.message));

console.log(AO_VIVO ? 'medindo a política que JÁ ESTÁ no ar\n' : 'política em teste:\n  ' + CSP.split('; ').join('\n  ') + '\n');

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
    ? AO_VIVO
      ? '\nA política QUE ESTÁ NO AR barra coisa do Syden. Desative a regra na Cloudflare.'
      : '\nNÃO publique: a política barra coisa que o Syden precisa.'
    : AO_VIVO
      ? '\nNada barrado pela política que está no ar.'
      : '\nNada do Syden foi barrado. Pode publicar a política.',
);
