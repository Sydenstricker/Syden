import { readdirSync, readFileSync } from 'node:fs';
import * as db from './db.js';
import { sniffMime } from './media.js';

// Emojis de demonstração (instalados em cada comunidade nova) e os pacotes de sons que vêm de fábrica
// com o Syden. Os pacotes são do servidor inteiro: os arquivos ficam guardados uma vez só e cada pessoa
// escolhe quais quer no seu soundboard.
const ASSETS = new URL('../assets/', import.meta.url);
const SOUND_DIR = new URL('sounds/', ASSETS);
const seededKey = (communityId: number) => `expressions.seeded.${communityId}`;
const PACKS_KEY = 'sounds.packs.version';
// Ao subir este número, os pacotes de fábrica são conferidos de novo (o que falta é reposto).
const PACKS_VERSION = 1;
/** O pacote que já vem instalado para quem cria conta; os outros ficam a um clique no catálogo. */
const DEFAULT_PACK = 'Básico';

interface PackManifest {
  folder: string;
  name: string;
  icon: string;
  description: string;
  sounds: { file: string; name: string; icon: string }[];
}

function readManifest(): PackManifest[] {
  return JSON.parse(readFileSync(new URL('packs.json', SOUND_DIR), 'utf8')) as PackManifest[];
}

/** Repõe os sons que faltam num pacote de fábrica, sem duplicar o que já está lá. */
function fillPack(packId: number, manifest: PackManifest): number {
  const existing = new Set(db.packSounds(packId).map((s) => s.name.toLowerCase()));
  let added = 0;
  for (const sound of manifest.sounds) {
    if (existing.has(sound.name.toLowerCase())) continue;
    const data = readFileSync(new URL(`${manifest.folder}/${sound.file}`, SOUND_DIR));
    db.createPackSound(packId, sound.name, sound.icon, sniffMime(data) ?? 'audio/mpeg', data);
    added++;
  }
  return added;
}

/**
 * Cria os pacotes que acompanham o Syden. Roda na subida do servidor; se alguém apagar um som de um
 * pacote de fábrica, ele volta na próxima subida em que a versão do manifesto mudar.
 */
export function seedSoundPacks() {
  if (Number(db.getKv(PACKS_KEY) ?? 0) >= PACKS_VERSION) return;
  // O pacote antigo morava dentro de cada comunidade; os sons dele saem para dar lugar aos pacotes.
  db.deleteLegacyPackSounds();

  for (const manifest of readManifest()) {
    const found = db.findPackByName(manifest.name);
    const packId = found?.id ?? db.createPack(manifest.name, manifest.description, manifest.icon, null, true);
    fillPack(packId, manifest);
    // Quem já tinha conta antes dos pacotes existirem recebe o básico, para não abrir um soundboard vazio.
    if (manifest.name === DEFAULT_PACK) for (const userId of db.allUserIds()) db.installPack(packId, userId);
  }
  db.setKv(PACKS_KEY, String(PACKS_VERSION));
}

/** Quem cria conta já começa com o pacote básico no soundboard. */
export function installDefaultPack(userId: number) {
  const pack = db.findPackByName(DEFAULT_PACK);
  if (pack) db.installPack(pack.id, userId);
}

export function seedExpressions(communityId: number) {
  if (db.getKv(seededKey(communityId))) return;
  const emojiDir = new URL('emojis/', ASSETS);
  for (const file of readdirSync(emojiDir).filter((f) => f.endsWith('.png'))) {
    const name = file.replace(/\.png$/, '');
    if (!db.emojiNameTaken(communityId, name)) {
      db.createEmoji(communityId, name, 'image/png', readFileSync(new URL(file, emojiDir)), null);
    }
  }
  db.setKv(seededKey(communityId), new Date().toISOString());
}

/**
 * Repõe o que foi apagado do que vem de fábrica: os emojis da comunidade e os sons dos pacotes do Syden.
 * É o "desfazer" de quem apagou tudo por engano.
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

  let sounds = 0;
  for (const manifest of readManifest()) {
    const found = db.findPackByName(manifest.name);
    const packId = found?.id ?? db.createPack(manifest.name, manifest.description, manifest.icon, null, true);
    sounds += fillPack(packId, manifest);
  }

  db.setKv(seededKey(communityId), db.getKv(seededKey(communityId)) ?? new Date().toISOString());
  return { emojis, sounds };
}

/**
 * Na subida do servidor: os emojis da comunidade mais antiga (que existia antes das chaves por comunidade)
 * e os pacotes de sons de fábrica.
 */
export function seedFirstCommunity() {
  const community = db.defaultCommunity();
  if (community) {
    const old = db.getKv('expressions.seeded');
    if (old && !db.getKv(seededKey(community.id))) db.setKv(seededKey(community.id), old);
    seedExpressions(community.id);
  }
  seedSoundPacks();
}
