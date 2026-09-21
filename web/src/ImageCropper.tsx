import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { readAsDataUrl } from './upload';

const EDITOR = 300; // lado da área de edição, em pixels de tela
const OUTPUT = 256; // lado da imagem salva
const MAX_ZOOM = 4;

/**
 * Escolhe qual pedaço da imagem vira o ícone: arrastando e aproximando, com a prévia do recorte do lado.
 * O que aparece dentro do quadrado é exatamente o que os outros vão ver.
 */
export function ImageCropper({
  file,
  title,
  shape = 'circle',
  onCancel,
  onDone,
}: {
  file: File;
  title: string;
  /** Como o recorte aparece no app: redondo (avatar) ou quadrado com cantos arredondados (comunidade). */
  shape?: 'circle' | 'rounded';
  onCancel: () => void;
  onDone: (image: string) => Promise<void> | void;
}) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const smallRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Um endereço temporário só para mostrar a imagem enquanto a pessoa ajusta; some ao fechar.
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    createImageBitmap(file).then(
      (loaded) => {
        if (cancelled) loaded.close();
        else setBitmap(loaded);
      },
      () => setError('Não foi possível abrir essa imagem.'),
    );
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Tamanho da imagem na tela: no zoom 1 ela cobre o quadrado inteiro, sem sobrar borda.
  const base = bitmap ? EDITOR / Math.min(bitmap.width, bitmap.height) : 1;
  const scale = base * zoom;
  const shown = bitmap ? { width: bitmap.width * scale, height: bitmap.height * scale } : { width: 0, height: 0 };

  // Não deixa arrastar a imagem para dentro do quadrado, o que deixaria um canto vazio.
  const clamp = useCallback(
    (value: number, size: number) => Math.min(0, Math.max(EDITOR - size, value)),
    [],
  );

  useEffect(() => {
    setOffset((current) => ({ x: clamp(current.x, shown.width), y: clamp(current.y, shown.height) }));
  }, [clamp, shown.width, shown.height]);

  /** Centraliza a imagem quando ela acaba de carregar. */
  useEffect(() => {
    if (!bitmap) return;
    const width = bitmap.width * base;
    const height = bitmap.height * base;
    setOffset({ x: (EDITOR - width) / 2, y: (EDITOR - height) / 2 });
  }, [bitmap, base]);

  /** Desenha o recorte num canvas do tamanho pedido (serve para as prévias e para salvar). */
  const draw = useCallback(
    (canvas: HTMLCanvasElement | null, size: number) => {
      if (!canvas || !bitmap) return;
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const factor = size / EDITOR;
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, offset.x * factor, offset.y * factor, shown.width * factor, shown.height * factor);
    },
    [bitmap, offset.x, offset.y, shown.width, shown.height],
  );

  useEffect(() => {
    draw(previewRef.current, 88);
    draw(smallRef.current, 40);
  }, [draw]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragging.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset({
      x: clamp(drag.originX + (event.clientX - drag.startX), shown.width),
      y: clamp(drag.originY + (event.clientY - drag.startY), shown.height),
    });
  }

  function endDrag() {
    dragging.current = null;
  }

  async function save() {
    if (!bitmap) return;
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      draw(canvas, OUTPUT);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
      if (!blob) throw new Error('Não foi possível processar essa imagem.');
      await onDone(await readAsDataUrl(blob));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog cropper" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="dialog-body">Arraste a imagem e use a barra para aproximar. O que fica dentro do quadro é o que os outros veem.</p>

        <div className="cropper-body">
          <div
            className={`cropper-view ${shape}`}
            style={{ width: EDITOR, height: EDITOR }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {bitmap && objectUrl && (
              <img
                src={objectUrl}
                alt=""
                draggable={false}
                style={{ width: shown.width, height: shown.height, transform: `translate(${offset.x}px, ${offset.y}px)` }}
              />
            )}
            <span className="cropper-mask" aria-hidden="true" />
          </div>

          <aside className="cropper-preview">
            <h3>Como vão te ver</h3>
            <canvas ref={previewRef} className={`cropper-thumb ${shape}`} width={88} height={88} />
            <canvas ref={smallRef} className={`cropper-thumb small ${shape}`} width={40} height={40} />
            <p className="settings-hint">Na lista e na barra lateral.</p>
          </aside>
        </div>

        <label className="cropper-zoom">
          Aproximar
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Aproximar a imagem"
          />
        </label>

        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={save} disabled={busy || !bitmap}>
            {busy ? 'Enviando…' : 'Usar esta imagem'}
          </button>
        </div>
      </div>
    </div>
  );
}
