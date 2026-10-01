// Quanto o SQLite está carregando de arquivo, e de quem.
//
// Isto existe para MEDIR ANTES DE MEXER. Tirar as imagens e os sons do banco para o disco é uma
// migração de dados, e migração pela metade perde memes de gente — então o projeto dela depende de
// números que ninguém tem: quantos arquivos são, que tamanho têm, e qual tabela é o problema de
// verdade. Um banco com 40 MB de avatar se resolve de um jeito; com 4 GB de recado em vídeo, de outro.
//
// SÓ LÊ. Abre o banco em modo leitura e não escreve uma linha. Pode rodar com o Syden no ar — mas
// repare que `length()` num BLOB do SQLite não desempacota o arquivo, ele lê o cabeçalho, então isto
// custa quase nada mesmo com o banco grande.
//
// No servidor:
//   sudo docker compose exec api node scripts/medir-armazenamento.mjs
//
// Na sua máquina, contra o banco de desenvolvimento:
//   node server/scripts/medir-armazenamento.mjs
import { DatabaseSync } from 'node:sqlite';
import { statSync } from 'node:fs';

const CAMINHO = process.env.DATABASE_PATH || './janja.db';

/** As tabelas que guardam bytes de alguém, e o que cada uma é na tela. */
const TABELAS = [
  ['attachments', 'anexos de mensagem (imagem, vídeo, áudio, arquivo)'],
  ['karaoke_songs', 'músicas do karaokê'],
  ['sounds', 'sons do soundboard'],
  ['emojis', 'emojis das comunidades'],
  ['emoji_pack_items', 'emojis dentro de pacotes'],
  ['avatars', 'fotos de perfil'],
  ['community_icons', 'ícones de comunidade'],
  ['kv', 'guardados diversos do servidor'],
];

const emMB = (bytes) => (bytes / 1024 / 1024).toFixed(1).padStart(8) + ' MB';

const db = new DatabaseSync(CAMINHO, { readOnly: true });

let total = 0;
const linhas = [];

for (const [tabela, oQueE] of TABELAS) {
  let r;
  try {
    // `COALESCE(bytes, length(data))` conta as duas épocas: a linha já movida para o disco tem o
    // tamanho escrito em `bytes` e um BLOB vazio; a que ainda não foi movida continua sendo medida
    // como sempre. Sem isso, cada arquivo migrado sumiria da medição e o número despencaria sozinho.
    r = db
      .prepare(
        `SELECT COUNT(*) AS quantos,
                COALESCE(SUM(COALESCE(bytes, length(data))), 0) AS bytes,
                COALESCE(MAX(COALESCE(bytes, length(data))), 0) AS maior,
                COALESCE(SUM(CASE WHEN sha IS NULL THEN length(data) ELSE 0 END), 0) AS noBanco
         FROM ${tabela}`,
      )
      .get();
  } catch {
    // Tabela que ainda não existe neste banco: some da lista em vez de derrubar a medição.
    continue;
  }
  total += r.bytes;
  linhas.push({ tabela, oQueE, ...r });
}

linhas.sort((a, b) => b.bytes - a.bytes);

console.log(`Banco: ${CAMINHO}`);
try {
  const disco = statSync(CAMINHO).size;
  console.log(`Arquivo no disco: ${emMB(disco).trim()}\n`);
} catch {
  console.log('');
}

console.log('  tabela                      arquivos       soma        maior   o que é');
console.log('  ' + '─'.repeat(100));
for (const l of linhas) {
  console.log(
    '  ' +
      l.tabela.padEnd(22) +
      String(l.quantos).padStart(9) +
      emMB(l.bytes) +
      emMB(l.maior) +
      '   ' +
      l.oQueE,
  );
}
console.log('  ' + '─'.repeat(100));
console.log('  ' + 'TOTAL'.padEnd(22) + String(linhas.reduce((s, l) => s + l.quantos, 0)).padStart(9) + emMB(total));

// QUANTO AINDA ESTÁ DENTRO DO BANCO. É a pergunta que a migração criou, e a única que diz se ela
// terminou. O total acima soma as duas épocas de propósito — ele responde "quanto de arquivo existe",
// que é outra pergunta.
const aindaNoBanco = linhas.reduce((s, l) => s + (l.noBanco ?? 0), 0);
console.log(
  aindaNoBanco === 0
    ? '\n  Tudo no disco. Dentro do banco não sobrou byte de arquivo nenhum.'
    : `\n  Ainda DENTRO do banco:${emMB(aindaNoBanco)} — mover com: node scripts/mover-arquivos.mjs`,
);

// O recado em vídeo vence sozinho em 7 dias e devolve o espaço. Contá-lo junto com o que fica para
// sempre daria um número que some, e decisão tomada em cima de número que some é decisão errada.
try {
  const vencendo = db
    .prepare("SELECT COUNT(*) AS quantos, COALESCE(SUM(COALESCE(bytes, length(data))), 0) AS bytes FROM attachments WHERE expires_at IS NOT NULL")
    .get();
  if (vencendo.quantos > 0) {
    console.log(`\n  Desse total, ${vencendo.quantos} arquivo(s) e${emMB(vencendo.bytes)} são recados em vídeo, que somem sozinhos.`);
  }
} catch {
  // banco antigo, sem a coluna
}

console.log(`
O que fazer com este número:
  até ~200 MB   o banco aguenta, e mover os arquivos é melhoria, não urgência
  200 MB a 1 GB   cada leitura de arquivo TRAVA o servidor inteiro por alguns ms (o node:sqlite é
                  síncrono): a voz de quem está em chamada começa a engasgar quando alguém abre uma foto
  acima de 1 GB   backup, cópia e VACUUM do banco passam a levar minutos, e o disco da máquina é o teto`);
