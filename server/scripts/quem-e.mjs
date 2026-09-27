// Quem é esta pessoa? Quando se cadastrou, por onde entra, e de que comunidades participa.
//
// Serve para a pergunta que aparece toda vez que um nome desconhecido surge na lista: "de onde veio?".
// Só LÊ o banco — não muda nada.
//
// No servidor, dentro do contêiner da API (é lá que o banco mora):
//   docker compose exec api node scripts/quem-e.mjs ivan
//   docker compose exec api node scripts/quem-e.mjs            (lista as 20 contas mais novas)
import { DatabaseSync } from 'node:sqlite';

const CAMINHO = process.env.DATABASE_PATH || './janja.db';
const procurado = process.argv[2];

const db = new DatabaseSync(CAMINHO, { readOnly: true });

const quando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

if (!procurado) {
  const recentes = db
    .prepare('SELECT id, username, created_at AS criadoEm FROM users ORDER BY created_at DESC LIMIT 20')
    .all();
  console.log(`${recentes.length} conta(s) mais recentes, da mais nova para a mais antiga:\n`);
  for (const u of recentes) console.log(`  #${u.id}  ${u.username.padEnd(20)} ${quando(u.criadoEm)}`);
  console.log('\nPara ver os detalhes de uma: node scripts/quem-e.mjs <nome>');
  process.exit(0);
}

const pessoa = db
  .prepare(
    'SELECT id, username, created_at AS criadoEm, email, email_verified_at AS emailConfirmadoEm, is_admin AS admin, is_owner AS dono, password_hash AS hash FROM users WHERE username = ?',
  )
  .get(procurado);

if (!pessoa) {
  console.log(`Não existe conta com o nome "${procurado}".`);
  process.exit(1);
}

console.log(`#${pessoa.id}  ${pessoa.username}`);
console.log(`  cadastrada em ....... ${quando(pessoa.criadoEm)}`);
console.log(`  e-mail .............. ${pessoa.email ?? '— nenhum —'}${pessoa.emailConfirmadoEm ? ' (confirmado)' : ''}`);
// Hash sem ":" não é hash de senha nenhuma: é a marca de uma conta que nasceu por Google/GitHub/Steam.
console.log(`  entra por senha ..... ${String(pessoa.hash).includes(':') ? 'sim' : 'não'}`);
console.log(`  administra o Syden .. ${pessoa.dono ? 'é a dona' : pessoa.admin ? 'sim' : 'não'}`);

const sociais = db.prepare('SELECT provedor, created_at AS ligadoEm FROM social_accounts WHERE user_id = ?').all(pessoa.id);
console.log(`  entra por ........... ${sociais.length ? sociais.map((s) => `${s.provedor} (desde ${quando(s.ligadoEm)})`).join(', ') : '— nenhum serviço de fora —'}`);

// A pergunta que mais importa quando um nome desconhecido aparece: COMO ele entrou aqui dentro.
const comunidades = db
  .prepare(
    `SELECT c.name, c.invite_code AS convite, m.role AS cargo, m.joined_at AS entrouEm
       FROM community_members m JOIN communities c ON c.id = m.community_id
      WHERE m.user_id = ? ORDER BY m.joined_at`,
  )
  .all(pessoa.id);

console.log(`\n  comunidades (${comunidades.length}):`);
if (comunidades.length === 0) {
  console.log('    — nenhuma. Cadastrou-se sem convite, então não vê nem é vista por ninguém.');
}
for (const c of comunidades) {
  console.log(`    ${c.name}  ·  ${c.cargo}  ·  entrou em ${quando(c.entrouEm)}  ·  convite "${c.convite}"`);
}

const mensagens = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id = ?').get(pessoa.id);
console.log(`\n  mensagens enviadas .. ${mensagens.n}`);

db.close();
