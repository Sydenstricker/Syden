// O COELHO DO CRIADOR (10/11/2026). A receita mora em duas cópias iguais byte a byte (o site monta, o servidor confere), e as
// 16 sugestões têm de ser receitas que o servidor aceita e que as tiras de public/coelho/ sabem desenhar.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { codigo, corpoDe, CORPOS, lerCodigo, partesDoCorpo, PRESETS, receitaDe, RECEITA_DO_MASCOTE } from '../src/coelho/receita.ts';

const raiz = new URL('../../', import.meta.url);

describe('a receita do coelho', () => {
  it('as duas cópias são iguais byte a byte', () => {
    assert.equal(readFileSync(new URL('web/src/coelho/receita.ts', raiz), 'utf8'), readFileSync(new URL('server/src/coelho-receita.ts', raiz), 'utf8'));
  });

  it('as 16 sugestões existem, voltam iguais do código e o corpo delas tem desenho', () => {
    const dados = JSON.parse(readFileSync(new URL('web/public/coelho/dados.json', raiz), 'utf8'));
    for (let n = 1; n <= 16; n++) {
      const r = PRESETS[n];
      assert.ok(r, `falta a sugestão ${n}`);
      assert.deepEqual(lerCodigo(codigo(r)), r, `a sugestão ${n} não volta igual do código`);
      const corpo = dados.corpos[r.corpo];
      assert.ok(corpo?.animacoes.parado?.['south-east'], `o corpo ${r.corpo} não tem o parado`);
      if (r.cabeca) assert.ok(corpo.camadas[r.cabeca]?.length === 4, `o ${r.corpo} não tem o ${r.cabeca} nas 4 direções`);
      if (r.pescoco) assert.ok(corpo.camadas[r.pescoco]?.length === 4, `o ${r.corpo} não tem a ${r.pescoco} nas 4 direções`);
    }
  });

  it('o coelho de cada um na cena: a receita, senão a sugestão, senão o mascote', () => {
    assert.deepEqual(receitaDe({ coelho: codigo(PRESETS[3]) }), PRESETS[3]);
    assert.deepEqual(receitaDe({ coelho: null, avatarPronto: 5 }), PRESETS[5]);
    assert.deepEqual(receitaDe({ coelho: 'lixo', avatarPronto: null }), RECEITA_DO_MASCOTE);
  });

  it('o tipo de corpo: cada pasta é uma combinação de corpo base, tipo e roupa, e volta igual', () => {
    for (const c of CORPOS) {
      const { base, tipo, veste } = partesDoCorpo(c);
      assert.equal(corpoDe(base, tipo, veste), c, c);
      assert.equal(lerCodigo(codigo({ ...RECEITA_DO_MASCOTE, corpo: c }))?.corpo, c, `o código guarda ${c}`);
    }
    assert.equal(corpoDe('musculoso', 'masculino', 'curta'), null, 'o forte não tem moletom curto');
  });
});
