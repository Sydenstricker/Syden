/**
 * QUEM ASSISTE NO SEGUNDO MONITOR ENQUANTO JOGA (14/11/2026, relato: FPS baixo no LoL; a ideia de medir é dele: "a segunda
 * tela não pode se dar ao luxo de consumir tantos recursos").
 *
 * No mesmo monitor do jogo, o Chrome percebe que está coberto, e a página e o vídeo param sozinhos (medido). No SEGUNDO
 * monitor o Syden fica à vista e sem foco, e a transmissão de um amigo segue decodificada em 1080p: em VP8, que é
 * decodificado pelo PROCESSADOR, ~1,8 núcleo, disputado com o jogo.
 *
 * Pausar sem foco seria a tela mentindo para quem está mesmo olhando. Então o Syden MEDE: sem foco E com o computador
 * apertado, a imagem (tela e câmeras) cai para a versão menor (540p, ~¼ do custo de decodificar), e volta com o foco ou
 * com o computador folgado por 20 s. É o degrau leve de quem transmite, do lado de quem assiste.
 *
 * Os dois sinais, porque o navegador não deixa ver RAM nem placa de vídeo:
 * - a PRESSÃO DO PROCESSADOR (Compute Pressure API, Chrome e Edge): do computador inteiro, e entregue mesmo sem foco
 *   enquanto o microfone está aberto, que é o caso numa chamada (medido). Num processador grande o jogo pode nem tirá-la do
 *   normal; mas aí os núcleos que sobram decodificam sem atrapalhar, e o sinal acende quando importa;
 * - os QUADROS PERDIDOS na decodificação (o WebRTC conta, em todo navegador): o Syden atrasando é sinal de disputa.
 *
 * O "FAIR" SOZINHO NÃO CONTA (16/11/2026, relato: a turma assistindo à gravação do Mundial, "às vezes pixelando tudo"; o
 * diário mostrou quem assistia caindo à versão menor com o processador só em "fair"). Decodificar uma transmissão 1080p já
 * põe o processador em "fair": assistir sem foco bastava para a pessoa piorar a própria imagem. Agora é o "serious" (na
 * hora), o "fair" JUNTO com quadros perdidos (uma medida basta: os dois sinais se confirmam), ou os quadros perdidos sozinhos
 * em duas medidas seguidas.
 */

export type Pressao = 'nominal' | 'fair' | 'serious' | 'critical';

export interface EstadoDoAperto {
  apertado: boolean;
  /** desde quando está folgado sem parar (ms), ou null */
  folgadoDesde: number | null;
  /** já voltou à maior uma vez neste período sem foco? Então o próximo aperto fica até o foco voltar. */
  jaVoltou: boolean;
  /** quantas medidas seguidas perderam quadros demais */
  perdasSeguidas: number;
}

export const ESTADO_INICIAL: EstadoDoAperto = { apertado: false, folgadoDesde: null, jaVoltou: false, perdasSeguidas: 0 };
/** Folgado por este tempo, a imagem volta à maior. */
export const FOLGA_PARA_VOLTAR_MS = 20_000;
/** Mais que esta fração dos quadros perdidos na decodificação, em PERDAS_SEGUIDAS medidas seguidas, conta como aperto. Uma
 * só não basta: trocar de versão (a maior e a menor) também perde alguns quadros num segundo, e isso não é disputa. */
export const PERDA_DE_QUADROS = 0.1;
export const PERDAS_SEGUIDAS = 2;

export interface Medida {
  /** a janela está em foco e à vista? */
  comFoco: boolean;
  /** a última leitura do processador, ou null onde o navegador não tem a API */
  pressao: Pressao | null;
  /** a fração de quadros perdidos desde a medida anterior (0 a 1), ou null sem vídeo chegando */
  perdaDeQuadros: number | null;
  /** agora, em ms */
  agora: number;
}

export function proximoApertoDeQuemAssiste(antes: EstadoDoAperto, m: Medida): EstadoDoAperto {
  // Com foco, a pessoa está olhando: a imagem é a de sempre, e a conta recomeça.
  if (m.comFoco) return ESTADO_INICIAL;
  const perdendo = m.perdaDeQuadros !== null && m.perdaDeQuadros > PERDA_DE_QUADROS;
  const perdasSeguidas = perdendo ? antes.perdasSeguidas + 1 : 0;
  const aperto =
    m.pressao === 'serious' ||
    m.pressao === 'critical' ||
    (m.pressao === 'fair' && perdendo) ||
    perdasSeguidas >= PERDAS_SEGUIDAS;
  if (aperto) return { ...antes, apertado: true, folgadoDesde: null, perdasSeguidas };
  if (!antes.apertado) return { ...antes, folgadoDesde: null, perdasSeguidas };
  // Apertou de novo depois de voltar: o computador está no limite (o jogo continua aberto), e a imagem fica a menor até o
  // foco voltar, em vez de subir e descer a cada 20 s.
  if (antes.jaVoltou) return { ...antes, folgadoDesde: null, perdasSeguidas };
  // Apertado e a medida está boa: só volta depois de folgado por um tempo, para não subir e descer a cada leitura.
  // ("fair" ainda não é folga: é o que costuma vir logo antes de apertar de novo.)
  const folgado = m.pressao !== 'fair';
  const folgadoDesde = folgado ? (antes.folgadoDesde ?? m.agora) : null;
  if (folgadoDesde !== null && m.agora - folgadoDesde >= FOLGA_PARA_VOLTAR_MS) return { apertado: false, folgadoDesde: null, jaVoltou: true, perdasSeguidas };
  return { ...antes, apertado: true, folgadoDesde, perdasSeguidas };
}

/** A fração de quadros perdidos entre duas leituras dos contadores do WebRTC (somados de todos os vídeos que chegam). */
export function fracaoPerdida(
  antes: { decodificados: number; perdidos: number } | null,
  agora: { decodificados: number; perdidos: number },
): number | null {
  if (!antes) return null;
  const decodificados = agora.decodificados - antes.decodificados;
  const perdidos = agora.perdidos - antes.perdidos;
  if (decodificados < 0 || perdidos < 0 || decodificados + perdidos < 10) return null; // pouco vídeo para julgar
  return perdidos / (decodificados + perdidos);
}
