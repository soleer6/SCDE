import { useRef, useEffect, useCallback } from 'react';

/**
 * PdfCanvas – transparent canvas overlaid on a PDF page.
 * All coordinates are stored as relative values (0-1).
 */
export default function PdfCanvas({ page, strokes, tool, color, width, onStrokeComplete }) {
    const canvasRef = useRef(null);
    const drawing = useRef(false);
    const currentPoints = useRef([]);

    /* ── Redraw all committed strokes ── */
    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width: w, height: h } = canvas;
        ctx.clearRect(0, 0, w, h);

        for (const stroke of strokes) {
            if (!stroke.points || stroke.points.length < 2) continue;
            ctx.save();
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
            }
            ctx.stroke();
            ctx.restore();
        }
    }, [strokes]);

    useEffect(() => { redraw(); }, [redraw]);

    /* ── Resize observer: keep canvas size in sync with its container ── */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const observer = new ResizeObserver(() => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            redraw();
        });
        observer.observe(canvas.parentElement);
        return () => observer.disconnect();
    }, [redraw]);

    /* ── Convert client coords → relative (0-1) ── */
    const toRelative = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
        };
    };

    /* ── Draw live preview of the current stroke ── */
    const drawLive = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width: w, height: h } = canvas;
        redraw(); // repaint committed strokes first

        const pts = currentPoints.current;
        if (pts.length < 2) return;
        ctx.save();
        ctx.strokeStyle = tool === 'eraser' ? 'rgba(255,255,255,0.9)' : color;
        ctx.lineWidth = tool === 'eraser' ? width * 4 : width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x * w, pts[0].y * h);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x * w, pts[i].y * h);
        }
        ctx.stroke();
        ctx.restore();
    }, [redraw, color, width, tool]);

    /* ── Pointer events ── */
    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        currentPoints.current = [toRelative(e)];
    };

    const onPointerMove = (e) => {
        if (!drawing.current) return;
        currentPoints.current.push(toRelative(e));
        drawLive();
    };

    const onPointerUp = () => {
        if (!drawing.current) return;
        drawing.current = false;
        const pts = currentPoints.current;
        if (pts.length >= 2) {
            onStrokeComplete(page, pts, color, width, tool);
        }
        currentPoints.current = [];
        redraw();
    };

    return (
        <canvas
            ref={canvasRef}
            className="pdf-canvas"
            style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
        />
    );
}
