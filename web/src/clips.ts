// Clipes: os últimos trinta segundos do que está sendo transmitido, para guardar a jogada boa depois de
// ela já ter acontecido.
//
// COMO ISSO FUNCIONA, E POR QUE NÃO DO JEITO ÓBVIO. O caminho natural seria gravar sem parar e jogar
// fora os pedaços velhos. Isso até abre (o primeiro pedaço traz o cabeçalho do arquivo, e sem ele nada
// abre), mas o arquivo fica mentindo sobre si mesmo: o navegador anuncia a duração da gravação INTEIRA,
// e a barra do player fica maior que o vídeo. Medido, não chutado.
//
// Então a gravação é fechada e recomeçada a cada trinta segundos. O que sai é sempre um arquivo
// completo e honesto. Pedir um clipe fecha a gravação em curso; se ela for muito nova para valer a pena,
// entrega a anterior, que cobre os trinta segundos logo antes. Uma gravação só rodando — nada de dobrar
// o trabalho do computador de quem está só assistindo.

/** O tamanho da janela: de quanto em quanto tempo a gravação é fechada e recomeçada. */
export const SEGUNDOS_DO_CLIPE = 30;

/** Abaixo disso a gravação em curso é nova demais, e o clipe sai da anterior. */
const CURTO_DEMAIS = 10;

/**
 * Taxa da gravação. Trinta segundos a 1,6 Mbps dão uns 6 MB — abaixo do limite de 8 MB por arquivo do
 * chat, que é para o clipe poder ser mandado na conversa sem reclamação.
 */
const TAXA = 1_600_000;

function tipoSuportado(): string {
  for (const tipo of ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(tipo)) return tipo;
  }
  return '';
}

export interface Clipe {
  blob: Blob;
  segundos: number;
}

export interface GravacaoEmRolagem {
  /** Fecha o que dá e devolve o clipe. Null enquanto não houver nada que preste. */
  pegar(): Promise<Clipe | null>;
  parar(): void;
  /** Quantos segundos já dá para clipar (para o botão só acender quando valer a pena). */
  segundosProntos(): number;
}

/**
 * Começa a guardar os últimos segundos de um vídeo. Devolve null quando o navegador não sabe gravar —
 * aí quem chamou simplesmente não mostra o botão de clipe.
 */
export function gravarEmRolagem(stream: MediaStream): GravacaoEmRolagem | null {
  const tipo = tipoSuportado();
  if (!tipo || stream.getVideoTracks().length === 0) return null;

  let anterior: Clipe | null = null;
  let pedacos: Blob[] = [];
  let comecou = 0;
  let gravador: MediaRecorder | null = null;
  let parado = false;
  let relogio: ReturnType<typeof setInterval> | null = null;

  const decorridos = () => (comecou ? Math.round((Date.now() - comecou) / 1000) : 0);

  function comecar(): boolean {
    try {
      gravador = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: TAXA });
    } catch {
      return false; // faixa que o navegador não sabe gravar
    }
    pedacos = [];
    comecou = Date.now();
    gravador.ondataavailable = (evento) => evento.data.size > 0 && pedacos.push(evento.data);
    gravador.start();
    return true;
  }

  /** Fecha a gravação em curso e devolve o arquivo completo. */
  function fechar(): Promise<Clipe | null> {
    const atual = gravador;
    if (!atual || atual.state === 'inactive') return Promise.resolve(null);
    const segundos = decorridos();
    return new Promise((pronto) => {
      atual.onstop = () => {
        const blob = pedacos.length > 0 ? new Blob(pedacos, { type: 'video/webm' }) : null;
        // O tipo vai sem os codecs no nome: com eles, o endereço do arquivo ganha ponto e vírgula e o
        // servidor recusa o envio.
        pronto(blob ? { blob, segundos } : null);
      };
      atual.stop();
    });
  }

  if (!comecar()) return null;

  // De trinta em trinta segundos: fecha, guarda como "a anterior" e recomeça.
  relogio = setInterval(() => {
    if (parado) return;
    void fechar().then((fechado) => {
      if (parado) return;
      if (fechado) anterior = fechado;
      comecar();
    });
  }, SEGUNDOS_DO_CLIPE * 1000);

  return {
    async pegar() {
      if (parado) return null;
      const emCurso = decorridos();
      // Gravação recém-começada: a anterior cobre justamente o pedaço que acabou de passar.
      if (emCurso < CURTO_DEMAIS && anterior) return anterior;
      const fechado = await fechar();
      if (fechado) anterior = fechado;
      if (!parado) comecar();
      return fechado ?? anterior;
    },
    segundosProntos() {
      if (parado) return 0;
      const emCurso = decorridos();
      return emCurso < CURTO_DEMAIS && anterior ? anterior.segundos : emCurso;
    },
    parar() {
      if (parado) return;
      parado = true;
      if (relogio) clearInterval(relogio);
      try {
        if (gravador && gravador.state !== 'inactive') gravador.stop();
      } catch {
        // já tinha parado sozinho quando a transmissão acabou
      }
      gravador = null;
      pedacos = [];
      anterior = null;
    },
  };
}

/**
 * Vídeo gravado pelo navegador não traz a duração escrita dentro do arquivo, e o player fica sem a
 * barra. Pedir um tempo impossível faz o navegador varrer o arquivo até o fim e descobrir o tamanho;
 * depois disso ele volta para o começo e a barra funciona.
 */
export function corrigirDuracao(video: HTMLVideoElement) {
  if (video.dataset.duracaoCorrigida || Number.isFinite(video.duration)) return;
  video.dataset.duracaoCorrigida = 'sim';
  const aoAtualizar = () => {
    video.removeEventListener('timeupdate', aoAtualizar);
    video.currentTime = 0;
  };
  video.addEventListener('timeupdate', aoAtualizar);
  video.currentTime = 1e101;
}

/** Nome do arquivo do clipe: quem estava transmitindo e a hora, para não virar "video (3)". */
export function nomeDoClipe(de: string): string {
  const agora = new Date();
  const dois = (n: number) => String(n).padStart(2, '0');
  const quando = `${dois(agora.getDate())}-${dois(agora.getMonth() + 1)} ${dois(agora.getHours())}h${dois(agora.getMinutes())}`;
  const quem = de.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'clipe';
  return `Clipe de ${quem} ${quando}.webm`;
}
