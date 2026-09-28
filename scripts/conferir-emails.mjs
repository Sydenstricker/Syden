// Confere que todo endereço de e-mail escrito no site pode RECEBER mensagem.
//
// POR QUE ISTO EXISTE. Os termos do Syden passaram a dar um endereço para reclamação de direito autoral
// — e um endereço que não recebe é pior do que endereço nenhum. Sem ele, o titular procura outro caminho;
// com um endereço morto, ele escreve, a mensagem volta, e fica registrado que o Syden ofereceu um canal
// que não funciona. Na prática isso vira o argumento de que a plataforma foi negligente, que é
// exatamente o que o canal existia para evitar.
//
// A checagem é o registro MX do domínio. MX é o que diz ao mundo para onde mandar e-mail daquele
// domínio; sem MX, nenhuma mensagem chega, por mais certo que o endereço pareça.
//
//   node scripts/conferir-emails.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { resolveMx } from 'node:dns/promises';
import { join } from 'node:path';

const SITE = 'web/site';

const enderecos = new Map();
for (const nome of readdirSync(SITE)) {
  if (!nome.endsWith('.html')) continue;
  const texto = readFileSync(join(SITE, nome), 'utf8');
  for (const m of texto.matchAll(/mailto:([^"'>\s]+)/g)) {
    const endereco = m[1].toLowerCase();
    if (!enderecos.has(endereco)) enderecos.set(endereco, []);
    enderecos.get(endereco).push(nome);
  }
}

if (enderecos.size === 0) {
  console.log('Nenhum endereço de e-mail no site.');
  process.exit(0);
}

const dominios = new Set([...enderecos.keys()].map((e) => e.split('@')[1]).filter(Boolean));
const recebe = new Map();

for (const dominio of dominios) {
  try {
    const mx = await resolveMx(dominio);
    recebe.set(dominio, mx.length > 0 ? mx.map((r) => r.exchange).join(', ') : null);
  } catch {
    recebe.set(dominio, null);
  }
}

const mortos = [];
for (const [endereco, paginas] of enderecos) {
  const dominio = endereco.split('@')[1];
  const mx = recebe.get(dominio);
  const ok = Boolean(mx);
  console.log(`  ${ok ? 'OK ' : 'XX '} ${endereco.padEnd(26)} ${ok ? mx : 'SEM REGISTRO MX — não recebe nada'}`);
  console.log(`        citado em: ${[...new Set(paginas)].join(', ')}`);
  if (!ok) mortos.push(endereco);
}

console.log('');
if (mortos.length) {
  console.log(`${mortos.length} endereço(s) no site não recebem mensagem.`);
  console.log('');
  console.log('COMO RESOLVER, de graça, se o domínio já está na Cloudflare:');
  console.log('  Painel da Cloudflare → o domínio → Email → Email Routing → Enable.');
  console.log('  Crie um encaminhamento por endereço, todos para a sua caixa de sempre.');
  console.log('  A Cloudflare cria os registros MX sozinha. Não custa nada e não precisa de servidor.');
  console.log('');
  console.log('Para o Syden MANDAR e-mail desse domínio é outra coisa (Resend, ver server/src/email.ts):');
  console.log('  verifique o domínio no Resend e troque EMAIL_FROM. O código não muda.');
  process.exit(1);
}
console.log('Todos os endereços do site têm para onde receber.');
