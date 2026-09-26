import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mencionaVoce } from '../src/mencoes.js';

describe('a mensagem fala comigo?', () => {
  it('acende quando o nome é chamado', () => {
    assert.ok(mencionaVoce('@ana, dá uma olhada nisso', 'ana'));
    assert.ok(mencionaVoce('olha isso @ana', 'ana'));
    assert.ok(mencionaVoce('(@ana) e o resto', 'ana'));
  });

  it('não acende para um nome que só COMEÇA igual', () => {
    // Este é o erro clássico: a Ana receberia aviso toda vez que alguém chamasse a Anaclara.
    assert.equal(mencionaVoce('@anaclara vem cá', 'ana'), false);
    assert.equal(mencionaVoce('@ana_maria vem cá', 'ana'), false);
    assert.equal(mencionaVoce('@ana.paula vem cá', 'ana'), false);
  });

  it('não liga para maiúsculas', () => {
    assert.ok(mencionaVoce('@ANA olha', 'Ana'));
    assert.ok(mencionaVoce('@Ana olha', 'ana'));
  });

  it('@todos vale para todo mundo', () => {
    assert.ok(mencionaVoce('@todos, reunião agora', 'zeca'));
    assert.ok(mencionaVoce('@everyone, meeting now', 'zeca'));
  });

  it('não acende com o nome solto, sem o arroba', () => {
    assert.equal(mencionaVoce('a ana falou isso ontem', 'ana'), false);
  });

  it('nome com ponto não vira curinga', () => {
    // Sem escapar, o ponto da expressão casaria com qualquer letra e "@axb" acenderia para "a.b".
    assert.ok(mencionaVoce('@a.b oi', 'a.b'));
    assert.equal(mencionaVoce('@axb oi', 'a.b'), false);
  });

  it('funciona com acento e com nome de outros alfabetos', () => {
    assert.ok(mencionaVoce('@joão vem', 'João'));
    assert.equal(mencionaVoce('@joãozinho vem', 'joão'), false, 'acento não pode quebrar a fronteira');
    assert.ok(mencionaVoce('@анна привет', 'Анна'));
  });

  it('texto vazio ou sem nome não acende nada', () => {
    assert.equal(mencionaVoce('', 'ana'), false);
    assert.equal(mencionaVoce('@ana', ''), false);
  });
});
