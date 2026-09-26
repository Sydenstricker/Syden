import { Mic, MicOff, MonitorPlay, Send, Square, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { API_URL, loadToken } from './api';
import { corrigirDuracao } from './clips';
import { formatBytes } from './upload';

// Recado em vídeo de tela: para explicar uma coisa mostrando, quando a pessoa não está online. Grava até
// dez minutos da tela (com a sua voz, se quiser), manda na conversa como um vídeo comum e some sozinho
// depois de sete dias — é o preço de deixar um arquivo desse tamanho no servidor.

export const MINUTOS_DO_RECADO = 10;
const LIMITE_SEGUNDOS = MINUTOS_DO_RECADO * 60;
/** Tela é quase parada, então comprime bem: a esta taxa, dez minutos dão uns 60 MB. */
const TAXA_VIDEO = 800_000;

function tipoSuportado(): string {
  for (const tipo of ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(tipo)) return tipo;
  }
  return '';
}

/** O navegador sabe gravar a tela? Sem isso o botão nem aparece. */
export function podeGravarTela(): boolean {
  return Boolean(navigator.mediaDevices?.getDisplayMedia) && tipoSuportado() !== '';
}

function relogio(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Fase = 'parado' | 'gravando' | 'pronto';

export function ScreenMessage({ channelId, onEnviado }: { channelId: number; onEnviado?: () => void }) {
  const [fase, setFase] = useState<Fase>('parado');
  const [comVoz, setComVoz] = useState(true);
  const [segundos, setSegundos] = useState(0);
  const [gravado, setGravado] = useState<{ blob: Blob; url: string; segundos: number } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gravador = useRef<MediaRecorder | null>(null);
  const faixas = useRef<MediaStreamTrack[]>([]);
  const pedacos = useRef<Blob[]>([]);
  const relogioRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Os segundos já gravados, fora do estado: o relógio lê e escreve nele a cada segundo. */
  const contador = useRef(0);

  /** Desliga tudo o que estiver ligado: câmera de tela, microfone e o relógio. */
  function desligar() {
    if (relogioRef.current) clearInterval(relogioRef.current);
    relogioRef.current = null;
    for (const faixa of faixas.current) faixa.stop();
    faixas.current = [];
  }

  useEffect(() => () => desligar(), []);
  useEffect(() => {
    const url = gravado?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [gravado]);

  async function comecar() {
    setErro(null);
    const tipo = tipoSuportado();
    if (!tipo) return setErro('Este navegador não sabe gravar vídeo.');

    let tela: MediaStream;
    try {
      tela = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: true });
    } catch {
      return; // fechou o seletor sem escolher nada: não é erro
    }

    const trilhas: MediaStreamTrack[] = [...tela.getTracks()];
    if (comVoz) {
      try {
        const voz = await navigator.mediaDevices.getUserMedia({ audio: true });
        trilhas.push(...voz.getAudioTracks());
      } catch {
        setErro('Sem o microfone: o recado vai só com o som da tela.');
      }
    }
    faixas.current = trilhas;

    // Uma faixa de som só: a da tela e a da voz misturadas, senão o navegador grava só a primeira.
    const sons = trilhas.filter((t) => t.kind === 'audio');
    const video = trilhas.find((t) => t.kind === 'video');
    if (!video) return setErro('Não veio imagem da tela.');

    let misturado: MediaStreamTrack | null = null;
    let contexto: AudioContext | null = null;
    if (sons.length > 0) {
      contexto = new AudioContext();
      const destino = contexto.createMediaStreamDestination();
      for (const som of sons) contexto.createMediaStreamSource(new MediaStream([som])).connect(destino);
      misturado = destino.stream.getAudioTracks()[0] ?? null;
    }

    const stream = new MediaStream(misturado ? [video, misturado] : [video]);
    pedacos.current = [];
    const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: TAXA_VIDEO });
    gravador.current = rec;
    rec.ondataavailable = (e) => e.data.size > 0 && pedacos.current.push(e.data);
    rec.onstop = () => {
      void contexto?.close();
      const blob = new Blob(pedacos.current, { type: 'video/webm' });
      desligar();
      setGravado({ blob, url: URL.createObjectURL(blob), segundos: contador.current });
      setFase('pronto');
    };
    // A pessoa pode parar a transmissão pela barra do navegador: aí a gravação termina junto.
    video.addEventListener('ended', () => rec.state !== 'inactive' && rec.stop());

    rec.start();
    contador.current = 0;
    setSegundos(0);
    setFase('gravando');
    relogioRef.current = setInterval(() => {
      contador.current += 1;
      setSegundos(contador.current);
      if (contador.current >= LIMITE_SEGUNDOS && rec.state !== 'inactive') rec.stop();
    }, 1000);
  }

  function parar() {
    if (gravador.current?.state !== 'inactive') gravador.current?.stop();
  }

  function descartar() {
    desligar();
    setGravado(null);
    setFase('parado');
    setSegundos(0);
  }

  async function enviar() {
    if (!gravado) return;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch(
        `${API_URL}/api/channels/${channelId}/screen-video?segundos=${gravado.segundos}&nome=${encodeURIComponent('Recado em vídeo.webm')}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream', ...(loadToken() && { authorization: `Bearer ${loadToken()}` }) },
          body: gravado.blob,
        },
      );
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        throw new Error(corpo.error ?? `Erro ${resposta.status}`);
      }
      descartar();
      onEnviado?.();
    } catch (e) {
      setErro((e as Error).message);
    }
    setEnviando(false);
  }

  if (fase === 'parado') {
    return (
      <div className="recado-linha">
        <button className="btn-secondary" onClick={() => void comecar()}>
          <MonitorPlay size={16} /> Gravar a tela
        </button>
        <button
          className={`icon-plain${comVoz ? ' ativo' : ''}`}
          title={comVoz ? 'Gravando com a sua voz' : 'Gravando sem a sua voz'}
          aria-pressed={comVoz}
          onClick={() => setComVoz(!comVoz)}
        >
          {comVoz ? <Mic size={16} /> : <MicOff size={16} />}
        </button>
        <span className="settings-hint">Até {MINUTOS_DO_RECADO} minutos. O recado some da conversa em 7 dias.</span>
        {erro && <span className="form-error small">{erro}</span>}
      </div>
    );
  }

  if (fase === 'gravando') {
    return (
      <div className="recado-linha gravando">
        <span className="recado-ponto" aria-hidden="true" />
        <strong>{relogio(segundos)}</strong>
        <span className="settings-hint">de {relogio(LIMITE_SEGUNDOS)}</span>
        <button className="btn-primary" onClick={parar}>
          <Square size={14} /> Parar e ver
        </button>
        {erro && <span className="form-error small">{erro}</span>}
      </div>
    );
  }

  return (
    <div className="recado-pronto">
      <video className="recado-video" src={gravado?.url} controls onLoadedMetadata={(e) => corrigirDuracao(e.currentTarget)} />
      <div className="recado-linha">
        <span className="settings-hint">
          {relogio(gravado?.segundos ?? 0)} · {formatBytes(gravado?.blob.size ?? 0)} · some em 7 dias
        </span>
        <button className="link-button danger" onClick={descartar}>
          <Trash2 size={15} /> Descartar
        </button>
        <button className="btn-primary" disabled={enviando} onClick={() => void enviar()}>
          <Send size={15} /> {enviando ? 'Enviando…' : 'Mandar na conversa'}
        </button>
      </div>
      {erro && <p className="form-error">{erro}</p>}
    </div>
  );
}
