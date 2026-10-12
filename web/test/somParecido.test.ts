import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PARECIDO, impressaoDe, semelhanca } from '../src/somParecido';

// O mesmo som recodificado tem bytes diferentes e passa pela trava do arquivo repetido. Este teste prova
// a comparação PELO SOM com sinais montados aqui: o mesmo "grito" com volume, taxa e silêncio diferentes
// tem de dar parecido; um som diferente, não.

const TAXA = 8000;

/** Um som de teste: rajadas de um tom, com o volume subindo e caindo no ritmo dado. */
function som(ritmo: number[], { taxa = TAXA, ganho = 1, silencioAntes = 0, ruido = 0 } = {}) {
  const porNota = Math.round(taxa * 0.15);
  const total = Math.round(silencioAntes * taxa) + ritmo.length * porNota;
  const amostras = new Float32Array(total);
  let i = Math.round(silencioAntes * taxa);
  let semente = 7;
  for (const nivel of ritmo) {
    for (let k = 0; k < porNota; k++, i++) {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      amostras[i] = ganho * nivel * Math.sin((2 * Math.PI * 440 * i) / taxa) + ruido * (semente / 2147483648 - 0.5);
    }
  }
  return impressaoDe(amostras, taxa)!;
}

const RITMO_DO_GRITO = [0.2, 0.9, 1, 0.6, 0.1, 0.8, 0.3, 0.05, 0.7, 0.4];
const OUTRO_RITMO = [1, 0.1, 0.1, 0.9, 0.2, 0.2, 1, 0.1, 0.5, 0.9];

describe('o mesmo som, pelo som', () => {
  it('recodificado (outro volume, outra taxa, um chiado) ainda é o mesmo', () => {
    const original = som(RITMO_DO_GRITO);
    const recodificado = som(RITMO_DO_GRITO, { taxa: 11025, ganho: 0.6, ruido: 0.01 });
    assert.ok(semelhanca(original, recodificado) >= PARECIDO, String(semelhanca(original, recodificado)));
  });

  it('com meio segundo de silêncio a mais no começo, ainda é o mesmo', () => {
    const original = som(RITMO_DO_GRITO);
    const comSilencio = som(RITMO_DO_GRITO, { silencioAntes: 0.5 });
    assert.ok(semelhanca(original, comSilencio) >= PARECIDO);
  });

  it('outro som, da mesma duração, não é o mesmo', () => {
    assert.ok(semelhanca(som(RITMO_DO_GRITO), som(OUTRO_RITMO)) < PARECIDO);
  });

  it('duração muito diferente não é o mesmo, mesmo com forma parecida', () => {
    assert.equal(semelhanca(som(RITMO_DO_GRITO), som([...RITMO_DO_GRITO, ...RITMO_DO_GRITO])), 0);
  });

  it('silêncio puro não tem forma: não vira palpite', () => {
    assert.equal(impressaoDe(new Float32Array(8000), TAXA), null);
  });
});

describe('a faxina dos repetidos que já existem', () => {
  it('junta em grupos quem parece o mesmo, e deixa de fora o diferente e o que não decodificou', async () => {
    const { agruparParecidos } = await import('../src/somParecido');
    const sons = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const impressoes = new Map([
      [1, som(RITMO_DO_GRITO)],
      [2, som(OUTRO_RITMO)],
      [3, som(RITMO_DO_GRITO, { taxa: 11025, ganho: 0.5 })],
      [4, null], // não deu para decodificar: fica de fora, sem palpite
    ]);
    assert.deepEqual(
      agruparParecidos(sons, impressoes).map((g) => g.map((s) => s.id)),
      [[1, 3]],
    );
  });
});
