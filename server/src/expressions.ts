import { readdirSync, readFileSync } from 'node:fs';
import * as db from './db.js';
import { sniffMime } from './media.js';

// Pacote de demonstração (emojis e sons criados para o Janja), instalado na primeira inicialização.
// Se alguém apagar um item depois, ele não volta. Quando o pacote de sons ganha uma versão nova,
// os sons antigos do pacote são trocados pelos novos; os enviados pelos usuários não são tocados.
const ASSETS = new URL('../assets/', import.meta.url);
const SEEDED_KEY = 'expressions.seeded';
const SOUND_PACK_KEY = 'sounds.pack';
const SOUND_PACK_VERSION = 2;

function installSoundPack() {
  const soundDir = new URL('sounds/', ASSETS);
  const manifest = JSON.parse(readFileSync(new URL('sounds.json', soundDir), 'utf8')) as { file: string; name: string; icon: string }[];
  for (const sound of manifest) {
    const data = readFileSync(new URL(sound.file, soundDir));
    db.createSound(sound.name, sound.icon, sniffMime(data) ?? 'audio/wav', data, null);
  }
  db.setKv(SOUND_PACK_KEY, String(SOUND_PACK_VERSION));
}

export function seedExpressions() {
  if (db.getKv(SEEDED_KEY)) {
    if (Number(db.getKv(SOUND_PACK_KEY) ?? 1) < SOUND_PACK_VERSION) {
      db.deletePackSounds();
      installSoundPack();
    }
    return;
  }

  const emojiDir = new URL('emojis/', ASSETS);
  for (const file of readdirSync(emojiDir).filter((f) => f.endsWith('.png'))) {
    const name = file.replace(/\.png$/, '');
    if (!db.emojiNameTaken(name)) db.createEmoji(name, 'image/png', readFileSync(new URL(file, emojiDir)), null);
  }
  installSoundPack();
  db.setKv(SEEDED_KEY, new Date().toISOString());
}
