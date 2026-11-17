// @ts-check
/**
 * HÁ UM JOGO NA FRENTE? (17/11/2026) O fundo da câmera refinado roda pela placa, e a placa é do jogo: com um jogo na frente,
 * o fundo desce ao modesto (no processador, ~0,17 de um núcleo), sem avisar. Ver decisor.js.
 *
 * Quem sabe o que é jogo é o WINDOWS, em HKCU\System\GameConfigStore\Children: o MatchedExeFullPath de cada jogo que a Barra
 * de Jogos reconheceu (medido em 02/10/2026 na máquina dele: 75 jogos, ZERO falsos positivos, Steam, Epic, Riot e avulsos;
 * ver "Saber que alguém está jogando" no CLAUDE.md). Só os jogos que a pessoa já abriu estão lá; o primeiro dia de um jogo
 * novo escapa, e é para isso que serve o segundo sinal: TELA CHEIA DE VERDADE (a janela da frente cobre o monitor inteiro e
 * não é uma sobreposição transparente; o mesmo critério de a-vista.js). Um vídeo em tela cheia também conta, e tudo bem: o
 * modesto continua tirando o fundo. O que escapa aos dois (um jogo nunca visto, em janela) a placa denuncia: o refinado fica
 * lento e desce pelo aperto.
 *
 * SYDEN_TESTE_JOGO=<arquivo>: o teste (e2e/fundo-da-camera-no-app.mjs) simula um jogo na frente enquanto o arquivo existir.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

/** @type {{ janelaDaFrente?: () => { pid: number, classe: string, exe?: string, sobreposicao?: boolean, telaCheia?: boolean } | null } | null} */
let native = null;
try {
  const base = __dirname.includes('app.asar') ? __dirname.replace('app.asar', 'app.asar.unpacked') : __dirname;
  native = require(path.join(base, '..', '..', 'native', 'build', 'Release', 'syden_audio.node'));
} catch {
  native = null; // sem o módulo, só o aperto da placa faz descer
}

const DA_AREA_DE_TRABALHO = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']);

/** Os executáveis (o nome, em minúsculas) dos jogos que o Windows reconhece. Lido no máximo a cada 10 minutos. */
let jogos = /** @type {Set<string>} */ (new Set());
let lidoEm = 0;
function lerJogosDoWindows() {
  if (process.platform !== 'win32' || Date.now() - lidoEm < 10 * 60_000) return;
  lidoEm = Date.now();
  execFile('reg.exe', ['query', 'HKCU\\System\\GameConfigStore\\Children', '/s', '/v', 'MatchedExeFullPath'], { windowsHide: true, encoding: 'latin1', maxBuffer: 4 << 20 }, (erro, saida) => {
    if (erro) return;
    jogos = jogosDoRegistro(saida);
  });
}

/** @param {string} saida o que o reg.exe escreve */
function jogosDoRegistro(saida) {
  const r = new Set();
  for (const m of saida.matchAll(/MatchedExeFullPath\s+REG_SZ\s+(.+)/g)) r.add(path.win32.basename(m[1].trim()).toLowerCase());
  return r;
}

/**
 * @param {{ pid: number, classe: string, exe?: string, sobreposicao?: boolean, telaCheia?: boolean } | null} frente
 * @param {Set<string>} conhecidos
 * @param {number} pidDoSyden
 * @returns {string | null} o executável do jogo na frente, ou null
 */
function jogoNaFrente(frente, conhecidos, pidDoSyden) {
  if (!frente || frente.pid === pidDoSyden || DA_AREA_DE_TRABALHO.has(frente.classe) || frente.sobreposicao) return null;
  const exe = (frente.exe ?? '').toLowerCase();
  if (exe && conhecidos.has(exe)) return frente.exe ?? exe;
  if (frente.telaCheia) return frente.exe || frente.classe || 'tela cheia';
  return null;
}

/**
 * Vigia a janela da frente a cada 2 s e chama `aoMudar(exe | null)` quando muda. Devolve a função de parar.
 * @param {(exe: string | null) => void} aoMudar
 */
function vigiarJogo(aoMudar) {
  /** @type {string | null} */
  let atual = null;
  const conferir = () => {
    lerJogosDoWindows();
    let agora = null;
    const teste = process.env.SYDEN_TESTE_JOGO;
    if (teste && fs.existsSync(teste)) agora = 'jogo-simulado.exe';
    else if (native?.janelaDaFrente) {
      try {
        agora = jogoNaFrente(native.janelaDaFrente(), jogos, process.pid);
      } catch {
        agora = null;
      }
    }
    if (agora === atual) return;
    atual = agora;
    aoMudar(agora);
  };
  conferir();
  const relogio = setInterval(conferir, 2000);
  return () => clearInterval(relogio);
}

module.exports = { vigiarJogo, jogoNaFrente, jogosDoRegistro };
