// O gênero do jogo transmitido (generoDoJogo.ts): só o gênero vai para os outros, e só o que está na tabela tem um.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { _porGenero, GENEROS, generoDoPrograma } from '../src/generoDoJogo';

test('os jogos que ele citou caem no gênero certo, com ou sem pasta e em qualquer caixa', () => {
  assert.equal(generoDoPrograma('League of Legends.exe'), 'moba');
  assert.equal(generoDoPrograma('C:\\Riot Games\\League of Legends\\Game\\League of Legends.exe'), 'moba');
  assert.equal(generoDoPrograma('dota2.exe'), 'moba');
  assert.equal(generoDoPrograma('cs2.exe'), 'tiro');
  assert.equal(generoDoPrograma('VALORANT-Win64-Shipping.exe'), 'tiro');
  assert.equal(generoDoPrograma('FC25.exe'), 'futebol');
  assert.equal(generoDoPrograma('eFootball.exe'), 'futebol');
});

test('o que não é jogo da tabela não tem gênero (o navegador, o editor, nada)', () => {
  for (const exe of ['chrome.exe', 'msedge.exe', 'firefox.exe', 'Code.exe', 'Discord.exe', 'explorer.exe', 'javaw.exe', '', null, undefined]) {
    assert.equal(generoDoPrograma(exe), null, String(exe));
  }
});

test('a tabela é coerente: todo gênero tem jogo, nenhum executável em dois gêneros, tudo em minúscula', () => {
  const vistos = new Map<string, string>();
  for (const g of GENEROS) {
    assert.ok(_porGenero[g].length > 0, g);
    for (const exe of _porGenero[g]) {
      assert.equal(exe, exe.toLowerCase(), exe);
      assert.ok(exe.endsWith('.exe'), exe);
      assert.ok(!vistos.has(exe), `${exe} está em ${vistos.get(exe)} e em ${g}`);
      vistos.set(exe, g);
    }
  }
});
