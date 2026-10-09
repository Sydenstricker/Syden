// Uma conferida no Syden que está NO AR, sem criar conta, sem mandar mensagem, sem tocar em nada.
//
// Os outros testes daqui criam contas de verdade — rodá-los contra a produção encheria a comunidade de
// gente falsa. Este só abre o site como um visitante abriria e confere que tudo carregou e conversa com
// o servidor certo. É o que pega problema de AMBIENTE: caminho de arquivo errado, CORS recusando, endereço
// antigo esquecido no meio do caminho, certificado fora de prazo.
//
//   node e2e/producao.mjs                      confere https://syden.chat
//   SITE=https://outro node e2e/producao.mjs   confere outro endereço
import { abrirNavegador, falhou, novaAba, ok, resumo } from './ajuda.mjs';

const SITE = process.env.SITE ?? 'https://syden.chat';
const API = process.env.API ?? 'https://api.syden.chat';

const { browser, contexto } = await abrirNavegador();
const page = await novaAba(contexto);

// Tudo o que o navegador pediu e o que deu errado: é aqui que aparece arquivo faltando e chamada barrada.
const pedidos = [];
const falhados = [];
page.on('request', (r) => pedidos.push(r.url()));
page.on('requestfailed', (r) => falhados.push(`${r.url()} — ${r.failure()?.errorText ?? 'falhou'}`));
page.on('response', (r) => r.status() >= 400 && falhados.push(`${r.url()} — respondeu ${r.status()}`));

const resposta = await page.goto(SITE, { waitUntil: 'networkidle', timeout: 45_000 });
resposta?.ok() ? ok(`${SITE} respondeu ${resposta.status()}`) : falhou(`o site respondeu ${resposta?.status()}`);

// ---------- 1. o app montou ----------
// A home virou o quarto em 08/10/2026; até publicar, a produção ainda tem a vila. Os dois servem.
await page.locator('.auth, .vila, .quarto, .rail-list').first().waitFor({ timeout: 30_000 });
ok('o Syden carregou e desenhou a tela');

const titulo = await page.title();
titulo.includes('Syden') ? ok(`título da aba: "${titulo}"`) : falhou(`título inesperado: "${titulo}"`);

// ---------- 2. nenhum arquivo faltando ----------
// É o sintoma clássico de caminho base errado: a página abre e os arquivos dão 404.
falhados.length === 0 ? ok('nenhum arquivo faltou nem foi recusado') : falhou('pedidos com problema:\n   ' + falhados.slice(0, 5).join('\n   '));

// ---------- 3. o site fala com a API certa ----------
const paraApi = pedidos.filter((u) => u.includes('/api/'));
paraApi.some((u) => u.startsWith(API)) ? ok(`conversa com ${API}`) : falhou('não chamou a API esperada: ' + paraApi.slice(0, 3).join(', '));

const sobrasAntigas = pedidos.filter((u) => u.includes('duckdns') || u.includes('github.io'));
sobrasAntigas.length === 0 ? ok('nenhum endereço antigo sobrou na página') : falhou('ainda aponta para: ' + sobrasAntigas.slice(0, 3).join(', '));

// ---------- 4. a tela de entrada está inteira ----------
await page.getByLabel('Nome de usuário').waitFor({ timeout: 15_000 });
await page.getByLabel('Senha').waitFor({ timeout: 5_000 });
ok('a tela de entrada tem os campos de nome e senha');

await page.getByText('Cadastre-se').click();
await page.getByRole('button', { name: 'Cadastrar' }).waitFor({ timeout: 10_000 });
ok('e dá para chegar na tela de criar conta');

const temEsqueci = await page
  .getByRole('button', { name: /Esqueci a minha senha/ })
  .isVisible()
  .catch(() => false);
await page.getByText('Entrar').last().click();
const voltou = await page
  .getByRole('button', { name: /Esqueci a minha senha/ })
  .waitFor({ timeout: 8000 })
  .then(() => true)
  .catch(() => false);
voltou ? ok('a recuperação de senha está oferecida na entrada') : falhou('não achei "Esqueci a minha senha"');
void temEsqueci;

// ---------- 5. as páginas legais abrem ----------
for (const [arquivo, esperado] of [
  ['privacidade.html', 'Política de privacidade'],
  ['termos.html', 'Termos de uso'],
]) {
  const r = await page.goto(`${SITE}/${arquivo}`, { timeout: 20_000 });
  const texto = await page.locator('h1').first().innerText();
  r?.ok() && texto.includes(esperado) ? ok(`${arquivo} abre: "${texto}"`) : falhou(`${arquivo}: ${r?.status()} — "${texto}"`);
}

await page.goto(SITE, { timeout: 20_000 });
await page.screenshot({ path: 'e2e/fotos/producao.png' });

await browser.close();
resumo('producao');
