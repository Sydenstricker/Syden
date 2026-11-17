import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, '..', 'fundo-camera');
const { MODESTO, abrirModelo, criarSuavizacao, redimensionar } = require('../src/fundo-camera/segmentador.js');
const { REFINADO, ARQUIVO_MODESTO, ARQUIVO_REFINADO } = require('../src/fundo-camera/modelos.js');
const decisor = require('../src/fundo-camera/decisor.js');
const { jogoNaFrente, jogosDoRegistro } = require('../src/fundo-camera/jogo.js');
const ort = require('onnxruntime-node');
// O modesto mora no git (6 MB), como o do ruído: desktop/fundo-camera/. O refinado também, se couber (ver modelos.js).
const MODELO = join(PASTA, ARQUIVO_MODESTO);
const REF = join(PASTA, ARQUIVO_REFINADO);

test('os modelos que vão no pacote são os medidos (o sha256 da ORIGEM.txt)', () => {
  const origem = readFileSync(join(PASTA, 'ORIGEM.txt'), 'utf8');
  for (const arquivo of [ARQUIVO_MODESTO, ARQUIVO_REFINADO]) {
    if (!existsSync(join(PASTA, arquivo))) continue;
    const esperado = origem.match(new RegExp(arquivo.replaceAll('.', '\\.') + '[\\s\\S]*?sha256 ([0-9a-f]{64})'))?.[1];
    assert.ok(esperado, `a ORIGEM.txt não diz o sha256 de ${arquivo}`);
    assert.equal(createHash('sha256').update(readFileSync(join(PASTA, arquivo))).digest('hex'), esperado, arquivo);
  }
});

/** Um quadro: fundo de uma cor com ruído, e no meio um "busto" (cabeça e ombros) de outra. */
function quadro(semente, L = MODESTO.largura, A = MODESTO.altura) {
  let s = semente;
  const ruido = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32 - 0.5) * 40;
  const px = new Uint8Array(L * A * 4);
  for (let y = 0; y < A; y++)
    for (let x = 0; x < L; x++) {
      const u = x / L, v = y / A;
      const cabeca = Math.hypot((u - 0.5) * 1.2, v - 0.36) < 0.17;
      const ombros = v > 0.57 && Math.abs(u - 0.5) < 0.36 + (v - 0.57) * 0.3;
      const c = cabeca ? [205, 160, 130] : ombros ? [40, 60, 120] : [150, 170, 150];
      px.set([c[0] + ruido(), c[1] + ruido(), c[2] + ruido(), 255], (y * L + x) * 4);
    }
  return px;
}

test('o modesto devolve a probabilidade no tamanho dele e recusa o que não é um quadro do tamanho certo', async () => {
  const m = abrirModelo(ort, MODESTO, MODELO);
  const p = await m.rodar(quadro(1));
  assert.ok(p instanceof Float32Array);
  assert.equal(p.length, MODESTO.largura * MODESTO.altura);
  assert.ok(p.every((v) => v >= 0 && v <= 1));
  await assert.rejects(m.rodar(new Uint8Array(10)), /quadro inválido/);
});

test('a média que se adapta segura o tremor: com o mesmo quadro e ruído novo, a máscara muda menos que a crua', async () => {
  const m = abrirModelo(ort, MODESTO, MODELO);
  const suave = criarSuavizacao();
  const cruas = [];
  const suaves = [];
  for (let i = 0; i < 6; i++) {
    const p = await m.rodar(quadro(100 + i));
    cruas.push(criarSuavizacao()(p, MODESTO.largura, MODESTO.altura));
    suaves.push(suave(p, MODESTO.largura, MODESTO.altura));
  }
  const tremor = (lista) => {
    let soma = 0;
    for (let i = 1; i < lista.length; i++) for (let p = 0; p < lista[i].length; p++) soma += Math.abs(lista[i][p] - lista[i - 1][p]);
    return soma;
  };
  assert.ok(tremor(suaves) <= tremor(cruas), `suave ${tremor(suaves)} contra crua ${tremor(cruas)}`);
});

test('cada câmera tem a sua memória: uma suavização não mistura a máscara da outra', () => {
  const a = criarSuavizacao();
  const b = criarSuavizacao();
  const p = new Float32Array(16).fill(0.9);
  a(new Float32Array(16).fill(0.1), 4, 4);
  assert.deepEqual(b(p, 4, 4), criarSuavizacao()(p, 4, 4));
});

test('A TROCA DE MODELO NÃO PISCA: a máscara anterior é levada ao tamanho da nova e entra na média', () => {
  const s = criarSuavizacao();
  // um quadro no modesto (8 × 8) com a pessoa na metade esquerda; depois o "refinado" (16 × 9) diz o mesmo com a borda 1 px ao
  // lado. A máscara que sai na troca é quase a de antes: nada pula de 0 a 255
  const antes = new Float32Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) antes[y * 8 + x] = 1;
  s(antes, 8, 8);
  const depois = new Float32Array(16 * 9);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) depois[y * 16 + x] = 1;
  const m = s(depois, 16, 9);
  assert.equal(m.length, 16 * 9);
  assert.equal(m[4 * 16 + 2], 255); // dentro da pessoa
  assert.equal(m[4 * 16 + 14], 0); // no fundo
  // na faixa que mudou de lado, a mudança é amortecida (a média segura as pequenas e solta as grandes, mas nunca de uma vez)
  assert.ok(m[4 * 16 + 8] < 255, String(m[4 * 16 + 8]));
});

test('redimensionar um quadro RGBA mantém as cores e o tamanho', () => {
  const px = new Uint8Array(4 * 4 * 4).fill(200);
  const r = redimensionar(px, 4, 4, 7, 3, 4, Uint8Array);
  assert.equal(r.length, 7 * 3 * 4);
  assert.ok(r.every((v) => v === 200));
});

test('O DECISOR: o refinado só com a placa pronta, sem jogo e sem aperto, e volta com folga', () => {
  const { decisorInicial, nivelAgora, comPlaca, comJogo, comTempo, LIMITE_MS, LENTOS_PARA_DESCER, FOLGA_DO_JOGO_MS, FOLGA_DO_APERTO_MS } = decisor;
  let d = decisorInicial();
  assert.equal(nivelAgora(d, 0), 'modesto', 'sem a placa medida, modesto');
  d = comPlaca(d, true);
  assert.equal(nivelAgora(d, 0), 'refinado');
  // um jogo na frente desce na hora; saiu, volta depois da folga
  d = comJogo(d, true, 1000);
  assert.equal(nivelAgora(d, 1000), 'modesto');
  assert.equal(d.motivo, 'jogo');
  d = comJogo(d, false, 2000);
  assert.equal(nivelAgora(d, 2000 + FOLGA_DO_JOGO_MS - 1), 'modesto');
  assert.equal(nivelAgora(d, 2000 + FOLGA_DO_JOGO_MS), 'refinado');
  // os quadros lentos seguidos descem só ao chegar a LENTOS_PARA_DESCER, e um quadro bom no meio zera a conta
  const lento = (x) => comTempo(x, LIMITE_MS + 5, t);
  let t = 10_000;
  let r = { decisor: d, desceu: false };
  for (let i = 1; i < LENTOS_PARA_DESCER; i++) r = lento(r.decisor);
  assert.equal(r.desceu, false);
  r = comTempo(r.decisor, 5, t);
  for (let i = 1; i < LENTOS_PARA_DESCER; i++) r = lento(r.decisor);
  assert.equal(nivelAgora(r.decisor, t), 'refinado');
  r = lento(r.decisor);
  assert.equal(r.desceu, true);
  assert.equal(nivelAgora(r.decisor, t + FOLGA_DO_APERTO_MS - 1), 'modesto');
  assert.equal(nivelAgora(r.decisor, t + FOLGA_DO_APERTO_MS), 'refinado', 'volta com folga, uma vez');
  // apertou de novo depois de voltar: fica no modesto até o fim
  t += FOLGA_DO_APERTO_MS;
  for (let i = 0; i < LENTOS_PARA_DESCER; i++) r = comTempo(r.decisor, LIMITE_MS + 5, t);
  assert.equal(r.desceu, true);
  assert.equal(nivelAgora(r.decisor, t + 10 * FOLGA_DO_APERTO_MS), 'modesto');
});

test('A ESCOLHA DA PESSOA É RESPEITADA: Leve e Completo não trocam com jogo nem aperto; o Completo sem placa cai no Leve', () => {
  const { decisorInicial, nivelDaCamera, comPlaca, comJogo, comTempo, LIMITE_MS } = decisor;
  let d = comPlaca(decisorInicial(), true);
  d = comJogo(d, true, 0);
  for (let i = 0; i < 6; i++) d = comTempo(d, LIMITE_MS + 50, 0).decisor;
  assert.equal(nivelDaCamera(d, 0, 'automatico'), 'modesto', 'o Automático desce');
  assert.equal(nivelDaCamera(d, 0, 'completo'), 'refinado', 'o Completo escolhido fica, com jogo e aperto');
  assert.equal(nivelDaCamera(comPlaca(decisorInicial(), true), 0, 'leve'), 'modesto', 'o Leve escolhido fica, com a placa livre');
  assert.equal(nivelDaCamera(comPlaca(d, false), 0, 'completo'), 'modesto', 'sem placa capaz, o Completo vira Leve');
});

test('POUCA LUZ: no Automático, a câmera escura vai ao Leve, com folga entre os limites; a escolha da pessoa não muda', () => {
  const { criarLuz, nivelDaCamera, comPlaca, decisorInicial, ESCURO_ABAIXO, CLARO_ACIMA } = decisor;
  const quadro = (v) => new Uint8Array(64 * 64 * 4).fill(v);
  const luz = criarLuz();
  assert.equal(luz(quadro(160)), false);
  let escuro = false;
  for (let i = 0; i < 30; i++) escuro = luz(quadro(55));
  assert.equal(escuro, true, 'o quarto escuro dos vídeos do estudo (brilho 51–61)');
  for (let i = 0; i < 30; i++) escuro = luz(quadro(Math.round((ESCURO_ABAIXO + CLARO_ACIMA) / 2)));
  assert.equal(escuro, true, 'no meio da folga, fica como estava');
  for (let i = 0; i < 30; i++) escuro = luz(quadro(150));
  assert.equal(escuro, false);
  const d = comPlaca(decisorInicial(), true);
  assert.equal(nivelDaCamera(d, 0, 'automatico', true), 'modesto');
  assert.equal(nivelDaCamera(d, 0, 'completo', true), 'refinado');
});

test('O JOGO NA FRENTE: os que o Windows reconhece e a tela cheia de verdade; nunca o Syden, a área de trabalho ou uma sobreposição', () => {
  const jogos = jogosDoRegistro(
    'HKEY_CURRENT_USER\\System\\GameConfigStore\\Children\\01cb\r\n    MatchedExeFullPath    REG_SZ    F:\\Steam\\steamapps\\common\\Destiny 2\\destiny2.exe\r\n\r\n' +
      'HKEY_CURRENT_USER\\System\\GameConfigStore\\Children\\03b1\r\n    MatchedExeFullPath    REG_SZ    C:\\Riot Games\\League of Legends\\Game\\League of Legends.exe\r\n',
  );
  assert.deepEqual([...jogos].sort(), ['destiny2.exe', 'league of legends.exe']);
  const janela = (o) => ({ pid: 10, classe: 'Janela', exe: 'Code.exe', sobreposicao: false, telaCheia: false, ...o });
  assert.equal(jogoNaFrente(janela({ exe: 'League of Legends.exe' }), jogos, 1), 'League of Legends.exe');
  assert.equal(jogoNaFrente(janela({}), jogos, 1), null, 'o editor em janela não é jogo');
  assert.equal(jogoNaFrente(janela({ exe: 'jogo-novo.exe', telaCheia: true }), jogos, 1), 'jogo-novo.exe', 'tela cheia conta');
  assert.equal(jogoNaFrente(janela({ telaCheia: true, sobreposicao: true }), jogos, 1), null, 'uma sobreposição não');
  assert.equal(jogoNaFrente(janela({ pid: 1, telaCheia: true }), jogos, 1), null, 'o próprio Syden não');
  assert.equal(jogoNaFrente(janela({ classe: 'WorkerW', telaCheia: true }), jogos, 1), null, 'a área de trabalho não');
  assert.equal(jogoNaFrente(null, jogos, 1), null);
});

test('o refinado, no processador, devolve o alfa no tamanho dele (a placa é medida no e2e do app)', { skip: !existsSync(REF) && 'o refinado não está em desktop/fundo-camera' }, async () => {
  const m = abrirModelo(ort, { ...REFINADO, placa: false }, REF);
  const p = await m.rodar(quadro(3, REFINADO.largura, REFINADO.altura));
  assert.equal(p.length, REFINADO.largura * REFINADO.altura);
  assert.ok(p.every((v) => v >= 0 && v <= 1));
});
