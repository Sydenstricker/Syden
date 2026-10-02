// ===================================================================================================
// A CAIXA-PRETA: o que sobrou de contas excluídas, por 90 dias.
//
// POR QUE ELA EXISTE. Alguém comete uma atrocidade, apaga a conta, e a prova vai junto — foi o buraco
// que o Sydenstricker apontou. O Syden apaga os dados pessoais na exclusão, o que é certo para quem só
// quis ir embora, e isso deixava sem resposta o pedido judicial que chega depois.
//
// POR QUE ELA SÓ EXISTE AQUI, e não numa tela do app. Não há rota para este conteúdo. Nenhuma, nem
// para o dono do Syden. Quem quiser lê-lo precisa entrar NO SERVIDOR por SSH e rodar este comando —
// o que exige a chave da máquina e deixa rastro no próprio servidor. Uma tela de administração
// transformaria a caixa-preta num arquivo: bastaria um `isAdmin` errado para ela virar um diretório
// de tudo o que todo mundo já apagou.
//
// O QUE TEM DENTRO: quem era a pessoa, tudo o que ela escreveu (com canal, hora e os arquivos que
// anexou) e as ideias que mandou. A SENHA NÃO ESTÁ AQUI: o hash não prova nada em lugar nenhum, e
// guardá-lo seria só risco.
//
// SOME SOZINHA. O servidor apaga o que passou dos 90 dias na subida e uma vez por dia. Este script
// não precisa limpar nada, e de propósito NÃO APAGA: ele só lê.
//
//   sudo docker compose exec api node scripts/caixa-preta.mjs              quem está lá dentro
//   sudo docker compose exec api node scripts/caixa-preta.mjs 29           tudo da conta 29
//   sudo docker compose exec api node scripts/caixa-preta.mjs 29 --json    o mesmo, para anexar
// ===================================================================================================
import { DatabaseSync } from 'node:sqlite';
import { CAMINHO_DO_BANCO } from './mover-arquivos.mjs';

const db = new DatabaseSync(CAMINHO_DO_BANCO, { readOnly: true });
const argumentos = process.argv.slice(2);
const comoJson = argumentos.includes('--json');
const numero = argumentos.find((a) => /^\d+$/.test(a));

const DIAS = 90;
const diasDesde = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

if (!numero) {
  const linhas = db.prepare('SELECT user_id AS id, excluida_em AS quando, dados FROM contas_retidas ORDER BY excluida_em DESC').all();
  if (linhas.length === 0) {
    console.log('A caixa-preta está vazia.');
    process.exit(0);
  }
  console.log(`${linhas.length} conta(s) retida(s). Cada uma sai sozinha ${DIAS} dias depois da exclusão.\n`);
  console.log('  conta  excluída em            dias  restam  quem era                    mensagens');
  console.log('  ' + '─'.repeat(84));
  for (const linha of linhas) {
    const d = JSON.parse(linha.dados);
    const idade = diasDesde(linha.quando);
    const quem = `${d.pessoa?.username ?? '?'} <${d.pessoa?.email ?? 'sem e-mail'}>`;
    console.log(
      `  ${String(linha.id).padStart(5)}  ${linha.quando.slice(0, 19).replace('T', ' ')}  ${String(idade).padStart(4)}  ${String(
        Math.max(0, DIAS - idade),
      ).padStart(6)}  ${quem.slice(0, 26).padEnd(26)}  ${String(d.mensagens?.length ?? 0).padStart(9)}`,
    );
  }
  console.log('\nPara ver uma: node scripts/caixa-preta.mjs <conta>');
  process.exit(0);
}

const linha = db.prepare('SELECT user_id AS id, excluida_em AS quando, dados FROM contas_retidas WHERE user_id = ?').get(Number(numero));
if (!linha) {
  console.error(`A conta ${numero} não está na caixa-preta. Ou nunca esteve, ou já passou dos ${DIAS} dias.`);
  process.exit(1);
}

if (comoJson) {
  console.log(linha.dados);
  process.exit(0);
}

const d = JSON.parse(linha.dados);
const idade = diasDesde(linha.quando);
console.log(`CONTA ${linha.id}`);
console.log(`  excluída em   ${linha.quando}`);
console.log(`  há            ${idade} dia(s); sai da caixa-preta em ${Math.max(0, DIAS - idade)}`);
console.log(`  nome          ${d.pessoa?.username ?? '—'}`);
console.log(`  e-mail        ${d.pessoa?.email ?? '—'}`);
console.log(`  criada em     ${d.pessoa?.criadaEm ?? '—'}`);
console.log(`  cargo         ${d.pessoa?.dono ? 'dono do Syden' : d.pessoa?.admin ? 'administrador' : 'membro'}`);

const anexosPor = new Map();
for (const a of d.anexos ?? []) {
  if (!anexosPor.has(a.mensagem)) anexosPor.set(a.mensagem, []);
  anexosPor.get(a.mensagem).push(a);
}

console.log(`\n${(d.mensagens ?? []).length} MENSAGEM(NS)`);
for (const m of d.mensagens ?? []) {
  const onde = m.nomeDoCanal ? `#${m.nomeDoCanal}` : `canal ${m.canal}`;
  console.log(`\n  [${m.quando}] ${onde}`);
  for (const parte of String(m.texto ?? '').split('\n')) console.log(`    ${parte}`);
  for (const a of anexosPor.get(m.id) ?? []) {
    // O arquivo continua no disco, endereçado pelo conteúdo. Com o sha dá para achá-lo em
    // arquivos/<2 primeiras letras>/<sha> — ver server/src/arquivos.ts.
    console.log(`    [anexo] ${a.nome} · ${a.mime} · ${a.bytes} bytes · sha ${a.sha ?? '(dentro do banco)'}`);
  }
}

if ((d.ideias ?? []).length > 0) {
  console.log(`\n${d.ideias.length} IDEIA(S) MANDADA(S)`);
  for (const i of d.ideias) console.log(`  ${i.acolhidaEm ? '(acolhida) ' : ''}${i.texto}`);
}
