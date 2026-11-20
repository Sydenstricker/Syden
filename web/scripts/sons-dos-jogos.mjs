// Os efeitos sonoros dos mini-games (20/11/2026): copia de e2e/3D/Assets/sons-<pacote>/ (os pacotes de áudio da Kenney, CC0,
// baixados à parte, fora do git) as amostras usadas para web/public/sons/<efeito>-<n>.ogg, com as licenças ao lado.
// No caminho, cada uma perde o silêncio do começo (os pacotes "Digital Audio" e "Sci-fi" começam com ~60 ms mudos, que viram
// atraso no jogo), é cortada se for longa (o propulsor do "turbo" tem 5 s) e tem o pico levado a −1 dB, para o volume de cada
// efeito ser decidido no código (VOLUME em somDosJogos.ts) e não pela gravação de cada pacote.
//
// Rodar da raiz: node web/scripts/sons-dos-jogos.mjs (pede o ffmpeg no PATH). Efeito novo: a linha aqui E em AMOSTRAS, em
// web/src/somDosJogos.ts; o teste web/test/somDosJogos.test.ts confere que as duas batem.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGEM = 'e2e/3D/Assets';
const DESTINO = 'web/public/sons';

/** efeito → [pacote, arquivo dentro de Audio/, corte em segundos (opcional)][] */
const AMOSTRAS = {
  clique: [['interface-sounds', 'select_001.ogg'], ['interface-sounds', 'select_002.ogg'], ['interface-sounds', 'click_001.ogg']],
  vez: [['interface-sounds', 'bong_001.ogg']],
  pulo: [['digital-audio', 'phaserUp4.ogg'], ['digital-audio', 'phaserUp6.ogg']],
  mola: [['digital-audio', 'phaseJump2.ogg']],
  queda: [['digital-audio', 'pepSound1.ogg']],
  moeda: [['digital-audio', 'highUp.ogg']],
  acerto: [['interface-sounds', 'confirmation_001.ogg'], ['interface-sounds', 'confirmation_003.ogg']],
  erro: [['interface-sounds', 'error_002.ogg'], ['interface-sounds', 'error_004.ogg']],
  dado: [['casino-audio', 'dice-throw-1.ogg'], ['casino-audio', 'dice-throw-2.ogg'], ['casino-audio', 'dice-throw-3.ogg']],
  carta: [['casino-audio', 'card-place-1.ogg'], ['casino-audio', 'card-place-2.ogg'], ['casino-audio', 'card-place-3.ogg']],
  tacada: [['impact-sounds', 'impactGeneric_light_000.ogg'], ['impact-sounds', 'impactGeneric_light_001.ogg'], ['impact-sounds', 'impactGeneric_light_002.ogg']],
  buraco: [['music-jingles', 'Pizzicato jingles/jingles_PIZZI08.ogg']],
  tiro: [['sci-fi-sounds', 'laserSmall_000.ogg'], ['sci-fi-sounds', 'laserSmall_001.ogg'], ['sci-fi-sounds', 'laserSmall_002.ogg']],
  soco: [['impact-sounds', 'impactPunch_medium_000.ogg'], ['impact-sounds', 'impactPunch_medium_001.ogg'], ['impact-sounds', 'impactPunch_medium_002.ogg']],
  combo: [['digital-audio', 'pepSound3.ogg']],
  chegada: [['music-jingles', '8-Bit jingles/jingles_NES01.ogg']],
  empurrao: [['impact-sounds', 'impactSoft_heavy_000.ogg'], ['impact-sounds', 'impactSoft_heavy_001.ogg']],
  bandeira: [['interface-sounds', 'maximize_008.ogg']],
  encaixe: [['impact-sounds', 'impactWood_light_000.ogg'], ['impact-sounds', 'impactWood_light_001.ogg'], ['impact-sounds', 'impactWood_light_002.ogg']],
  rangido: [['rpg-audio', 'creak1.ogg'], ['rpg-audio', 'creak2.ogg'], ['rpg-audio', 'creak3.ogg']],
  quebra: [['impact-sounds', 'impactPlank_medium_000.ogg'], ['impact-sounds', 'impactPlank_medium_001.ogg']],
  impacto: [['impact-sounds', 'impactPunch_heavy_000.ogg'], ['impact-sounds', 'impactPunch_heavy_001.ogg'], ['impact-sounds', 'impactPunch_heavy_002.ogg']],
  derrota: [['digital-audio', 'phaserDown1.ogg']],
  dano: [['impact-sounds', 'impactPlate_light_000.ogg'], ['impact-sounds', 'impactPlate_light_001.ogg']],
  explosao: [['sci-fi-sounds', 'explosionCrunch_000.ogg'], ['sci-fi-sounds', 'explosionCrunch_001.ogg', 0.9], ['sci-fi-sounds', 'explosionCrunch_002.ogg', 0.9]],
  turbo: [['sci-fi-sounds', 'thrusterFire_000.ogg', 0.6]],
  item: [['digital-audio', 'powerUp5.ogg'], ['digital-audio', 'powerUp7.ogg']],
  cura: [['digital-audio', 'powerUp11.ogg']],
  largada: [['digital-audio', 'tone1.ogg', 0.3]],
  alarme: [['digital-audio', 'twoTone1.ogg']],
  medalha: [['music-jingles', '8-Bit jingles/jingles_NES03.ogg']],
  desliza: [['casino-audio', 'card-slide-1.ogg'], ['casino-audio', 'card-slide-2.ogg'], ['casino-audio', 'card-slide-3.ogg']],
  fim: [['music-jingles', '8-Bit jingles/jingles_NES09.ogg']],
};

const NOMES = {
  'interface-sounds': 'Interface-Sounds',
  'digital-audio': 'Digital-Audio',
  'casino-audio': 'Casino-Audio',
  'impact-sounds': 'Impact-Sounds',
  'music-jingles': 'Music-Jingles',
  'sci-fi-sounds': 'Sci-fi-Sounds',
  'rpg-audio': 'RPG-Audio',
};

rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });
const usados = new Set();
const fontes = [];
for (const [efeito, lista] of Object.entries(AMOSTRAS)) {
  lista.forEach(([pacote, nome, corte], i) => {
    usados.add(pacote);
    const de = join(ORIGEM, `sons-${pacote}`, 'Audio', nome);
    const para = join(DESTINO, `${efeito}-${i + 1}.ogg`);
    // o silêncio do começo sai; o corte, se houver, termina num esmaecer de 80 ms
    let filtro = 'silenceremove=start_periods=1:start_threshold=-50dB';
    if (corte) filtro += `,atrim=0:${corte},afade=t=out:st=${Math.max(0, corte - 0.08)}:d=0.08`;
    // o pico depois do corte (o volumedetect escreve no stderr)
    const info = spawnSync('ffmpeg', ['-hide_banner', '-i', de, '-af', `${filtro},volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const m = /max_volume: (-?[\d.]+) dB/.exec(info);
    const max = m ? Number(m[1]) : 0;
    const ganho = (-1 - max).toFixed(2);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', de, '-af', `${filtro},volume=${ganho}dB`, '-c:a', 'libvorbis', '-q:a', '3', '-map_metadata', '-1', para]);
    fontes.push(`${efeito}-${i + 1}.ogg\tKenney ${NOMES[pacote]}: ${nome}${corte ? ` (os primeiros ${corte} s)` : ''}`);
  });
}
for (const pacote of usados) copyFileSync(join(ORIGEM, `sons-${pacote}`, 'License.txt'), join(DESTINO, `LICENCA-Kenney-${NOMES[pacote]}.txt`));
writeFileSync(
  join(DESTINO, 'FONTES.txt'),
  'De onde vem cada efeito sonoro dos mini-games (todos da Kenney, kenney.nl, CC0; gerados por web/scripts/sons-dos-jogos.mjs,\n' +
    'sem o silêncio do começo e com o pico a -1 dB).\n\n' +
    fontes.join('\n') +
    '\n',
);
console.log(`${fontes.length} amostras em ${DESTINO}:`, readdirSync(DESTINO).length, 'arquivos');
