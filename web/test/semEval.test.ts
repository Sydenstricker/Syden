import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'node:test';

// A POLÍTICA DE SEGURANÇA DO SITE PROÍBE `eval`, e ela mora na Cloudflare — longe do repositório e
// longe do servidor de desenvolvimento. Tudo o que depender de `eval` funciona aqui e falha calado em
// produção. Foi assim que os ícones animados do menu sumiram três vezes sem ninguém reproduzir: o
// lottie-web completo roda as expressões dos desenhos com `eval`. Ver AnimatedIcon.tsx.

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

it('ninguém importa o lottie-web completo, que precisa de eval', () => {
  const src = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const culpados = arquivos(src).filter((arquivo) => /from 'lottie-web'|import\('lottie-web'\)/.test(readFileSync(arquivo, 'utf8')));
  assert.deepEqual(culpados, [], "use 'lottie-web/build/player/lottie_light', que não executa expressões");
});
