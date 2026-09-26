// Roda os testes de ponta a ponta, um de cada vez, e conta o resultado no fim.
//
//   npm run test:e2e              todos
//   npm run test:e2e -- coelhos   só um (ou alguns)
//
// Cada teste roda no seu próprio processo: um que trave não leva os outros junto.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SITE = process.env.SITE ?? 'http://localhost:5174';

/** Os que precisam do LiveKit no ar (voz, vídeo, tela), e não só da API e do site. */
const PRECISAM_DE_LIVEKIT = new Set(['sob-demanda']);

/**
 * Estes contam com ser a PRIMEIRA conta de um Syden recém-criado, porque a primeira conta vira dona e é
 * ela que acolhe ideias e administra. Dois deles na mesma rodada não cabem: o segundo já não seria dona.
 */
const PRECISAM_SER_A_PRIMEIRA_CONTA = new Set(['ideias', 'menu-elegante']);

const todos = readdirSync(AQUI)
  .filter((nome) => nome.endsWith('.mjs') && !['ajuda.mjs', 'rodar.mjs'].includes(nome))
  .map((nome) => nome.replace(/\.mjs$/, ''));

const pedidos = process.argv.slice(2);

const desconhecidos = pedidos.filter((nome) => !todos.includes(nome));
if (desconhecidos.length) {
  console.error(`Não conheço: ${desconhecidos.join(', ')}.\nTenho: ${todos.join(', ')}`);
  process.exit(1);
}

// A ordem pedida é respeitada: quem precisa ser a primeira conta tem que poder ser posto na frente.
const escolhidos = pedidos.length ? pedidos : todos;

const disputam = escolhidos.filter((nome) => PRECISAM_SER_A_PRIMEIRA_CONTA.has(nome));
if (disputam.length > 1) {
  console.warn(
    `\n⚠ ${disputam.join(' e ')} precisam, cada um, ser a primeira conta de um Syden vazio.\n` +
      `  Só o primeiro da fila vai conseguir. Rode um, apague o banco, rode o outro (veja e2e/LEIA.md).\n`,
  );
}

// Sem o site no ar, todos falhariam com um erro de rede confuso. Melhor dizer logo o que fazer.
try {
  await fetch(SITE, { signal: AbortSignal.timeout(4000) });
} catch {
  console.error(`O site não respondeu em ${SITE}.\n\nSuba a API e o site antes (veja e2e/LEIA.md).`);
  process.exit(1);
}

const rodar = (nome) =>
  new Promise((resolve) => {
    console.log(`\n${'─'.repeat(60)}\n▶ ${nome}${PRECISAM_DE_LIVEKIT.has(nome) ? '  (precisa do LiveKit no ar)' : ''}\n`);
    const filho = spawn(process.execPath, [join(AQUI, nome + '.mjs')], { stdio: 'inherit', cwd: join(AQUI, '..') });
    filho.on('close', (codigo) => resolve({ nome, passou: codigo === 0 }));
  });

const resultados = [];
for (const nome of escolhidos) resultados.push(await rodar(nome));

const falharam = resultados.filter((r) => !r.passou);
console.log(`\n${'═'.repeat(60)}`);
for (const { nome, passou } of resultados) console.log(passou ? `✔ ${nome}` : `✘ ${nome}`);
console.log(`\n${resultados.length - falharam.length} de ${resultados.length} passaram.`);
process.exit(falharam.length ? 1 : 0);
