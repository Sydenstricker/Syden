// A conta que os avaliadores da Microsoft usam para abrir o Syden.
//
// POR QUE ISTO EXISTE. O Syden pede login, e quem avalia não tem conta. Sem uma, o revisor abre o
// app, encontra a tela de entrada, não passa dela, e reprova por "não foi possível avaliar o
// aplicativo" — a causa número um de reprovação de app com login.
//
// E não dá para criar pelo cadastro normal: ele exige e-mail confirmado desde 27/09/2026, e não
// existe caixa de entrada para uma conta de avaliação. Aqui a conta nasce com o e-mail já dado como
// confirmado, e é só isso que este script faz de diferente.
//
// Ela entra na comunidade mais antiga do Syden, para o revisor encontrar canais e conversa em vez de
// uma tela vazia — tela vazia também reprova.
//
// No servidor, dentro do contêiner da API (é lá que o banco mora):
//   docker compose exec api node scripts/conta-de-teste.mjs
//
// A SENHA É SORTEADA E MOSTRADA UMA VEZ SÓ. Rodar de novo troca a senha de uma conta que já exista,
// em vez de estourar: é o que se quer quando a anterior se perdeu.
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const scrypt = promisify(scryptCb);

const CAMINHO = process.env.DATABASE_PATH || './janja.db';
// O nome é o primeiro argumento que NÃO seja uma opção. Sem esta filtragem, rodar com --senha
// criaria uma conta chamada '--senha'.
const NOME = process.argv.slice(2).find((a) => !a.startsWith('--') && process.argv[process.argv.indexOf(a) - 1] !== '--senha') || 'microsoft-teste';

/**
 * O MESMO formato de senha que o servidor usa (ver server/src/auth.ts): sal e hash em hexadecimal,
 * separados por dois-pontos. Se um dia aquele arquivo mudar de algoritmo, este script para de
 * funcionar — e o sintoma será claro: a senha simplesmente não entra.
 */
async function guardarSenha(senha) {
  const sal = randomBytes(16);
  const hash = await scrypt(senha, sal, 64);
  return `${sal.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Senha sorteada, sem caracteres que se confundem.
 *
 * Sem 0/O e sem 1/l/I: esta senha vai ser lida e digitada à mão por uma pessoa do outro lado do
 * mundo, a partir de um campo do Partner Center. Uma letra ambígua aqui vira uma reprovação por
 * "a senha não funciona".
 */
function sortearSenha() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return [...randomBytes(20)].map((b) => letras[b % letras.length]).join('');
}

/**
 * Dá para ESCOLHER a senha, e não é preguiça.
 *
 * A sorteada precisa ser copiada do console do servidor para o terminal da outra máquina, e em
 * console web o Ctrl+V não funciona. Digitar vinte caracteres aleatórios à mão erra — errou. E o
 * exemplo que eu escrevi no lugar dela ("a-senha-da-conta-de-teste") era parecido demais com um
 * valor de verdade: foi colado como se fosse a senha.
 *
 *   node scripts/conta-de-teste.mjs --senha uma-que-voce-lembre
 *
 * Esta senha vai parar no campo de notas do Partner Center de qualquer jeito, onde só a Microsoft
 * lê. O que ela protege é uma conta comum, sem poder nenhum.
 */
const escolhida = process.argv.includes('--senha') ? process.argv[process.argv.indexOf('--senha') + 1] : null;
if (escolhida && escolhida.length < 6) {
  console.error('A senha escolhida precisa ter pelo menos 6 caracteres.');
  process.exit(1);
}

const db = new DatabaseSync(CAMINHO);
const senha = escolhida || sortearSenha();
const hash = await guardarSenha(senha);

const existente = db.prepare('SELECT id FROM users WHERE username = ?').get(NOME);
let id;

if (existente) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existente.id);
  id = existente.id;
  console.log(`A conta "${NOME}" já existia. A senha foi trocada.`);
} else {
  const criada = db
    .prepare(
      `INSERT INTO users (username, password_hash, is_admin, is_owner, email, exige_confirmacao)
       VALUES (?, ?, 0, 0, ?, 0)`,
    )
    .run(NOME, hash, `${NOME}@syden.chat`);
  id = Number(criada.lastInsertRowid);
  console.log(`Conta "${NOME}" criada.`);
}

// E-mail dado como confirmado: não há caixa de entrada para abrir o link, e sem isto a conta não
// passa da tela de entrada — exatamente o problema que este script existe para evitar.
db.prepare("UPDATE users SET email_verified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(id);

// A comunidade mais antiga é a de todo mundo que se cadastra sem código de outra.
const comunidade = db.prepare('SELECT id, name FROM communities ORDER BY id LIMIT 1').get();
if (comunidade) {
  const jaEsta = db
    .prepare('SELECT 1 AS n FROM community_members WHERE community_id = ? AND user_id = ?')
    .get(comunidade.id, id);
  if (!jaEsta) {
    db.prepare("INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, 'member')").run(
      comunidade.id,
      id,
    );
    console.log(`Entrou na comunidade "${comunidade.name}".`);
  } else {
    console.log(`Já participa da comunidade "${comunidade.name}".`);
  }
} else {
  console.log('ATENÇÃO: não há nenhuma comunidade no Syden. O revisor vai ver uma tela vazia.');
}

console.log('');
console.log('  Usuário: ' + NOME);
console.log('  Senha:   ' + senha);
console.log('');
if (!escolhida) console.log('Copie agora: a senha sorteada não fica guardada e não aparece de novo.');

// A PROVA. Tenta entrar com a senha que acabou de definir, batendo na API de verdade.
//
// Escrever no banco e imprimir um texto não prova nada: a senha pode estar num formato que o
// servidor não reconhece, ou a conta pode estar barrada por confirmação de e-mail. Sem isto, o
// primeiro a descobrir seria quem tentasse usá-la do outro lado — e ele não teria como saber de
// quem era a culpa. Aconteceu duas vezes hoje.
const API_LOCAL = process.env.API_LOCAL ?? 'http://localhost:3001';
try {
  const resposta = await fetch(`${API_LOCAL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: NOME, password: senha }),
  });
  if (resposta.ok) {
    console.log(`\nConferido: "${NOME}" entra com esta senha.`);
  } else {
    console.log(`\nATENÇÃO: a senha NÃO funcionou (${resposta.status}). Não adianta usá-la.`);
  }
} catch (erro) {
  console.log(`\n(não deu para conferir daqui: ${erro.message})`);
}
