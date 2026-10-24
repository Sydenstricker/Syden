import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nivelDoPing, pingDoRelatorio } from '../src/ping';

const relatorio = (linhas: Record<string, unknown>[]) => new Map(linhas.map((l) => [l.id as string, l])) as unknown as RTCStatsReport;

describe('ping', () => {
  it('usa o par que o transporte diz estar em uso', () => {
    const r = relatorio([
      { id: 't', type: 'transport', selectedCandidatePairId: 'b' },
      { id: 'a', type: 'candidate-pair', currentRoundTripTime: 0.3, nominated: true, state: 'succeeded' },
      { id: 'b', type: 'candidate-pair', currentRoundTripTime: 0.0424 },
    ]);
    assert.equal(pingDoRelatorio(r), 42);
  });

  it('sem o transporte (Firefox), vale o par nomeado que funcionou', () => {
    const r = relatorio([
      { id: 'a', type: 'candidate-pair', currentRoundTripTime: 0.5, state: 'failed' },
      { id: 'b', type: 'candidate-pair', currentRoundTripTime: 0.12, nominated: true, state: 'succeeded' },
    ]);
    assert.equal(pingDoRelatorio(r), 120);
  });

  it('sem medida, não inventa', () => {
    assert.equal(pingDoRelatorio(undefined), null);
    assert.equal(pingDoRelatorio(relatorio([{ id: 'a', type: 'candidate-pair', nominated: true, state: 'succeeded' }])), null);
  });

  it('a cor', () => {
    assert.equal(nivelDoPing(40), 'bom');
    assert.equal(nivelDoPing(180), 'medio');
    assert.equal(nivelDoPing(400), 'ruim');
  });
});
