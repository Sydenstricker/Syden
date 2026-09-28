// Confere se a credencial do Shield funciona, sem depender de alguém enviar uma foto de verdade.
//
// POR QUE ISTO EXISTE. Credencial errada não dá erro visível: o Syden segue funcionando, cada imagem
// cai na fila de reconferência, e ninguém percebe até a fila crescer. O sintoma de "está protegido" e o
// de "não está protegido" são o mesmo — tela normal. Então a credencial se prova aqui, uma vez, em vez
// de se supor.
//
// A IMAGEM DE TESTE É GERADA AQUI: um PNG de um pixel branco, escrito byte a byte. Não é foto de
// ninguém, não é de usuário, e não precisa de arquivo no disco. Uma requisição, e só.
//
// No servidor, dentro do contêiner da API (é lá que o .env está carregado):
//   docker compose exec api node scripts/conferir-shield.mjs

const ENDERECO = 'https://shield.projectarachnid.com/v1/media/';

const usuario = process.env.SHIELD_USUARIO ?? '';
const senha = process.env.SHIELD_SENHA ?? '';

if (!usuario || !senha) {
  console.log('SHIELD_USUARIO e SHIELD_SENHA não estão definidos neste processo.');
  console.log('');
  console.log('Se você já os pôs no deploy/.env, falta reconstruir:');
  console.log('  sudo docker compose up -d --build');
  console.log('O --build não é opcional: o código mora dentro da imagem.');
  process.exit(1);
}

console.log(`Usuário: ${usuario}`);
console.log(`Senha:   ${senha.length} caracteres (não mostro o valor)`);
console.log('');

/** Um PNG de 1x1 branco, o menor arquivo de imagem válido que existe. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const credencial = Buffer.from(`${usuario}:${senha}`).toString('base64');

try {
  const resposta = await fetch(ENDERECO, {
    method: 'POST',
    headers: { authorization: `Basic ${credencial}`, 'content-type': 'image/png' },
    body: new Uint8Array(PIXEL),
    signal: AbortSignal.timeout(15_000),
  });

  if (resposta.status === 401 || resposta.status === 403) {
    console.log(`RECUSADO (${resposta.status}): a credencial não foi aceita.`);
    console.log('Confira o usuário e a senha no painel do Shield. Não é o e-mail de login do site:');
    console.log('é a credencial da API, criada em Credentials / API key.');
    process.exit(1);
  }

  if (!resposta.ok) {
    console.log(`Resposta ${resposta.status}. A credencial pode estar certa e o serviço, instável.`);
    console.log(await resposta.text().catch(() => ''));
    process.exit(1);
  }

  const corpo = await resposta.json();
  console.log('FUNCIONA. O Shield respondeu:');
  console.log(`  classificação: ${corpo.classification ?? '(não veio)'}`);
  console.log(`  correspondeu:  ${corpo.is_match === true ? 'sim' : 'não'}`);
  console.log('');
  console.log('Um pixel branco dando "no-known-match" é exatamente o esperado — a resposta certa aqui é');
  console.log('o Shield dizer que não conhece este arquivo. O que se provou foi a credencial e o caminho.');
} catch (erro) {
  /**
   * SEPARA OS TRÊS MOTIVOS, porque o Node não separa.
   *
   * "fetch failed" é o que ele diz para nome que não existe, para porta fechada e para servidor fora do
   * ar — três problemas com soluções opostas. Na primeira vez que isto rodou, a mensagem genérica me fez
   * suspeitar da rede do servidor, e a causa era um domínio escrito errado por mim (.ca em vez de .com).
   * Uma pergunta ao DNS separa os casos em um segundo.
   */
  const causa = erro.cause?.code ?? erro.code ?? '';
  console.log(`Não deu para falar com o Shield: ${erro.message}${causa ? ' (' + causa + ')' : ''}`);
  console.log('');

  const { lookup } = await import('node:dns/promises');
  const dominio = new URL(ENDERECO).hostname;
  try {
    const { address } = await lookup(dominio);
    console.log(`O nome ${dominio} resolve para ${address}, então o DNS está bem.`);
    console.log('Sobra a saída de rede: o servidor pode estar bloqueando HTTPS para fora, ou o Shield');
    console.log('está fora do ar. Teste com:  curl -sS -o /dev/null -w "%{http_code}\n" ' + ENDERECO);
  } catch {
    console.log(`O nome ${dominio} NÃO RESOLVE. Não é a sua rede: é o endereço.`);
    console.log('Confira o domínio em server/src/shield.ts — foi exatamente aqui que eu errei uma vez.');
  }
  process.exit(1);
}
