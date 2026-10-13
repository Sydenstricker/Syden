import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { CATEGORIAS, RODADAS_STOP } from '../../server/src/minijogo-stop';
import { CATEGORIAS as CATEGORIAS_DO_SERVIDOR, OBJETOS as DO_SERVIDOR } from '../../server/src/minijogos';
import { FIGURAS_DO_TAMANHO } from '../src/figurasDoTamanho';
import { IDIOMAS } from '../src/i18n/idiomas';
import { CATEGORIAS_DO_STOP, CATEGORIAS_DO_TAMANHO, letrasDoStop, nomeDoIdioma, OBJETOS, SITES_PARA_TRANSMITIR, tamanhoLegivel } from '../src/minijogos';

describe('mini-games: o Stop', () => {
  it('o site e o servidor têm as mesmas categorias', () => {
    assert.deepEqual(Object.keys(CATEGORIAS_DO_STOP).sort(), [...CATEGORIAS].sort());
  });

  it('todo idioma tem letras para sortear as rodadas, sem repetir', () => {
    for (const { codigo } of IDIOMAS) {
      const letras = Array.from(letrasDoStop(codigo).letras);
      assert.equal(new Set(letras).size, letras.length, `${codigo}: letra repetida`);
      assert.ok(letras.length >= RODADAS_STOP, codigo);
    }
  });
});

describe('mini-games: o "Qual é o tamanho?"', () => {
  it('o site e o servidor têm os mesmos objetos (o nome mora aqui, o tamanho lá)', () => {
    assert.deepEqual(Object.keys(OBJETOS).sort(), Object.keys(DO_SERVIDOR).sort());
  });

  it('as categorias são as mesmas do servidor (mais o "tudo"), e o botão de cada uma usa figuras que existem', () => {
    assert.deepEqual(CATEGORIAS_DO_TAMANHO.map((c) => c.id).sort(), ['tudo', ...Object.keys(CATEGORIAS_DO_SERVIDOR)].sort());
    for (const c of CATEGORIAS_DO_TAMANHO) for (const id of c.figuras) assert.ok(OBJETOS[id], `${c.id}: ${id}`);
  });

  it('todo objeto tem a figura, medida, e a licença dela vai junto', () => {
    for (const id of Object.keys(OBJETOS)) {
      assert.ok(FIGURAS_DO_TAMANHO[id], `${id}: falta em figurasDoTamanho.ts (rode web/scripts/figuras-do-tamanho.mjs)`);
      assert.ok(fs.existsSync(new URL(`../public/tamanho/${id}.png`, import.meta.url)), `${id}: falta a figura`);
    }
    assert.match(fs.readFileSync(new URL('../public/tamanho/LICENCA.txt', import.meta.url), 'utf8'), /MIT License/);
  });

  it('o tamanho aparece na unidade que faz sentido', () => {
    assert.equal(tamanhoLegivel(0.0002, 'pt-BR'), '2 µm');
    assert.equal(tamanhoLegivel(0.5, 'pt-BR'), '5 mm');
    assert.equal(tamanhoLegivel(6.7, 'pt-BR'), '6,7 cm');
    assert.equal(tamanhoLegivel(550, 'pt-BR'), '5,5 m');
    assert.equal(tamanhoLegivel(347_400_000, 'pt-BR'), '3.474 km');
    assert.equal(tamanhoLegivel(550, 'en'), '5.5 m');
  });
});

describe('mini-games: o desenha e adivinha', () => {
  it('o site e o servidor têm as mesmas palavras (o nome mora aqui, o id lá)', async () => {
    const { PALAVRAS_DO_DESENHO: DO_SERVIDOR_D } = await import('../../server/src/minijogo-desenho');
    const { PALAVRAS_DO_DESENHO } = await import('../src/minijogos');
    assert.deepEqual(Object.keys(PALAVRAS_DO_DESENHO).sort(), [...DO_SERVIDOR_D].sort());
  });
});

describe('mini-games: os sites para jogar fora', () => {
  it('todo mundo vê todos; o de uma língua só leva o nome dela, na língua de quem lê', () => {
    const termo = SITES_PARA_TRANSMITIR.find((s) => s.nome === 'Termo');
    assert.equal(termo?.idioma, 'pt');
    assert.equal(nomeDoIdioma('pt', 'en'), 'Portuguese');
    assert.equal(nomeDoIdioma('pt', 'pt-BR'), 'português');
  });

  it('o que roda dentro do Syden está liberado na política de segurança', async () => {
    const { CSP } = await import('../../e2e/politica-de-seguranca.mjs');
    const quadros = CSP.split('; ').find((d: string) => d.startsWith('frame-src')) ?? '';
    for (const site of SITES_PARA_TRANSMITIR.filter((s) => s.embutir)) assert.ok(quadros.includes(site.endereco), site.nome);
  });
});
