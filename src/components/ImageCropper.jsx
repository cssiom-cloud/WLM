import { useEffect, useRef, useState } from 'react';
import { btnGhost, btnPrimary } from '../lib/ui.jsx';

const ASPECTS = [
  { id: 'free', ratio: 0 },
  { id: '1:1', ratio: 1 },
  { id: '3:4', ratio: 3 / 4 },
  { id: '4:3', ratio: 4 / 3 },
  { id: '16:9', ratio: 16 / 9 }
];

function drawCroppedImage(canvas, image, zoom, panX, panY) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cover = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom;
  const drawW = image.naturalWidth * cover;
  const drawH = image.naturalHeight * cover;
  const dx = (canvas.width - drawW) / 2 + panX;
  const dy = (canvas.height - drawH) / 2 + panY;
  ctx.drawImage(image, dx, dy, drawW, drawH);
}

export default function ImageCropper({
  file,
  aspectId = '1:1',
  title = 'Crop image',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm
}) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [aspect, setAspect] = useState(aspectId);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('crop');

  useEffect(() => {
    if (!file) {
      return undefined;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setReady(true);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    image.src = url;
    return () => {
      URL.revokeObjectURL(url);
      imageRef.current = null;
      setReady(false);
    };
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !ready) {
      return;
    }
    const ratio = ASPECTS.find((item) => item.id === aspect)?.ratio || 1;
    const cssWidth = canvas.clientWidth || 360;
    const cssHeight = ratio ? Math.round(cssWidth / ratio) : Math.round(cssWidth * 0.62);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.height = `${cssHeight}px`;
    drawCroppedImage(canvas, image, zoom, pan.x * dpr, pan.y * dpr);
  }, [aspect, pan, ready, zoom]);

  function handlePointerDown(event) {
    dragRef.current = { x: event.clientX, y: event.clientY, pan };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragRef.current) {
      return;
    }
    setPan({
      x: dragRef.current.pan.x + (event.clientX - dragRef.current.x),
      y: dragRef.current.pan.y + (event.clientY - dragRef.current.y)
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  async function confirm() {
    const preview = canvasRef.current;
    const image = imageRef.current;
    if (!preview || !image) {
      return;
    }
    const ratio = ASPECTS.find((item) => item.id === aspect)?.ratio || 0;
    const cssWidth = preview.clientWidth || 360;
    const outW = ratio === 1 || ratio === 3 / 4 ? 1600 : 2560;
    const outH = ratio ? Math.round(outW / ratio) : Math.round(outW * ((preview.clientHeight || 1) / cssWidth));
    const scale = outW / cssWidth;
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    drawCroppedImage(out, image, zoom, pan.x * scale, pan.y * scale);
    const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) {
      return;
    }
    const next = new File([blob], file?.name?.replace(/\.\w+$/, '.jpg') || 'image.jpg', { type: 'image/jpeg' });
    onConfirm?.(next);
  }

  if (!file) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/70 p-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 text-[var(--text)] shadow-2xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-stone-300/80 p-1 dark:border-white/10">
          {[
            { id: 'crop', label: 'Crop' },
            { id: 'adjust', label: 'Adjust' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`min-h-10 rounded-lg text-sm font-semibold ${
                tab === item.id ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'text-stone-700 dark:text-slate-200'
              }`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          className="mt-4 w-full cursor-grab touch-none rounded-xl bg-stone-200 dark:bg-slate-800"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <div className="mt-4 grid gap-3">
          {tab === 'crop' ? (
            <div className="flex flex-wrap gap-2">
              {ASPECTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${aspect === item.id ? btnPrimary : btnGhost} !min-h-9 px-3 text-xs`}
                  onClick={() => setAspect(item.id)}
                >
                  {item.id}
                </button>
              ))}
            </div>
          ) : (
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600 dark:text-slate-400">
              Zoom
              <input type="range" min="1" max="3" step="0.02" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" className={btnPrimary} onClick={confirm}>
              {confirmLabel}
            </button>
            <button type="button" className={btnGhost} onClick={onCancel}>
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
