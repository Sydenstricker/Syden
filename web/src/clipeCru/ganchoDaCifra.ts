/// <reference lib="webworker" />
// O GANCHO DO CLIPE SEM RECODIFICAR, dentro do worker de cifra do LiveKit (16/11/2026).
//
// O gravador de clipes de hoje (clips.ts) mantém um MediaRecorder RECODIFICANDO a transmissão o tempo todo: medido no
// app, ~1 núcleo de quem assiste (e2e/clipe-sem-recodificar.mjs, NO_APP=1), que muitas vezes está jogando. Aqui os
// quadros JÁ CODIFICADOS são copiados como chegam da rede, logo DEPOIS de a cifra de ponta a ponta os decifrar, num anel
// por faixa; o arquivo só é montado quando a pessoa pede o clipe (clipeCru/gravador.ts). Medido: a cópia custa ~0,4 ms
// por segundo, e o anel de 30 s a 3 Mbps ocupa ~11 MB.
//
// Este módulo é importado ANTES do worker do LiveKit (trabalhadorDaCifra.ts): o LiveKit faz `onmessage = ...` e
// `onrtctransform = ...`, que caem nos acessores daqui. Cada mensagem 'decode' (o caminho do createEncodedStreams, o do
// Chromium) e cada transformador 'decode' (o RTCRtpScriptTransform, o dos outros navegadores) ganha um TransformStream na
// frente do destino, que só COPIA quando a página pediu aquela faixa. Sem pedido, ele só repassa.
//
// A conversa com a página é por um BroadcastChannel, para não se meter nas mensagens do LiveKit. O React em
// desenvolvimento cria o worker duas vezes; só o que tem a faixa responde.

const CANAL = 'syden-clipe-cru';
/** Quanto do passado o anel guarda além do quadro-chave que abre a janela. */
const JANELA_MS = 30_000;
/**
 * Sem quadro-chave novo, o anel guarda até este tanto para trás, para o clipe ter de onde abrir. No NAVEGADOR o WebRTC quase
 * não manda quadro-chave sem pedido (medido: nenhum em 60 s), e não há como pedir; com 2 min aqui, uma tela parada perdia
 * o único que tinha e o clipe não saía. O clipe longo abre no editor já com os últimos 30 s escolhidos (Clipe.inicio).
 */
const MAXIMO_MS = 10 * 60_000;
/** Teto de memória por faixa. */
const MAXIMO_BYTES = 150 * 1024 * 1024;

export interface QuadroCru {
  /** A hora da chegada, em ms desde a época (performance.timeOrigin + now: comparável entre o worker e a página). */
  t: number;
  /** 'key' | 'delta' no vídeo; 'audio' no som. */
  tipo: 'key' | 'delta' | 'audio';
  /** O carimbo RTP (90 kHz no vídeo, 48 kHz no Opus). */
  rtp: number;
  w?: number;
  h?: number;
  mime?: string;
  dados: ArrayBuffer;
}

interface Faixa {
  id: string;
  anel: QuadroCru[];
  bytes: number;
  copiar: boolean;
  pedirChave?: () => Promise<void>;
  ultimaChave: number;
  video: boolean;
}

const escopo = self as unknown as DedicatedWorkerGlobalScope & { onrtctransform?: unknown };
const faixas = new Map<string, Faixa>();
const agora = () => performance.timeOrigin + performance.now();

function aparar(f: Faixa) {
  const limite = agora();
  // o quadro-chave mais recente que ainda abre a janela de 30 s: tudo antes dele pode sair
  let corte = 0;
  for (let i = f.anel.length - 1; i >= 0; i--) {
    const q = f.anel[i];
    if (q.tipo === 'key' && q.t <= limite - JANELA_MS) {
      corte = i;
      break;
    }
  }
  if (!f.video) {
    // o som não tem quadro-chave: guarda o mesmo tanto que o vídeo mais antigo poderia pedir
    while (f.anel.length && f.anel[0].t < limite - MAXIMO_MS) f.bytes -= f.anel.shift()!.dados.byteLength;
    return;
  }
  if (corte > 0) {
    for (const q of f.anel.splice(0, corte)) f.bytes -= q.dados.byteLength;
  }
  // passou do tempo ou da memória: sai um grupo inteiro (até o próximo quadro-chave), porque metade dele não decodifica
  while (f.anel.length && (f.anel[0].t < limite - MAXIMO_MS || f.bytes > MAXIMO_BYTES)) {
    f.bytes -= f.anel.shift()!.dados.byteLength;
    while (f.anel.length && f.anel[0].tipo !== 'key') f.bytes -= f.anel.shift()!.dados.byteLength;
  }
}

function embrulhar(id: string, original: WritableStream, pedirChave?: () => Promise<void>): WritableStream {
  const f: Faixa = faixas.get(id) ?? { id, anel: [], bytes: 0, copiar: false, ultimaChave: 0, video: false };
  f.pedirChave = pedirChave ?? f.pedirChave;
  faixas.set(id, f);
  let ultimoAparo = 0;
  const ts = new TransformStream({
    transform(quadro: RTCEncodedVideoFrame | RTCEncodedAudioFrame, controle) {
      if (f.copiar) {
        const t = agora();
        const video = typeof (quadro as RTCEncodedVideoFrame).type === 'string';
        const m = quadro.getMetadata() as RTCEncodedVideoFrameMetadata & { rtpTimestamp?: number; mimeType?: string };
        const tipo = video ? ((quadro as RTCEncodedVideoFrame).type === 'key' ? 'key' : 'delta') : 'audio';
        // o 'empty' do vídeo (sem dados) não serve a ninguém
        if (quadro.data.byteLength > 0 && (!video || (quadro as { type?: string }).type !== 'empty')) {
          const dados = quadro.data.slice(0);
          f.video = video;
          f.anel.push({ t, tipo, rtp: m.rtpTimestamp ?? (quadro as RTCEncodedVideoFrame).timestamp, w: m.width, h: m.height, mime: m.mimeType, dados });
          f.bytes += dados.byteLength;
          if (tipo === 'key') f.ultimaChave = t;
          if (t - ultimoAparo > 1000) {
            ultimoAparo = t;
            aparar(f);
          }
        }
      }
      controle.enqueue(quadro);
    },
  });
  ts.readable.pipeTo(original).catch(() => {});
  return ts.writable;
}

// ---------- o caminho do createEncodedStreams: a mensagem 'decode' traz os dois streams ----------
let aoMensagem: ((ev: MessageEvent) => unknown) | null = null;
Object.defineProperty(escopo, 'onmessage', {
  configurable: true,
  get: () => aoMensagem,
  set: (f) => {
    aoMensagem = f;
  },
});
escopo.addEventListener('message', (ev: MessageEvent) => {
  const d = ev.data;
  if (d?.kind === 'decode' && d.data?.writableStream && typeof d.data.trackId === 'string') {
    d.data.writableStream = embrulhar(d.data.trackId, d.data.writableStream);
  }
  aoMensagem?.call(escopo, ev);
});

// ---------- o caminho do RTCRtpScriptTransform: o transformador traz os streams e o pedido de quadro-chave ----------
interface Transformador {
  options?: { kind?: string; trackId?: string };
  readable: ReadableStream;
  writable: WritableStream;
  sendKeyFrameRequest?: () => Promise<void>;
}
let aoTransformar: ((ev: { transformer: Transformador }) => unknown) | null = null;
let ouvindoTransform = false;
Object.defineProperty(escopo, 'onrtctransform', {
  configurable: true,
  get: () => aoTransformar,
  set: (f) => {
    aoTransformar = f;
    if (ouvindoTransform) return;
    ouvindoTransform = true;
    // a propriedade daqui esconde a do navegador: o evento só chega por um ouvinte de verdade
    escopo.addEventListener('rtctransform' as keyof WorkerGlobalScopeEventMap, (ev) => {
      const t = (ev as unknown as { transformer: Transformador }).transformer;
      const id = t.options?.trackId;
      if (t.options?.kind === 'decode' && id) {
        const writable = embrulhar(id, t.writable, () => t.sendKeyFrameRequest!());
        aoTransformar?.({ transformer: { options: t.options, readable: t.readable, writable, sendKeyFrameRequest: () => t.sendKeyFrameRequest!() } });
      } else aoTransformar?.({ transformer: t });
    });
  },
});

// ---------- a conversa com a página ----------
const canal = new BroadcastChannel(CANAL);
canal.onmessage = (ev: MessageEvent) => {
  const p = ev.data as { pergunta?: string; id?: string; faixas?: string[] };
  if (!p?.pergunta || !p.id) return;
  const minhas = (p.faixas ?? []).map((id) => faixas.get(id)).filter((f): f is Faixa => !!f);
  if (!minhas.length) return; // não é este worker
  const responder = (dados: object) => canal.postMessage({ resposta: p.id, ...dados });
  if (p.pergunta === 'gravar' || p.pergunta === 'parar') {
    for (const f of minhas) {
      f.copiar = p.pergunta === 'gravar';
      if (!f.copiar) {
        f.anel = [];
        f.bytes = 0;
      }
    }
    responder({ ok: true });
  } else if (p.pergunta === 'estado') {
    const t = agora();
    responder({
      agora: t,
      faixas: minhas.map((f) => ({ id: f.id, video: f.video, quadros: f.anel.length, mb: f.bytes / 1048576, desde: f.anel[0]?.t ?? t, ultimaChave: f.ultimaChave, podePedirChave: !!f.pedirChave })),
    });
  } else if (p.pergunta === 'pedirChave') {
    const f = minhas.find((x) => x.pedirChave);
    if (!f) return responder({ ok: false });
    f.pedirChave!().then(
      () => responder({ ok: true }),
      () => responder({ ok: false }),
    );
  } else if (p.pergunta === 'quadros') {
    // uma cópia (o anel continua): o BroadcastChannel clona, sem transferir
    responder({ agora: agora(), faixas: minhas.map((f) => ({ id: f.id, video: f.video, quadros: f.anel.slice() })) });
  }
};
