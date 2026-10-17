// A PROTEÇÃO DE CRIANÇAS E ADOLESCENTES na tela (17/10/2026, ECA Digital; ver server/src/protecao.ts). Confere:
// (1) o cadastro pede a data e recusa menos de 13; (2) conta sem a data cai na tela da barreira e entra depois de
// informar; (3) o menor vê a Família com as proteções travadas e o código; (4) o adulto liga a conta com o código e vê
// o painel do responsável; (5) a conta banida vê o motivo e recorre; (6) a denúncia de mensagem pela bandeira.
//   API de teste (porta 3099, banco novo) e vite (5174): ver e2e/LEIA.md
//   node e2e/protecao.mjs   → e2e/fotos/protecao-*.png
import fs from 'node:fs';
import path from 'node:path';
import { io } from 'socket.io-client';
import { abrirNavegador, CONVITE, dispensarPresentes, falhou, novaPessoa, ok, resumo, SITE } from './ajuda.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const FOTOS = path.join(AQUI, 'fotos');
fs.mkdirSync(FOTOS, { recursive: true });
const API = process.env.API ?? 'http://localhost:3099';
const sufixo = Date.now().toString(36).slice(-5);
const comAnos = (anos) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
};
const pedir = async (metodo, rota, token, corpo) => {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: { ...(token && { authorization: 'Bearer ' + token }), ...(corpo && { 'content-type': 'application/json' }) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metodo + ' ' + rota + ': ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
async function conta(nome, nascimento) {
  await pedir('POST', '/api/auth/register', null, { username: nome, password: 'segredo123', email: nome + '@exemplo.teste', inviteCode: CONVITE, ...(nascimento && { nascimento }) });
  return (await pedir('POST', '/api/auth/login', null, { username: nome, password: 'segredo123' })).token;
}
const foto = (page, nome) => page.screenshot({ path: path.join(FOTOS, 'protecao-' + nome + '.png') });
async function entrarCom(browser, token) {
  const page = await novaPessoa(browser);
  await page.goto(SITE + '/app/');
  await page.evaluate((t) => localStorage.setItem('janja.token', t), token);
  await page.goto(SITE + '/app/');
  // a abertura (o coelho) fica no mínimo 2 s desde o começo da página, por cima do que já está montado
  await page.locator('#abertura').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  return page;
}

// a primeira conta do banco cuida do Syden (é ela quem bane)
const dono = await conta('dono' + sufixo, comAnos(35));
const mae = await conta('mae' + sufixo, comAnos(40));
const filho = await conta('filho' + sufixo, comAnos(14));
const semData = await conta('antigo' + sufixo);
const encrenca = await conta('encrenca' + sufixo, comAnos(25));
const { browser } = await abrirNavegador();

// (1) o cadastro
{
  const page = await novaPessoa(browser);
  await page.goto(SITE + '/app/?convite=' + CONVITE);
  await page.getByRole('button', { name: /Criar conta|Cadastre-se|Criar uma conta/ }).first().click().catch(() => {});
  const data = page.getByLabel('Data de nascimento');
  if (await data.isVisible().catch(() => false)) {
    await page.getByLabel('Nome de usuário').fill('pequeno' + sufixo);
    await page.getByLabel('E-mail').fill('pequeno' + sufixo + '@exemplo.test');
    await data.fill(comAnos(11));
    await page.getByLabel('Senha', { exact: true }).fill('segredo123');
    await page.getByRole('button', { name: 'Cadastrar' }).click();
    const erro = page.locator('.form-error', { hasText: 'O Syden é para quem tem 13 anos ou mais.' });
    (await erro.waitFor({ timeout: 8000 }).then(() => true, () => false)) ? ok('cadastro: menos de 13 é recusado, com o motivo') : falhou('cadastro: não recusou menos de 13');
    await foto(page, 'cadastro');
  } else falhou('cadastro: não achei o campo da data de nascimento');
}

// (2) conta sem a data: a barreira, e depois o Syden
{
  const page = await entrarCom(browser, semData);
  const titulo = page.getByText('Qual é a sua data de nascimento?');
  if (await titulo.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
    ok('barreira: conta sem a data vê a pergunta');
    await foto(page, 'barreira-nascimento');
    await page.getByLabel('Data de nascimento').fill(comAnos(30));
    await page.getByRole('button', { name: 'Continuar' }).click();
    (await page.locator('.quarto, .channel-name, .sidebar').first().waitFor({ timeout: 20000 }).then(() => true, () => false))
      ? ok('barreira: depois de informar, o Syden abre')
      : falhou('barreira: não abriu o Syden depois da data');
  } else falhou('barreira: a pergunta da data não apareceu');
}

const abrirFamilia = async (page) => {
  await page.locator('.quarto, .channel-name, .sidebar').first().waitFor({ timeout: 20000 });
  await dispensarPresentes(page);
  await page.getByRole('button', { name: 'Configurações' }).first().click();
  await page.getByRole('button', { name: 'Família' }).click();
};

// (3) o menor
let codigo = null;
{
  const page = await entrarCom(browser, filho);
  const aviso = page.getByText(/Ligue a sua conta a um responsável até/);
  (await aviso.waitFor({ timeout: 15000 }).then(() => true, () => false)) ? ok('menor: o aviso do prazo aparece') : falhou('menor: sem o aviso do prazo');
  await abrirFamilia(page);
  const travada = page.locator('.familia-regra input').first();
  (await travada.isDisabled()) ? ok('menor de 13 a 15: as proteções vêm travadas') : falhou('menor: a regra não está travada');
  await page.getByRole('button', { name: 'Gerar o código para o responsável' }).click();
  codigo = (await page.locator('.codigo-responsavel-codigo').textContent())?.trim() ?? null;
  /^[A-Z2-9]{8}$/.test(codigo ?? '') ? ok('menor: gerou o código ' + codigo) : falhou('menor: código estranho: ' + codigo);
  await foto(page, 'familia-menor');
}

// (4) o responsável
{
  const page = await entrarCom(browser, mae);
  await abrirFamilia(page);
  await page.getByLabel('Código').fill(codigo ?? '');
  await page.getByText('Declaro que sou o pai, a mãe ou o responsável legal por esta pessoa.').click();
  await page.getByRole('button', { name: 'Ligar as contas' }).click();
  const painel = page.locator('.familia-menor');
  (await painel.waitFor({ timeout: 10000 }).then(() => true, () => false)) ? ok('responsável: ligou e vê o painel') : falhou('responsável: o painel não apareceu');
  await foto(page, 'familia-responsavel');
}

// (5) banida: o motivo e o recurso
{
  const ids = await pedir('GET', '/api/me', encrenca);
  await pedir('POST', '/api/admin/banir', dono, { userId: ids.id, motivo: 'Ameaças a outra pessoa.' });
  const page = await entrarCom(browser, encrenca);
  const titulo = page.getByText('Esta conta foi banida do Syden');
  if (await titulo.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
    (await page.getByText('Ameaças a outra pessoa.').isVisible()) ? ok('banida: vê o motivo') : falhou('banida: não vê o motivo');
    await foto(page, 'banida');
    await page.getByLabel('Recorrer da decisão').fill('Foi um mal-entendido, posso explicar o que houve.');
    await page.getByRole('button', { name: 'Enviar recurso' }).click();
    (await page.getByText(/O seu recurso foi recebido/).waitFor({ timeout: 8000 }).then(() => true, () => false))
      ? ok('banida: o recurso foi recebido')
      : falhou('banida: o recurso não entrou');
    await foto(page, 'banida-recurso');
  } else falhou('banida: a tela do banimento não apareceu');
}

// (6) denunciar mensagem pela bandeira
{
  const comunidade = await pedir('POST', '/api/communities', dono, { name: 'Praça ' + sufixo });
  await pedir('POST', '/api/communities/join', mae, { code: comunidade.inviteCode });
  const canais = await pedir('GET', `/api/communities/${comunidade.id}/channels`, dono);
  const texto = (Array.isArray(canais) ? canais : canais.channels).find((c) => c.type === 'text');
  // texto vai pelo socket (a rota de mensagens é a dos anexos)
  const s = io(API, { auth: { token: dono }, transports: ['websocket'] });
  await new Promise((pronto) => s.on('connect', pronto));
  await new Promise((pronto) => s.emit('message:send', { channelId: texto.id, content: 'mensagem para denunciar' }, pronto));
  s.close();
  const page = await entrarCom(browser, mae);
  await page.locator('.quarto, .channel-name, .sidebar').first().waitFor({ timeout: 20000 });
  await dispensarPresentes(page);
  await page.getByRole('button', { name: 'Praça ' + sufixo }).first().click().catch(() => {});
  await page.locator('.channel-name', { hasText: texto.name }).first().click().catch(() => {});
  const msg = page.getByText('mensagem para denunciar');
  if (await msg.waitFor({ timeout: 10000 }).then(() => true, () => false)) {
    await msg.hover();
    const bandeira = page.getByRole('button', { name: 'Denunciar mensagem' });
    (await bandeira.first().isVisible().catch(() => false)) ? ok('mensagem: a bandeira de denunciar aparece') : falhou('mensagem: sem a bandeira');
    await bandeira.first().click().catch(() => {});
    (await page.getByText('Envolve risco a uma criança ou adolescente').isVisible().catch(() => false))
      ? ok('mensagem: o diálogo tem a marca de risco a criança')
      : falhou('mensagem: sem a marca de risco');
    await foto(page, 'denunciar-mensagem');
  } else falhou('mensagem: não consegui abrir a comunidade para ver a mensagem');
}

await browser.close();
resumo('proteção');
