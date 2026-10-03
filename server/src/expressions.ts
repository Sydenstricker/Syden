import { readdirSync, readFileSync } from 'node:fs';
import * as db from './db.js';

// Emojis de demonstração, instalados em cada comunidade nova. São desenhos do próprio Syden.
//
// SOM DE FÁBRICA NÃO EXISTE MAIS, DE PROPÓSITO. Os sete pacotes que vinham com o Syden (meme, futebol,
// Lula e Bolsonaro…) eram todos áudio de terceiros, e quem distribui é quem responde: com eles, o Syden
// deixava de ser intermediário do que as pessoas sobem e passava a ser quem publica. Em 03/10/2026
// eles viraram pacotes da conta de quem cuida do Syden — o mesmo caminho de qualquer pacote que alguém
// monta. Pacote de fábrica, se voltar a existir, é só de material livre.
const ASSETS = new URL('../assets/', import.meta.url);
const seededKey = (communityId: number) => `expressions.seeded.${communityId}`;

/**
 * Os pacotes que vinham de fábrica passam para a conta dona do Syden. Roda em toda subida e não faz
 * nada depois da primeira: quem já tinha instalado continua com eles, nenhum arquivo é tocado.
 */
export function entregarPacotesDeFabrica() {
  const dono = db.findOwner();
  if (dono) db.entregarPacotesDeFabrica(dono.id);
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
 * Repõe o que foi apagado do que vem de fábrica: os emojis da comunidade. (`sounds` fica sempre 0: o
 * Syden não traz mais som nenhum, ver o alto do arquivo.)
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

  db.setKv(seededKey(communityId), db.getKv(seededKey(communityId)) ?? new Date().toISOString());
  return { emojis, sounds: 0 };
}

/**
 * Na subida do servidor: os emojis da comunidade mais antiga (que existia antes das chaves por comunidade)
 * e a entrega dos antigos pacotes de som de fábrica.
 */
export function seedFirstCommunity() {
  const community = db.defaultCommunity();
  if (community) {
    const old = db.getKv('expressions.seeded');
    if (old && !db.getKv(seededKey(community.id))) db.setKv(seededKey(community.id), old);
    seedExpressions(community.id);
  }
  entregarPacotesDeFabrica();
}
