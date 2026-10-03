import assert from 'node:assert/strict';
import { it } from 'node:test';
import { atividadeAgora } from '../src/Farol';
import type { Community, VoiceMember } from '../src/types';

const comunidade = (id: number) => ({ id, name: `C${id}` }) as Community;
const naVoz = (userId: number, communityId: number) =>
  ({ userId, username: `u${userId}`, communityId, channelId: 1, muted: false, deafened: false, video: false, screen: false, screenName: null }) as VoiceMember;

it('o farol só acende onde há gente, a mais cheia primeiro', () => {
  const voz = { 1: [naVoz(10, 1)], 2: [naVoz(11, 2), naVoz(12, 2)], 3: [] };
  const lista = atividadeAgora([comunidade(1), comunidade(2), comunidade(3)], voz, 99);
  assert.deepEqual(lista.map((a) => a.community.id), [2, 1]);
});

it('quem olha não aparece: estar sozinho numa chamada não é notícia para si mesmo', () => {
  const voz = { 1: [naVoz(99, 1)], 2: [naVoz(99, 2), naVoz(11, 2)] };
  const lista = atividadeAgora([comunidade(1), comunidade(2)], voz, 99);
  assert.deepEqual(lista.map((a) => a.community.id), [2]);
  assert.deepEqual(lista[0].pessoas.map((p) => p.userId), [11]);
});
