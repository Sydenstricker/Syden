import { readdirSync, readFileSync } from 'node:fs';
import * as db from './db.js';
import { sniffMime } from './media.js';

// Pacote de demonstração (emojis e sons criados para o Syden), instalado em cada comunidade nova.
// Se alguém apagar um item depois, ele não volta. Quando o pacote de sons ganha uma versão nova,
// os sons antigos do pacote são trocados pelos novos; os enviados pelos usuários não são tocados.
// Os sons são arquivos grandes, então só a primeira comunidade os recebe: as outras enviam os seus.
const ASSETS = new URL('../assets/', import.meta.url);
const seededKey = (communityId: number) => `expressions.seeded.${communityId}`;
const soundPackKey = (communityId: number) => `sounds.pack.${communityId}`;
const SOUND_PACK_VERSION = 2;

function installSoundPack(communityId: number) {
  const soundDir = new URL('sounds/', ASSETS);
  const manifest = JSON.parse(readFileSync(new URL('sounds.json', soundDir), 'utf8')) as { file: string; name: string; icon: string }[];
  for (const sound of manifest) {
    const data = readFileSync(new URL(sound.file, soundDir));
    db.createSound(communityId, sound.name, sound.icon, sniffMime(data) ?? 'audio/wav', data, null);
  }
  db.setKv(soundPackKey(communityId), String(SOUND_PACK_VERSION));
}

export function seedExpressions(communityId: number, { sounds }: { sounds: boolean }) {
  if (db.getKv(seededKey(communityId))) {
    if (sounds && Number(db.getKv(soundPackKey(communityId)) ?? 1) < SOUND_PACK_VERSION) {
      db.deletePackSounds(communityId);
      installSoundPack(communityId);
    }
    return;
  }

  const emojiDir = new URL('emojis/', ASSETS);
  for (const file of readdirSync(emojiDir).filter((f) => f.endsWith('.png'))) {
    const name = file.replace(/\.png$/, '');
    if (!db.emojiNameTaken(communityId, name)) {
      db.createEmoji(communityId, name, 'image/png', readFileSync(new URL(file, emojiDir)), null);
    }
  }
  if (sounds) installSoundPack(communityId);
  db.setKv(seededKey(communityId), new Date().toISOString());
}

/**
 * Repõe os itens do pacote de demonstração que foram apagados, sem mexer no que a comunidade enviou nem
 * duplicar o que já está lá. É o "desfazer" de quem apagou tudo por engano.
 */
export function restorePack(communityId: number): { emojis: number; sounds: number } {
  const emojiDir = new URL('emojis/', ASSETS);
  let emojis = 0;
  for (const file of readdirSync(emojiDir).filter((f) => f.endsWith('.png'))) {
    const name = file.replace(/\.png$/, '');
    if (!db.emojiNameTaken(communityId, name)) {
      db.createEmoji(communityId, name, 'image/png', readFileSync(new URL(file, emojiDir)), null);
      emojis++;
    }
  }

  const soundDir = new URL('sounds/', ASSETS);
  const manifest = JSON.parse(readFileSync(new URL('sounds.json', soundDir), 'utf8')) as { file: string; name: string; icon: string }[];
  const existing = new Set(db.listSounds(communityId).map((s) => s.name.toLowerCase()));
  let sounds = 0;
  for (const sound of manifest) {
    if (existing.has(sound.name.toLowerCase())) continue;
    const data = readFileSync(new URL(sound.file, soundDir));
    db.createSound(communityId, sound.name, sound.icon, sniffMime(data) ?? 'audio/wav', data, null);
    sounds++;
  }

  db.setKv(seededKey(communityId), db.getKv(seededKey(communityId)) ?? new Date().toISOString());
  db.setKv(soundPackKey(communityId), String(SOUND_PACK_VERSION));
  return { emojis, sounds };
}

/**
 * Na subida do servidor, garante o pacote na comunidade mais antiga. Ela existia antes das chaves por
 * comunidade, então herda o que foi marcado como instalado na versão anterior.
 */
export function seedFirstCommunity() {
  const community = db.defaultCommunity();
  if (!community) return; // servidor novo: a primeira comunidade nasce no primeiro cadastro
  for (const [old, current] of [
    ['expressions.seeded', seededKey(community.id)],
    ['sounds.pack', soundPackKey(community.id)],
  ]) {
    const value = db.getKv(old);
    if (value && !db.getKv(current)) db.setKv(current, value);
  }
  seedExpressions(community.id, { sounds: true });
}
