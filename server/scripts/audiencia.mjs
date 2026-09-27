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
console.log('1) Conferindo o token\n');
const vistoria = await rest('/user/tokens/verify');
console.log(`   situação: ${vistoria.status}`);

// ---------- 2. Qual conta, e qual o identificador do site ----------
console.log('\n2) Contas e sites com medição ligada\n');
const contas = await rest('/accounts');
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
