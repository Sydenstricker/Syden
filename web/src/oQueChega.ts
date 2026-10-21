import { useEffect } from 'react';
import type { TrackPublication } from 'livekit-client';
import { api } from './api';
import { desktopBridge } from './desktop';
import { ondeRoda } from './ondeRoda';
import { economizandoDados } from './qualidadeQueRecebo';
import { MEDIDAS_PARA_REGISTRAR } from './streamStats';

/**
 * A TRANSMISSÃO QUE CHEGA EMBAÇADA, DO LADO DE QUEM ASSISTE (20/10/2026). O de quem transmite já vai ao diário quando
 * aperta (proximoAperto, em streamStats.ts); mas a terceira causa do relato "está toda embaçada" — a internet de quem
 * ASSISTE, que faz o servidor mandar a camada pequena — não aparecia em lugar nenhum, e o silêncio do diário podia ser
 * só falta de dado. Agora, chegando bem menor do que é mostrada por umas três medições seguidas (~12 s), quem assiste
 * manda uma linha: o tamanho que chega, o que a transmissão tem, onde é mostrada, a taxa e a perda de pacotes.
 * Uma vez por transmissão.
 */
const INTERVALO_MS = 4000;
/** Chegando com menos de 60% da altura em que é mostrada, o olho vê borrado. */
const PROPORCAO_BORRADA = 0.6;

export interface Chegada {
  recebida: { largura: number; altura: number };
  mostrada: { largura: number; altura: number };
  publicada: { largura: number; altura: number } | null;
  fps: number;
  kbps: number | null;
  perda: number | null;
  economia: boolean;
}

/** A linha do diário (cabe nos 200 caracteres que o servidor guarda). */
export function resumoDoQueChega(c: Chegada, segundos: number): string {
  const partes = [
    `chega embaçada há ${Math.round(segundos)} s`,
    `recebe ${c.recebida.largura}×${c.recebida.altura} a ${Math.round(c.fps)} fps` + (c.kbps !== null ? `, ${c.kbps} kbps` : ''),
    c.perda !== null ? `perda ${c.perda}%` : null,
    `mostrada em ${c.mostrada.largura}×${c.mostrada.altura}`,
    c.publicada ? `a transmissão tem ${c.publicada.largura}×${c.publicada.altura}` : null,
    c.economia ? 'economia de dados ligada' : null,
  ];
  return partes.filter(Boolean).join(' · ').slice(0, 200);
}

/** Está borrada? Só quando chega algo (altura > 0) e bem menor do que o quadro em que aparece. */
export function chegaBorrada(recebida: number, mostrada: number) {
  return recebida > 0 && mostrada > 0 && recebida < mostrada * PROPORCAO_BORRADA;
}

/** Vigia a transmissão de outra pessoa enquanto ela está na tela, e registra uma vez se chegar embaçada. */
export function useRegistroDoQueChega(publication: TrackPublication | undefined, ativo: boolean) {
  useEffect(() => {
    const track = publication?.track;
    if (!ativo || !track) return;
    let seguidas = 0;
    let registrado = false;
    let antes: { bytes: number; perdidos: number; recebidos: number; quando: number } | null = null;

    const medir = async () => {
      if (registrado) return;
      const el = track.attachedElements[0] as HTMLVideoElement | undefined;
      if (!el || document.hidden || !el.isConnected) return;
      const dpr = window.devicePixelRatio || 1;
      const mostrada = { largura: Math.round(el.clientWidth * dpr), altura: Math.round(el.clientHeight * dpr) };
      let recebida = { largura: 0, altura: 0 };
      let fps = 0;
      let agora: { bytes: number; perdidos: number; recebidos: number; quando: number } | null = null;
      try {
        (await track.getRTCStatsReport())?.forEach((e: Record<string, unknown>) => {
          if (e.type !== 'inbound-rtp' || e.kind !== 'video') return;
          recebida = { largura: Number(e.frameWidth ?? 0), altura: Number(e.frameHeight ?? 0) };
          fps = Number(e.framesPerSecond ?? 0);
          agora = { bytes: Number(e.bytesReceived ?? 0), perdidos: Number(e.packetsLost ?? 0), recebidos: Number(e.packetsReceived ?? 0), quando: performance.now() };
        });
      } catch {
        return;
      }
      const medida = agora as typeof antes;
      let kbps: number | null = null;
      let perda: number | null = null;
      if (medida && antes) {
        const s = (medida.quando - antes.quando) / 1000;
        if (s > 0 && medida.bytes >= antes.bytes) kbps = Math.round(((medida.bytes - antes.bytes) * 8) / s / 1000);
        const perdidos = medida.perdidos - antes.perdidos, recebidos = medida.recebidos - antes.recebidos;
        if (perdidos >= 0 && recebidos + perdidos > 0) perda = Math.round((perdidos / (recebidos + perdidos)) * 100);
      }
      antes = medida;
      seguidas = chegaBorrada(recebida.altura, mostrada.altura) ? seguidas + 1 : 0;
      if (seguidas < MEDIDAS_PARA_REGISTRAR) return;
      registrado = true;
      const dim = publication?.dimensions;
      const linha = resumoDoQueChega(
        { recebida, mostrada, publicada: dim ? { largura: dim.width, altura: dim.height } : null, fps, kbps, perda, economia: economizandoDados() },
        (seguidas * INTERVALO_MS) / 1000,
      );
      void api('/api/client-errors', {
        method: 'POST',
        body: { kind: 'transmissão', message: linha, onde: ondeRoda(navigator.userAgent, desktopBridge !== undefined) },
      }).catch(() => {});
    };

    const timer = setInterval(() => void medir(), INTERVALO_MS);
    return () => clearInterval(timer);
  }, [publication, publication?.track, ativo]);
}
