// Quanto tempo o servidor fica TRAVADO ao servir um arquivo guardado dentro do SQLite?
//
// O node:sqlite é síncrono: enquanto ele lê, o processo inteiro para — nada de voz, nada de chat, nada
// para ninguém. Com dez amigos isso não aparece. A pergunta é a partir de quando aparece.
//
// A medição é do ATRASO DO RELÓGIO: um timer que deveria disparar a cada 10 ms. O quanto ele atrasa é,
// exatamente, o quanto o servidor ficou surdo.
import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arquivo = join(tmpdir(), `medir-blobs-${Date.now()}.db`);
const db = new DatabaseSync(arquivo);
db.exec('PRAGMA journal_mode = WAL; CREATE TABLE arquivos (id INTEGER PRIMARY KEY, data BLOB NOT NULL)');

const TAMANHOS = [0.05, 0.5, 2, 8, 20]; // MB: avatar, emoji grande, foto, clipe curto, recado em vídeo
const inserir = db.prepare('INSERT INTO arquivos (id, data) VALUES (?, ?)');
TAMANHOS.forEach((mb, i) => inserir.run(i + 1, Buffer.alloc(Math.round(mb * 1024 * 1024), 7)));

// Trabalho síncrono bloqueia pelo tempo que dura: o tempo gasto JÁ É o tempo que o servidor fica surdo.
function medir(trabalho) {
  const comeco = process.hrtime.bigint();
  trabalho();
  return Number(process.hrtime.bigint() - comeco) / 1e6;
}

const ler = db.prepare('SELECT data FROM arquivos WHERE id = ?');

console.log('tamanho     1 leitura           10 leituras seguidas');
TAMANHOS.forEach((mb, i) => {
  ler.get(i + 1); // aquece o cache do sistema de arquivos
  const uma = medir(() => ler.get(i + 1));
  const dez = medir(() => {
    for (let n = 0; n < 10; n++) ler.get(i + 1);
  });
  console.log(`${String(mb).padStart(5)} MB   ${uma.toFixed(1).padStart(7)} ms travado   ${dez.toFixed(1).padStart(8)} ms travado`);
});

db.close();
for (const sufixo of ['', '-wal', '-shm']) {
  try {
    rmSync(arquivo + sufixo);
  } catch {}
}
