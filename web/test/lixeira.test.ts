import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { DIAS_NA_LIXEIRA, diasQueRestam } from '../src/lixeira';

const DIA = 24 * 60 * 60_000;
const agora = Date.parse('2026-09-29T12:00:00.000Z');

describe('o prazo para trazer um canal de volta', () => {
  it('apagado agora mesmo, o prazo está inteiro', () => {
    assert.equal(diasQueRestam(new Date(agora).toISOString(), 30, agora), 30);
  });

  it('conta para cima: faltando dois dias e pouco, a tela diz três', () => {
    // Arredondar para baixo prometeria MENOS tempo do que existe, e alguém desistiria de um canal
    // que ainda estava lá.
    const apagado = new Date(agora - 27.7 * DIA).toISOString();
    assert.equal(diasQueRestam(apagado, 30, agora), 3);
  });

  it('no último dia, ainda diz 1 — e não 0', () => {
    const apagado = new Date(agora - 29.5 * DIA).toISOString();
    assert.equal(diasQueRestam(apagado, 30, agora), 1);
  });

  it('passado do prazo, nunca devolve número negativo', () => {
    const apagado = new Date(agora - 40 * DIA).toISOString();
    assert.equal(diasQueRestam(apagado, 30, agora), 0);
  });

  it('data ilegível dá o prazo cheio, e não NaN na tela', () => {
    // "some em NaN dias" é pior que uma estimativa generosa, e o defeito seria do servidor.
    assert.equal(diasQueRestam('isso não é data', 30, agora), 30);
  });

  it('o prazo vem do servidor, não está cravado aqui', () => {
    // Se um dia DIAS_NA_LIXEIRA mudar lá, a tela acompanha sem ninguém lembrar de mexer aqui.
    assert.equal(diasQueRestam(new Date(agora - 3 * DIA).toISOString(), 7, agora), 4);
  });
});

describe('o prazo que a tela promete', () => {
  it('é o MESMO que o servidor obedece', () => {
    // Não é teste de tipo nem de gosto: é a única coisa que impede o aviso de excluir de prometer
    // trinta dias enquanto a varredura apaga em sete. O servidor é a autoridade; aqui só se confere
    // que a cópia não ficou para trás.
    const servidor = readFileSync(new URL('../../server/src/routes.ts', import.meta.url), 'utf8');
    const achado = servidor.match(/DIAS_NA_LIXEIRA\s*=\s*(\d+)/);
    assert.ok(achado, 'não achei DIAS_NA_LIXEIRA em server/src/routes.ts — se ele mudou de nome, esta guarda tem de acompanhar');
    assert.equal(
      DIAS_NA_LIXEIRA,
      Number(achado[1]),
      'o prazo na tela e o prazo da varredura têm de ser o mesmo número',
    );
  });
});
