// A comunidade de mentira usada nas fotos da Microsoft Store.
//
// POR QUE ELA EXISTE. As capturas da Store vão para uma página pública, para sempre, e não têm
// desfazer. Fotografar a comunidade dos amigos publicaria os nomes e as mensagens deles para o mundo
// sem ninguém ter sido consultado — e "eu peço autorização a cada um" é pior do que parece: bastaria
// uma pessoa mudar de ideia depois para a imagem já estar no ar.
//
// Aqui tudo é inventado: as contas, a conversa, os nomes. O que a foto mostra é o Syden, e não
// ninguém.
//
// AS CONTAS SÃO INOFENSIVAS DE PROPÓSITO: senha sorteada e jogada fora, sem e-mail de verdade, sem
// poder nenhum, e vivem só na comunidade de demonstração. Ninguém entra com elas depois — nem quem
// as criou, porque a senha não é guardada em lugar nenhum.
//
//   docker compose exec api node scripts/comunidade-de-demonstracao.mjs
//
// Rodar de novo NÃO duplica nada: refaz a conversa do zero na mesma comunidade.
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const scrypt = promisify(scryptCb);
const CAMINHO = process.env.DATABASE_PATH || './janja.db';
const NOME_DA_COMUNIDADE = 'Sala de Estar';

/**
 * A turma inventada.
 *
 * Nomes comuns em português, sem sobrenome, que não apontam para ninguém. De propósito não usei
 * nomes de personagem conhecido nem trocadilho: a foto é sobre o Syden, e um nome engraçado rouba a
 * atenção de quem está olhando para decidir se baixa.
 */
const GENTE = ['helena', 'rafa', 'bento', 'clara', 'tom'];

/**
 * A conversa.
 *
 * Escrita para parecer um grupo de amigos combinando alguma coisa — que é o que o Syden é. Sem
 * piada interna, sem nada que precise de contexto, e nada que soe como conteúdo real de alguém.
 */
const CONVERSA = [
  ['helena', 'boa noite, gente 👋'],
  ['rafa', 'cheguei! já tô na sala de voz'],
  ['bento', 'dois minutos e eu entro'],
  ['clara', 'alguém viu que o Syden ganhou modo sessão? dá pra assistir junto com a conversa do lado'],
  ['helena', 'vi sim, testei ontem. ficou muito bom'],
  ['tom', 'boa! então hoje tem filme'],
  ['rafa', 'voto em filme 🍿'],
  ['clara', 'eu topo. mas antes uma partida, né'],
  ['bento', 'sempre 😄'],
  ['helena', 'combinado. entra todo mundo na Sala 1'],
];

const CANAIS = [
  { nome: 'geral', tipo: 'text' },
  { nome: 'combinados', tipo: 'text' },
  { nome: 'Sala 1', tipo: 'voice' },
  { nome: 'Sala 2', tipo: 'voice' },
];

/**
 * A senha das contas de mentira.
 *
 * Elas PRECISAM de uma senha conhecida, e isso é uma mudança de ideia consciente: sem poder entrar
 * com elas, não dá para pôr gente numa sala de voz — e a foto da chamada é a que mais importa para
 * um aplicativo de voz.
 *
 * O risco é pequeno e vale medir: são contas sem poder nenhum, sem e-mail, que existem só na
 * comunidade de demonstração. Quem tivesse a senha poderia escrever lá dentro, e nada além disso.
 * A senha é sorteada e mostrada uma vez; rodar o script de novo troca todas.
 */
const SENHA = randomBytes(12).toString('base64url');

async function guardarSenha(senha) {
  const sal = randomBytes(16);
  const hash = await scrypt(senha, sal, 64);
  return `${sal.toString('hex')}:${hash.toString('hex')}`;
}

const db = new DatabaseSync(CAMINHO);

// ---------- A comunidade ----------
let comunidade = db.prepare('SELECT id FROM communities WHERE name = ?').get(NOME_DA_COMUNIDADE);
if (!comunidade) {
  const convite = 'demo-' + randomBytes(4).toString('hex');
  const criada = db
    .prepare('INSERT INTO communities (name, invite_code, created_by) VALUES (?, ?, NULL)')
    .run(NOME_DA_COMUNIDADE, convite);
  comunidade = { id: Number(criada.lastInsertRowid) };
  console.log(`Comunidade "${NOME_DA_COMUNIDADE}" criada.`);
} else {
  console.log(`Comunidade "${NOME_DA_COMUNIDADE}" já existia.`);
}

// ---------- Os canais ----------
const porNome = new Map();
for (const canal of CANAIS) {
  let linha = db
    .prepare('SELECT id FROM channels WHERE community_id = ? AND name = ?')
    .get(comunidade.id, canal.nome);
  if (!linha) {
    const criado = db
      .prepare('INSERT INTO channels (community_id, name, type, position) VALUES (?, ?, ?, ?)')
      .run(comunidade.id, canal.nome, canal.tipo, CANAIS.indexOf(canal));
    linha = { id: Number(criado.lastInsertRowid) };
  }
  porNome.set(canal.nome, linha.id);
}
console.log(`${CANAIS.length} canais prontos.`);

// ---------- A turma ----------
const ids = new Map();
for (const nome of GENTE) {
  let pessoa = db.prepare('SELECT id FROM users WHERE username = ?').get(nome);
  if (!pessoa) {
    const criada = db
      .prepare(
        `INSERT INTO users (username, password_hash, is_admin, is_owner, email, exige_confirmacao, email_verified_at)
         VALUES (?, ?, 0, 0, NULL, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      )
      .run(nome, await guardarSenha(SENHA));
    pessoa = { id: Number(criada.lastInsertRowid) };
  }
  else db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await guardarSenha(SENHA), pessoa.id);
  ids.set(nome, pessoa.id);

  const jaEsta = db
    .prepare('SELECT 1 AS n FROM community_members WHERE community_id = ? AND user_id = ?')
    .get(comunidade.id, pessoa.id);
  if (!jaEsta) {
    db.prepare("INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, 'member')").run(
      comunidade.id,
      pessoa.id,
    );
  }
}
console.log(`${GENTE.length} pessoas de mentira na comunidade.`);

// ---------- A conta de avaliação entra junto ----------
//
// É a mesma que o revisor da Microsoft usa. Sem isto, ele entraria e veria uma comunidade vazia,
// enquanto as fotos da página mostram uma sala cheia — a pior impressão possível.
const teste = db.prepare('SELECT id FROM users WHERE username = ?').get('microsoft-teste');
if (teste) {
  const jaEsta = db
    .prepare('SELECT 1 AS n FROM community_members WHERE community_id = ? AND user_id = ?')
    .get(comunidade.id, teste.id);
  if (!jaEsta) {
    // Entra como dona: assim o revisor consegue abrir as telas de administração, e as fotos podem
    // ser tiradas com a mesma conta.
    db.prepare("INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, 'owner')").run(
      comunidade.id,
      teste.id,
    );
    console.log('A conta microsoft-teste entrou como dona.');
  }
} else {
  console.log('ATENÇÃO: a conta microsoft-teste não existe. Rode scripts/conta-de-teste.mjs antes.');
}

// ---------- A conversa ----------
//
// Apagada e reescrita a cada execução: rodar de novo tem de deixar a mesma tela, e não uma conversa
// repetida duas vezes.
const geral = porNome.get('geral');
db.prepare('DELETE FROM messages WHERE channel_id = ?').run(geral);

// As mensagens recebem horários crescentes terminando agora, para a conversa parecer recente na
// foto em vez de todas no mesmo minuto.
const agora = Date.now();
CONVERSA.forEach(([quem, texto], i) => {
  const quando = new Date(agora - (CONVERSA.length - i) * 90_000).toISOString();
  db.prepare('INSERT INTO messages (channel_id, user_id, content, created_at) VALUES (?, ?, ?, ?)').run(
    geral,
    ids.get(quem),
    texto,
    quando,
  );
});
console.log(`${CONVERSA.length} mensagens escritas em #geral.`);

// ---------- A prova ----------
//
// O script tenta entrar com a senha que acabou de definir, batendo na API de verdade.
//
// Existe porque escrever no banco e imprimir um texto não prova nada: a senha pode estar num
// formato que o servidor não reconhece, a conta pode estar barrada por confirmação de e-mail, ou o
// script pode ter escrito numa coluna que ninguém lê. Sem esta conferência, o primeiro a descobrir
// seria quem tentasse usar a senha do outro lado — e ele não teria como saber de quem é a culpa.
const API_LOCAL = process.env.API_LOCAL ?? 'http://localhost:3001';
try {
  const resposta = await fetch(`${API_LOCAL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: GENTE[0], password: SENHA }),
  });
  if (resposta.ok) {
    console.log(`\nConferido: ${GENTE[0]} consegue entrar com esta senha.`);
  } else {
    const erro = await resposta.text();
    console.log(`\nATENÇÃO: a senha NÃO funcionou (${resposta.status}). O servidor disse: ${erro.slice(0, 200)}`);
    console.log('Não adianta usá-la; me mostre esta mensagem.');
  }
} catch (erro) {
  console.log(`\n(não deu para conferir a senha daqui: ${erro.message})`);
  console.log('Não é necessariamente um problema — pode ser só o endereço interno da API.');
}

console.log('');
console.log('Pronto. Agora tire as fotos apontando para esta comunidade:');
console.log('  node e2e/capturas-da-loja.mjs');
console.log('');
console.log('Para pôr gente numa sala de voz antes da foto da chamada:');
console.log('');
console.log('  Usuários: ' + GENTE.join(', '));
console.log('  Senha:    ' + SENHA);
console.log('');
console.log('Copie a senha: ela é sorteada e não aparece de novo.');
console.log('Confira as imagens mesmo assim: nenhuma pode ter nome de pessoa real.');
