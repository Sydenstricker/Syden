/**
 * Descobre e PROVA o que a API da Cloudflare devolve, antes de o painel depender disso.
 *
 * Por que este script existe: os nomes dos campos do GraphQL da Cloudflare não se adivinham. Escrever a
 * consulta de memória e ligar na tela produz o pior tipo de defeito deste projeto — o painel abre, não dá
 * erro nenhum, e mostra vazio para sempre. Aqui a pergunta é feita ao próprio servidor da Cloudflare:
 * quais campos existem, com que nome, e o que eles devolvem de verdade para o nosso site.
 *
 * O token NÃO vai na linha de comando: ele fica em server/.env, que o git ignora. Linha de comando fica
 * no histórico do terminal e aparece para quem listar os processos da máquina.
 *
 *   node server/scripts/audiencia.mjs
 *
 * Só lê. Não escreve nada, nem na Cloudflare nem no banco.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Lê o server/.env sem depender de biblioteca: são pares NOME=valor, uma por linha. */
function lerEnv() {
  const fora = {};
  for (const caminho of [resolve(AQUI, '../.env'), resolve(AQUI, '../../deploy/.env')]) {
    let texto;
    try {
      texto = readFileSync(caminho, 'utf8');
    } catch {
      continue;
    }
    for (const linha of texto.split('\n')) {
      const corte = linha.indexOf('=');
      if (corte < 1 || linha.trimStart().startsWith('#')) continue;
      const nome = linha.slice(0, corte).trim();
      if (!(nome in fora)) fora[nome] = linha.slice(corte + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return fora;
}

const env = { ...lerEnv(), ...process.env };
const TOKEN = env.CLOUDFLARE_API_TOKEN;

if (!TOKEN) {
  console.error('Falta CLOUDFLARE_API_TOKEN.');
  console.error('Escreva no arquivo server/.env (que o git ignora) a linha:');
  console.error('  CLOUDFLARE_API_TOKEN=o-token-que-a-cloudflare-mostrou');
  process.exit(1);
}

const REST = 'https://api.cloudflare.com/client/v4';
const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
const cabecalhos = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };

async function rest(caminho) {
  const r = await fetch(REST + caminho, { headers: cabecalhos, signal: AbortSignal.timeout(20_000) });
  const corpo = await r.json().catch(() => null);
  if (!r.ok || !corpo?.success) {
    const motivo = corpo?.errors?.map((e) => `${e.code} ${e.message}`).join('; ') ?? `HTTP ${r.status}`;
    throw new Error(`${caminho}: ${motivo}`);
  }
  return corpo.result;
}

async function graphql(query, variables) {
  const r = await fetch(GRAPHQL, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  const corpo = await r.json().catch(() => null);
  if (corpo?.errors?.length) throw new Error(corpo.errors.map((e) => e.message).join('; '));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return corpo.data;
}

// ---------- 1. O token serve, e para quê? ----------
//
// O VALOR NUNCA É IMPRESSO. O que se imprime é o tamanho e os defeitos de colagem — aspas que vieram
// junto, espaço sobrando —, porque é isso que resolve o problema sem pôr o segredo na tela nem no
// histórico do terminal. Já aconteceu neste projeto de um segredo estar errado e a pista ter sido
// justamente o número de caracteres.
console.log('1) Conferindo o token\n');
console.log(`   tamanho: ${TOKEN.length} caracteres`);
if (/^["']|["']$/.test(TOKEN)) console.log('   ATENÇÃO: veio com aspas. Tire as aspas do .env.');
if (TOKEN !== TOKEN.trim()) console.log('   ATENÇÃO: tem espaço sobrando no começo ou no fim.');
if (/\s/.test(TOKEN.trim())) console.log('   ATENÇÃO: tem espaço no meio — a colagem provavelmente cortou.');

// DOIS TIPOS DE TOKEN, DOIS ENDEREÇOS.
//
// O formato novo da Cloudflare é `cfat_` + 40 caracteres + 8 de conferência (53 ao todo), e é um token
// DE CONTA, criado em Manage Account -> Account API Tokens. Ele NÃO se valida em /user/tokens/verify:
// esse endereço é só para token de usuário, e responde "Invalid API Token" a um token de conta que
// está perfeitamente bom. O engano custa tempo porque a mensagem parece dizer que o token é ruim.
//
// Um token de conta também não enxerga /accounts, então o identificador da conta tem de vir de fora:
// ele está na barra de endereço do painel, logo depois de dash.cloudflare.com/.
const CONTA = env.CLOUDFLARE_ACCOUNT_ID;
const deConta = TOKEN.startsWith('cfat_');

if (deConta && !CONTA) {
  console.error('\n   Este é um token DE CONTA (começa com cfat_), e para validá-lo preciso do');
  console.error('   identificador da conta. Ele está na barra de endereço do painel da Cloudflare:');
  console.error('     dash.cloudflare.com/ESTE-PEDACO-AQUI/...');
  console.error('   Escreva no .env: CLOUDFLARE_ACCOUNT_ID=esse-valor  e rode de novo.');
  process.exit(1);
}

const vistoria = await rest(CONTA ? `/accounts/${CONTA}/tokens/verify` : '/user/tokens/verify');
console.log(`   tipo: ${deConta ? 'token de conta (cfat_)' : 'token de usuário'}`);
console.log(`   situação: ${vistoria.status}`);
if (vistoria.expires_on) console.log(`   vence em: ${new Date(vistoria.expires_on).toLocaleDateString('pt-BR')}`);

// ---------- 2. Qual conta, e qual o identificador do site ----------
console.log('\n2) Contas e sites com medição ligada\n');
// Com token de conta, /accounts não responde: ele já nasce preso a uma conta só. Usa a que veio no .env.
const contas = CONTA ? [{ id: CONTA, name: '(a do .env)' }] : await rest('/accounts');
for (const conta of contas) {
  console.log(`   conta: ${conta.name}`);
  console.log(`   CLOUDFLARE_ACCOUNT_ID=${conta.id}`);
  try {
    const sites = await rest(`/accounts/${conta.id}/rum/site_info/list`);
    if (!sites.length) console.log('     (nenhum site com Web Analytics nesta conta)');
    for (const site of sites) {
      console.log(`     site: ${site.host ?? site.ruleset?.zone_name ?? '(sem host)'}`);
      console.log(`     CLOUDFLARE_SITE_TAG=${site.site_tag}`);
    }
  } catch (erro) {
    console.log(`     não deu para listar os sites: ${erro.message}`);
    console.log('     (falta a permissão "Account Analytics: Read" no token?)');
  }
}

// ---------- 3. Quais campos existem DE VERDADE ----------
console.log('\n3) Perguntando à Cloudflare quais campos existem\n');

const INTROSPECCAO = `
  query Campos($nome: String!) {
    __type(name: $nome) {
      name
      fields { name type { name kind ofType { name kind } } }
    }
  }
`;

for (const tipo of ['AccountRumPageloadEventsAdaptiveGroups', 'AccountRumWebVitalsEventsAdaptiveGroups']) {
  try {
    const dados = await graphql(INTROSPECCAO, { nome: tipo });
    const campos = dados?.__type?.fields;
    if (!campos) {
      console.log(`   ${tipo}: não existe com esse nome`);
      continue;
    }
    console.log(`   ${tipo}:`);
    console.log('     ' + campos.map((c) => c.name).join(', '));
  } catch (erro) {
    console.log(`   ${tipo}: ${erro.message}`);
  }
}

// Os nomes acima são um palpite. Se não baterem, este lista TUDO que começa com "rum" no nó da conta.
console.log('\n   Conjuntos disponíveis na conta que começam com "rum":');
try {
  const dados = await graphql(`query { __type(name: "Account") { fields { name } } }`);
  const nomes = (dados?.__type?.fields ?? []).map((c) => c.name).filter((n) => n.toLowerCase().startsWith('rum'));
  console.log('     ' + (nomes.join(', ') || '(nenhum — o token não alcança os dados de RUM)'));
} catch (erro) {
  console.log(`     ${erro.message}`);
}

console.log('\nPronto. Copie as linhas CLOUDFLARE_* acima para o .env do servidor.');
