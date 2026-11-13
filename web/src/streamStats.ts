import type { LocalTrackPublication, RemoteTrackPublication, TrackPublication } from 'livekit-client';
import { useEffect, useState } from 'react';

// Lê do próprio WebRTC como a transmissão está indo: tamanho da imagem, quadros por segundo e, para quem
// transmite, se o navegador está cortando qualidade por falta de processador ou de banda.

const POLL_MS = 3000;

export interface StreamStats {
  width: number;
  height: number;
  fps: number;
  /** Só para quem transmite: 'cpu' (processador), 'bandwidth' (internet) ou 'none'. */
  limitedBy: 'cpu' | 'bandwidth' | 'other' | 'none';
  kbps: number;
  /** O codec em uso ("H264", "VP8"…): é o que permite comparar um contra o outro na prática. */
  codec: string | null;
  /** Nome do codificador que o navegador escolheu; serve para saber se é a placa de vídeo. */
  encoder: string | null;
  /** O navegador diz que este codificador é o econômico (normalmente, o da placa de vídeo). */
  naPlaca: boolean | null;
  /**
   * A transmissão está publicada mas NADA está sendo codificado, porque ninguém abriu.
   *
   * O Syden pausa as camadas que ninguém está assistindo (dynacast), e uma camada pausada não produz
   * quadro nenhum — logo, não há tamanho, nem taxa, nem codec para medir. Sem este aviso o cartão
   * ficava em "Medindo…" para sempre, e quem transmitia sozinho concluía que estava quebrado. Está
   * tudo certo: é o Syden não gastando processador à toa.
   */
  semPublico: boolean;
}

type Publication = TrackPublication | LocalTrackPublication | RemoteTrackPublication;

/**
 * As taxas que o Syden de fato publica (ver SCREEN_LAYERS, em useVoice.ts). Não existe camada de 29
 * nem de 14: todo número que aparece é uma dessas três, medida com ruído.
 */
const TAXAS = [15, 30, 60];

/**
 * QUANTO ABAIXO DO ALVO AINDA É O ALVO.
 *
 * Um codificador de vídeo nunca entrega o número redondo. Ele perde um quadro aqui e outro ali, e a
 * medição ainda cai numa janela de três segundos que raramente começa junto com um quadro. O
 * resultado normal de uma transmissão SAUDÁVEL de 30 é 29; de 15 é 14.
 */
const TOLERANCIA = 0.9;

/**
 * O número que o olho lê, e não o que o contador mediu.
 *
 * O RELATO QUE MOTIVOU ISTO: "esses números quebrados, diferentes de 30/60, são lidos como 'tem
 * algum erro na transmissão'". E ele está certo — as duas telas que ele mandou, "360p · 14 fps" e
 * "1080p · 29 fps", eram as DUAS transmissões perfeitas: 14 é a camada de 15 e 29 é a de 30. A tela
 * estava transformando funcionamento normal em suspeita de defeito.
 *
 * Então a taxa volta para o alvo quando está dentro da tolerância, e só mostra o número cru quando
 * ele está mesmo longe — que é quando o número é informação, e não ruído.
 *
 * Isto NÃO é esconder problema: 22 fps continua aparecendo como 22.
 */
export function taxaRedonda(fps: number): number {
  const alvo = TAXAS.find((taxa) => fps >= taxa * TOLERANCIA && fps <= taxa);
  return alvo ?? Math.round(fps);
}

/** "1080p · 60 fps" a partir da altura da imagem, como as pessoas falam de qualidade. */
export function describeStats(stats: StreamStats | null) {
  if (!stats || !stats.height) return null;
  const linhas = stats.height >= 2000 ? '4K' : `${stats.height}p`;
  // Os quadros por segundo só aparecem depois da segunda medição; antes disso, mostra só o tamanho.
  return stats.fps >= 1 ? `${linhas} · ${taxaRedonda(stats.fps)} fps` : linhas;
}

async function read(publication: Publication | undefined, local: boolean): Promise<StreamStats | null> {
  const track = publication?.track;
  if (!track) return null;
  try {
    const report = await track.getRTCStatsReport();
    if (!report) return null;
    let stats: StreamStats | null = null;
    let vistas = 0;
    let pausadas = 0;
    // O nome do codec vive numa entrada à parte do relatório, apontada por codecId.
    const codecs = new Map<string, string>();
    report.forEach((entry: Record<string, unknown>) => {
      if (entry.type === 'codec' && typeof entry.mimeType === 'string') {
        codecs.set(String(entry.id), entry.mimeType.replace(/^video\//i, '').toUpperCase());
      }
    });
    report.forEach((entry: Record<string, unknown>) => {
      const type = entry.type as string;
      if (type !== (local ? 'outbound-rtp' : 'inbound-rtp') || entry.kind !== 'video') return;
      const width = Number(entry.frameWidth ?? 0);
      const height = Number(entry.frameHeight ?? 0);
      // Com camadas (simulcast), a maior é a que interessa: é a que aparece em tela cheia.
      if (stats && height <= stats.height) return;
      const reason = String(entry.qualityLimitationReason ?? 'none');
      // 'active' é o próprio navegador dizendo que aquela camada está pausada.
      if (entry.active === false) pausadas += 1;
      vistas += 1;
      stats = {
        width,
        height,
        fps: Number(entry.framesPerSecond ?? 0),
        limitedBy: reason === 'cpu' || reason === 'bandwidth' || reason === 'none' ? reason : 'other',
        kbps: 0,
        codec: codecs.get(String(entry.codecId ?? '')) ?? null,
        encoder: typeof entry.encoderImplementation === 'string' ? entry.encoderImplementation : null,
        naPlaca: typeof entry.powerEfficientEncoder === 'boolean' ? entry.powerEfficientEncoder : null,
        semPublico: false,
      };
    });
    // Só vale a pena dizer "ninguém assistindo" quando existem camadas E nenhuma delas está correndo:
    // no primeiro segundo depois de começar, ainda não há relatório, e aí o certo é "medindo".
    // O `as` é por causa do estreitamento do TypeScript dentro do forEach: ele conclui que `stats`
    // continua nulo, porque não sabe que o callback já rodou. O valor é o que foi escrito ali dentro.
    const medido = stats as StreamStats | null;
    if (medido && vistas > 0 && pausadas === vistas) medido.semPublico = true;
    return medido;
  } catch {
    return null;
  }
}

/** Acompanha uma transmissão e devolve como ela está agora; atualiza a cada 3 segundos. */
export function useStreamStats(publication: Publication | undefined, { local = false, active = true } = {}) {
  const [stats, setStats] = useState<StreamStats | null>(null);

  useEffect(() => {
    if (!active || !publication) {
      setStats(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const next = await read(publication, local);
      if (!cancelled) setStats(next);
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [publication, local, active]);

  return stats;
}

// ---------- "Banda" que não é a internet ----------

/**
 * O CHROME DIZ "BANDA" TAMBÉM QUANDO A VERSÃO BATE NO TETO DELA (medido em 12/11/2026, `e2e/versoes-da-tela.mjs`). Cada
 * versão da transmissão tem um teto de taxa (o maxBitrate); com imagem difícil e o teto curto, o codificador encolhe a
 * imagem para caber, e o `qualityLimitationReason` diz 'bandwidth' — no mesmo computador, com a internet sobrando. Do
 * diário de 11/11: "apertada pela internet · sai 427×240… (a internet estima 26034)".
 *
 * Isso tinha dois custos. O diário culpava a internet de quem transmitia. E a otimização dinâmica (nextQuality) encolhia
 * a imagem num quadro ruim e só a devolvia com o motivo 'none', que não vinha nunca: medido, uma versão de 540p a
 * 1,5 Mbps desceu a 180p, 135p e 90p e não voltou.
 *
 * A REGRA: "banda" só é a internet quando a estimativa do navegador NÃO COBRE a soma dos tetos das versões ligadas. Se
 * cobre, a internet daria conta de todas elas cheias, e o aperto é o teto ('teto').
 */
export type MotivoDoAperto = StreamStats['limitedBy'] | 'teto';

export function motivoDoAperto(limitedBy: StreamStats['limitedBy'], estimativaKbps: number | null, somaDosTetosKbps: number): MotivoDoAperto {
  if (limitedBy !== 'bandwidth' || estimativaKbps === null || somaDosTetosKbps <= 0) return limitedBy;
  return estimativaKbps >= somaDosTetosKbps ? 'teto' : 'bandwidth';
}

// ---------- Otimização dinâmica da transmissão ----------

/** Piso de quadros por segundo abaixo do qual a imagem visivelmente engasga. */
export const FPS_FLOOR = 20;
/** Acima disto, e com folga, dá para tentar devolver a nitidez. */
export const FPS_COMFORT = 27;
/** Degraus de redução da imagem: 1 = tamanho cheio, 2 = metade da largura e da altura. */
export const SCALE_STEPS = [1, 1.5, 2, 3];
/** Quantas medições folgadas seguidas antes de subir de novo (evita ficar subindo e descendo). */
const PATIENCE = 3;

export interface AutoQuality {
  /** Posição em SCALE_STEPS. */
  step: number;
  /** Medições folgadas seguidas até agora. */
  comfortable: number;
}

/**
 * Decide o próximo degrau de qualidade a partir da última medição. Regra: quem assiste sente mais a
 * imagem travando do que a imagem menor, então, quando falta processador ou banda, encolhe-se a imagem
 * para segurar os quadros; a nitidez só volta depois de um tempo bom com folga.
 *
 * O aperto pelo TETO da versão (motivoDoAperto) não é falta de máquina nem de internet: não encolhe, e não segura a
 * volta. Quem encolhe dentro do teto é o próprio codificador, e ele mesmo desfaz quando a imagem acalma.
 */
export function nextQuality(current: AutoQuality, sample: { fps: number; limitedBy: MotivoDoAperto }): AutoQuality {
  if (sample.fps <= 0) return current; // ainda medindo, ou ninguém assistindo
  const struggling = sample.fps < FPS_FLOOR && (sample.limitedBy === 'cpu' || sample.limitedBy === 'bandwidth');

  if (struggling) {
    return { step: Math.min(current.step + 1, SCALE_STEPS.length - 1), comfortable: 0 };
  }
  if (current.step > 0 && sample.fps >= FPS_COMFORT && (sample.limitedBy === 'none' || sample.limitedBy === 'teto')) {
    const comfortable = current.comfortable + 1;
    return comfortable >= PATIENCE ? { step: current.step - 1, comfortable: 0 } : { step: current.step, comfortable };
  }
  return { step: current.step, comfortable: 0 };
}

// ---------- O Fluido que não aguenta os 60 ----------

/** Abaixo disto, com o computador ou a internet apertando, os 60 quadros não estão acontecendo. */
export const FPS_FLUIDO_MINIMO = 45;
/** Quantas medições apertadas seguidas antes de cair para 30 (um soluço não derruba). */
const APERTOS_PARA_CAIR = 3;

export interface Fluido {
  /** Medições apertadas seguidas até agora. */
  apertos: number;
  /** Já caiu para 30 nesta transmissão. Não volta: subir e descer de novo seria pior que ficar. */
  em30: boolean;
}

/** Decide se o Fluido desta transmissão cai para 30 quadros, a partir da última medição. */
export function proximoFluido(atual: Fluido, amostra: { fps: number; limitedBy: StreamStats['limitedBy'] }): Fluido {
  if (atual.em30 || amostra.fps <= 0) return atual; // já caiu, ou ainda medindo / ninguém assistindo
  const apertado = amostra.fps < FPS_FLUIDO_MINIMO && (amostra.limitedBy === 'cpu' || amostra.limitedBy === 'bandwidth');
  if (!apertado) return { apertos: 0, em30: false };
  const apertos = atual.apertos + 1;
  return { apertos, em30: apertos >= APERTOS_PARA_CAIR };
}

// ---------- A tela parada pede nitidez ----------

/** Abaixo disto, em quadros codificados por segundo, a imagem está parada: site, slide, planilha. */
export const FPS_PARADA = 5;
/** A partir disto voltou o movimento. O vão entre os dois é a folga que impede o vaivém. */
export const FPS_MOVIMENTO = 12;
/** Medições paradas seguidas antes de ir para a nitidez (~8 s com a conferência de 4 em 4). */
const PARADAS_PARA_NITIDEZ = 2;

export interface Parada {
  /** Medições paradas seguidas até agora. */
  paradas: number;
  /** A transmissão está priorizando a nitidez (manter a resolução) em vez dos quadros. */
  nitida: boolean;
}

/**
 * Decide se o Padrão prioriza nitidez ou quadros, pela quantidade de quadros que o codificador
 * produziu desde a última medição. A captura de tela só entrega quadro quando algo muda: imagem parada
 * gera quase nada, e é isso que a medida enxerga, sem processar a imagem.
 *
 * Ir para a nitidez é devagar (duas medições paradas: um jogo com pausa curta não troca); voltar ao
 * movimento é na hora (uma medição com quadros: rolar a página não pode borrar à espera da regra).
 * `null` é "não deu para medir" — ninguém assistindo, ou a primeira medição — e não muda nada.
 *
 * APERTO CONTA COMO MOVIMENTO. Tela parada quase não gera dados, então ela praticamente nunca aperta o
 * processador nem a internet. Se apertou, é porque há movimento sendo estrangulado — e com a nitidez
 * ligada o navegador sacrifica os quadros, então um jogo começando depois de um slide podia nunca passar
 * dos 12 e ficar preso numa sequência de fotos.
 */
export function proximaParada(atual: Parada, fps: number | null, apertado = false): Parada {
  if (fps === null) return atual;
  if (atual.nitida) return fps >= FPS_MOVIMENTO || apertado ? { paradas: 0, nitida: false } : atual;
  if (fps >= FPS_PARADA || apertado) return { paradas: 0, nitida: false };
  const paradas = atual.paradas + 1;
  return { paradas, nitida: paradas >= PARADAS_PARA_NITIDEZ };
}

// ---------- O degrau leve: o computador ou a internet que não dão conta ----------

/**
 * O DEGRAU LEVE DO PADRÃO (12/11/2026, relato de quem usa: ajudando uma amiga a instalar a impressora, o notebook dela
 * "não tava tankando 1080p a 30 fps", e o texto chegava ilegível). Com o processador ou a internet apertando, o navegador
 * segura os 30 quadros e ENCOLHE a imagem (maintain-framerate): para jogo é o certo, para ler uma tela e dar instrução é
 * o pior. E, como ele segura os 30, a medida de quadros quase não cai: o aperto aparece no MOTIVO, não no número.
 *
 * Por isso o degrau leve olha o motivo: apertado (processador ou internet, não o teto da versão) por 3 s seguidos, a
 * transmissão passa a 720p no máximo, até 15 quadros, e segura a NITIDEZ (maintain-resolution). Na
 * realidade de quem tem notebook fraco e internet de celular, é o que dá para ler. Folgou por ~24 s, volta ao normal UMA
 * vez; se apertar de novo, fica no leve até o fim da transmissão (subir e descer seria pior que ficar).
 *
 * O LEVE É DE QUEM MOSTRA UMA TELA, NUNCA DE QUEM JOGA (pergunta dele, mesmo dia: "o jogador se beneficia de altos
 * frames; é o oposto do gamer"). Jogo pesado também aperta o processador, e para ele encolher a imagem e segurar os
 * quadros continua o certo. O que separa os dois é QUANTO A TELA MUDA: o navegador só captura um quadro quando algo
 * mudou na tela, e jogo muda sempre (os 30 da captura), enquanto Configurações, instalador ou planilha mudam com o
 * cursor e um clique aqui e ali. Por isso o leve só entra com a tela mudando MENOS de 15 vezes por segundo — o que ele
 * segura; acima disso, cortar para 15 tiraria quadros de verdade — e nunca numa janela que o app reconhece como jogo
 * (generoDoJogo.ts). Sem saber quanto a tela muda (navegador sem a medida), conta como movimento: na dúvida, o jogador.
 * E se a tela passa a mexer de verdade dentro do leve (abriu o jogo depois de ajudar), 2 s seguidos tiram dele.
 *
 * O LEVE MEDE DE SEGUNDO EM SEGUNDO (pergunta dele, mesmo dia: "8 s de transição podem ser percebidos como lag"), num laço
 * só dele (MEDIDA_DO_LEVE_MS), e não na conferência geral de 4 s: com duas conferências, o jogo aberto dentro do leve
 * passava até 8 s a 15 quadros, e o texto ficava até 8 s borrado antes de entrar. As contas abaixo são em medidas de 1 s.
 */
export const FPS_DO_LEVE = 15;
export const ALTURA_DO_LEVE = 720;
/** O teto de taxa da versão grande no leve: 720p a 15 quadros cabe folgado nisto. */
export const KBPS_DO_LEVE = 2000;
export const MEDIDA_DO_LEVE_MS = 1000;
export const APERTOS_PARA_O_LEVE = 3;
export const FOLGAS_PARA_SAIR_DO_LEVE = 24;
export const MOVIMENTOS_PARA_SAIR_DO_LEVE = 2;

export interface Leve {
  ligado: boolean;
  /** Medições apertadas seguidas (fora do leve) ou folgadas seguidas (dentro dele). */
  seguidas: number;
  /** Quantas vezes entrou nesta transmissão: na segunda, fica (menos se a tela passar a mexer). */
  vezes: number;
  /** Dentro do leve: medições seguidas com a tela em movimento. */
  movimentos: number;
}

export const LEVE_INICIAL: Leve = { ligado: false, seguidas: 0, vezes: 0, movimentos: 0 };

/**
 * A tela está em movimento (jogo, vídeo, rolagem sem parar)? `quadrosDaTela` é quantas vezes por segundo a captura
 * mudou na última medição (null quando o navegador não diz), e `jogo` é a janela que o app reconhece como jogo.
 *
 * DENTRO do leve a medida não passa de 15: o navegador conta os quadros da captura DEPOIS do teto de quadros da
 * transmissão (medido em e2e/degrau-leve.mjs: o jogo dentro do leve dava 14,4 a 15,0). Lá, chegar perto do teto (80%)
 * já é movimento: a tela muda mais do que o leve deixa passar.
 */
export function telaEmMovimento(quadrosDaTela: number | null, jogo: boolean, noLeve = false): boolean {
  return jogo || quadrosDaTela === null || quadrosDaTela >= (noLeve ? FPS_DO_LEVE * 0.8 : FPS_DO_LEVE);
}

/**
 * Decide o degrau leve pela última medição. `medindo` é falso quando não deu para medir (ninguém assistindo), e
 * `movimento` vem de telaEmMovimento.
 */
export function proximoLeve(atual: Leve, motivo: MotivoDoAperto, medindo: boolean, movimento: boolean): Leve {
  if (!medindo) return atual;
  const apertado = motivo === 'cpu' || motivo === 'bandwidth';
  if (!atual.ligado) {
    if (!apertado || movimento) return { ...atual, seguidas: 0 };
    const seguidas = atual.seguidas + 1;
    return seguidas >= APERTOS_PARA_O_LEVE ? { ligado: true, seguidas: 0, vezes: atual.vezes + 1, movimentos: 0 } : { ...atual, seguidas };
  }
  const movimentos = movimento ? atual.movimentos + 1 : 0;
  if (movimentos >= MOVIMENTOS_PARA_SAIR_DO_LEVE) return { ligado: false, seguidas: 0, vezes: atual.vezes, movimentos: 0 };
  atual = { ...atual, movimentos };
  if (atual.vezes >= 2) return atual;
  if (apertado) return { ...atual, seguidas: 0 };
  const seguidas = atual.seguidas + 1;
  return seguidas >= FOLGAS_PARA_SAIR_DO_LEVE ? { ligado: false, seguidas: 0, vezes: atual.vezes, movimentos: 0 } : { ...atual, seguidas };
}

/** A redução de cada versão no leve: nenhuma passa de 720 de altura, e nenhuma fica maior do que já era. */
export function reducaoNoLeve(reducaoDeFabrica: number, alturaDaCaptura: number): number {
  return Math.max(reducaoDeFabrica, alturaDaCaptura / ALTURA_DO_LEVE);
}

// ---------- O aperto que fica registrado ----------

/**
 * A TRANSMISSÃO APERTADA VAI PARA O DIÁRIO DE SAÚDE (20/10/2026). O relato foi "a transmissão está toda embaçada", e a
 * causa (internet de quem transmite, processador dele, ou a internet de quem assiste) só aparecia no "i" de quem
 * TRANSMITIA, enquanto transmitia — ninguém lembra de abrir, e depois já não há como saber. Agora, apertada por umas três
 * medições seguidas (~12 s), uma linha sai sozinha com os números, uma vez por motivo em cada transmissão.
 */
export const MEDIDAS_PARA_REGISTRAR = 3;

export interface Aperto {
  /** Medições apertadas seguidas, e por qual motivo. */
  seguidas: number;
  motivo: MotivoRegistrado | null;
  /** Os motivos já registrados nesta transmissão. */
  registrados: MotivoRegistrado[];
}

/** O que vai ao diário: o processador, a internet, ou o teto da versão (ver motivoDoAperto). */
export type MotivoRegistrado = 'cpu' | 'bandwidth' | 'teto';

export const APERTO_INICIAL: Aperto = { seguidas: 0, motivo: null, registrados: [] };

/** Conta a medição; `registrar` diz se é a hora de mandar a linha (uma vez por motivo). */
export function proximoAperto(atual: Aperto, limitedBy: MotivoDoAperto, codificando: boolean): { aperto: Aperto; registrar: boolean } {
  const motivo = limitedBy === 'cpu' || limitedBy === 'bandwidth' || limitedBy === 'teto' ? limitedBy : null;
  if (!codificando || !motivo) return { aperto: { ...atual, seguidas: 0, motivo: null }, registrar: false };
  const seguidas = motivo === atual.motivo ? atual.seguidas + 1 : 1;
  if (seguidas >= MEDIDAS_PARA_REGISTRAR && !atual.registrados.includes(motivo)) {
    return { aperto: { seguidas, motivo, registrados: [...atual.registrados, motivo] }, registrar: true };
  }
  return { aperto: { ...atual, seguidas, motivo }, registrar: false };
}

/** A linha do diário (cabe nos 200 caracteres que o servidor guarda). */
export function resumoDoAperto(m: {
  motivo: MotivoRegistrado;
  segundos: number;
  largura: number;
  altura: number;
  fps: number;
  kbps: number | null;
  estimativaKbps: number | null;
  codec: string | null;
  naPlaca: boolean | null;
  modo: string;
}): string {
  const partes = [
    `apertada há ${Math.round(m.segundos)} s ${m.motivo === 'cpu' ? 'pelo processador' : m.motivo === 'teto' ? 'pelo teto da versão' : 'pela internet'}`,
    `sai ${m.largura}×${m.altura} a ${Math.round(m.fps)} fps` +
      (m.kbps !== null ? `, ${m.kbps} kbps` : '') +
      (m.estimativaKbps !== null ? ` (a internet estima ${m.estimativaKbps})` : ''),
    [m.codec ?? 'codec ?', m.naPlaca === true ? 'pela placa' : m.naPlaca === false ? 'pelo processador' : null].filter(Boolean).join(' '),
    m.modo,
  ];
  return partes.join(' · ').slice(0, 200);
}
