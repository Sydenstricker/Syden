// Tira os arquivos de dentro do SQLite e põe no disco. Dá para rodar com o Syden no ar.
//
// ---------------------------------------------------------------------------------------------------
// ELE NÃO PRECISA TERMINAR. Essa é a propriedade que torna a migração segura, e ela foi desenhada para
// isso: a regra de leitura do servidor é "tem `sha`? está no disco; não tem? está no `data`". As duas
// épocas convivem linha a linha. Parar no meio — Ctrl+C, servidor reiniciado, máquina desligada — não
// deixa nada quebrado nem perdido: deixa parte migrada e parte não, e as duas funcionam.
//
// ELE PODE RODAR DUAS VEZES. Só olha as linhas que ainda têm bytes no banco, e escrever um arquivo
// cujo nome é o próprio conteúdo é idempotente por construção.
//
// O QUE ELE NUNCA FAZ: apagar arquivo do disco. Quem limpa é limpar-orfaos.mjs, e só depois de
// comparar o disco inteiro com o banco inteiro.
// ---------------------------------------------------------------------------------------------------
//
// No servidor:
//   sudo docker compose exec api node scripts/mover-arquivos.mjs --ver      (só conta, não mexe)
//   sudo docker compose exec api node scripts/mover-arquivos.mjs            (move)
//   sudo docker compose exec api node scripts/mover-arquivos.mjs --conferir (cada linha migrada tem
//                                                                            mesmo o arquivo no disco?)
//
// Na sua máquina, contra o banco de desenvolvimento:
//   node server/scripts/mover-arquivos.mjs --ver
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

// ESTAS TRÊS LINHAS SÃO CÓPIA DE server/src/arquivos.ts, e precisam continuar iguais a ele: se os dois
// calcularem caminhos diferentes, este script escreve num lugar e o servidor procura noutro — e o
// sintoma seria avatar sumido, não erro. server/test/arquivos.test.ts compara os dois e falha se
// desencontrarem.
export const CAMINHO_DO_BANCO = process.env.DATABASE_PATH || './janja.db';
export const PASTA_DOS_ARQUIVOS = process.env.MEDIA_PATH || join(dirname(CAMINHO_DO_BANCO), 'arquivos');
export const caminhoDe = (sha) => join(PASTA_DOS_ARQUIVOS, sha.slice(0, 2), sha);
export const shaDeArquivo = (dados) => createHash('sha256').update(dados).digest('hex');

/** Cada tabela e a coluna que identifica a linha. Tem tabela com chave própria e tabela com chave emprestada. */
const TABELAS = [
  ['avatars', 'user_id', 'fotos de perfil'],
  ['community_icons', 'community_id', 'ícones de comunidade'],
  ['community_banners', 'community_id', 'capas de comunidade'],
  ['emojis', 'id', 'emojis das comunidades'],
  ['emoji_pack_items', 'id', 'emojis dentro de pacotes'],
  ['sounds', 'id', 'sons do soundboard'],
  ['karaoke_songs', 'id', 'músicas do karaokê'],
  ['attachments', 'id', 'anexos de mensagem'],
];

const LOTE = 50;

const emMB = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

/** Tabela que ainda não ganhou as colunas novas: o servidor as cria ao subir, então basta esperar. */
function temColunas(db, tabela) {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);
  return colunas.includes('sha') && colunas.includes('bytes');
}

/** Escreve os bytes no disco com o nome do próprio conteúdo. Nome temporário e rename: nunca pela metade. */
function guardar(dados) {
  const sha = shaDeArquivo(dados);
  const destino = caminhoDe(sha);
  if (existsSync(destino)) return { sha, bytes: dados.length, jaEstava: true };
  mkdirSync(dirname(destino), { recursive: true });
  const temporario = `${destino}.${process.pid}.tmp`;
  writeFileSync(temporario, dados);
  renameSync(temporario, destino);
  return { sha, bytes: dados.length, jaEstava: false };
}

/**
 * O COMANDO. Fica dentro de uma função porque este arquivo também é IMPORTADO: server/test/arquivos.ts
 * compara o caminho que ele calcula com o que o servidor calcula, e um script que faz as coisas no
 * corpo do módulo faria a migração inteira só por ser importado por um teste.
 */
function principal() {
  const so_ver = process.argv.includes('--ver');
  const conferir = process.argv.includes('--conferir');
  const db = new DatabaseSync(CAMINHO_DO_BANCO, { readOnly: so_ver || conferir });

  // ---------- conferir ----------
  if (conferir) {
    let linhas = 0;
    let faltando = 0;
    for (const [tabela, chave, oQueE] of TABELAS) {
      if (!temColunas(db, tabela)) continue;
      const migradas = db.prepare(`SELECT ${chave} AS id, sha, bytes FROM ${tabela} WHERE sha IS NOT NULL`).all();
      for (const linha of migradas) {
        linhas += 1;
        if (!existsSync(caminhoDe(linha.sha))) {
          faltando += 1;
          console.log(`  SUMIU  ${tabela} #${linha.id} aponta para ${linha.sha.slice(0, 12)}… e não há arquivo`);
        }
      }
      console.log(`${tabela.padEnd(20)} ${String(migradas.length).padStart(6)} migradas   ${oQueE}`);
    }
    console.log(
      faltando === 0
        ? `\n✔ ${linhas} linha(s) migrada(s), e todos os arquivos estão no disco.`
        : `\n✘ ${faltando} de ${linhas} apontam para arquivo que não existe.`,
    );
    process.exit(faltando === 0 ? 0 : 1);
  }

  // ---------- ver e mover ----------
  console.log(`Banco:    ${CAMINHO_DO_BANCO}`);
  console.log(`Arquivos: ${PASTA_DOS_ARQUIVOS}\n`);

  let totalLinhas = 0;
  let totalBytes = 0;
  let repetidos = 0;

  for (const [tabela, chave, oQueE] of TABELAS) {
    if (!temColunas(db, tabela)) {
      console.log(`${tabela.padEnd(20)} sem as colunas novas — suba o servidor uma vez antes`);
      continue;
    }

    const pendentes = db
      .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(length(data)), 0) AS bytes FROM ${tabela} WHERE sha IS NULL AND length(data) > 0`)
      .get();

    if (pendentes.n === 0) {
      console.log(`${tabela.padEnd(20)} nada a mover   ${oQueE}`);
      continue;
    }

    if (so_ver) {
      console.log(`${tabela.padEnd(20)} ${String(pendentes.n).padStart(6)} linha(s), ${emMB(pendentes.bytes).padStart(9)}   ${oQueE}`);
      totalLinhas += pendentes.n;
      totalBytes += pendentes.bytes;
      continue;
    }

    let movidas = 0;
    let bytes = 0;
    // EM LOTES, e uma transação por lote: o node:sqlite é síncrono, então um lote grande demais deixaria
    // o servidor surdo — sem voz e sem chat — pelo tempo inteiro da escrita.
    for (;;) {
      const lote = db
        .prepare(`SELECT ${chave} AS id, data FROM ${tabela} WHERE sha IS NULL AND length(data) > 0 LIMIT ${LOTE}`)
        .all();
      if (lote.length === 0) break;

      // O ARQUIVO VAI PARA O DISCO ANTES DE A LINHA MUDAR. Nesta ordem, uma queda no meio deixa um
      // arquivo a mais no disco (que a limpeza recolhe) — na ordem inversa deixaria uma linha apontando
      // para um arquivo que não existe, e isso é perda de verdade.
      const guardados = lote.map((linha) => ({ id: linha.id, ...guardar(Buffer.from(linha.data)) }));

      db.exec('BEGIN');
      try {
        const atualizar = db.prepare(`UPDATE ${tabela} SET sha = ?, bytes = ?, data = X'' WHERE ${chave} = ? AND sha IS NULL`);
        for (const g of guardados) atualizar.run(g.sha, g.bytes, g.id);
        db.exec('COMMIT');
      } catch (erro) {
        db.exec('ROLLBACK');
        throw erro;
      }

      movidas += guardados.length;
      bytes += guardados.reduce((t, g) => t + g.bytes, 0);
      repetidos += guardados.filter((g) => g.jaEstava).length;
      process.stdout.write(`\r${tabela.padEnd(20)} ${String(movidas).padStart(6)} de ${pendentes.n}…`);
    }

    console.log(`\r${tabela.padEnd(20)} ${String(movidas).padStart(6)} movida(s), ${emMB(bytes).padStart(9)}   ${oQueE}`);
    totalLinhas += movidas;
    totalBytes += bytes;
  }

  console.log('');
  if (so_ver) {
    console.log(`Faltam mover: ${totalLinhas} linha(s), ${emMB(totalBytes)}.`);
    console.log('Para mover de verdade, rode sem --ver.');
  } else {
    console.log(`Movidas ${totalLinhas} linha(s), ${emMB(totalBytes)}.`);
    if (repetidos > 0) {
      console.log(`${repetidos} delas eram cópia de um arquivo que já estava lá — viraram uma só.`);
    }
    console.log('\nO BANCO AINDA NÃO ENCOLHEU, e isso é normal: o SQLite não devolve o espaço de um BLOB');
    console.log('apagado sem um VACUUM, que tranca o banco inteiro enquanto roda e precisa do dobro do');
    console.log('espaço livre em disco. Com o Syden parado, e só quando quiser o espaço de volta:');
    console.log('  sudo docker compose exec api node -e "new (require(\'node:sqlite\').DatabaseSync)(process.env.DATABASE_PATH).exec(\'VACUUM\')"');
    console.log('\nConfira antes de dormir tranquilo: node scripts/mover-arquivos.mjs --conferir');
  }

}

// Só roda quando alguém chamou `node scripts/mover-arquivos.mjs`. Importado, é só uma biblioteca.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
