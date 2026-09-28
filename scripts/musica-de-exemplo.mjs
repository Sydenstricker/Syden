// A música que vem com o Syden, gerada por código.
//
// POR QUE ELA É INVENTADA, E NÃO UMA MÚSICA CONHECIDA. A ideia era "Parabéns a Você", por ser a música
// que todo mundo sabe. Não dá: a melodia é livre (Mildred Hill, morta em 1916), mas a LETRA EM
// PORTUGUÊS é obra nova e independente, escrita em 1942 por Bertha Celeste Homem de Mello, que morreu
// em 1999 — protegida no Brasil até cerca de 2070, e o ECAD cobra por ela até hoje. Distribuir aquela
// letra dentro de um app da Microsoft Store seria o pior lugar possível para esse risco.
//
// Então melodia e letra aqui são originais. Nada a licenciar, nada a pedir, e vira identidade do Syden
// em vez de música emprestada. O uso é o mesmo que ele queria: cantar para alguém no aniversário.
//
// POR QUE POR CÓDIGO, E NÃO UM ARQUIVO GRAVADO. O motivo de verdade não é economizar gravação, é ESTE:
// o áudio e a letra com tempo saem da MESMA LISTA de linhas, aqui embaixo. O instante de cada linha no
// .lrc é calculado do mesmo lugar que decide quando as notas tocam. Eles não podem dessincronizar —
// nem se eu mudar o andamento, nem se eu acrescentar um verso no meio. Um .lrc ajustado à mão sobre um
// .mp3 perde isso na primeira edição.
//
// ATENÇÃO: ISTO É FERRAMENTA DE TESTE, NÃO PRODUTO. Ver CLAUDE.md — o Syden não faz música própria.
// A saída cai em web/test/amostras/ de propósito: de web/public/ ela iria para o site publicado.
//
//   node scripts/musica-de-exemplo.mjs
//   node scripts/musica-de-exemplo.mjs --taxa 22050 --bpm 100
import { writeFileSync, mkdirSync } from 'node:fs';

const opcao = (nome, padrao) => {
  const i = process.argv.indexOf('--' + nome);
  return i >= 0 ? process.argv[i + 1] : padrao;
};

const TAXA = Number(opcao('taxa', 44100));
const BPM = Number(opcao('bpm', 108));
const SAIDA = opcao('saida', 'web/test/amostras/hoje-e-seu-dia');

const TITULO = 'Hoje É Seu Dia';
const ARTISTA = 'Syden';

/** Compasso ternário, como as canções de aniversário: um-dois-três, um-dois-três. */
const BATIDA = 60 / BPM;

// -------------------------------------------------------------------------------------------------
// A MÚSICA, COMO DADO
//
// Cada linha tem o acorde que a acompanha, o texto que aparece na tela, e as notas com a duração em
// batidas. Toda linha soma 6 batidas (dois compassos), e o script CONFERE isso — uma linha com conta
// errada desalinharia a letra do áudio em silêncio, que é justamente o que este desenho evita.
// -------------------------------------------------------------------------------------------------

/** Nome de nota para número MIDI. C4 é o dó central. */
function midi(nome) {
  const escala = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const casa = nome.match(/^([A-G])(#?)(-?\d)$/);
  if (!casa) throw new Error('nota estranha: ' + nome);
  return 12 * (Number(casa[3]) + 1) + escala[casa[1]] + (casa[2] ? 1 : 0);
}

const hz = (nome) => 440 * Math.pow(2, (midi(nome) - 69) / 12);

/** Os acordes, como tríades. O baixo toca a fundamental uma oitava abaixo. */
const ACORDES = {
  C: ['C4', 'E4', 'G4'],
  F: ['F3', 'A3', 'C4'],
  G: ['G3', 'B3', 'D4'],
};

const ESTROFE_A = [
  { acorde: 'C', texto: 'Hoje o dia é seu', notas: [['E4', 1], ['G4', 1], ['A4', 2], ['G4', 1], ['E4', 1]] },
  { acorde: 'F', texto: 'acende essa vela', notas: [['D4', 1], ['F4', 1], ['A4', 2], ['G4', 2]] },
  { acorde: 'G', texto: 'a vila toda canta', notas: [['E4', 1], ['G4', 1], ['C5', 2], ['B4', 1], ['A4', 1]] },
  { acorde: 'C', texto: 'e chama da janela', notas: [['G4', 2], ['E4', 1], ['D4', 1], ['C4', 2]] },
];

const REFRAO = [
  { acorde: 'C', texto: 'Viva, viva!', notas: [['C5', 1], ['C5', 1], ['B4', 2], ['G4', 2]] },
  { acorde: 'F', texto: 'vem soprar com a gente', notas: [['A4', 1], ['B4', 1], ['C5', 2], ['G4', 2]] },
  { acorde: 'G', texto: 'Viva, viva!', notas: [['C5', 1], ['C5', 1], ['D5', 2], ['B4', 2]] },
  { acorde: 'C', texto: 'mais um ano pela frente', notas: [['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['C4', 2]] },
];

const ESTROFE_B = [
  { acorde: 'C', texto: 'O bolo já espera', notas: [['E4', 1], ['G4', 1], ['A4', 2], ['G4', 1], ['E4', 1]] },
  { acorde: 'F', texto: 'o coelho também', notas: [['D4', 1], ['F4', 1], ['A4', 2], ['G4', 2]] },
  { acorde: 'G', texto: 'e quem gosta de você', notas: [['E4', 1], ['G4', 1], ['C5', 2], ['B4', 1], ['A4', 1]] },
  { acorde: 'C', texto: 'canta junto, vem!', notas: [['G4', 2], ['E4', 1], ['D4', 1], ['C4', 2]] },
];

/** A ordem da música. O refrão repete de propósito: numa roda, todo mundo pega na segunda vez. */
const LINHAS = [...ESTROFE_A, ...REFRAO, ...ESTROFE_B, ...REFRAO];

/** Dois compassos de introdução, com três cliques no fim para a roda entrar junta. */
const INTRO_BATIDAS = 6;

// -------------------------------------------------------------------------------------------------
// A SÍNTESE
// -------------------------------------------------------------------------------------------------

const duracaoTotal = (INTRO_BATIDAS + LINHAS.length * 6) * BATIDA + 1.2;
const amostras = Math.ceil(duracaoTotal * TAXA);
const trilha = new Float32Array(amostras);

/**
 * Soma uma nota na trilha.
 *
 * O envelope não é enfeite. Sem a subida e a descida suaves, cada nota começa e termina num degrau, e
 * degrau em forma de onda é ESTALO — o defeito mais audível de síntese ingênua.
 */
function nota(inicio, segundos, frequencia, volume, harmonicos) {
  const de = Math.floor(inicio * TAXA);
  const quantas = Math.floor(segundos * TAXA);
  const subida = Math.min(Math.floor(0.02 * TAXA), quantas / 4);
  const descida = Math.min(Math.floor(0.12 * TAXA), quantas / 2);

  for (let i = 0; i < quantas; i++) {
    const t = i / TAXA;
    let envelope = 1;
    if (i < subida) envelope = i / subida;
    else if (i > quantas - descida) envelope = (quantas - i) / descida;
    // Queda lenta ao longo da nota: instrumento de verdade não sustenta parado.
    envelope *= 1 - 0.25 * (i / quantas);

    // Vibrato de leve, para não soar a apito de teste.
    const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * t);
    let onda = 0;
    for (let h = 0; h < harmonicos.length; h++) {
      onda += harmonicos[h] * Math.sin(2 * Math.PI * frequencia * vibrato * (h + 1) * t);
    }
    if (de + i < amostras) trilha[de + i] += onda * envelope * volume;
  }
}

/** A voz-guia tem harmônicos: senoide pura soa a aparelho de audiometria, não a melodia. */
const VOZ = [1, 0.32, 0.14, 0.05];
const ACOMPANHA = [1, 0.16];

/** O clique da contagem: curtíssimo e sem altura definida, para não virar parte da harmonia. */
function clique(inicio) {
  const de = Math.floor(inicio * TAXA);
  const quantas = Math.floor(0.05 * TAXA);
  for (let i = 0; i < quantas; i++) {
    const queda = 1 - i / quantas;
    if (de + i < amostras) trilha[de + i] += Math.sin(2 * Math.PI * 1400 * (i / TAXA)) * queda * queda * 0.12;
  }
}

// A introdução: o acorde de dó, e três cliques na segunda metade para a roda entrar no tempo.
for (const n of ACORDES.C) nota(0, 3 * BATIDA, hz(n), 0.1, ACOMPANHA);
for (let b = 3; b < 6; b++) clique(b * BATIDA);

let batida = INTRO_BATIDAS;
/** Onde cada linha começa, em segundos. É daqui que sai o .lrc — a mesma conta, num lugar só. */
const marcas = [];

for (const linha of LINHAS) {
  const soma = linha.notas.reduce((s, [, b]) => s + b, 0);
  if (soma !== 6) throw new Error(`a linha "${linha.texto}" soma ${soma} batidas, e precisa somar 6`);

  const inicio = batida * BATIDA;
  marcas.push({ em: inicio, texto: linha.texto });

  // O acompanhamento: a tríade nos dois compassos, e o baixo na primeira batida de cada um.
  const acorde = ACORDES[linha.acorde];
  for (let compasso = 0; compasso < 2; compasso++) {
    const quando = inicio + compasso * 3 * BATIDA;
    for (const n of acorde) nota(quando, 3 * BATIDA * 0.95, hz(n), 0.075, ACOMPANHA);
    nota(quando, 3 * BATIDA * 0.9, hz(acorde[0]) / 2, 0.11, [1, 0.3]);
  }

  // A melodia por cima. O 0.92 deixa um respiro entre as notas; sem ele tudo vira uma nota só.
  let dentro = 0;
  for (const [nome, batidas] of linha.notas) {
    nota(inicio + dentro * BATIDA, batidas * BATIDA * 0.92, hz(nome), 0.3, VOZ);
    dentro += batidas;
  }

  batida += 6;
}

// -------------------------------------------------------------------------------------------------
// GRAVAR
// -------------------------------------------------------------------------------------------------

/**
 * Normaliza para o pico encostar em 0.89, e não em 1.
 *
 * Somar melodia, acordes e baixo passa de 1 com facilidade — e passar de 1 num arquivo de 16 bits não
 * fica alto, fica DISTORCIDO, porque o valor corta. A margem existe para isso.
 */
let pico = 0;
for (const v of trilha) pico = Math.max(pico, Math.abs(v));
const ganho = pico > 0 ? 0.89 / pico : 1;

const pcm = Buffer.alloc(amostras * 2);
for (let i = 0; i < amostras; i++) pcm.writeInt16LE(Math.round(trilha[i] * ganho * 32767), i * 2);

/** Cabeçalho WAV de 44 bytes: mono, 16 bits. É o formato que server/src/media.ts reconhece pelo RIFF. */
function wav(dados, taxa) {
  const cabeca = Buffer.alloc(44);
  cabeca.write('RIFF', 0);
  cabeca.writeUInt32LE(36 + dados.length, 4);
  cabeca.write('WAVE', 8);
  cabeca.write('fmt ', 12);
  cabeca.writeUInt32LE(16, 16);
  cabeca.writeUInt16LE(1, 20); // PCM sem compressão
  cabeca.writeUInt16LE(1, 22); // mono
  cabeca.writeUInt32LE(taxa, 24);
  cabeca.writeUInt32LE(taxa * 2, 28);
  cabeca.writeUInt16LE(2, 32);
  cabeca.writeUInt16LE(16, 34);
  cabeca.write('data', 36);
  cabeca.writeUInt32LE(dados.length, 40);
  return Buffer.concat([cabeca, dados]);
}

/** "00:12.50", o formato que web/src/lrc.ts sabe ler. */
const relogio = (s) => {
  const m = Math.floor(s / 60);
  const resto = s - m * 60;
  return `${String(m).padStart(2, '0')}:${resto.toFixed(2).padStart(5, '0')}`;
};

const lrc =
  [
    `[ti:${TITULO}]`,
    `[ar:${ARTISTA}]`,
    '[by:gerado por scripts/musica-de-exemplo.mjs]',
    ...marcas.map((m) => `[${relogio(m.em)}] ${m.texto}`),
  ].join('\n') + '\n';

mkdirSync(SAIDA.split('/').slice(0, -1).join('/') || '.', { recursive: true });
writeFileSync(SAIDA + '.wav', wav(pcm, TAXA));
writeFileSync(SAIDA + '.lrc', lrc, 'utf8');

const mb = (n) => (n / (1024 * 1024)).toFixed(2) + ' MB';
console.log(`${SAIDA}.wav  ${mb(44 + pcm.length)}  ${duracaoTotal.toFixed(1)}s  ${TAXA} Hz mono`);
console.log(`${SAIDA}.lrc  ${marcas.length} linhas`);
console.log('');
console.log(`"${TITULO}" — ${ARTISTA}. Melodia e letra originais: nada a licenciar.`);
