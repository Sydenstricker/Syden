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

/**
 * A taxa da trilha de vozes, que é gravada à parte (ver `Clipe.vozes`).
 *
 * 48 kbps em Opus é voz limpa, e é 3% do que o vídeo gasta. É esse número que faz a segunda gravação
 * caber sem violar a regra do alto deste arquivo — "nada de dobrar o trabalho do computador de quem
 * está só assistindo".
 */
const TAXA_DE_VOZ = 48_000;

/** O formato de áudio puro que este navegador sabe gravar. Vazio quando não sabe nenhum. */
function tipoDeAudioSuportado(): string {
  for (const tipo of ['audio/webm;codecs=opus', 'audio/webm']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(tipo)) return tipo;
  }
  return '';
}

function tipoSuportado(): string {
  for (const tipo of ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(tipo)) return tipo;
  }
  return '';
}

export interface Clipe {
  blob: Blob;
  segundos: number;
  /**
   * As vozes da sala, gravadas À PARTE e na mesma janela de tempo. null quando não havia vozes para
   * gravar (ninguém com microfone ligado, ou navegador sem o que é preciso).
   *
   * POR QUE DUAS GRAVAÇÕES E NÃO UMA MISTURADA. A escolha "com ou sem som da sala" é feita DEPOIS, no
   * editor — e a gravação já aconteceu. Misturando na hora de gravar, a caixinha não teria como
   * separar o que já está junto; gravando só o jogo, ela não teria como trazer o que nunca entrou.
   * Duas trilhas é o que torna a escolha possível de verdade.
   *
   * E NÃO DOBRA O TRABALHO DO COMPUTADOR, que é a regra escrita no alto deste arquivo: a segunda
   * gravação é SÓ ÁUDIO. Opus sai por volta de 32 kbps contra os 1,6 Mbps do vídeo — uns 2% a mais.
   */
  vozes: Blob | null;
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
export function gravarEmRolagem(stream: MediaStream, vozes?: MediaStream | null): GravacaoEmRolagem | null {
  const tipo = tipoSuportado();
  if (!tipo || stream.getVideoTracks().length === 0) return null;
  const tipoDeVoz = tipoDeAudioSuportado();

  let anterior: Clipe | null = null;
  let pedacos: Blob[] = [];
  let pedacosDeVoz: Blob[] = [];
  let comecou = 0;
  let gravador: MediaRecorder | null = null;
  let gravadorDeVoz: MediaRecorder | null = null;
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

    // A SEGUNDA GRAVAÇÃO COMEÇA NO MESMO INSTANTE, e é isso que as mantém alinhadas: as duas abrem
    // aqui e fecham juntas em `fechar()`, então o segundo 7 de uma é o segundo 7 da outra.
    //
    // E ELA NUNCA DERRUBA O CLIPE. Se o navegador não souber gravar só áudio, ou se não houver voz
    // nenhuma para pegar, o `catch` deixa `gravadorDeVoz` em null e o clipe sai com o som do jogo,
    // como sempre saiu. Vozes são um ganho; vídeo é a função.
    pedacosDeVoz = [];
    gravadorDeVoz = null;
    if (vozes && tipoDeVoz && vozes.getAudioTracks().length > 0) {
      try {
        const segundo = new MediaRecorder(vozes, { mimeType: tipoDeVoz, audioBitsPerSecond: TAXA_DE_VOZ });
        segundo.ondataavailable = (evento) => evento.data.size > 0 && pedacosDeVoz.push(evento.data);
        segundo.start();
        gravadorDeVoz = segundo;
      } catch {
        gravadorDeVoz = null;
      }
    }
    return true;
  }

  /**
   * Fecha a gravação em curso e devolve o arquivo completo.
   *
   * O `fechando` É O CONSERTO DE UMA CORRIDA QUE DEIXAVA A TESOURA MUDA. Dois caminhos chamam esta
   * função: o relógio de trinta em trinta segundos e a pessoa apertando o botão. Quando os dois se
   * cruzavam — e eles se cruzam uma vez a cada trinta segundos —, o segundo achava o gravador já em
   * `inactive`, desistia na primeira linha e devolvia null. Nos primeiros trinta segundos não há
   * gravação anterior para servir de reserva, então o clique não produzia NADA: nem arquivo, nem
   * aviso. Era exatamente o "cliquei na tesoura e não funcionou".
   *
   * Com a promessa guardada, quem chega no meio espera a que já está em curso em vez de tropeçar nela.
   */
  let fechando: Promise<Clipe | null> | null = null;

  function fechar(): Promise<Clipe | null> {
    if (fechando) return fechando;
    const atual = gravador;
    if (!atual || atual.state === 'inactive') return Promise.resolve(null);
    const segundos = decorridos();
    const deVoz = gravadorDeVoz;
    gravadorDeVoz = null;

    // As duas param juntas. A de voz é esperada à parte porque ela PODE NÃO EXISTIR, e o clipe não
    // pode ficar pendurado esperando uma gravação que nunca começou.
    const vozFechada = new Promise<Blob | null>((pronto) => {
      if (!deVoz || deVoz.state === 'inactive') return pronto(null);
      deVoz.onstop = () => pronto(pedacosDeVoz.length > 0 ? new Blob(pedacosDeVoz, { type: 'audio/webm' }) : null);
      try {
        deVoz.stop();
      } catch {
        pronto(null);
      }
    });

    fechando = new Promise<Clipe | null>((pronto) => {
      atual.onstop = async () => {
        const blob = pedacos.length > 0 ? new Blob(pedacos, { type: 'video/webm' }) : null;
        // O tipo vai sem os codecs no nome: com eles, o endereço do arquivo ganha ponto e vírgula e o
        // servidor recusa o envio.
        pronto(blob ? { blob, segundos, vozes: await vozFechada } : null);
      };
      atual.stop();
    }).finally(() => {
      fechando = null;
    }) as Promise<Clipe | null>;
    return fechando;
  }

  if (!comecar()) return null;

  // De trinta em trinta segundos: fecha, guarda como "a anterior" e recomeça.
  relogio = setInterval(() => {
    if (parado) return;
    void fechar().then((fechado) => {
      if (parado) return;
      if (fechado) anterior = fechado;
      // Só recomeça se ninguém recomeçou antes: o pegar() também fecha e recomeça, e dois
      // MediaRecorder na mesma faixa é um a mais do que o computador precisa.
      if (!gravador || gravador.state === 'inactive') comecar();
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
      if (!parado && (!gravador || gravador.state === 'inactive')) comecar();
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

// ===================================================================================================
// O AJUSTE FINO: cortar começo e fim, e mexer no volume.
//
// Pedido depois de a função existir: "controlar o fim e o começo, assim como ajuste no volume, gera
// muito valor". O que NÃO foi feito, de propósito, é um editor de vídeo com linha do tempo e canais —
// num arquivo de trinta segundos, cortar as pontas e acertar o volume é quase tudo o que alguém quer.
// ===================================================================================================

/** O recorte pedido: de onde até onde, e quanto o som sai mais alto ou mais baixo (1 = como veio). */
export interface Corte {
  inicio: number;
  fim: number;
  volume: number;
  /** A trilha de vozes da sala, quando a pessoa marcou a caixinha. null = clipe só com o som do jogo. */
  vozes?: Blob | null;
}

/** Nada a fazer: o pedaço é o arquivo inteiro, o volume não mudou e não há voz para juntar. */
export function corteVazio(corte: Corte, duracao: number): boolean {
  if (corte.vozes) return false;
  return corte.inicio <= 0.05 && corte.fim >= duracao - 0.05 && Math.abs(corte.volume - 1) < 0.01;
}

/**
 * VÍDEO GRAVADO PELO NAVEGADOR NÃO TRAZ A DURAÇÃO ESCRITA DENTRO, e sem ela não há barra de corte:
 * `video.duration` vem `Infinity`. O truque é o mesmo de `corrigirDuracao` — pedir um tempo impossível
 * faz o navegador varrer o arquivo até o fim e descobrir o tamanho.
 *
 * Aqui ele precisa ser uma PROMESSA, e não um efeito solto: quem desenha a barra precisa esperar o
 * número chegar, senão desenha uma régua de tamanho infinito.
 */
export async function duracaoDoClipe(video: HTMLVideoElement): Promise<number> {
  // O SALTO SÓ VALE DEPOIS DOS METADADOS. Pedido antes, o navegador o ignora calado, a duração nunca
  // aparece e quem esperava por ela espera para sempre — no diálogo do clipe, isso deixava a duração
  // em zero, e com zero o arquivo saía cru, SEM AS VOZES que a caixinha prometia.
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    await new Promise<void>((pronto) => video.addEventListener('loadedmetadata', () => pronto(), { once: true }));
  }
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  return new Promise((pronto) => {
    const aoSaber = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      video.removeEventListener('durationchange', aoSaber);
      video.removeEventListener('timeupdate', aoSaber);
      const total = video.duration;
      video.currentTime = 0;
      pronto(total);
    };
    video.addEventListener('durationchange', aoSaber);
    video.addEventListener('timeupdate', aoSaber);
    video.currentTime = 1e101;
  });
}

function irPara(video: HTMLMediaElement, segundo: number): Promise<void> {
  return new Promise((pronto) => {
    if (Math.abs(video.currentTime - segundo) < 0.02) return pronto();
    const chegou = () => {
      video.removeEventListener('seeked', chegou);
      pronto();
    };
    video.addEventListener('seeked', chegou);
    video.currentTime = segundo;
  });
}

/**
 * Corta o clipe e devolve um arquivo novo.
 *
 * O NAVEGADOR NÃO SABE CORTAR UM WEBM SEM REGRAVÁ-LO. Não há, na plataforma, como remover os
 * primeiros segundos de um arquivo já codificado — quem faz isso é ffmpeg, e trazê-lo para dentro do
 * Syden custaria uns 30 MB baixados por quem só queria cortar um clipe. Então o caminho é tocar o
 * pedaço escolhido e gravar o que toca: **o corte demora o tempo do pedaço cortado.** Dez segundos de
 * clipe, dez segundos de espera. É o preço, e por isso quem chama recebe o andamento para mostrar.
 *
 * O SOM PASSA PELO WEB AUDIO, e é daí que sai o controle de volume: um ganho entre o vídeo e o
 * gravador. A cadeia termina no gravador e NÃO em `ctx.destination`, de propósito — cortar um clipe
 * não deve tocar o clipe em volume alto no computador de quem está cortando.
 *
 * E HÁ UM GANHO DE BRINDE, que vale mais que o volume: a faixa de som do gravador existe desde o
 * primeiro quadro, mesmo quando o arquivo de origem não tem som nenhum. O arquivo que sai daqui
 * sempre tem trilha de áudio — o que some é a dúvida sobre se o clipe "perdeu" o som no caminho.
 */
export async function recortarClipe(
  blob: Blob,
  { inicio, fim, volume, vozes }: Corte,
  aoAndar?: (fracao: number) => void,
): Promise<Blob> {
  const tipo = tipoSuportado();
  if (!tipo) throw new Error('Este navegador não sabe gravar vídeo.');

  const video = document.createElement('video');
  const endereco = URL.createObjectURL(blob);
  video.src = endereco;
  video.playsInline = true;
  // `muted` aqui silenciaria também a cadeia do Web Audio, e o corte sairia mudo. Quem impede o som
  // de ir para o alto-falante é a cadeia não chegar em ctx.destination, logo abaixo.
  video.muted = false;

  // A trilha das vozes, quando a pessoa pediu. Ela é um arquivo só de áudio gravado na MESMA janela
  // de tempo do vídeo, então o segundo N de um é o segundo N do outro — é essa igualdade que permite
  // juntar os dois sem nenhum cálculo de sincronia.
  const audio = vozes ? document.createElement('audio') : null;
  const enderecoDaVoz = vozes ? URL.createObjectURL(vozes) : '';
  if (audio) {
    audio.src = enderecoDaVoz;
    audio.muted = false;
  }
  // ESCUTAR NO MESMO INSTANTE EM QUE O ARQUIVO COMEÇA A CARREGAR, e foi aqui que o corte travava.
  // A escuta ficava lá embaixo, DEPOIS de medir a duração do vídeo. Em clipe curto a medição é
  // rápida e dava tempo; em clipe de 25 segundos ela demora, o aviso de "carreguei" das vozes já
  // tinha passado quando alguém foi ouvi-lo, e o corte esperava para sempre — barra em 0%, nenhum
  // erro, "Guardar no computador" sem fazer nada. Medido em e2e/clipe.mjs.
  //
  // O PRAZO é a mesma regra de cima: voz que não abre em cinco segundos não segura o clipe.
  const vozCarregada = new Promise<boolean>((pronto) => {
    if (!audio) return pronto(false);
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return pronto(true);
    audio.addEventListener('loadedmetadata', () => pronto(true), { once: true });
    audio.addEventListener('error', () => pronto(false), { once: true });
    setTimeout(() => pronto(false), 5000);
  });

  const ctx = new AudioContext();
  let gravador: MediaRecorder | null = null;

  try {
    await new Promise<void>((pronto, falhou) => {
      video.onloadedmetadata = () => pronto();
      video.onerror = () => falhou(new Error('Não deu para abrir o clipe para cortar.'));
    });
    // Quem chamou pode não saber a duração ainda (o diálogo manda Infinity): aqui ela é medida de novo.
    const total = await duracaoDoClipe(video);
    const ate = Number.isFinite(fim) && fim > 0 ? Math.min(fim, total) : total;

    // A VOZ NÃO PODE DERRUBAR O CORTE. Se este arquivo não abrir, o clipe sai com o som do jogo em
    // vez de não sair — perder as vozes é um incômodo, perder o clipe é perder a jogada.
    const vozPronta = await vozCarregada;

    const fonte = ctx.createMediaElementSource(video);
    const ganho = ctx.createGain();
    ganho.gain.value = volume;
    const destino = ctx.createMediaStreamDestination();
    fonte.connect(ganho).connect(destino);

    // As vozes entram no MESMO destino, por um ganho próprio: o controle de volume do editor mexe no
    // som do jogo, e as vozes ficam como foram capturadas. Abaixar o jogo para ouvir a galera é
    // exatamente o que se quer poder fazer.
    if (audio && vozPronta) {
      const fonteDaVoz = ctx.createMediaElementSource(audio);
      const ganhoDaVoz = ctx.createGain();
      ganhoDaVoz.gain.value = 1;
      fonteDaVoz.connect(ganhoDaVoz).connect(destino);
    }

    const doVideo = (video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
    const saida = new MediaStream([...doVideo.getVideoTracks(), ...destino.stream.getAudioTracks()]);

    const pedacos: Blob[] = [];
    gravador = new MediaRecorder(saida, { mimeType: tipo, videoBitsPerSecond: TAXA });
    gravador.ondataavailable = (evento) => evento.data.size > 0 && pedacos.push(evento.data);

    await irPara(video, inicio);
    if (audio && vozPronta) await irPara(audio, Math.min(inicio, Math.max(0, audio.duration || inicio)));
    await ctx.resume().catch(() => {});
    const terminou = new Promise<void>((pronto) => {
      gravador!.onstop = () => pronto();
    });
    gravador.start();
    // Os dois começam a tocar no mesmo instante; como foram gravados na mesma janela, ficam juntos.
    if (audio && vozPronta) await audio.play().catch(() => {});
    await video.play();

    await new Promise<void>((pronto) => {
      const olhar = () => {
        const andou = (video.currentTime - inicio) / Math.max(0.001, ate - inicio);
        aoAndar?.(Math.min(1, Math.max(0, andou)));
        if (video.currentTime >= ate || video.ended) {
          clearInterval(relogio);
          pronto();
        }
      };
      const relogio = setInterval(olhar, 100);
    });

    video.pause();
    audio?.pause();
    if (gravador.state !== 'inactive') gravador.stop();
    await terminou;
    aoAndar?.(1);
    // Sem os codecs no nome: com eles o envio ganha ponto e vírgula no tipo e o servidor recusa.
    return new Blob(pedacos, { type: 'video/webm' });
  } finally {
    try {
      if (gravador && gravador.state !== 'inactive') gravador.stop();
    } catch {
      // já tinha parado
    }
    video.pause();
    video.src = '';
    URL.revokeObjectURL(endereco);
    if (audio) {
      audio.pause();
      audio.src = '';
      URL.revokeObjectURL(enderecoDaVoz);
    }
    void ctx.close().catch(() => {});
  }
}
