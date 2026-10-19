// Mede o Bergamot (motor do Firefox) traduzindo mensagens de conversa para o português, como seria no app:
// uma mensagem por vez (o "Traduzir" de cada mensagem), com o modelo já carregado depois da primeira.
// Mede: tempo de carga do motor e de cada idioma, memória do processo (RSS) e do wasm, e ms por mensagem.
//   node medir.mjs            → resultados.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const M = path.join(AQUI, 'modelos');
const manifesto = JSON.parse(fs.readFileSync(path.join(M, 'manifesto.json'), 'utf8'));
const mensagens = JSON.parse(fs.readFileSync(path.join(AQUI, 'mensagens.json'), 'utf8'));
const MB = (n) => Math.round((n / 1048576) * 10) / 10;
const rss = () => MB(process.memoryUsage().rss);
const agora = () => performance.now();

// o código do Firefox define uma função global loadBergamot: roda num contexto com o que ela espera
const contexto = vm.createContext({ console, performance, WebAssembly, setTimeout, clearTimeout, TextDecoder, TextEncoder, URL, crypto: globalThis.crypto });
vm.runInContext(fs.readFileSync(path.join(AQUI, 'motor', 'bergamot-translator.js'), 'utf8'), contexto);

const resultado = { ambiente: { node: process.version, electron: process.versions.electron ?? null, plataforma: process.platform }, memoria: {}, cargas: {}, pares: {} };
resultado.memoria.inicio = rss();
let t = agora();
const bergamot = await new Promise((ok, falha) => {
  const b = contexto.loadBergamot({
    INITIAL_MEMORY: 41_943_040,
    print: () => {},
    printErr: () => {},
    onAbort: () => falha(new Error('abort')),
    onRuntimeInitialized: () => Promise.resolve().then(() => ok(b)),
    wasmBinary: fs.readFileSync(path.join(M, 'bergamot-translator.wasm')),
  });
});
resultado.cargas.motorMs = Math.round(agora() - t);
resultado.memoria.depoisDoMotor = rss();

const ALINHAMENTO = { model: 256, lex: 64, vocab: 64, srcvocab: 64, trgvocab: 64 };
const config = (nomeDoModelo) =>
  '\n' +
  Object.entries({
    'beam-size': '1', normalize: '1.0', 'word-penalty': '0', 'max-length-break': '128', 'mini-batch-words': '1024',
    workspace: process.env.WS ?? '128', 'max-length-factor': '2.0', 'skip-cost': 'true', 'cpu-threads': '0', quiet: 'true',
    'quiet-translation': 'true', 'gemm-precision': nomeDoModelo.endsWith('intgemm8.bin') ? 'int8shiftAll' : 'int8shiftAlphaAll', alignment: 'soft',
  })
    .map(([k, v]) => `            ${k}: ${v}\n`)
    .join('') + '            ';

const carregados = {};
function carregar(par) {
  if (carregados[par]) return carregados[par];
  const t0 = agora();
  const { arquivos } = manifesto[par];
  const alinhado = {};
  for (const [tipo, { arquivo }] of Object.entries(arquivos)) {
    const bytes = fs.readFileSync(path.join(M, arquivo));
    const mem = new bergamot.AlignedMemory(bytes.byteLength, ALINHAMENTO[tipo]);
    mem.getByteArrayView().set(bytes);
    alinhado[tipo] = mem;
  }
  const vocabs = new bergamot.AlignedMemoryList();
  if (alinhado.vocab) vocabs.push_back(alinhado.vocab);
  else { vocabs.push_back(alinhado.srcvocab); vocabs.push_back(alinhado.trgvocab); }
  const limpo = par.replace(/-android$/, ''), [de, para] = [limpo.slice(0, limpo.lastIndexOf('-')), limpo.slice(limpo.lastIndexOf('-') + 1)];
  const modelo = new bergamot.TranslationModel(de, para, config(arquivos.model.nome), alinhado.model, alinhado.lex ?? null, vocabs, null);
  resultado.cargas[par] = { ms: Math.round(agora() - t0), mb: MB(manifesto[par].bytes) };
  return (carregados[par] = modelo);
}

const servico = new bergamot.BlockingService({ cacheSize: 0 });
function traduzir(modelos, texto) {
  const msgs = new bergamot.VectorString();
  const opcoes = new bergamot.VectorResponseOptions();
  msgs.push_back(texto);
  opcoes.push_back({ qualityScores: false, alignment: false, html: false });
  try {
    const r = modelos.length === 1 ? servico.translate(modelos[0], msgs, opcoes) : servico.translateViaPivoting(modelos[0], modelos[1], msgs, opcoes);
    return r.get(0).getTranslatedText();
  } finally {
    msgs.delete();
    opcoes.delete();
  }
}

const TODAS = { en: ['en-pt'], es: ['es-en', 'en-pt'], ja: ['ja-en', 'en-pt'], ar: ['ar-en', 'en-pt'], 'ja-android': ['ja-en-android', 'en-pt'] };
// SO=ja mede só um idioma, num processo limpo: é o caso real (uma conversa, uma língua)
const ROTAS = process.env.SO ? { [process.env.SO]: TODAS[process.env.SO] } : TODAS;
let pico = rss();
for (const [lingua, rota] of Object.entries(ROTAS)) {
  const modelos = rota.map(carregar);
  resultado.memoria['depoisDe_' + rota.join('+')] = rss();
  const linhas = [];
  const fonte = mensagens[lingua.replace(/-android$/, '')];
  for (let i = 0; i < fonte.length; i++) {
    const t0 = agora();
    const pt = traduzir(modelos, fonte[i]);
    const ms = Math.round(agora() - t0);
    pico = Math.max(pico, rss());
    linhas.push({ original: mensagens.pt[i], de: fonte[i], traducao: pt, ms });
  }
  const tempos = linhas.map((l) => l.ms).sort((a, b) => a - b);
  resultado.pares[lingua] = { rota, primeiraMs: linhas[0].ms, medianaMs: tempos[Math.floor(tempos.length / 2)], maxMs: tempos.at(-1), linhas };
  console.log(lingua, rota.join(' → '), 'mediana', resultado.pares[lingua].medianaMs, 'ms · primeira', linhas[0].ms, 'ms · rss', rss(), 'MB');
}
resultado.memoria.pico = pico;
resultado.memoria.wasmHeap = MB(bergamot.HEAPU8?.byteLength ?? contexto.wasmMemory?.buffer?.byteLength ?? 0);
console.log('motor', resultado.cargas.motorMs, 'ms · cargas', JSON.stringify(Object.fromEntries(Object.entries(resultado.cargas).filter(([k]) => k !== 'motorMs').map(([k, v]) => [k, v.ms + 'ms']))));
console.log('memória', JSON.stringify(resultado.memoria));
fs.writeFileSync(path.join(AQUI, 'resultados', process.argv[2] ?? 'resultados.json'), JSON.stringify(resultado, null, 1));
