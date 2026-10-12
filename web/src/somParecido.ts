// "ESSE SOM JÁ ESTÁ AQUI?", PELO SOM, E NÃO PELO ARQUIVO (11/10/2026).
//
// O servidor já recusa o mesmo ARQUIVO duas vezes (o sha, ver db.ts). Mas o relato que começou isto foi
// "Por favor, me ajuda" ao lado de "Me ajuda (de novo)": o mesmo som baixado de outro lugar, ou
// recodificado, tem bytes diferentes e passa. Para pegar esse caso é preciso comparar o SOM.
//
// A COMPARAÇÃO É A FORMA DO VOLUME NO TEMPO (o "envelope"): quando sobe, quando cai, quando silencia.
// Recodificar muda os bytes e quase nada dessa forma. Corta-se o silêncio do começo e do fim (um arquivo
// vem com meio segundo a mais), reduz-se tudo a 128 pontos e mede-se a correlação.
//
// É AVISO, NUNCA BLOQUEIO, e roda no navegador de quem envia. Dois sons curtos diferentes — dois bipes —
// podem ter a mesma forma, e só uma pessoa decide. E o servidor não precisaria decodificar MP3 nem guardar
// nada novo: os sons da comunidade já são baixáveis pelo endereço que o soundboard usa para tocar.

/** Quantos pontos a forma tem depois de reduzida. */
const PONTOS = 128;
/** Janela de cada medida de volume, em segundos. */
const JANELA = 0.02;
/** Abaixo disto (fração do pico) é silêncio, e sai das pontas. */
const SILENCIO = 0.02;
/** A partir desta correlação, é o mesmo som. Recodificado dá 0,99; sons diferentes, bem menos. */
export const PARECIDO = 0.95;
/** Durações que diferem mais que isto (depois de cortar o silêncio) não são o mesmo som. */
const FOLGA_DE_DURACAO = 0.1;

export interface Impressao {
  forma: Float32Array;
  /** Duração sem o silêncio das pontas, em segundos. */
  segundos: number;
}

/** A forma do volume de um som já decodificado (um canal só, amostras de -1 a 1). */
export function impressaoDe(amostras: Float32Array, taxa: number): Impressao | null {
  const passo = Math.max(1, Math.round(taxa * JANELA));
  const volumes: number[] = [];
  for (let i = 0; i < amostras.length; i += passo) {
    let soma = 0;
    const fim = Math.min(amostras.length, i + passo);
    for (let j = i; j < fim; j++) soma += amostras[j] * amostras[j];
    volumes.push(Math.sqrt(soma / (fim - i)));
  }
  const pico = Math.max(0, ...volumes);
  if (pico === 0) return null; // silêncio puro: não há forma para comparar
  let ini = 0;
  let fim = volumes.length - 1;
  while (ini < fim && volumes[ini] < pico * SILENCIO) ini += 1;
  while (fim > ini && volumes[fim] < pico * SILENCIO) fim -= 1;
  const util = volumes.slice(ini, fim + 1);

  // Reduz (ou estica) para PONTOS, pela média de cada pedaço, e normaliza pelo pico.
  const forma = new Float32Array(PONTOS);
  for (let k = 0; k < PONTOS; k++) {
    const a = Math.floor((k * util.length) / PONTOS);
    const b = Math.max(a + 1, Math.floor(((k + 1) * util.length) / PONTOS));
    let soma = 0;
    for (let j = a; j < b; j++) soma += util[Math.min(j, util.length - 1)];
    forma[k] = soma / (b - a) / pico;
  }
  return { forma, segundos: util.length * JANELA };
}

/** Quão parecidas são duas impressões, de 0 a 1 (a correlação das formas; 0 se a duração destoa). */
export function semelhanca(a: Impressao, b: Impressao): number {
  const maior = Math.max(a.segundos, b.segundos);
  if (maior > 0 && Math.abs(a.segundos - b.segundos) / maior > FOLGA_DE_DURACAO) return 0;
  const media = (v: Float32Array) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = media(a.forma);
  const mb = media(b.forma);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < PONTOS; i++) {
    const da = a.forma[i] - ma;
    const db = b.forma[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  // Forma chapada (volume constante): a correlação não diz nada, e "parecido" seria palpite.
  if (va === 0 || vb === 0) return 0;
  return Math.max(0, cov / Math.sqrt(va * vb));
}

// ---------- No navegador ----------

/** Decodifica um áudio e tira a impressão, misturando os canais num só. */
async function impressaoDoArquivo(dados: ArrayBuffer): Promise<Impressao | null> {
  const contexto = new OfflineAudioContext(1, 1, 44100);
  const audio = await contexto.decodeAudioData(dados);
  const mono = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const canal = audio.getChannelData(c);
    for (let i = 0; i < canal.length; i++) mono[i] += canal[i] / audio.numberOfChannels;
  }
  return impressaoDe(mono, audio.sampleRate);
}

// As impressões dos sons que já estão aqui, guardadas enquanto a página está aberta: comparar de novo não
// baixa de novo.
const jaTiradas = new Map<number, Promise<Impressao | null>>();

/** A impressão de um som que já está aqui, baixando-o só da primeira vez. Falha vira null. */
function impressaoDoSom(id: number, endereco: (id: number) => string): Promise<Impressao | null> {
  if (!jaTiradas.has(id)) {
    jaTiradas.set(
      id,
      fetch(endereco(id))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then(impressaoDoArquivo)
        .catch(() => null),
    );
  }
  return jaTiradas.get(id)!;
}

/**
 * Procura, entre os sons que já estão no soundboard, um que pareça o mesmo deste arquivo. Devolve o nome
 * dele, ou null. Qualquer falha (arquivo que o navegador não decodifica, som que não baixa) vira "não
 * achei": o aviso é ajuda, e nunca pode impedir alguém de enviar.
 */
export async function somParecidoCom(
  arquivo: Blob,
  sons: { id: number; name: string }[],
  endereco: (id: number) => string,
): Promise<string | null> {
  try {
    const nova = await impressaoDoArquivo(await arquivo.arrayBuffer());
    if (!nova) return null;
    for (const som of sons) {
      const dela = await impressaoDoSom(som.id, endereco);
      if (dela && semelhanca(nova, dela) >= PARECIDO) return som.name;
    }
  } catch {
    // não deu para comparar: segue sem aviso
  }
  return null;
}

/**
 * Junta os sons que parecem ser o mesmo, em grupos (se A parece B e B parece C, os três ficam juntos). É a
 * faxina dos repetidos que entraram ANTES do aviso existir — quem administra ouve e decide qual fica.
 * Devolve só os grupos com dois ou mais.
 */
export function agruparParecidos<T extends { id: number }>(sons: T[], impressoes: Map<number, Impressao | null>): T[][] {
  const pai = new Map(sons.map((s) => [s.id, s.id]));
  const raiz = (id: number): number => {
    let r = id;
    while (pai.get(r) !== r) r = pai.get(r)!;
    pai.set(id, r);
    return r;
  };
  for (let i = 0; i < sons.length; i++) {
    const a = impressoes.get(sons[i].id);
    if (!a) continue;
    for (let j = i + 1; j < sons.length; j++) {
      const b = impressoes.get(sons[j].id);
      if (b && semelhanca(a, b) >= PARECIDO) pai.set(raiz(sons[j].id), raiz(sons[i].id));
    }
  }
  const grupos = new Map<number, T[]>();
  for (const som of sons) {
    const r = raiz(som.id);
    grupos.set(r, [...(grupos.get(r) ?? []), som]);
  }
  return [...grupos.values()].filter((g) => g.length > 1);
}

/** Baixa e compara os sons dados, e devolve os grupos de parecidos. */
export async function procurarRepetidos<T extends { id: number }>(sons: T[], endereco: (id: number) => string): Promise<T[][]> {
  const impressoes = new Map<number, Impressao | null>();
  for (const som of sons) impressoes.set(som.id, await impressaoDoSom(som.id, endereco));
  return agruparParecidos(sons, impressoes);
}
