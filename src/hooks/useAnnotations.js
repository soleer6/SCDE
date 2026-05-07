import { useState, useCallback } from 'react';

/**
 * useAnnotations – manages per-page annotation strokes.
 *
 * Stroke shape:
 * {
 *   page: number,
 *   points: [{x, y}],   // relative coords 0-1
 *   color: string,
 *   width: number,
 *   timestamp: number,
 *   author: string,
 * }
 */
export default function useAnnotations(instanceId, author = 'profesor@uni.es') {
    // { [page]: Stroke[] }
    const [strokesByPage, setStrokesByPage] = useState({});
    const [textComment, setTextComment] = useState('');

    const loadAnnotations = useCallback(() => {
        if (!instanceId) return;
        try {
            const raw = localStorage.getItem(`scde_annotations_${instanceId}`);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.textComment) setTextComment(data.textComment);

            const byPage = {};
            (data.strokes || []).forEach(s => {
                if (!byPage[s.page]) byPage[s.page] = [];
                byPage[s.page].push(s);
            });
            setStrokesByPage(byPage);
        } catch (err) {
            console.error('Error loading annotations', err);
        }
    }, [instanceId]);

    const saveAnnotations = useCallback(() => {
        if (!instanceId) return;
        const flatStrokes = Object.values(strokesByPage).flat();
        const data = {
            instanceId,
            author,
            savedAt: Date.now(),
            textComment,
            strokes: flatStrokes
        };
        localStorage.setItem(`scde_annotations_${instanceId}`, JSON.stringify(data));
    }, [instanceId, author, textComment, strokesByPage]);

    const addStroke = useCallback((page, points, color, width, tool = 'pen') => {
        if (!points || points.length < 2) return;
        const stroke = {
            page,
            points,
            color,
            width,
            tool,
            timestamp: Date.now(),
            author,
        };
        setStrokesByPage((prev) => ({
            ...prev,
            [page]: [...(prev[page] ?? []), stroke],
        }));
    }, [author]);

    const clearPage = useCallback((page) => {
        setStrokesByPage((prev) => ({ ...prev, [page]: [] }));
    }, []);

    const undo = useCallback((page) => {
        setStrokesByPage((prev) => {
            const current = prev[page] ?? [];
            if (current.length === 0) return prev;
            return { ...prev, [page]: current.slice(0, -1) };
        });
    }, []);

    const getStrokes = useCallback((page) => strokesByPage[page] ?? [], [strokesByPage]);

    return {
        strokesByPage, addStroke, clearPage, undo, getStrokes,
        textComment, setTextComment, loadAnnotations, saveAnnotations
    };
}
