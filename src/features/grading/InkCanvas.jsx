import { useCallback, useEffect, useRef } from 'react';

/** Transparent drawing layer over a PDF page. Points are relative (0-1);
 *  stroke width is relative to the page width so ink scales with zoom. */
export default function InkCanvas({ strokes, tool, color, width, onStroke, readOnly }) {
  const ref = useRef(null);
  const live = useRef(null);

  const paint = useCallback(
    (extra) => {
      const c = ref.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const { width: w, height: h } = c;
      ctx.clearRect(0, 0, w, h);
      const all = extra ? [...strokes, extra] : strokes;
      for (const s of all) {
        if (!s.points || s.points.length < 2) continue;
        ctx.save();
        ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(1, s.width * w) * (s.tool === 'eraser' ? 4 : 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x * w, s.points[i].y * h);
        ctx.stroke();
        ctx.restore();
      }
    },
    [strokes],
  );

  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      c.width = c.offsetWidth * dpr;
      c.height = c.offsetHeight * dpr;
      paint();
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [paint]);

  useEffect(() => paint(), [paint]);

  const rel = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const down = (e) => {
    if (readOnly || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = { points: [rel(e)], color, width, tool, ts: Date.now() };
  };
  const move = (e) => {
    if (!live.current) return;
    live.current.points.push(rel(e));
    paint(live.current);
  };
  const up = () => {
    const s = live.current;
    live.current = null;
    if (s && s.points.length >= 2) onStroke(s);
  };

  return (
    <canvas
      ref={ref}
      className={`gr-ink ${readOnly ? 'is-readonly' : tool === 'eraser' ? 'is-eraser' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    />
  );
}
