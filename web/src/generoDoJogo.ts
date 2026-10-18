/**
 * O GÊNERO DO JOGO TRANSMITIDO (decisão dele, 18/10/2026): a TV do salão mostra, com o Ao vivo, o NOSSO desenho do gênero
 * do que está sendo transmitido — a arena para LoL e Dota, o tiro para CS e Valorant, o futebol para EA FC e eFootball.
 * Nunca a imagem do jogo (é obra de terceiro), e para os outros só vai o GÊNERO: o nome do programa fica no computador
 * de quem transmite.
 *
 * De onde vem: só o app de Windows sabe qual programa é dono da janela escolhida (é o mesmo dado que manda só o som do
 * jogo, desktop/src/screen-audio.js). No navegador e na tela inteira não há programa, e fica o Ao vivo comum.
 *
 * POR QUE PELO EXECUTÁVEL, e não pelo título da janela: o título engana ("ELDEN RING - gameplay" numa aba do navegador;
 * ver "Saber que alguém está jogando" no CLAUDE.md). O executável é o do próprio jogo, e o que não está na tabela
 * simplesmente não tem gênero. Os nomes foram conferidos, quando dava, na lista de jogos que o Windows reconhece
 * (HKCU\System\GameConfigStore) no computador dele. Jogo novo: uma linha aqui, sem versão nova do app.
 */
export const GENEROS = [
  'moba',
  'tiro',
  'futebol',
  'corrida',
  'luta',
  'aventura',
  'construcao',
  'fazenda',
  'estrategia',
  'cartas',
  'terror',
  'plataforma',
  'festa',
] as const;
export type Genero = (typeof GENEROS)[number];

const POR_GENERO: Record<Genero, string[]> = {
  moba: ['league of legends.exe', 'dota2.exe', 'heroesofthestorm_x64.exe', 'deadlock.exe', 'smite2.exe'],
  tiro: [
    'cs2.exe',
    'csgo.exe',
    'valorant-win64-shipping.exe',
    'r5apex.exe',
    'fortniteclient-win64-shipping.exe',
    'modernwarfare.exe',
    'cod.exe',
    'overwatch.exe',
    'rainbowsix.exe',
    'tslgame.exe',
    'bf6.exe',
    'bf2042.exe',
    'marvel-win64-shipping.exe',
    'destiny2.exe',
    'deltaforceclient-win64-shipping.exe',
    'escapefromtarkov.exe',
    'helldivers2.exe',
    'starwarsbattlefrontii.exe',
    'doom.exe',
    'back4blood.exe',
    'haloinfinite.exe',
    'super animal royale.exe',
  ],
  futebol: ['fc26.exe', 'fc25.exe', 'fc24.exe', 'fifa23.exe', 'fifa22.exe', 'efootball.exe', 'pes2021.exe', 'rocketleague.exe'],
  corrida: [
    'forzahorizon5.exe',
    'forzahorizon4.exe',
    'forzamotorsport.exe',
    'f1_25.exe',
    'f1_24.exe',
    'needforspeedheat.exe',
    'nfsunbound.exe',
    'trackmania.exe',
    'assettocorsa.exe',
    'ac2-win64-shipping.exe',
    'thecrewmotorfest.exe',
    'beamng.drive.x64.exe',
    'eurotrucks2.exe',
    'horizonchase.exe',
  ],
  luta: [
    'streetfighter6.exe',
    'polaris-win64-shipping.exe',
    'mk12.exe',
    'multiversus-win64-shipping.exe',
    'brawlhalla.exe',
    'ggst-win64-shipping.exe',
    'dbfighterz.exe',
    'knockoutcity.exe',
  ],
  aventura: [
    'eldenring.exe',
    'nightreign.exe',
    'darksoulsiii.exe',
    'sekiro.exe',
    'bg3.exe',
    'bg3_dx11.exe',
    'diablo iv.exe',
    'wow.exe',
    'wowclassic.exe',
    'pathofexile.exe',
    'pathofexile_x64.exe',
    'witcher3.exe',
    'cyberpunk2077.exe',
    'ffxiv_dx11.exe',
    'lostark.exe',
    'genshinimpact.exe',
    'starrail.exe',
    'zenlesszonezero.exe',
    'monsterhunterwilds.exe',
    'hogwartslegacy.exe',
    'gta5.exe',
    'gta5_enhanced.exe',
    'rdr2.exe',
    'gow.exe',
    'starwarsjedifallenorder.exe',
    'hades.exe',
    'hades2.exe',
    'darkest.exe',
    'darkest dungeon ii.exe',
    'ragexe.exe',
    'ragnarok.exe',
    'warhammer 40000 space marine 2 - retail.exe',
  ],
  construcao: [
    'minecraft.windows.exe',
    'terraria.exe',
    'valheim.exe',
    'rustclient.exe',
    'arkascended.exe',
    'palworld-win64-shipping.exe',
    '7daystodie.exe',
    'factorio.exe',
    'factorygamesteam-win64-shipping.exe',
    'enshrouded.exe',
    'sonsoftheforest.exe',
    'subnautica.exe',
    'robloxplayerbeta.exe',
    'ksp_x64.exe',
  ],
  fazenda: ['stardew valley.exe', 'ts4_x64.exe', 'coral island.exe', 'fields of mistria.exe'],
  estrategia: [
    'aoe2de_s.exe',
    'aoe3de_s.exe',
    'aomrt_s.exe',
    'reliccardinal.exe',
    'civilizationvi.exe',
    'civilizationvi_dx12.exe',
    'sc2_x64.exe',
    'hoi4.exe',
    'eu4.exe',
    'stellaris.exe',
    'warhammer3.exe',
    'hwr.exe',
    'hwr2.exe',
  ],
  cartas: ['hearthstone.exe', 'balatro.exe', 'mtga.exe', 'lor.exe', 'snap.exe', 'masterduel.exe', 'super auto pets.exe', "liar's bar.exe", 'buckshot roulette.exe'],
  terror: ['phasmophobia.exe', 'deadbydaylight-win64-shipping.exe', 'lethal company.exe', 'content warning.exe', 'repo.exe', 'inside.exe', 'projectwinter.exe'],
  plataforma: ['hollow_knight.exe', 'celeste.exe', 'cuphead.exe', 'oriwotw.exe', 'gris.exe', 'broforce_beta.exe', 'huntdown.exe', 'hoa.exe'],
  festa: ['among us.exe', 'fallguys_client_game.exe', 'stumble guys.exe', 'pummelparty.exe', 'peak.exe', 'gang beasts.exe'],
};

const TABELA = new Map<string, Genero>(
  (Object.entries(POR_GENERO) as [Genero, string[]][]).flatMap(([genero, exes]) => exes.map((exe) => [exe, genero])),
);

/** O gênero do programa (o nome do executável, com ou sem pasta), ou null quando não é um jogo da tabela. */
export function generoDoPrograma(exe: string | null | undefined): Genero | null {
  if (!exe) return null;
  const nome = exe.split(/[\\/]/).pop()!.trim().toLowerCase();
  return TABELA.get(nome) ?? null;
}

/** Para conferir em teste que nenhum executável está em dois gêneros. */
export const _porGenero = POR_GENERO;
