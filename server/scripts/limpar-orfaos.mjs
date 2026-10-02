// Arquivos no disco que nenhuma linha do banco aponta mais. Lista por padrão; só apaga se mandarem.
//
// ---------------------------------------------------------------------------------------------------
// POR QUE A LIMPEZA É UMA VARREDURA, E NÃO UM GANCHO NO APAGAR.
//
// Duas razões, e as duas vêm de decisões que valem a pena:
//
//   1. O ENDEREÇO DE UM ARQUIVO É O SEU CONTEÚDO, então conteúdo repetido é um arquivo só. Apagar uma
//      linha NÃO quer dizer apagar o arquivo: o mesmo som pode estar instalado por outras nove
//      pessoas. Saber se ficou alguém apontando exige olhar todas as tabelas — que é o que isto faz.
//   2. `ON DELETE CASCADE` apaga linhas sem o código ficar sabendo. Apagar uma comunidade leva emojis,
//      sons, ícone, capa e anexos num comando só, e nenhum gancho do aplicativo é chamado. Qualquer
//      limpeza presa ao apagar seria incompleta por construção.
//
// NÃO APAGA SOZINHO, e a ordem padrão é só listar. Apagar arquivo é a única operação irreversível de
// toda a migração, e ela não vai acontecer por engano de digitação.
// ---------------------------------------------------------------------------------------------------
//
//   sudo docker compose exec api node scripts/limpar-orfaos.mjs            (lista)
//   sudo docker compose exec api node scripts/limpar-orfaos.mjs --apagar   (apaga)
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CAMINHO_DO_BANCO, PASTA_DOS_ARQUIVOS } from './mover-arquivos.mjs';

const TABELAS = ['avatars', 'community_icons', 'community_banners', 'emojis', 'emoji_pack_items', 'sounds', 'karaoke_songs', 'attachments'];

const apagar = process.argv.includes('--apagar');
const emMB = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

const db = new DatabaseSync(CAMINHO_DO_BANCO, { readOnly: true });

/** Todo sha que alguma linha ainda aponta. É o conjunto do que NÃO pode ser apagado. */
const vivos = new Set();

// A CAIXA-PRETA APONTA ARQUIVOS SEM TER COLUNA sha, e esquecer isto apagaria a prova.
//
// Ela guarda o retrato de uma conta excluída em JSON (ver db.ts), e dentro desse JSON estão os shas
// dos anexos — justamente porque copiar os bytes seria duplicá-los à toa. Só que uma conta excluída
// não tem mais linha em attachments: para esta varredura, os arquivos dela ficariam órfãos e seriam
// apagados no dia seguinte. A prova sumiria sozinha, noventa dias antes do prazo, e ninguém saberia.
try {
  for (const linha of db.prepare('SELECT dados FROM contas_retidas').all()) {
    for (const anexo of JSON.parse(linha.dados).anexos ?? []) if (anexo.sha) vivos.add(anexo.sha);
  }
} catch {
  // Banco anterior à caixa-preta: nada a somar.
}

for (const tabela of TABELAS) {
  try {
    for (const linha of db.prepare(`SELECT DISTINCT sha FROM ${tabela} WHERE sha IS NOT NULL`).all()) vivos.add(linha.sha);
  } catch {
    // Tabela sem a coluna ainda: nada a somar, e não é motivo para derrubar a varredura.
  }
}

/** Todo arquivo que existe no disco. Dois níveis: arquivos/ab/abcdef… */
function noDisco() {
  const achados = [];
  let pastas;
  try {
    pastas = readdirSync(PASTA_DOS_ARQUIVOS, { withFileTypes: true });
  } catch {
    return achados;
  }
  for (const pasta of pastas) {
    if (!pasta.isDirectory()) continue;
    for (const nome of readdirSync(join(PASTA_DOS_ARQUIVOS, pasta.name))) {
      // Os `.tmp` são escrita interrompida: ninguém aponta para eles, e são lixo por definição.
      achados.push({ nome, caminho: join(PASTA_DOS_ARQUIVOS, pasta.name, nome), temporario: nome.endsWith('.tmp') });
    }
  }
  return achados;
}

const todos = noDisco();
const orfaos = todos.filter((a) => a.temporario || !vivos.has(a.nome));

let bytes = 0;
for (const orfao of orfaos) {
  try {
    bytes += statSync(orfao.caminho).size;
  } catch {
    // Sumiu entre listar e medir: não entra na conta, e não é erro.
  }
}

console.log(`Pasta:    ${PASTA_DOS_ARQUIVOS}`);
console.log(`No disco: ${todos.length} arquivo(s)`);
console.log(`Apontados pelo banco: ${vivos.size}`);
console.log(`Órfãos:   ${orfaos.length}, somando ${emMB(bytes)}\n`);

if (orfaos.length === 0) {
  console.log('✔ Nada a limpar.');
  process.exit(0);
}

for (const orfao of orfaos.slice(0, 20)) {
  console.log(`  ${orfao.temporario ? 'escrita interrompida' : 'sem dono'}  ${orfao.nome.slice(0, 20)}…`);
}
if (orfaos.length > 20) console.log(`  … e mais ${orfaos.length - 20}`);

if (!apagar) {
  console.log('\nSó listei. Para apagar de verdade: node scripts/limpar-orfaos.mjs --apagar');
  process.exit(0);
}

for (const orfao of orfaos) rmSync(orfao.caminho, { force: true });
console.log(`\n✔ Apagados ${orfaos.length} arquivo(s), ${emMB(bytes)} de volta.`);
